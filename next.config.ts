import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

// 1. تعريف إعدادات التعتيم بشكل منفصل
const obfuscatorConfig = {
    compact: true,
    controlFlowFlattening: false, // ⚠️ عطلنا هذه لأنها تسبب انهيار البناء في Vercel غالباً
    deadCodeInjection: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    splitStrings: true,
};

const obfuscatorOptions = {
    enabled: 'production',
    obfuscateFiles: {
        main: true,
        framework: true,
        pages: true,
    },
};

const withNextJsObfuscator = require('nextjs-obfuscator')(obfuscatorConfig, obfuscatorOptions);

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development", // تعطيله في التطوير للسرعة
});

const nextConfig: NextConfig = {
  // ⚠️ نصيحة: عطل Turbopack إذا استمر الخطأ لأن المعتّم لا يدعمه بشكل جيد
  // turbopack: {}, 
  
  // إعدادات إضافية لتحسين التوافق
  reactStrictMode: true,
};

// 2. الترتيب الصحيح للدمج (PWA أولاً ثم التعتيم)
export default withNextJsObfuscator(withPWA(nextConfig));