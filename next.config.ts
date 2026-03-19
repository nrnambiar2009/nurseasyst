import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'rxing-wasm': require.resolve('rxing-wasm/rxing_wasm.js'),
      };
    }

    return config;
  },
};

export default nextConfig;