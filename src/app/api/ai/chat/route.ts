import { NextRequest } from "next/server";
import { streamAnswer } from "@/lib/ai/provider";
import { retrieve } from "@/lib/rag/retrieve";
import { chatRequestSchema } from "@/lib/utils/validators";
import { rateLimitAsync, clientFingerprint } from "@/lib/utils/rate-limit";
import { getOrCreateUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { analytics } from "@/lib/analytics/events";
import { logger } from "@/lib/utils/logger";
import { classifyIntent } from "@/lib/ai/intent-classifier";
import { getPlaybook, type EmergencyPlaybook } from "@/lib/ai/emergency-playbooks";
import { FALLBACK_RESPONSE } from "@/lib/ai/prompts";

// Serverless: never cache route output (DB-backed responses)
export const dynamic = "force-dynamic";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/ai/chat
 * Streams an AI legal answer as Server-Sent Events.
 *
 * Layer 1: Intent classification — emergency queries are routed to
 * curated playbooks (no LLM needed). General queries go through RAG.
 *
 * SSE protocol:
 *   data: {"type":"emergency","playbook":{...}}\n\n
 *   data: {"type":"retrieval","chunks":[...]}\n\n
 *   data: {"type":"token","text":"..."}\n\n
 *   data: {"type":"citations","citations":[...]}\n\n
 *   data: {"type":"done","messageId":"..."}\n\n
 *   data: {"type":"error","code":"...","message":"..."}\n\n
 */
export async function POST(req: NextRequest) {
  const fp = clientFingerprint(req);
  // Stage 0 G5: DB-backed limiter (multi-instance safe) with memory fallback.
  const rl = await rateLimitAsync(`chat:${fp}`, 20);
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ error: { code: "RATE_LIMITED", message: "Rate limit exceeded. Please wait a moment." } }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: { code: "VALIDATION_FAILED", message: "Invalid chat request." } }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }
  const { mode, message, history, sessionId } = parsed.data;
  // Language-aware responses (Stage 7): read the user's language preference.
  const langCookie = req.cookies.get("nyaya_lang")?.value;
  const language = langCookie === "hi" || langCookie === "te" ? langCookie : "en";

  // Layer 1: Intent classification
  const { intent, emergencyType } = classifyIntent(message);

  const user = await getOrCreateUser();

  // Create or fetch chat session
  let chatSession = sessionId
    ? await db.chatSession.findFirst?.({ where: { id: sessionId, userId: user.id } })
    : null;
  if (!chatSession) {
    chatSession = await db.chatSession.create?.({
      data: { userId: user.id, mode: intent === "emergency" ? "what-now" : mode, title: message.slice(0, 60) },
    });
  }

  // Persist the user message
  const userMsg = await db.chatMessage.create?.({
    data: { sessionId: chatSession.id, role: "user", content: message, mode: intent === "emergency" ? "what-now" : mode },
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      try {
        send({ type: "session", sessionId: chatSession!.id, userMessageId: userMsg.id });

        // ── EMERGENCY ROUTE ──────────────────────────────────
        // Layer 1+2: If emergency intent detected, send the playbook
        // directly — no LLM, no RAG, instant response.
        if (intent === "emergency" && emergencyType) {
          const playbook = getPlaybook(emergencyType);
          if (playbook) {
            send({ type: "emergency", playbook, emergencyType });

            // Persist assistant message (the playbook title + summary)
            const assistantText = `Emergency: ${playbook.title}\n\nFollow the steps above. In an emergency, call 112.`;
            const assistantMsg = await db.chatMessage.create?.({
              data: {
                sessionId: chatSession!.id,
                role: "assistant",
                content: assistantText,
                mode: "what-now",
                citationsJson: JSON.stringify(
                  playbook.sources.map((s) => ({
                    actName: s.act,
                    sectionNo: s.sections.join(", "),
                    sourceUrl: "https://indiacode.nic.in/",
                    verified: true,
                  }))
                ),
              },
            });

            send({
              type: "citations",
              citations: playbook.sources.map((s) => ({
                actName: s.act,
                sectionNo: s.sections.join(", "),
                sourceUrl: "https://indiacode.nic.in/",
                verified: true,
              })),
              messageId: assistantMsg.id,
              keyId: "emergency-playbook",
              retrievalCount: playbook.sources.length,
              answerLength: assistantText.length,
              approxTokens: 0,
            });
            send({ type: "done" });

            await analytics.capture({
              name: "chat.message_sent",
              properties: { mode: "emergency", emergencyType, playbook: playbook.id },
              actorId: user.id,
            });
            return;
          }
        }

        // ── GENERAL RAG ROUTE ────────────────────────────────
        const chunks = await retrieve(message, 5);

        send({ type: "retrieval", chunks: chunks.map((c) => ({ actName: c.actName, sectionNo: c.sectionNo, sourceUrl: c.sourceUrl, score: Number(c.score.toFixed(3)) })) });

        // Layer 3: Better fallback — if retrieval confidence is too low,
        // send the improved fallback response instead of a dead-end.
        const maxScore = chunks.length ? Math.max(...chunks.map((c) => c.score)) : 0;
        if (chunks.length === 0 || maxScore < 0.01) {
          // Send the fallback response as a single token
          send({ type: "token", text: FALLBACK_RESPONSE });

          const assistantMsg = await db.chatMessage.create?.({
            data: {
              sessionId: chatSession!.id,
              role: "assistant",
              content: FALLBACK_RESPONSE,
              mode,
              citationsJson: "[]",
            },
          });

          send({
            type: "citations",
            citations: [],
            messageId: assistantMsg.id,
            keyId: "fallback",
            providerStatus: "no-sources",
            aiGenerated: false,
            retrievalCount: chunks.length,
            answerLength: FALLBACK_RESPONSE.length,
            approxTokens: Math.ceil(FALLBACK_RESPONSE.length / 4),
          });
          send({ type: "done" });

          await analytics.capture({
            name: "chat.message_sent",
            properties: { mode, chunks: chunks.length, key_id: "fallback", fallback: true },
            actorId: user.id,
          });
          return;
        }

        let fullText = "";
        const result = await streamAnswer({
          mode,
          message,
          history: history.map((h) => ({ role: h.role as "user" | "assistant" | "system", content: h.content })),
          context: chunks,
          onToken: (t) => {
            fullText += t;
            send({ type: "token", text: t });
          },
        });

        const assistantMsg = await db.chatMessage.create?.({
          data: {
            sessionId: chatSession!.id,
            role: "assistant",
            content: result.fullText,
            mode,
            citationsJson: JSON.stringify(result.citations),
          },
        });

        send({
          type: "citations",
          citations: result.citations,
          messageId: assistantMsg.id,
          keyId: result.keyId,
          providerStatus: result.providerStatus,
          aiGenerated: result.aiGenerated,
          provider: result.provider,
          model: result.model,
          latencyMs: result.latencyMs,
          firstTokenMs: result.firstTokenMs,
          retrievalCount: chunks.length,
          answerLength: result.fullText.length,
          approxTokens: Math.ceil(result.fullText.length / 4) + Math.ceil(message.length / 4),
        });
        send({ type: "done" });

        await analytics.capture({
          name: "chat.message_sent",
          properties: { mode, chunks: chunks.length, key_id: result.keyId, provider_status: result.providerStatus, ai_generated: result.aiGenerated },
          actorId: user.id,
        });
      } catch (err) {
        // Structured SSE error envelope — never forward internal exception
        // messages to the client (audit S9). Full detail goes to server logs.
        const e = err as Error;
        logger.error("[chat] stream failed", { msg: e.message, stack: e.stack?.slice(0, 500) });
        send({ type: "error", code: "CHAT_STREAM_FAILED", message: "Something went wrong while generating this answer. Please try again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
