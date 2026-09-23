"use client"

import { useEffect, useState, useMemo } from "react"
import { 
  Search, RefreshCw, Printer, Plus, 
  Trash2, User, ShieldAlert, CheckCircle2, Info, Save, Clock,Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import ProtectedRoute from "@/components/ProtectedRoute"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

// --- أنواع البيانات ---
type Soldier = {
  id: number; 
  name: string; 
  military_id: string; 
  rank: string;
  course: string; 
  batch: string; 
  company: string; 
  platoon: string;
  image_url?: string; // 🟢 أضف هذا السطر لكي يتعرف TypeScript على الحقل الجديد
};

type ViolationEntry = {
  tempId: string;
  soldier: Soldier;
  violation_name: string;
  penalty: string;
  deduction: number;
  note: string;
  housing: string;
  period_name: string;
  period_type: string;
  session_id: number;
  attachments?: string[]; // 🟢 أضف علامة الاستفهام هنا ليكون اختيارياً
};

const normalizeArabic = (text: string) => {
  if (!text) return "";
  return text.replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ").trim();
};
const convertArabicNumbers = (text: string) => {
  return text.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
};
const compressImage = (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 800; // حجم كافٍ جداً للمعاينة والرصد
      let width = img.width;
      let height = img.height;

      if (width > MAX_WIDTH) {
        height *= MAX_WIDTH / width;
        width = MAX_WIDTH;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      // تقليل الجودة لـ 60% يحول الصورة من 5MB إلى حوالي 100KB فقط!
      resolve(canvas.toDataURL('image/jpeg', 0.6)); 
    };
  });
};
export default function ViolationsRegistrationPage() {
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSoldier, setSelectedSoldier] = useState<Soldier | null>(null);
  const [allRegulations, setAllRegulations] = useState<any[]>([]);
  const [availablePeriods, setAvailablePeriods] = useState<{name: string, type: string, is_approved?: boolean}[]>([]);
  // البحث عن السطر الخاص بـ isSaved وتعديله ليصبح هكذا:
const [isSaved, setIsSaved] = useState(() => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem("is_queue_saved") === "true";
    }
    return false;
});
  const [housingSystem, setHousingSystem] = useState<'sleeping' | 'fixed'>('sleeping');
  const [penaltyFilter, setPenaltyFilter] = useState<string>("all");
  const [violationSearch, setViolationSearch] = useState(""); 
  const [selectedViolation, setSelectedViolation] = useState<any | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(""); 
  const [violationNote, setViolationNote] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

const [sessionQueue, setSessionQueue] = useState<ViolationEntry[]>(() => {
    if (typeof window !== 'undefined') {
        const savedQueue = localStorage.getItem("pending_violations");
        const savedDate = localStorage.getItem("queue_date");
        const today = format(new Date(), "yyyy-MM-dd");

        // 🟢 إذا كان التاريخ المخزن يختلف عن تاريخ اليوم، امسح كل شيء وابدأ من جديد
        if (savedDate !== today) {
            localStorage.removeItem("pending_violations");
            localStorage.removeItem("is_queue_saved");
            localStorage.setItem("queue_date", today); // حفظ تاريخ اليوم الجديد
            return [];
        }

        return savedQueue ? JSON.parse(savedQueue) : [];
    }
    return [];
});
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
// 🟢 حالة للتحكم في نافذة تأكيد الحذف
const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, soldierId: string | null}>({
  show: false,
  soldierId: null
});
  useEffect(() => { setMounted(true); fetchRegulations(); }, []);
  useEffect(() => { if (selectedSoldier) fetchTodaySessions(); }, [selectedSoldier]);
  useEffect(() => {
    setSelectedViolation(null);
  }, [housingSystem]);
  useEffect(() => {
    setSelectedViolation(null);
  }, [selectedSoldier]);
