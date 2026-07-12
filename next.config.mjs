import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    formats: ["image/avif", "image/webp"],
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
