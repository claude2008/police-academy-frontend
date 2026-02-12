import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

// 1. تعريف ترويسات الأمان (معدل ليدعم Supabase و Render وكافة المصادر الخارجية)
const securityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin',
  },
  {
    key: 'Content-Security-Policy',
    // 💡 تم تحديث img-src و connect-src للسماح بكل المصادر الخارجية المستخدمة في كودك
    value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://*.supabase.co https://*.onrender.com https://www.qatarradio.qa https://grainy-gradients.vercel.app; connect-src 'self' https://*.onrender.com https://*.supabase.co;"
  }
];

// 2. إعدادات التعتيم (Obfuscator)
const obfuscatorConfig = {
    compact: true,
    controlFlowFlattening: false,
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
        main: false,
        framework: false,
        pages: true,
    },
};

const withNextJsObfuscator = require('nextjs-obfuscator')(obfuscatorConfig, obfuscatorOptions);

// 3. إعدادات الـ PWA
const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

// 4. إعدادات Next.js العامة مع إضافة Headers
const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

// 5. دمج كل شيء
export default withNextJsObfuscator(withPWA(nextConfig));