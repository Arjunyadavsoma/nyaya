/**
 * Stage 5 — drafting tests.
 * Template filling (placeholders, unfilled tracking), workflow registry
 * integrity (every workflow complete: law refs have URLs, evidence lists,
 * templates reference the intake fields), disclaimers present.
 */
import { describe, it, expect } from "vitest";
import { WORKFLOWS, getWorkflow, fillTemplate, DRAFT_DISCLAIMER } from "@/lib/drafting/workflows";

describe("workflow registry integrity", () => {
  const REQUIRED = ["salary-nonpayment", "rental-deposit", "consumer-complaint", "online-fraud", "employment-dispute", "government-grievance", "rti-application", "police-complaint", "legal-notice", "document-preparation"];

  it("contains all 10 mission-required workflows", () => {
    for (const slug of REQUIRED) {
      expect(getWorkflow(slug), `missing workflow: ${slug}`).toBeTruthy();
    }
    expect(WORKFLOWS.length).toBeGreaterThanOrEqual(10);
  });

  for (const wf of WORKFLOWS) {
    it(`${wf.slug}: has verified law references with source URLs`, () => {
      expect(wf.law.length).toBeGreaterThan(0);
      for (const l of wf.law) {
        expect(l.instrument.length).toBeGreaterThan(3);
        expect(l.provision.length).toBeGreaterThan(3);
        expect(l.sourceUrl).toMatch(/^https:\/\//);
      }
    });

    it(`${wf.slug}: has an evidence checklist`, () => {
      expect(wf.evidence.length).toBeGreaterThan(2);
    });

    it(`${wf.slug}: has intake fields and a template`, () => {
      expect(wf.intake.length).toBeGreaterThan(3);
      expect(wf.template.length).toBeGreaterThan(200);
      expect(wf.jurisdictionNote.length).toBeGreaterThan(10);
    });

    it(`${wf.slug}: template placeholders reference defined intake fields (or common fields)`, () => {
      const common = new Set(["date_today", "place", "sender_name", "sender_address", "recipient_name", "recipient_address"]);
      const ids = new Set([...wf.intake.map((f) => f.id), ...common]);
      const placeholders = [...wf.template.matchAll(/【([a-z0-9_]+)】/gi)].map((m) => m[1]);
      expect(placeholders.length, "template should use placeholders").toBeGreaterThan(3);
      for (const p of placeholders) {
        expect(ids.has(p), `${wf.slug}: template placeholder 【${p}】 has no intake field`).toBe(true);
      }
    });
  }
});

describe("fillTemplate", () => {
  const tpl = "Dear 【recipient_name】, you owe ₹【amount_due】. From 【sender_name】 on 【date_today】.";

  it("fills provided values and tracks unfilled ones", () => {
    const { text, unfilled } = fillTemplate(tpl, {
      recipient_name: "Ramesh Traders",
      amount_due: "50,000",
      date_today: "12 November 2026",
    });
    expect(text).toBe("Dear Ramesh Traders, you owe ₹50,000. From 【sender_name】 on 12 November 2026.");
    expect(unfilled).toEqual(["sender_name"]);
  });

  it("never invents values — unfilled stay visible as 【...】", () => {
    const { text } = fillTemplate(tpl, {});
    expect(text).toContain("【recipient_name】");
    expect(text).toContain("【amount_due】");
  });

  it("trims whitespace from answers", () => {
    const { text } = fillTemplate("X 【name】 Y", { name: "  Suresh  " });
    expect(text).toBe("X Suresh Y");
  });

  it("a fully-filled rental-deposit draft has no placeholders left", () => {
    const wf = getWorkflow("rental-deposit")!;
    const answers: Record<string, string> = {};
    for (const f of wf.intake) answers[f.id] = "test value";
    const { unfilled } = fillTemplate(wf.template, { ...answers, date_today: "today" });
    expect(unfilled).toEqual([]);
  });
});

describe("honesty guardrails", () => {
  it("drafts carry the not-lawyer-reviewed disclaimer", () => {
    expect(DRAFT_DISCLAIMER).toMatch(/not.{0,20}been reviewed by a lawyer/i);
  });

  it("police-complaint cites BNSS 173 (post-2024 law), not just CrPC", () => {
    const wf = getWorkflow("police-complaint")!;
    expect(wf.template).toContain("Section 173");
    expect(wf.template).toContain("Bharatiya Nagarik Suraksha Sanhita");
  });

  it("online-fraud cites both IT Act and BNS 318(4)", () => {
    const wf = getWorkflow("online-fraud")!;
    expect(wf.template).toMatch(/66C[\s\S]*66D/);
    expect(wf.template).toContain("318(4)");
  });
});
