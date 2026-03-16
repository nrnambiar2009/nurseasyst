import { parseExpiryToDate } from "./types";

/** Convert YYMMDD to YYYY-MM-DD for storage */
export function expiryToISODate(yymmdd: string): string {
  const d = parseExpiryToDate(yymmdd);
  if (!d) return yymmdd;
  return d.toISOString().slice(0, 10);
}
