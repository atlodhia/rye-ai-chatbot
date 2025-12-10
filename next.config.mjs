/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.amazon.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.ssl-images-amazon.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'm.media-amazon.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.cdn.shopify.com',
        pathname: '/**',
      },
    ],
  },

  allowedDevOrigins: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://*.ngrok-free.dev',
    'https://*.ngrok.io',
  ],
};

export default nextConfig;