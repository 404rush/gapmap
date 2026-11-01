import type { Metadata, Viewport } from "next";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/newsreader/index.css";
import "./globals.css";

// ﹏𓊝﹏
const site = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "GapMap: find out what your sources don't tell you",
  description:
    "GapMap reads several sources on a question and maps what is covered, contested, outdated or missing, with every finding traceable to its source and a checklist of what to verify next.",
  authors: [{ name: "rush" }],
  creator: "Arush Giri",
  openGraph: {
    title: "GapMap: find out what your sources don't tell you",
    description: "Gaps, conflicts, outdated details and unanswered questions across your sources, with every finding linked to the exact sentence it came from.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#172230", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
