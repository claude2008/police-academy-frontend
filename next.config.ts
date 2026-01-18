import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
// 1. استيراد مكتبة التعتيم
const withNextJsObfuscator = require('nextjs-obfuscator')({
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    numbersToExpressions: true,
    simplify: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    splitStrings: true,
}, {
    enabled: 'production', // لن يعمل أثناء البرمجة (npm run dev) بل عند الرفع النهائي فقط
    obfuscateFiles: {
        main: true,
        framework: true,
        pages: true,
    },
});

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: false, 
});

const nextConfig: NextConfig = {
  turbopack: {}, 
};

// 2. دمج التعتيم مع الـ PWA
export default withNextJsObfuscator(withPWA(nextConfig));