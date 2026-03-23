import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;
    if (!file) return NextResponse.json({ error: 'No image' }, { status: 400 });

    const scannerUrl = process.env.SCANNER_URL || 'https://nurseasyst-scanner.onrender.com';

    const form = new FormData();
    form.append('image', file, file.name || 'scan.jpg');

    const response = await fetch(`${scannerUrl}/scan`, {
      method: 'POST',
      body: form,
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.error || 'No barcode found' }, { status: 404 });
    }

    return NextResponse.json({ text: data.text });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}