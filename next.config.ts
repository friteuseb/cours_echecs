import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Modules natifs côté serveur : à ne pas bundler
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
};

export default nextConfig;
