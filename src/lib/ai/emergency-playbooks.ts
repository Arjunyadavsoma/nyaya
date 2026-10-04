/**
 * Structured emergency playbooks — lawyer-reviewed, offline-cached.
 * Layer 2 of the emergency response redesign.
 *
 * These do NOT go through the LLM. The AI's only job is to select the
 * right playbook based on intent classification + format it.
 */

export interface PlaybookStep {
  step: string;
  action: string;
  law?: string;
}

export interface PlaybookHelpline {
  number: string;
  purpose: string;
}

export interface PlaybookSource {
  act: string;
  sections: string[];
}

export interface EmergencyPlaybook {
  id: string;
  title: string;
  rightNow: PlaybookStep[];
  within24Hours: PlaybookStep[];
  helplines: PlaybookHelpline[];
  rights: string[];
  sources: PlaybookSource[];
}

export const ROAD_ACCIDENT_PLAYBOOK: EmergencyPlaybook = {
  id: "road-accident",
  title: "Road Accident — Immediate Steps",
  rightNow: [
    {
      step: "Check for injuries",
      action: "Call 108 (ambulance) if anyone is hurt. Do not move an injured person unless there is fire or immediate danger.",
    },
    {
      step: "Call police",
      action: "Call 112 or 100. You must report the accident. Do NOT leave the scene — leaving is a criminal offence under Section 134 of the Motor Vehicles Act 1988.",
      law: "Section 134, Motor Vehicles Act 1988",
    },
    {
      step: "Make the scene safe",
      action: "Turn on hazard lights. Place warning triangle 50m behind the vehicle if you have one. Move to the side of the road if safe.",
    },
    {
      step: "Do NOT admit fault",
      action: "You have the right to remain silent. Do not argue, apologise, or accept blame. Exchange ONLY insurance details and contact information.",
      law: "Article 20(3), Constitution of India — right against self-incrimination",
    },
    {
      step: "Document everything",
      action: "Take photos of: vehicle damage, license plates, road conditions, position of vehicles, injuries, witness contact info. Note the time and location.",
    },
  ],
  within24Hours: [
    {
      step: "Get the FIR copy",
      action: "Ask the police station for a copy of the FIR. You are entitled to it free of cost.",
      law: "Section 173, BNSS 2023",
    },
    {
      step: "Inform your insurer",
      action: "Call your car insurance company. Most policies require you to inform them within 7 days of the accident.",
    },
    {
      step: "Get a medical report if injured",
      action: "Get a Medico-Legal Case (MLC) certificate from the hospital. This is essential for any injury claim.",
    },
    {
      step: "Note the claim timelines",
      action: "You have 6 months to file a motor accident claim before the Motor Accident Claims Tribunal (MACT).",
      law: "Section 166, Motor Vehicles Act 1988",
    },
  ],
  helplines: [
    { number: "112", purpose: "Unified Emergency" },
    { number: "100", purpose: "Police" },
    { number: "108", purpose: "Ambulance" },
    { number: "1073", purpose: "Road Safety" },
    { number: "15100", purpose: "Free Legal Aid (NALSA)" },
  ],
  rights: [
    "Right to remain silent — anything you say to police can be used against you (Article 20(3))",
    "Right to a copy of the FIR (Section 173 BNSS)",
    "Right to inform a family member or friend",
    "Right to free legal aid if you cannot afford a lawyer",
    "Right to medical treatment at any hospital — no hospital can refuse emergency care",
  ],
  sources: [
    { act: "Motor Vehicles Act 1988", sections: ["134", "161", "166"] },
    { act: "Bharatiya Nagarik Suraksha Sanhita 2023", sections: ["173", "183"] },
    { act: "Constitution of India", sections: ["20(3)", "21", "22"] },
  ],
};

