import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;
    if (!file) return NextResponse.json({ error: 'No image' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const inliteResponse = await fetch(
      'https://wabr.inliteresearch.com/barcode-reader/api/decode',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_source: dataUrl,
          types: 'DataMatrix',
        }),
      }
    );

    if (!inliteResponse.ok) {
      const text = await inliteResponse.text();
      return NextResponse.json({ error: 'Inlite failed', detail: text }, { status: 500 });
    }

    const result = await inliteResponse.json();
    
    // Log full result so we can see exactly what Inlite returns
    console.log('Inlite full response:', JSON.stringify(result));

    // Try multiple possible response shapes
    const barcodes = result?.Barcodes || result?.barcodes || result?.data || [];
    if (!barcodes.length) {
      return NextResponse.json({ error: 'No barcode found', raw: result }, { status: 404 });
    }

    const text = barcodes[0]?.Text || barcodes[0]?.text || barcodes[0]?.Value || '';
    return NextResponse.json({ text, raw: result });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
