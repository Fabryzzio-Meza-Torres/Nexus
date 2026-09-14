/** @type {import('next').NextConfig} */
const nextConfig = {
  // Points to the git repo root (Nexus/), not just the pnpm workspace root
  // (nexus-spec/): Vercel's serverless bundler lays out lambda files relative
  // to the actual repo clone root, three levels up from apps/web.
  outputFileTracingRoot: new URL("../../../", import.meta.url).pathname,
};

export default nextConfig;
