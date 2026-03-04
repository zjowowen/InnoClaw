import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "pdf-parse", "@larksuiteoapi/node-sdk"],
};

export default withNextIntl(nextConfig);
