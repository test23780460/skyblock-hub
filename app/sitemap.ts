import type { MetadataRoute } from "next";
import {
  getVisibleNavigationGroups,
  getVisiblePrimaryNavigation,
} from "@/lib/navigation";
import { siteConfig } from "@/lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const visibleNavigation = [
    ...getVisiblePrimaryNavigation(),
    ...getVisibleNavigationGroups().flatMap((group) => group.items),
  ];
  const publicPaths = ["/", "/about", "/privacy", "/terms", "/status", "/more", ...visibleNavigation.map((item) => item.href)].filter((path) => !["/account", "/admin", "/goals", "/ai", "/dashboard"].includes(path));
  return [...new Set(publicPaths)].map((path) => ({ url: new URL(path, siteConfig.url).toString(), lastModified: new Date(), changeFrequency: path === "/" ? "daily" : "weekly", priority: path === "/" ? 1 : .7 }));
}
