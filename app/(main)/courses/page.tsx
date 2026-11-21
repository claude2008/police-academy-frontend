"use client"

import { useState, useMemo, useEffect } from "react"
import { safePrint } from "@/lib/safePrint"
import { useRouter } from "next/navigation" 
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { 
  Search, ChevronLeft, ChevronRight, 
  Printer, X, Dumbbell, Swords, Clock, Eye, Loader2, CheckCircle2, FileSpreadsheet, Trash2, 
  AlertTriangle, Stethoscope, Tent, FileText, UserMinus, HelpCircle
} from "lucide-react"
import { toast } from "sonner"
import { format, addDays, startOfWeek, endOfWeek, subWeeks, addWeeks, isSameDay, isFriday, isValid } from "date-fns"
import { ar } from "date-fns/locale"
import * as XLSX from 'xlsx'
import ProtectedRoute from "@/components/ProtectedRoute"

const STATUS_OPTIONS = [
  { id: "absent", label: "غياب", color: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle },
  { id: "exempt", label: "إعفاء", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: AlertTriangle },
  { id: "clinic", label: "عيادة", color: "bg-cyan-100 text-cyan-700 border-cyan-200", icon: Stethoscope },
  { id: "medical", label: "طبية", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Stethoscope },
  { id: "leave", label: "إجازة", color: "bg-green-100 text-green-700 border-green-200", icon: Tent },
  { id: "admin_leave", label: "إجازة إدارية", color: "bg-green-100 text-green-700 border-green-200", icon: FileText },
  { id: "death_leave", label: "إجازة وفاة", color: "bg-gray-100 text-gray-700 border-gray-200", icon: UserMinus },
  { id: "late_parade", label: "تأخير عن التكميل", color: "bg-orange-100 text-orange-700 border-orange-200", icon: Clock },
  { id: "late_class", label: "تأخير عن الحصة", color: "bg-orange-100 text-orange-700 border-orange-200", icon: Clock },
  { id: "rest", label: "استراحة", color: "bg-slate-100 text-slate-700 border-slate-200", icon: HelpCircle },
  { id: "other", label: "أخرى", color: "bg-gray-200 text-gray-800 border-gray-300", icon: HelpCircle },
]

const VIOLATION_OPTIONS = [
    "قيافة و هندام",
    "مخالفة اللبس",
    "تمرد",
    "عصيان أوامر",
    "مجادلة أو تعطيل سير الحصة",
    "الهروب من الحصة",
    "عدم إكمال الحصة",
    "ضحك",
    "تمارض",
    "تكاسل",
    "أخرى" 
];

const normalizeInput = (val: string) => {
    if (!val) return "";
    return val.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
}

const getDayName = (dateStr: string) => {
    const d = new Date(dateStr);
    return isValid(d) ? format(d, "EEEE", { locale: ar }) : "-";
}