useEffect(() => {
    // 🟢 التعديل: لا نحفظ المرفقات (attachments) في الـ localStorage لأن حجمها ضخم
    const safeQueue = sessionQueue.map(({ attachments, ...rest }) => rest);
    
    try {
        localStorage.setItem("pending_violations", JSON.stringify(safeQueue));
    } catch (e) {
        console.error("LocalStorage is full, but we saved the text data.");
    }
}, [sessionQueue]);
  const fetchRegulations = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/disciplinary`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) setAllRegulations(await res.json());
    } catch (e) { console.error(e); }
  };

  // ابحث عن الدالة وحدثها كالتالي:
// 🟢 التعديل: جعل الدالة تستقبل الدورة والدفعة كبارامترات
const fetchTodaySessions = async (courseName?: string, batchName?: string) => {
    const targetCourse = courseName || selectedSoldier?.course;
    let rawBatch = batchName || selectedSoldier?.batch;

    // 🟢 التعديل: تحويل كافة مسميات "الفراغ" إلى نص فارغ لإرساله للباك إند
    const cleanBatchForApi = (!rawBatch || rawBatch === "all" || rawBatch === "None" || rawBatch === "none" || rawBatch === "لا يوجد") ? "" : rawBatch;

    if (!targetCourse) return;

    try {
        const today = format(new Date(), "yyyy-MM-dd");
        // نرسل cleanBatchForApi في الرابط
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/training/templates/today-sessions?course=${targetCourse}&batch=${cleanBatchForApi}&date=${today}`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        if (res.ok) {
            const data = await res.json();
            setAvailablePeriods(data);
        }
    } catch (e) { console.error("Error fetching sessions:", e); }
};

 const handleSearchSoldier = async () => {
    const rawInput = searchTerm.trim();
    const cleanQuery = rawInput.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());

    if (!cleanQuery) return;

    setLoading(true);
    setAvailablePeriods([]);
    setSelectedPeriod("");

    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/search?query=${encodeURIComponent(cleanQuery)}`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });

        if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
                const foundSoldier = data[0];

                // 🛡️ [تطوير حارس النطاق الذكي - النسخة الصارمة]
                const user = JSON.parse(localStorage.getItem("user") || "{}");
                const scope = user?.extra_permissions?.scope;

                if (user.role !== 'owner' && scope?.is_restricted) {
                    const allowedCourses = scope.courses || [];
                    const allowedCompanies = scope.companies || [];
                    const allowedPlatoons = scope.platoons || [];

                    const courseName = foundSoldier.course;
                    
                    // 🟢 1. توحيد مسمى الدفعة (Normalization)
                    const batchLabel = (!foundSoldier.batch || foundSoldier.batch === "all" || foundSoldier.batch === "None" || foundSoldier.batch === "none" || foundSoldier.batch === "") 
                        ? "لا يوجد" 
                        : foundSoldier.batch;
                    
                    // 🟢 2. بناء "بادئة المسار" لفحص السرايا والفصائل
                    const currentKeyPrefix = (batchLabel === "لا يوجد") 
                        ? `${courseName}->` 
                        : `${courseName}||${batchLabel}->`;

                    // 🟢 3. التحقق من وجود "قيود تفصيلية" لهذا المسار
                    // هل المستخدم لديه أي سرايا أو فصائل محددة لهذه الدورة/الدفعة؟
                    // 🟢 التعديل المطلوب لإرضاء TypeScript
const hasSpecificCompanyConstraints = allowedCompanies.some((c: string) => c.startsWith(currentKeyPrefix));
const hasSpecificPlatoonConstraints = allowedPlatoons.some((p: string) => p.startsWith(currentKeyPrefix));
                    // 🟢 4. فحص الصلاحيات بمستويات (الدورة، الدفعة، السرية، الفصيل)
                    const hasGeneralCourseAccess = allowedCourses.includes(courseName);
                    const hasSpecificBatchAccess = allowedCourses.includes(`${courseName}||${batchLabel}`);
                    
                    const isCompanyAllowed = allowedCompanies.includes(`${currentKeyPrefix}${foundSoldier.company}`);
                    const isPlatoonAllowed = allowedPlatoons.includes(`${currentKeyPrefix}${foundSoldier.platoon}`);

                    // 🛑 [منطق المنع الصارم]:
                    let isAccessDenied = false;

                    // أ. إذا كان هناك قيود على السرايا/الفصائل، يجب أن يتطابق الجندي معها حصراً
                    if (hasSpecificCompanyConstraints || hasSpecificPlatoonConstraints) {
                        if (!isCompanyAllowed || !isPlatoonAllowed) {
                            isAccessDenied = true;
                        }
                    } 
                    // ب. إذا لم توجد قيود تفصيلية، نكتفي بفحص الدورة والدفعة
                    else if (!hasGeneralCourseAccess && !hasSpecificBatchAccess) {
                        isAccessDenied = true;
                    }

                    if (isAccessDenied) {
                        toast.error("عفواً، هذا المجند خارج النطاق المصرح لك بالوصول إليه 🔒");
                        setSelectedSoldier(null);
                        setLoading(false);
                        return;
                    }
                }

                // ✅ إذا اجتاز الفحص بنجاح
                setSelectedSoldier(foundSoldier);
                setViolationSearch(""); 
                
                if (typeof fetchTodaySessions === 'function') {
                    fetchTodaySessions(foundSoldier.course, foundSoldier.batch);
                }
                
                toast.success("تم العثور على المجند ✅");
            } else {
                toast.error("لم يتم العثور على نتائج");
                setSelectedSoldier(null);
            }
        }
    } catch (e) {
        console.error("🚨 خطأ في البحث:", e);
        toast.error("خطأ في الاتصال بالسيرفر");
    } finally {
        setLoading(false);
    }
};

  const groupedQueue = useMemo(() => {
    const groups: { [key: string]: any } = {};
    sessionQueue.forEach((item: ViolationEntry) => {
      const id = item.soldier.military_id;
      if (!groups[id]) {
        groups[id] = { ...item, violation_names: [item.violation_name], penalties: [item.penalty], notes: item.note ? [item.note] : [] };
      } else {
        groups[id].violation_names.push(item.violation_name);
        groups[id].penalties.push(item.penalty);
        if (item.note) groups[id].notes.push(item.note);
      }
    });
    return Object.values(groups);
  }, [sessionQueue]);

  const currentBranch = useMemo(() => {
    const period = availablePeriods.find(p => p.name === selectedPeriod);
    return (period?.type === 'sports' || period?.type === 'combat') ? "فرع التدريب الرياضي" : "فرع التدريب العسكري";
  }, [selectedPeriod, availablePeriods]);

  const filteredViolations = useMemo(() => {
    if (!selectedSoldier) return [];
    const isRecruit = selectedSoldier.course.includes("مستجدين") || selectedSoldier.course.includes("دبلوم");
    const cleanSearch = normalizeArabic(violationSearch);
    return allRegulations.filter(v => {
      const matchType = isRecruit ? v.regulation_type === (housingSystem==='sleeping'?'recruits':'recruits_fixed') : v.regulation_type === 'specialized';
      const matchPenalty = penaltyFilter === "all" || v.penalty_label.includes(penaltyFilter);
      return matchType && matchPenalty && normalizeArabic(v.violation_name).includes(cleanSearch);
    });
  }, [selectedSoldier, housingSystem, violationSearch, penaltyFilter, allRegulations]);

  const dynamicPenalties = useMemo(() => {
    if (!selectedSoldier) return [];
    return (selectedSoldier.course.includes("مستجدين") || selectedSoldier.course.includes("دبلوم")) 
      ? ["حصة", "يوم", "يومين", "أيام", "أسبوع", "تحقيق"] : ["3 ساعات", "6 ساعات", "يوم داخلي", "فصل"];
  }, [selectedSoldier]);

 const addToQueue = () => {
    // 1. نجد ترتيب الحصة وبياناتها
    const periodIndex = availablePeriods.findIndex(p => p.name === selectedPeriod);
    const periodData = availablePeriods[periodIndex];

    // 🛡️ القفل الأمني: التحقق من الاعتماد قبل أي شيء
    if (periodData?.is_approved) {
        return toast.error("عفواً، هذه الحصة معتمدة رسمياً ولا يمكن إضافة مخالفات جديدة لها 🔒");
    }

    // 2. التحقق من اكتمال البيانات الأساسية
    if (!selectedSoldier || !selectedViolation || !selectedPeriod) {
        return toast.warning("أكمل البيانات أولاً");
    }

    // 🛡️ تأكد أن المخالفة المختارة تطابق النظام الحالي
    const isRecruit =
      selectedSoldier.course.includes("مستجدين") ||
      selectedSoldier.course.includes("دبلوم");
    const expectedType = isRecruit
      ? housingSystem === "sleeping"
        ? "recruits"
        : "recruits_fixed"
      : "specialized";
    if (selectedViolation.regulation_type !== expectedType) {
      setSelectedViolation(null);
      return toast.error("⚠️ أعد اختيار المخالفة بعد تغيير النظام");
    }

    // 3. تجهيز السجل الجديد
    const newEntry: ViolationEntry = {
        tempId: Date.now().toString(),
        soldier: selectedSoldier,
        violation_name: selectedViolation.violation_name,
        penalty: selectedViolation.penalty_label,
        deduction: selectedViolation.deduction_points,
        note: violationNote,
        housing: housingSystem === 'sleeping' ? 'مبيت' : 'ثابت',
        period_name: selectedPeriod,
        period_type: periodData?.type || 'other',
        session_id: periodIndex, // حفظ الرقم الصافي
        attachments: [...tempImages] 
    };

    setSessionQueue([newEntry, ...sessionQueue]);

    // 🧹 تنظيف الحقول
    setViolationNote(""); 
    setViolationSearch(""); 
    setSelectedViolation(null);
    setTempImages([]);
    
    setIsSaved(false);
    localStorage.setItem("is_queue_saved", "false");
};
// داخل المكون، أضف حالة للصور المختارة حالياً
const [tempImages, setTempImages] = useState<string[]>([]);

const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (files) {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      
      // 🟢 التعديل: جعلنا الدالة async لكي تنتظر انتهاء الضغط
      reader.onloadend = async () => {
        let result = reader.result as string;

        // 🟢 إذا كان الملف صورة، نقوم بتصغير حجمه فوراً (يحول الصورة من 4MB إلى 100KB)
        if (file.type.startsWith("image/")) {
          try {
            result = await compressImage(result);
          } catch (err) {
            console.error("خطأ أثناء ضغط الصورة", err);
          }
        }
        
        // إضافة النتيجة (سواء صورة مضغوطة أو ملف PDF) إلى القائمة المؤقتة
        setTempImages(prev => [...prev, result]);
      };

      reader.readAsDataURL(file);
    });
    toast.success("تم إضافة المرفق بنجاح");
  }
};
 const handleFinalSave = async () => {
  setIsSaving(true);
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    
    const payload = sessionQueue.map((item: ViolationEntry) => ({
    military_id: item.soldier.military_id,
    violation_name: item.violation_name,
    penalty: item.penalty,
    deduction: item.deduction,
    note: item.note,
    housing_system: item.housing,
    period: item.period_name,
    
    // 🟢 التعديل الجوهري: تحويل الرقم إلى نص (String)
    session_id: String(item.session_id), 
    
    entered_by: user.name || "مستخدم مجهول",
    entry_date: new Date().toISOString(),
    attachments: item.attachments || [] 
}));

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/violations/bulk-save`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${localStorage.getItem("token")}` 
      },
      body: JSON.stringify({ violations: payload })
    });

   if (res.ok) {
    toast.success("تم الحفظ والترحيل لقاعدة البيانات بنجاح ✅");

    // 🧹 تصفير كل شيء فوراً للبدء من جديد
    setSessionQueue([]); // مسح الجدول
    setIsSaved(false); // إعادة زر الحفظ لوضعه الطبيعي
    
    // مسح الذاكرة المحلية (LocalStorage) لضمان عدم عودة البيانات عند التحديث
    localStorage.removeItem("pending_violations");
    localStorage.removeItem("is_queue_saved");

    // اختياري: تصفير بيانات الجندي المختار حالياً لتسهيل البحث عن التالي
    setSelectedSoldier(null);
    setSearchTerm("");
}
  } catch (error) {
    toast.error("حدث خطأ أثناء الحفظ النهائي");
  } finally { 
    setIsSaving(false); 
  }
};
const startNewSession = () => {
    setSessionQueue([]);
    localStorage.removeItem("pending_violations");
    // 🟢 إضافة هذا السطر لمسح حالة الحفظ
    localStorage.removeItem("is_queue_saved");
    setIsSaved(false);
    toast.info("تم بدء جلسة رصد جديدة");
};
// 🟢 دالة الحذف النهائية مع الربط بالباك إند
const confirmDelete = async () => {
  if (!deleteConfirm.soldierId) return;

  const soldierId = deleteConfirm.soldierId;
  const entryToDelete = sessionQueue.find((q: ViolationEntry) => q.soldier.military_id === soldierId);

  try {
    // إذا كانت الجلسة محفوظة، نحاول الحذف من قاعدة البيانات أيضاً
    // 🟢 الحذف من الباك إند لكل سجلات هذا الطالب في هذه الحصة
if (isSaved && entryToDelete) {
  // نرسل الرقم العسكري واسم الحصة فقط (ليحذف كل ما بداخل هذا الصف)
  await fetch(`${process.env.NEXT_PUBLIC_API_URL}/violations/delete-record?military_id=${soldierId}&period=${entryToDelete.period_name}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
  });
}

    // الحذف من الواجهة والذاكرة المحلية
    const updatedQueue = sessionQueue.filter((q: ViolationEntry) => q.soldier.military_id !== soldierId);
    setSessionQueue(updatedQueue);
    toast.success("تم إزالة السجل بنجاح");
    
    // إذا فرغت القائمة تماماً، نعيد حالة الحفظ لـ false
    if (updatedQueue.length === 0) {
      setIsSaved(false);
      localStorage.setItem("is_queue_saved", "false");
    }
  } catch (error) {
    toast.error("حدث خطأ أثناء الحذف");
  } finally {
    setDeleteConfirm({ show: false, soldierId: null });
  }
};
  if (!mounted) return null;

  return (
    <ProtectedRoute allowedRoles={["owner","manager","admin","assistant_admin","sports_officer","sports_supervisor", "sports_trainer","military_officer","military_supervisor", "military_trainer"]}>
      <div className="p-2 pb-8 md:pb-24 space-y-6 max-w-full mx-auto  overflow-x-hidden bg-slate-50/50" dir="rtl">
        
        {/* CSS للطباعة */}
        <style jsx global>{`
  @media print {
    .no-print { display: none !important; }
    
    /* إلغاء أي حدود دنيا للعرض وفرض عرض الصفحة */
    table { 
      width: 100% !important; 
      min-width: 100% !important; 
      table-layout: fixed !important; 
      border-collapse: collapse !important; 
    }

    th, td { 
      border: 1px solid #000 !important; 
      padding: 4px !important; 
      word-wrap: break-word !important; 
      overflow-wrap: break-word !important;
      white-space: normal !important;
      font-size: 10px !important; /* تصغير الخط قليلاً ليناسب الطول */
    }

    /* توزيع المساحة بالعدل بين الأعمدة الأربعة */
    th:nth-child(1), td:nth-child(1) { width: 40px !important; } /* العمود # */
    th:nth-child(2), td:nth-child(2) { width: 25% !important; }  /* الاسم */
    th:nth-child(3), td:nth-child(3) { width: 45% !important; }  /* المخالفات */
    th:nth-child(4), td:nth-child(4) { width: 20% !important; }  /* الجزاءات */
    
    .bg-[#c5b391] { background-color: #f0f0f0 !important; -webkit-print-color-adjust: exact; }
  }
`}</style>

        {/* --- 🖨️ الترويسة الرسمية --- */}
        <div className="hidden print:block w-full mb-6">
            <div className="flex justify-between items-center border-b-4 border-slate-900 pb-4 w-full">
                <div className="w-28 h-28"><img src="/logo.jpg" alt="Logo" className="w-full h-full object-contain" /></div>
                <div className="text-center space-y-1">
                    <h2 className="text-lg font-black text-slate-800">معهد الشرطة - قسم التدريب العسكري والرياضي</h2>
                    <h2 className="text-md font-bold text-red-600">- {currentBranch} -</h2>
                    <h1 className="text-2xl font-black text-blue-900 underline underline-offset-4 mt-1">
                        كشف المخالفات اليومي: {selectedSoldier?.course} (د {selectedSoldier?.batch})
                    </h1>
                </div>
                <div className="text-left font-bold text-slate-700 text-xs">
                    <p>تاريخ الكشف:</p>
                    <p dir="ltr">{format(new Date(), "yyyy-MM-dd")}</p>
                </div>
            </div>
        </div>

        {/* --- الواجهة العلوية --- */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl shadow-sm border no-print">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 text-[#c5b391] rounded-lg"><ShieldAlert className="w-6 h-6"/></div>
            <h1 className="text-xl font-black">رصد المخالفات الانضباطية</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}><RefreshCw className="w-4 h-4 ml-2"/> تحديث</Button>
            <Button variant="outline" onClick={() => window.print()} className="bg-slate-900 text-white font-bold hover:bg-slate-800"><Printer className="w-4 h-4 ml-2"/> طباعة</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print items-stretch">
          
          {/* 🟢 بطاقة المجند (تعديل الارتفاع والجمالية) */}
          <Card className="lg:col-span-4 border-none shadow-xl bg-[#c5b391] text-slate-900 overflow-hidden flex flex-col min-h-[320px]">
            <CardContent className="p-6 flex-1 flex flex-col justify-between">
              <div className="space-y-6">
                <div className="flex gap-5 items-center animate-in fade-in slide-in-from-right-3">
                  <div className="w-24 h-24 bg-white/40 border-2 border-white rounded-2xl overflow-hidden shadow-lg shrink-0">
  {selectedSoldier ? (
    <img 
      // 🟢 نستخدم الرابط المخزن في الداتابيز (رابط سوبابيز)
      // إذا لم يوجد رابط، نضع صورة افتراضية
      src={selectedSoldier.image_url || "/placeholder-user.png"} 
      className="w-full h-full object-cover"
      // 🟢 دالة احتياطية: إذا فشل تحميل الصورة (الرابط تالف)، تضع صورة افتراضية فوراً
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        target.src = "/placeholder-user.png"; 
      }}
    />
  ) : (
    <User className="w-full h-full p-5 opacity-20" />
  )}
