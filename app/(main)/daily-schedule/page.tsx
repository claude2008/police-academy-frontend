"use client"

import { useState, useEffect, useMemo } from "react"
// 🟢 تأكدنا من استيراد addDays للتعامل مع التواريخ
import { format, addDays } from "date-fns"
import { ar } from "date-fns/locale"
import { 
  CalendarDays, Search, Clock, AlertTriangle, 
  Loader2, ChevronRight, ChevronLeft, Stethoscope, Tent, 
  FileText, UserMinus, HelpCircle, PlusCircle, Trash2, CheckCircle2, User,
  Camera, Paperclip, X, Info, FileCheck, Check ,Lock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription // 👈 أضف هذه الكلمة هنا
} from "@/components/ui/dialog"
import { toast } from "sonner"
import ProtectedRoute from "@/components/ProtectedRoute"
import imageCompression from 'browser-image-compression';

const STATUS_OPTIONS = [
  { id: "absent", label: "غياب", color: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle, propagate: false },
  { id: "exempt", label: "إعفاء", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: AlertTriangle, needsDuration: true, propagate: true },
  { id: "rest", label: "استراحة", color: "bg-slate-100 text-slate-700 border-slate-200", icon: HelpCircle, needsDuration: true, propagate: true },
  { id: "leave", label: "إجازة", color: "bg-green-100 text-green-700 border-green-200", icon: Tent, needsDuration: true, propagate: true },
  { id: "medical", label: "طبية", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Stethoscope, needsDuration: true, propagate: true },
  { id: "admin_leave", label: "إجازة إدارية", color: "bg-green-100 text-green-700 border-green-200", icon: FileText, needsDuration: true, propagate: true },
  { id: "death_leave", label: "إجازة وفاة", color: "bg-gray-100 text-gray-700 border-gray-200", icon: UserMinus, needsDuration: true, propagate: true },
  { id: "clinic", label: "عيادة", color: "bg-cyan-100 text-cyan-700 border-cyan-200", icon: Stethoscope, propagate: false },
  // 🟢 إضافة needsTime هنا
  { id: "late_parade", label: "تأخير تكميل", color: "bg-orange-100 text-orange-700 border-orange-200", icon: Clock, needsTime: true, propagate: false },
  { id: "late_class", label: "تأخير حصة", color: "bg-orange-100 text-orange-700 border-orange-200", icon: Clock, needsTime: true, propagate: false },
  { id: "hospital", label: "مستشفى", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Stethoscope, needsDuration: true, propagate: true },
  // 🟢 إضافة needsNote و needsDuration هنا
  { id: "other", label: "أخرى", color: "bg-gray-200 text-gray-800 border-gray-300", icon: HelpCircle, needsNote: true, needsDuration: true, propagate: true },
]

const SUBJECT_MAP: any = { sports: "لياقة بدنية", military: "تدريب عسكري", combat: "اشتباك", lecture: "محاضرة", other: "أخرى" };

export default function DailySchedulePage() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [loading, setLoading] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState("")
  const [selectedBatch, setSelectedBatch] = useState("all")
  const [selectedCompany, setSelectedCompany] = useState("all")
  const [selectedPlatoon, setSelectedPlatoon] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [filterOptions, setFilterOptions] = useState<any>({ courses: [], batches: [] })
  const [templates, setTemplates] = useState<any[]>([])
  const [soldiers, setSoldiers] = useState<any[]>([])
  const [attendanceData, setAttendanceData] = useState<any>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [activeEntry, setActiveEntry] = useState<any>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);
  const [attachmentStudent, setAttachmentStudent] = useState<any>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
const [lockedSessions, setLockedSessions] = useState<string[]>([]);
 useEffect(() => {
  const fetchOptions = async () => {
    try {
        const token = localStorage.getItem("token");
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const scope = user?.extra_permissions?.scope;
        const isRestricted = user.role !== 'owner' && scope?.is_restricted;
        const userCourses = scope?.courses || [];

        if (isRestricted && userCourses.length === 0) {
            setFilterOptions({ courses: [], batches: [] });
            setTemplates([]);
            return;
        }

        const [fRes, tRes] = await Promise.all([
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/filters-options`),
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/training/templates`, {
                headers: { "Authorization": `Bearer ${token}` }
            })
        ]);

        if (fRes.ok) {
            let data = await fRes.json();
            if (isRestricted) {
                const allowedNames = userCourses.map((key: string) => key.split('||')[0]);
                data.courses = (data.courses || []).filter((c: string) => allowedNames.includes(c));
                data.batches = (data.batches || []).filter((b: string) => 
                    userCourses.some((key: string) => key.endsWith(`||${b}`))
                );
            }
            setFilterOptions(data);
        }

       if (tRes.ok) {
    let templateData = await tRes.json();
    
    if (isRestricted) {
        templateData = templateData.filter((t: any) => {
            // 🟢 الإصلاح: تجربة كل المسميات الممكنة للحقول
            const cKey = t.course_key || t.courseId || t.course_name;
            const bKey = t.batch_key || t.batchId || t.batch_name;
            
            if (!cKey) return false; // إذا لم يجد اسم الدورة أصلاً، نرفض القالب

            const templateKey = bKey ? `${cKey}||${bKey}` : cKey;
            
            const isMatch = userCourses.includes(templateKey) || 
                           userCourses.some((uc: string) => uc.startsWith(cKey + "||"));
            
            return isMatch;
        });
    }
    setTemplates(templateData);
}

    } catch (e) { console.error("Error in fetchOptions:", e); }
};
    fetchOptions();
  }, [date]); // أضفنا date لضمان التحديث عند تغيير التاريخ