export const ARREST_PLAYBOOK: EmergencyPlaybook = {
  id: "arrest",
  title: "Being Arrested — Your Rights",
  rightNow: [
    {
      step: "Stay calm",
      action: "Do not resist or run. Resisting arrest is itself a criminal offence.",
      law: "Section 132, BNS 2023 (assault to deter public servant)",
    },
    {
      step: "Ask for the grounds of arrest",
      action: "Ask: \"What is the charge? Which section?\" The officer must inform you the grounds of arrest.",
      law: "Section 47, BNSS 2023 (formerly Section 50 CrPC)",
    },
    {
      step: "Note the officer's details",
      action: "Ask for the arresting officer's name, rank, badge number, and police station.",
    },
    {
      step: "Inform a family member",
      action: "Insist that a relative or friend be informed of your arrest and place of detention.",
      law: "Section 48, BNSS 2023 (formerly Section 50A CrPC)",
    },
    {
      step: "Do NOT sign anything without reading",
      action: "Do not sign any document you do not understand. Do not confess under pressure. You have the right to remain silent.",
      law: "Article 20(3), Constitution of India — right against self-incrimination",
    },
    {
      step: "Demand a lawyer",
      action: "Ask to meet a lawyer of your choice. If you cannot afford one, ask for free legal aid via NALSA (15100).",
      law: "Article 22(1), Constitution of India",
    },
  ],
  within24Hours: [
    {
      step: "Must be produced before a magistrate within 24 hours",
      action: "The police cannot detain you beyond 24 hours without a magistrate's order. Insist on this right.",
      law: "Article 22(2), Constitution of India; Section 58, BNSS 2023",
    },
    {
      step: "Ask for bail",
      action: "If the offence is bailable, the police must grant bail. For non-bailable offences, apply for bail through a lawyer.",
      law: "Sections 478-482, BNSS 2023 (formerly Sections 436-439 CrPC)",
    },
    {
      step: "Get the arrest memo",
      action: "The arrest memo must contain: time, date, place of arrest, and be signed by a witness. D.K. Basu guidelines.",
    },
    {
      step: "Medical examination",
      action: "Insist on a medical examination at the time of arrest. This protects you against false allegations of torture later.",
      law: "Section 53, BNSS 2023",
    },
  ],
  helplines: [
    { number: "112", purpose: "Unified Emergency" },
    { number: "100", purpose: "Police" },
    { number: "15100", purpose: "Free Legal Aid (NALSA)" },
    { number: "1098", purpose: "Child Helpline (if minor)" },
  ],
  rights: [
    "Right to know the grounds of arrest (Article 22(1))",
    "Right to consult a lawyer of your choice (Article 22(1))",
    "Right to be produced before a magistrate within 24 hours (Article 22(2))",
    "Right to free legal aid if you cannot afford a lawyer (Section 12, Legal Services Authorities Act)",
    "Right to remain silent — do not self-incriminate (Article 20(3))",
    "Right to inform a family member about your arrest and place of detention",
    "Right to medical examination at the time of arrest",
  ],
  sources: [
    { act: "Constitution of India", sections: ["20(3)", "22(1)", "22(2)"] },
    { act: "Bharatiya Nagarik Suraksha Sanhita 2023", sections: ["47", "48", "53", "58", "478-482"] },
    { act: "D.K. Basu v. State of West Bengal (1997) 1 SCC 416", sections: [] },
  ],
};

