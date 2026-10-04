import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { rateLimit, clientFingerprint } from "@/lib/utils/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const fp = clientFingerprint(req);
  const rl = rateLimit(`tts:${fp}`, 10);
  if (!rl.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  try {
    const { text } = await req.json() as { text?: string };
    if (!text || text.length < 1) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }
    const zai = await ZAI.create();
    const result = await zai.audio.tts.create({
      input: text.slice(0, 1000),
      model: "tts",
      voice: "default",
      response_format: "mp3",
    });
    // result may be a Blob / ArrayBuffer / { audio: string }
    let buf: Buffer;
    if (result instanceof Blob) {
      buf = Buffer.from(await result.arrayBuffer());
    } else if (result instanceof ArrayBuffer) {
      buf = Buffer.from(result);
    } else if (typeof result === "string") {
      buf = Buffer.from(result, "base64");
    } else if (result && typeof result === "object" && "audio" in result) {
      buf = Buffer.from((result as { audio: string }).audio, "base64");
    } else {
      buf = Buffer.from(String(result));
    }
    return new NextResponse(buf, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