const activeSchedule = useMemo(() => {
    const template = templates.find(t => {
        // 🟢 الإصلاح: قراءة مرنة للمسميات
        const tCourse = t.course_key || t.courseId || t.course_name;
        const tBatch = t.batch_key || t.batchId || t.batch_name;
        
        const courseMatch = tCourse === selectedCourse;
        
        // معالجة الدفعة
        const currentBatch = (selectedBatch === "all" || selectedBatch === "" || selectedBatch === "none") ? null : selectedBatch;
        const batchMatch = (tBatch === currentBatch) || (selectedBatch === "all" && (!tBatch || tBatch === "none"));
        
        const activeFlag = t.is_active !== undefined ? t.is_active : t.isActive;

        return courseMatch && batchMatch && activeFlag === true;
    });

    if (!template) return [];

    let scheduleData = [];
    try {
        const rawData = template.schedule_data || template.schedule;
        scheduleData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    } catch (e) { return []; }

    if (!Array.isArray(scheduleData)) return [];

    const rawDayName = format(new Date(date), "EEEE", { locale: ar });
    const dayEntry = scheduleData.find((d: any) => d.dayName === rawDayName || d.day === rawDayName);
    
    return dayEntry?.sessions || [];
}, [date, selectedCourse, selectedBatch, templates]);
  // ✅ الكود الجديد: يطلب الدورة كشرط أساسي، والدفعة اختيارية
useEffect(() => { 
    if (selectedCourse) { 
        fetchSoldiers(); 
    } 
}, [selectedCourse, selectedBatch, selectedCompany, date]);

