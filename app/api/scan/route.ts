import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Missing image file" }, { status: 400 });
    }

    const arrayBuffer = await image.arrayBuffer();
    const base64string = Buffer.from(arrayBuffer).toString("base64");

    const inliteRes = await fetch("https://wabr.inliteresearch.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_source: "base64:" + base64string,
        types: "DataMatrix",
        authorization: "",
      }),
    });

    if (!inliteRes.ok) {
      const text = await inliteRes.text().catch(() => "");
      return NextResponse.json(
        { error: "Inlite request failed", details: text },
        { status: 502 }
      );
    }

    const data = (await inliteRes.json()) as { Text?: unknown };
    const decodedText = typeof data?.Text === "string" ? data.Text : "";

    if (!decodedText) {
      return NextResponse.json({ error: "No barcode text decoded" }, { status: 422 });
    }

    return NextResponse.json({ text: decodedText });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Unexpected error", details: msg }, { status: 500 });
  }
}
