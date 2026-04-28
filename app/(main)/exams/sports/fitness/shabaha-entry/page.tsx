"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Card, CardContent } from "@/components/ui/card"
// أضف AlertTriangle هنا
import { 
  Search, Shirt, Printer, Download, FileText, Plus, Eye, RefreshCw, AlertTriangle, Trash2 
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import * as XLSX from 'xlsx'
import ProtectedRoute from "@/components/ProtectedRoute"
// --- الألوان المتاحة ---
const SHABAHA_COLORS = [
  { name: "أحمر", value: "red", hex: "#ef4444" },
  { name: "أصفر", value: "yellow", hex: "#eab308" },
  { name: "أزرق", value: "blue", hex: "#3b82f6" },
  { name: "أخضر", value: "green", hex: "#22c55e" },
  { name: "بنفسجي", value: "purple", hex: "#a855f7" },
  { name: "برتقالي", value: "orange", hex: "#f97316" },
  { name: "رمادي", value: "gray", hex: "#6b7280" },
  { name: "وردي", value: "pink", hex: "#ec4899" },
]

export default function ShabahaEntryPage() {
  // --- States ---
  const [soldiers, setSoldiers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [userRole, setUserRole] = useState("")
  const [isOnline, setIsOnline] = useState(true)
  // الفلاتر
  const [filters, setFilters] = useState({
      course: "",
      batch: "",
      company: "",
      platoon: ""
  })
  
  // خيارات القوائم
  const [options, setOptions] = useState({
      courses: [] as string[],
      batches: [] as string[],
      companies: [] as string[],
      platoons: [] as string[]
  })

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50) // 🟢 القيمة الافتراضية
  const [totalItems, setTotalItems] = useState(0)
  const [assignmentsMap, setAssignmentsMap] = useState<any>({});
  // Note Modal
  const [isNoteOpen, setIsNoteOpen] = useState(false)
  const [currentNoteId, setCurrentNoteId] = useState<number | null>(null)
  const [tempNote, setTempNote] = useState("")
const [isConfirmOpen, setIsConfirmOpen] = useState(false);
// استبدل السطر القديم بهذا
const [resetTarget, setResetTarget] = useState<'shabaha' | 'chip' | 'notes' | null>(null);
  // --- 1. جلب خيارات الفلاتر ---
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => {
        setIsOnline(true)
        toast.success("عاد الاتصال بالإنترنت ✅ يمكنك المتابعة")
    }
    const handleOffline = () => {
        setIsOnline(false)
        toast.error("انقطع الاتصال بالإنترنت! ⚠️ أي بيانات تدخلها لن تُحفظ", { duration: Infinity })
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
    }
}, [])
  
  useEffect(() => {
      fetchFilterOptions()
  }, [filters.course, filters.batch, filters.company])

