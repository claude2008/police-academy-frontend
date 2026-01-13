"use client"

import { useState, useMemo, useEffect } from "react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Search, ChevronLeft, ChevronRight, 
  Printer, Download, User, Plus, AlertTriangle, Stethoscope, Tent, X, Dumbbell, Swords, Clock, Eye, Loader2, CalendarCheck, CheckCircle2, FileSpreadsheet, PlusCircle, Trash2,FileText, 
  UserMinus, HelpCircle, ShieldAlert
} from "lucide-react"
import { toast } from "sonner"
import { format, addDays, startOfWeek, endOfWeek, subWeeks, addWeeks, isSameDay, isFriday, parseISO, compareAsc, isValid } from "date-fns"
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
  // 👇 التعديل هنا: أضفنا "أخرى" (تفتح نص) و "استراحة" (لا تفتح نص)
  { id: "rest", label: "استراحة", color: "bg-slate-100 text-slate-700 border-slate-200", icon: HelpCircle },
  { id: "other", label: "أخرى", color: "bg-gray-200 text-gray-800 border-gray-300", icon: HelpCircle },
]

// --- 2. قائمة المخالفات (Violations) ---
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
    "أخرى" // 👈 أضفنا هذا الخيار ليظهر مربع النص عند اختياره
];

const normalizeInput = (val: string) => {
    if (!val) return "";
    return val.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
}

