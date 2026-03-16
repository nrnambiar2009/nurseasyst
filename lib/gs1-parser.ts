/**
 * GS1 DataMatrix barcode parser.
 * Parses Application Identifiers: 01 (GTIN), 17 (expiry), 10 (lot).
 * Handles standard GS1 strings and FNC1 separator (GS char, ASCII 29).
 */

const FNC1 = "\u001D"; // GS character (ASCII 29) - FNC1 in transmission

export interface GS1Parsed {
  gtin: string;
  expiryDate: string;
  lotNumber: string;
}

/**
 * Normalize raw barcode string: strip FNC1/GS and optional leading/trailing spaces.
 */
function normalize(raw: string): string {
  return raw.replace(/\u001D/g, "").trim();
}

/**
 * Parse Application Identifier 01 (GTIN, 14 digits fixed).
 * Returns the 14-digit string or null if not found/invalid.
 */
function parseAI01(str: string): { value: string; rest: string } | null {
  const match = str.match(/^01(\d{14})/);
  if (!match) return null;
  return { value: match[1], rest: str.slice(match[0].length) };
}

/**
 * Parse Application Identifier 17 (expiry date, YYMMDD, 6 digits fixed).
 */
function parseAI17(str: string): { value: string; rest: string } | null {
  const match = str.match(/^17(\d{6})/);
  if (!match) return null;
  return { value: match[1], rest: str.slice(match[0].length) };
}

/**
 * Parse Application Identifier 10 (lot number, variable length).
 * Terminated by FNC1 (GS) or by the start of the next AI (two-digit prefix).
 */
function parseAI10(str: string): { value: string; rest: string } | null {
  if (!str.startsWith("10")) return null;
  const after = str.slice(2);
  // Variable-length: consume until we hit FNC1 or a valid 2-digit AI (01, 17, 10, etc.)
  const fnc1Index = after.indexOf(FNC1);
  const reNextAI = /^\d{2}/;
  let end = after.length;
  for (let i = 0; i < after.length; i++) {
    if (after[i] === FNC1) {
      end = i;
      break;
    }
    // Check if remaining looks like next AI (two digits then more)
    const rest = after.slice(i);
    if (rest.length >= 2 && reNextAI.test(rest) && i > 0) {
      const two = rest.slice(0, 2);
      if (["01", "17", "10", "21", "11", "13", "15", "16"].includes(two)) {
        end = i;
        break;
      }
    }
  }
  const value = after.slice(0, end).replace(/\u001D/g, "").trim();
  const rest = after.slice(end).replace(/^\u001D/, "");
  return { value, rest };
}

/**
 * Parse a raw GS1 DataMatrix barcode string.
 * Extracts AI 01 (GTIN), 17 (expiry YYMMDD), 10 (lot number).
 * Handles both standard GS1 and FNC1 separator variants.
 */
export function parseGS1DataMatrix(raw: string): GS1Parsed | null {
  const str = normalize(raw);
  if (!str.length) return null;

  let gtin = "";
  let expiryDate = "";
  let lotNumber = "";
  let rest = str;

  // 01 - GTIN (14 digits)
  const r01 = parseAI01(rest);
  if (r01) {
    gtin = r01.value;
    rest = r01.rest;
  }

  // 17 - Expiry (YYMMDD)
  const r17 = parseAI17(rest);
  if (r17) {
    expiryDate = r17.value;
    rest = r17.rest;
  }

  // 10 - Lot (variable)
  const r10 = parseAI10(rest);
  if (r10) {
    lotNumber = r10.value;
  }

  // Require at least GTIN for a valid parse
  if (!gtin) return null;

  return {
    gtin,
    expiryDate: expiryDate || "",
    lotNumber: lotNumber || "",
  };
}