</div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-black truncate leading-tight">{selectedSoldier?.name || "جاري البحث..."}</h2>
                    <p className="font-bold text-sm mt-1 opacity-80 tracking-tighter">الرقم: {selectedSoldier?.military_id || "-----"}</p>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      <Badge className="bg-slate-900 text-white border-none text-[10px] px-2 py-0.5">{selectedSoldier?.course || "---"}</Badge>
                      
<Badge className="bg-white/50 text-slate-900 border-none text-[10px] font-bold px-2 py-0.5">
    دفعة {(!selectedSoldier?.batch || selectedSoldier.batch === "None" || selectedSoldier.batch === "none") ? "لا يوجد" : selectedSoldier.batch}
</Badge>
                    </div>
                    <p className="text-[11px] font-black mt-2 opacity-60">س: {selectedSoldier?.company || "--"} / ف: {selectedSoldier?.platoon || "--"}</p>
                  </div>
                </div>
              </div>

              {/* حقل البحث الضخم والمرتفع - متناسق تماماً */}
{/* حقل البحث المطور - مرن وتفاعلي */}
<div className="mt-auto pt-4 no-print"> 
  <div className="relative flex items-center group">
    
    {/* أيقونة البحث */}
    <div className="absolute right-4 z-10 text-slate-400">
      <Search className="w-6 h-6" /> 
    </div>

    {/* 1️⃣ تعديل حقل الإدخال: دعم النص والأرقام معاً */}
    <Input 
      type="text"
      inputMode="text" // 🟢 تم التغيير لفتح لوحة مفاتيح النصوص (للبحث بالاسم)
      placeholder="الرقم العسكري أو الاسم..."
      className="pr-12 pl-32 h-14 rounded-[20px] bg-white/90 border-none shadow-inner font-black text-xl focus-visible:ring-2 focus-visible:ring-slate-900 transition-all placeholder:text-slate-400/70" 
      value={searchTerm} 
      onChange={(e) => setSearchTerm(convertArabicNumbers(e.target.value))} 
      onKeyDown={(e) => e.key === 'Enter' && !loading && handleSearchSoldier()}
      autoComplete="off"
    />

    {/* 2️⃣ تعديل الزر: الإغلاق التلقائي وتغيير اللون أثناء التحميل */}
    <Button 
      onClick={handleSearchSoldier} 
      disabled={loading} // 🟢 يغلق الزر فوراً عند الضغط
      className={cn(
        "absolute left-2 top-2 bottom-2 px-8 font-black text-lg rounded-[14px] transition-all z-10 shadow-md",
        loading 
          ? "bg-slate-400 text-slate-200 cursor-not-allowed" // 🟢 لونه يصبح رمادي عند التحميل
          : "bg-slate-900 text-[#c5b391] hover:bg-slate-800 active:scale-95" // اللون الرسمي
      )}
    >
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin" /> // 🟢 إظهار علامة التحميل داخل الزر
      ) : (
        "بـحـث"
      )}
    </Button>
  </div>