const fetchFilterOptions = async () => {
    try {
        const token = localStorage.getItem("token");
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const scope = user?.extra_permissions?.scope;
        const isRestricted = user.role !== 'owner' && scope?.is_restricted;
        const userCourses = scope?.courses || [];

        // 🛑 نقطة التفتيش الصارمة (Kill Switch) للمستخدم المخفي كلياً
        if (isRestricted && userCourses.length === 0) {
            setOptions({ courses: [], batches: [], companies: [], platoons: [] });
            return; // توقف هنا ولا تطلب بيانات من السيرفر
        }

        // --- استبدل بناء الرابط (query) بهذا المنطق الذكي ---
const query = new URLSearchParams()
if (filters.course && filters.course !== "all") query.append("course", filters.course)

// 🧼 توحيد إرسال الدفعة للباك إند
if (filters.batch && filters.batch !== "all") {
    query.append("batch", filters.batch === "لا يوجد" ? "None" : filters.batch)
}

if (filters.company && filters.company !== "all") {
    query.append("company", filters.company === "لا يوجد" ? "None" : filters.company)
}
        
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/filters-options?${query.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })

        if (res.ok) {
            let data = await res.json();

            // 🛡️ تصفية الخيارات بناءً على ما هو مسموح في النطاق
            if (isRestricted) {
                // 1. تصفية الدورات
                const allowedCourseNames = userCourses.map((key: string) => key.split('||')[0]);
                data.courses = (data.courses || []).filter((c: string) => allowedCourseNames.includes(c));

                // 2. تصفية الدفعات
                data.batches = (data.batches || []).filter((b: string) => 
                    userCourses.some((key: string) => key.endsWith(`||${b}`))
                );

                // 3. تصفية السرايا والفصائل بناءً على المسار المختار حالياً
                if (filters.course && filters.batch) {
                    const currentPath = `${filters.course}||${filters.batch}->`;
                    const allowedComps = scope?.companies || [];
                    const allowedPlats = scope?.platoons || [];

                    data.companies = (data.companies || []).filter((c: string) => 
                        allowedComps.includes(`${currentPath}${c}`)
                    );
                    data.platoons = (data.platoons || []).filter((p: string) => 
                        allowedPlats.includes(`${currentPath}${p}`)
                    );
                }
            }

            setOptions({
                courses: data.courses || [],
                batches: data.batches || [],
                companies: data.companies || [],
                platoons: data.platoons || []
            })
        }
    } catch (e) { console.error("Error fetching filters", e) }
}
 const fetchSoldiers = async () => {
    setIsLoading(true)
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const scope = user?.extra_permissions?.scope;

    try {
        // 1. 🧼 توحيد الفلاتر قبل إرسالها للسيرفر (تحويل "لا يوجد" إلى "None" ليفهمها الباك إند)
        const queryParams = {
            skip: ((currentPage - 1) * itemsPerPage).toString(),
            limit: itemsPerPage.toString(),
            course: filters.course,
            // إذا اختار المستخدم "لا يوجد"، نرسل كلمة "None" للسيرفر ليبحث عن الـ NULL
            batch: (filters.batch === "لا يوجد" || !filters.batch) ? "None" : filters.batch,
            company: (filters.company === "لا يوجد" || !filters.company) ? "None" : filters.company,
            platoon: (filters.platoon === "لا يوجد" || !filters.platoon) ? "None" : filters.platoon,
            search: search
        };

        const query = new URLSearchParams(queryParams);

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/?${query.toString()}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
        
        if (res.ok) {
            const data = await res.json()
            let rawList = data.data || [];

            // 🛡️ 2. [تصفية أمنية ذكية] تضمن توافق المفاتيح مع الـ JSON الخاص بالصلاحيات
            if (user.role !== 'owner' && scope?.is_restricted) {
                const allowedCourses = scope.courses || [];
                
                rawList = rawList.filter((s: any) => {
                    // توحيد مسمى الدفعة للجندي القادم من السيرفر للمطابقة مع الصلاحيات
                    const sBatch = (s.batch && s.batch !== "None" && s.batch !== "") ? s.batch : "لا يوجد";
                    
                    // بناء المفتاح كما هو متوقع في الـ Scope (مثلاً: دورة غطس||لا يوجد)
                    const courseKey = `${s.course}||${sBatch}`;
                    
                    // السماح إذا كان المفتاح بالدفعة موجود، أو اسم الدورة فقط موجود
                    return allowedCourses.includes(courseKey) || allowedCourses.includes(s.course);
                });
            }

            setSoldiers(rawList)
            setTotalItems(data.total)
        }
    } catch (e) { 
        toast.error("فشل جلب البيانات") 
    } finally { 
        setIsLoading(false) 
    }
}

// هذه الدالة ستُستدعى عند ضغط الزر الأحمر
const openConfirmDialog = (target: 'shabaha' | 'chip' | 'notes') => {
    setResetTarget(target);
    setIsConfirmOpen(true);
};

// هذه الدالة هي التي تنفذ المسح فعلياً بعد الضغط على "تأكيد" في النافذة الجميلة
const executeBulkReset = async () => {
    if (!resetTarget) return;

    setIsLoading(true);
    setIsConfirmOpen(false); // إغلاق النافذة فوراً

    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/assignments/bulk-reset`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                course: filters.course,
                batch: filters.batch,
                company: filters.company,
                platoon: filters.platoon,
                target: resetTarget 
            })
        });

        if (res.ok) {
            toast.success("تم تصفير البيانات بنجاح ✅");
            await fetchAssignments(); 
            await fetchSoldiers();
        } else {
            toast.error("فشل في عملية المسح");
        }
    } catch (e) {
        toast.error("خطأ في الاتصال بالسيرفر");
    } finally {
        setIsLoading(false);
        setResetTarget(null);
    }
};

const fetchAssignments = async () => {
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/assignments/list`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
            const data = await res.json();
            setAssignmentsMap(data); // البيانات ستكون على شكل { soldier_id: {shabaha_number: '1', ...} }
        }
    } catch (e) {
        console.error("خطأ في جلب بيانات التوزيع", e);
    }
};
useEffect(() => {
    const userData = localStorage.getItem("user")
    if (userData) {
        try { 
            const parsedUser = JSON.parse(userData);
            setDisplayName(parsedUser.name || "غير معروف");
            setUserRole(parsedUser.role || ""); // 🆕 جلب الرتبة الحقيقية (owner, manager... إلخ)
        } catch (e) {}
    }
    fetchAssignments();
}, []);
// استدعاء الدالة عند تحميل الصفحة
useEffect(() => {
    fetchAssignments();
}, []);

  // إعادة البحث عند تغيير الصفحة أو عدد الصفوف
  useEffect(() => {
      if (filters.course && !isSearchDisabled) fetchSoldiers()
  }, [currentPage, itemsPerPage])

  // --- 3. التحقق المنطقي الصارم للفلاتر ---
  const isSearchDisabled = useMemo(() => {
      // 1. الدورة إلزامية
      if (!filters.course || filters.course === "all") return true;

      // 2. إذا كانت هناك دفعات متاحة، يجب اختيار دفعة
      if (options.batches.length > 0 && (!filters.batch || filters.batch === "all")) return true;

      // 3. إذا كانت هناك سرايا متاحة، يجب اختيار سرية
      if (options.companies.length > 0 && (!filters.company || filters.company === "all")) return true;

      // 4. إذا كانت هناك فصائل متاحة، يجب اختيار فصيل
      if (options.platoons.length > 0 && (!filters.platoon || filters.platoon === "all")) return true;

      return false;
  }, [filters, options]);


 // --- 4. الحفظ عند الخروج من الحقل (onBlur) ---
 const handleSaveCell = async (id: number, field: string, value: string) => {
      if (!value || value.trim() === "" || value === "clear_value") {
          setSoldiers(prev => prev.map(s => s.id === id ? { ...s, [field]: "" } : s));
          await executeSave(id, field, ""); 
          return;
      }

      if (field !== 'notes') {
          const soldier = soldiers.find(s => s.id === id);
          const saved = assignmentsMap[id] || {};

          // الرقم والاللون بعد التعديل الحالي
          const newShabaha = field === 'shabaha_number' ? value : (soldier?.shabaha_number ?? saved.shabaha_number ?? "");
          const newColor   = field === 'shabaha_color'  ? value : (soldier?.shabaha_color  ?? saved.shabaha_color  ?? "");

          // ✅ التحقق فقط إذا كان الرقم واللون موجودَين معاً
          if (newShabaha && newColor && newColor !== "clear_value") {
              const isValid = await checkAvailability(id, field, value);
              if (!isValid) {
                  setSoldiers(prev => prev.map(s => s.id === id ? { ...s, [field]: "" } : s));
                  return;
              }
          }
      }

      await executeSave(id, field, value);
  };

