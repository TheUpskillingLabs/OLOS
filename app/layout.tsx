import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Upskilling Labs",
  description: "Participant coordination system for Build Cycles",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Geologica:wght@300;400;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#0b1016" />
      </head>
      <body className="flex min-h-full flex-col text-cloud">{children}</body>
    </html>
  );
}
