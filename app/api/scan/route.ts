const scannerUrl = process.env.SCANNER_URL || "https://nurseasyst-scanner.onrender.com";

const form = new FormData();
form.append("file", file, file.name || "scan.jpg");

const response = await fetch(`${scannerUrl}/scan`, {
  method: "POST",
  body: form,
});

/*import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;
    if (!file) return NextResponse.json({ error: 'No image' }, { status: 400 });

    // Forward to ZXing public decoder
    const zxingForm = new FormData();
    zxingForm.append('f', file, file.name || 'scan.jpg');

    const zxingResponse = await fetch(
      'https://zxing.org/w/decode',
      { method: 'POST', body: zxingForm }
    );

    const html = await zxingResponse.text();

    // ZXing returns HTML — extract the decoded text from the <pre> tag
    const match = html.match(/<pre>([^<]+)<\/pre>/);
    if (!match || !match[1]) {
      // Log the raw HTML so we can debug if it fails
      console.log('ZXing raw response:', html.substring(0, 500));
      return NextResponse.json({ error: 'No barcode found', raw: html.substring(0, 500) }, { status: 404 });
    }

    const barcodeText = match[1].trim();
    console.log('ZXing decoded:', barcodeText);
    return NextResponse.json({ text: barcodeText });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}*/