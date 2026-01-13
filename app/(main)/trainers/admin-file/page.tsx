"use client"

import { useEffect, useState } from "react" // ✅ إضافة الاستيرادات الناقصة
import { useSearchParams, useRouter } from "next/navigation" 
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button" // ✅ إضافة استيراد الزر
import { FileText, Activity, Shield, AlertTriangle } from "lucide-react" // ✅ دمج الأيقونات في سطر واحد ومنع التكرار
import StatusManager from "@/components/trainers/managers/StatusManager"
import FitnessManager from "@/components/trainers/managers/FitnessManager"
import WorkloadManager from "@/components/trainers/managers/WorkloadManager"
import ProtectedRoute from "@/components/ProtectedRoute"

export default function AdminFilePage() {
  const searchParams = useSearchParams()
  const router = useRouter() // ✅ تعريف الروتر للتنقل
  
  // نقرأ الفرع من الرابط، إذا لم يوجد نعتبره "all"
  const currentBranch = searchParams.get("branch") || "all"

  // تعريف حالات المستخدم والفرع
  const [userBranch, setUserBranch] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

  // تحديد العنوان حسب الفرع
  const pageTitle = currentBranch === "sports" ? "الملف الإداري (التدريب الرياضي)" :
                    currentBranch === "military" ? "الملف الإداري (التدريب العسكري)" :
                    "الملف الإداري الشامل";

  useEffect(() => {
    const userStr = localStorage.getItem("user")
    if (userStr) {
      const user = JSON.parse(userStr)
      setUserBranch(user.branch || null)
      setUserRole(user.role || null)
    }
  }, [])

  // 🛡️ منطق التحقق من الوصول للفرع
  const isAuthorized = () => {
    const highAdmins = ["owner", "manager", "admin"];
    if (highAdmins.includes(userRole || "")) return true;

    // عزل الفروع: الضباط يجب أن يتطابق فرعهم مع الرابط
    if (currentBranch === "sports" && userBranch === "تدريب رياضي") return true;
    if (currentBranch === "military" && userBranch === "تدريب عسكري") return true;
    if (currentBranch === "all") return true; // السماح بالعرض الشامل إذا كان الموجه هو الصفحة الرئيسية
    
    return false;
  }

  // إذا لم يكن مخولاً بعد اكتمال التحميل، نعرض له رسالة تنبيه
  if (userRole && !isAuthorized()) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 bg-red-50 rounded-2xl border-2 border-dashed border-red-200" dir="rtl">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-red-700">دخول غير مصرح به</h2>
        <p className="text-red-500 mt-2">لا تملك صلاحية الوصول لملفات فرع آخر.</p>
        <Button onClick={() => router.back()} className="mt-4 bg-red-600 hover:bg-red-700 text-white">العودة للخلف</Button>
      </div>
    )
  }

  return (
    <ProtectedRoute allowedRoles={["owner","manager","admin","assistant_admin"]}>
      <div className="space-y-6 pb-10 md:pb-24 " dir="rtl">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2 print:hidden">
          <Shield className={`w-8 h-8 ${currentBranch === 'sports' ? 'text-blue-600' : 'text-red-600'}`} />
          {pageTitle}
        </h1>
        
        <Tabs defaultValue="status" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-[600px] mb-8 h-auto print:hidden">
            <TabsTrigger value="status" className="gap-1 md:gap-2 text-[10px] md:text-sm px-1 h-9">
              <FileText className="w-3 h-3 md:w-4 md:h-4"/> الحالات
            </TabsTrigger>
            
            <TabsTrigger value="fitness" className="gap-1 md:gap-2 text-[10px] md:text-sm px-1 h-9">
              <Activity className="w-3 h-3 md:w-4 md:h-4"/> الاختبارات
            </TabsTrigger>
            
            <TabsTrigger value="workload" className="gap-1 md:gap-2 text-[10px] md:text-sm px-1 h-9">
              <Shield className="w-3 h-3 md:w-4 md:h-4"/> العبء
            </TabsTrigger>
          </TabsList>

          <TabsContent value="status">
            <StatusManager branch={currentBranch} />
          </TabsContent>

          <TabsContent value="fitness">
            <FitnessManager />
          </TabsContent>

          <TabsContent value="workload">
            <WorkloadManager />
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedRoute>
  )
}