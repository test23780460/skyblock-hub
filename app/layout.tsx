import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { SiteShell } from "@/components/SiteShell";
import { siteConfig } from "@/lib/config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const directHost = requestHeaders.get("host")?.trim();
  const candidateHost = forwardedHost || directHost;
  const safeHost = candidateHost && /^(?:localhost|[a-z0-9.-]+)(?::\d{1,5})?$/i.test(candidateHost)
    ? candidateHost
    : null;
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? forwardedProtocol
    : safeHost?.startsWith("localhost") ? "http" : "https";
  const origin = safeHost ? `${protocol}://${safeHost}` : siteConfig.url;
  const socialImage = new URL("/og.png", origin).toString();

  return {
    metadataBase: new URL(origin),
    title: {
      default: siteConfig.name + " — Know Your Next SkyBlock Move",
      template: "%s · " + siteConfig.name,
    },
    description: siteConfig.description,
    applicationName: siteConfig.name,
    keywords: ["Hypixel SkyBlock", "SkyBlock profile", "SkyBlock progression", "Bazaar", "Magical Power"],
    alternates: { canonical: origin },
    openGraph: {
      type: "website",
      url: origin,
      siteName: siteConfig.name,
      title: siteConfig.name + " — Know Your Next SkyBlock Move",
      description: siteConfig.description,
      images: [{ url: socialImage, width: 1731, height: 909, alt: "SkyPilot — Know Your Next SkyBlock Move" }],
    },
    twitter: {
      card: "summary_large_image",
      title: siteConfig.name,
      description: siteConfig.description,
      images: [socialImage],
    },
    robots: { index: true, follow: true },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