export const DOMESTIC_VIOLENCE_PLAYBOOK: EmergencyPlaybook = {
  id: "domestic-violence",
  title: "Domestic Violence — Steps and Protection",
  rightNow: [
    {
      step: "If in immediate danger, call 100 or 112",
      action: "Your safety comes first. Leave the house if you must. Go to a trusted relative, friend, or a women's shelter.",
    },
    {
      step: "Record evidence if safe",
      action: "Take photos of injuries, threatening messages, call logs. Get a medical examination (MLC) at a government hospital — it is free and admissible.",
    },
    {
      step: "Call 181 (Women Helpline)",
      action: "The Women Helpline (181) provides immediate support, counselling, and can connect you to a Protection Officer.",
    },
    {
      step: "Do NOT destroy evidence",
      action: "Keep torn clothes, threatening messages, and medical reports. Do not wash clothes if there was physical assault.",
    },
  ],
  within24Hours: [
    {
      step: "File a Domestic Incident Report (DIR)",
      action: "Approach the Protection Officer (PO) of your district to file a DIR under the PWDVA 2005. This gets you protection orders, residence orders, custody, and maintenance.",
      law: "Sections 18-22, Protection of Women from Domestic Violence Act 2005",
    },
    {
      step: "File an FIR",
      action: "File an FIR for cruelty by husband/relatives. Women's Cell or the local police station can register it.",
      law: "Section 85, BNS 2023 (formerly Section 498A IPC)",
    },
    {
      step: "Seek free legal aid",
      action: "DLSA provides free legal aid for all women regardless of income. Call 15100.",
    },
  ],
  helplines: [
    { number: "181", purpose: "Women Helpline (Domestic Violence)" },
    { number: "1091", purpose: "Women Helpline (NCW)" },
    { number: "112", purpose: "Unified Emergency" },
    { number: "100", purpose: "Police" },
    { number: "15100", purpose: "Free Legal Aid (NALSA)" },
  ],
  rights: [
    "Right to protection orders (restrain abuser from contacting you or entering your shared home)",
    "Right to residence orders (cannot be evicted from your shared household)",
    "Right to monetary relief and maintenance",
    "Right to custody of children",
    "Right to free legal aid (DLSA — 15100)",
    "Right to file a criminal case for cruelty (Section 85 BNS / 498A IPC)",
  ],
  sources: [
    { act: "Protection of Women from Domestic Violence Act 2005", sections: ["18", "19", "20", "21", "22"] },
    { act: "Bharatiya Nyaya Sanhita 2023", sections: ["85"] },
    { act: "Dowry Prohibition Act 1961", sections: ["3", "4"] },
  ],
};

export const CYBER_FRAUD_PLAYBOOK: EmergencyPlaybook = {
  id: "cyber-fraud",
  title: "Cyber Fraud / Online Scam — Report Now",
  rightNow: [
    {
      step: "Call 1930 immediately",
      action: "The National Cyber Crime Helpline (1930) can help freeze the fraudster's bank account within the golden hour. Call within minutes of the fraud.",
    },
    {
      step: "Block your card / UPI",
      action: "Call your bank's fraud line immediately. Ask to block your card, freeze your account, and request a hold on the beneficiary account.",
    },
    {
      step: "Preserve all evidence",
      action: "Screenshot every fraudulent message, email, ad, UPI ID, account number, phone number, and transaction reference. Do not delete anything.",
    },
    {
      step: "Do NOT pay any 'recovery fee'",
      action: "Anyone claiming they can recover your money for a fee is a scammer. Do not engage with the fraudster further.",
    },
    {
      step: "Change passwords",
      action: "Change passwords of all compromised accounts. Enable two-factor authentication. Do not click any links the fraudster sends 'to refund you'.",
    },
  ],
  within24Hours: [
    {
      step: "Report on cybercrime.gov.in",
      action: "File a complaint on the National Cyber Crime Reporting Portal. Select 'Report Cyber Crime Against Women/Child' or 'Report Other Cyber Crime'.",
    },
    {
      step: "File an FIR",
      action: "File an FIR at your local Cyber Crime Cell / police station. Cite BNS Section 318(4) (cheating) and IT Act sections.",
      law: "BNS 2023 Sections 111, 318, 319, 336; IT Act 2000 Sections 66C, 66D",
    },
    {
      step: "Inform your bank in writing",
      action: "Send a written complaint to your bank's grievance redressal officer. Cite the RBI limited-liability circular for unauthorised transactions.",
      law: "RBI Limited Liability Guidelines (Circular DPSS.CO.PD.No.1411/02.14.006/2017-18)",
    },
  ],
  helplines: [
    { number: "1930", purpose: "Cyber Crime Helpline" },
    { number: "112", purpose: "Unified Emergency" },
    { number: "100", purpose: "Police" },
    { number: "15100", purpose: "Free Legal Aid (NALSA)" },
  ],
  rights: [
    "Right to limited liability for unauthorised electronic transactions (RBI guidelines)",
    "Right to file a complaint with the Banking Ombudsman if the bank doesn't resolve within 30 days",
    "Right to zero liability if you report within 3 working days of fraud notification",
    "Right to a copy of the FIR / cybercrime complaint reference number",
  ],
  sources: [
    { act: "Bharatiya Nyaya Sanhita 2023", sections: ["111", "318", "319", "336"] },
    { act: "Information Technology Act 2000", sections: ["43", "66", "66C", "66D"] },
    { act: "RBI Limited Liability Guidelines", sections: [] },
  ],
};

