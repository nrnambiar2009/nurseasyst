import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;
    if (!file) return NextResponse.json({ error: 'No image' }, { status: 400 });

    const inliteForm = new FormData();
    inliteForm.append('file[]', file, file.name || 'scan.jpg');
    inliteForm.append('types', 'DataMatrix');
    inliteForm.append('tbr', '103');

    const inliteResponse = await fetch(
      'https://wabr.inliteresearch.com/barcodes/file',
      {
        method: 'POST',
        body: inliteForm,
      }
    );

    const text = await inliteResponse.text();
    console.log('Inlite raw response:', text);

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON', raw: text }, { status: 500 });
    }

    const barcodes = result?.Barcodes || [];
    if (!barcodes.length) {
      return NextResponse.json({ error: 'No barcode found', raw: result }, { status: 404 });
    }

    const barcodeText = barcodes[0]?.Text || '';
    console.log('Decoded text:', barcodeText);
    return NextResponse.json({ text: barcodeText });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
