import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone', // Required for Railway Docker deployment
};

export default nextConfig;