const fetchSoldiers = async () => {
    setLoading(true);
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const scope = user?.extra_permissions?.scope;

    try {
        const params = new URLSearchParams({ 
            course: selectedCourse, 
            batch: selectedBatch, 
            limit: "1000" 
        });

        const [sRes, dRes] = await Promise.all([
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/?${params.toString()}`),
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/day-data?date=${date}&course=${selectedCourse}&batch=${selectedBatch}`, { 
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` } 
            })
        ]);

        // 1. معالجة بيانات الجنود (كما هي مع التأمين)
        if (sRes.ok) {
            let soldiersData = (await sRes.json()).data || [];
            if (user.role !== 'owner' && scope?.is_restricted) {
                const allowedCoursesKeys = scope.courses || [];
                soldiersData = soldiersData.filter((s: any) => 
                    allowedCoursesKeys.includes(`${s.course}||${s.batch}`)
                );
            }
            setSoldiers(soldiersData);
        }

        // 2. 🟢 التعديل الجوهري: معالجة بيانات الحصص والأقفال
        // داخل دالة fetchSoldiers في ملف DailySchedulePage.tsx
if (dRes.ok) {
    const responseData = await dRes.json();
    
    // 1. تحديث بيانات المربعات الملونة (الحالات والمخالفات)
    setAttendanceData(responseData.data || responseData); 

    // 2. 🔒 منطق القفل الذكي والموحد:
    // نأخذ المصفوفة الموحدة 'approved_sessions' التي أرسلها الباك إند
    // مع وضع احتياط للمسميات الأخرى لضمان عدم حدوث خطأ
    const unifiedApproved = responseData.approved_sessions || [];
    const supervisorApproved = responseData.supervisor_approved_sessions || [];
    const officerApproved = responseData.officer_approved_sessions || [];
    
    // دمج كل المصادر الممكنة في قائمة واحدة وحذف التكرار
    const allLocked = Array.from(new Set([
        ...unifiedApproved, 
        ...supervisorApproved, 
        ...officerApproved
    ]));
    
    // تحويل الأرقام إلى نصوص لضمان المطابقة مع sIdx في الجدول
    setLockedSessions(allLocked.map(String)); 

    // 🔍 سطر للفحص (يظهر في الكونسول فقط) للتأكد من وصول الأرقام
    console.log("🔒 الحصص المقفلة المستلمة من السيرفر:", allLocked);
}

    } catch (e) { 
        toast.error("فشل التحديث"); 
        console.error(e);
    } finally { 
        setLoading(false); 
    }
};

  const platoonsList = useMemo(() => {
      const list = new Set(soldiers.filter(s => selectedCompany === "all" || s.company === selectedCompany).map(s => s.platoon));
      return Array.from(list).filter(Boolean).sort();
  }, [soldiers, selectedCompany]);

// 🟢 التعديل الأول: استخراج الدفعات التي تنتمي للدورة المختارة فقط
const availableBatches = useMemo(() => {
    const batches = new Set(soldiers.map(s => s.batch));
    return Array.from(batches).filter(b => b && b !== "none" && b !== "").sort();
}, [soldiers]);
// 🟢 التعديل الجديد: استخراج السرايا الموجودة فعلياً في هذه الدورة والدفعة فقط
const availableCompanies = useMemo(() => {
    const companies = new Set(soldiers.map(s => s.company));
    // تنظيف القائمة من الفراغات وترتيبها
    return Array.from(companies).filter(c => c && c !== "none" && c !== "").sort();
}, [soldiers]);
 // 🟢 1. الفرز الذكي (يعتمد عليه الإجمالي والجدول)
// 🟢 1. الفرز الذكي (يعتمد عليه الإجمالي والجدول)
const filteredSoldiers = useMemo(() => {
    return soldiers.filter(s => {
        const matchSearch = (s.name || "").includes(searchTerm) || (s.military_id || "").includes(searchTerm);
        const matchPlatoon = selectedPlatoon === "all" || s.platoon === selectedPlatoon;
        
        // 🟢 أضفنا شرط السرية هنا
        const matchCompany = selectedCompany === "all" || s.company === selectedCompany;

        return matchSearch && matchPlatoon && matchCompany;
    });
}, [soldiers, searchTerm, selectedPlatoon, selectedCompany]); // 👈 لا تنس إضافة selectedCompany هنا

// 🟢 2. تقسيم الصفحات بناءً على الفرز الفعلي
const paginatedSoldiers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSoldiers.slice(start, start + itemsPerPage);
}, [filteredSoldiers, currentPage, itemsPerPage]);

  // 🟢🟢🟢 دالة الحفظ المصلحة (المنطق الزمني السليم) 🟢🟢🟢
const saveStatus = async () => { 
    if (!activeEntry.status) return toast.error("اختر الحالة");
    
    setLoading(true);
    const token = localStorage.getItem("token");

    try {
        // 1. تنظيف السجلات القديمة
        if (activeEntry.group_id) {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/delete-group/${activeEntry.group_id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
        }

        // 2. إعداد المتغيرات
        const durationCount = parseInt(activeEntry.duration) || 1;
        const statusInfo = STATUS_OPTIONS.find(o => o.id === activeEntry.status);
        const isSingleSession = activeEntry.isSingleSession === true;
        const newGroupId = isSingleSession ? null : (activeEntry.group_id || `GRP-${Date.now()}-${activeEntry.soldier.id}`);
        const loopDuration = isSingleSession ? 1 : durationCount;
        const baseStartDate = activeEntry.start_date || date; 

        // ✅ الإصلاح الأول: تحديد نوع مصفوفة الوعود بشكل صريح
        const allPromises: Promise<Response>[] = [];

        for (let i = 0; i < loopDuration; i++) {
            const targetDate = format(addDays(new Date(baseStartDate), i), "yyyy-MM-dd");
            
            // ✅ الإصلاح الثاني والثالث: تحديد نوع البرامترات (session و idx)
            activeSchedule.forEach((session: any, idx: number) => {
                const isCurrentSession = String(idx) === activeEntry.sessionId;
                let shouldSave = false;

                if (isSingleSession) {
                    if (isCurrentSession && i === 0) shouldSave = true;
                } else {
                    if (statusInfo?.propagate || i > 0 || isCurrentSession) shouldSave = true;
                }
                
                if (shouldSave) {
                    allPromises.push(
                        fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/attendance/save`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                            body: JSON.stringify({
                                soldier_id: activeEntry.soldier.id,
                                date: targetDate, 
                                session_id: String(idx),
                                status: activeEntry.status,
                                duration: isSingleSession ? 1 : durationCount, 
                                start_date: baseStartDate, 
                                note: activeEntry.note || "",
                                group_id: newGroupId
                            })
                        })
                    );
                }
            });
        }

        await Promise.all(allPromises);
        
        toast.success("تم التحديث بنجاح");
        fetchSoldiers(); 
        setModalOpen(false); 

    } catch (e) { 
        console.error(e);
        toast.error("فشل التحديث"); 
    } finally { 
        setLoading(false); 
    }
};

 const handleOpenAttachment = (path: string) => {
    if (!path) return;

    try {
        // 🟢 بناء الرابط الذكي:
        let fullUrl = path;

        if (path.startsWith('http')) {
            // أولاً: إذا كان رابطاً كاملاً (Supabase) نستخدمه كما هو
            fullUrl = path;
        } else if (path.startsWith('/static')) {
            // ثانياً: إذا كان مساراً محلياً نضيف له عنوان السيرفر
            fullUrl = `${process.env.NEXT_PUBLIC_API_URL}${path}`;
        }
        // ثالثاً: إذا كان Base64 (يبدأ بـ data:) سيظل كما هو في متغير fullUrl

        // التحقق من نوع الملف (PDF أم صورة)
        const isPDF = fullUrl.toLowerCase().includes(".pdf") || fullUrl.includes("application/pdf");

        if (isPDF) {
            // للملفات الـ PDF: نفتحها في تبويب جديد
            window.open(fullUrl, '_blank', 'noopener,noreferrer');
        } else {
            // للصور: نعرضها في نافذة المعاينة (Modal)
            setPreviewImage(fullUrl);
        }
    } catch (e) {
        console.error("خطأ في فتح المرفق:", e);
        toast.error("عفواً، تعذر فتح هذا المرفق حالياً");
    }
};
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsCompressing(true);
    try {
        let fileData: string = "";
        if (file.type.startsWith('image/')) {
            const options = { maxSizeMB: 0.1, maxWidthOrHeight: 1024, useWebWorker: true };
            const compressedFile = await imageCompression(file, options);
            fileData = await new Promise((res) => { const r = new FileReader(); r.readAsDataURL(compressedFile); r.onloadend = () => res(r.result as string); });
        } else {
            fileData = await new Promise((res) => { const r = new FileReader(); r.readAsDataURL(file); r.onloadend = () => res(r.result as string); });
        }

        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/attendance/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify({ soldier_id: attachmentStudent.id, date: date, session_id: `ATTACH_${Date.now()}`, status: "present", attachment: fileData, note: file.name })
        });
        toast.success("تم الرفع");
        fetchSoldiers();
    } catch (e) { toast.error("فشل الرفع") } finally { setIsCompressing(false) }
  };

 // 🟢 وظيفة الحذف الفعلي (يتم استدعاؤها بعد التأكيد الداخلي)
const executeDelete = async (attId: number) => {
    setIsDeleting(attId);
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/delete/attendance/${attId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        if (res.ok) {
            toast.success("تم الحذف");
            fetchSoldiers();
            setConfirmDeleteId(null); // إغلاق وضع التأكيد
        }
    } catch (e) {
        toast.error("خطأ في الحذف");
    } finally {
        setIsDeleting(null);
    }
};
const deleteStatus = async () => {
    if (!activeEntry?.id) return; // التأكد من وجود ID للحالة

    setConfirmDeleteId(activeEntry.id); // استخدام نفس منطق التأكيد الداخلي للمرفقات
};