const differenceInDays = (d1: Date, d2: Date) => {
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// دالة مساعدة لجلب اسم اليوم بالعربي
const getDayName = (dateStr: string) => {
    const d = new Date(dateStr);
    return isValid(d) ? format(d, "EEEE", { locale: ar }) : "-";
}

// مكون شريط الإحصائيات (لإعادة استخدامه)
const StatsBar = ({ stats }: { stats: any }) => (
    <div className="flex flex-row-reverse border-2 border-[#c5b391] text-xs md:text-sm text-center font-bold mb-6 overflow-hidden rounded-md shadow-sm break-inside-avoid">
        <div className="flex-1 flex flex-col border-l border-[#c5b391]">
            <div className="bg-[#c5b391] py-1 text-black">العدد</div>
            <div className="bg-white py-2">{stats.totalStrength}</div>
        </div>
        
        <div className="flex-1 flex flex-col border-l border-[#c5b391]">
            <div className="bg-[#c5b391] py-1 text-black">طبية</div>
            <div className="bg-white py-2">{stats.hospital || "-"}</div>
        </div>
        <div className="flex-1 flex flex-col border-l border-[#c5b391]">
            <div className="bg-[#c5b391] py-1 text-black">عيادة</div>
            <div className="bg-white py-2">{stats.clinic || "-"}</div>
        </div>
        <div className="flex-1 flex flex-col border-l border-[#c5b391]">
            <div className="bg-[#c5b391] py-1 text-black">إجازة</div>
            <div className="bg-white py-2">{stats.leave || "-"}</div>
        </div>
        <div className="flex-1 flex flex-col border-l border-[#c5b391]">
            <div className="bg-[#c5b391] py-1 text-black">تأخير</div>
            <div className="bg-white py-2">{stats.late || "-"}</div>
        </div>
        <div className="flex-1 flex flex-col border-l border-[#c5b391]">
            <div className="bg-[#c5b391] py-1 text-black">غياب</div>
            <div className="bg-white py-2">{stats.absent || "-"}</div>
        </div>
        <div className="flex-1 flex flex-col border-l border-[#c5b391]">
            <div className="bg-[#c5b391] py-1 text-black">إعفاء</div>
            <div className="bg-white py-2">{stats.exempt || "-"}</div>
        </div>
        <div className="flex-1 flex flex-col border-l border-[#c5b391]">
            <div className="bg-[#c5b391] py-1 text-black">استراحة</div>
            <div className="bg-white py-2">{stats.rest || "-"}</div>
        </div>
        <div className="flex-1 flex flex-col border-l border-[#c5b391]">
            <div className="bg-[#c5b391] py-1 text-black">أخرى</div>
            <div className="bg-white py-2">{stats.other || "-"}</div>
        </div>
        <div className="flex-1 flex flex-col border-l border-[#c5b391]">
            <div className="bg-[#c5b391] py-1 text-black">الحالات</div>
            <div className="bg-white py-2">{stats.totalCases}</div>
        </div>
        <div className="flex-1 flex flex-col">
            <div className="bg-[#c5b391] py-1 text-black"> الموجود</div>
            <div className="bg-white py-2">{stats.present}</div>
        </div>
    </div>
);

 

export default function DailyCheckPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 6 })
  const weekDays = useMemo(() => Array.from({ length: 6 }).map((_, i) => addDays(weekStart, i)), [weekStart])
  const today = new Date()
   const router = useRouter() // 👈 أضف هذا
  const [viewDate, setViewDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  // البيانات
  const [soldiers, setSoldiers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [search, setSearch] = useState("")
  const [classType, setClassType] = useState("fitness") 

  // الفلاتر
  const [filterCourse, setFilterCourse] = useState("all")
  const [filterBatch, setFilterBatch] = useState("all")
  const [filterCompany, setFilterCompany] = useState("all")
  const [filterPlatoon, setFilterPlatoon] = useState("all")
  
  const [filterOptions, setFilterOptions] = useState<any>({ courses: [], batches: [], companies: [], platoons: [] })

  const [hasSearched, setHasSearched] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const [superPage, setSuperPage] = useState(1)
  const [superItemsPerPage, setSuperItemsPerPage] = useState(10)

  // النوافذ
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isManualAddOpen, setIsManualAddOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean, ids: number | number[] | null }>({ isOpen: false, ids: null })

  const [selectedCell, setSelectedCell] = useState<{ soldierId: number, dateStr: string } | null>(null)
  const [tempSelection, setTempSelection] = useState<{ type: 'status' | 'violation', value: string, isCustom: boolean } | null>(null)
  
  const [durationInput, setDurationInput] = useState("1")
  const [returnDate, setReturnDate] = useState("")
  const [customInput, setCustomInput] = useState("")
  const [lateMinutes, setLateMinutes] = useState("")
  const [isLateMode, setIsLateMode] = useState(false)

  const [manualMilId, setManualMilId] = useState("")
  const [manualDate, setManualDate] = useState(format(new Date(), "yyyy-MM-dd"))

  const [activeTab, setActiveTab] = useState("entry")
  const [currentUserMilId, setCurrentUserMilId] = useState("")
  const [userRole, setUserRole] = useState<string | null>(null); // 🔑 NEW: إضافة حالة دور المستخدم

  useEffect(() => {
      // محاولة جلب بيانات المستخدم من الذاكرة المحلية عند فتح الصفحة
      const userStr = localStorage.getItem("user"); 
      if (userStr) {
          try {
              const user = JSON.parse(userStr);
              // تأكد أن الحقل في الـ user يسمى military_id أو militaryId
              setCurrentUserMilId(user.military_id || user.militaryId || "");
              setUserRole(user.role || null); // 🔑 NEW: حفظ دور المستخدم
          } catch (e) {
              console.error("Error parsing user data");
          }
      }
  }, []);
const isSportsTrainer = useMemo(() => {
    // يمكن إضافة أدوار أخرى هنا مثل "sports_supervisor" إذا لزم الأمر
    return userRole === 'sports_trainer'; 
}, [userRole]);
  useEffect(() => {
    const fetchFilters = async () => {
        try {
            const params = new URLSearchParams()
            if (filterCourse !== 'all') params.append('course', filterCourse)
            if (filterBatch !== 'all') params.append('batch', filterBatch)
            if (filterCompany !== 'all') params.append('company', filterCompany)
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/filters-options?${params.toString()}`)
            if (res.ok) setFilterOptions(await res.json())
        } catch (e) { console.error("Filter error") }
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
          
          const startStr = format(subWeeks(weekStart, 2), "yyyy-MM-dd")
          const endStr = format(addDays(weekStart, 14), "yyyy-MM-dd")
          
          const attRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance/?class_type=${classType}&start_date=${startStr}&end_date=${endStr}`)
          const attJson = await attRes.json()

          const attendanceBySoldier: Record<number, Record<string, any[]>> = {}
          attJson.forEach((rec: any) => {
              if (!attendanceBySoldier[rec.soldier_id]) attendanceBySoldier[rec.soldier_id] = {}
              const dateKey = `${rec.soldier_id}-${rec.date}`
              if (!attendanceBySoldier[rec.soldier_id][dateKey]) attendanceBySoldier[rec.soldier_id][dateKey] = []
              attendanceBySoldier[rec.soldier_id][dateKey].push({
                  id: rec.id, type: rec.type, value: rec.value, classType: rec.class_type, custom: rec.is_custom, date: rec.date
              })
          })

          const mergedSoldiers = (soldiersJson.data || []).map((s: any) => ({
              id: s.id, militaryId: s.military_id, name: s.name, course: s.course,
              batch: s.batch, company: s.company, platoon: s.platoon,
              attendance: attendanceBySoldier[s.id] || {} 
          }))
          setSoldiers(mergedSoldiers)
      } catch (e) { toast.error("فشل جلب البيانات") }
      finally { setLoading(false) }
  }

  useEffect(() => { if (hasSearched) fetchData() }, [currentDate, classType])

  useEffect(() => {
      const targetDate = isManualAddOpen ? manualDate : selectedCell?.dateStr;
      if (targetDate && durationInput) {
          const days = parseInt(normalizeInput(durationInput)) || 1;
          const startDate = new Date(targetDate);
          const finalDate = addDays(startDate, days); 
          if (isFriday(finalDate)) setReturnDate(format(addDays(finalDate, 1), "yyyy-MM-dd"));
          else setReturnDate(format(finalDate, "yyyy-MM-dd"));
      }
  }, [durationInput, selectedCell, manualDate, isManualAddOpen])

  const handleCellClick = (soldierId: number, date: Date) => {
    setSelectedCell({ soldierId, dateStr: format(date, "yyyy-MM-dd") })
    setTempSelection(null); setCustomInput(""); setDurationInput("1"); setReturnDate(""); setIsLateMode(false); setLateMinutes("");
    setIsDialogOpen(true)
  }

  const selectOption = (type: 'status' | 'violation', value: string, isCustom = false) => {
      setTempSelection({ type, value, isCustom })
  }

  const executeSave = async (soldierId: number, startDateStr: string) => {
    if (!tempSelection) return;
    setIsSaving(true);

    let finalValue = tempSelection.value;
    // إذا كان هناك نص مكتوب في "أخرى" نأخذه، وإذا كان تأخير نأخذ الدقائق
    if (tempSelection.isCustom && customInput) finalValue = customInput;
    if (tempSelection.value === "تأخير") finalValue = `تأخير (${normalizeInput(lateMinutes)}د)`;

    const duration = parseInt(normalizeInput(durationInput)) || 1;
    const entriesToSave = [];

    // منطق تكرار السجل حسب المدة (مثلاً إجازة 5 أيام)
    if (tempSelection.type === 'status' && tempSelection.value !== 'تأخير') {
        const start = new Date(startDateStr);
        for (let i = 0; i < duration; i++) {
            const currentDay = addDays(start, i);
            
            // ✅ تم إزالة شرط "if (!isFriday)" لكي يتم احتساب كل الأيام بما فيها الجمعة
            entriesToSave.push({
                soldier_id: soldierId,
                date: format(currentDay, "yyyy-MM-dd"),
                class_type: classType,
                type: tempSelection.type,
                value: finalValue,
                is_custom: tempSelection.isCustom,
            });
        }
    } else {
        // إذا كانت مخالفة أو تأخير، تسجل ليوم واحد فقط
        entriesToSave.push({
            soldier_id: soldierId,
            date: startDateStr,
            class_type: classType,
            type: tempSelection.type,
            value: finalValue,
            is_custom: tempSelection.isCustom,
        });
    }

    try {
        // 🚀 الجزء الأهم: نستخدم fetch العادية مع الرابط الكامل
        // المفتش سيضيف (Authorization) و (Content-Type) من تلقاء نفسه
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance/bulk`, {
            method: "POST",
            body: JSON.stringify(entriesToSave)
        });

        if (res.ok) {
            toast.success("تم الحفظ بنجاح");
            setIsDialogOpen(false);
            setIsManualAddOpen(false);
            setManualMilId(""); 
            fetchData(); // تحديث الجدول فوراً لرؤية النتائج
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

  const handleManualAdd = async () => {
      if(!manualMilId) { toast.error("أدخل الرقم العسكري"); return; }
      const soldier = soldiers.find(s => s.militaryId === normalizeInput(manualMilId));
      if (!soldier) { toast.error("الرقم العسكري غير موجود في القائمة الحالية"); return; }
      executeSave(soldier.id, manualDate);
  }

  const initiateDelete = (ids: number | number[]) => { setDeleteConfirmation({ isOpen: true, ids: ids }); }

 const confirmDeleteAction = async () => {
    const { ids } = deleteConfirmation;
    if (!ids) return;

    const idList = Array.isArray(ids) ? ids : [ids];
    
    // 1. إغلاق النافذة فوراً لمنع الضغط المكرر
    setDeleteConfirmation({ isOpen: false, ids: null });

    // 2. تعريف عملية الحذف كـ الوعد (Promise)
    const deletePromise = (async () => {
        for (const id of idList) {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance/${id}`, {
                method: "DELETE",
                // المفتش (Interceptor) سيضيف التوكن هنا تلقائياً
            });
            if (!res.ok) throw new Error("فشل الحذف");
        }
    })();

    // 3. إظهار رسالة حالة للمستخدم (قفل بصري)
    toast.promise(deletePromise, {
        loading: 'جاري الحذف من قاعدة البيانات...',
        success: () => {
            fetchData(); // تحديث الجدول بعد النجاح
            return 'تم حذف السجلات بنجاح ✅';
        },
        error: 'حدث خطأ في الاتصال، يرجى المحاولة لاحقاً ❌',
    });
};

  const filteredData = useMemo(() => {
    return soldiers.filter(item => item.name.includes(search) || item.militaryId.includes(search))
  }, [soldiers, search])

  // --- 🧠 خوارزمية التجميع والتدقيق اليومي ---
  const groupedSupervisionView = useMemo(() => {
      const groups: Record<string, { soldiers: any[], cases: any[], violations: any[], stats: any }> = {};

      filteredData.forEach(soldier => {
          const groupKey = `${soldier.course || 'غير محدد'} - ${soldier.batch || 'غير محدد'}`;
          if (!groups[groupKey]) groups[groupKey] = { soldiers: [], cases: [], violations: [], stats: {} };
          groups[groupKey].soldiers.push(soldier);
      });

      Object.keys(groups).forEach(groupKey => {
          const groupSoldiers = groups[groupKey].soldiers;
          const groupCases: any[] = [];
          const groupViolations: any[] = [];

          groupSoldiers.forEach(soldier => {
              const key = `${soldier.id}-${viewDate}`;
              const todayEntries = soldier.attendance[key] || [];

              todayEntries.forEach((entry: any) => {
                  if (entry.type === 'violation') {
                      groupViolations.push({ ...soldier, statusValue: entry.value, entryId: entry.id });
                  } else {
                      let allEntries: any[] = [];
                      Object.keys(soldier.attendance).forEach(k => allEntries = [...allEntries, ...soldier.attendance[k]]);
                      allEntries.sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)));

                      let groupEnd = entry.date;
                      let duration = 1;
                      const ids = [entry.id];

                      let currentCheck = parseISO(entry.date);
                      while(true) {
                          const prevDay = subWeeks(currentCheck, 0); 
                          prevDay.setDate(prevDay.getDate() - 1);
                          const prevStr = format(prevDay, "yyyy-MM-dd");
                          const prevEntry = allEntries.find((e: any) => e.date === prevStr && e.value === entry.value && e.type === 'status');
                          if (prevEntry) {
                              duration++;
                              ids.push(prevEntry.id);
                              currentCheck = prevDay;
                          } else if (isFriday(prevDay)) {
                              currentCheck = prevDay;
                          } else {
                              break;
                          }
                      }

                      currentCheck = parseISO(entry.date);
                      while(true) {
                          const nextDay = addDays(currentCheck, 1);
                          const nextStr = format(nextDay, "yyyy-MM-dd");
                          const nextEntry = allEntries.find((e: any) => e.date === nextStr && e.value === entry.value && e.type === 'status');
                          if (nextEntry) {
                              groupEnd = nextStr;
                              duration++;
                              ids.push(nextEntry.id);
                              currentCheck = nextDay;
                          } else if (isFriday(nextDay)) {
                              currentCheck = nextDay;
                          } else {
                              break;
                          }
                      }

                      groupCases.push({ ...soldier, statusValue: entry.value, duration: duration, endDate: groupEnd, entryIds: ids });
                  }
              });
          });

          const stats = { clinic: 0, rest: 0, exempt: 0, absent: 0, late: 0, leave: 0, hospital: 0, other: 0 };
          groupCases.forEach(c => {
              const v = c.statusValue;
              if (v.includes("عيادة")) stats.clinic++;
              else if (v.includes("استراحة") || v.includes("راحة")) stats.rest++;
              else if (v.includes("إعفاء")) stats.exempt++;
              else if (v.includes("غياب")) stats.absent++;
              else if (v.includes("تأخير")) stats.late++;
              else if (v.includes("إجازة")) stats.leave++;
              else if (v.includes("مستشفى") || v.includes("طبية")) stats.hospital++;
              else stats.other++;
          });

          const totalStrength = groupSoldiers.length;
          const totalCases = Object.values(stats).reduce((a, b) => a + b, 0);
          const present = totalStrength - totalCases;

          groups[groupKey].cases = groupCases;
          groups[groupKey].violations = groupViolations;
          groups[groupKey].stats = { totalStrength, present, totalCases, ...stats };
      });

      return groups;
  }, [filteredData, viewDate]);

  // ✅ دالة التصدير (المحدثة: تدعم المخالفات في ورقة منفصلة)
  const handleExportSupervision = () => {
      const wb = XLSX.utils.book_new();
      
      // 1. ورقة الحالات
      const allCases: any[] = [];
      Object.entries(groupedSupervisionView).forEach(([groupName, data]) => {
          data.cases.forEach((item: any, index: number) => {
              allCases.push({
                  "م": index + 1, "الدورة / الدفعة": groupName, "السرية": item.company || "-", "الفصيل": item.platoon || "-",
                  "الرقم العسكري": item.militaryId, "الاسم": item.name, "الحالة": item.statusValue,
                  "المدة": `${item.duration} أيام`, "تاريخ الانتهاء": item.endDate
              });
          });
      });

      if (allCases.length > 0) {
          const wsCases = XLSX.utils.json_to_sheet(allCases);
          XLSX.utils.book_append_sheet(wb, wsCases, "سجل الحالات");
      } else {
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "ملاحظة": "لا توجد حالات" }]), "سجل الحالات");
      }

      // 2. ورقة المخالفات (المضافة)
      const allViolations: any[] = [];
      Object.entries(groupedSupervisionView).forEach(([groupName, data]) => {
          data.violations.forEach((item: any, index: number) => {
              allViolations.push({
                  "م": index + 1, "الدورة / الدفعة": groupName, "السرية": item.company || "-", "الفصيل": item.platoon || "-",
                  "الرقم العسكري": item.militaryId, "الاسم": item.name, "التاريخ": viewDate, "نوع المخالفة": item.statusValue
              });
          });
      });

      if (allViolations.length > 0) {
          const wsViolations = XLSX.utils.json_to_sheet(allViolations);
          XLSX.utils.book_append_sheet(wb, wsViolations, "سجل المخالفات");
      } else {
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "ملاحظة": "لا توجد مخالفات" }]), "سجل المخالفات");
      }

      XLSX.writeFile(wb, `الحالات اليومية بتاريخ ${viewDate}.xlsx`);
      toast.success("تم تصدير سجلات الحالات والمخالفات");
  }

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
const handlePrintPage = () => {
    // تغيير عنوان المتصفح ليصبح اسم الملف عند الحفظ
    const originalTitle = document.title;
    document.title = `التكميل اليومي ${viewDate}`;

    // تنفيذ أمر الطباعة مباشرة
    window.print();

    // إعادة العنوان الأصلي بعد الطباعة
    document.title = originalTitle;
}
// دالة تصدير كشف الإدخال الأسبوعي (المعدلة: اسم عربي)
  const handleExportExcel = () => {
    const exportData = filteredData.map(s => {
      const row: any = {
        "الرقم العسكري": s.militaryId,
        "الاسم": s.name,
        "الدورة": s.course,
        "نوع الحصة": classType === 'fitness' ? 'لياقة بدنية' : 'اشتباك ودفاع عن النفس',
      }
      weekDays.forEach(day => {
        const dateStr = format(day, "yyyy-MM-dd")
        const key = `${s.id}-${dateStr}`
        const entries = s.attendance[key] || []
        
        row[format(day, "EEEE dd/MM", { locale: ar })] = entries.length > 0 
            ? entries.map((e:any) => e.value).join("، ") 
            : "-"
      })
      return row
    })

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "التكميل الأسبوعي")
    
    // 👇 التعديل هنا: ترجمة الاسم للعربية
    const typeArabic = classType === 'fitness' ? 'لياقة_بدنية' : 'اشتباك';
    XLSX.writeFile(workbook, `تكميل_${typeArabic}_${format(weekStart, "yyyy-MM-dd")}.xlsx`)
    
    toast.success("تم تصدير ملف الإدخال")
  }
  return (
<ProtectedRoute allowedRoles={["owner"]}>
    <div className={`space-y-6 pb-20 md:pb-32 ${activeTab === 'entry' ? 'print-mode-landscape' : ''}`} dir="rtl">
      <style jsx global>{`
  @media print {
    /* الإعداد الافتراضي: بالطول (لتاب المتابعة والتدقيق) */
    @page { 
      size: portrait; 
      margin: 5mm; 
    }

    /* تعريف إعدادات "العرض" */
    @page landscape-page {
      size: landscape;
      margin: 5mm;
    }

    /* الكلاس الذي سيحول الصفحة للعرض */
    .print-mode-landscape {
      page: landscape-page;
      width: 100% !important;
    }

    /* إخفاء العناصر غير الضرورية */
    nav, aside, header, .print\:hidden, [data-sonner-toaster], .no-print { display: none !important; }
    .print\:block { display: block !important; }

    /* تنسيق الجداول */
    table { width: 100% !important; border-collapse: collapse; font-size: 10px; } 
    th, td { border: 1px solid #000 !important; padding: 2px !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @media screen {
  .only-print-content { display: none !important; } /* إخفاء نسخة الطباعة عن الشاشة */
}

@media print {
  .print\:hidden { display: none !important; } /* إخفاء أزرار الشاشة وتبويباتها */
  .only-print-content { display: block !important; } /* إظهار الجدول الكامل */
  
  /* تأكد من أن الحاوية لا تحد من الطول */
  .space-y-6 { display: block !important; height: auto !important; overflow: visible !important; }
}
  }
`}</style>
      {/* 🛑 ترويسة الطباعة الرسمية (المعدلة: تكرار + عكس الأماكن) 🛑 */}
      <div className="hidden print:flex print-header-fixed flex-row w-full items-start justify-between pb-2 mb-8">
           
           {/* 1. اليمين (في RTL): الشعار */}
           <div className="w-32 text-right p-2">
               <img src="/logo.jpg" alt="Logo" className="w-full object-contain max-h-28" />
           </div>
           
           {/* 2. الوسط: العناوين */}
           <div className="flex flex-col items-center text-center pt-2 flex-1">
               <h3 className="font-bold text-xl">معهد الشرطة</h3>
               <h3 className="font-bold text-lg mt-1">قسم التدريب العسكري والرياضي</h3>
               <h2 className="font-bold text-xl mt-2">فرع التدريب الرياضي</h2>
               
           </div>
           
           {/* 3. اليسار (في RTL): التاريخ واليوم */}
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
          {/* عنوان المسار إذا كان محدداً */}
          {(filterCourse !== 'all' || filterBatch !== 'all') && (
              <div className="text-center font-bold text-lg mb-4 border border-black p-1 inline-block mx-auto px-4">
                  {filterCourse !== 'all' ? filterCourse : ''} {filterBatch !== 'all' ? ` - ${filterBatch}` : ''} {filterCompany !== 'all' ? ` - ${filterCompany}` : ''} {filterPlatoon !== 'all' ? ` - ${filterPlatoon}` : ''}
              </div>
          )}
      

      {/* الرأس (للشاشة) */}
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full animate-in slide-in-from-bottom-4 duration-500">
            {!isSportsTrainer && (
            <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-4 mx-auto print:hidden">
                <TabsTrigger value="entry">إدخال التكميل اليومي</TabsTrigger>
                
                <TabsTrigger value="supervision" className="text-purple-700 data-[state=active]:bg-purple-100">المتابعة والتدقيق</TabsTrigger>
            
                </TabsList>
)}
            <TabsContent value="entry">
               {/* 👇 أزرار الطباعة والتصدير الخاصة بتاب الإدخال */}
                <div className="flex justify-end gap-2 mb-4 print:hidden">
                    <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2 border-green-600 text-green-700 hover:bg-green-50">
                        <FileSpreadsheet className="w-4 h-4"/> تصدير الكشف
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
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
                                        <TableHead key={day.toString()} className="text-center border border-black min-w-[120px] bg-[#c5b391] text-black">
                                            <div className="flex flex-col items-center justify-center py-1">
                                                <span className={`font-bold text-lg ${isSameDay(day, today) ? 'text-blue-800 underline' : ''}`}>{format(day, "d")}</span>
                                                <span className="text-xs">{format(day, "EEEE", { locale: ar })}</span>
                                            </div>
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {soldiers.length === 0 ? ( <TableRow><TableCell colSpan={10} className="h-24 text-center">لا توجد بيانات</TableCell></TableRow> ) : (
                                    soldiers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((soldier, index) => (
                                        <TableRow key={soldier.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <TableCell className="text-center font-mono border text-slate-500">{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
                                            <TableCell className="text-center border print:hidden">
    {/* 👇 قمت بتكبير الحجم قليلاً إلى w-8 لتكون الصورة واضحة */}
    <div className="w-8 h-8 bg-slate-200 rounded-full mx-auto flex items-center justify-center overflow-hidden">
        <img src={`${process.env.NEXT_PUBLIC_API_URL}/static/images/${soldier.militaryId}.jpg`} className="w-full h-full object-cover" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} /></div></TableCell>
                                            <TableCell className="text-center font-bold border text-xs">{soldier.militaryId}</TableCell>
                                            <TableCell className="text-center font-medium border text-xs">{soldier.name}</TableCell>
                                            {weekDays.map((day) => {
                                                const dateStr = format(day, "yyyy-MM-dd");
                                                const key = `${soldier.id}-${dateStr}`;
                                                const entries = soldier.attendance[key] || [];
                                                return (
                                                    <TableCell key={dateStr} className={`p-1 border text-center relative group align-top h-[60px] ${isSameDay(day, today) ? 'bg-blue-50/30' : ''}`}>
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
            </TabsContent>

            <TabsContent value="supervision">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 print:hidden gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-lg">لوحة تدقيق الحالات والمخالفات</h3>
                        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-md border">
                            <span className="text-xs text-slate-500 px-2">عرض ليوم:</span>
                            <Input type="date" value={viewDate} onChange={(e) => setViewDate(e.target.value)} className="h-8 w-36 bg-white border-0" />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => { setIsManualAddOpen(true); setTempSelection(null); setDurationInput("1"); setReturnDate(""); setManualMilId(""); setCustomInput(""); setManualDate(viewDate); }} className="gap-1 bg-purple-100 text-purple-700 hover:bg-purple-200"><PlusCircle className="w-4 h-4" /> إضافة حالة</Button>
                        <Button variant="outline" size="sm" onClick={handleExportSupervision} className="gap-2 border-green-600 text-green-700 hover:bg-green-50"><FileSpreadsheet className="w-4 h-4"/> تصدير Excel</Button>
                        <Button variant="outline" size="sm" onClick={handlePrintPage} className="gap-2"><Printer className="w-4 h-4"/> طباعة</Button>
                    </div>
                </div>

                <div className="space-y-8 print:block">
                    {/* التكرار لكل دورة */}
                    {Object.keys(groupedSupervisionView).length === 0 ? (
                        <div className="text-center py-12 text-slate-500 border-2 border-dashed rounded-lg">لا توجد أي بيانات مسجلة لهذا اليوم.</div>
                    ) : (
                        Object.entries(groupedSupervisionView).map(([groupName, data]) => (
                           <div key={groupName} className="mb-12 page-break-after-auto">
                                <div className="bg-slate-900 text-white p-3 rounded-t-lg font-bold text-center text-lg print:bg-black print:text-white">{groupName}</div>
                                <StatsBar stats={data.stats} />

                                <Card className="mb-6 shadow-sm border-2 border-slate-200">
                                    <div dir="rtl" className="w-full">
                                    <CardHeader className="bg-slate-50 border-b p-3"><CardTitle className="flex items-center gap-2 text-base"><CalendarCheck className="w-4 h-2" /> الحالات والإجازات</CardTitle></CardHeader></div>
                                    <CardContent className="p-0">
                                        <div dir="rtl" className="w-full">
                                            <Table className="text-right">
                                                <TableHeader className="bg-slate-100">
                                                    <TableRow>
                                                        <TableHead className="w-[50px] text-center border font-bold text-black bg-[#c5b391]">م</TableHead>
                                                        <TableHead className="text-center border font-bold text-black bg-[#c5b391]">السرية</TableHead>
                                                        <TableHead className="text-center border font-bold text-black bg-[#c5b391]">الفصيل</TableHead>
                                                        <TableHead className="text-center border font-bold text-black bg-[#c5b391]">الرقم العسكري</TableHead>
                                                        <TableHead className="text-center border font-bold text-black bg-[#c5b391]">الاسم</TableHead>
                                                        <TableHead className="text-center border font-bold text-black bg-[#c5b391]">الحالة</TableHead>
                                                        <TableHead className="text-center border font-bold text-black bg-[#c5b391]">المدة</TableHead>
                                                        <TableHead className="text-center border font-bold text-black bg-[#c5b391]">تاريخ الانتهاء</TableHead>
                                                        <TableHead className="text-center border font-bold text-black bg-[#c5b391] print:hidden">إجراء</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {data.cases.length === 0 ? ( <TableRow><TableCell colSpan={9} className="h-16 text-center text-slate-400">لا توجد حالات</TableCell></TableRow> ) : (
                                                        data.cases.map((item: any, i: number) => (
                                                            <TableRow key={i} className="hover:bg-slate-50">
                                                                <TableCell className="text-center font-mono border">{i + 1}</TableCell>
                                                                <TableCell className="text-center text-xs border">{item.company || "-"}</TableCell>
                                                                <TableCell className="text-center text-xs border">{item.platoon || "-"}</TableCell>
                                                                <TableCell className="font-bold text-xs border text-center">{item.militaryId}</TableCell>
                                                                <TableCell className="text-xs border text-center">{item.name}</TableCell>
                                                                <TableCell className="text-center border"><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold">{item.statusValue}</span></TableCell>
                                                                <TableCell className="text-center font-bold text-xs border">{item.duration} أيام</TableCell>
                                                                <TableCell className="text-center font-bold text-xs border text-red-600" dir="ltr">{item.endDate}</TableCell>
                                                                <TableCell className="text-center border print:hidden"><Button 
    variant="ghost" 
    size="sm" 
    disabled={isSaving} // منع الضغط أثناء أي عملية حفظ أخرى
    onClick={() => initiateDelete(item.entryIds || item.entryId)} 
    className="text-red-500 h-6 w-6 p-0 hover:bg-red-100 disabled:opacity-50"
>
    <X className="w-3 h-3" />
</Button></TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="shadow-sm border-2 border-red-100">
                                    <div dir="rtl" className="w-full">
                                    <CardHeader className="bg-red-50 border-b border-red-100 p-3"><CardTitle className="flex items-center gap-2 text-base text-red-800"><AlertTriangle className="w-4 h-2" /> المخالفات</CardTitle></CardHeader></div>
                                    <CardContent className="p-0">
                                        <div dir="rtl" className="w-full">
                                            <Table className="text-right">
                                                <TableHeader className="bg-slate-100">
                                                    <TableRow>
                                                        <TableHead className="w-[50px] text-center border font-bold text-black bg-[#c5b391]">م</TableHead>
                                                        <TableHead className="text-center border font-bold text-black bg-[#c5b391]">السرية</TableHead>
                                                        <TableHead className="text-center border font-bold text-black bg-[#c5b391]">الفصيل</TableHead>
                                                        <TableHead className="text-center border font-bold text-black bg-[#c5b391]">الرقم العسكري</TableHead>
                                                        <TableHead className="text-center border font-bold text-black bg-[#c5b391]">الاسم</TableHead>
                                                        <TableHead className="text-center border font-bold text-black bg-[#c5b391]">تاريخ المخالفة</TableHead>
                                                        <TableHead className="text-center border font-bold text-black bg-[#c5b391]">نوع المخالفة</TableHead>
                                                        <TableHead className="text-center border font-bold text-black bg-[#c5b391] print:hidden">إجراء</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {data.violations.length === 0 ? ( <TableRow><TableCell colSpan={8} className="h-16 text-center text-slate-400">لا توجد مخالفات</TableCell></TableRow> ) : (
                                                        data.violations.map((item: any, i: number) => (
                                                            <TableRow key={i} className="hover:bg-slate-50">
                                                                <TableCell className="text-center font-mono border">{i + 1}</TableCell>
                                                                <TableCell className="text-center text-xs border">{item.company || "-"}</TableCell>
                                                                <TableCell className="text-center text-xs border">{item.platoon || "-"}</TableCell>
                                                                <TableCell className="font-bold text-xs border text-center">{item.militaryId}</TableCell>
                                                                <TableCell className="text-xs border text-center">{item.name}</TableCell>
                                                                <TableCell className="text-center text-xs font-mono border" dir="ltr">{item.date || viewDate}</TableCell>
                                                                <TableCell className="text-center border"><span className="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold">{item.statusValue}</span></TableCell>
                                                                <TableCell className="text-center border print:hidden"><Button variant="ghost" size="sm" onClick={() => initiateDelete(item.entryId)} className="text-red-500 h-6 w-6 p-0"><X className="w-3 h-3" /></Button></TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        ))
                    )}
                </div>
            </TabsContent>
        </Tabs>
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

                        {/* 👇 التعديل الجوهري: مربع النص يظهر فقط إذا كانت الحالة "أخرى" */}
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
                        
                        {/* 👇 مربع النص للمخالفات "أخرى" */}
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

      <Dialog open={isManualAddOpen} onOpenChange={setIsManualAddOpen}>
        <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader><DialogTitle>إضافة حالة يدوياً (للمشرفين)</DialogTitle></DialogHeader>
            <div className="space-y-4">
                <div className="space-y-1"><label className="text-sm font-bold">الرقم العسكري</label><Input value={manualMilId} onChange={(e) => setManualMilId(normalizeInput(e.target.value).replace(/\D/g, ''))} placeholder="202..." className="text-center font-bold bg-slate-50" /></div>
                <div className="space-y-1"><label className="text-sm font-bold">تاريخ البداية</label><Input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} /></div>
                <Tabs defaultValue="status" className="w-full">
                    <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="status">الحالات</TabsTrigger><TabsTrigger value="violation">المخالفات</TabsTrigger></TabsList>
                    <TabsContent value="status" className="py-2 space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                            {STATUS_OPTIONS.map((opt) => ( <Button key={opt.id} variant={tempSelection?.value === opt.label ? "default" : "outline"} className={`justify-start gap-2 h-10 ${tempSelection?.value === opt.label ? 'bg-slate-900 text-white' : opt.color}`} onClick={() => { selectOption('status', opt.label); if(opt.label === 'تأخير') { setLateMinutes(""); setIsLateMode(true); } else setDurationInput("1"); }}>{tempSelection?.value === opt.label && <CheckCircle2 className="w-4 h-4 text-green-400" />}<opt.icon className="w-4 h-4" /> {opt.label}</Button> ))}
                        </div>
                        <div className="flex gap-2"><Input placeholder="حالة أخرى..." value={customInput} onChange={(e) => setCustomInput(e.target.value)} onClick={() => selectOption('status', customInput, true)} className={tempSelection?.isCustom ? "border-blue-500 ring-1 ring-blue-500" : ""} /></div>
                        {tempSelection?.type === 'status' && tempSelection.value !== 'تأخير' && ( <div className="bg-slate-50 p-2 rounded text-sm text-center text-blue-800 font-bold flex items-center justify-between px-4"><span>المدة: <Input value={durationInput} onChange={(e) => setDurationInput(normalizeInput(e.target.value).replace(/\D/g, ''))} className="w-12 h-6 inline mx-1 text-center bg-white" /> أيام</span><span>العودة: {returnDate}</span></div> )}
                    </TabsContent>
                    <TabsContent value="violation" className="py-2 space-y-4">
                        <div className="grid grid-cols-2 gap-2">{VIOLATION_OPTIONS.map((vio) => ( <Button key={vio} variant={tempSelection?.value === vio ? "default" : "outline"} className={`justify-start h-auto py-2 text-right ${tempSelection?.value === vio ? 'bg-red-700 text-white' : 'text-red-700 border-red-200'}`} onClick={() => { selectOption('violation', vio); setDurationInput("1"); }}>{tempSelection?.value === vio && <CheckCircle2 className="w-4 h-4 text-white ml-1" />}{vio}</Button> ))}</div>
                    </TabsContent>
                </Tabs>
            </div>
            <DialogFooter><Button onClick={handleManualAdd} disabled={!manualMilId || !tempSelection || isSaving} className="w-full bg-slate-900 text-white">{isSaving ? <Loader2 className="animate-spin w-4 h-4"/> : "حفظ الحالة"}</Button></DialogFooter>
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
{/* 🖨️ نسخة الطباعة الكاملة - تظهر فقط في الطباعة وفقط إذا كان تاب الإدخال نشطاً */}
{activeTab === 'entry' && (
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
)}
    </div>
</ProtectedRoute>
  )
}