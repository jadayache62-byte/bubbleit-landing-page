import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/book/checkout"] }],
    sitemap: "https://bubbleit.qa/sitemap.xml",
    host: "https://bubbleit.qa",
  };
}
