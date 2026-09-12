import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/book/checkout", "/account"] }],
    sitemap: "https://bubbleit.qa/sitemap.xml",
    host: "https://bubbleit.qa",
  };
}