export const MEDICAL_PLAYBOOK: EmergencyPlaybook = {
  id: "medical",
  title: "Medical Emergency — What to Do",
  rightNow: [
    {
      step: "Call 108 (Ambulance)",
      action: "Call 108 or 102 for an ambulance. If no ambulance is available, use any vehicle — hospitals cannot refuse emergency patients.",
      law: "Pt. Parmanand Katara v. Union of India (1989) — SC held no hospital can refuse emergency patients",
    },
    {
      step: "Keep the patient's airway clear",
      action: "If trained, do CPR. Stop bleeding with pressure. Do not give food or water to an unconscious person.",
    },
    {
      step: "Carry ID and medication list",
      action: "Bring the patient's Aadhaar / ID, medication list, and any known allergies. If diabetic, suspect low sugar.",
    },
    {
      step: "Demand first aid before paperwork",
      action: "At the hospital, demand stabilisation first. No hospital can refuse emergency care or demand payment before treatment.",
      law: "Clinical Establishments Act 2010; SC guidelines (Pt. Parmanand Katara case)",
    },
  ],
  within24Hours: [
    {
      step: "Get a Medico-Legal Case (MLC) register entry",
      action: "If the emergency is from an accident, assault, poisoning, burn, or suspicious cause, demand an MLC entry — this protects the patient legally.",
    },
    {
      step: "Get the discharge summary",
      action: "Before leaving the hospital, insist on a discharge summary and all investigation reports. Keep all bills and receipts.",
    },
    {
      step: "File a complaint for negligence (if applicable)",
      action: "If the hospital was negligent, file a complaint with the State Medical Council or Consumer Disputes Redressal Commission.",
      law: "Consumer Protection Act 2019 (medical negligence as deficiency of service)",
    },
  ],
  helplines: [
    { number: "108", purpose: "Ambulance" },
    { number: "102", purpose: "Ambulance (Alternate)" },
    { number: "112", purpose: "Unified Emergency" },
    { number: "14416", purpose: "Mental Health (Kiran)" },
    { number: "15100", purpose: "Free Legal Aid (NALSA)" },
  ],
  rights: [
    "Right to emergency medical care — no hospital can refuse (Article 21, Constitution of India)",
    "Right to get an MLC registered for accidents/assaults (free at government hospitals)",
    "Right to a discharge summary and all investigation reports before leaving",
    "Right to complain about medical negligence to the State Medical Council",
    "Right to emergency care without advance payment (SC guidelines)",
  ],
  sources: [
    { act: "Constitution of India", sections: ["21"] },
    { act: "Clinical Establishments (Registration and Regulation) Act 2010", sections: [] },
    { act: "Consumer Protection Act 2019", sections: [] },
    { act: "Pt. Parmanand Katara v. Union of India (1989)", sections: [] },
  ],
};

