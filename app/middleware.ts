import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
 
export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  // 1. السماح بمرور ملفات النظام والصور والـ API لكي لا يعلق التطبيق
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api') || 
    pathname.startsWith('/static') ||
    pathname.includes('.') // يسمح بالصور مثل logo.jpg
  ) {
    return NextResponse.next();
  }

  // 2. حماية الداشبورد: إذا لم يوجد توكن، ارجع لصفحة الدخول
  if (pathname.startsWith('/dashboard') && !token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 3. منع المسجلين من العودة لصفحة الدخول وهم يملكون توكن (اختياري)
  if (pathname === '/' && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

// 4. تحديد المسارات التي يراقبها الحارس بدقة
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}