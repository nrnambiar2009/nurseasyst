"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import type { GS1Parsed } from "@/lib/gs1-parser";
import { lookupProductName, productNameToType } from "@/lib/product-lookup";
import { formatExpiryDisplay } from "@/lib/types";
import { expiryToISODate } from "@/lib/expiry-format";
import { supabase } from "@/lib/supabase";

const TEST_SCHOOL_ID = "00000000-0000-0000-0000-000000000001";

type Screen = "form" | "success";

export default function NewDeliveryPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("form");
  const [gtin, setGtin] = useState("");
  const [productName, setProductName] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const handleScanResult = useCallback((parsed: GS1Parsed) => {
    setGtin(parsed.gtin);
    const name = lookupProductName(parsed.gtin);
    setProductName(name);
    setLotNumber(parsed.lotNumber || "");
    setExpiryDate(parsed.expiryDate || "");
    setScanSuccess(true);
    setTimeout(() => setScanSuccess(false), 1500);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    const expiryISO = expiryToISODate(expiryDate);
    const { error } = await supabase.from("inventory_items").insert({
      school_id: TEST_SCHOOL_ID,
      product_type: productNameToType(productName),
      product_name: productName,
      gtin,
      lot_number: lotNumber,
      expiry_date: expiryISO,
      quantity: Math.max(1, quantity),
    });
    if (error) {
      setSaveError(error.message);
      setSaving(false);
      return;
    }
    setSuccessMessage(`Delivery saved. ${productName} expires ${formatExpiryDisplay(expiryDate)}.`);
    setScreen("success");
    setSaving(false);
  }, [productName, lotNumber, expiryDate, quantity, gtin]);

  const goToBoard = useCallback(() => {
    router.push("/");
  }, [router]);

  if (screen === "success") {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-sm">
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600">
              ✓
            </div>
          </div>
          <h2 className="text-center text-xl font-semibold text-slate-800">Delivery saved</h2>
          <p className="mt-2 text-center text-slate-600">{successMessage}</p>
          <button
            type="button"
            onClick={goToBoard}
            className="mt-8 w-full rounded-xl bg-slate-800 py-3 font-medium text-white hover:bg-slate-700"
          >
            Back to status board
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 pb-24">
      <div className="mx-auto max-w-lg">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/" className="text-slate-600 hover:text-slate-900">
            ← Back
          </Link>
          <h1 className="text-lg font-semibold text-slate-900">New delivery</h1>
          <span className="w-12" />
        </div>

        <div className="relative mb-6">
          <BarcodeScanner
            onResult={handleScanResult}
            className="aspect-[4/3] w-full overflow-hidden rounded-xl"
          />
          {scanSuccess && (
            <div
              className="absolute inset-0 flex items-center justify-center rounded-xl bg-green-500/90 text-white"
              style={{ animation: "scanSuccess 0.3s ease-out" }}
              aria-hidden
            >
              <span className="text-2xl font-bold">✓ Scanned</span>
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Product name</span>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
              placeholder="Scan or enter"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Lot number</span>
            <input
              type="text"
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Expiry date (YYMMDD)</span>
            <input
              type="text"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
              placeholder="260831"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Quantity</span>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
            />
          </label>
          {saveError && (
            <p className="text-sm text-red-600">{saveError}</p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !productName.trim()}
            className="w-full rounded-xl bg-slate-800 py-3 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save delivery"}
          </button>
        </div>
      </div>
    </main>
  );
}