// دالة التنفيذ النهائي للحذف (استبدل القديمة أو أضفها)
const executeDeleteStatus = async (mode: 'single' | 'group_full' | 'group_from_today') => {
    if (!activeEntry?.id) return;
    setLoading(true);

    try {
        const token = localStorage.getItem("token");
        let url = `${process.env.NEXT_PUBLIC_API_URL}/session/delete/attendance/${activeEntry.id}`;
        
        if (mode === 'group_full' && activeEntry.group_id) {
            url = `${process.env.NEXT_PUBLIC_API_URL}/session/delete-group/${activeEntry.group_id}`;
        } 
        else if (mode === 'group_from_today' && activeEntry.group_id) {
            url = `${process.env.NEXT_PUBLIC_API_URL}/session/terminate-group/${activeEntry.group_id}?from_date=${date}`;
        }

        const res = await fetch(url, { 
            method: "DELETE", 
            headers: { "Authorization": `Bearer ${token}` } 
        });

        const responseData = await res.json();

        if (res.ok) {
            toast.success("تم تنفيذ الإجراء بنجاح");
            fetchSoldiers();
            setModalOpen(false); // إغلاق النافذة عند النجاح
        } else {
            // 🛑 هنا نلتقط رسالة المنع القادمة من الباك إند (403 Forbidden)
            if (res.status === 403) {
                toast.error(responseData.detail || "لا يمكن حذف سلسلة تحتوي على حصص معتمدة");
            } else {
                toast.error(responseData.detail || "حدث خطأ أثناء العملية");
            }
            // 🟢 إغلاق النافذة وتصفير وضع الحذف حتى لو فشل بسبب الاعتماد
            setModalOpen(false); 
            setConfirmDeleteId(null);
        }
    } catch (e) {
        toast.error("حدث خطأ في الاتصال بالسيرفر");
    } finally {
        setLoading(false);
        setConfirmDeleteId(null);
    }
};
  return (
    <ProtectedRoute allowedRoles={["owner","manager","admin","assistant_admin","sports_officer","sports_supervisor", "sports_trainer","military_officer","military_supervisor", "military_trainer"]}>
      <div className="p-2 md:p-4 pb-10 md:pb-32 space-y-4 max-w-[1800px] mx-auto bg-slate-50/50 min-h-screen" dir="rtl">
        
        <Card className="border-t-4 border-[#c5b391] shadow-sm">
            <CardHeader className="py-3 flex flex-row justify-between items-center bg-white rounded-t-lg">
                <CardTitle className="text-lg md:text-xl font-bold flex items-center gap-2"><CalendarDays className="w-5 h-5 text-[#c5b391]" /> تحضير الحصص</CardTitle>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { const d = new Date(date); d.setDate(d.getDate()-1); setDate(format(d,"yyyy-MM-dd")) }}><ChevronRight/></Button>
                    <Input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="border-none bg-transparent font-bold w-32 text-xs text-center h-8" />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { const d = new Date(date); d.setDate(d.getDate()+1); setDate(format(d,"yyyy-MM-dd")) }}><ChevronLeft/></Button>
                </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-6 gap-2 p-3">
               <Select value={selectedCourse} onValueChange={(v)=>{setSelectedCourse(v); setSelectedBatch("all");}}>
  <SelectTrigger className="h-9 text-xs font-bold bg-white">
    <SelectValue placeholder={filterOptions.courses.length === 0 ? "لا توجد صلاحيات" : "اختر الدورة"} />
  </SelectTrigger>
  <SelectContent>
    {/* 🟢 لا تسمح للمتصفح بعرض أي خيار إذا كانت القائمة فارغة برمجياً */}
    {filterOptions.courses && filterOptions.courses.length > 0 ? (
      filterOptions.courses.map((c: any) => (
        <SelectItem key={c} value={c}>{c}</SelectItem>
      ))
    ) : (
      <SelectItem value="none" disabled className="text-center text-red-500 italic">
        ليس لديك صلاحية على أي دورة
      </SelectItem>
    )}
  </SelectContent>
</Select>

                {/* 🟢 التعديل الثاني: قائمة الدفعات تظهر فقط ما يخص الدورة المختارة */}
                <Select value={selectedBatch} onValueChange={setSelectedBatch} disabled={!selectedCourse}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="الدفعة" /></SelectTrigger>
                  <SelectContent>
                      {availableBatches.length > 0 && <SelectItem value="all">كل الدفعات</SelectItem>}
                      {availableBatches.length > 0 ? (
                          availableBatches.map((b: any) => <SelectItem key={b} value={b}>{b}</SelectItem>)
                      ) : (
                          <SelectItem value="all">بدون دفعات</SelectItem>
                      )}
                  </SelectContent>
                </Select>

                <Select value={selectedCompany} onValueChange={(v) => { setSelectedCompany(v); setSelectedPlatoon("all"); }}>
  <SelectTrigger className="h-9 text-xs">
    <SelectValue placeholder="السرية" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">كل السرايا</SelectItem>
    {/* 🟢 نستخدم القائمة الذكية الجديدة هنا لضمان عدم التكرار */}
    {availableCompanies.map((c: any) => (
      <SelectItem key={c} value={c}>{c}</SelectItem>
    ))}
  </SelectContent>
