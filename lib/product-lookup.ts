/**
 * GTIN → product name mapping for known products.
 * Can be extended with Barcode Lookup API later (https://www.barcodelookup.com/api).
 */

const GTIN_TO_NAME: Record<string, string> = {
  "00300820680513": "EpiPen 0.3mg",
  "00300820680520": "EpiPen Jr 0.15mg",
  "00069547852412": "Narcan 4mg nasal spray",
};

/** Keywords in API description → product name (for future API lookup) */
const DESCRIPTION_TO_NAME: Array<{ keyword: string; name: string }> = [
  { keyword: "albuterol", name: "Albuterol inhaler" },
  { keyword: "glucagon", name: "Glucagon emergency kit" },
];

export function lookupProductName(gtin: string, apiDescription?: string | null): string {
  const normalized = gtin.replace(/\D/g, "").slice(-14).padStart(14, "0");
  const fromTable = GTIN_TO_NAME[normalized];
  if (fromTable) return fromTable;
  if (apiDescription) {
    const lower = apiDescription.toLowerCase();
    for (const { keyword, name } of DESCRIPTION_TO_NAME) {
      if (lower.includes(keyword)) return name;
    }
  }
  return "Unknown product";
}

/** Derive product_type from product_name for storage. */
export function productNameToType(productName: string): string {
  const lower = productName.toLowerCase();
  if (lower.includes("epipen")) return "epipen";
  if (lower.includes("narcan")) return "narcan";
  if (lower.includes("albuterol")) return "albuterol";
  if (lower.includes("glucagon")) return "glucagon";
  return "other";
}
