import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

// Only the public pages are worth crawling; everything else needs a sign-in.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/media/", "/dashboard", "/compose", "/posts", "/accounts", "/projects", "/settings"],
    },
    sitemap: `${env.appUrl()}/sitemap.xml`,
  };
}
