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

    try {
      const response = await originalFetch(input, updatedInit);

      // إذا رفض السيرفر الطلب بسبب انتهاء الهوية (401)
      if (response.status === 401 && isApiRequest && !isLoginRequest) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.dispatchEvent(new Event("auth-change"));
        
        if (!window.location.pathname.includes("/login")) {
          window.location.href = "/";
        }
      }

      return response;
    } catch (error) {
      throw error;
    }
  };
}