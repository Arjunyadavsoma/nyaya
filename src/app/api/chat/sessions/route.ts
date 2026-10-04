import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth/session";

/**
 * GET /api/chat/sessions
 * Returns the current user's chat sessions, most recent first.
 */
export async function GET() {
  const user = await getOrCreateUser();
  const sessions = await db.chatSession.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 30,
    include: {
      _count: { select: { messages: true } },
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { content: true, role: true, createdAt: true },
      },
    },
  });
  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      mode: s.mode,
      messageCount: s._count.messages,
      updatedAt: s.updatedAt,
      lastMessage: s.messages[0]?.content?.slice(0, 100) ?? null,
    })),
  });
}

/**
 * DELETE /api/chat/sessions?id=...
 * Deletes a single chat session (and its messages cascade).
 */
export async function DELETE(req: NextRequest) {
  const user = await getOrCreateUser();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 422 });
  await db.chatSession.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
