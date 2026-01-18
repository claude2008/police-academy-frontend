import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

// 1. إعدادات التعتيم (نسخة مستقرة وخفيفة للسيرفر)
const obfuscatorConfig = {
    compact: true,
    controlFlowFlattening: false, // 🔒 ضروري جداً لعدم نفاذ الذاكرة
    deadCodeInjection: false,
    debugProtection: false,
    indentationSymbol: '',
    numbersToExpressions: false,
    simplify: true,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    splitStrings: false
};

const obfuscatorOptions = {
    enabled: 'production',
    obfuscateFiles: {
        main: false,      // تعطيل الملفات الكبيرة
        framework: false, // عدم لمس مكتبات React/Next الأساسية
        pages: true,      // حماية صفحاتك وكودك الخاص فقط
    },
};

const withNextJsObfuscator = require('nextjs-obfuscator')(obfuscatorConfig, obfuscatorOptions);

// 2. إعدادات الـ PWA
const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

// 3. إعدادات Next.js العامة
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // ⚠️ تم حذف Turbopack لضمان التوافق مع التعتيم
};

// 4. دمج كل شيء وترتيبه (PWA أولاً ثم التعتيم)
export default withNextJsObfuscator(withPWA(nextConfig));