import type { MetadataRoute } from 'next';

/**
 * A personal tracker has no business in a search index.
 *
 * The Express build served this string from a route. Next generates /robots.txt
 * from here, so there is one place that decides it.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  };
}
