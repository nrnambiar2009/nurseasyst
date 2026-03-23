const FNC1_CHARS = ["\u001D", "❤", "\uFFFD"];

export interface GS1Parsed {
  gtin: string;
  expiryDate: string;
  lotNumber: string;
  productName?: string;
}

function normalizeFNC1(raw: string): string {
  let str = raw;
  for (const c of FNC1_CHARS) {
    str = str.split(c).join("\u001D");
  }
  return str.trim();
}

function parseParenthesisFormat(str: string): GS1Parsed | null {
  if (!str.includes("(")) return null;
  const result: GS1Parsed = { gtin: "", expiryDate: "", lotNumber: "" };
  const gtinMatch = str.match(/\(01\)(\d{14})/);
  if (gtinMatch) result.gtin = gtinMatch[1];
  const expiryMatch = str.match(/\(17\)(\d{6})/);
  if (expiryMatch) result.expiryDate = expiryMatch[1];
  const lotMatch = str.match(/\(10\)([^(]+)/);
  if (lotMatch) result.lotNumber = lotMatch[1].trim();
  if (!result.gtin && !result.expiryDate) return null;
  return result;
}

function parsePlainGTIN(str: string): GS1Parsed | null {
  const match = str.match(/^(\d{8}|\d{12}|\d{13}|\d{14})$/);
  if (!match) return null;
  const gtin = match[1].padStart(14, "0");
  return { gtin, expiryDate: "", lotNumber: "" };
}

function parseAI01(str: string): { value: string; rest: string } | null {
  const match = str.match(/01(\d{14})/);
  if (!match) return null;
  const idx = str.indexOf(match[0]);
  return { value: match[1], rest: str.slice(idx + match[0].length) };
}

function parseAI17(str: string): { value: string; rest: string } | null {
  const match = str.match(/17(\d{6})/);
  if (!match) return null;
  const idx = str.indexOf(match[0]);
  return { value: match[1], rest: str.slice(idx + match[0].length) };
}

function parseAI10(str: string): { value: string } | null {
  const match = str.match(/10([^\u001D]{1,20})/);
  if (!match) return null;
  return { value: match[1].trim() };
}

export function parseGS1DataMatrix(raw: string): GS1Parsed | null {
  if (!raw) return null;

  const parenthesis = parseParenthesisFormat(raw);
  if (parenthesis) return parenthesis;

  const plainGTIN = parsePlainGTIN(raw.trim());
  if (plainGTIN) return plainGTIN;

  if (/^\d{6}$/.test(raw.trim())) {
    return { gtin: "", expiryDate: raw.trim(), lotNumber: "" };
  }

  const str = normalizeFNC1(raw);

  const r01 = parseAI01(str);
  const gtin = r01?.value ?? "";
  const remaining = r01?.rest ?? str;

  const r17 = parseAI17(remaining);
  const expiryDate = r17?.value ?? "";
  const afterExpiry = r17?.rest ?? remaining;

  const r10 = parseAI10(afterExpiry);
  const lotNumber = r10?.value ?? "";

  if (/^\d{6}$/.test(str)) {
    return { gtin: "", expiryDate: str, lotNumber: "" };
  }

  if (!gtin && !expiryDate) return null;
  return { gtin, expiryDate, lotNumber };
}