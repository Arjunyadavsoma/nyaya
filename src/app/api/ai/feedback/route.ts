import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/auth/session";
import { feedbackSchema } from "@/lib/utils/validators";
import { analytics } from "@/lib/analytics/events";

/**
 * POST /api/ai/feedback
 * Records user feedback (helpful/not-helpful + optional comment) on a chat message.
 * Body: { messageId?, rating?, comment? }
 */
export async function POST(req: NextRequest) {
  const user = await getOrCreateUser();
  const body = await req.json().catch(() => null);
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { messageId, rating, comment } = parsed.data;

  // Update the chat message's `helpful` field if rating is provided
  if (messageId && rating != null) {
    try {
      await db.chatMessage.update({
        where: { id: messageId },
        data: { helpful: rating >= 4 },
      });
    } catch {
      // message may not exist; still record the feedback
    }
  }

  const feedback = await db.feedback.create({
    data: {
      userId: user.id,
      messageId: messageId ?? null,
      rating: rating ?? null,
      comment: comment ?? null,
    },
  });

  await analytics.capture({
    name: "chat.feedback",
    properties: { messageId, rating, hasComment: !!comment },
    actorId: user.id,
  });

  return NextResponse.json({ ok: true, id: feedback.id });
}

/**
 * GET /api/ai/feedback
 * Returns recent feedback (admin/editor only for review).
 */
export async function GET() {
  const { getUser, requireRole } = await import("@/lib/auth/session");
  try {
    await requireRole("editor");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const feedback = await db.feedback.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });
  return NextResponse.json({ feedback });
}
