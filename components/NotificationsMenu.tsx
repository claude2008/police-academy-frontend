"use client"

import { useState, useEffect } from "react"
import { 
  Bell, Activity, AlertTriangle, ClipboardList, FileText, 
  Clock, Loader2, Layers, ChevronLeft, X 
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
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
    // تحديث تلقائي كل دقيقتين لضمان مزامنة الإشعارات الجديدة
    const interval = setInterval(fetchNotifications, 120000) 
    return () => clearInterval(interval)
  }, [])

  // 🔵 دالة تمييز الإشعار كمقروء (الآن مرتبطة بجدول الخصوصية الجديد)
  const handleNotificationClick = async (notif: any) => {
    if (!notif.is_read) {
      // 1. تحديث الحالة محلياً فوراً ليشعر المستخدم بالسرعة
      setNotifications(prev => 
        prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n)
      )
      
      // 2. إبلاغ الباك إند ليحفظ القراءة لهذا المستخدم بالذات في الجدول الجديد
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/mark-read/${notif.id}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
      } catch (e) {
        console.error("Error marking as read")
      }
    }
    
    // 3. الانتقال للرابط المطلوب
    router.push(notif.link)
  }
 // 🔴 أضف هذه الدالة تحت handleNotificationClick
const handleDismiss = async (e: React.MouseEvent, notifId: string) => {
  e.stopPropagation(); // ✋ ضروري جداً لمنع فتح رابط الإشعار عند الضغط على X
  
  // 1. إخفاء محلي فوري
  setNotifications(prev => prev.filter(n => n.id !== notifId));
  
  // 2. إرسال أمر الحذف للباك إند
  try {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/dismiss/${notifId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
  } catch (e) {
    console.error("فشل حذف الإشعار");
  }
};
  const getCategoryConfig = (category: string) => {
    switch (category) {
      case 'status': return { icon: <Activity className="w-4 h-4" />, color: "text-blue-600", bg: "bg-blue-50", border: "border-r-blue-500" };
      case 'violations': return { icon: <AlertTriangle className="w-4 h-4" />, color: "text-red-600", bg: "bg-red-50", border: "border-r-red-500" };
      case 'exams': return { icon: <ClipboardList className="w-4 h-4" />, color: "text-purple-600", bg: "bg-purple-50", border: "border-r-purple-500" };
      case 'reports': return { icon: <FileText className="w-4 h-4" />, color: "text-orange-600", bg: "bg-orange-50", border: "border-r-orange-500" };
      default: return { icon: <Bell className="w-4 h-4" />, color: "text-slate-600", bg: "bg-slate-50", border: "border-r-slate-300" };
    }
  }

  // حساب الإشعارات غير المقروءة (الخاصة بالمستخدم الحالي فقط)
  const unreadAll = notifications.filter(n => !n.is_read).length
  const filterUnreadBy = (cat: string) => notifications.filter(n => n.category === cat && !n.is_read).length
  const filterAllBy = (cat: string) => notifications.filter(n => n.category === cat)

  const renderNotificationList = (items: any[]) => (
  <div className="max-h-[380px] overflow-y-auto custom-scrollbar flex flex-col">
    <AnimatePresence mode="popLayout">
      {items.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="py-16 text-center flex flex-col items-center gap-2"
        >
          <Layers className="w-8 h-8 text-slate-200" />
          <p className="text-xs text-slate-400 font-bold">لا توجد تنبيهات في هذا القسم</p>
        </motion.div>
      ) : (
        items.map((notif) => {
          const config = getCategoryConfig(notif.category);
          return (
            <motion.div 
              key={notif.id} 
              layout // يضمن صعود العناصر السفلية بسلاسة عند حذف عنصر
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 50, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              onClick={() => handleNotificationClick(notif)}
              className={cn(
                "p-4 border-b last:border-0 cursor-pointer transition-all flex gap-3 items-start border-r-4",
                notif.is_read ? "bg-white hover:bg-slate-50" : "bg-blue-50/40 hover:bg-blue-50/60",
                config.border
              )}
            >
              <div className="relative">
                <div className={cn("mt-0.5 p-2 rounded-xl shadow-sm border border-white", config.bg, config.color)}>
                  {config.icon}
                </div>
                {!notif.is_read && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
                  </span>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex justify-between items-center">
                  <p className={cn("text-[11px] text-slate-900", !notif.is_read ? "font-black" : "font-bold")}>
                    {notif.title}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-slate-400 font-bold bg-white/80 px-1.5 py-0.5 rounded-full border border-slate-100">
                      {notif.time_ago}
                    </span>
                    
                    {/* ❌ زر الحذف الصغير */}
                    <button 
                      onClick={(e) => handleDismiss(e, notif.id)}
                      className="p-1 hover:bg-red-100 hover:text-red-600 rounded-md text-slate-300 transition-colors"
                      title="حذف من القائمة"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <p className={cn("text-[10px] leading-relaxed line-clamp-2", !notif.is_read ? "text-slate-700 font-bold" : "text-slate-500 font-medium")}>
                  {notif.details}
                </p>
              </div>
            </motion.div>
          );
        })
      )}
    </AnimatePresence>
  </div>
)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="relative cursor-pointer group">
           <Button variant="ghost" size="icon" className="relative hover:bg-slate-100 rounded-full h-10 w-10">
            <Bell className="w-6 h-6 text-slate-500 group-hover:text-blue-600 transition-colors" />
            {/* 🔴 الرقم فوق الأيقونة (الإشعارات الجديدة غير المقروءة) */}
            {unreadAll > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white border-2 border-white shadow-md animate-in zoom-in duration-300">
                {unreadAll > 9 ? '9+' : unreadAll}
              </span>
            )}
          </Button>
        </div>
      </PopoverTrigger>
      
      <PopoverContent className="w-[380px] p-0 rounded-3xl shadow-2xl border-slate-200 overflow-hidden bg-white z-[9999]" align="start">
        {/* الهيدر العلوي */}
        <div className="bg-[#0f172a] p-4 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-900/20">
              <Bell className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-black text-xs">مركز التنبيهات</h3>
              <p className="text-[9px] text-slate-400 font-medium tracking-wide">معهد الشرطة - الإدارة الرقمية</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchNotifications} className="text-white hover:bg-white/10 h-8 w-8 p-0 transition-all active:scale-95">
            <Clock className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>

        {/* نظام التبويبات مع العدادات الذكية */}
        <Tabs defaultValue="all" className="w-full" dir="rtl">
          <TabsList className="w-full justify-start rounded-none bg-slate-50 border-b p-0 h-12 gap-0 overflow-x-auto no-scrollbar">
            <TabsTrigger value="all" className="flex-1 text-[10px] font-black data-[state=active]:bg-white data-[state=active]:text-blue-600 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 h-full transition-all">
              الكل <Badge variant={unreadAll > 0 ? "destructive" : "secondary"} className="mr-1 px-1 h-4 min-w-[16px] text-[9px]">{unreadAll}</Badge>
            </TabsTrigger>
            <TabsTrigger value="status" className="flex-1 text-[10px] font-black data-[state=active]:bg-white data-[state=active]:text-blue-600 h-full transition-all">
              حالات <Badge className={cn("mr-1 px-1 h-4 min-w-[16px] text-[9px]", filterUnreadBy('status') > 0 ? "bg-blue-600" : "bg-slate-300")}>{filterUnreadBy('status')}</Badge>
            </TabsTrigger>
            <TabsTrigger value="vios" className="flex-1 text-[10px] font-black data-[state=active]:bg-white data-[state=active]:text-red-600 h-full transition-all">
              مخالفات <Badge className={cn("mr-1 px-1 h-4 min-w-[16px] text-[9px]", filterUnreadBy('violations') > 0 ? "bg-red-600" : "bg-slate-300")}>{filterUnreadBy('violations')}</Badge>
            </TabsTrigger>
            <TabsTrigger value="exams" className="flex-1 text-[10px] font-black data-[state=active]:bg-white data-[state=active]:text-purple-600 h-full transition-all">
              اختبارات <Badge className={cn("mr-1 px-1 h-4 min-w-[16px] text-[9px]", filterUnreadBy('exams') > 0 ? "bg-purple-600" : "bg-slate-300")}>{filterUnreadBy('exams')}</Badge>
            </TabsTrigger>
            <TabsTrigger value="reps" className="flex-1 text-[10px] font-black data-[state=active]:bg-white data-[state=active]:text-orange-600 h-full transition-all">
              تقارير <Badge className={cn("mr-1 px-1 h-4 min-w-[16px] text-[9px]", filterUnreadBy('reports') > 0 ? "bg-orange-600" : "bg-slate-300")}>{filterUnreadBy('reports')}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="m-0 focus-visible:ring-0">{renderNotificationList(notifications)}</TabsContent>
          <TabsContent value="status" className="m-0 focus-visible:ring-0">{renderNotificationList(filterAllBy('status'))}</TabsContent>
          <TabsContent value="vios" className="m-0 focus-visible:ring-0">{renderNotificationList(filterAllBy('violations'))}</TabsContent>
          <TabsContent value="exams" className="m-0 focus-visible:ring-0">{renderNotificationList(filterAllBy('exams'))}</TabsContent>
          <TabsContent value="reps" className="m-0 focus-visible:ring-0">{renderNotificationList(filterAllBy('reports'))}</TabsContent>
        </Tabs>
        
        {/* الفوتير السفلي */}
        <div className="p-3 bg-slate-50 border-t flex justify-center items-center">
            <button 
              onClick={() => {
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