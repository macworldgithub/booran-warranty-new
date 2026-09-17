import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://127.0.0.1:4000/api/v1/:path*',
      },
      {
        source: '/uploads/:path*',
        destination: 'http://127.0.0.1:4000/uploads/:path*',
      },
    ];
  },
};

export default nextConfig;
