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
