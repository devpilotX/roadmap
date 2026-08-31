import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

/**
 * The Content Security Policy is NOT here. It is set in middleware.ts, because it
 * carries a per request nonce and a static header cannot. Everything below is a
 * fixed value, which is exactly what belongs in the config.
 */
const securityHeaders = [
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  { key: 'Origin-Agent-Cluster', value: '?1' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  {
    key: 'Permissions-Policy',
    value:
      'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  },
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
    : []),
];

/**
 * Whether to skip the lint and type check that `next build` runs.
 *
 * Set only by deploy/release.sh, on the production host, and for a measured
 * reason. That host has 946 MB of RAM and 2 vCPU. Compiling takes about six
 * minutes on it; running ESLint and tsc over the whole project afterwards pushed
 * it into 1.3 GB of swap at 8% CPU, which is thrashing rather than working, and
 * the likely end of it is earlyoom killing the deploy halfway.
 *
 * Nothing is lost by skipping them THERE, because neither check can tell you
 * anything the authoring machine has not already been told:
 *
 *   - `npm run typecheck` and `npm run lint` are separate scripts and both must
 *     exit 0 before a commit is made.
 *   - the same code is built locally, where the memory exists.
 *   - the checks that genuinely can only run on the host — the migrations, the
 *     seed contract, and the health check against a real database — are exactly
 *     the ones deploy/release.sh does run, and it aborts and rolls back on any
 *     of them.
 *
 * Unset, which is the default everywhere else including a developer machine and
 * any CI, both checks run and a type error still fails the build.
 */
const skipHostChecks = process.env.NEXT_SKIP_HOST_CHECKS === '1';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The Docker image ships the standalone server and its own minimal
  // node_modules, rather than the whole dependency tree.
  output: 'standalone',
  // argon2 is a native module. It must not be bundled for the server runtime.
  serverExternalPackages: ['argon2', 'mysql2'],
  eslint: {
    dirs: ['app', 'components', 'lib'],
    ignoreDuringBuilds: skipHostChecks,
  },
  typescript: {
    ignoreBuildErrors: skipHostChecks,
  },
  async rewrites() {
    return [
      // The Express build served the health check at /healthz, and the runbook,
      // the nginx configuration and any monitor already point there. The route
      // itself lives under /api like everything else.
      { source: '/healthz', destination: '/api/healthz' },
    ];
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },
};

export default nextConfig;
