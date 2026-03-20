const FNC1 = "\u001D";

export interface GS1Parsed {
  gtin: string;
  expiryDate: string;
  lotNumber: string;
  productName?: string;
}

function normalize(raw: string): string {
  return raw.replace(/\u001D/g, "").replace(/❤/g, "").trim();
}

function parseAI01(str: string): { value: string; rest: string } | null {
  const match = str.match(/^01(\d{14})/);
  if (!match) return null;
  return { value: match[1], rest: str.slice(match[0].length) };
}

function parseAI17(str: string): { value: string; rest: string } | null {
  const match = str.match(/^17(\d{6})/);
  if (!match) return null;
  return { value: match[1], rest: str.slice(match[0].length) };
}

function parseAI10(str: string): { value: string; rest: string } | null {
  if (!str.startsWith("10")) return null;
  const after = str.slice(2);
  const reNextAI = /^\d{2}/;
  let end = after.length;
  for (let i = 0; i < after.length; i++) {
    if (after[i] === FNC1 || after[i] === "❤") {
      end = i;
      break;
    }
    const rest = after.slice(i);
    if (rest.length >= 2 && reNextAI.test(rest) && i > 0) {
      const two = rest.slice(0, 2);
      if (["01", "17", "10", "21", "11", "13", "15", "16"].includes(two)) {
        end = i;
        break;
      }
    }
  }
  const value = after.slice(0, end).replace(/\u001D/g, "").replace(/❤/g, "").trim();
  const rest = after.slice(end).replace(/^\u001D/, "").replace(/^❤/, "");
  return { value, rest };
}

export function parseGS1DataMatrix(raw: string): GS1Parsed | null {
  const normalized = normalize(raw);
  const truncatedIndex = normalized.indexOf("...");
  const str = truncatedIndex >= 0 ? normalized.slice(0, truncatedIndex).trim() : normalized;
  if (!str.length) return null;

  let gtin = "";
  let expiryDate = "";
  let lotNumber = "";
  let rest = str;

  const r01 = parseAI01(rest);
  if (r01) { gtin = r01.value; rest = r01.rest; }

  const r17 = parseAI17(rest);
  if (r17) { expiryDate = r17.value; rest = r17.rest; }

  const r10 = parseAI10(rest);
  if (r10) { lotNumber = r10.value; }

  if (!gtin && !expiryDate) return null;

  return {
    gtin,
    expiryDate: expiryDate || "",
    lotNumber: lotNumber || "",
  };
}