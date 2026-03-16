export interface InventoryItem {
  id: string;
  school_id: string;
  product_type: string;
  product_name: string;
  gtin: string;
  lot_number: string;
  expiry_date: string; // YYYY-MM-DD or YYMMDD stored as-is for display
  quantity: number;
  created_at?: string;
}

export type ExpiryStatus = "green" | "amber" | "red";

/** Days until expiry: green > 90, amber 30–90, red < 30 or expired */
export function getExpiryStatus(expiryDateStr: string): ExpiryStatus {
  const d = parseExpiryToDate(expiryDateStr);
  if (!d) return "red";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "red";
  if (days < 30) return "red";
  if (days <= 90) return "amber";
  return "green";
}

/** Parse YYMMDD or YYYY-MM-DD to Date */
export function parseExpiryToDate(expiryDateStr: string): Date | null {
  if (!expiryDateStr || !expiryDateStr.trim()) return null;
  const s = expiryDateStr.trim();
  if (s.length === 6 && /^\d{6}$/.test(s)) {
    const yy = parseInt(s.slice(0, 2), 10);
    const mm = parseInt(s.slice(2, 4), 10) - 1;
    const dd = parseInt(s.slice(4, 6), 10);
    const year = yy >= 0 && yy <= 50 ? 2000 + yy : 1900 + yy;
    const d = new Date(year, mm, dd);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Format expiry for display e.g. "Aug 2026" */
export function formatExpiryDisplay(expiryDateStr: string): string {
  const d = parseExpiryToDate(expiryDateStr);
  if (!d) return expiryDateStr;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
