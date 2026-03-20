const FNC1_CHARS = ["\u001D", "❤", "\uFFFD"];

export interface GS1Parsed {
  gtin: string;
  expiryDate: string;
  lotNumber: string;
  productName?: string;
}

function normalizeFNC1(raw: string): string {
  // Replace all known FNC1 variants with standard \u001D
  let str = raw;
  for (const c of FNC1_CHARS) {
    str = str.split(c).join("\u001D");
  }
  return str.trim();
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

  const str = normalizeFNC1(raw);

  const r01 = parseAI01(str);
  const r17 = parseAI17(str);
  const r10 = parseAI10(str);

  const gtin = r01?.value ?? "";
  const expiryDate = r17?.value ?? "";
  const lotNumber = r10?.value ?? "";

  if (!gtin && !expiryDate) return null;

  return { gtin, expiryDate, lotNumber };
}