export default function DailyCheckPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
  const weekDays = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i)), [weekStart])
  const today = new Date()
  const router = useRouter() 
  const [viewDate, setViewDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [soldiers, setSoldiers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [search, setSearch] = useState("")
  const [classType, setClassType] = useState("fitness") 

  const [filterCourse, setFilterCourse] = useState("all")
  const [filterBatch, setFilterBatch] = useState("all")
  const [filterCompany, setFilterCompany] = useState("all")
  const [filterPlatoon, setFilterPlatoon] = useState("all")
  
  const [filterOptions, setFilterOptions] = useState<any>({ courses: [], batches: [], companies: [], platoons: [] })

  const [hasSearched, setHasSearched] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean, ids: number | number[] | null }>({ isOpen: false, ids: null })

  const [selectedCell, setSelectedCell] = useState<{ soldierId: number, dateStr: string } | null>(null)
  const [tempSelection, setTempSelection] = useState<{ type: 'status' | 'violation', value: string, isCustom: boolean } | null>(null)
  
  const [durationInput, setDurationInput] = useState("1")
  const [returnDate, setReturnDate] = useState("")
  const [customInput, setCustomInput] = useState("")
  const [lateMinutes, setLateMinutes] = useState("")
  const [isLateMode, setIsLateMode] = useState(false)

  const [currentUserMilId, setCurrentUserMilId] = useState("")
  const [userRole, setUserRole] = useState<string | null>(null); 

  useEffect(() => {
      const userStr = localStorage.getItem("user"); 
      if (userStr) {
          try {
              const user = JSON.parse(userStr);
              setCurrentUserMilId(user.military_id || user.militaryId || "");
              setUserRole(user.role || null); 
          } catch (e) {
              console.error("Error parsing user data");
          }
      }
  }, []);

  useEffect(() => {
const fetchFilters = async () => {
    try {
        const params = new URLSearchParams()
        // نرسل الاختيارات الحالية للسيرفر لجلب الخيارات المتاحة لها فقط
        if (filterCourse !== 'all') params.append('course', filterCourse)
        if (filterBatch !== 'all') params.append('batch', filterBatch)
        if (filterCompany !== 'all') params.append('company', filterCompany)

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/filters-options?${params.toString()}`)
        
        if (res.ok) {
            let data = await res.json();
            
            // جلب بيانات المستخدم والنطاق (Scope)
            const user = JSON.parse(localStorage.getItem("user") || "{}");
            const scope = user?.extra_permissions?.scope;

            // 🛡️ 1. إذا كان المستخدم مقيد النطاق، نطبق الفلترة الصارمة
            if (user.role !== 'owner' && scope?.is_restricted) {
                const allowedCourses = scope.courses || []; // ["دورة الأغرار||1", "دورة الصاعقة"]
                const allowedCompanies = scope.companies || []; // ["دورة الأغرار||1->السرية الأولى"]
                const allowedPlatoons = scope.platoons || [];

                // أ. فلترة الدورات المسموحة فقط
                data.courses = data.courses.filter((c: string) => 
                    allowedCourses.some((ac: string) => ac.startsWith(c))
                );

                // ب. فلترة الدفعات: لا تظهر إلا إذا كانت الدورة + الدفعة ضمن النطاق
                if (filterCourse !== 'all') {
                    data.batches = data.batches.filter((b: string) => 
                        allowedCourses.includes(`${filterCourse}||${b}`)
                    );
                }

                // ج. فلترة السرايا والفصائل بناءً على النطاق العميق
                if (filterCourse !== 'all' && filterBatch !== 'all') {
                    const scopeKey = `${filterCourse}||${filterBatch}->`;
                    data.companies = data.companies.filter((comp: string) => 
                        allowedCompanies.includes(`${scopeKey}${comp}`)
                    );
                    data.platoons = data.platoons.filter((plat: string) => 
                        allowedPlatoons.includes(`${scopeKey}${plat}`)
                    );
                }
            }

            // ⚠️ 2. معالجة الشكل الجمالي: إذا كانت قائمة الدورات فارغة (خارج النطاق)
            // نقوم بتصفير بقية القوائم لكي لا تظهر خيارات "يتييمة" لا تتبع أي دورة
            if (data.courses.length === 0) {
                data.batches = [];
                data.companies = [];
                data.platoons = [];
            }

            setFilterOptions(data);
        }
    } catch (e) { 
        console.error("Filter error", e);
    }
}
    fetchFilters()
  }, [filterCourse, filterBatch, filterCompany])

  const fetchData = async () => {
      setLoading(true)
      try {
          const params = new URLSearchParams({ limit: "2000" })
          if (filterCourse !== 'all') params.append('course', filterCourse)
          if (filterBatch !== 'all') params.append('batch', filterBatch)
          if (filterCompany !== 'all') params.append('company', filterCompany)
          if (filterPlatoon !== 'all') params.append('platoon', filterPlatoon)
          
          const soldiersRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/?${params.toString()}`)
          const soldiersJson = await soldiersRes.json()
          
          const startStr = format(weekStart, "yyyy-MM-dd")
          const endStr = format(addDays(weekStart, 6), "yyyy-MM-dd")
          
          const attRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance/draft-list?class_type=${classType}&start_date=${startStr}&end_date=${endStr}`)
          const attJson = await attRes.json()

          const attendanceBySoldier: Record<number, Record<string, any[]>> = {}
          // داخل fetchData - السطر 135 تقريباً
attJson.forEach((rec: any) => {
    if (!attendanceBySoldier[rec.soldier_id]) attendanceBySoldier[rec.soldier_id] = {}
    const dateKey = `${rec.soldier_id}-${rec.date}`
    if (!attendanceBySoldier[rec.soldier_id][dateKey]) attendanceBySoldier[rec.soldier_id][dateKey] = []
    
    attendanceBySoldier[rec.soldier_id][dateKey].push({
        id: rec.id, 
        type: rec.type, 
        value: rec.value, 
        classType: rec.class_type, 
        custom: rec.is_custom, 
        date: rec.date,
        // 🟢 إضافة الرتبة والاسم للمدخل لضمان ظهورها في الإكسل
        writer: rec.writer_rank ? `${rec.writer_rank} / ${rec.writer_name}` : rec.writer_name 
    })
})

         const mergedSoldiers = (soldiersJson.data || []).map((s: any) => ({
    id: s.id, 
    militaryId: s.military_id, 
    name: s.name, 
    course: s.course,
    batch: s.batch, 
    company: s.company, 
    platoon: s.platoon,
    image_url: s.image_url, // 👈 إضافة الصورة هنا
    attendance: attendanceBySoldier[s.id] || {} 
})).filter((s: any) => {
    // 🛡️ تدقيق العرض: لا يعرض إلا من هم ضمن نطاق المستخدم
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const scope = user?.extra_permissions?.scope;
    if (user.role !== 'owner' && scope?.is_restricted) {
        const allowedCourses = scope.courses || [];
        const key = `${s.course}${s.batch ? `||${s.batch}` : ''}`;
        return allowedCourses.includes(key);
    }
    return true;
});
          setSoldiers(mergedSoldiers)
      } catch (e) { toast.error("فشل جلب البيانات") }
      finally { setLoading(false) }
  }

  useEffect(() => { if (hasSearched) fetchData() }, [currentDate, classType])

  useEffect(() => {
      const targetDate = selectedCell?.dateStr;
      if (targetDate && durationInput) {
          const days = parseInt(normalizeInput(durationInput)) || 1;
          const startDate = new Date(targetDate);
          const finalDate = addDays(startDate, days); 
          if (isFriday(finalDate)) setReturnDate(format(addDays(finalDate, 1), "yyyy-MM-dd"));
          else setReturnDate(format(finalDate, "yyyy-MM-dd"));
      }
  }, [durationInput, selectedCell])

  const handleCellClick = (soldierId: number, date: Date) => {
    setSelectedCell({ soldierId, dateStr: format(date, "yyyy-MM-dd") })
    setTempSelection(null); setCustomInput(""); setDurationInput("1"); setReturnDate(""); setIsLateMode(false); setLateMinutes("");
    setIsDialogOpen(true)
  }

  const selectOption = (type: 'status' | 'violation', value: string, isCustom = false) => {
      setTempSelection({ type, value, isCustom })
  }

 // ابحث عن دالة executeSave وقم بتحديثها لتصبح هكذا:
const executeSave = async (soldierId: number, startDateStr: string) => {
    if (!tempSelection) return;
    setIsSaving(true);

    let finalValue = tempSelection.value;
    if (tempSelection.isCustom && customInput) finalValue = customInput;
    if (tempSelection.value === "تأخير") finalValue = `تأخير (${normalizeInput(lateMinutes)}د)`;

    const duration = parseInt(normalizeInput(durationInput)) || 1;
    const entriesToSave = [];

    // 🟢 الإضافة الجوهرية: استخراج اسم الدورة والدفعة من الفلاتر الحالية
    // لضمان عدم تخزينها كـ null في قاعدة البيانات
    const currentCourseName = filterCourse;
    const currentBatchName = filterBatch !== 'all' ? filterBatch : "عام";

    const start = new Date(startDateStr);
    for (let i = 0; i < duration; i++) {
        const currentDay = addDays(start, i);
        entriesToSave.push({
            soldier_id: soldierId,
            date: format(currentDay, "yyyy-MM-dd"),
            class_type: classType,
            type: tempSelection.type,
            value: finalValue,
            is_custom: tempSelection.isCustom,
            // 🟢 نرسل الأسماء هنا لكي تظهر في بطاقات التدقيق
            course_name: currentCourseName,
            batch_name: currentBatchName,
            shift: "عام" 
        });
        
        // إذا كانت مخالفة أو تأخير، نحفظ يوماً واحداً فقط ولا نكرر حسب المدة
        if (tempSelection.type === 'violation' || tempSelection.value === 'تأخير') break;
    }

    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance/bulk`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}` // تأمين الطلب
            },
            body: JSON.stringify(entriesToSave)
        });

        if (res.ok) {
            toast.success("تم الحفظ بنجاح");
            setIsDialogOpen(false);
            
            fetchData(); 
        } else {
            const errorData = await res.json();
            toast.error(errorData.detail || "فشل في حفظ البيانات");
        }
    } catch(e) {
        toast.error("خطأ في الاتصال بالسيرفر");
    } finally {
        setIsSaving(false);
    }
};

  const initiateDelete = (ids: number | number[]) => { setDeleteConfirmation({ isOpen: true, ids: ids }); }

 const confirmDeleteAction = async () => {
    const { ids } = deleteConfirmation;
    if (!ids) return;

    const idList = Array.isArray(ids) ? ids : [ids];
    
    setDeleteConfirmation({ isOpen: false, ids: null });

    const deletePromise = (async () => {
        for (const id of idList) {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance/${id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("فشل الحذف");
        }
    })();

    toast.promise(deletePromise, {
        loading: 'جاري الحذف من قاعدة البيانات...',
        success: () => {
            fetchData(); 
            return 'تم حذف السجلات بنجاح ✅';
        },
        error: 'حدث خطأ في الاتصال، يرجى المحاولة لاحقاً ❌',
    });
};

  const filteredData = useMemo(() => {
    return soldiers.filter(item => item.name.includes(search) || item.militaryId.includes(search))
  }, [soldiers, search])

  const RenderPagination = ({ page, setPage, total, limit, setLimit }: any) => {
      if (total <= 0) return null;
      return (
        <div className="flex flex-col sm:flex-row items-center justify-between bg-white dark:bg-slate-900 p-4 border rounded-lg shadow-sm gap-4 mt-4 print:hidden">
            <div className="flex items-center gap-4 text-sm text-slate-500">
                <span>صفحة <b>{page}</b> من <b>{total}</b></span>
                <div className="flex items-center gap-2"><span className="text-xs">عرض:</span><Select value={String(limit)} onValueChange={(val) => { setLimit(Number(val)); setPage(1); }}><SelectTrigger className="w-[70px] h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem></SelectContent></Select></div>
            </div>
            <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setPage((p:number) => Math.max(p - 1, 1))} disabled={page === 1}><ChevronRight className="w-4 h-4 ml-1" /> السابق</Button><Button variant="outline" size="sm" onClick={() => setPage((p:number) => Math.min(p + 1, total))} disabled={page >= total}>التالي <ChevronLeft className="w-4 h-4 mr-1" /></Button></div>
        </div>
      )
  }

  const handleExportExcel = () => {
    const exportData = filteredData.map(s => {
        // 🟢 تجميع أسماء المدخلين الفريدين لهذا المجند خلال الأسبوع
        const writersSet = new Set<string>();
        
        // بناء أعمدة المعلومات الأساسية بالترتيب المطلوب
        const row: any = {
            "الدورة": s.course,
            "الدفعة": s.batch,
            "السرية": s.company || "-",
            "الفصيل": s.platoon || "-",
            "الرقم العسكري": s.militaryId,
            "الاسم": s.name,
        }

        // إضافة أعمدة الأيام (من السبت إلى الجمعة)
        weekDays.forEach(day => {
            const dateStr = format(day, "yyyy-MM-dd")
            const key = `${s.id}-${dateStr}`
            const entries = s.attendance[key] || []
            
            // استخراج القيم وجمع أسماء المدخلين في نفس الوقت
            row[format(day, "EEEE dd/MM", { locale: ar })] = entries.length > 0 
                ? entries.map((e: any) => {
                    if (e.writer) writersSet.add(e.writer); // إضافة المدخل للمجموعة
                    return e.value;
                  }).join("، ") 
                : "-"
        })

        // إضافة الأعمدة النهائية
        row["نوع الحصة"] = classType === 'fitness' ? 'لياقة بدنية' : 'اشتباك ودفاع عن النفس';
        row["مدخل البيانات"] = Array.from(writersSet).join(" | ") || "-"; // دمج أسماء المدخلين
        
        return row
    })

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "التكميل الأسبوعي")
    
    const typeArabic = classType === 'fitness' ? 'لياقة_بدنية' : 'اشتباك';
    XLSX.writeFile(workbook, `تكميل_${typeArabic}_${format(weekStart, "yyyy-MM-dd")}.xlsx`)
    
    toast.success("تم تصدير ملف الإكسل بالترتيب الجديد")
}
  return (
<ProtectedRoute allowedRoles={["owner", "manager", "admin", "assistant_admin", "sports_officer", "sports_supervisor", "military_officer", "military_supervisor"]}>
    <div className="space-y-6 pb-20 md:pb-32 print-mode-landscape" dir="rtl">
      <style jsx global>{`
  @media print {
    @page { 
      size: portrait; 
      margin: 5mm; 
    }
    @page landscape-page {
      size: landscape;
      margin: 5mm;
    }
    .print-mode-landscape {
      page: landscape-page;
      width: 100% !important;
    }
    nav, aside, header, .print\:hidden, [data-sonner-toaster], .no-print { display: none !important; }
    .print\:block { display: block !important; }
    table { width: 100% !important; border-collapse: collapse; font-size: 10px; } 
    th, td { border: 1px solid #000 !important; padding: 2px !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @media screen {
  .only-print-content { display: none !important; } 
}
@media print {
  .print\:hidden { display: none !important; } 
  .only-print-content { display: block !important; } 
  .space-y-6 { display: block !important; height: auto !important; overflow: visible !important; }
}
  }
`}</style>
      <div className="hidden print:flex print-header-fixed flex-row w-full items-start justify-between pb-2 mb-8">
           <div className="w-32 text-right p-2">
               <img src="/logo.jpg" alt="Logo" className="w-full object-contain max-h-28" />
           </div>
           <div className="flex flex-col items-center text-center pt-2 flex-1">
               <h3 className="font-bold text-xl">معهد الشرطة</h3>
               <h3 className="font-bold text-lg mt-1">قسم التدريب العسكري والرياضي</h3>
               <h2 className="font-bold text-xl mt-2">فرع التدريب الرياضي</h2>
           </div>
           <div className="flex flex-col items-end gap-1 p-2 w-32">
              <div className="flex items-center gap-2 justify-end w-full">
                  <div className="min-w-[90px] text-center border-b border-dotted border-black pb-1 font-bold">{getDayName(viewDate)}</div>
              </div>
              <div className="flex items-center gap-2 justify-end w-full">
                  <div className="min-w-[90px] text-center border-b border-dotted border-black pb-1 font-bold">{viewDate}</div>
              </div>
          </div>
      </div>
          <div className="text-center font-bold text-2xl underline mb-4"> التكميل اليومي</div>
          {(filterCourse !== 'all' || filterBatch !== 'all') && (
              <div className="text-center font-bold text-lg mb-4 border border-black p-1 inline-block mx-auto px-4">
                  {filterCourse !== 'all' ? filterCourse : ''} {filterBatch !== 'all' ? ` - ${filterBatch}` : ''} {filterCompany !== 'all' ? ` - ${filterCompany}` : ''} {filterPlatoon !== 'all' ? ` - ${filterPlatoon}` : ''}
              </div>
          )}
      

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
        <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
            <div className="w-full md:w-auto">
                <Select value={classType} onValueChange={setClassType}>
                    <SelectTrigger className={`w-full md:w-[220px] h-12 font-bold border-2 border-slate-400 text-white ${classType === 'fitness' ? 'bg-blue-700' : 'bg-red-700'}`} dir="rtl"><div className="flex items-center gap-2">{classType === 'fitness' ? <Dumbbell className="w-5 h-5 text-white" /> : <Swords className="w-5 h-5 text-white" />}<SelectValue /></div></SelectTrigger>
                    <SelectContent align="end"><SelectItem value="fitness">لياقة بدنية</SelectItem><SelectItem value="combat">اشتباك ودفاع عن النفس</SelectItem></SelectContent>
                </Select>
            </div>
            <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 p-1 rounded-lg shadow-sm border w-full md:w-auto">
                <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subWeeks(currentDate, 1))}><ChevronRight /></Button>
                <div className="text-center px-2"><span className="text-[10px] text-slate-500 block">الأسبوع الحالي</span><span className="font-bold text-sm whitespace-nowrap">{format(weekStart, "dd/MM")} - {format(endOfWeek(currentDate, { weekStartsOn: 6 }), "dd/MM")}</span></div>
                <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addWeeks(currentDate, 1))}><ChevronLeft /></Button>
            </div>
        </div>
      </div>

      <Card className="print:hidden">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
             <Select value={filterCourse} onValueChange={(val) => { setFilterCourse(val); setFilterBatch("all"); setFilterCompany("all"); setFilterPlatoon("all"); }}><SelectTrigger className="text-right" dir="rtl"><SelectValue placeholder="الدورة" /></SelectTrigger><SelectContent align="end"><SelectItem value="all">كل الدورات</SelectItem>{filterOptions.courses?.map((c:any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
             <Select value={filterBatch} onValueChange={setFilterBatch}><SelectTrigger><SelectValue placeholder="الدفعة" /></SelectTrigger><SelectContent align="end"><SelectItem value="all">كل الدفعات</SelectItem>{filterOptions.batches?.map((b:any) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select>
             <Select value={filterCompany} onValueChange={setFilterCompany}><SelectTrigger><SelectValue placeholder="السرية" /></SelectTrigger><SelectContent align="end"><SelectItem value="all">كل السرايا</SelectItem>{filterOptions.companies?.map((c:any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
             <Select value={filterPlatoon} onValueChange={setFilterPlatoon}><SelectTrigger><SelectValue placeholder="الفصيل" /></SelectTrigger><SelectContent align="end"><SelectItem value="all">كل الفصائل</SelectItem>{filterOptions.platoons?.map((p:any) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t">
             <Search className="w-5 h-5 text-slate-400" />
             <Input placeholder="بحث بالاسم أو الرقم العسكري..." className="max-w-md" value={search} onChange={(e) => setSearch(e.target.value)} />
             <div className="flex-1"></div>
             <Button onClick={() => { setHasSearched(true); fetchData(); }} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 w-32">{loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Eye className="w-4 h-4" />} عرض</Button>
          </div>
        </CardContent>
      </Card>

      {hasSearched && (
            <div className="animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-end gap-2 mb-4 print:hidden">
                    <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2 border-green-600 text-green-700 hover:bg-green-50">
                        <FileSpreadsheet className="w-4 h-4"/> تصدير الكشف
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => safePrint()} className="gap-2">
                        <Printer className="w-4 h-4"/> طباعة الكشف
                    </Button>
                </div> 
                <div className="border rounded-lg bg-white dark:bg-slate-900 overflow-hidden shadow-sm overflow-x-auto print:hidden">
                    <div dir="rtl" className="w-full">
                        <Table>
                            <TableHeader className="bg-slate-100 dark:bg-slate-800">
                                <TableRow>
                                    <TableHead className="text-center w-[50px] bg-[#c5b391] text-black border">#</TableHead>
                                    <TableHead className="text-center w-[60px] bg-[#c5b391] text-black border print:hidden">الصورة</TableHead>
                                    <TableHead className="text-center w-[120px] font-bold bg-[#c5b391] text-black border">الرقم العسكري</TableHead>
                                    <TableHead className="text-center w-[180px] font-bold bg-[#c5b391] text-black border">الاسم</TableHead>
                                    {weekDays.map((day) => (
                                        <TableHead 
                                            key={day.toString()} 
                                            className={`text-center border border-black min-w-[120px] bg-[#c5b391] text-black ${
                                                // 🟢 تظليل السبت والجمعة (اللون الداكن قليلاً)
                                                (isSameDay(day, weekStart) || isFriday(day)) ? 'bg-[#b0a080]' : ''
                                            }`}
                                        >
                                            <div className="flex flex-col items-center justify-center py-1">
                                                <span className={`font-bold text-lg ${isSameDay(day, today) ? 'text-blue-800 underline' : ''}`}>{format(day, "d")}</span>
                                                <span className="text-xs">{format(day, "EEEE", { locale: ar })}</span>
                                            </div>
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {soldiers.length === 0 ? ( <TableRow><TableCell colSpan={11} className="h-24 text-center">لا توجد بيانات</TableCell></TableRow> ) : (
                                    soldiers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((soldier, index) => (
                                        <TableRow key={soldier.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <TableCell className="text-center font-mono border text-slate-500">{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
                                            <TableCell className="text-center border print:hidden">
    <div className="w-10 h-10 bg-slate-100 rounded-full mx-auto flex items-center justify-center overflow-hidden border border-slate-200">
        <img 
            src={soldier.image_url ? `${soldier.image_url}?t=${new Date().getTime()}` : "/placeholder-user.png"} 
            alt="Soldier" 
            className="w-full h-full object-cover"
            onError={(e) => { 
                (e.target as HTMLImageElement).src = "/placeholder-user.png";
            }}
        />
    </div>
</TableCell>
                                            <TableCell className="text-center font-bold border text-xs">{soldier.militaryId}</TableCell>
                                            <TableCell className="text-center font-medium border text-xs">{soldier.name}</TableCell>
                                            {weekDays.map((day) => {
                                                const dateStr = format(day, "yyyy-MM-dd");
                                                const key = `${soldier.id}-${dateStr}`;
                                                const entries = soldier.attendance[key] || [];
                                                // 🟢 تظليل الخلايا أيضاً
                                                const isWeekend = isSameDay(day, weekStart) || isFriday(day);
                                                
                                                return (
                                                    <TableCell 
                                                        key={dateStr} 
                                                        className={`p-1 border text-center relative group align-top h-[60px] ${isSameDay(day, today) ? 'bg-blue-50/30' : (isWeekend ? 'bg-slate-100/50' : '')}`}
                                                    >
                                                        <div className="flex flex-wrap gap-1 justify-center">
                                                            {entries.map((entry: any) => (
                                                                <div key={entry.id} className={`relative px-1 py-0.5 rounded text-[9px] font-bold border flex items-center gap-1 ${entry.type === 'violation' ? 'bg-red-50 text-red-700 border-red-200' : STATUS_OPTIONS.find(o => o.label === entry.value)?.color || 'bg-gray-100'}`}>
                                                                    <button onClick={(e) => { e.stopPropagation(); initiateDelete(entry.id); }} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-3 h-3 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-2 h-2" /></button>
                                                                    {entry.type === 'violation' && <AlertTriangle className="w-2.5 h-2.5" />}
                                                                    <span className="truncate max-w-[80px]">{entry.value}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <button onClick={() => handleCellClick(soldier.id, day)} className="absolute bottom-0 right-0 m-1 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600 text-white rounded w-4 h-4 flex items-center justify-center shadow-sm hover:bg-blue-700 z-10"><Plus className="w-3 h-3" /></button>
                                                    </TableCell>
                                                )
                                            })}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
                <RenderPagination page={currentPage} setPage={setCurrentPage} total={Math.ceil(soldiers.length / itemsPerPage)} limit={itemsPerPage} setLimit={setItemsPerPage} />
            </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
                <DialogTitle>{classType === 'fitness' ? 'تكميل اللياقة' : 'تكميل الاشتباك'}</DialogTitle>
                <p className="text-sm text-slate-500">{selectedCell && format(new Date(selectedCell.dateStr), "EEEE d MMMM", { locale: ar })}</p>
            </DialogHeader>
            {!isLateMode ? (
                <Tabs defaultValue="status" className="w-full">
                    <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="status">الحالات</TabsTrigger><TabsTrigger value="violation" className="text-red-600">المخالفات</TabsTrigger></TabsList>
                    <TabsContent value="status" className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-2">
                            {STATUS_OPTIONS.map((opt) => ( 
                                <Button 
                                    key={opt.id} 
                                    variant={tempSelection?.value === opt.label ? "default" : "outline"} 
                                    className={`justify-start gap-2 h-10 ${tempSelection?.value === opt.label ? 'bg-slate-900 text-white' : opt.color}`} 
                                    onClick={() => { 
                                        selectOption('status', opt.label); 
                                        if(opt.label.includes('تأخير')) { setLateMinutes(""); setIsLateMode(true); } 
                                        else setDurationInput("1"); 
                                    }}
                                >
                                    {tempSelection?.value === opt.label && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                                    <opt.icon className="w-4 h-4" /> {opt.label}
                                </Button> 
                            ))}
                        </div>

                        {tempSelection?.value === "أخرى" && (
                            <div className="animate-in fade-in slide-in-from-top-1">
                                <label className="text-sm font-bold block mb-1">وضّح الحالة:</label>
                                <Input 
                                    placeholder="اكتب التفاصيل هنا..." 
                                    value={customInput} 
                                    onChange={(e) => setCustomInput(e.target.value)} 
                                    className="border-blue-500 ring-1 ring-blue-500" 
                                />
                            </div>
                        )}

                        {tempSelection?.type === 'status' && !tempSelection.value.includes('تأخير') && ( 
                            <div className="bg-slate-50 p-3 rounded-lg border space-y-3 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold w-20">المدة (يوم):</span>
                                    <Input type="text" value={durationInput} onChange={(e) => setDurationInput(normalizeInput(e.target.value).replace(/\D/g, ''))} className="h-8 text-center font-bold bg-white" />
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-slate-500 w-20">تاريخ العودة:</span>
                                    <span className="font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">{returnDate || "-"}</span>
                                </div>
                            </div> 
                        )}
                    </TabsContent>
                    <TabsContent value="violation" className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-2">
                            {VIOLATION_OPTIONS.map((vio) => ( 
                                <Button key={vio} variant={tempSelection?.value === vio ? "default" : "outline"} className={`justify-start h-auto py-2 text-right ${tempSelection?.value === vio ? 'bg-red-700 text-white' : 'text-red-700 border-red-200'}`} onClick={() => { selectOption('violation', vio); setDurationInput("1"); }}>
                                    {tempSelection?.value === vio && <CheckCircle2 className="w-4 h-4 text-white ml-1" />}{vio}
                                </Button> 
                            ))}
                        </div>
                        
                        {tempSelection?.value === "أخرى" && (
                            <div className="animate-in fade-in slide-in-from-top-1">
                                <label className="text-sm font-bold block mb-1">وضّح المخالفة:</label>
                                <Input 
                                    placeholder="اكتب تفاصيل المخالفة..." 
                                    value={customInput} 
                                    onChange={(e) => setCustomInput(e.target.value)} 
                                    className="border-red-500 ring-1 ring-red-500" 
                                />
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            ) : (
                <div className="space-y-4 py-4">
                    <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg text-center"><Clock className="w-8 h-8 text-orange-500 mx-auto mb-2" /><h3 className="text-orange-700 font-bold">تسجيل تأخير</h3><p className="text-xs text-orange-600">يرجى تحديد مدة التأخير بالدقائق</p></div>
                    <div className="flex items-center gap-2"><Input type="text" placeholder="المدة (دقيقة)" value={lateMinutes} onChange={(e) => setLateMinutes(normalizeInput(e.target.value).replace(/\D/g, ''))} className="text-center text-lg font-bold" autoFocus /><span className="text-sm font-bold text-slate-500">دقيقة</span></div>
                    <div className="flex gap-2"><Button variant="outline" onClick={() => { setIsLateMode(false); setTempSelection(null); }} className="flex-1">رجوع</Button><Button onClick={() => { selectOption('status', 'تأخير'); executeSave(selectedCell!.soldierId, selectedCell!.dateStr); }} disabled={!lateMinutes || isSaving} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white">{isSaving ? <Loader2 className="animate-spin w-4 h-4"/> : "تأكيد"}</Button></div>
                </div>
            )}
            {!isLateMode && ( <DialogFooter className="flex gap-2"><Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">إلغاء</Button><Button onClick={() => executeSave(selectedCell!.soldierId, selectedCell!.dateStr)} disabled={!tempSelection || isSaving} className="flex-1 bg-green-600 hover:bg-green-700 text-white">{isSaving ? <Loader2 className="animate-spin w-4 h-4"/> : "تأكيد وحفظ"}</Button></DialogFooter> )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmation.isOpen} onOpenChange={(open) => !open && setDeleteConfirmation({ isOpen: false, ids: null })}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2"><Trash2 className="w-5 h-5" /> تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد أنك تريد حذف هذا السجل نهائياً؟<br />في حالة المجموعات، سيتم حذف جميع الأيام المرتبطة.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAction} className="bg-red-600 hover:bg-red-700 text-white">نعم، احذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    <div className="hidden print:block only-print-content print-mode-landscape w-full">
        <Table className="border-collapse border border-black w-full">
            <TableHeader>
                <TableRow className="bg-[#c5b391]">
                    <TableHead className="border border-black text-center text-black font-bold">#</TableHead>
                    <TableHead className="border border-black text-center text-black font-bold">الرقم العسكري</TableHead>
                    <TableHead className="border border-black text-center text-black font-bold">الاسم</TableHead>
                    {weekDays.map((day) => (
                        <TableHead key={day.toString()} className="border border-black text-center text-black font-bold">
                            {format(day, "EEEE dd/MM", { locale: ar })}
                        </TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {filteredData.map((soldier, index) => (
                    <TableRow key={soldier.id}>
                        <TableCell className="border border-black text-center p-1">{index + 1}</TableCell>
                        <TableCell className="border border-black text-center p-1 font-bold">{soldier.militaryId}</TableCell>
                        <TableCell className="border border-black text-right p-1 px-2 text-xs">{soldier.name}</TableCell>
                        {weekDays.map((day) => {
                            const dateStr = format(day, "yyyy-MM-dd");
                            const key = `${soldier.id}-${dateStr}`;
                            const entries = soldier.attendance[key] || [];
                            return (
                                <TableCell key={dateStr} className="border border-black text-center p-1 text-[10px]">
                                    {entries.map((e: any) => e.value).join("، ") || "-"}
                                </TableCell>
                            );
                        })}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
    </div>
</ProtectedRoute>
  )
}

// Imports for Tabs required inside dialog, added locally to avoid errors if Tabs were removed globally
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus } from "lucide-react"