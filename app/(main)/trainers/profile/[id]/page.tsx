"use client"

import { useEffect, useState, use } from "react"
import { safePrint } from "@/lib/safePrint"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Printer, User, ArrowRight, Plus, Activity, Calendar, FileText, GraduationCap, Shield, Hash, BookOpen } from "lucide-react"
import { differenceInYears } from "date-fns"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import ProtectedRoute from "@/components/ProtectedRoute"
// الاستيرادات الخاصة بنا
import TrainerReportsCard from "@/components/trainers/TrainerReportsCard"
import TrainerStatusTab from "@/components/trainers/tabs/TrainerStatusTab"
import TrainerFitnessTab from "@/components/trainers/tabs/TrainerFitnessTab"
import AddStatusModal from "@/components/trainers/modals/AddStatusModal"
import AddFitnessModal from "@/components/trainers/modals/AddFitnessModal"
import AddWorkloadModal from "@/components/trainers/modals/AddWorkloadModal"
import TrainerWorkloadTab from "@/components/trainers/tabs/TrainerWorkloadTab"

// --- المكونات الفرعية (Badge, InfoBox, ActionButton) ---
const ActionButton = ({ label, icon, onClick, colorClass, bgClass }: any) => (
    <button 
        onClick={onClick}
        className={`flex items-center justify-between w-full p-4 rounded-xl border transition-all hover:shadow-md group ${bgClass} border-transparent hover:border-${colorClass.split('-')[1]}-200`}
    >
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${colorClass} text-white shadow-sm`}>{icon}</div>
            <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{label}</span>
        </div>
        <Plus className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
    </button>
)

const BadgeItem = ({ icon, label, className }: any) => (
    <span className={`bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 ${className}`}>
        <span>{icon}</span> {label}
    </span>
)

const InfoBox = ({ label, value, isLtr, className }: any) => (
    <div className={`p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800 ${className || ""}`}>
        <span className="block text-xs text-slate-400 mb-1">{label}</span>
        <p className={`font-semibold text-slate-800 dark:text-slate-200 ${isLtr ? "dir-ltr text-left" : ""}`}>{value || "-"}</p>
    </div>
)

export default function TrainerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  
  // 1. تعريف المتغيرات (State) للنوافذ
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [isFitnessModalOpen, setIsFitnessModalOpen] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0) // لتحديث الجداول تلقائياً
  const [isWorkloadModalOpen, setIsWorkloadModalOpen] = useState(false)
  const [trainer, setTrainer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  // جلب بيانات المدرب
 useEffect(() => {
    // 🟢 الجزء المضاف لجلب رتبة المستخدم الحالي
    const userStr = localStorage.getItem("user");
    if (userStr) {
        const localUser = JSON.parse(userStr);
        setUserRole(localUser.role || null);
    }

    const fetchTrainer = async () => {
        try {
            const token = localStorage.getItem("token"); 
            if (!token) return;

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${resolvedParams.id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (res.ok) setTrainer(await res.json());
        } catch (e) { console.error("Error") } 
        finally { setLoading(false) }
    }
    fetchTrainer();
}, [resolvedParams.id]);;
const [counts, setCounts] = useState({
    workloads: 0,
    statuses: 0,
    fitness: 0,
    reports: 0
  });

  // دالة لجلب الأعداد (يمكنك استدعاؤها داخل useEffect)
  const fetchCounts = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trainers/${resolvedParams.id}/stats-counts`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) setCounts(await res.json());
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    fetchCounts();
  }, [refreshTrigger, resolvedParams.id]);
  // دوال مساعدة (العمر، الخبرة، الدورات)
  const calculateAge = (dob: string) => {
    if (!dob) return "---";
    const date = new Date(dob);
    return isNaN(date.getTime()) ? "---" : `${differenceInYears(new Date(), date)} سنة`;
  }
  const calculateExperience = (appDate: string) => {
    if (!appDate) return "---";
    const date = new Date(appDate);
    return isNaN(date.getTime()) ? "-" : `${differenceInYears(new Date(), date)} سنوات`;
  }
  const getCoursesList = (coursesStr: string) => {
    if (!coursesStr) return [];
    return coursesStr.replace(/،/g, ',').split(',').map(c => c.trim()).filter(c => c !== "");
  }
  const handlePrint = () => {
    document.title = trainer ? `ملف المدرب - ${trainer.name}` : "ملف مدرب";
    safePrint();
  }
  const showComingSoon = () => toast.info("هذه الميزة قيد الإنشاء")

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="flex flex-col items-center gap-2"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div><p className="text-sm text-slate-500">جاري تحميل الملف...</p></div></div>
  if (!trainer) return <div className="p-10 text-center text-red-500">لم يتم العثور على المدرب</div>

  return (
    <ProtectedRoute allowedRoles={["owner","manager","admin","assistant_admin","sports_officer", "military_officer"]}>
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-10 md:pb-24 font-sans" dir="rtl">
      
      {/* إعدادات الطباعة */}
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 5mm 4mm; }
          nav, aside, header, .print\\:hidden, .action-grid { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
          .no-break { page-break-inside: avoid; }
        }
        .pdf-mode nav, .pdf-mode aside, .pdf-mode header, .pdf-mode .print\\:hidden, .pdf-mode .action-grid { display: none !important; }
        .pdf-mode body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
        .pdf-mode .no-break { page-break-inside: avoid; }
      `}</style>

      {/* الشريط العلوي */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={() => router.back()} className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 gap-2">
                    <ArrowRight className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-xl font-bold text-slate-800 dark:text-white">ملف المدرب</h1>
                    <p className="text-xs text-slate-500">إدارة البيانات والسجلات</p>
                </div>
            </div>
            <Button variant="outline" onClick={handlePrint} className="gap-2 border-slate-300 text-slate-700">
                <Printer className="w-4 h-4" /> طباعة
            </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-6 space-y-6">
        
        {/* 1. بطاقة التعريف */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 print:p-0 print:border-none print:shadow-none print:mb-2">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 print:gap-4 print:flex-row print:items-start">
                {/* 📸 مربع الصورة المطور */}
<div className="w-32 h-32 print:w-28 print:h-28 rounded-2xl border-[4px] border-slate-100 dark:border-slate-800 bg-slate-100 shadow-sm overflow-hidden shrink-0 relative group">
    <img 
        // 🟢 نستخدم الرابط السحابي مباشرة مع إضافة التوقيت لمنع مشاكل الكاش
        src={trainer.image_url ? `${trainer.image_url}?t=${new Date().getTime()}` : "/placeholder-user.png"} 
        alt={trainer.name} 
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        onError={(e) => {
            // في حال فشل الرابط السحابي لأي سبب، نعرض الصورة الافتراضية
            (e.target as HTMLImageElement).src = "/placeholder-user.png";
        }} 
    />
    
    {/* طبقة تظهر عند الوقوف بالماوس (اختياري لو أردت إضافة زر تغيير الصورة مستقبلاً) */}
    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <User className="w-8 h-8 text-white/70" />
    </div>
</div>

                {/* البيانات */}
                <div className="flex-1 text-center md:text-right space-y-2 w-full pt-2 print:pt-0">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white leading-tight">{trainer.name}</h2>
                        <p className="text-lg font-medium text-blue-600 mt-1">{trainer.rank} - {trainer.job_title || "مدرب"}</p>
                    </div>
                    <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-4 print:mt-2">
                        <BadgeItem icon={<Hash className="w-3 h-3" />} label={trainer.military_id} />
                        <BadgeItem icon="🏁" label={trainer.sport_specialty || "عام"} />
                        <BadgeItem icon="🎂" label={calculateAge(trainer.dob)} />
                        <BadgeItem icon="⏳" label={`خبرة ${calculateExperience(trainer.appointment_date)}`} />
                        <BadgeItem icon="📞" label={trainer.phone || "لا يوجد هاتف"} className="dir-ltr" />
                    </div>
                </div>
            </div>
        </div>

        {/* 2. لوحة التحكم (تم ربط الأزرار هنا) ✅ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 action-grid print:hidden">
            <ActionButton label="إضافة مؤهل" icon={<GraduationCap className="w-5 h-5" />} colorClass="bg-blue-600" bgClass="bg-blue-50 dark:bg-blue-900/10" onClick={showComingSoon} />
            <ActionButton label="إضافة عبئ" icon={<Shield className="w-5 h-5" />} colorClass="bg-purple-600" bgClass="bg-purple-50 dark:bg-purple-900/10" onClick={() => setIsWorkloadModalOpen(true)} />
            
            {/* 👇 الزر البرتقالي: يفتح نافذة الحالة */}
            <ActionButton label="إضافة حالة" icon={<Calendar className="w-5 h-5" />} colorClass="bg-orange-600" bgClass="bg-orange-50 dark:bg-orange-900/10" onClick={() => setIsStatusModalOpen(true)} />
            
            {/* 👇 الزر الأخضر: يفتح نافذة الاختبار */}
            <ActionButton label="إضافة اختبار" icon={<Activity className="w-5 h-5" />} colorClass="bg-green-600" bgClass="bg-green-50 dark:bg-green-900/10" onClick={() => setIsFitnessModalOpen(true)} />
        </div>

        {/* 3. الأقسام التفصيلية */}
        <div className="space-y-4">
            
            {/* القسم 1: المؤهل والدورات */}
            <Accordion type="multiple" className="w-full space-y-4">
                <AccordionItem value="item-1" className="bg-white dark:bg-slate-900 border rounded-xl px-2 shadow-sm no-break">
                    <AccordionTrigger className="px-4 py-4 hover:no-underline">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><GraduationCap className="w-5 h-5" /></div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">المؤهل العلمي والدورات</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-3 gap-4 mb-6">
                            <InfoBox label="المؤهل العلمي" value={trainer.degree} />
                            <InfoBox label="تاريخ التعيين" value={trainer.appointment_date ? String(trainer.appointment_date).slice(0, 10) : "-"} />
                            <InfoBox label="الإختصاص الدقيق" value={trainer.sport_specialty} />
                            <InfoBox label="البريد الإلكتروني" value={trainer.email} isLtr className="print:col-span-3" />
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-3">
                                <BookOpen className="w-4 h-4" /> الدورات الحاصل عليها:
                            </span>
                            {trainer.courses ? (
                                <div className="flex flex-wrap gap-2">
                                    {getCoursesList(trainer.courses).map((course: string, index: number) => (
                                        <span key={index} className="bg-white dark:bg-slate-900 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-sm font-medium shadow-sm flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>{course}
                                        </span>
                                    ))}
                                </div>
                            ) : <p className="text-sm text-slate-400 italic">لا يوجد دورات مسجلة.</p>}
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2" className="bg-white dark:bg-slate-900 border rounded-xl px-2 shadow-sm no-break">
                <AccordionTrigger className="px-4 py-4 hover:no-underline">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Shield className="w-5 h-5" /></div>
                        <span className="font-bold text-slate-800 dark:text-slate-200">سجل العبء الوظيفي</span>
                    <span className="ml-4 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-black border">
            {counts.workloads}
        </span>
    </div>
</AccordionTrigger>
                <AccordionContent className="px-4 pb-6">
                    {/* 👇 الجدول الجديد */}
                    <TrainerWorkloadTab trainer={trainer} refreshTrigger={refreshTrigger} />
                </AccordionContent>
            </AccordionItem>
                {/* القسم 3: الحالات والإجازات */}
                <AccordionItem value="item-3" className="bg-white dark:bg-slate-900 border rounded-xl px-2 shadow-sm no-break">
                    <AccordionTrigger className="px-4 py-4 hover:no-underline">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><Calendar className="w-5 h-5" /></div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">سجل الحالات والإجازات</span>
                        <span className="ml-4 bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full text-xs font-black border border-orange-100">
            {counts.statuses}
        </span>
    </div>
</AccordionTrigger>
                    <AccordionContent className="px-4 pb-6">
                        {/* مررنا refreshTrigger لتحديث الجدول */}
                        {trainer && <TrainerStatusTab trainer={trainer} refreshTrigger={refreshTrigger} />}
                    </AccordionContent>
                </AccordionItem>

                {/* القسم 4: اللياقة والوزن */}
                <AccordionItem value="item-4" className="bg-white dark:bg-slate-900 border rounded-xl px-2 shadow-sm no-break">
                    <AccordionTrigger className="px-4 py-4 hover:no-underline">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 text-green-600 rounded-lg"><Activity className="w-5 h-5" /></div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">اللياقة البدنية والوزن</span>
                       <span className="ml-4 bg-green-50 text-green-600 px-2 py-0.5 rounded-full text-xs font-black border border-green-100">
            {counts.fitness}
        </span>
    </div>
</AccordionTrigger>
                    <AccordionContent className="px-4 pb-6">
                        {/* مررنا refreshTrigger لتحديث الجدول */}
                        <TrainerFitnessTab trainer={trainer} refreshTrigger={refreshTrigger} />
                    </AccordionContent>
                </AccordionItem>

                {/* القسم 5: التقارير */}
               {userRole !== "assistant_admin" && (
<AccordionItem value="item-5" className="bg-white dark:bg-slate-900 border rounded-xl px-2 shadow-sm no-break">
    <AccordionTrigger className="px-4 py-4 hover:no-underline">
    <div className="flex items-center gap-3">
        {/* 1. الأيقونة */}
        <div className="p-2 bg-red-100 text-red-600 rounded-lg shrink-0">
            <FileText className="w-5 h-5" />
        </div>

        {/* 2. النص والعداد بجانبه مباشرة */}
        <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 dark:text-slate-200">
                التقارير والمخالفات
            </span>
            
            {/* 3. العداد ملتصق بالنص */}
            <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-full text-[10px] font-black border border-red-100 shadow-sm min-w-[22px] text-center">
                {counts.reports || 0}
            </span>
        </div>
    </div>
</AccordionTrigger>
    <AccordionContent className="px-4 pb-6">
        {trainer && <TrainerReportsCard trainerId={trainer.id} />}
    </AccordionContent>
</AccordionItem>
)}
            </Accordion>
        </div>

        {/* 4. النوافذ المنبثقة (Modals) - تم وضعها هنا لتعمل عند ضغط الأزرار */}
        {trainer && (
            <>
                {/* نافذة إضافة الحالة (الزر البرتقالي) */}
                <AddStatusModal 
                    isOpen={isStatusModalOpen} 
                    onClose={() => setIsStatusModalOpen(false)} 
                    trainer={trainer}
                    onSuccess={() => setRefreshTrigger(prev => prev + 1)} 
                />

                {/* نافذة إضافة الاختبار (الزر الأخضر) */}
                <AddFitnessModal 
                    isOpen={isFitnessModalOpen} 
                    onClose={() => setIsFitnessModalOpen(false)} 
                    trainer={trainer}
                    onSuccess={() => setRefreshTrigger(prev => prev + 1)} 
                />
              <AddWorkloadModal 
            isOpen={isWorkloadModalOpen} 
            onClose={() => setIsWorkloadModalOpen(false)} 
            trainer={trainer}
            onSuccess={() => setRefreshTrigger(prev => prev + 1)} 
        />
    </>
)}
      </div>
    </div>
    </ProtectedRoute>
  )
}