import { Metadata } from "next";
import ClientLayout from "./ClientLayout";

// 🟢 إعدادات الـ PWA الرسمية لمعهد الشرطة
export const metadata: Metadata = {
  title: "معهد الشرطة - المنظومة الذكية",
  description: "المنظومة الذكية للبيانات والاختبارات - معهد الشرطة",
  manifest: "/manifest.json", 
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "معهد الشرطة",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      {/* 🟢 حافظنا على نفس التنسيقات (Classes) الخاصة بك تماماً */}
      <body className="h-screen w-full overflow-hidden bg-background font-sans antialiased">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}