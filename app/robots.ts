import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/account", "/admin", "/goals", "/ai", "/dashboard", "/api/"] }, sitemap: new URL("/sitemap.xml", siteConfig.url).toString() };
}
