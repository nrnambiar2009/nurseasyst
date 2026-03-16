"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { Result } from "@zxing/library";
import { parseGS1DataMatrix, type GS1Parsed } from "@/lib/gs1-parser";

export interface BarcodeScannerProps {
  onResult: (parsed: GS1Parsed) => void;
  className?: string;
}

export function BarcodeScanner({ onResult, className = "" }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"idle" | "requesting" | "scanning" | "denied" | "error">("idle");
  const [torchOn, setTorchOn] = useState(false);
  const [hasStream, setHasStream] = useState(false);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastResultRef = useRef<string | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  const stopScanning = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setTorchOn(false);
    setHasStream(false);
    setStatus("idle");
  }, []);

  const toggleTorch = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack || !("getCapabilities" in videoTrack)) return;
    const caps = videoTrack.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
    if (!caps.torch) return;
    const next = !torchOn;
    videoTrack
      .applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      .then(() => setTorchOn(next))
      .catch(() => {});
  }, [torchOn]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    setStatus("requesting");

    reader
      .decodeFromVideoDevice(undefined, video, (result: Result | null, err: Error | null) => {
        if (err || !result) return;
        const text = result.getText();
        if (lastResultRef.current === text) return;
        lastResultRef.current = text;
        const parsed = parseGS1DataMatrix(text);
        if (parsed) {
          onResult(parsed);
          lastResultRef.current = null;
        }
      })
      .then((controls) => {
        controlsRef.current = controls;
        if (video.srcObject instanceof MediaStream) {
          streamRef.current = video.srcObject;
          setHasStream(true);
        }
        setStatus("scanning");
      })
      .catch((err: Error) => {
        if (err.name === "NotAllowedError" || err.message?.toLowerCase().includes("permission")) {
          setStatus("denied");
        } else {
          setStatus("error");
        }
      });

    return () => {
      stopScanning();
      readerRef.current = null;
    };
  }, [onResult, stopScanning]);

  if (status === "denied") {
    return (
      <div className={`rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800 ${className}`}>
        <p className="font-medium">Camera access denied</p>
        <p className="mt-1 text-sm">Allow camera access in your browser to scan barcodes.</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={`rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 ${className}`}>
        <p className="font-medium">Could not start camera</p>
        <p className="mt-1 text-sm">Check that a camera is available and try again.</p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl bg-black ${className}`}>
      <video
        ref={videoRef}
        muted
        playsInline
        className="h-full w-full object-cover"
        style={{ transform: "scaleX(-1)" }}
      />
      {(status === "requesting" || status === "scanning") && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <span className="rounded-full bg-black/70 px-4 py-2 text-sm font-medium text-white">
            {status === "requesting" ? "Starting camera…" : "Scanning…"}
          </span>
        </div>
      )}
      {hasStream && (
        <button
          type="button"
          onClick={toggleTorch}
          className="absolute bottom-4 right-4 rounded-lg bg-white/90 px-3 py-2 text-sm font-medium text-black shadow hover:bg-white"
          aria-label={torchOn ? "Turn off flash" : "Turn on flash"}
        >
          {torchOn ? "Flash on" : "Flash off"}
        </button>
      )}
    </div>
  );
}
