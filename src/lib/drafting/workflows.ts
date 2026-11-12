/**
 * Workflow definitions + drafting templates (Stage 5).
 *
 * Each workflow: structured intake fields, applicable law (verified
 * references), evidence checklist, and a draft template with 【placeholders】.
 * Placeholders are filled from intake answers; unfilled ones stay visible
 * as 【...】 so nothing is silently invented.
 *
 * Legal references are stated with their source URL; drafts ALWAYS carry
 * the not-lawyer-reviewed disclaimer. Nothing is ever auto-submitted.
 */

export type FieldType = "text" | "textarea" | "date" | "number" | "select";

export interface IntakeField {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  help?: string;
}

export interface LawRef {
  instrument: string;
  provision: string;
  sourceUrl: string;
}

export interface WorkflowDef {
  slug: string;
  title: string;
  category: string;
  description: string;
  typicalTime: string;
  jurisdictionNote: string;
  intake: IntakeField[];
  law: LawRef[];
  evidence: string[];
  template: string; // draft body with 【field.id】 placeholders
}

const COMMON_USER = `
【sender_name】, 【sender_address】
Date: 【date_today】`;

const COMMON_SEND_BLOCK = `
To,
【recipient_name】
【recipient_address】`;

export const WORKFLOWS: WorkflowDef[] = [
  {
    slug: "salary-nonpayment",
    title: "Salary or wages not paid",
    category: "employment",
    description: "Recover unpaid salary, wages, or dues from an employer.",
    typicalTime: "2–6 weeks typical (notice → labour commissioner)",
    jurisdictionNote: "Central law (Code on Wages 2019 consolidates earlier acts); state rules may add timelines.",
    intake: [
      { id: "sender_name", label: "Your full name", type: "text", required: true },
      { id: "sender_address", label: "Your address", type: "textarea", required: true },
      { id: "recipient_name", label: "Employer / company name", type: "text", required: true },
      { id: "recipient_address", label: "Employer address", type: "textarea", required: true },
      { id: "designation", label: "Your designation / role", type: "text", required: true },
      { id: "employment_period", label: "Employment period (from–to)", type: "text", required: true, placeholder: "e.g. 1 Jan 2026 to 31 Mar 2026" },
      { id: "amount_due", label: "Total amount due (₹)", type: "number", required: true },
      { id: "months_unpaid", label: "Which months / period is unpaid?", type: "text", required: true },
      { id: "last_reminder_date", label: "Date you last asked for payment (if any)", type: "date" },
    ],
    law: [
      { instrument: "Code on Wages, 2019", provision: "Section 18 — timely payment of wages", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/19403" },
      { instrument: "Payment of Wages Act, 1936", provision: "Section 15 — claims for deductions/delays", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/2206" },
      { instrument: "Industrial Disputes Act, 1947", provision: "Section 33C — recovery of money due", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/2294" },
    ],
    evidence: [
      "Employment contract / appointment letter",
      "Salary slips for paid months",
      "Bank statements showing salary credits (and their absence)",
      "Emails or messages requesting payment",
      "Resignation/relieving letter if employment ended",
    ],
    template: `${COMMON_USER}
Subject: Demand for payment of outstanding salary of ₹【amount_due】

${COMMON_SEND_BLOCK}

Dear Sir/Madam,

I was employed as 【designation】 at 【recipient_name】 from 【employment_period】. Despite my services being fully rendered, salary for 【months_unpaid】 amounting to ₹【amount_due】 has not been paid to date.

I have made repeated verbal and written requests, the most recent on 【last_reminder_date】, but the dues remain unpaid. Non-payment of earned wages violates Section 18 of the Code on Wages, 2019 (which requires timely payment of wages) and, where applicable, Section 15 of the Payment of Wages Act, 1936.

I therefore call upon you to pay the outstanding ₹【amount_due】 within 15 days of receipt of this notice, failing which I will be constrained to:
1. File a claim before the designated authority under the Code on Wages, 2019;
2. Raise a recovery claim under Section 33C of the Industrial Disputes Act, 1947; and
3. Pursue any other legal remedy available to me, at your cost and risk.

I trust this will not be necessary and await your prompt payment.

Yours faithfully,
【sender_name】
(Designation: 【designation】)`,
  },
  {
    slug: "rental-deposit",
    title: "Rental deposit dispute",
    category: "housing",
    description: "Get your security deposit back from a landlord who refuses.",
    typicalTime: "2–8 weeks typical (notice → rent authority/court)",
    jurisdictionNote: "State rent acts differ (e.g. Maharashtra Rent Control Act 1999 §11(4) mandates 30-day interest-bearing return). General contract law applies everywhere.",
    intake: [
      { id: "sender_name", label: "Your full name", type: "text", required: true },
      { id: "sender_address", label: "Your current address", type: "textarea", required: true },
      { id: "recipient_name", label: "Landlord's name", type: "text", required: true },
      { id: "recipient_address", label: "Landlord's address / property address", type: "textarea", required: true },
      { id: "deposit_amount", label: "Security deposit amount (₹)", type: "number", required: true },
      { id: "vacate_date", label: "Date you vacated / will vacate", type: "date", required: true },
      { id: "handover_date", label: "Date keys were handed over", type: "date" },
      { id: "damage_claims", label: "Deductions the landlord claims (if any)", type: "textarea" },
    ],
    law: [
      { instrument: "Indian Contract Act, 1872", provision: "Sections 73–74 — refund of security and penalty clauses", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/2293" },
      { instrument: "Model Tenancy Act, 2021", provision: "Section 11 — security deposit caps and refund", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/19014" },
      { instrument: "State Rent Acts", provision: "e.g. Maharashtra Rent Control Act 1999 s.11(4) — 30-day refund with interest", sourceUrl: "https://www.indiacode.nic.in/" },
    ],
    evidence: [
      "Rent agreement / leave-and-licence deed",
      "Deposit payment receipt or bank statement",
      "Handover / key-return acknowledgement or photos",
      "Move-in and move-out photos/video of the premises",
      "Messages/emails asking for the deposit",
      "Final electricity/ maintenance dues receipts (nil-dues)",
    ],
    template: `${COMMON_USER}
Subject: Refund of security deposit of ₹【deposit_amount】 for the premises at 【recipient_address】

${COMMON_SEND_BLOCK}

Dear 【recipient_name】,

I was the tenant of the premises noted above and vacated the same on 【vacate_date】, handing over possession/keys on 【handover_date】. A security deposit of ₹【deposit_amount】 was paid at the start of the tenancy.

Despite the premises being returned in proper condition and my repeated requests, the deposit has not been refunded. The deductions claimed by you are: 【damage_claims】. These are not supported by any agreed record and, in any event, normal wear and tear is not deductible.

Under the terms of the tenancy and the general law (Sections 73–74, Indian Contract Act, 1872; and, where enacted, the applicable state rent law requiring refund within the statutory period), the deposit must be returned promptly after vacating, failing which interest becomes payable.

I call upon you to refund ₹【deposit_amount】 within 15 days of this notice. Failing which, I will file a claim before the Rent Authority/civil court with interest and costs, and escalate to the local police if any of my belongings are withheld.

Yours faithfully,
【sender_name】`,
  },
  {
    slug: "consumer-complaint",
    title: "Consumer complaint",
    category: "consumer",
    description: "Defective goods, deficient services, or unfair trade practices.",
    typicalTime: "3–12 months at the District Commission",
    jurisdictionNote: "Central law (Consumer Protection Act 2019). Value-based forum: District ≤₹50L, State ≤₹2Cr, National above.",
    intake: [
      { id: "sender_name", label: "Your full name", type: "text", required: true },
      { id: "sender_address", label: "Your address", type: "textarea", required: true },
      { id: "recipient_name", label: "Seller / service provider name", type: "text", required: true },
      { id: "recipient_address", label: "Seller address", type: "textarea", required: true },
      { id: "product_service", label: "Product or service purchased", type: "text", required: true },
      { id: "purchase_date", label: "Purchase date", type: "date", required: true },
      { id: "amount_paid", label: "Amount paid (₹)", type: "number", required: true },
      { id: "invoice_no", label: "Invoice / order number", type: "text" },
      { id: "defect_issue", label: "What is wrong (defect / deficiency)?", type: "textarea", required: true },
      { id: "relief_sought", label: "What do you want (refund/replace/repair + compensation)?", type: "textarea", required: true },
      { id: "earlier_complaint_date", label: "Date you first complained to the seller (if any)", type: "date" },
    ],
    law: [
      { instrument: "Consumer Protection Act, 2019", provision: "Section 2(47) deficiency; s.35 complaint; s.39(1) reliefs", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/20109" },
      { instrument: "Consumer Protection (Consumer Disputes Redressal Commissions) Rules, 2020", provision: "Part III — filing before District/State Commission", sourceUrl: "https://egazette.gov.in/" },
    ],
    evidence: [
      "Invoice / bill / order confirmation",
      "Warranty card, if any",
      "Photos or video of the defect",
      "Correspondence with the seller (emails, chat logs, complaint tickets)",
      "Bank statement showing payment",
      "Packaging and product (preserve — do not discard)",
    ],
    template: `${COMMON_USER}
Subject: Complaint under the Consumer Protection Act, 2019 — defective 【product_service】

${COMMON_SEND_BLOCK}

Dear Sir/Madam,

I purchased 【product_service】 (invoice no. 【invoice_no】) from you on 【purchase_date】 for ₹【amount_paid】. The product/service suffers from the following defect/deficiency: 【defect_issue】, which amounts to a "defect"/"deficiency in service" under Section 2(47) of the Consumer Protection Act, 2019.

I first raised this with you on 【earlier_complaint_date】; the issue remains unresolved. The reliefs I seek are: 【relief_sought】.

You are called upon to provide the above reliefs within 30 days of this notice, failing which I will file a complaint before the District Consumer Disputes Redressal Commission, seeking the reliefs along with compensation for mental agony, litigation costs, and interest, as provided by Section 39(1) of the Act.

I enclose copies of the invoice, warranty, and our correspondence.

Yours faithfully,
【sender_name】`,
  },
  {
    slug: "online-fraud",
    title: "Online financial fraud",
    category: "cyber",
    description: "UPI scams, phishing, unauthorized transactions.",
    typicalTime: "First hours are critical — 1930 helpline + bank within 3 days",
    jurisdictionNote: "Central law (IT Act 2000, BNS 2023). RBI limited-liability rules for banking channels.",
    intake: [
      { id: "sender_name", label: "Your full name", type: "text", required: true },
      { id: "sender_address", label: "Your address", type: "textarea", required: true },
      { id: "bank_name", label: "Your bank name", type: "text", required: true },
      { id: "fraud_date", label: "Date/time of the fraudulent transaction", type: "text", required: true },
      { id: "amount_lost", label: "Amount lost (₹)", type: "number", required: true },
      { id: "transaction_ids", label: "Transaction IDs / UTR numbers", type: "textarea", required: true },
      { id: "fraud_description", label: "How did the fraud occur?", type: "textarea", required: true },
      { id: "reported_1930", label: "Have you called 1930 / filed on cybercrime.gov.in?", type: "select", options: ["Yes", "No"], required: true },
      { id: "complaint_no", label: "Cybercrime complaint number (if any)", type: "text" },
    ],
    law: [
      { instrument: "Information Technology Act, 2000", provision: "Section 66C identity theft; s.66D cheating by personation online", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/20111" },
      { instrument: "Bharatiya Nyaya Sanhita, 2023", provision: "Section 318(4) cheating — replaces IPC s.420", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/20099" },
      { instrument: "RBI Limited Liability of Customers Circular", provision: "DBR.No.Leg.BC.58/09.07.005/2017 — zero liability if reported within 3 working days", sourceUrl: "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=11041" },
    ],
    evidence: [
      "Screenshots of the fraudulent messages/UPI screen",
      "Bank statement highlighting the debits",
      "Transaction IDs / UTR numbers",
      "The phishing message/email/link (do not delete)",
      "Complaint acknowledgment from 1930 / cybercrime.gov.in",
    ],
    template: `${COMMON_USER}
Subject: Report of unauthorized/fraudulent electronic transactions — request for freeze and reversal

To,
The Branch Manager,
【bank_name】

Dear Sir/Madam,

On 【fraud_date】, fraudulent transactions totalling ₹【amount_lost】 were made from my account without my authorization. Details: 【fraud_description】. Transaction IDs: 【transaction_ids】.

I have reported the fraud on the National Cyber Crime Helpline 1930 / cybercrime.gov.in 【reported_1930】 (complaint no. 【complaint_no】).

These transactions are unauthorized. Under the RBI's Limited Liability of Customers circular, my liability is zero as I am reporting within three working days of the transactions. The offences fall under Section 66C/66D of the Information Technology Act, 2000 and Section 318(4) of the Bharatiya Nyaya Sanhita, 2023.

I request you to:
1. Immediately freeze/block further transactions and reverse the debited amounts;
2. Share the beneficiary account details for the police complaint;
3. Confirm action in writing within 7 days.

Failing which I will escalate to the Banking Ombudsman under the RBI Integrated Ombudsman Scheme and pursue all remedies.

Yours faithfully,
【sender_name】
(Enclosures: bank statement, screenshots, cyber complaint acknowledgment)`,
  },
  {
    slug: "employment-dispute",
    title: "Employment dispute",
    category: "employment",
    description: "Termination, harassment at work, withheld documents.",
    typicalTime: "Varies by forum (labour court / ID Act / POSH committee)",
    jurisdictionNote: "Central labour codes + ID Act; POSH Act 2013 applies to workplaces with 10+ employees.",
    intake: [
      { id: "sender_name", label: "Your full name", type: "text", required: true },
      { id: "sender_address", label: "Your address", type: "textarea", required: true },
      { id: "recipient_name", label: "Employer / HR name", type: "text", required: true },
      { id: "recipient_address", label: "Employer address", type: "textarea", required: true },
      { id: "issue_type", label: "Type of issue", type: "select", options: ["Termination", "Harassment at work", "Withheld documents (relieving letter, PF)", "Other"], required: true },
      { id: "issue_description", label: "Describe what happened", type: "textarea", required: true },
      { id: "relief_sought", label: "What resolution do you want?", type: "textarea", required: true },
    ],
    law: [
      { instrument: "Industrial Disputes Act, 1947", provision: "Section 2A dispute about dismissal — direct labour court claim", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/2294" },
      { instrument: "Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013", provision: "Section 9 complaint to Internal Committee", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/2104" },
      { instrument: "Industrial Employment (Standing Orders) Act, 1946", provision: "Certified standing orders govern termination procedure", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/2297" },
    ],
    evidence: [
      "Appointment letter and contract",
      "Termination letter / show-cause notice (if terminated)",
      "Salary slips",
      "Emails/chats with HR or management about the issue",
      "Any written complaints made earlier",
      "Witnesses' names",
    ],
    template: `${COMMON_USER}
Subject: 【issue_type】 — request for redressal

${COMMON_SEND_BLOCK}

Dear Sir/Madam,

I am employed/was employed with your organization. I am writing regarding the following issue: 【issue_description】.

This conduct is contrary to my terms of employment and applicable law. The resolution I seek is: 【relief_sought】.

I request a written response within 15 days. If the matter is not resolved, I will pursue remedies including (as applicable) a claim under Section 2A of the Industrial Disputes Act, 1947 before the Labour Court, a complaint to the Internal Committee under the POSH Act, 2013, or other proceedings.

I trust an amicable resolution is possible and look forward to your response.

Yours faithfully,
【sender_name】`,
  },
  {
    slug: "government-grievance",
    title: "Government grievance",
    category: "government",
    description: "Complain about a public service or official inaction.",
    typicalTime: "15–30 days per CPGRAMS norms, with escalation",
    jurisdictionNote: "Central: CPGRAMS. States have their own portals; some subjects (police, judiciary) have separate channels.",
    intake: [
      { id: "sender_name", label: "Your full name", type: "text", required: true },
      { id: "sender_address", label: "Your address", type: "textarea", required: true },
      { id: "recipient_name", label: "Department / office / official", type: "text", required: true },
      { id: "recipient_address", label: "Department address", type: "textarea", required: true },
      { id: "grievance_subject", label: "Subject of the grievance", type: "text", required: true },
      { id: "grievance_description", label: "Describe the grievance with dates", type: "textarea", required: true },
      { id: "earlier_reference", label: "Earlier complaint/acknowledgment numbers (if any)", type: "text" },
      { id: "relief_sought", label: "What action do you want?", type: "textarea", required: true },
    ],
    law: [
      { instrument: "Right to Information Act, 2005", provision: "Section 6 — RTI application to obtain file status", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/2299" },
      { instrument: "CPGRAMS ( Citizens' Charter)", provision: "Grievance redressal timelines — 15–30 days with appeal to higher authority", sourceUrl: "https://pgportal.gov.in/" },
    ],
    evidence: [
      "Copies of earlier applications/petitions with receipts",
      "Acknowledgment slips and numbers",
      "Relevant documents (property records, bills, medical records as applicable)",
      "Photos of the issue, if applicable",
    ],
    template: `${COMMON_USER}
Subject: 【grievance_subject】

${COMMON_SEND_BLOCK}

Dear Sir/Madam,

I am submitting the following grievance for your immediate attention:

【grievance_description】

Earlier references on this matter: 【earlier_reference】.

The action I request is: 【relief_sought】.

As per the applicable Citizens' Charter / grievance redressal norms, I request a response within 30 days. If I do not receive a satisfactory response, I will escalate this grievance on the CPGRAMS portal (pgportal.gov.in) and/or file an RTI application to ascertain the action taken on this complaint.

Yours faithfully,
【sender_name】`,
  },
  {
    slug: "rti-application",
    title: "RTI application",
    category: "government",
    description: "Request information from a public authority.",
    typicalTime: "30 days (48 hours where life/liberty involved)",
    jurisdictionNote: "Central law; some states have separate RTI rules and fees.",
    intake: [
      { id: "sender_name", label: "Your full name", type: "text", required: true },
      { id: "sender_address", label: "Your address", type: "textarea", required: true },
      { id: "recipient_name", label: "Public authority (department)", type: "text", required: true },
      { id: "recipient_address", label: "Address of the public authority / CPIO", type: "textarea", required: true },
      { id: "info_subject", label: "Subject of the information sought", type: "text", required: true },
      { id: "info_details", label: "The specific information you want (be precise)", type: "textarea", required: true },
      { id: "period", label: "Period the information relates to", type: "text", required: true },
      { id: "payment_mode", label: "How will you pay the ₹10 fee?", type: "select", options: ["IPO (Indian Postal Order)", "DD", "Court fee stamp", "Cash (with receipt)", "Online (where available)"], required: true },
    ],
    law: [
      { instrument: "Right to Information Act, 2005", provision: "Section 6(1) application form; s.7 response timelines", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/2299" },
      { instrument: "RTI Rules, 2012 (Central)", provision: "₹10 application fee; ₹2/page photocopy charges", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/2300" },
    ],
    evidence: [
      "Copy of the application (keep one)",
      "IPO/DD receipt or fee payment proof",
      "Postal/courier receipt or portal submission number",
    ],
    template: `${COMMON_USER}

To,
The Central Public Information Officer (CPIO),
【recipient_name】
【recipient_address】

Subject: Application under the Right to Information Act, 2005 — 【info_subject】

Sir/Madam,

I, 【sender_name】, a citizen of India, request the following information under Section 6(1) of the Right to Information Act, 2005:

【info_details】

The information relates to the period: 【period】.

The application fee of ₹10 is paid by 【payment_mode】.

Kindly provide the information within 30 days as required by Section 7 of the Act. If the information pertains to another authority, please transfer this application under Section 6(3) within 5 days and inform me.

I am not seeking any exemption-covered information and request that the reply be sent to the address above.

Yours faithfully,
【sender_name】`,
  },
  {
    slug: "police-complaint",
    title: "Police complaint",
    category: "criminal",
    description: "File a complaint or follow up when the police do not act.",
    typicalTime: "FIR should be registered on the spot for a cognizable offence",
    jurisdictionNote: "BNSS 2023 governs procedure (replaced CrPC from 1 July 2024); state police portals also accept e-FIRs.",
    intake: [
      { id: "sender_name", label: "Your full name", type: "text", required: true },
      { id: "sender_address", label: "Your address", type: "textarea", required: true },
      { id: "recipient_name", label: "Police station / SHO name", type: "text", required: true },
      { id: "recipient_address", label: "Police station address", type: "textarea", required: true },
      { id: "incident_date", label: "Date and time of the incident", type: "text", required: true },
      { id: "incident_place", label: "Place of the incident", type: "text", required: true },
      { id: "incident_description", label: "What happened (chronological facts)", type: "textarea", required: true },
      { id: "accused_details", label: "Accused details / description (if known)", type: "textarea" },
      { id: "witnesses", label: "Witnesses (names, if any)", type: "text" },
      { id: "earlier_complaint", label: "Did you already complain? (date & outcome)", type: "text" },
    ],
    law: [
      { instrument: "Bharatiya Nagarik Suraksha Sanhita, 2023", provision: "Section 173 — FIR registration for cognizable offences (replaces CrPC s.154)", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/20103" },
      { instrument: "Bharatiya Nagarik Suraksha Sanhita, 2023", provision: "Section 175 — magistrate's order for investigation", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/20103" },
      { instrument: "Lalita Kumari v. Govt. of UP (2014)", provision: "FIR mandatory for cognizable offences; preliminary inquiry limited to suspected serious offences", sourceUrl: "https://main.sci.gov.in/judgments" },
    ],
    evidence: [
      "Photos/videos of the incident scene or injuries",
      "Medical report (MLC) if injured",
      "Screenshots/messages if the offence involved communications",
      "Witness contact details",
      "Any prior complaint acknowledgment",
    ],
    template: `${COMMON_USER}

To,
The Station House Officer,
【recipient_name】
【recipient_address】

Subject: Complaint regarding incident dated 【incident_date】 at 【incident_place】

Sir/Madam,

I wish to lodge the following complaint:

【incident_description】

The incident occurred on 【incident_date】 at 【incident_place】. The accused is: 【accused_details】. Witnesses: 【witnesses】.

The above facts disclose cognizable offences. I request that an FIR be registered under Section 173 of the Bharatiya Nagarik Suraksha Sanhita, 2023 (corresponding to the earlier Section 154 CrPC) and investigated. Per Lalita Kumari v. Government of UP (2014), registration of the FIR is mandatory where the information discloses a cognizable offence.

Earlier complaint on this matter: 【earlier_complaint】.

Please provide me with a free copy of the FIR as required by law. If the FIR is not registered, I will escalate the complaint to the Superintendent of Police, and thereafter approach the Magistrate under Section 175 BNSS, 2023 for an order to investigate.

Yours faithfully,
【sender_name】`,
  },
  {
    slug: "legal-notice",
    title: "Legal notice (general)",
    category: "general",
    description: "A formal demand letter before escalation — breach of contract, recovery, etc.",
    typicalTime: "Notice period usually 15–30 days before filing",
    jurisdictionNote: "General civil law; the notice is a precondition for some suits and a cost-recovery advantage in others.",
    intake: [
      { id: "sender_name", label: "Your full name", type: "text", required: true },
      { id: "sender_address", label: "Your address", type: "textarea", required: true },
      { id: "recipient_name", label: "Noticee's name", type: "text", required: true },
      { id: "recipient_address", label: "Noticee's address", type: "textarea", required: true },
      { id: "notice_subject", label: "Subject of the notice", type: "text", required: true },
      { id: "facts", label: "The facts (what happened, when)", type: "textarea", required: true },
      { id: "legal_basis", label: "Agreement/law breached (if known)", type: "text" },
      { id: "demand", label: "What you demand and by when", type: "textarea", required: true },
      { id: "consequence", label: "Action you will take on non-compliance", type: "textarea", required: true },
    ],
    law: [
      { instrument: "Indian Contract Act, 1872", provision: "Sections 37–74 — breach and compensation", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/2293" },
      { instrument: "Civil Procedure Code, 1908 / BNSS", provision: "Pre-suit notice practice; costs consequences of refusal to settle", sourceUrl: "https://www.indiacode.nic.in/" },
    ],
    evidence: [
      "The agreement/contract relied on",
      "Proof of performance on your side (payments, deliveries)",
      "Correspondence showing the breach and requests",
      "Proof of losses (bills, invoices)",
    ],
    template: `${COMMON_USER}
Subject: Legal notice — 【notice_subject】

${COMMON_SEND_BLOCK}

Dear Sir/Madam,

Under my instructions, I serve you this notice as follows:

1. FACTS: 【facts】
2. BREACH/LIABILITY: The above constitutes a breach of 【legal_basis】.
3. DEMAND: You are hereby called upon to 【demand】.
4. CONSEQUENCE: Failing compliance, 【consequence】, together with interest, costs, and consequences of this notice being placed before the court.

A copy of this notice is retained in my records for future legal proceedings.

Yours faithfully,
【sender_name】`,
  },
  {
    slug: "document-preparation",
    title: "Basic document preparation",
    category: "general",
    description: "Affidavits, authorizations, and simple agreements.",
    typicalTime: "Same day to a week (notary/e-stamp availability varies by state)",
    jurisdictionNote: "Stamp duty and notarization rules are STATE-specific — verify your state's e-stamp/SHCIL portal.",
    intake: [
      { id: "sender_name", label: "Your full name", type: "text", required: true },
      { id: "sender_address", label: "Your address", type: "textarea", required: true },
      { id: "doc_type", label: "Type of document", type: "select", options: ["Affidavit (general declaration)", "Authorization letter", "No-objection certificate (NOC)", "Simple agreement"], required: true },
      { id: "doc_purpose", label: "Purpose of the document", type: "textarea", required: true },
      { id: "declaration_text", label: "The declaration/undertaking to make (in your words)", type: "textarea", required: true },
      { id: "other_party", label: "Other party, if any (name)", type: "text" },
    ],
    law: [
      { instrument: "Indian Stamp Act, 1899 (as adopted by states)", provision: "State schedules fix stamp duty for affidavits and agreements", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/2295" },
      { instrument: "Notaries Act, 1952", provision: "Notarial attestation of affidavits", sourceUrl: "https://www.indiacode.nic.in/handle/123456789/2298" },
    ],
    evidence: [
      "Identity proof (for notarization)",
      "Supporting documents the declaration refers to",
      "e-stamp paper of the correct value for your state",
    ],
    template: `AFFIDAVIT / 【doc_type】

I, 【sender_name】, aged __ years, residing at 【sender_address】, do hereby solemnly affirm and declare as follows:

1. 【declaration_text】

2. The purpose of this declaration is: 【doc_purpose】.

3. I understand that this declaration is made for submission to 【other_party】 and that its contents are true to the best of my knowledge and belief; nothing material has been concealed.

Verified at 【place】 on this 【date_today】 that the contents of this affidavit are true and correct to the best of my knowledge and belief and nothing material has been concealed therefrom.

DEPONENT

(To be sworn before a Notary/Oath Commissioner on non-judicial e-stamp paper of the value prescribed by the applicable state schedule.)`,
  },
];

export function getWorkflow(slug: string): WorkflowDef | undefined {
  return WORKFLOWS.find((w) => w.slug === slug);
}

/**
 * Fill a template from intake answers. Unanswered fields keep their
 * 【placeholder】 so the user sees exactly what is missing — the renderer
 * also lists unfilled fields explicitly.
 */
export function fillTemplate(template: string, answers: Record<string, string>): {
  text: string;
  unfilled: string[];
} {
  const unfilled = new Set<string>();
  const text = template.replace(/【([a-z0-9_]+)】/gi, (_m, fieldId: string) => {
    const v = answers[fieldId];
    if (v && v.trim()) return v.trim();
    unfilled.add(fieldId);
    return `【${fieldId}】`;
  });
  return { text, unfilled: [...unfilled] };
}

export const DRAFT_DISCLAIMER =
  "This draft was generated by Nyaya from the information you provided. It has NOT been reviewed by a lawyer. Verify names, addresses, amounts, and dates before use, and consider consulting an advocate (free legal aid may be available — NALSA helpline 15100).";
