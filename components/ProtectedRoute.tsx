"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: string[]  // الأدوار المسموحة (اختياري)
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("token")
      
      if (!token) {
        router.push("/")
        setLoading(false)
        return
      }

      // التحقق من الدور من الخادم
      if (allowedRoles && allowedRoles.length > 0) {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/me`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          
          if (res.ok) {
            const user = await res.json()
            if (!allowedRoles.includes(user.role)) {
              router.push("/unauthorized")  // صفحة غير مصرح
              setLoading(false)
              return
            }
          } else {
            router.push("/")
            setLoading(false)
            return
          }
        } catch (e) {
          router.push("/")
          setLoading(false)
          return
        }
      }

      setAuthorized(true)
      setLoading(false)
    }

    checkAuth()
  }, [router, allowedRoles])

  if (loading) return <div className="flex items-center justify-center min-h-screen">جاري التحقق...</div>
  if (!authorized) return null

  return <>{children}</>
}