</div>
            </CardContent>
          </Card>

          {/* 🟢 تفاصيل الرصد (تعديل الارتفاع المرن) */}
          <Card className="lg:col-span-8 shadow-xl border-slate-100 flex flex-col min-h-[320px]">
            <CardHeader className="bg-slate-50 border-b py-3 px-6 flex flex-row items-center justify-between shrink-0">
              <CardTitle className="text-sm font-black flex items-center gap-2 text-slate-600 uppercase"><Clock className="w-4 h-4 text-blue-600"/> تفاصيل الحصة والمخالفة</CardTitle>
              <div className="flex flex-col items-end gap-1">
                <div
                  className={cn(
                    "flex p-0.5 rounded-lg shadow-inner transition-all",
                    selectedViolation
                      ? "bg-amber-100 ring-2 ring-amber-400 ring-offset-1"
                      : "bg-slate-200"
                  )}
                  title={
                    selectedViolation
                      ? "تغيير النظام يلغي اختيار المخالفة الحالية"
                      : undefined
                  }
                >
                  <button
                    type="button"
                    onClick={() => setHousingSystem("sleeping")}
                    className={cn(
                      "px-6 py-1.5 text-xs font-black rounded-md transition-all",
                      housingSystem === "sleeping"
                        ? "bg-white text-amber-800 shadow-sm"
                        : "text-slate-500",
                      selectedViolation && "opacity-80"
                    )}
                  >
                    مبيت
                  </button>
                  <button
                    type="button"
                    onClick={() => setHousingSystem("fixed")}
                    className={cn(
                      "px-6 py-1.5 text-xs font-black rounded-md transition-all",
                      housingSystem === "fixed"
                        ? "bg-white text-amber-800 shadow-sm"
                        : "text-slate-500",
                      selectedViolation && "opacity-80"
                    )}
                  >
                    ثابت صبح
                  </button>
                </div>
                {selectedViolation && (
                  <span className="text-[10px] font-bold text-amber-700">
                    ⚠️ تغيير النظام يعيد اختيار المخالفة
                  </span>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-500 flex items-center gap-1 uppercase tracking-wider">حصة وقوع المخالفة *</label>
                  {/* ابحث عن الـ select الخاص بالحصص وحدثه كالتالي */}
<select 
    value={selectedPeriod} 
    onChange={(e)=>setSelectedPeriod(e.target.value)} 
    className={cn(
        "w-full h-11 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 font-bold text-sm outline-none transition-all",
        // إذا كانت الحصة المختارة معتمدة، نغير لون الإطار للأحمر
        availablePeriods.find(p => p.name === selectedPeriod)?.is_approved && "border-red-200 bg-red-50"
    )}
>
    <option value="">-- اختر الحصة التدريبية --</option>
   {availablePeriods.map((p, idx) => (
    <option 
        key={idx} 
        value={p.name} 
        // 🔒 القفل الحقيقي: يمنع اختيار الحصة المعتمدة
        disabled={p.is_approved === true} 
        // 🎨 لمسة جمالية: جعل النص باهت للأجزاء المغلقة
        className={cn(p.is_approved ? "text-slate-400 italic" : "text-slate-900 font-bold")}
    >
        {p.name}
    </option>
))}
</select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-500 flex items-center gap-1 uppercase tracking-wider">فلترة بمدة الجزاء:</label>
                  <div className="flex flex-wrap gap-1.5">
                    {["الكل", ...dynamicPenalties].map(f => (
                      <Button key={f} size="sm" variant={penaltyFilter===(f==="الكل"?"all":f)?"default":"outline"} onClick={()=>{setPenaltyFilter(f==="الكل"?"all":f); setShowSuggestions(true);}} className={cn("h-8 px-3 text-[10px] font-black rounded-lg transition-all", penaltyFilter === (f==="الكل"?"all":f) ? "bg-amber-700 shadow-md" : "")}>{f}</Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative">
                <label className="text-[11px] font-black text-slate-500 flex items-center gap-1 uppercase tracking-wider mb-1.5">مسمى المخالفة:</label>
                <Input placeholder="اكتب كلمة للبحث (مثل: هندام، تاخير، صلاة...)" className="h-12 font-bold text-lg border-2 border-slate-100 focus:border-amber-500 rounded-xl pr-4 shadow-sm" value={violationSearch} onFocus={()=>setShowSuggestions(true)} onChange={(e)=>{setViolationSearch(e.target.value); setSelectedViolation(null); setShowSuggestions(true);}} />
                
                {showSuggestions && (
                  <div className="absolute top-[100%] left-0 right-0 z-[110] bg-white border-2 border-slate-100 rounded-xl shadow-2xl mt-1 max-h-[220px] overflow-y-auto">
                    <div className="p-2 border-b bg-slate-50 flex justify-between items-center sticky top-0">
                        <span className="text-[10px] font-black text-slate-400">القائمة المفلترة:</span>
                        <Button variant="ghost" size="sm" onClick={()=>setShowSuggestions(false)} className="h-6 text-red-500 hover:bg-red-50 px-2 font-bold text-xs">إغلاق ✕</Button>
                    </div>
                    {filteredViolations.map((v:any) => (
                      <div key={v.id} onClick={()=>{setSelectedViolation(v); setViolationSearch(v.violation_name); setShowSuggestions(false);}} className="p-4 border-b last:border-0 hover:bg-amber-50/50 cursor-pointer transition-colors group">
                        <p className="font-bold text-slate-800 text-sm leading-snug">{v.violation_name}</p>
                        <Badge variant="outline" className="mt-1 border-red-100 text-red-600 text-[10px] font-black">الجزاء: {v.penalty_label}</Badge>
                      </div>
                    ))}
                    {filteredViolations.length === 0 && <div className="p-8 text-center text-slate-400 italic">لا توجد نتائج مطابقة</div>}
                  </div>
                )}
              </div>

              <div className="flex flex-col md:flex-row gap-3 pt-2">
  <div className="relative flex-1">
    <Input 
      placeholder="أضف ملاحظة..." 
      className="h-12 bg-slate-50 border-none rounded-xl text-sm pr-4 pl-12 shadow-inner" 
      value={violationNote} 
      onChange={(e)=>setViolationNote(e.target.value)} 
    />
    {/* زر رفع الصور المتعددة */}
    <label className="absolute left-3 top-1/2 -translate-y-1/2 cursor-pointer hover:text-blue-600 transition-colors text-slate-400">
      <Plus className="w-6 h-6" />
      <input 
  type="file" 
  multiple 
  accept="image/*,application/pdf" 
  className="hidden" 
  onChange={handleImageUpload} 
/>
    </label>
  </div>
  
  {/* عرض مصغرات الصور المرفقة قبل الإضافة للقائمة */}
  {tempImages.length > 0 && (
  <div className="flex gap-2 p-2 bg-white rounded-xl border border-dashed border-slate-200">
    {tempImages.map((file, i) => {
      const isPDF = file.includes("application/pdf");
      return (
        <div key={i} className="relative w-10 h-10 group">
          {isPDF ? (
            // 🟢 شكل معاينة الـ PDF
            <div className="w-full h-full bg-red-50 border border-red-100 rounded-md flex items-center justify-center">
              <span className="text-[10px] font-black text-red-600">PDF</span>
            </div>
          ) : (
            // 🖼️ شكل معاينة الصورة
            <img src={file} className="w-full h-full object-cover rounded-md border" />
          )}
          <Button 
  type="button" // إضافة هذا السطر يمنع الزر من محاولة إرسال النموذج بالخطأ
  variant="ghost" // اختياري ليعطي مظهراً جميلاً
  onClick={() => setTempImages(prev => prev.filter((_, idx) => idx !== i))} 
  className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full p-0.5 w-5 h-5 flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm"
>
  <Trash2 className="w-3 h-3"/>
</Button>
        </div>
      );
    })}
  </div>
)}
  <Button onClick={addToQueue} disabled={!selectedViolation || !selectedPeriod} className="h-12 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black px-10 shadow-lg shadow-red-100 transition-all active:scale-95 shrink-0">
                    رصد في القائمة
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* --- الجدول المطور --- */}
        <Card className="border-none shadow-2xl overflow-hidden rounded-3xl print-section">
          <CardHeader className="bg-slate-900 text-white py-4 px-8 flex flex-row items-center justify-between no-print">
            <CardTitle className="text-lg font-black flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-400"/>  المخالفات</CardTitle>
           <div className="flex gap-2">
    <Button 
        onClick={handleFinalSave} 
        disabled={sessionQueue.length === 0 || isSaving}
        className="bg-[#c5b391] hover:bg-[#b4a280] text-slate-900 font-black px-8 rounded-xl shadow-lg transition-all active:scale-95"
    >
        {isSaving ? (
            <Loader2 className="animate-spin ml-2 w-5 h-5"/>
        ) : (
            <Save className="ml-2 w-5 h-5"/>
        )}
        ترحيل وحفظ السجلات ({sessionQueue.length})
    </Button>
</div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right border-collapse min-w-[1100px]">
                <thead className="bg-[#c5b391] text-slate-950 border-b-4 border-slate-900/10">
                  <tr>
                    <th className="p-5 font-black w-16 border-l border-black/5 text-center">#</th>
                    <th className="p-5 font-black w-[300px] border-l border-black/5">الاســـم والبيـانـات</th>
                    <th className="p-5 font-black w-[450px] border-l border-black/5">المخـالفـات المرصـودة</th>
                    <th className="p-5 font-black w-[220px] border-l border-black/5 text-center">الجـزاءات</th>
                    <th className="p-5 font-black border-l border-black/5 no-print">الملاحـظـات</th>
                    <th className="p-4 w-16 no-print"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {groupedQueue.length === 0 ? (
                    <tr><td colSpan={6} className="p-24 text-center text-slate-300 font-black italic text-xl opacity-40">لا توجد مخالفات مرصودة حالياً</td></tr>
                  ) : (
                    groupedQueue.map((entry, idx) => (
                      <tr key={entry.tempId} className="hover:bg-amber-50/20 transition-colors">
                        <td className="p-5 font-black text-slate-400 border-l text-center bg-slate-50/50">{idx + 1}</td>
                        <td className="p-5 border-l">
                          <div className="font-black text-slate-900 text-lg mb-1 leading-tight">{entry.soldier.name}</div>
                          <div className="text-[11px] font-black text-slate-500 tracking-tighter uppercase">{entry.soldier.rank} - {entry.soldier.military_id}</div>
                          <div className="text-[10px] font-bold text-amber-800 mt-1 opacity-60">س {entry.soldier.company} | ف {entry.soldier.platoon}</div>
                        </td>
                        <td className="p-5 border-l">
                          <div className="space-y-2">
                            {entry.violation_names.map((v:string, i:number) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className="bg-red-600 text-white text-[9px] px-1.5 rounded-full mt-1 shrink-0">{i+1}</span>
                                <p className="font-black text-red-700 leading-snug">{v}</p>
                              </div>
                            ))}
                          </div>
                         {/* 🟢 تعديل عرض اسم الحصة في الجدول ليظهر النوع فقط */}
<Badge className="bg-blue-600 text-white border-none text-[10px] mt-3 font-black px-2 py-1">
  {entry.period_name.split(' - ')[0].split(' (')[0]}
</Badge>
                        </td>
                       <td className="p-5 border-l text-center">
    <div className="flex flex-wrap justify-center gap-1.5">
    {entry.penalties.map((p: string, i: number) => (
        <div key={i} className="flex items-center gap-1">
            <Badge className="bg-white text-red-700 border-2 border-red-100 font-black text-[11px] px-2 h-7 shadow-sm">
                {p}
            </Badge>
        </div>
    ))}
    </div>
</td>
                        <td className="p-5 text-[10px] text-slate-500 font-bold italic no-print">
  {entry.notes.join(" | ") || "---"}
  {/* عرض الصور كمرفقات صغيرة */}
  {entry.attachments && entry.attachments.length > 0 && (
    <div className="flex gap-1 mt-2 no-print">
      <Badge variant="outline" className="text-[8px] bg-blue-50 text-blue-600 border-blue-100">
        <Plus className="w-3 h-3 ml-1" /> {entry.attachments.length} مرفق
      </Badge>
    </div>
  )}
</td>
                        <td className="p-5 no-print text-center">
                          <Button 
  variant="ghost" 
  size="icon" 
  className="text-red-300 hover:text-red-600 transition-all hover:bg-red-50 rounded-full" 
  onClick={() => setDeleteConfirm({ show: true, soldierId: entry.soldier.military_id })}
>
  <Trash2 className="w-5 h-5" />
</Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* 🟢 نافذة تأكيد الحذف المصممة بجاذبية */}
{deleteConfirm.show && (
  <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
    <Card className="w-full max-w-sm border-none shadow-2xl overflow-hidden rounded-3xl bg-white">
      <div className="p-6 text-center space-y-4">
        <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
          <Trash2 className="w-8 h-8 text-red-500 animate-bounce" />
        </div>
        <div>
          <h3 className="text-xl font-black text-slate-900">تأكيد الحذف</h3>
          <p className="text-sm font-bold text-slate-500 mt-2">هل أنت متأكد من رغبتك في حذف سجل هذا المجند؟ لا يمكن التراجع عن هذه الخطوة.</p>
        </div>
        <div className="flex gap-3 pt-2">
          <Button 
            variant="outline" 
            className="flex-1 h-12 rounded-xl font-black border-slate-200 text-slate-600 hover:bg-slate-50"
            onClick={() => setDeleteConfirm({ show: false, soldierId: null })}
          >
            إلغاء
          </Button>
          <Button 
            className="flex-1 h-12 rounded-xl font-black bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200"
            onClick={confirmDelete}
          >
            تأكيد الحذف
          </Button>
        </div>
      </div>
    </Card>
  </div>
)}
    </ProtectedRoute>
  );
}