// دالة مساعدة لتنفيذ طلب الحفظ الفعلي
// دالة مساعدة لتنفيذ طلب الحفظ الفعلي
const executeSave = async (id: number, field: string, value: string) => {
    try {
        const payload = { soldier_id: id, [field]: value };
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/assignments/save`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(payload)
        });
        
        // 🟢 الحل هنا: يجب تحديث الخريطة فوراً بعد الحفظ لكي تبقى البيانات ظاهرة
        await fetchAssignments(); 

        if (res.ok && field === 'notes') {
            toast.success("تم حفظ الملاحظة");
        }
    } catch (e) {
        toast.error("خطأ في الاتصال بالسيرفر");
    }
};

  // التحقق من التكرار
  const checkAvailability = async (id: number, field: string, value: string, color?: string) => {
      // لا نتحقق إذا كانت القيمة فارغة
      if (!value) return true

      const soldier = soldiers.find(s => s.id === id)
      if (!soldier) return true

      const checkData = {
          shabaha_number: field === 'shabaha_number' ? value : soldier.shabaha_number,
          shabaha_color: field === 'shabaha_color' ? value : (color || soldier.shabaha_color),
          chip_number: field === 'chip_number' ? value : soldier.chip_number,
          exclude_soldier_id: id
      }

      try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/assignments/check`, {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify(checkData)
          })
          const result = await res.json()
          
          if (result.status === 'taken') {
              toast.error("تنبيه تكرار!", {
                  description: result.messages.join("\n"),
                  duration: 4000,
                  className: "bg-red-50 border-red-200 text-red-800"
              })
              return false
          }
          return true
      } catch (e) { return true }
  }

  // تحديث الحالة المحلية فقط (للعرض أثناء الكتابة)
  const handleLocalChange = (id: number, field: string, value: string) => {
      setSoldiers(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }
// دالة لتوليد الاسم الديناميكي
const generateFileName = (ext: string) => {
  // 🧼 تأمين الفلاتر لضمان عدم حدوث خطأ replace إذا كانت القيمة null
  const course = (filters.course || "دورة").replace(/ /g, "_");
  const batch = (filters.batch || "بدون_دفعة").replace(/ /g, "_");
  const company = (filters.company || "بدون_سرية").replace(/ /g, "_");
  const platoon = (filters.platoon || "بدون_فصيل").replace(/ /g, "_");

  const path = `${course}_${batch}_${company}_${platoon}`;
  const date = format(new Date(), "yyyy-MM-dd");
  return `كشف_الشباحات_${path}_${date}.${ext}`;
}
// استخدامها في الطباعة (توسيع الجدول ليشمل الكل ثم الطباعة)
// استخدامها في الطباعة (جلب كل البيانات ثم الطباعة)
const handlePrintPDF = async () => {
  const originalLimit = itemsPerPage; // حفظ العدد الحالي للصفوف
  const originalSkip = (currentPage - 1) * itemsPerPage; // حفظ الصفحة الحالية

  setIsLoading(true); // تشغيل مؤشر التحميل

  try {
    // 1. جلب كافة البيانات من السيرفر دفعة واحدة (limit = totalItems)
    const query = new URLSearchParams({
        skip: "0", 
        limit: totalItems.toString(), // طلب كل العدد الموجود
        course: filters.course,
        batch: filters.batch || "all",
        company: filters.company || "all",
        platoon: filters.platoon || "all",
        search: search
    });

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/?${query.toString()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (res.ok) {
        const data = await res.json();
        setSoldiers(data.data); // تحديث الجدول بكل الجنود
        setItemsPerPage(data.total); // توسيع الصفحة لتشمل الكل
        
        // 2. الانتظار قليلاً حتى يرسم المتصفح الجدول الجديد ثم الطباعة
        setTimeout(() => {
            document.title = generateFileName("pdf").replace(".pdf", "");
            window.print();
            
            // 3. العودة للوضع الطبيعي بعد إغلاق نافذة الطباعة (أو بعد الطباعة مباشرة)
            // سنعيد استدعاء الدالة الأصلية لتعيد الـ 10 صفوف فقط
            setItemsPerPage(originalLimit);
            setCurrentPage(1); // نعود للصفحة الأولى
            // ملاحظة: سيتم تحديث الجدول تلقائياً بسبب useEffect الذي يراقب itemsPerPage
        }, 1000); // زيادة الوقت قليلاً لضمان تحميل الصور/البيانات
    }
  } catch (e) {
      toast.error("حدث خطأ أثناء تحضير الطباعة");
  } finally {
      setIsLoading(false);
  }
}

 const handleExportExcel = async () => {
    // 1. فحص أمان: هل اختار المستخدم مساراً؟
    if (isSearchDisabled) {
        toast.warning("يرجى اختيار الدورة والمسار كاملاً قبل التصدير");
        return;
    }

    setIsLoading(true);
    const toastId = toast.loading("جاري تحضير ملف الإكسل لكامل المسار...");

    try {
        // 2. جلب "كافة" الجنود في هذا المسار بدون تقيد بالصفحة (Limit = totalItems)
        const query = new URLSearchParams({
            skip: "0",
            limit: totalItems.toString(), // نجلب الجميع
            course: filters.course,
            batch: filters.batch || "all",
            company: filters.company || "all",
            platoon: filters.platoon || "all",
            search: search // لكي يحترم البحث إذا كان المستخدم يبحث عن اسم معين
        });

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/?${query.toString()}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (res.ok) {
            const result = await res.json();
            const allSoldiers = result.data || [];

            // 3. تحويل البيانات للصيغة المطلوبة للإكسل (باستخدام القائمة الكاملة)
            const exportData = allSoldiers.map((s: any, index: number) => {
                const saved = assignmentsMap[s.id] || {};
                return {
                    "م": index + 1,
                    "الرقم العسكري": s.military_id,
                    "الاسم": s.name,
                    "الرتبة": s.rank || "-",
                    "الدورة": s.course,
                    "الدفعة": s.batch || "-",
                    "السرية": s.company || "-",
                    "الفصيل": s.platoon || "-",
                    "رقم الشباحة": saved.shabaha_number || "",
                    "اللون": SHABAHA_COLORS.find(c => c.value === saved.shabaha_color)?.name || "",
                    "رقم الشريحة": saved.chip_number || "",
                    "الملاحظات": saved.notes || "",
                    "تاريخ الاستخراج": format(new Date(), "yyyy-MM-dd HH:mm")
                };
            });

            // 4. بناء ملف الإكسل وتنزيله
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "كشف الشباحات الكامل");
            
            // ضبط اتجاه الورقة للعربية (RTL)
            if (!wb.Workbook) wb.Workbook = {};
            if (!wb.Workbook.Views) wb.Workbook.Views = [];
            if (wb.Workbook.Views.length === 0) wb.Workbook.Views.push({});
            wb.Workbook.Views[0].RTL = true;

            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
const blob = new Blob([wbout], { type: 'application/octet-stream' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = generateFileName("xlsx");
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
setTimeout(() => URL.revokeObjectURL(url), 1000);
            toast.success("تم تصدير الكشف الكامل بنجاح ✅", { id: toastId });
        } else {
            toast.error("فشل جلب البيانات من الخادم", { id: toastId });
        }
    } catch (e) {
        console.error(e);
        toast.error("حدث خطأ تقني أثناء التصدير", { id: toastId });
    } finally {
        setIsLoading(false);
    }
};
const handleExportAllExcel = async () => {
    if (!filters.course) {
        toast.warning("يرجى اختيار الدورة أولاً");
        return;
    }

    setIsLoading(true);
    const toastId = toast.loading(`جاري تحضير كشف كامل لدورة: ${filters.course}...`);

    try {
        // جلب كل الجنود في الدورة بدون أي فلتر آخر
        const query = new URLSearchParams({
            skip: "0",
            limit: "9999",
            course: filters.course,
        });

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/?${query.toString()}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (res.ok) {
            const result = await res.json();
            const allSoldiers = result.data || [];

            const exportData = allSoldiers.map((s: any, index: number) => {
                const saved = assignmentsMap[s.id] || {};
                return {
                    "م": index + 1,
                    "الرقم العسكري": s.military_id,
                    "الاسم": s.name,
                    "الرتبة": s.rank || "-",
                    "الدورة": s.course,
                    "الدفعة": s.batch || "-",
                    "السرية": s.company || "-",
                    "الفصيل": s.platoon || "-",
                    "رقم الشباحة": saved.shabaha_number || "",
                    "اللون": SHABAHA_COLORS.find(c => c.value === saved.shabaha_color)?.name || "",
                    "رقم الشريحة": saved.chip_number || "",
                    "الملاحظات": saved.notes || "",
                    "تاريخ الاستخراج": format(new Date(), "yyyy-MM-dd HH:mm")
                };
            });

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "كشف الدورة الكامل");

            if (!wb.Workbook) wb.Workbook = {};
            if (!wb.Workbook.Views) wb.Workbook.Views = [];
            if (wb.Workbook.Views.length === 0) wb.Workbook.Views.push({});
            wb.Workbook.Views[0].RTL = true;

            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            // اسم الملف يحتوي على اسم الدورة فقط
            const courseName = filters.course.replace(/ /g, "_");
            a.download = `كشف_الدورة_الكامل_${courseName}_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);

            toast.success(`تم تصدير ${allSoldiers.length} جندي بنجاح ✅`, { id: toastId });
        } else {
            toast.error("فشل جلب البيانات", { id: toastId });
        }
    } catch (e) {
        console.error(e);
        toast.error("حدث خطأ تقني", { id: toastId });
    } finally {
        setIsLoading(false);
    }
};
  // --- الواجهة ---
  return (
    <ProtectedRoute allowedRoles={["owner","manager","admin","assistant_admin","sports_officer","sports_supervisor", "sports_trainer"]}>
    <div className="space-y-6 pb-20 md:pb-32" dir="rtl">
      
      <style jsx global>{`
        @media print {
          @page { size: Portrait; margin: 5mm; }
          nav, aside, header, .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .table-container { overflow: visible !important; height: auto !important; }
          table { width: 100% !important; border-collapse: collapse; font-size: 10px; }
          thead th { background-color: #c5b391 !important; color: black !important; -webkit-print-color-adjust: exact; }
          th, td { border: 1px solid #000 !important; padding: 4px !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
{/* --- ترويسة الطباعة الرسمية --- */}
<div className="hidden print:block w-full border-b-2 border-black pb-4 mb-6">
  <div className="flex justify-between items-start">
      {/* اليمين: الهيكل التنظيمي */}
      <div className="text-center space-y-1 text-sm font-bold">
          <p>معهد الشرطة</p>
          <p>قسم التدريب العسكري والرياضي</p>
          <p>فرع التدريب الرياضي</p>
      </div>
      {/* الوسط: الشعار والعنوان والمسار */}
      <div className="text-center">
          <img src="/logo.jpg" alt="Logo" className="w-28 h-28 mx-auto object-contain" />
          <h1 className="text-xl font-bold underline mt-2">كشف توزيع الشباحات والشرائح</h1>
          <p className="text-sm mt-1">{filters.course} / {filters.batch} / {filters.company} / {filters.platoon}</p>
      </div>
      {/* اليسار: التاريخ والمسؤول */}
      <div className="text-left text-xs font-bold space-y-1">
          <p>التاريخ: {format(new Date(), "yyyy-MM-dd")}</p>
          <p>المسؤول: {displayName}</p>
      </div>
  </div>
</div>
      {/* الترويسة */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shirt className="w-8 h-8 text-blue-600" />
            توزيع الشباحات والشرائح
          </h1>
          <p className="text-slate-500 text-sm mt-1">يتم الحفظ تلقائياً عند الانتقال من الخلية</p>
        </div>
        
        {soldiers.length > 0 && (
    <div className="flex gap-2 flex-wrap">
        {/* 🛡️ أزرار المسح الجماعي - تظهر فقط للإدارة بناءً على الرتبة (userRole) */}
       {/* 🛡️ أزرار المسح الجماعي المحدثة */}
{["owner", "manager", "admin", "assistant_admin"].includes(userRole) && (
    <div className="flex gap-2 flex-wrap">
        <Button 
            variant="destructive" 
            size="sm"
            onClick={() => openConfirmDialog('shabaha')}
            className="gap-2 h-10 border-2 border-red-200 bg-red-600 hover:bg-red-700 text-white"
        >
            <RefreshCw className="w-4 h-4"/> مسح الشباحات
        </Button>
        
        <Button 
            variant="destructive" 
            size="sm"
            onClick={() => openConfirmDialog('chip')}
            className="gap-2 h-10 border-2 border-red-200 bg-red-600 hover:bg-red-700 text-white"
        >
            <Trash2 className="w-4 h-4"/> مسح الشرائح
        </Button>

        {/* 🟢 الزر الجديد: مسح الملاحظات */}
        <Button 
            variant="destructive" 
            size="sm"
            onClick={() => openConfirmDialog('notes')}
            className="gap-2 h-10 border-2 border-orange-200 bg-orange-600 hover:bg-orange-700 text-white"
        >
            <FileText className="w-4 h-4"/> مسح الملاحظات
        </Button>
    </div>
)}
        
        <Button variant="outline" onClick={handlePrintPDF} className="gap-2"><Printer className="w-4 h-4"/> طباعة</Button>
        {/* زر إكسل الكل — يظهر فقط للمالك ومساعد المسؤول بمجرد اختيار الدورة */}
{["owner", "assistant_admin"].includes(userRole) && filters.course && (
    <Button 
        onClick={handleExportAllExcel}
        className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white border-0"
        disabled={isLoading}
    >
        <Download className="w-4 h-4"/>
        Excel الكل
    </Button>
)}
        <Button variant="outline" onClick={handleExportExcel} className="gap-2 border-green-600 text-green-700 hover:bg-green-50"><Download className="w-4 h-4"/> Excel</Button>
    </div>
)}
      </div>

      {/* بطاقة الفلاتر الذكية */}
      <Card className="print:hidden border-t-4 border-t-blue-500 shadow-md">
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {/* 1. الدورة */}
             <div className="space-y-2">
                <label className="text-sm font-medium">الدورة <span className="text-red-500">*</span></label>
                <Select value={filters.course} onValueChange={(v) => setFilters({...filters, course: v, batch: "", company: "", platoon: ""})}>
    <SelectTrigger className="text-right h-10 bg-slate-50">
        <SelectValue placeholder={options.courses.length === 0 ? "لا توجد صلاحيات" : "اختر الدورة"} />
    </SelectTrigger>
    <SelectContent>
        {options.courses.length > 0 ? (
            options.courses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)
        ) : (
            <SelectItem value="none" disabled className="text-red-500 font-bold">لا تملك صلاحية على أي دورة</SelectItem>
        )}
    </SelectContent>
</Select>
             </div>

             {/* 2. الدفعة */}
             <div className="space-y-2">
    <label className="text-sm font-medium">الدفعة</label>
    <Select 
        value={filters.batch} 
        onValueChange={(v) => setFilters({...filters, batch: v})} 
        // القائمة تتعطل إذا لم يتم اختيار دورة أو إذا لم تكن هناك دفعات مسموحة
        disabled={!filters.course || options.batches.length === 0}
    >
        <SelectTrigger className="text-right h-10 bg-slate-50">
            <SelectValue placeholder={
                !filters.course ? "اختر الدورة أولاً" : 
                options.batches.length === 0 ? "لا توجد دفعات مسموحة" : 
                "الكل"
            } />
        </SelectTrigger>
        <SelectContent>
            {options.batches.length > 0 ? (
                <>
                    <SelectItem value="all">الكل</SelectItem>
                    {options.batches.map(b => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                </>
            ) : (
                <SelectItem value="none" disabled className="text-center text-red-500 font-bold italic">
                    لا تملك صلاحية على أي دفعة
                </SelectItem>
            )}
        </SelectContent>
    </Select>
</div>

             {/* 3. السرية */}
             <div className="space-y-2">
                <label className="text-sm font-medium">السرية</label>
                <Select 
                    value={filters.company} 
                    onValueChange={(v) => setFilters({...filters, company: v})}
                    disabled={!filters.course || options.companies.length === 0}
                >
                    <SelectTrigger className="text-right h-10 bg-slate-50"><SelectValue placeholder={options.companies.length === 0 ? "لا توجد سرايا" : "الكل"} /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">الكل</SelectItem>
                        {options.companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                </Select>
             </div>

             {/* 4. الفصيل */}
             <div className="space-y-2">
                <label className="text-sm font-medium">الفصيل</label>
                <Select 
                    value={filters.platoon} 
                    onValueChange={(v) => setFilters({...filters, platoon: v})}
                    disabled={!filters.course || options.platoons.length === 0}
                >
                    <SelectTrigger className="text-right h-10 bg-slate-50"><SelectValue placeholder={options.platoons.length === 0 ? "لا توجد فصائل" : "الكل"} /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">الكل</SelectItem>
                        {options.platoons.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                </Select>
             </div>
          </div>

          {/* البحث وزر العرض */}
          <div className="flex gap-2 pt-2 border-t mt-4">
             <div className="relative flex-1">
                <Search className="absolute right-3 top-2.5 w-5 h-5 text-slate-400" />
                <Input 
                    placeholder="بحث بالاسم أو الرقم العسكري..." 
                    className="pr-10 h-10" 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
             </div>
             
             {/* 🟢 زر العرض الذكي: يظل معطلاً حتى يكتمل المسار */}
             <Button 
                onClick={() => { setCurrentPage(1); fetchSoldiers(); }} 
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 px-8 h-10"
                disabled={isLoading || isSearchDisabled}
             >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Eye className="w-4 h-4"/>}
                عرض الكشف
             </Button>
          </div>
        </CardContent>
      </Card>

      {/* الجدول */}
      {soldiers.length > 0 && (
          <div className="table-container border rounded-lg bg-white overflow-hidden shadow-sm">
            <Table>
                <TableHeader className="bg-[#c5b391]">
                    <TableRow>
                        <TableHead className="text-center w-[50px] text-black font-bold border-b border-black">#</TableHead>
                        <TableHead className="text-center font-bold text-black border-b border-black w-[60px]">الرقم العسكري</TableHead>
                        <TableHead className="text-center font-bold text-black border-b border-black w-[220px]">الاسم</TableHead>
                        
                        <TableHead className="text-center w-[120px] text-black font-bold border-b border-black">رقم الشباحة</TableHead>
                        <TableHead className="text-center w-[160px] text-black font-bold border-b border-black">اللون</TableHead>
                        <TableHead className="text-center w-[140px] text-black font-bold border-b border-black">رقم الشريحة</TableHead>
                        
                        <TableHead className="text-center border-b border-black font-bold w-[100px]">ملاحظات</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
   {soldiers.map((soldier, index) => {
        // استخراج البيانات المحفوظة من السيرفر
        const saved = assignmentsMap[soldier.id] || {};

        // 🛑 الإصلاح هنا:
        // نتحقق: هل قام المستخدم بتعديل الخلية محلياً؟ (حتى لو جعلها فارغة)
        // إذا نعم (ليست undefined)، نستخدم قيمة المستخدم.
        // إذا لا، نستخدم القيمة المحفوظة من السيرفر.
        
        const currentShabaha = soldier.shabaha_number !== undefined ? soldier.shabaha_number : (saved.shabaha_number || "");
        
        const currentColorVal = soldier.shabaha_color !== undefined ? soldier.shabaha_color : (saved.shabaha_color || "");
        
        const currentChip = soldier.chip_number !== undefined ? soldier.chip_number : (saved.chip_number || "");
        
        const currentNote = soldier.notes !== undefined ? soldier.notes : (saved.notes || "");
        
        // البحث عن كائن اللون (للاسم والهيكس)
        const colorObj = SHABAHA_COLORS.find(c => c.value === currentColorVal);

        return (
            <TableRow key={soldier.id} className="hover:bg-slate-50 transition-colors break-inside-avoid">
                {/* الترقيم */}
                <TableCell className="text-center font-mono text-slate-500">
                    {(currentPage - 1) * itemsPerPage + index + 1}
                </TableCell>
                
                {/* الرقم العسكري والاسم */}
                <TableCell className="text-center font-bold font-mono text-slate-700">
                    {soldier.military_id}
                </TableCell>
                <TableCell className="text-center font-bold text-slate-800">
                    {soldier.name}
                </TableCell>
                
                {/* 1. رقم الشباحة (نظيفة عند الطباعة) */}
                <TableCell className="p-1 text-center">
                    {/* الشاشة: حقل إدخال */}
                    <div className="print:hidden">
                        <Input 
    value={currentShabaha}
    onChange={(e) => handleLocalChange(soldier.id, 'shabaha_number', e.target.value)}
    // عند الخروج، إذا كانت القيمة فارغة سيقوم handleSaveCell بحذفها من القاعدة
    onBlur={(e) => handleSaveCell(soldier.id, 'shabaha_number', e.target.value)}
                            className="text-center h-9 font-bold text-lg focus:ring-blue-500 border-blue-100 bg-white"
                            placeholder="---"
                            inputMode="numeric"
                            disabled={!isOnline}
                        />
                    </div>
                    {/* الطباعة: نص فقط (يختفي إذا كان فارغاً) */}
                    <div className="hidden print:block font-bold text-lg">{currentShabaha}</div>
                </TableCell>

{/* 2. لون الشباحة */}
<TableCell className="p-1 text-center">
    <div className="print:hidden">
        <Select 
    value={currentColorVal} 
    disabled={!isOnline}
    onValueChange={(val) => {
                // إذا اختار "تفريغ"، نرسل قيمة خاصة أو فراغ
                const finalVal = val === "clear_value" ? "" : val;
                
                // تحديث الواجهة لحظياً
                handleLocalChange(soldier.id, 'shabaha_color', finalVal);
                
                // استدعاء دالة الحفظ (التي ستتعامل مع الحذف أو التكرار)
                handleSaveCell(soldier.id, 'shabaha_color', val);
            }}
        >
            <SelectTrigger className="h-9 border-blue-100 bg-white" dir="rtl">
                <SelectValue placeholder="اختر اللون" />
            </SelectTrigger>
            <SelectContent>
                {/* 🟢 خيار جديد للحذف/التفريغ */}
                <SelectItem value="clear_value" className="text-red-500 font-bold border-b mb-1">
                    -- تفريغ / حذف --
                </SelectItem>
                
                {SHABAHA_COLORS.map(color => (
                    <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full border shadow-sm" style={{ backgroundColor: color.hex }}></div>
                            <span>{color.name}</span>
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    </div>
    
    {/* (كود الطباعة يبقى كما هو) */}
    <div 
        className="hidden print:flex w-full h-8 items-center justify-center font-bold drop-shadow-sm rounded-sm border border-black/10"
        style={{ 
            backgroundColor: colorObj ? colorObj.hex : 'transparent',
            color: colorObj?.value === 'yellow' ? 'black' : 'white' 
        }}
    >
        {colorObj ? colorObj.name : ""}
    </div>
</TableCell>

                {/* 3. رقم الشريحة (نظيفة عند الطباعة) */}
                <TableCell className="p-1 text-center">
                    <div className="print:hidden">
                        <Input 
                            value={currentChip}
                            onChange={(e) => handleLocalChange(soldier.id, 'chip_number', e.target.value)}
                            onBlur={(e) => handleSaveCell(soldier.id, 'chip_number', e.target.value)}
                            className="text-center h-9 font-bold text-red-600 border-yellow-100 focus:ring-yellow-500 bg-white"
                            placeholder="ID"
                            inputMode="numeric"
                            disabled={!isOnline}
                        />
                    </div>
                    {/* الطباعة: نص فقط */}
                    <div className="hidden print:block text-center font-bold text-lg text-red-600">{currentChip}</div>
                </TableCell>

                {/* 4. الملاحظات (نص كامل عند الطباعة) */}
                <TableCell className="text-center p-1">
                    <div className="print:hidden">
                        <Button 
                            variant="ghost" 
size="sm"
disabled={!isOnline}
onClick={() => { 
    setCurrentNoteId(soldier.id); 
    setTempNote(currentNote); 
    setIsNoteOpen(true); 
}}
                            className="hover:bg-blue-50"
                        >
                            {currentNote ? (
                                <div className="flex items-center gap-1 text-blue-600 font-medium">
                                    <FileText className="w-4 h-4" />
                                    <span className="text-[10px]">عرض</span>
                                </div>
                            ) : (
                                <Plus className="w-4 h-4 text-slate-400" />
                            )}
                        </Button>
                    </div>
                    {/* الطباعة: عرض النص المكتوب فقط، وإخفاء الزر */}
                    <div className="hidden print:block text-[10px] leading-tight font-medium text-center px-1">
                        {currentNote}
                    </div>
                </TableCell>
            </TableRow>
        );
    })}
</TableBody>
            </Table>
          </div>
      )}

      {/* Pagination مع اختيار عدد الصفوف */}
      {totalItems > 0 && (
          <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-lg border shadow-sm print:hidden gap-4">
              
              {/* 🟢 اختيار عدد الصفوف */}
              <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">صفوف لكل صفحة:</span>
                  <Select 
                    value={itemsPerPage.toString()} 
                    onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}
                  >
                    <SelectTrigger className="h-8 w-[70px]"><SelectValue placeholder="10" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
              </div>

              <span className="text-sm text-slate-500">عرض {(currentPage-1)*itemsPerPage + 1} إلى {Math.min(currentPage*itemsPerPage, totalItems)} من {totalItems}</span>
              
              <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={currentPage===1} onClick={() => setCurrentPage(p => p-1)}>السابق</Button>
                  <Button variant="outline" size="sm" disabled={currentPage * itemsPerPage >= totalItems} onClick={() => setCurrentPage(p => p+1)}>التالي</Button>
              </div>
          </div>
      )}

      {/* نافذة الملاحظات */}
<Dialog open={isNoteOpen} onOpenChange={setIsNoteOpen}>
  <DialogContent dir="rtl">
      <DialogHeader>
          <DialogTitle>إضافة ملاحظات للطالب</DialogTitle>
      </DialogHeader>
      
      <Textarea 
          value={tempNote} 
          onChange={(e) => setTempNote(e.target.value)} 
          placeholder="مثلاً: غائب، مصاب، إعفاء طبي..." 
          className="min-h-[120px] text-right"
      />

      <DialogFooter className="gap-2">
          {/* زر الإلغاء */}
          <Button variant="outline" onClick={() => setIsNoteOpen(false)}>إلغاء</Button>
          
          {/* زر الحفظ الذكي */}
          <Button 
              onClick={async () => {
                  if (currentNoteId) {
                      // 1. تحديث الواجهة فوراً (Local UI)
                      handleLocalChange(currentNoteId, 'notes', tempNote);
                      
                      // 2. إرسال للباك إند للحفظ في قاعدة البيانات
                      await handleSaveCell(currentNoteId, 'notes', tempNote);
                      
                      // 3. إغلاق النافذة وتنبيه المستخدم
                      setIsNoteOpen(false);
                      toast.success("تم حفظ الملاحظة بنجاح");
                  }
              }}
          >
              حفظ الملاحظة
          </Button>
      </DialogFooter>
  </DialogContent>
</Dialog>
<AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
    <AlertDialogContent dir="rtl" className="border-2 border-red-100">
        <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600 text-xl">
                <AlertTriangle className="w-6 h-6" />
                تأكيد عملية المسح الجماعي
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base py-4 text-slate-600 leading-relaxed">
    {resetTarget === 'shabaha' && "أنت على وشك مسح جميع أرقام وألوان الشباحات لهذا الفرز."}
    {resetTarget === 'chip' && "أنت على وشك مسح جميع أرقام الشرائح الإلكترونية لهذا الفرز."}
    {resetTarget === 'notes' && "أنت على وشك مسح جميع الملاحظات المسجلة لهذا الفرز."}
    <br />
    <span className="font-bold text-red-500 mt-2 block">⚠️ ملاحظة: لا يمكن التراجع عن هذه العملية بعد التنفيذ.</span>
</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="bg-slate-100">تراجع</AlertDialogCancel>
            <AlertDialogAction 
                onClick={executeBulkReset}
                className="bg-red-600 hover:bg-red-700 text-white"
            >
                نعم، ابدأ المسح الآن
            </AlertDialogAction>
        </AlertDialogFooter>
    </AlertDialogContent>
</AlertDialog>
    </div>
    </ProtectedRoute>
  )
}