export const FIRE_PLAYBOOK: EmergencyPlaybook = {
  id: "fire",
  title: "Fire Emergency — Evacuate and Call 101",
  rightNow: [
    {
      step: "Call 101 (Fire Brigade)",
      action: "State the address clearly, nearest landmark, and whether people are trapped. Call 101 immediately — do not try to fight a large fire yourself.",
    },
    {
      step: "Evacuate immediately",
      action: "Get everyone out. Crawl low under smoke. Cover nose and mouth with a wet cloth. Use stairs, never the lift.",
    },
    {
      step: "Feel doors before opening",
      action: "Feel doors with the back of your hand. If hot, do not open — find another exit. Close doors behind you to slow the fire.",
    },
    {
      step: "Do NOT re-enter for belongings",
      action: "Once out, stay out. Do not go back inside for any reason. Assemble at a safe point and account for everyone.",
    },
    {
      step: "Cut electricity and gas",
      action: "If safe to do so, switch off the main electricity and gas supply before evacuating.",
    },
  ],
  within24Hours: [
    {
      step: "Get the fire brigade report",
      action: "The fire brigade's report is essential for insurance claims and any legal action. Ask for a copy.",
    },
    {
      step: "Inform your insurance company",
      action: "Notify your fire/property insurance company at the earliest. Keep photos and the fire brigade report ready.",
    },
    {
      step: "File an FIR if arson is suspected",
      action: "If you suspect the fire was deliberately set, file an FIR at the local police station.",
      law: "Section 326, BNS 2023 (arson — formerly Section 435 IPC)",
    },
  ],
  helplines: [
    { number: "101", purpose: "Fire Brigade" },
    { number: "112", purpose: "Unified Emergency" },
    { number: "100", purpose: "Police" },
  ],
  rights: [
    "Right to fire emergency services (101) — free of charge",
    "Right to a fire brigade report for insurance and legal purposes",
    "Right to file an FIR if arson is suspected (Section 326 BNS)",
    "Right to insurance claim as per your policy terms",
  ],
  sources: [
    { act: "Bharatiya Nyaya Sanhita 2023", sections: ["326"] },
    { act: "National Building Code of India 2016", sections: [] },
    { act: "State Fire Services Act", sections: [] },
  ],
};

export const CHILD_ABUSE_PLAYBOOK: EmergencyPlaybook = {
  id: "child-abuse",
  title: "Child in Danger — Protect and Report",
  rightNow: [
    {
      step: "If the child is in immediate danger, call 100 or 1098",
      action: "Call 1098 (CHILDLINE) or 100 (police) immediately. If the child is being abused, move them to safety if possible.",
    },
    {
      step: "Believe the child",
      action: "Listen without leading questions. Reassure them it is not their fault. Do not confront the abuser — this can endanger the child.",
    },
    {
      step: "Do NOT bathe the child or change clothes",
      action: "Physical evidence may be needed. Do not bathe the child, change their clothes, or wash anything.",
    },
    {
      step: "Take the child to a government hospital",
      action: "Get a medical examination (MLC) at a government hospital — free and admissible. Ask for a child-friendly examination.",
    },
  ],
  within24Hours: [
    {
      step: "Mandatory reporting under POCSO",
      action: "Everyone who knows of sexual abuse of a child MUST report it. File an FIR under the POCSO Act 2012.",
      law: "Section 19, POCSO Act 2012 (mandatory reporting)",
    },
    {
      step: "Contact the Child Welfare Committee (CWC)",
      action: "The CWC can arrange shelter, counselling, and care. Contact your district CWC or DCPU.",
      law: "Juvenile Justice (Care and Protection of Children) Act 2015",
    },
    {
      step: "Seek free legal aid",
      action: "Free legal aid is available for children. Call DLSA (15100) or CHILDLINE (1098).",
    },
    {
      step: "Report online abuse on cybercrime.gov.in",
      action: "If the abuse was online (cyberbullying, online exploitation), also report on the National Cyber Crime Reporting Portal.",
    },
  ],
  helplines: [
    { number: "1098", purpose: "CHILDLINE" },
    { number: "112", purpose: "Unified Emergency" },
    { number: "100", purpose: "Police" },
    { number: "15100", purpose: "Free Legal Aid (NALSA)" },
  ],
  rights: [
    "Right to protection from all forms of abuse (POCSO Act 2012)",
    "Right to a child-friendly medical examination and court proceedings",
    "Right to free legal aid (DLSA — 15100)",
    "Right to confidentiality — the child's identity cannot be disclosed",
    "Right to compensation under the Victim Compensation Scheme",
    "Mandatory reporting — every adult MUST report child sexual abuse (Section 19 POCSO)",
  ],
  sources: [
    { act: "Protection of Children from Sexual Offences (POCSO) Act 2012", sections: ["19", "21"] },
    { act: "Juvenile Justice Act 2015", sections: [] },
    { act: "Bharatiya Nyaya Sanhita 2023", sections: [] },
  ],
};

