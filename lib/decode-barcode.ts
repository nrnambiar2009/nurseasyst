export async function decodeBarcodeFromFile(file: File): Promise<string> {
  // Dynamic import so WASM only loads client-side
  const rxing = await import('rxing-wasm');

  // Draw image to canvas to get pixel data
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Convert RGBA to luma8 (grayscale) — rxing expects single channel
  const luma = new Uint8Array(bitmap.width * bitmap.height);
  for (let i = 0; i < luma.length; i++) {
    const r = imageData.data[i * 4];
    const g = imageData.data[i * 4 + 1];
    const b = imageData.data[i * 4 + 2];
    // Standard luminance formula
    luma[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  const results = rxing.decode_multi_barcode_from_raw_luma_with_hints(
    luma,
    bitmap.width,
    bitmap.height,
    {}
  );

  if (!results || results.length === 0) {
    throw new Error('No barcode found');
  }

  // Return the longest result — most likely the DataMatrix
  return results.reduce((a, b) =>
    a.getText().length >= b.getText().length ? a : b
  ).getText();
}