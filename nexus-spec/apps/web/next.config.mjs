/** @type {import('next').NextConfig} */
const nextConfig = {
  // data/ lives at the monorepo root, two levels up from apps/web
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
};

export default nextConfig;
