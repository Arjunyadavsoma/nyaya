/**
 * In-app analytics capture (PostHog-shaped event names so a swap is config-only).
 * Persists events to the AuditLog table + console in dev.
 */
import { db } from "@/lib/db";
import { logger } from "@/lib/utils/logger";

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  actorId?: string;
}

export async function capture(evt: AnalyticsEvent): Promise<void> {
  const { name, properties = {}, actorId } = evt;
  // Never log raw secrets; properties are sanitized upstream.
  logger.debug(`[analytics] ${name}`, properties);
  try {
    await db.auditLog.create({
      data: {
        action: name,
        entityType: "analytics",
        entityId: actorId ?? null,
        actorId: actorId ?? null,
        metadataJson: JSON.stringify(properties),
      },
    });
  } catch {
    // Audit log failures must never break user flow.
  }
}

export const analytics = { capture };
