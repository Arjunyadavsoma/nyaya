import {
  Home,
  MessageSquareText,
  Siren,
  Scale,
  MapPin,
  Gavel,
  BookOpen,
  Info,
  User,
  ScrollText,
  Search,
  FileText,
  PenLine,
  FolderOpen,
  Landmark,
  PhoneCall,
  type LucideIcon,
} from "lucide-react";

export type TabKey =
  | "home"
  | "dashboard"
  | "chat"
  | "research"
  | "documents"
  | "drafting"
  | "workflows"
  | "rights"
  | "laws"
  | "emergency"
  | "nearby"
  | "judges"
  | "judgments"
  | "info"
  | "legal-aid"
  | "my-nyaya"
  | "profile";

export interface NavItem {
  key: TabKey;
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  /** Primary 5 tabs shown in the bottom bar on mobile. */
  primary?: boolean;
  /** Emergency styling. */
  tone?: "default" | "emergency";
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/**
 * Navigation information architecture (Stage 2).
 *
 * Sections mirror how a citizen actually thinks: get an answer → take
 * action → learn the law → keep track of it. The AI workspace section
 * routes to the Stage 3–5 modules; each page exists as a real route.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      { key: "home", label: "Home", href: "/", icon: Home, primary: true },
      { key: "dashboard", label: "Dashboard", href: "/dashboard-home", icon: Landmark, description: "Your legal overview" },
    ],
  },
  {
    label: "AI Legal Workspace",
    items: [
      { key: "chat", label: "AI Assistant", href: "/chat", icon: MessageSquareText, primary: true, description: "Cited legal answers" },
      { key: "research", label: "Research", href: "/research", icon: Search, description: "Live source-backed research" },
      { key: "documents", label: "Documents", href: "/documents", icon: FileText, description: "Upload & analyse" },
      { key: "drafting", label: "Drafting", href: "/drafting", icon: PenLine, description: "Notices, complaints, RTI" },
    ],
  },
  {
    label: "Take Action",
    items: [
      { key: "workflows", label: "Workflows", href: "/workflows", icon: Scale, primary: true, description: "Step-by-step solutions" },
      { key: "emergency", label: "Emergency SOS", href: "/emergency", icon: Siren, primary: true, tone: "emergency" },
      { key: "nearby", label: "Nearby Help", href: "/nearby", icon: MapPin, primary: true },
    ],
  },
  {
    label: "Learn the Law",
    items: [
      { key: "rights", label: "Rights Library", href: "/rights", icon: BookOpen },
      { key: "laws", label: "Laws & Acts", href: "/laws", icon: ScrollText, description: "Knowledge base" },
      { key: "judges", label: "Judges", href: "/judges", icon: Gavel },
      { key: "judgments", label: "SC Judgments", href: "/judgments", icon: ScrollText },
      { key: "info", label: "Info Hub", href: "/info", icon: Info },
    ],
  },
  {
    label: "Support",
    items: [
      { key: "legal-aid", label: "Legal Aid & Lawyers", href: "/legal-aid", icon: PhoneCall, description: "Free help near you" },
    ],
  },
  {
    label: "Personal",
    items: [
      { key: "my-nyaya", label: "My Nyaya", href: "/my-nyaya", icon: FolderOpen, description: "Matters & reminders" },
      { key: "profile", label: "Profile & Settings", href: "/profile", icon: User },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export const PRIMARY_NAV = NAV_ITEMS.filter((n) => n.primary);
export const SECONDARY_NAV = NAV_ITEMS.filter((n) => !n.primary);