</Select>
                <Select value={selectedPlatoon} onValueChange={setSelectedPlatoon}><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="الفصيل" /></SelectTrigger><SelectContent><SelectItem value="all">كل الفصائل</SelectItem>{platoonsList.map(p=><SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
                <div className="relative col-span-2 md:col-span-2">
                    <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                    <Input placeholder="بحث بالاسم أو الرقم..." className="pr-9 h-9 text-xs font-bold" value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} />
                </div>
            </CardContent>
        </Card>

        <div className="bg-white border rounded-xl shadow-md overflow-hidden min-h-[400px]">
            <div className="overflow-x-auto">
                <Table className="text-center border-collapse">
                    <TableHeader>
                        <TableRow className="bg-[#b09f7e] divide-x divide-white/20">
                            <TableHead colSpan={4} className="border-b-0"></TableHead>
                            {activeSchedule.map((s:any, i:number)=>(
                                <TableHead key={i} className="text-black text-center font-black border-x border-white/20 py-1 min-w-[130px]">
                                    <div className="flex flex-col leading-tight"><span className="text-[14px] opacity-70">الحصة {i+1}</span><span className="text-sm">{SUBJECT_MAP[s.type] || "مادة عامة"}</span></div>
                                </TableHead>
                            ))}
                        </TableRow>
                        <TableRow className="bg-[#c5b391] divide-x divide-white/20">
                            <TableHead className="text-black font-bold border w-10 text-[10px]">#</TableHead>
                            <TableHead className="text-black font-bold border w-12 text-center text-[10px]">المرفق</TableHead>
                            <TableHead className="text-black font-bold border w-24 text-[10px]">الرقم</TableHead>
                            <TableHead className="text-black font-bold border min-w-[180px] text-right px-4 text-[10px]">الاسم والبيانات</TableHead>
                            {activeSchedule.map((s:any, i:number)=>(
                                <TableHead key={i} className="text-black text-center border-x border-white/10 p-1 font-bold">
                                    <div className="flex flex-col leading-none"><span className="text-[14px] truncate w-28 mx-auto">{s.name || "بدون مسمى"}</span><span className="text-[9px] opacity-60 mt-0.5">{s.startTime}-{s.endTime}</span></div>
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
    {loading ? (
        <TableRow>
            <TableCell colSpan={activeSchedule.length + 4} className="h-40 text-center">
                <Loader2 className="animate-spin mx-auto w-8 h-8 text-[#c5b391]"/>
            </TableCell>
        </TableRow>
    ) : (!selectedCourse) ? (
      <TableRow>
          <TableCell colSpan={activeSchedule.length + 4} className="h-40 text-center font-bold text-slate-400">
              يرجى اختيار الدورة أولاً
          </TableCell>
      </TableRow>
    // 🟢 التعديل الثالث: إخفاء البيانات إذا كان هناك دفعات ولم يتم اختيار واحدة
    ) : (availableBatches.length > 0 && selectedBatch === "all") ? (
      <TableRow>
          <TableCell colSpan={activeSchedule.length + 4} className="h-40 text-center">
              <div className="flex flex-col items-center gap-2">
                <Info className="w-8 h-8 text-blue-500 opacity-50" />
                <p className="font-bold text-slate-500">هذه الدورة تحتوي على دفعات، يرجى تحديد الدفعة لعرض الطلاب</p>
              </div>
          </TableCell>
      </TableRow>
    ) : paginatedSoldiers.map((soldier, idx) => (
        <TableRow key={soldier.id} className="hover:bg-slate-50 h-12">
            <TableCell className="border text-[10px] text-slate-400 font-mono">
                {(currentPage - 1) * itemsPerPage + idx + 1}
            </TableCell>
            
            <TableCell className="border p-1">
                <Button 
                    variant="ghost" size="sm" 
                    className="h-7 w-7 rounded-full hover:bg-blue-50 relative" 
                    onClick={() => { setAttachmentStudent(soldier); setAttachmentModalOpen(true); }}
                >
                    <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                    {Object.keys(attendanceData).some(k => k.startsWith(`${soldier.id}-ATTACH`) && attendanceData[k]?.attendance?.attachment) && (
                        <span className="absolute top-0 right-0 w-2 h-2 bg-blue-600 rounded-full border border-white"></span>
                    )}
                </Button>
            </TableCell>

            <TableCell className="border font-bold text-slate-600 text-[11px]">{soldier.military_id}</TableCell>
            
            <TableCell className="border text-right px-3">
                <div className="flex flex-col">
                    <span className="font-bold text-xs text-slate-800">{soldier.name}</span>
                    <span className="text-[9px] text-slate-500 font-medium">{soldier.rank} - : {soldier.platoon}</span>
                </div>
            </TableCell>

            {/* 🟢 الجزء الأهم: عرض الحصص بناءً على المفتاح الذكي */}
          {activeSchedule.map((session: any, sIdx: number) => {
    const sessionId = session.id || String(sIdx);
    const key = `${soldier.id}-${sessionId}`;
    const slotKey = `${soldier.id}-slot-${sIdx}`;
    
    const record = attendanceData[key]?.attendance || attendanceData[slotKey]?.attendance;
    const status = STATUS_OPTIONS.find(o => o.id === record?.status);

    // 🟢 إضافة فحص القفل هنا
    const isLocked = lockedSessions.includes(String(sIdx));

    return (
        <TableCell 
            key={sIdx} 
            // 🟢 تغيير الخلفية إذا كانت مغلقة
            className={`border p-1 cursor-pointer transition-colors ${isLocked ? 'bg-slate-50/50' : 'hover:bg-slate-100'}`}
            onClick={() => { 
                setActiveEntry({ 
                    soldier, 
                    session, 
                    sessionId: String(sIdx), 
                    ...record,
                    start_date: record?.start_date || date,
                    isLocked: isLocked // 🟢 نمرر حالة القفل للنافذة
                }); 
                setModalOpen(true); 
            }}
        >
            <div className="relative flex items-center justify-center">
                {status ? (
                    <div className={`${status.color} rounded px-1 py-0.5 text-[9px] font-black border border-current/20 shadow-sm text-center truncate max-w-[100px] mx-auto flex items-center gap-1`}>
                        {/* 🟢 إظهار أيقونة قفل صغيرة إذا كانت معتمدة */}
                        {isLocked && <Lock className="w-2 h-2 text-current opacity-60" />}
                       <div className={`${status.color} rounded px-1 py-0.5 text-[9px] font-black border border-current/20 shadow-sm text-center truncate max-w-[100px] mx-auto flex items-center gap-1`}>
    {isLocked && <Lock className="w-2 h-2 text-current opacity-60" />}
    
    {(() => {
        // 1. تحديد النص الأساسي (الملاحظة لحالة أخرى، أو التسمية العادية)
        const mainLabel = record.status === "other" && record.note ? record.note : status.label;
        
        // 2. تحديد الحصانة (الحالات التي لا نريد إظهار "1ي" لها)
        const excludedFromOneDay = ["absent", "clinic", "late_parade", "late_class"];
        
        // 3. منطق عرض المدة:
        // نظهر الرقم إذا كانت (المدة أكبر من 1) 
        // أو إذا كانت (المدة تساوي 1 والحالة ليست من ضمن المستثنين)
        let showDuration = false;
        const durationValue = parseInt(record.duration) || 1;

        if (durationValue > 1) {
            showDuration = true;
        } else if (durationValue === 1 && !excludedFromOneDay.includes(record.status)) {
            showDuration = true;
        }

        return (
            <span>
                {mainLabel}
                {showDuration && <span className="mr-0.5 text-[8px] opacity-80">({durationValue}ي)</span>}
            </span>
        );
    })()}
</div>
                    </div>
                ) : (
                    // 🟢 إذا كانت الحصة معتمدة وهي فارغة، نظهر القفل بدل علامة +
                    isLocked ? <Lock className="w-3 h-3 text-slate-300 opacity-40" /> : <PlusCircle className="w-3.5 h-3.5 text-slate-300 opacity-70" />
                )}
            </div>
        </TableCell>
    );
})}
        </TableRow>
    ))}
</TableBody>
                </Table>
            </div>
            
            <div className="p-3 flex items-center justify-between border-t bg-slate-50/80">
                <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-slate-500">عرض:</span>
        <Select value={itemsPerPage.toString()} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
            <SelectTrigger className="w-20 h-9 font-bold"><SelectValue /></SelectTrigger>
            <SelectContent>
                {[10, 20, 50, 100].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}
            </SelectContent>
        </Select>
        <div className="h-6 w-[1px] bg-slate-200 mx-1"></div>
        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
             العدد : {filteredSoldiers.length}
        </span>
    </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-[10px]" onClick={()=>setCurrentPage(p=>p-1)} disabled={currentPage===1}>السابق</Button>
                    <Button variant="outline" size="sm" className="h-8 text-[10px]" onClick={()=>setCurrentPage(p=>p+1)} disabled={currentPage>=Math.ceil(soldiers.length/itemsPerPage)}>التالي</Button>
                </div>
            </div>
        </div>

       <Dialog open={modalOpen} onOpenChange={setModalOpen}>
    {/* أضفنا mb-20 لرفع النافذة عن الأيقونات السفلية على الهاتف، و sm:mb-0 لإلغائها على الحاسوب */}
<DialogContent 
  className="max-w-md border-2 border-[#c5b391] flex flex-col max-h-[70vh] sm:max-h-[85vh] p-0 overflow-hidden mb-40 sm:mb-0 shadow-2xl rounded-t-2xl sm:rounded-xl" dir="rtl">

        {/* الرأس ثابت - تم إضافة padding لتعويض p-0 في الأب */}
        <DialogHeader className="p-6 border-b pb-2">
            <DialogTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-[#c5b391]"/> {activeEntry?.soldier?.name}
            </DialogTitle>
        </DialogHeader>

        {/* أضفنا pb-20 (Padding Bottom) لضمان إمكانية رفع المحتوى للأعلى عند التمرير */}
<div className="flex-1 overflow-y-auto p-6 pb-20 space-y-4 custom-scrollbar touch-pan-y overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>

            <div className="grid grid-cols-2 gap-2 py-2">
                {STATUS_OPTIONS.map(opt => (
                    <Button 
                        key={opt.id} variant={activeEntry?.status === opt.id ? "default" : "outline"}
                        className={`justify-start gap-2 h-10 text-xs ${activeEntry?.status === opt.id ? 'bg-slate-900 text-white' : ''}`}
                        onClick={()=>setActiveEntry({...activeEntry, status: opt.id})}
                    >
                        <opt.icon className="w-4 h-4" /> {opt.label}
                        {opt.propagate && <span className="mr-auto" title="تعمم تلقائياً"><Check className="w-3 h-3 text-green-500" /></span>}
                    </Button>
                ))}
            </div>

            {/* 1. حقل الدقائق (للتأخير فقط) */}
            {STATUS_OPTIONS.find(o => o.id === activeEntry?.status)?.needsTime && (
                <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 mt-2">
                    <label className="text-[11px] font-bold text-orange-700 block mb-1">الزمن (بالدقائق):</label>
                    <Input 
                        type="number" 
                        placeholder="مثال: 30" 
                        value={activeEntry?.minutes || ""} 
                        onChange={(e) => setActiveEntry({...activeEntry, minutes: e.target.value})} 
                        className="h-9 font-bold border-orange-200" 
                    />
                </div>
            )}

            {/* 2. حقل الملاحظة (لحالة "أخرى" فقط) */}
            {STATUS_OPTIONS.find(o => o.id === activeEntry?.status)?.needsNote && (
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mt-2">
                    <label className="text-[11px] font-bold text-gray-700 block mb-1">وصف الحالة:</label>
                    <Input 
                        placeholder="اكتب نوع الحالة هنا..." 
                        value={activeEntry?.note || ""} 
                        onChange={(e) => setActiveEntry({...activeEntry, note: e.target.value})} 
                        className="h-9 font-bold" 
                    />
                </div>
            )}

            {/* 3. حقل المدة (للحالات الطويلة و "أخرى") */}
            {STATUS_OPTIONS.find(o => o.id === activeEntry?.status)?.needsDuration && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mt-2">
                    <label className="text-[11px] font-bold text-blue-700 block mb-1">المدة (أيام):</label>
                    <Input 
                        type="number" 
                        min="1" 
                        value={activeEntry?.duration || "1"} 
                        onChange={(e) => setActiveEntry({...activeEntry, duration: e.target.value})} 
                        className="h-9 font-bold border-blue-200" 
                    />
                </div>
            )}

            {/* 🟢 حقل تاريخ البداية وحساب تاريخ النهاية */}
            {STATUS_OPTIONS.find(o => o.id === activeEntry?.status)?.needsDuration && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-purple-50 p-2 rounded-lg border border-purple-100">
                        <label className="text-[10px] font-bold text-purple-700 block mb-1">تاريخ البداية:</label>
                        <Input 
                            type="date" 
                            value={activeEntry?.start_date || date} 
                            onChange={(e) => setActiveEntry({...activeEntry, start_date: e.target.value})} 
                            className="h-8 text-xs font-bold" 
                        />
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 opacity-80">
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">تاريخ النهاية (آلي):</label>
                        <div className="h-8 flex items-center px-3 text-xs font-black text-slate-700">
                            {activeEntry?.start_date && activeEntry?.duration ? 
                                format(addDays(new Date(activeEntry.start_date), parseInt(activeEntry.duration) - 1), "yyyy-MM-dd") 
                                : "--"
                            }
                        </div>
                    </div>
                </div>
            )}

            {/* 🟢 خيارات التحكم في التعميم (تظهر للحالات التي تقبل التعميم مثل الإعفاء) */}
            {STATUS_OPTIONS.find(o => o.id === activeEntry?.status)?.propagate && (
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 mt-2">
                    <label className="text-[11px] font-bold text-yellow-800 block mb-2">نطاق الحالة:</label>
                    <div className="flex gap-2">
                        <Button 
                            variant={activeEntry?.isSingleSession ? "default" : "outline"}
                            className={`flex-1 h-8 text-xs ${activeEntry?.isSingleSession ? "bg-yellow-600 hover:bg-yellow-700 text-white" : "border-yellow-300 text-yellow-700"}`}
                            onClick={() => setActiveEntry({ ...activeEntry, isSingleSession: true, duration: "1" })}
                        >
                            هذه الحصة فقط
                        </Button>
                        <Button 
                            variant={!activeEntry?.isSingleSession ? "default" : "outline"}
                            className={`flex-1 h-8 text-xs ${!activeEntry?.isSingleSession ? "bg-yellow-600 hover:bg-yellow-700 text-white" : "border-yellow-300 text-yellow-700"}`}
                            onClick={() => setActiveEntry({ ...activeEntry, isSingleSession: false })}
                        >
                            تعميم (كامل اليوم/المدة)
                        </Button>
                    </div>
                    {!activeEntry?.isSingleSession && (
                        <p className="text-[10px] text-yellow-600 mt-2 font-bold text-center">
                            سيتم تطبيق الحالة على جميع حصص اليوم {activeEntry?.duration > 1 ? `ولمدة ${activeEntry?.duration} أيام` : ""}
                        </p>
                    )}
                </div>
            )}
        </div>
        {/* 🟢 نهاية المنطقة القابلة للتمرير */}

        {/* أضفنا pb-10 للهاتف لرفع زر الحفظ من داخل منطقة الفوتر نفسها */}
<DialogFooter className="p-4 pb-10 sm:pb-4 border-t bg-slate-50 mt-0 flex flex-row gap-2 z-10 sm:p-6">
            {activeEntry?.id && (
                <Button 
                    variant="destructive" 
                    className="flex-1 h-11 font-bold gap-2"
                    onClick={() => {
  // إذا كانت الحصة مقفلة، لا تفتح النافذة وأظهر تنبيه
  if (activeEntry?.isLocked) {
      toast.error("عفواً، لا يمكن حذف سجل معتمد");
  } else {
      setConfirmDeleteId(activeEntry.id); // هذا يفتح نافذة خيارات الحذف عندك
  }
}}
                    disabled={loading}
                >
                    <Trash2 className="w-4 h-4" /> حذف الحالة
                </Button>
            )}
            
            {/* إذا كانت الحصة معتمدة والطالب ليس له سجل سابق (إضافة جديدة) -> عطل الزر */}
{activeEntry?.isLocked && !activeEntry?.id ? (
    <div className="flex-[2] flex items-center justify-center bg-slate-100 text-slate-400 rounded-lg font-bold text-xs h-11 border border-dashed">
        الإضافة غير متاحة (معتمد)
    </div>
) : (
    /* في حالة التعديل أو الحصص غير المعتمدة يظهر الزر العادي */
    <Button 
        onClick={saveStatus} 
        className={`flex-[2] font-bold h-11 ${activeEntry?.isLocked ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-[#c5b391] text-black'}`}
        disabled={loading}
    >
        {loading ? <Loader2 className="animate-spin w-5 h-5"/> : activeEntry?.isLocked ? "حفظ التعديل" : "حفظ وتعميم"}
    </Button>
)}

           {/* 🔴 نافذة تأكيد حذف الحالة (تصميمك الأصلي مع إضافة مؤشرات التحميل) */}
{confirmDeleteId === activeEntry?.id && (
    <div className="absolute inset-0 bg-white z-[100] flex flex-col items-center justify-center p-6 rounded-lg border-2 border-red-500 shadow-2xl animate-in fade-in zoom-in-95">
        <AlertTriangle className="w-10 h-10 text-red-500 mb-2" />
        <h3 className="font-black text-lg mb-1">إدارة الحالات المترابطة</h3>
        <DialogDescription className="text-xs text-slate-500 mb-4 text-center">
            هذه الحصة جزء من سلسلة إجازة/طبية. حدد الإجراء المطلوب:
        </DialogDescription>
        
        <div className="flex flex-col gap-2 w-full max-w-xs">
            {/* 1. حذف الحصة الحالية */}
            <Button 
                variant="outline" 
                className="h-10 text-xs border-slate-200 gap-2" 
                onClick={() => executeDeleteStatus('single')}
                disabled={loading} // 🟢 يمنع الضغط أثناء التحميل
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "حذف هذه الحصة فقط"}
            </Button>

            {/* 2. إنهاء من اليوم فصاعداً */}
            <Button 
                variant="outline" 
                className="h-10 text-xs border-orange-200 text-orange-700 hover:bg-orange-50 gap-2" 
                onClick={() => executeDeleteStatus('group_from_today')}
                disabled={loading}
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "إنهاء من اليوم (حذف المتبقي)"}
            </Button>

            {/* 3. حذف السلسلة كاملة */}
            <Button 
                variant="destructive" 
                className="h-10 text-xs font-bold gap-2 bg-red-600 hover:bg-red-700" 
                onClick={() => executeDeleteStatus('group_full')}
                disabled={loading}
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "إلغاء السلسلة كاملة"}
            </Button>

            {/* زر تراجع */}
            {!loading && (
                <Button 
                    variant="ghost" 
                    className="h-8 text-slate-400 mt-1" 
                    onClick={() => setConfirmDeleteId(null)}
                >
                    تراجع
                </Button>
            )}
        </div>
    </div>
)}
        </DialogFooter>
    </DialogContent>
