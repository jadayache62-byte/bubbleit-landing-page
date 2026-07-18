import type { MetadataRoute } from "next";

const ROUTES = [
  "",
  "/book",
  "/store",
  "/memberships",
  "/account",
  "/privacy",
  "/terms",
  "/account-deletion",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((path) => ({
    url: `https://bubbleit.qa${path}`,
    changeFrequency: path === "/privacy" || path === "/terms" ? "yearly" : "weekly",
    priority: path === "" ? 1 : path.startsWith("/account") ? 0.5 : 0.8,
  }));
}
