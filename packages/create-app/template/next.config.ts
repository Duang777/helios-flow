import type { NextConfig } from "next";
import { resolveAllowedDevOrigins } from './src/lib/dev-origins'

const isDevelopment = process.env.NODE_ENV !== 'production'
const allowedDevOrigins = isDevelopment ? resolveAllowedDevOrigins() : []

const nextConfig: NextConfig = {
  distDir: '.helios/next',
  experimental: {
    serverMinification: false,
    turbopackMinify: false,
    // Mirror apps/helios: treat these barrel-heavy packages as having
    // modularized exports so only the named exports actually used are
    // evaluated. Keeps scaffolded apps on the same client-bundle baseline.
    //   - lucide-react: icons used across the default backend components.
    //   - recharts: pairs with the next/dynamic chart split in @helios/ui.
    //   - date-fns: already deep-imported; listed here as defense-in-depth.
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
    ...(isDevelopment
      ? {
          preloadEntriesOnStart: false,
        }
      : {}),
  },
  allowedDevOrigins: allowedDevOrigins.length > 0 ? allowedDevOrigins : undefined,
  // Transpile @helios packages that have TypeScript in src/
  // Note: @helios/shared is excluded as it has pre-built dist/ files
  transpilePackages: [
    '@helios/core',
    '@helios/ui',
    '@helios/events',
    '@helios/cache',
    '@helios/queue',
    '@helios/search',
    '@helios/content',
    '@helios/onboarding',
    '@helios/ai-assistant',
  ],
  serverExternalPackages: [
    'esbuild',
    '@esbuild/darwin-arm64',
    '@helios/cli',
  ],
  // Mirror server-only env vars that client components must observe. Keep this
  // list minimal — anything added here is inlined into the client bundle.
  env: {
    HELIOS_SEARCH_MIN_LEN: process.env.HELIOS_SEARCH_MIN_LEN,
  },
}

export default nextConfig
