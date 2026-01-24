"use client"

import { useState, useEffect } from "react"
import { 
  Bell, Activity, AlertTriangle, ClipboardList, FileText, 
  Clock, Loader2, Layers, ChevronLeft 
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

export default function NotificationsMenu() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      if (res.ok) {
        setNotifications(await res.json())
      }
    } catch (e) {
      console.error("Failed to fetch notifications")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 120000) // تحديث كل دقيقتين
    return () => clearInterval(interval)
  }, [])

  // دالة مساعدة لجلب الأيقونة واللون بناءً على الفئة
  const getCategoryConfig = (category: string) => {
    switch (category) {
      case 'status': return { icon: <Activity className="w-4 h-4" />, color: "text-blue-600", bg: "bg-blue-50", border: "border-r-blue-500" };
      case 'violations': return { icon: <AlertTriangle className="w-4 h-4" />, color: "text-red-600", bg: "bg-red-50", border: "border-r-red-500" };
      case 'exams': return { icon: <ClipboardList className="w-4 h-4" />, color: "text-purple-600", bg: "bg-purple-50", border: "border-r-purple-500" };
      case 'reports': return { icon: <FileText className="w-4 h-4" />, color: "text-orange-600", bg: "bg-orange-50", border: "border-r-orange-500" };
      default: return { icon: <Bell className="w-4 h-4" />, color: "text-slate-600", bg: "bg-slate-50", border: "border-r-slate-300" };
    }
  }

  // فلترة الإشعارات حسب الفئة للتبويبات
  const filterBy = (cat: string) => notifications.filter(n => n.category === cat)

  const renderNotificationList = (items: any[]) => (
    <div className="max-h-[380px] overflow-y-auto custom-scrollbar flex flex-col">
      {items.length === 0 ? (
        <div className="py-16 text-center flex flex-col items-center gap-2">
          <Layers className="w-8 h-8 text-slate-200" />
          <p className="text-xs text-slate-400 font-bold">لا توجد تنبيهات في هذا القسم</p>
        </div>
      ) : (
        items.map((notif) => {
          const config = getCategoryConfig(notif.category);
          return (
            <div 
              key={notif.id} 
              onClick={() => router.push(notif.link)}
              className={cn(
                "p-4 border-b last:border-0 cursor-pointer transition-all hover:bg-slate-50 flex gap-3 items-start border-r-4",
                config.border
              )}
            >
              <div className={cn("mt-0.5 p-2 rounded-xl shadow-sm border border-white", config.bg, config.color)}>
                {config.icon}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex justify-between items-center">
                  <p className="font-black text-[11px] text-slate-900">{notif.title}</p>
                  <span className="text-[9px] text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded-full">{notif.time_ago}</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed font-medium line-clamp-2">
                  {notif.details}
                </p>
              </div>
            </div>
          );
        })
      )}
    </div>
  )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="relative cursor-pointer group">
           <Button variant="ghost" size="icon" className="relative hover:bg-slate-100 rounded-full h-10 w-10">
            <Bell className="w-6 h-6 text-slate-500 group-hover:text-blue-600 transition-colors" />
            {notifications.length > 0 && (
              <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-red-600 rounded-full border-2 border-white" />
            )}
          </Button>
        </div>
      </PopoverTrigger>
      
      <PopoverContent className="w-[380px] p-0 rounded-3xl shadow-2xl border-slate-200 overflow-hidden bg-white z-[9999]" align="start">
        {/* الهيدر العلوي */}
        <div className="bg-[#0f172a] p-4 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <Bell className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-black text-xs">الإشعـارات  </h3>
              <p className="text-[9px] text-slate-400 font-medium">معهد الشرطة - الإدارة العامة</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchNotifications} className="text-white hover:bg-white/10 h-8 w-8 p-0">
            <Clock className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>

        {/* نظام التبويبات */}
        <Tabs defaultValue="all" className="w-full" dir="rtl">
          <TabsList className="w-full justify-start rounded-none bg-slate-50 border-b p-0 h-12 gap-0">
            <TabsTrigger value="all" className="flex-1 text-[10px] font-black data-[state=active]:bg-white data-[state=active]:text-blue-600 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 h-full">
              الكل <Badge variant="secondary" className="mr-1 px-1 h-4 min-w-[16px] text-[9px]">{notifications.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="status" className="flex-1 text-[10px] font-black data-[state=active]:bg-white data-[state=active]:text-blue-600 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 h-full">
              حالات <Badge className="mr-1 px-1 h-4 min-w-[16px] text-[9px] bg-blue-500">{filterBy('status').length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="vios" className="flex-1 text-[10px] font-black data-[state=active]:bg-white data-[state=active]:text-red-600 rounded-none border-b-2 border-transparent data-[state=active]:border-red-600 h-full">
              مخالفات <Badge className="mr-1 px-1 h-4 min-w-[16px] text-[9px] bg-red-500">{filterBy('violations').length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="exams" className="flex-1 text-[10px] font-black data-[state=active]:bg-white data-[state=active]:text-purple-600 rounded-none border-b-2 border-transparent data-[state=active]:border-purple-600 h-full">
              اختبارات <Badge className="mr-1 px-1 h-4 min-w-[16px] text-[9px] bg-purple-500">{filterBy('exams').length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="reps" className="flex-1 text-[10px] font-black data-[state=active]:bg-white data-[state=active]:text-orange-600 rounded-none border-b-2 border-transparent data-[state=active]:border-orange-600 h-full">
              تقارير <Badge className="mr-1 px-1 h-4 min-w-[16px] text-[9px] bg-orange-500">{filterBy('reports').length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="m-0 focus-visible:ring-0">{renderNotificationList(notifications)}</TabsContent>
          <TabsContent value="status" className="m-0 focus-visible:ring-0">{renderNotificationList(filterBy('status'))}</TabsContent>
          <TabsContent value="vios" className="m-0 focus-visible:ring-0">{renderNotificationList(filterBy('violations'))}</TabsContent>
          <TabsContent value="exams" className="m-0 focus-visible:ring-0">{renderNotificationList(filterBy('exams'))}</TabsContent>
          <TabsContent value="reps" className="m-0 focus-visible:ring-0">{renderNotificationList(filterBy('reports'))}</TabsContent>
        </Tabs>
        
        {/* الفوتير السفلي - معطل مؤقتاً */}
<div className="p-3 bg-slate-50 border-t flex justify-center items-center">
    <button 
      onClick={() => {
        // بدلاً من الانتقال لصفحة غير موجودة، نظهر رسالة تنبيه احترافية
        import("sonner").then(({ toast }) => {
          toast.info("سجل العمليات الكامل قيد التطوير حالياً وسيتم تفعيله قريباً.");
        });
      }}
      className="text-[10px] font-bold text-slate-300 cursor-not-allowed flex items-center gap-1 transition-colors"
      title="هذه الميزة قيد التطوير"
    >
      عرض السجل الكامل للعمليات <ChevronLeft className="w-3 h-3" />
    </button>
</div>
      </PopoverContent>
    </Popover>
  )
}