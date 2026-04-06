"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import type { InventoryItem } from "@/lib/types";
import { getExpiryStatus, formatExpiryDisplay, parseExpiryToDate } from "@/lib/types";

const statusStyles = {
  green: "border-green-200 bg-green-50 text-green-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  red: "border-red-200 bg-red-50 text-red-800",
};

function daysUntilExpiry(expiryDateStr: string): number | null {
  const d = parseExpiryToDate(expiryDateStr);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function Home() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [schoolName, setSchoolName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // 1. Get logged-in user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      // 2. Look up their school
      const { data: school, error: schoolError } = await supabase
        .from("schools")
        .select("id, school_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (schoolError) {
        setError(schoolError.message);
        setLoading(false);
        return;
      }

      if (!school) {
        router.replace("/onboarding");
        return;
      }

      setSchoolName(school.school_name);

      // 3. Fetch inventory for their school
      const { data, error: itemsError } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("school_id", school.id)
        .order("expiry_date", { ascending: true });

      if (itemsError) {
        setError(itemsError.message);
        setItems([]);
      } else {
        setItems((data as InventoryItem[]) ?? []);
      }

      setLoading(false);
    }

    init();
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 pb-24">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">NurseAsyst</h1>
            {schoolName && (
              <p className="text-sm text-slate-500">{schoolName}</p>
            )}
          </div>
          <Link
            href="/delivery/new"
            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            New delivery
          </Link>
        </div>
        <p className="mb-6 text-slate-600">School nurse supply tracking</p>

        {loading && (
          <p className="text-center text-slate-500">Loading inventory…</p>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            <p className="font-medium">Could not load inventory</p>
            <p className="text-sm">{error}</p>
            <p className="mt-2 text-sm">
              Ensure the{" "}
              <code className="rounded bg-red-100 px-1">inventory_items</code>{" "}
              table exists in Supabase with columns: id, school_id,
              product_type, product_name, gtin, lot_number, expiry_date,
              quantity, created_at.
            </p>
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">
            <p>No inventory items yet.</p>
            <Link
              href="/delivery/new"
              className="mt-2 inline-block text-slate-800 underline"
            >
              Add your first delivery
            </Link>
          </div>
        )}
        {!loading && !error && items.length > 0 && (
          <ul className="space-y-3">
            {items.map((item) => {
              const status = getExpiryStatus(item.expiry_date);
              const days = daysUntilExpiry(item.expiry_date);
              const statusLabel =
                days === null
                  ? "Invalid date"
                  : days < 0
                  ? "Expired"
                  : days <= 90
                  ? `${days} days left`
                  : "OK";
              return (
                <li
                  key={item.id}
                  className={`rounded-xl border p-4 ${statusStyles[status]}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{item.product_name}</p>
                      <p className="mt-0.5 text-sm opacity-90">
                        Expires {formatExpiryDisplay(item.expiry_date)}
                        {item.lot_number && ` · Lot ${item.lot_number}`}
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        Qty: {item.quantity}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        status === "green"
                          ? "bg-green-200 text-green-900"
                          : status === "amber"
                          ? "bg-amber-200 text-amber-900"
                          : "bg-red-200 text-red-900"
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}