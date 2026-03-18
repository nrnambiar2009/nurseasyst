import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;
    if (!file) return NextResponse.json({ error: 'No image' }, { status: 400 });

    const inliteForm = new FormData();
    inliteForm.append('file[]', file, file.name || 'scan.jpg');

    const inliteResponse = await fetch(
      'https://wabr.inliteresearch.com?types=DataMatrix&tbr=103',
      {
        method: 'POST',
        body: inliteForm,
      }
    );

    const text = await inliteResponse.text();
    console.log('Inlite raw response:', text);

    let result: unknown;
    try {
      result = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON from Inlite', raw: text }, { status: 500 });
    }

    const barcodes = (result as { Barcodes?: unknown })?.Barcodes;
    const list = Array.isArray(barcodes) ? barcodes : [];
    if (!list.length) {
      return NextResponse.json({ error: 'No barcode found', raw: result }, { status: 404 });
    }

    const barcodeText = (list[0] as { Text?: unknown })?.Text;
    const decoded = typeof barcodeText === 'string' ? barcodeText : '';
    console.log('Decoded barcode text:', decoded);
    return NextResponse.json({ text: decoded });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
