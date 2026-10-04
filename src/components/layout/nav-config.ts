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
  type LucideIcon,
} from "lucide-react";

export type TabKey =
  | "home"
  | "chat"
  | "emergency"
  | "rights"
  | "nearby"
  | "judges"
  | "judgments"
  | "info"
  | "profile";

export interface NavItem {
  key: TabKey;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Primary 5 tabs shown in the bottom bar on mobile. */
  primary?: boolean;
  /** Emergency styling. */
  tone?: "default" | "emergency";
}

export const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "Home", href: "/", icon: Home, primary: true },
  { key: "chat", label: "Chat", href: "/chat", icon: MessageSquareText, primary: true },
  { key: "emergency", label: "SOS", href: "/emergency", icon: Siren, primary: true, tone: "emergency" },
  { key: "rights", label: "Rights", href: "/rights", icon: Scale, primary: true },
  { key: "nearby", label: "Nearby", href: "/nearby", icon: MapPin, primary: true },
  { key: "judges", label: "Judges", href: "/judges", icon: Gavel },
  { key: "judgments", label: "SC Judgments", href: "/judgments", icon: ScrollText },
  { key: "info", label: "Info Hub", href: "/info", icon: BookOpen },
  { key: "profile", label: "Profile", href: "/profile", icon: User },
];

export const PRIMARY_NAV = NAV_ITEMS.filter((n) => n.primary);
export const SECONDARY_NAV = NAV_ITEMS.filter((n) => !n.primary);
