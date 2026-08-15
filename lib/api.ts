/**
 * 🔐 Fetch Interceptor - يعترض جميع طلبات fetch ويضيف التوكن تلقائياً
 * يوضع هذا الكود في ملف: frontend/lib/api.ts
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://192.168.1.22:8000";

export function setupFetchInterceptor() {
  // منع تكرار التفعيل
  if (typeof window === "undefined" || (window as any)._fetchInterceptorSetup) return;
  (window as any)._fetchInterceptorSetup = true;

  const originalFetch = window.fetch;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    
    // تحديد هل الطلب للسيرفر الخاص بنا؟
    const isApiRequest = url.includes(API_URL) || url.startsWith("/");
    const isLoginRequest = url.includes("/login");

    let updatedInit = { ...init };

    if (isApiRequest && !isLoginRequest) {
      const token = localStorage.getItem("token");
      
      if (token) {
        const headers = new Headers(updatedInit.headers || {});
        
        // إضافة ختم الحماية
        if (!headers.has("Authorization")) {
          headers.set("Authorization", `Bearer ${token}`);
        }
        
        // ضبط نوع البيانات الافتراضي
        if (!headers.has("Content-Type") && !(updatedInit.body instanceof FormData)) {
          headers.set("Content-Type", "application/json");
        }

        updatedInit.headers = headers;
      }
    }

   // اذهب للجزء السفلي من الملف واستبدل الـ try/catch بهذا الكود:

    try {
      const response = await originalFetch(input, updatedInit);

      // 1. معالجة حالة انتهاء الجلسة (401)
      if (response.status === 401 && isApiRequest && !isLoginRequest) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.dispatchEvent(new Event("auth-change"));
        
        if (!window.location.pathname.includes("/login")) {
          window.location.href = "/";
        }
      }

      if (response.status === 402 && isApiRequest) {
          // إظهار رسالة للمستخدم عند تجاوز حد قاعدة البيانات
          window.dispatchEvent(new CustomEvent("db-quota-exceeded", {
              detail: { message: "⚠️ النظام مشغول حالياً أو تجاوز الحد المسموح. البيانات لم تُحفظ. يرجى المحاولة لاحقاً ..." }
          }));
      }

      // 🟢 2. إرجاع الرد كما هو (حتى لو كان خطأ 400 أو 500) 
      // لكي تتمكن الصفحة من قراءة حالة الخطأ وإظهار رسالة toast
      return response;

    } catch (error) {
    console.error("🌐 Fetch Interceptor Error:", error);
    // نرجع كائن يشبه الـ Response لكي لا ينهار الكود الذي ينتظر الرد
    return new Response(JSON.stringify({ 
        detail: "حدث خطأ في الاتصال بالسيرفر أو قيود في قاعدة البيانات" 
    }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
}
  };
}