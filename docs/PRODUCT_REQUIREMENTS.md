# Nyaya — Product Requirements Document

**Version:** 1.0 (post-audit baseline)
**Date:** 12 November 2026
**Source of truth:** Master Development Prompt (Nyaya) + verified capabilities of the existing repository (see PROJECT_AUDIT.md)

---

## 1. Mission

Nyaya is a free, India-first AI legal assistant that helps ordinary citizens **understand laws, understand legal documents, research legal issues, identify rights and remedies, prepare drafts, discover official services, and act on practical next steps** — in plain language, with traceable sources, at zero mandatory cost.

Non-negotiable positioning:

- **Legal information, not legal advice.** Every answer carries this distinction and a disclaimer.
- **Free-model-first.** No paid API is required for the product to function. Providers are swappable.
- **Cited or silent.** A claim about law must be traceable to a retrieved source, or the system says it cannot verify it.
- **Escalate, don't substitute.** Criminal matters, safety threats and deadlines route users to official help (112, 100, 181, 1098, 1930, 15100, DLSA, advocates).

## 2. Users and personas

| Persona | Needs | Primary modules |
|---|---|---|
| **Ravi, 27, gig worker, Hyderabad** — salary withheld 2 months | Knows nothing about labour law; wants steps + drafts | Ask Nyaya, Action Workflows, Drafting, Matters |
| **Meena, 34, tenant, Bengaluru** — deposit withheld | State-specific tenancy rules; letter to landlord | Research, Drafting, Documents (agreement upload) |
| **Arjun, 45, shop owner** — defective goods dispute | Consumer complaint process + filing draft | Research, Workflows, Drafting |
| **Priya, 22, student** — UPI scam victim | Immediate reporting steps (1930), evidence checklist | Emergency playbooks (exists), Workflows |
| **Sunita, 58** — received a legal notice in English, reads Telugu | Document understanding in her language | Documents, Multilingual |
| **Paralegal / DLSA volunteer** — trusted helper | Verified content, source links, citation export | Research, Knowledge DB, Legal Aid |

Guest (anonymous) usage remains supported — a core existing feature — with private data isolated per guest session and upgradable to a real account.

## 3. Product principles

1. **Trust over dazzle.** Calm, accessible, mobile-first UI. No fake dashboard statistics, no gratuitous gradients or animations.
2. **Every legal claim cites.** Act + Section + source URL + retrieval date. Citations must resolve to actually retrieved content (existing citation validator is the enforcement point).
3. **Distinguish fact classes in every substantive answer:** verified legal fact / user-supplied fact / interpretation / options / uncertain / when to seek a professional.
4. **Jurisdiction and time awareness.** Central vs state law, and effective dates (BNS/BNSS/BSA 2023 vs legacy IPC/CrPC/Evidence Act is the canonical case).
5. **Graceful degradation.** No provider key → the app explains options and still serves curated content, playbooks and RAG extracts. No network → offline PWA shell with cached rights content.
6. **Privacy by default.** Documents and matters are tenant-isolated; deletion is real (cascade verified in audit); consent is explicit.

## 4. Module requirements

### MODULE A — Nyaya AI Legal Assistant *(partially exists — extend)*

Existing: 3 chat modes, SSE streaming, session persistence, emergency intent routing, RAG grounding, citation validation, disclaimer, feedback, history.

New requirements:

- A1 Follow-up question generation when key facts are missing (jurisdiction, dates, parties, amounts) — max 3 clarifying questions before answering with stated assumptions.
- A2 Conversation export (Markdown/PDF) and copy.
- A3 Answer schema: **Verified facts → Your situation (user facts) → What the law says (interpretation) → Your options → Uncertainty → Professional help.**
- A4 Effective-date and jurisdiction checks: any chunk past a repeal/renaming (IPC→BNS) must be presented with its period of validity; state-specific chunks must state the state.
- A5 Confidence display: retrieval score bands shown as Low/Medium/High with plain meaning.
- A6 High-risk detection (arrest, DV, suicide, urgent deadline) → playbook/helpline interstitial, already partially built via intent classifier — extend with deadline urgency patterns.

### MODULE B — Web Research Engine *(new — largest build)*

