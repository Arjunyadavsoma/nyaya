import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth/session";
import { bookmarkSchema } from "@/lib/utils/validators";

export async function POST(req: NextRequest) {
  const user = await getOrCreateUser();
  const body = await req.json().catch(() => null);
  const parsed = bookmarkSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  try {
    const bm = await db.bookmark.upsert({
      where: { userId_type_refId: { userId: user.id, type: parsed.data.type, refId: parsed.data.refId } },
      create: { userId: user.id, type: parsed.data.type, refId: parsed.data.refId, label: parsed.data.label },
      update: { label: parsed.data.label },
    });
    return NextResponse.json({ ok: true, id: bm.id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getOrCreateUser();
  const body = await req.json().catch(() => null);
  if (!body || !body.type || !body.refId) {
    return NextResponse.json({ error: "type and refId required" }, { status: 422 });
  }
  await db.bookmark.deleteMany({
    where: { userId: user.id, type: body.type, refId: body.refId },
  });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const user = await getOrCreateUser();
  const bookmarks = await db.bookmark.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ bookmarks });
}
