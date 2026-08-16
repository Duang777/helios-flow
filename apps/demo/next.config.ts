import type { NextConfig } from 'next'
import path from 'node:path'

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'helios-flow'
const isGithubActions = process.env.GITHUB_ACTIONS === 'true'
const configuredBasePath = process.env.NEXT_PUBLIC_DEMO_BASE_PATH?.trim()
const basePath = configuredBasePath ?? (isGithubActions ? `/${repoName}` : '')

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath,
  assetPrefix: basePath || undefined,
  transpilePackages: ['@helios/shared', '@helios/ui'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  turbopack: {
    root: path.resolve(process.cwd(), '../..'),
  },
}

export default nextConfig