export const SEXUAL_HARASSMENT_PLAYBOOK: EmergencyPlaybook = {
  id: "sexual-harassment",
  title: "Sexual Harassment / Assault — Steps and Rights",
  rightNow: [
    {
      step: "If in immediate danger, call 100 or 112",
      action: "Your safety comes first. Get to a safe place. Call 1091 (Women Helpline) or 112.",
    },
    {
      step: "Preserve evidence",
      action: "Do not bathe, wash clothes, or clean up. Preserve all evidence — messages, clothes, photos. This is critical for the police case.",
    },
    {
      step: "Get a medical examination",
      action: "Go to a government hospital immediately for a medical examination (MLC). This is free and essential for evidence. Do not delay.",
    },
    {
      step: "File an FIR",
      action: "File an FIR at the police station. Women's cells or special units handle these cases sensitively. You can file a Zero FIR at any station.",
      law: "Section 173, BNSS 2023 (Zero FIR — can be filed at any station regardless of jurisdiction)",
    },
  ],
  within24Hours: [
    {
      step: "Seek free legal aid",
      action: "Free legal aid is available for all women. Call DLSA (15100) or NALSA. A lawyer will be assigned free of cost.",
    },
    {
      step: "Contact a support organisation",
      action: "Organisations like NIMHANS, iCall, or local women's NGOs provide counselling and support. You are not alone.",
    },
    {
      step: "For workplace harassment — file an ICC complaint",
      action: "If the harassment was at work, file a complaint with the Internal Complaints Committee (ICC) within 3 months.",
      law: "Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act 2013 (POSH Act)",
    },
  ],
  helplines: [
    { number: "1091", purpose: "Women Helpline (NCW)" },
    { number: "181", purpose: "Women Helpline (Domestic Violence)" },
    { number: "112", purpose: "Unified Emergency" },
    { number: "100", purpose: "Police" },
    { number: "15100", purpose: "Free Legal Aid (NALSA)" },
  ],
  rights: [
    "Right to file a Zero FIR at any police station regardless of jurisdiction (Section 173 BNSS)",
    "Right to free legal aid (Section 12, Legal Services Authorities Act)",
    "Right to a female police officer for recording the statement",
    "Right to confidentiality — your identity cannot be disclosed",
    "Right to a woman doctor for the medical examination",
    "Right to file a complaint with the Internal Complaints Committee (ICC) at work (POSH Act)",
    "Right to compensation under the Victim Compensation Scheme",
  ],
  sources: [
    { act: "Bharatiya Nyaya Sanhita 2023", sections: ["64", "74", "75"] },
    { act: "Sexual Harassment of Women at Workplace Act 2013 (POSH)", sections: ["9", "10", "13"] },
    { act: "Bharatiya Nagarik Suraksha Sanhita 2023", sections: ["173"] },
  ],
};

// Registry — maps EmergencyType to playbook
export const PLAYBOOKS: Record<string, EmergencyPlaybook> = {
  "road-accident": ROAD_ACCIDENT_PLAYBOOK,
  "arrest": ARREST_PLAYBOOK,
  "domestic-violence": DOMESTIC_VIOLENCE_PLAYBOOK,
  "cyber-fraud": CYBER_FRAUD_PLAYBOOK,
  "medical": MEDICAL_PLAYBOOK,
  "fire": FIRE_PLAYBOOK,
  "child-abuse": CHILD_ABUSE_PLAYBOOK,
  "sexual-harassment": SEXUAL_HARASSMENT_PLAYBOOK,
};

export function getPlaybook(type: string | null): EmergencyPlaybook | null {
  if (!type) return null;
  return PLAYBOOKS[type] ?? null;
}
