// ⚙️ مركز التحكم في مميزات التطبيق (يقرأ من API)

// القيم الافتراضية (في حالة فشل الاتصال)
const DEFAULT_CONFIG = {
  attendance: true,
  violations: true,
  exams: false,
  digitalExams: false,
  reports: true,
  soldiers: true,
  others: true,
  trainers: true,
  courses: true,
}

// دالة لجلب الإعدادات من API
export async function loadFeaturesFromAPI() {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const response = await fetch(`${apiUrl}/api/settings/features`, {
      cache: 'no-store' // لا تخزن مؤقتاً
    })
    
    if (!response.ok) throw new Error('Failed to fetch')
    
    const settings = await response.json()
    
    // تحويل المصفوفة إلى Object
    const config: Record<string, boolean> = {}
    settings.forEach((setting: any) => {
      config[setting.key] = setting.value
    })
    
    return config
  } catch (error) {
    console.error('❌ فشل جلب الإعدادات، استخدام القيم الافتراضية:', error)
    return DEFAULT_CONFIG
  }
}

// تصدير القيم الافتراضية (للتوافق مع الكود القديم)
export const FEATURES_CONFIG = DEFAULT_CONFIG

export const isFeatureEnabled = (feature: keyof typeof DEFAULT_CONFIG) => {
  return FEATURES_CONFIG[feature]
}