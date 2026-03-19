import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    if (!isServer) {
      config.resolve.conditionNames = ['browser', 'import', 'module', 'require', 'default'];
    }

    return config;
  },
};

export default nextConfig;