- B1 Three modes: **Quick** (≤5 sources, short summary), **Deep** (multi-query, cross-check, synthesis), **Official-only** (Tier 1/2 sources only).
- B2 Pipeline (16 stages from master prompt §5A): request understanding → query generation → search → fetch → extract → clean → dedupe → date extraction → cross-check → contradiction detection → synthesis → report.
- B3 Retrieval strategy: self-hosted SearXNG + direct official retrieval (India Code, SCI, eCourts, NALSA, gazettes) + RSS/sitemaps. No direct scraping of consumer search engines.
- B4 Extraction: HTML (Trafilatura/BeautifulSoup), PDF (PyMuPDF/pdfplumber), OCR (Tesseract) for scanned public documents.
- B5 Source tier ranking (T1 statutes/gazettes/courts → T4 blogs) with tier badges; Tier 4 never treated as authoritative.
- B6 Report format: question, executive summary, findings, laws/provisions, judgments, dates, jurisdiction, conflicts, implications, limitations, sources with clickable URLs + retrieval dates. Claims carry inline citations.
- B7 Safety: robots.txt respected, throttling, UA identification, file-size/time caps, SSRF blocklist (localhost, private ranges, cloud metadata), scraped content treated as untrusted data (delimited, never obeyed as instructions), no republishing of copyrighted text beyond fair quotation with attribution.
- B8 History: save, reopen, export PDF, copy citations, delete; compare two reports side by side.

### MODULE C — Document Intelligence *(new)*

- C1 Uploads: PDF, images (JPG/PNG), DOCX, TXT; max 10 MB; type/magic-byte validation; scanned PDFs via OCR.
- C2 Analysis: classification, plain-language summary, parties, key dates, deadlines, financial obligations, rights/obligations, clause identification, concerning-clause highlighting (with reasoning + source, never "illegal" claims), page/paragraph references, suggested lawyer questions, version comparison.
- C3 Document Q&A grounded in the extracted text with page refs.
- C4 Storage: per-user isolation, encryption at rest for file bytes, deletion cascade, retention controls.

### MODULE D — Drafting Studio *(new)*

- D1 Templates: legal notice, consumer complaint, employment grievance, RTI application, police complaint, rental dispute letter, application letter, affidavit, formal reply, general representation.
- D2 Workflow: fact intake (jurisdiction, parties, dates, amounts) → only-necessary follow-ups → structured draft with clearly marked `【placeholders】` → legal basis with citations → verification checklist → in-place editing → export PDF/DOCX.
- D3 Prohibitions: no fabricated facts/signatures/orders/stamps; no "approved" claims; user authorization required before any submission-adjacent action (and no auto-submission at all in v1).

### MODULE E — Citizen Legal Action Centre *(new)*

- E1 Initial workflows (7): salary non-payment; rental deposit dispute; consumer complaint; online financial fraud; defective product/service; legal notice response; government grievance navigation.
- E2 Each workflow: problem description → structured intake → evidence checklist → relevant laws/official guidance → action paths → document prep (links to D) → official submission instructions (links, addresses, portals) → deadline tracking → escalation options.
- E3 Deadline capture writes to Matters/reminders (Module H).

### MODULE F — Legal Research Database *(extend existing schema)*

- F1 Sources: India Code acts (incl. BNS/BNSS/BSA, CPA 2019, IT Act, RTI Act, labour and tenancy legislation), state acts, SC judgments (real per-case URLs and ideally text), High Court judgments, notifications/rules.
- F2 Per-source metadata (master prompt §10 list): identifier, title, type, jurisdiction, citation, section, publication/commencement dates, effective period, amendment history, repeal/supersession, original URL, retrieval date, integrity info.
- F3 Versioning: never present a repealed/amended section as current; show both with periods.

### MODULE G — Legal Aid & Lawyer Discovery *(extend existing locator)*

- G1 Directory: NALSA, SLSAs, DLSAs (searchable by district), government support channels.
- G2 Eligibility guidance for free legal aid (Sec. 12, Legal Services Authorities Act 1987).
- G3 Lawyer listings only with a documented verification process; explicit "unverified" state; no paid referrals/commissions/advertising until BCI professional-conduct review — record this decision in writing.

