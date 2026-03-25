import type { Metadata } from "next";
import { IBM_Plex_Mono, Sora } from "next/font/google";

import { SiteHeader } from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/session";

import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "600", "700", "800"]
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"]
});

export const metadata: Metadata = {
  title: "cfmasters",
  description: "Track Codeforces activity, daily practice streaks, and friend summaries in one Vercel-ready app."
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body className={`${sora.variable} ${plexMono.variable}`}>
        <div className="page-backdrop" />
        <div className="page-glow page-glow-left" />
        <div className="page-glow page-glow-right" />
        <div className="page-frame">
          <SiteHeader user={user} />
          {children}
        </div>
      </body>
    </html>
  );
}
