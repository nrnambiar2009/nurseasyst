"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { parseGS1DataMatrix, type GS1Parsed } from "@/lib/gs1-parser";

export interface BarcodeScannerProps {
  onResult: (parsed: GS1Parsed) => void;
  className?: string;
}

// Pre-process image: grayscale + contrast boost before sending to zxing
async function preprocessImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    // Convert to grayscale
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    // Boost contrast: push toward black or white
    const contrasted = gray < 128 ? Math.max(0, gray - 40) : Math.min(255, gray + 40);
    data[i] = contrasted;
    data[i + 1] = contrasted;
    data[i + 2] = contrasted;
  }

  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.95);
  });
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
      const processed = await preprocessImage(file);
      const processedFile = new File([processed], "scan.jpg", { type: "image/jpeg" });

      const form = new FormData();
      form.append("image", processedFile);

      const res = await fetch("/api/scan", {
        method: "POST",
        body: form,
      });

      const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      if (!res.ok || !payload?.text) {
        setStatus("error");
        setErrorMessage("Could not read barcode — try again with better lighting");
        return;
      }

      const parsed = parseGS1DataMatrix(payload.text as string);

      if (!parsed) {
        setStatus("error");
        setErrorMessage("Could not parse barcode — please enter manually");
        return;
      }

      // 1. Log the initial scan data
      console.log("Initial GS1 Scan:", parsed);

      setStatus("success");
      onResult(parsed);

      // 2. If there is a GTIN, fetch the product name and log the full result
      if (parsed.gtin) {
        try {
          const productRes = await fetch(`/api/scan?gtin=${parsed.gtin}`);
          const productData = await productRes.json();
          
          if (productData.productName) {
            const enrichedResult = { ...parsed, productName: productData.productName };
            
            // This is what you're looking for:
            console.log("Enriched GS1 Result (with Product Name):", enrichedResult);
            
            onResult(enrichedResult);
          }
        } catch (err) {
          console.error("Failed to fetch product name:", err);
        }
      }
    } catch (error) {
      setStatus("error");
      setErrorMessage("Could not read barcode — please enter manually");
    }
  },
  [onResult]
);

  const showDecoding = useMemo(() => status === "decoding", [status]);

  return (
    <div className={`rounded-xl bg-slate-100 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
      />

      {/* Scanning instructions */}
      <div className="mb-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <p className="mb-1 font-semibold text-slate-800">For best results:</p>
        <ul className="space-y-1">
          <li>📦 Lay the box flat on a surface</li>
          <li>📱 Hold phone directly above the barcode</li>
          <li>💡 Make sure lighting is even — no shadows</li>
          <li>🔍 Fill the frame with just the barcode</li>
        </ul>
      </div>

      <button
        type="button"
        onClick={pickFile}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-6 text-base font-semibold text-white hover:bg-slate-700"
      >
        📷 Scan barcode
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
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-black/70 px-4 py-3 text-sm font-medium text-white">
          <span className="animate-spin">⏳</span> Processing...
        </div>
      )}

      {status === "error" && errorMessage && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p>{errorMessage}</p>
          <button
            type="button"
            onClick={pickFile}
            className="mt-2 font-semibold underline"
          >
            Try again
          </button>
        </div>
      )}

      {status === "success" && (
        <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          ✅ Barcode scanned successfully
        </div>
      )}
    </div>
  );
}