### MODULE H — My Nyaya *(new)*

- H1 Profile, saved conversations, saved research, private documents, matters with timelines, important dates, reminders, evidence checklists, generated drafts, exportable summaries, full account data export, account deletion (already cascades — extend to files).

### MODULE I — Multilingual & Accessibility *(new content, existing i18n skeleton)*

- I1 Languages: English, Hindi, Telugu (architecture ready for more).
- I2 UI string externalization via next-intl; language-aware answers; legal terms retained in original alongside translation; document translation.
- I3 Accessibility: WCAG 2.1 AA contrast/text sizing, screen-reader landmarks (largely present via Radix), voice input where free components allow (Web Speech API).

### Administration *(extend existing)*

- Four roles per master prompt (superadmin, content admin, legal reviewer, support admin — note: current hierarchy has 4 roles with slightly different names; map and migrate), user management, source management + ingestion monitoring, failed-ingestion review, legal answer evaluation queue, abuse/rate monitoring, provider health, audit logs, feature flags, feedback review. Support/legal roles must NOT read users' private documents.

## 5. Non-functional requirements

| Area | Requirement |
|---|---|
| Cost | Zero mandatory spend; all external deps documented per master prompt §3 (see AI_PROVIDER_STRATEGY.md). |
| Performance | Chat first token < 3 s (provider-dependent); emergency playbook < 500 ms; research Quick < 30 s, Deep reports asynchronous with progress events. |
| Scale target (v1) | 1k DAU, 10k research jobs/month on free tiers; documented ceiling + upgrade path. |
| Availability | App functions (curated content, playbooks, rights library) with ALL AI providers down. |
| Security | Master prompt §15 checklist; see SECURITY_AND_PRIVACY.md. |
| Privacy | DPDP Act 2023 alignment: consent, purpose limitation, deletion, grievance channel. |
| Testing | Unit + integration + security + E2E suites in CI; no feature marked done without tests (master prompt §19/§21). |
| Data retention | Chat/docs/matters retained until user deletion or 24-month inactivity; research reports 12 months; audit logs 12 months. |

## 6. Out of scope (v1)

- Automated filing/submission to courts or police (integration-only instructions).
- Paid lawyer referrals or advertising.
- Representation, e-filing, or payment features.
- Legal advice by lawyers (product is informational; escalation is a link/phone number).

## 7. Acceptance criteria (from master prompt §23, mapped to verification method)

| Criterion | Verification |
|---|---|
| Source-grounded chat answers | E2E: ask 20 canonical questions; every statutory claim's citation resolves to a retrieved chunk (unit test on validator + integration on pipeline) |
| Provider swappable without logic changes | Integration test running the same suite against a stub Ollama and a stub Groq endpoint |
| Operates with free/self-hosted model | Manual + CI job with local stub; documented Ollama setup executed in a fresh environment |
| Research retrieves/verifies/presents public sources | E2E against a fixture site + live India Code fetch; SSRF and robots tests |
| Claims have traceable sources | Report schema enforces citation IDs per finding; validator rejects orphan citations |
| Secure document upload/analysis | Security test suite: type confusion, oversize, path traversal, cross-user access (403 expected) |
| Drafts generate/edit/export | E2E: produce a legal notice draft → edit → export DOCX/PDF → verify content and placeholder absence |
| Workflows end-to-end | E2E per workflow: intake → checklist → draft → submission instructions |
| User data isolation | Automated cross-user access tests on every new endpoint |
| Security tests pass | CI security suite green |
| AI reliability tests pass | Citation-injection, outdated-law, jurisdiction, uncertainty, prompt-injection datasets green |
| Migrations reproducible | Fresh-clone → migrate → seed → build → test in CI |
| No nonfunctional placeholders | Final audit pass against this document |

## 8. Metrics

- Answer groundedness: % answers with all citations verified (target > 95% on eval set).
- Fallback rate: % answers hitting rag-fallback (target < 10% with a provider configured).
- Research report quality: % findings with Tier 1/2 citations (target > 80% in official mode).
- Escalation correctness: high-risk queries showing official help (target 100% on eval set).
- Doc adoption: uploads → analysis completion rate; draft exports per workflow.
