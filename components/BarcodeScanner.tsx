"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { parseGS1DataMatrix, type GS1Parsed } from "@/lib/gs1-parser";

export interface BarcodeScannerProps {
  onResult: (parsed: GS1Parsed) => void;
  className?: string;
}

export function BarcodeScanner({ onResult, className = "" }: BarcodeScannerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "decoding" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pickFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null;
      if (!file) return;

      setErrorMessage(null);
      setStatus("decoding");

      const url = URL.createObjectURL(file);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });

      try {
        const form = new FormData();
        form.append("image", file);

        const res = await fetch("/api/scan", {
          method: "POST",
          body: form,
        });

        const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        console.log("/api/scan response:", payload);

        if (!res.ok) {
          setStatus("error");
          const msg = typeof payload?.error === "string" ? payload.error : "Could not read barcode — please enter manually";
          const detail = typeof payload?.detail === "string" ? payload.detail : "";
          const details = detail ? `${msg}: ${detail}` : msg;
          setErrorMessage(details);
          return;
        }

        const raw = typeof payload?.text === "string" ? payload.text : "";
        if (!raw) {
          setStatus("error");
          const msg = typeof payload?.error === "string" ? payload.error : "Could not read barcode — please enter manually";
          setErrorMessage(msg);
          return;
        }

        const parsed = parseGS1DataMatrix(raw);

        if (!parsed) {
          setStatus("error");
          setErrorMessage("Could not parse barcode — please enter manually");
          return;
        }

        setStatus("success");
        onResult(parsed);
      } catch {
        setStatus("error");
        setErrorMessage("Could not read barcode — please enter manually");
      }
    },
    [onResult]
  );

  const showDecoding = useMemo(() => status === "decoding", [status]);

  return (
    <>
      <div className={`relative overflow-hidden rounded-xl bg-slate-100 ${className}`}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={pickFile}
          className="flex w-full items-center justify-center rounded-xl bg-slate-800 px-4 py-6 text-base font-semibold text-white hover:bg-slate-700"
        >
          Take photo of barcode
        </button>

        {previewUrl && (
          <div className="mt-3 overflow-hidden rounded-xl bg-black">
            <Image
              src={previewUrl}
              alt="Barcode photo preview"
              width={1200}
              height={900}
              className="h-auto w-full object-contain"
              unoptimized
            />
          </div>
        )}

        {showDecoding && (
          <div className="mt-3 flex items-center justify-center rounded-xl bg-black/70 px-4 py-3 text-sm font-medium text-white">
            Decoding...
          </div>
        )}

        {status === "error" && errorMessage && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {errorMessage}
          </div>
        )}
      </div>
    </>
  );
}