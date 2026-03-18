"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getDefaultScanner, scanImageData } from "@undecaf/zbar-wasm";
import { parseGS1DataMatrix, type GS1Parsed } from "@/lib/gs1-parser";

export interface BarcodeScannerProps {
  onResult: (parsed: GS1Parsed) => void;
  className?: string;
}

export function BarcodeScanner({ onResult, className = "" }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const lastRawRef = useRef<string | null>(null);

  const [status, setStatus] = useState<"idle" | "requesting" | "scanning" | "denied" | "error">("idle");
  const [torchOn, setTorchOn] = useState(false);
  const [hasStream, setHasStream] = useState(false);

  const stop = useCallback(() => {
    if (scanTimerRef.current !== null) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    lastRawRef.current = null;
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
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let cancelled = false;

    setStatus("requesting");

    (async () => {
      try {
        await getDefaultScanner();

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        video.srcObject = stream;
        await video.play();
        setHasStream(true);
        setStatus("scanning");

        scanTimerRef.current = window.setInterval(async () => {
          if (!videoRef.current || !canvasRef.current) return;
          if (videoRef.current.readyState < 2) return;

          const w = videoRef.current.videoWidth;
          const h = videoRef.current.videoHeight;
          if (!w || !h) return;

          const c = canvasRef.current;
          if (c.width !== w) c.width = w;
          if (c.height !== h) c.height = h;
          const ctx = c.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;

          ctx.drawImage(videoRef.current, 0, 0, w, h);
          const imageData = ctx.getImageData(0, 0, w, h);

          let symbols: unknown[] = [];
          try {
            symbols = (await scanImageData(imageData)) as unknown[];
          } catch {
            return;
          }

          if (!symbols.length) return;
          const symbol = symbols[0] as unknown;
          if (!symbol || typeof symbol !== "object") return;

          const decode = (symbol as { decode?: unknown }).decode;
          if (typeof decode !== "function") return;

          const raw = String((decode as () => unknown)());
          if (!raw || raw === lastRawRef.current) return;
          lastRawRef.current = raw;

          const parsed = parseGS1DataMatrix(raw);
          if (parsed && parsed.expiryDate) {
            onResult(parsed);
            stop();
          }
        }, 300);
      } catch (err: unknown) {
        const e = err as { name?: unknown; message?: unknown };
        const name = typeof e?.name === "string" ? e.name : "";
        const message = typeof e?.message === "string" ? e.message : "";
        if (name === "NotAllowedError" || message.toLowerCase().includes("permission")) {
          setStatus("denied");
        } else {
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [onResult, stop]);

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
          className="h-full w-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />
        {status === "scanning" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="rounded-full bg-black/70 px-4 py-2 text-sm font-medium text-white">Scanning...</span>
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
    </>
  );
}
