import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth/session";

/**
 * GET /api/chat/sessions/[id]
 * Returns a chat session with all its messages (oldest first).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getOrCreateUser();
  const { id } = await params;
  const session = await db.chatSession.findFirst({
    where: { id, userId: user.id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          citationsJson: true,
          createdAt: true,
          helpful: true,
        },
      },
    },
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  return NextResponse.json({
    session: {
      id: session.id,
      title: session.title,
      mode: session.mode,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: session.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        citations: (() => {
          try { return JSON.parse(m.citationsJson); } catch { return []; }
        })(),
        createdAt: m.createdAt,
        helpful: m.helpful,
      })),
    },
  });
}
