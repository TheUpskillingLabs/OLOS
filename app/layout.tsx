import type { Metadata, Viewport } from "next";
import { Geologica } from "next/font/google";
import Script from "next/script";
import "./globals.css";

// Geologica is the only brand font (owner decision: no CDN — next/font
// self-hosts the files at build time, so no runtime request leaves the app).
const geologica = Geologica({
  subsets: ["latin"],
  variable: "--font-geologica",
});

export const metadata: Metadata = {
  title: "The Upskilling Labs",
  description: "Find your people. Build your edge.",
};

export const viewport: Viewport = {
  themeColor: "#00141B",
  // Lets full-height onboarding shells (100dvh) shrink when the mobile
  // keyboard opens, keeping sticky action bars visible.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
  authmodal,
}: Readonly<{
  children: React.ReactNode;
  // The intercepted-/login slot (app/@authmodal): the Google-auth popup
  // over whatever page launched it; renders null everywhere else.
  authmodal: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${geologica.variable}`}>
      <body className="flex min-h-full flex-col">
        {children}
        {authmodal}
        {/* every.org's embed script: intercepts clicks on our donate links
            (lib/donate.ts DONATE_URL) and opens the donation popup in place
            instead of navigating to the hosted checkout. */}
        <Script src="https://embeds.every.org/0.4/button.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
