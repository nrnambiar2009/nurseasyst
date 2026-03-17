"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { scanImageData } from "@undecaf/zbar-wasm";
import { parseGS1DataMatrix, type GS1Parsed } from "@/lib/gs1-parser";

export interface BarcodeScannerProps {
  onResult: (parsed: GS1Parsed) => void;
  className?: string;
}

export function BarcodeScanner({ onResult, className = "" }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<"idle" | "requesting" | "scanning" | "denied" | "error">("idle");
  const [torchOn, setTorchOn] = useState(false);
  const [hasStream, setHasStream] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const lastResultRef = useRef<string | null>(null);
  const scanTimerRef = useRef<number | null>(null);

  const log = useCallback((msg: string) => {
    setDebugLog((prev) => [...prev.slice(-4), msg]);
  }, []);

  const stopScanning = useCallback(() => {
    if (scanTimerRef.current !== null) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
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
    log("Scanner mounted");

    const video = videoRef.current;
    if (!video) return;

    setStatus("requesting");

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      .then((stream) => {
        streamRef.current = stream;
        video.srcObject = stream;
        return video.play();
      })
      .then(() => {
        log("Camera started");
        setHasStream(true);
        setStatus("scanning");

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const scan = async () => {
          log("Scanning frame...");
          const v = videoRef.current;
          if (!v || v.readyState < 2) return;

          canvas.width = v.videoWidth;
          canvas.height = v.videoHeight;
          log(`Canvas: ${canvas.width}x${canvas.height}`);

          try {
            const bitmap = await createImageBitmap(v);
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            bitmap.close();
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            log(`ImageData pixels: ${imageData.data.length}`);

            const symbols = await scanImageData(imageData);
            log(`Symbols: ${symbols.length}`);
            for (const symbol of symbols) {
              const text = symbol.decode();
              if (!text) continue;
              if (!text || lastResultRef.current === text) continue;
              lastResultRef.current = text;
              const parsed = parseGS1DataMatrix(text);
              if (parsed) {
                onResult(parsed);
                lastResultRef.current = null;
              }
            }
          } catch (err: any) {
            log(`Scan error: ${err?.message || String(err)}`);
            // ignore transient decode errors
          }
        };

        scanTimerRef.current = window.setInterval(scan, 300);
      })
      .catch((err: Error) => {
        log(`WASM / camera ERROR: ${err.message}`);
        if (err.name === "NotAllowedError" || err.message?.toLowerCase().includes("permission")) {
          setStatus("denied");
        } else {
          setStatus("error");
        }
      });

    return () => {
      stopScanning();
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
    <>
      <div className={`relative overflow-hidden rounded-xl bg-black ${className}`}>
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          crossOrigin="anonymous"
          className="h-full w-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />
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
      <div
        style={{
          background: "#000",
          color: "#0f0",
          padding: "8px",
          fontSize: "11px",
          fontFamily: "monospace",
          borderRadius: "8px",
          marginTop: "8px",
        }}
      >
        {debugLog.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </>
  );
}
