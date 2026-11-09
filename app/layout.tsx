import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E11F26" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0F17" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Booran Warranty Review Portal · OmniSuiteAI",
  description: "Workshop-first multi-brand warranty evidence capture, verification, and OEM submission portal.",
  manifest: "/manifest.json",
  applicationName: "Booran Warranty",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Booran Warranty",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="min-h-screen bg-[#f8fafc] text-[#0f172a] antialiased selection:bg-[#E11F26] selection:text-white"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
