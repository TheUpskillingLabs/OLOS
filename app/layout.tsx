import type { Metadata, Viewport } from "next";
import { Geologica } from "next/font/google";
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
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${geologica.variable}`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
