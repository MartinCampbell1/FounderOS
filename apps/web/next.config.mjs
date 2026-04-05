import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@founderos/ui", "@founderos/api-clients"],
  turbopack: {
    root: path.join(appDir, "../.."),
  },
};

export default nextConfig;
