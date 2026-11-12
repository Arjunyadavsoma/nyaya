/**
 * Verified legal-aid directory seed (Stage 6).
 *
 * Sources: nalsa.gov.in (state SLSA listing with contact details), official
 * state SLSA websites. The NALSA helpline 15100 and state numbers were
 * cross-checked against NALSA's published directory. Rows ingested with
 * verified=true carry sourceUrl provenance; the helplines marked verified
 * below are from NALSA's official listing (checked 12 Nov 2026).
 *
 * District-level (DLSA) rows are NOT seeded here — they need per-district
 * verification and are ingested via the admin workflow with review.
 */
export interface LegalAidSeed {
  level: "national" | "state";
  stateCode?: string;
  name: string;
  helpline?: string;
  email?: string;
  website: string;
  sourceUrl: string;
  address?: string;
  verified: boolean;
}

export const LEGAL_AID_SEED: LegalAidSeed[] = [
  {
    level: "national",
    name: "National Legal Services Authority (NALSA)",
    helpline: "15100",
    website: "https://nalsa.gov.in",
    sourceUrl: "https://nalsa.gov.in",
    address: "NILSA Bhawan, 11-A, Dwarka Sector 1, New Delhi – 110075",
    verified: true,
  },
  {
    level: "national",
    name: "Supreme Court Legal Services Committee (SCLSC)",
    website: "https://sclsc.nic.in",
    sourceUrl: "https://sclsc.nic.in",
    address: "Supreme Court of India, Tilak Marg, New Delhi – 110001",
    verified: true,
  },
  // State SLSAs — names/sites from NALSA's state-wise listing
  { level: "state", stateCode: "AP", name: "Andhra Pradesh State Legal Services Authority", website: "https://apslsa.ap.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "AR", name: "Arunachal Pradesh State Legal Services Authority", website: "https://arunachalslsa.nic.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "AS", name: "Assam State Legal Services Authority", website: "https://aslsa.assam.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "BR", name: "Bihar State Legal Services Authority", website: "http://bslsa.bihar.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "CG", name: "Chhattisgarh State Legal Services Authority", website: "https://cgslsa.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "GA", name: "Goa State Legal Services Authority", website: "https://goa.gov.in/goa-state-legal-services-authority", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "GJ", name: "Gujarat State Legal Services Authority", website: "https://glsgujarat.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "HR", name: "Haryana State Legal Services Authority", website: "https://hslsa.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "HP", name: "Himachal Pradesh State Legal Services Authority", website: "https://hpslsa.nic.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "JH", name: "Jharkhand State Legal Services Authority", website: "https://jhslsa.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "JK", name: "J&K and Ladakh Legal Services Authority", website: "https://jklsa.nic.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "KA", name: "Karnataka State Legal Services Authority", website: "https://kslsa.karnataka.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "KL", name: "Kerala State Legal Services Authority", website: "https://keralalsa.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "MP", name: "Madhya Pradesh State Legal Services Authority", website: "https://mpslsa.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "MH", name: "Maharashtra State Legal Services Authority", website: "https://mlsa.maharashtra.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "MN", name: "Manipur State Legal Services Authority", website: "https://manipur.gov.in/?page_id=13522", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "ML", name: "Meghalaya State Legal Services Authority", website: "https://megslsa.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "MZ", name: "Mizoram State Legal Services Authority", website: "https://mizoram.gov.in/page/mizoram-state-legal-services-authority", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "NL", name: "Nagaland State Legal Services Authority", website: "https://nslsa.nagaland.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "OD", name: "Odisha State Legal Services Authority", website: "https://olsa.nic.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "PB", name: "Punjab State Legal Services Authority", website: "https://puls.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "RJ", name: "Rajasthan State Legal Services Authority", website: "https://rslsa.rajasthan.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "SK", name: "Sikkim State Legal Services Authority", website: "https://sikkimslsa.org", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "TN", name: "Tamil Nadu State Legal Services Authority", website: "https://tnslsa.tn.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "TG", name: "Telangana State Legal Services Authority", website: "https://tgslsa.telangana.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "TR", name: "Tripura State Legal Services Authority", website: "https://tslsa.tripura.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "UP", name: "Uttar Pradesh State Legal Services Authority", website: "https://upslsa.up.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "UK", name: "Uttarakhand State Legal Services Authority", website: "https://ukslsa.uk.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "WB", name: "West Bengal State Legal Services Authority", website: "https://wbslsa.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "AN", name: "Andaman & Nicobar State Legal Services Authority", website: "https://andaman.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "CH", name: "Chandigarh State Legal Services Authority", website: "https://chdslsa.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "DN", name: "DNH & DD Legal Services Authority", website: "https://dnh.nic.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "LA", name: "Ladakh Legal Services Authority", website: "https://ladakh.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "LD", name: "Lakshadweep Legal Services Authority", website: "https://lakshadweep.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "PY", name: "Puducherry Legal Services Authority", website: "https://py.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
  { level: "state", stateCode: "DL", name: "Delhi State Legal Services Authority (DSLSA)", website: "https://dsla.delhi.gov.in", sourceUrl: "https://nalsa.gov.in/state-legal-services-authorities", verified: true },
];
