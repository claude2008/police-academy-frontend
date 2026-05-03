"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Loader2, Save, RefreshCw } from "lucide-react"
import { toast } from "sonner"

// دالة للحصول على رابط API الصحيح
const getApiUrl = () => {
  // استخدم متغير البيئة في Production، أو localhost في Development
  return typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : 'http://localhost:8000'
}

interface FeatureSetting {
  id: number
  key: string
  value: boolean
  label_ar: string
  description?: string
}

export default function FeaturesControlPage() {
  const [settings, setSettings] = useState<FeatureSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // جلب الإعدادات من الـ API
  const fetchSettings = async () => {
    setLoading(true)
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/settings/features`)
      const data = await response.json()
      setSettings(data)
    } catch (error) {
      console.error('خطأ في جلب الإعدادات:', error)
      toast.error('فشل تحميل الإعدادات')
    } finally {
      setLoading(false)
    }
  }

  // تحديث إعداد واحد
  const toggleFeature = async (key: string, newValue: boolean) => {
    setSaving(true)
    try {
     const token = localStorage.getItem('token')  // 👈 غيّر من access_token إلى token
      const apiUrl = getApiUrl()
      
      const response = await fetch(`${apiUrl}/api/settings/features/${key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ value: newValue })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'فشل التحديث')
      }

      // تحديث الحالة المحلية
      setSettings(prev => 
        prev.map(s => s.key === key ? { ...s, value: newValue } : s)
      )

      toast.success(`تم ${newValue ? 'تفعيل' : 'تعطيل'} الميزة بنجاح`)
      
      // إعادة تحميل الصفحة بعد ثانيتين لتطبيق التغييرات
      setTimeout(() => {
        window.location.reload()
      }, 2000)

    } catch (error: any) {
      console.error('خطأ في التحديث:', error)
      toast.error(error.message || 'فشل تحديث الإعداد')
      // إرجاع القيمة القديمة في حال الفشل
      fetchSettings()
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              لوحة تحكم المميزات
            </h1>
            <p className="text-gray-500 mt-2">
              تحكم في إظهار وإخفاء أقسام التطبيق
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSettings}
            disabled={saving}
          >
            <RefreshCw className="w-4 h-4 ml-2" />
            تحديث
          </Button>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {settings.map((setting) => (
          <Card key={setting.id} className="border-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {setting.label_ar}
                </CardTitle>
                <Switch
                  checked={setting.value}
                  onCheckedChange={(checked) => toggleFeature(setting.key, checked)}
                  disabled={saving}
                />
              </div>
              {setting.description && (
                <CardDescription className="text-right">
                  {setting.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">المعرف: {setting.key}</span>
                <span className={`font-semibold ${setting.value ? 'text-green-600' : 'text-red-600'}`}>
                  {setting.value ? '✓ مفعّل' : '✗ معطّل'}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Warning */}
      <Card className="mt-8 border-orange-200 bg-orange-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold text-orange-900">تنبيه هام</p>
              <p className="text-sm text-orange-800 mt-1">
                التغييرات تطبق فوراً على جميع المستخدمين. سيتم إعادة تحميل الصفحة تلقائياً بعد كل تغيير.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}