import { z } from "zod";

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(8000),
});

export const chatRequestSchema = z.object({
  mode: z.enum(["know-the-law", "what-now", "mock-court"]).default("know-the-law"),
  message: z.string().min(1).max(4000),
  history: z.array(chatMessageSchema).max(20).default([]),
  sessionId: z.union([z.string(), z.null()]).optional(),
});

export const bookmarkSchema = z.object({
  type: z.enum(["rights-article", "playbook", "info", "template"]),
  refId: z.string().min(1),
  label: z.string().min(1).max(200),
});

export const feedbackSchema = z.object({
  messageId: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(2000).optional(),
});

export const reportSchema = z.object({
  type: z.enum(["police-station", "rights-article", "judge", "info"]),
  refId: z.string().min(1),
  reason: z.string().min(5).max(2000),
});

export const nearbyQuerySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius: z.number().min(1).max(50).default(10), // km
  q: z.string().max(200).optional(),
});
