import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
 
export function middleware(request: NextRequest) {
  // يقرأ التوكن من الكوكيز التي أضفناها في السطر السابق
  const token = request.cookies.get('token')?.value;

  // إذا حاول المنافس دخول الداشبورد بدون توكن
  if (request.nextUrl.pathname.startsWith('/dashboard') && !token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
}