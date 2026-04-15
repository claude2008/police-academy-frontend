"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: string[]
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("token")
      
      if (!token) {
        router.push("/")
        setLoading(false)
        return
      }

      if (allowedRoles && allowedRoles.length > 0) {
        // ✅ من localStorage مباشرة — لا يحتاج شبكة
        const user = JSON.parse(localStorage.getItem("user") || "{}")
        
        if (!user.role || !allowedRoles.includes(user.role)) {
          router.push("/unauthorized")
          setLoading(false)
          return
        }
      }

      setAuthorized(true)
      setLoading(false)
    }

    checkAuth()
  }, [router, allowedRoles])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      جاري التحقق...
    </div>
  )
  if (!authorized) return null

  return <>{children}</>
}