import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack config for Next.js 16+
  turbopack: {},
  
  webpack: (config) => {
    // See: https://huggingface.co/docs/transformers.js/tutorials/next
    config.resolve.alias = {
      ...config.resolve.alias,
      'sharp$': false,
      'onnxruntime-node$': false,
    };
    return config;
  },
};

export default nextConfig;
