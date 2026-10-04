import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { AppShell } from "@/components/layout/app-shell";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { OfflineBanner } from "@/components/pwa/offline-banner";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const devanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nyaya — Know Your Legal Rights in India",
  description:
    "Nyaya helps ordinary Indians understand their legal rights in plain language, handle legal emergencies, find nearby police stations, and access free legal aid. Legal information, not legal advice.",
  keywords: [
    "Nyaya", "Indian law", "legal rights India", "legal aid", "FIR",
    "emergency helpline India", "NALSA", "DLSA", "fundamental rights",
    "consumer rights", "women rights India", "cyber law India",
  ],
  authors: [{ name: "Nyaya" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Nyaya",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
  openGraph: {
    title: "Nyaya — Know Your Legal Rights in India",
    description: "Plain-language legal information, emergency procedures, nearby police, free legal aid. Legal information, not legal advice.",
    siteName: "Nyaya",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nyaya",
    description: "Know your legal rights in India — in plain language.",
  },
};

export const viewport: Viewport = {
  themeColor: "#12224A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body
        className={`${jakarta.variable} ${devanagari.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryProvider>
            <OfflineBanner />
            <AppShell>{children}</AppShell>
            <InstallPrompt />
            <Toaster />
            <SonnerToaster position="top-center" richColors />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
