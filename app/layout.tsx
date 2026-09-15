import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Booran Warranty Review Portal · OmniSuiteAI",
  description: "Workshop-first multi-brand warranty evidence capture, verification, and OEM submission portal.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body
        className="min-h-screen bg-[#f8fafc] text-[#0f172a] antialiased selection:bg-[#E11F26] selection:text-white"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
