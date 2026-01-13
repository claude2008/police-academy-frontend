import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: false, 
});

const nextConfig: NextConfig = {
  // 🟢 هذا هو السطر السحري لحل المشكلة في إصدار 16
  turbopack: {}, 
};

export default withPWA(nextConfig);