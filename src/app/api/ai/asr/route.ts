import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { rateLimit, clientFingerprint } from "@/lib/utils/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const fp = clientFingerprint(req);
  const rl = rateLimit(`asr:${fp}`, 10);
  if (!rl.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  try {
    const form = await req.formData();
    const file = form.get("audio") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }
    // Convert to base64 for the SDK
    const buf = Buffer.from(await file.arrayBuffer());
    const file_base64 = `data:${file.type || "audio/webm"};base64,${buf.toString("base64")}`;

    const zai = await ZAI.create();
    const result = await zai.audio.asr.create({
      file_base64,
      model: "asr",
    });
    // SDK returns { text: "..." } shape
    const text = (result as { text?: string }).text ?? "";
    return NextResponse.json({ text });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