</Dialog>

        <Dialog open={attachmentModalOpen} onOpenChange={setAttachmentModalOpen}>
            <DialogContent className="max-w-2xl border-2 border-blue-600" dir="rtl">
                <DialogHeader className="border-b pb-2 flex flex-row items-center justify-between">
                    <DialogTitle className="flex items-center gap-2"><Paperclip className="w-5 h-5 text-blue-600"/> المرفقات: {attachmentStudent?.name}</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3 max-h-[350px] overflow-y-auto p-1">
                      {Object.keys(attendanceData).filter(k => k.startsWith(`${attachmentStudent?.id}-ATTACH`)).map(key => {
    const att = attendanceData[key]?.attendance;
    if(!att?.attachment) return null;

    // داخل ماب (map) المرفقات
const fullUrl = att.attachment.startsWith('http') 
    ? att.attachment 
    : att.attachment.startsWith('/static') 
        ? `${process.env.NEXT_PUBLIC_API_URL}${att.attachment}` 
        : att.attachment;

    const isPDF = fullUrl.toLowerCase().includes(".pdf") || fullUrl.includes("application/pdf");

    return (
        <div key={key} className="relative group border rounded-xl overflow-hidden shadow-sm bg-white flex flex-col items-center justify-center p-2 h-40 transition-all hover:shadow-md">
            
            {isPDF ? (
                <div className="flex flex-col items-center justify-center gap-2 w-full h-full bg-red-50/50 rounded-lg border border-red-100">
                    <div className="p-3 bg-red-100 rounded-full">
                        <FileText className="w-8 h-8 text-red-600" />
                    </div>
                    <span className="text-[10px] font-black text-red-700 px-2 text-center line-clamp-1">
                        {att.note || "مستند PDF"}
                    </span>
                </div>
            ) : (
                <img src={fullUrl} className="w-full h-full object-cover rounded-lg" alt="مرفق" />
            )}

            {/* طبقة الأزرار العادية */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity z-10">
                <Button size="sm" variant="secondary" className="h-8 w-8 rounded-full" onClick={() => handleOpenAttachment(att.attachment)}>
                    <Search className="w-4 h-4"/>
                </Button>
                <Button size="sm" variant="destructive" className="h-8 w-8 rounded-full" onClick={() => setConfirmDeleteId(att.id)}>
                    <Trash2 className="w-4 h-4"/>
                </Button>
            </div>

            {/* 🟢 طبقة تأكيد الحذف الجديدة (تظهر عند الضغط على السلة) */}
            {confirmDeleteId === att.id && (
                <div className="absolute inset-0 bg-red-600/95 z-20 flex flex-col items-center justify-center gap-2 p-2 animate-in fade-in zoom-in-95">
                    <AlertTriangle className="w-6 h-6 text-white animate-bounce" />
                    <p className="text-white text-[11px] font-black">هل تريد حذف المرفق؟</p>
                    <div className="flex gap-2">
                        <Button 
                            size="sm" 
                            variant="secondary" 
                            className="h-7 px-3 text-[10px] font-bold" 
                            onClick={() => executeDelete(att.id)}
                            disabled={isDeleting === att.id}
                        >
                            {isDeleting === att.id ? <Loader2 className="w-3 h-3 animate-spin"/> : "نعم، احذف"}
                        </Button>
                        <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 px-3 text-[10px] text-white hover:bg-white/20" 
                            onClick={() => setConfirmDeleteId(null)}
                        >
                            تراجع
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
})}
                        {Object.keys(attendanceData).filter(k => k.startsWith(`${attachmentStudent?.id}-ATTACH`)).length === 0 && (
                            <div className="col-span-full py-12 text-center border-2 border-dashed rounded-xl text-slate-300">
                                <Paperclip className="w-10 h-10 mx-auto opacity-20 mb-2"/>
                                <p className="text-xs font-bold">لا يوجد مرفقات مرفوعة حالياً</p>
                            </div>
                        )}
                    </div>
                    <div className="border-t pt-4">
                        <div className="relative group">
                            <Input type="file" accept="image/*,application/pdf" className="absolute inset-0 opacity-0 cursor-pointer z-20" onChange={(e)=>handleFileUpload(e.target.files?.[0]!)} disabled={isCompressing} />
                            <Button className="w-full gap-2 border-2 border-blue-600 text-blue-700 bg-blue-50 font-bold h-12" variant="outline" disabled={isCompressing}>
                                {isCompressing ? <Loader2 className="animate-spin w-5 h-5"/> : <><Camera className="w-5 h-5"/> اضغط لرفع (صورة أو PDF) جديد</>}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>

        {/* 🟢🟢🟢 حل خطأ الصورة (Empty Src) 🟢🟢🟢 */}
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
            <DialogContent className="max-w-4xl bg-black/95 p-1 border-none shadow-2xl">
                <DialogHeader className="sr-only"><DialogTitle>معاينة المرفق</DialogTitle></DialogHeader>
                {/* 🔴 الشرط السحري: لن يتم رسم الصورة إلا إذا كان الرابط موجوداً */}
                {previewImage && (
                    <img src={previewImage} className="w-full h-auto max-h-[90vh] object-contain mx-auto" />
                )}
            </DialogContent>
        </Dialog>

      </div>
    </ProtectedRoute>
  )
}