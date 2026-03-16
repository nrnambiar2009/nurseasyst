// NurseAsyst check-expiry Edge Function: send expiry/recall emails via Resend and record in alerts_sent.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API = "https://api.resend.com/emails";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "NurseAsyst <noreply@nurseasyst.com>";

type ExpiryAlert = {
  school_id: string;
  item_id: string;
  alert_type: "expiry_60" | "expiry_30" | "expiry_7";
  school_name: string;
  nurse_email: string | null;
  principal_email: string | null;
  product_name: string;
  lot_number: string;
  expiry_date: string;
  days: number;
};

type RecallAlert = {
  school_id: string;
  item_id: string;
  school_name: string;
  nurse_email: string | null;
  principal_email: string | null;
  product_name: string;
  lot_number: string;
};

function toArray<T>(x: T | T[] | null | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function formatExpiryDate(expiryDateStr: string): string {
  const d = new Date(expiryDateStr);
  if (isNaN(d.getTime())) return expiryDateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function sendResendEmail(params: {
  to: string[];
  subject: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.error("check-expiry: RESEND_API_KEY is not set");
    return { ok: false, error: "RESEND_API_KEY not set" };
  }
  const to = toArray(params.to).filter(Boolean);
  if (to.length === 0) {
    return { ok: false, error: "No recipients" };
  }
  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to,
        subject: params.subject,
        text: params.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("check-expiry: Resend API error", res.status, body);
      return { ok: false, error: `${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("check-expiry: Resend request failed", e);
    return { ok: false, error: String(e) };
  }
}

Deno.serve(async (req: Request) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Pending expiry alerts: items expiring in 60, 30, or 7 days that we haven't already sent for this (school_id, item_id, alert_type)
    const today = new Date().toISOString().slice(0, 10);
    const { data: sentRows } = await supabase
      .from("alerts_sent")
      .select("school_id, item_id, alert_type");

    const sentSet = new Set<string>();
    for (const r of toArray(sentRows)) {
      sentSet.add(`${r.school_id}:${r.item_id}:${r.alert_type}`);
    }

    const expiryWindows = [60, 30, 7] as const;
    const pendingExpiry: ExpiryAlert[] = [];

    for (const days of expiryWindows) {
      const target = new Date();
      target.setDate(target.getDate() + days);
      const targetStr = target.toISOString().slice(0, 10);
      const { data: items } = await supabase
        .from("inventory_items")
        .select("id, school_id, product_name, lot_number, expiry_date")
        .eq("expiry_date", targetStr);
      const { data: schools } = await supabase.from("schools").select("id, name, nurse_email, principal_email");
      const schoolMap = new Map(toArray(schools).map((s) => [s.id, s]));
      for (const item of toArray(items)) {
        const key = `${item.school_id}:${item.id}:expiry_${days}`;
        if (sentSet.has(key)) continue;
        const school = schoolMap.get(item.school_id);
        if (!school) continue;
        pendingExpiry.push({
          school_id: item.school_id,
          item_id: item.id,
          alert_type: `expiry_${days}` as ExpiryAlert["alert_type"],
          school_name: school.name ?? "School",
          nurse_email: school.nurse_email ?? null,
          principal_email: school.principal_email ?? null,
          product_name: item.product_name,
          lot_number: item.lot_number ?? "",
          expiry_date: item.expiry_date,
          days,
        });
      }
    }

    // 2) Pending recall alerts: from recall_alerts not yet in alerts_sent
    const { data: recallRows } = await supabase
      .from("recall_alerts")
      .select("school_id, item_id, product_name, lot_number");
    const { data: schoolsForRecall } = await supabase.from("schools").select("id, name, nurse_email, principal_email");
    const schoolMapRecall = new Map(toArray(schoolsForRecall).map((s) => [s.id, s]));
    const pendingRecall: RecallAlert[] = [];
    for (const r of toArray(recallRows)) {
      const key = `${r.school_id}:${r.item_id}:recall`;
      if (sentSet.has(key)) continue;
      const school = schoolMapRecall.get(r.school_id);
      if (!school) continue;
      pendingRecall.push({
        school_id: r.school_id,
        item_id: r.item_id,
        school_name: school.name ?? "School",
        nurse_email: school.nurse_email ?? null,
        principal_email: school.principal_email ?? null,
        product_name: r.product_name ?? "Product",
        lot_number: r.lot_number ?? "",
      });
    }

    const results: { type: string; sent: number; failed: number } = { type: "summary", sent: 0, failed: 0 };

    // 3) Send expiry emails and insert alerts_sent
    for (const a of pendingExpiry) {
      const to = [a.nurse_email, a.principal_email].filter(Boolean) as string[];
      const subject = `NurseAsyst: ${a.product_name} expires in ${a.days} days — ${a.school_name}`;
      const body = `This is an automated alert from NurseAsyst.

${a.product_name} at ${a.school_name} expires on ${formatExpiryDate(a.expiry_date)} — ${a.days} days from today.
Lot number: ${a.lot_number}

Please arrange replacement before this date.

This is a supplemental reminder. Your school remains responsible for
physical verification of all supply expiration dates.`;

      const sendResult = await sendResendEmail({ to, subject, text: body });
      if (sendResult.ok) {
        const { error: insertErr } = await supabase.from("alerts_sent").insert({
          school_id: a.school_id,
          item_id: a.item_id,
          alert_type: a.alert_type,
          sent_at: new Date().toISOString(),
        });
        if (insertErr) console.error("check-expiry: failed to insert alerts_sent (expiry)", insertErr);
        else results.sent++;
      } else {
        results.failed++;
        // Log but don't crash; continue with other alerts
      }
    }

    // 4) Send recall emails and insert alerts_sent
    for (const a of pendingRecall) {
      const to = [a.nurse_email, a.principal_email].filter(Boolean) as string[];
      const subject = `URGENT — NurseAsyst: FDA recall may affect your ${a.product_name}`;
      const body = `URGENT: NurseAsyst has detected a potential FDA recall affecting a product in your inventory.

Product: ${a.product_name}
Lot number: ${a.lot_number}
School: ${a.school_name}

Please verify immediately at: https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts

Remove this product from use until the recall status is confirmed.

NurseAsyst recall alerts are informational only and are not official FDA communications.`;

      const sendResult = await sendResendEmail({ to, subject, text: body });
      if (sendResult.ok) {
        const { error: insertErr } = await supabase.from("alerts_sent").insert({
          school_id: a.school_id,
          item_id: a.item_id,
          alert_type: "recall",
          sent_at: new Date().toISOString(),
        });
        if (insertErr) console.error("check-expiry: failed to insert alerts_sent (recall)", insertErr);
        else results.sent++;
      } else {
        results.failed++;
      }
    }

    return new Response(JSON.stringify({ ok: true, ...results }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("check-expiry: unexpected error", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
});
