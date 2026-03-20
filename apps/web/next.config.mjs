/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Required for Railway Docker deployment
  transpilePackages: ['@tactictoe/game-engine', '@tactictoe/glicko2'],
  webpack: (config) => {
    // The game-engine uses TypeScript ESM convention (.js extensions in imports).
    // Tell webpack to also try .ts when it sees .js.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.js'],
    };
    return config;
  },
};

export default nextConfig;
