"use client"

import { useState, useEffect, useMemo } from "react"
import { 
    ChevronLeft, ShieldCheck, Clock, Users, Printer, 
    ArrowRight, Loader2, Calendar, FileSignature, 
    UserCheck, AlertTriangle, CheckCircle2, Trash2, Edit, Save, X,RotateCcw,FileSpreadsheet,BookOpen,Paperclip,ChevronDown
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import * as XLSX from 'xlsx';
import ProtectedRoute from "@/components/ProtectedRoute"
import { format, addDays, isValid } from "date-fns"
import { ar } from "date-fns/locale"
import { useSearchParams } from "next/navigation";
// --- ثوابت النظام ---
const STATUS_TRANSLATIONS: any = {
    "medical": "طبية", "clinic": "عيادة", "leave": "إجازة", "admin_leave": "إجازة إدارية",
    "death_leave": "إجازة وفاة", "late_parade": "تأخير", "late_class": "تأخير حصة",
    "absent": "غياب", "exempt": "إعفاء", "rest": "استراحة", "hospital": "مستشفى", "other": "أخرى"
};

const SESSION_COLORS: any = {
    "sports": "bg-blue-100 text-blue-800 border-blue-200",
    "military": "bg-green-100 text-green-800 border-green-200",
    "combat": "bg-orange-100 text-orange-800 border-orange-200",
    "other": "bg-slate-100 text-slate-800 border-slate-200"
};

export default function SessionAuditPage() {
    // 1. حالات التنقل
    const [viewMode, setViewMode] = useState<'courses' | 'sessions' | 'audit'>('courses');
    const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [selectedCourse, setSelectedCourse] = useState<any>(null);
    const [selectedSession, setSelectedSession] = useState<any>(null);
// حالة نافذة التأكيد الجميلة

    // 2. حالات البيانات
    const [courses, setCourses] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [auditData, setAuditData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
  const [unapproveConfirm, setUnapproveConfirm] = useState<{level: string, label: string} | null>(null);
    // 3. حالات التعديل والاعتماد
    const [isProxyOpen, setIsProxyOpen] = useState(false);
    const [proxyName, setProxyName] = useState("");
    const [confirmDeleteData, setConfirmDeleteData] = useState<any>(null); // لحفظ بيانات السجل المراد حذفه
const [isSaving, setIsSaving] = useState(false); // لحالة حفظ التعديلات
    // حالة تعديل السجل (للحالات فقط)
    const [editingRecord, setEditingRecord] = useState<any>(null); 
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean, 
    type: 'attendance' | 'violation', 
    id: number | null,
    name: string 
}>({
    show: false, 
    type: 'attendance', 
    id: null,
    name: ""
});

const [proxyLevel, setProxyLevel] = useState(""); // لتحديد أي مستوى يتم اعتماده بالنيابة
 const searchParams = useSearchParams();

 // 🟢 كود الاستجابة الذكية للإشعارات (الإصلاح النهائي للاسم)
  useEffect(() => {
    const paramDate = searchParams.get('date');
    const paramCourse = searchParams.get('course');
    const paramBatch = searchParams.get('batch');
    const paramSessionId = searchParams.get('session_id');

    if (paramDate && paramCourse && paramSessionId) {
      
      console.log("🚀 [1] بدأ التفعيل من الإشعار");
      setDate(paramDate);
      setSelectedCourse({
        course: paramCourse,
        batch: paramBatch || ""
      });

      const initializeFromNotification = async () => {
        setLoading(true);
        try {
            // أ) جلب قائمة الحصص
            const templateRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/template?course=${paramCourse}&date=${paramDate}&batch=${paramBatch || ""}`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
            });

            const displayId = Number(paramSessionId) + 1;
            let correctName = `حصة ${displayId}`; 
            let fullSessionData = null;

            if (templateRes.ok) {
                const sessionsList = await templateRes.json();
                setSessions(sessionsList);

                // 🔍 طباعة أول عنصر لفحص البنية
                if (sessionsList.length > 0) {
                    console.log("📦 [2] أول عنصر في القائمة:", sessionsList[0]);
                }

                // 🔍 البحث بمرونة أكبر (تحويل الطرفين لأرقام ثم لنصوص لضمان التطابق)
                // في بعض الأحيان الـ ID يكون Index (0, 1, 2)
                const targetSession = sessionsList.find((s: any, index: number) => {
                    // محاولة 1: مقارنة ID صريح
                    if (String(s.id) === String(paramSessionId)) return true;
                    // محاولة 2: مقارنة الـ Index (لأن الـ ID في الجدول هو الترتيب)
                    if (String(index) === String(paramSessionId)) return true;
                    return false;
                });
                
                if (targetSession) {
                    correctName = targetSession.name || targetSession.label || correctName;
                    fullSessionData = targetSession;
                    console.log("✅ [3] تم العثور على الاسم:", correctName);
                } else {
                    console.warn("⚠️ [3] لم يتم العثور، سنستخدم:", correctName);
                }
            }

            // ب) التحديث النهائي
            setSelectedSession({ 
                ...(fullSessionData || {}), 
                id: paramSessionId, 
                name: correctName, 
                displayId: displayId 
            });

            // ج) جلب بيانات الجدول
            const auditRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/audit-report-data?date=${paramDate}&course=${paramCourse}&batch=${paramBatch || ""}&session_id=${paramSessionId}`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
            });
            
            if (auditRes.ok) {
                setAuditData(await auditRes.json());
                setViewMode('audit');
            }

        } catch (e) {
            console.error("❌ خطأ:", e);
        } finally {
            setLoading(false);
        }
      };

      initializeFromNotification();
    }
  }, [searchParams]);
// --- جلب البيانات ---
useEffect(() => {
    if (viewMode === 'audit' && selectedCourse && selectedSession) {
        // تجهيز الاسم: كشف الحالات والمخالفات - اسم الحصة - اسم الدورة - الدفعة - التاريخ
        const documentTitle = `كشف الحالات والمخالفات - ${selectedSession.name} - ${selectedCourse.course} ${selectedCourse.batch || ""} - ${date}`;
        
        // حفظ العنوان الأصلي لاستعادته لاحقاً
        const originalTitle = document.title;
        document.title = documentTitle;

        // استعادة العنوان الأصلي عند الخروج من وضع التدقيق
        return () => {
            document.title = originalTitle;
        };
    }
}, [viewMode, selectedCourse, selectedSession, date]);
    useEffect(() => { if (viewMode === 'courses') fetchCourses(); }, [date, viewMode]);

    const fetchCourses = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/daily-summaries?date=${date}`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
            });
            if (res.ok) setCourses(await res.json());
        } catch (e) { toast.error("خطأ في الاتصال"); }
        finally { setLoading(false); }
    };

    const handleCourseSelect = async (course: any) => {
        setSelectedCourse(course);
        setLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/template?course=${course.course}&date=${date}&batch=${course.batch}`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
            });
            if (res.ok) {
                setSessions(await res.json());
                setViewMode('sessions');
            }
        } catch (e) { toast.error("خطأ في جلب الجدول"); }
        finally { setLoading(false); }
    };

    const handleSessionSelect = async (session: any, idx: number) => {
        const sessionId = String(idx);
        setSelectedSession({ ...session, id: sessionId, displayId: idx + 1 });
        await fetchAuditData(sessionId);
    };

   const fetchAuditData = async (sessionId: string) => {
    setLoading(true);
    try {
        // 🟢 أضفنا &session_id=${sessionId} لكي نفلتر الأسماء حسب الحصة المختارة
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/audit-report-data?date=${date}&course=${selectedCourse.course}&batch=${selectedCourse.batch}&session_id=${sessionId}`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        if (res.ok) {
            setAuditData(await res.json());
            setViewMode('audit');
        }
    } catch (e) { toast.error("فشل جلب بيانات التدقيق"); }
    finally { setLoading(false); }
};

    // --- العمليات (حذف، تعديل، اعتماد) ---

    // 1. حذف سجل (حالة أو مخالفة)
  // 1. دالة تفتح النافذة وتجهز البيانات (يتم استدعاؤها من زر السلة في الجدول)
const triggerDeleteRecord = (type: 'attendance' | 'violation', id: number, name: string) => {
    setDeleteConfirm({ show: true, type, id, name });
};

// 2. دالة التنفيذ الفعلي (يتم استدعاؤها من زر "نعم" داخل النافذة المنبثقة)
const executeFinalDelete = async () => {
    if (!deleteConfirm.id) return;
    
    setLoading(true);
    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/delete/${deleteConfirm.type}/${deleteConfirm.id}`, {
            method: "DELETE",
            headers: { 
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        const result = await res.json();

        if (res.ok) {
            toast.success(result.message || "تم الحذف بنجاح ✅");
            setDeleteConfirm({ ...deleteConfirm, show: false }); // إغلاق النافذة تلقائياً
            if (selectedSession?.id) await fetchAuditData(selectedSession.id); // تحديث الأرقام والجدول
        } else {
            toast.error(result.detail || "عفواً، لا يمكن الحذف حالياً 🔒");
        }
    } catch (e) {
        toast.error("حدث خطأ في الاتصال بالسيرفر");
    } finally {
        setLoading(false);
    }
};

    // 2. تحديث الملاحظة السريع (Inline Edit)
    const handleUpdateNote = async (type: 'attendance' | 'violation', id: number, newNote: string) => {
        // يمكن بناء API خاص لتحديث الملاحظة فقط، أو استخدام API التعديل الشامل
        // سنفترض وجود API بسيط للتحديث السريع
        try {
            const endpoint = type === 'attendance' ? '/session/attendance/update-note' : '/session/violation/update-note';
            // إذا لم يكن الـ API جاهزاً، يمكنك تخطي هذا الجزء أو إضافته لاحقاً
            console.log(`Updating ${type} ${id} note to: ${newNote}`);
        } catch (e) { console.error(e); }
    };
const executeDeleteAudit = async (mode: 'single' | 'group_full' | 'group_from_today') => {
    if (!confirmDeleteData) return;
    setLoading(true);

    try {
        const token = localStorage.getItem("token");
        // 1. تحديد الرابط بناءً على نوع الحذف
        let url = `${process.env.NEXT_PUBLIC_API_URL}/session/delete/attendance/${confirmDeleteData.id}`;
        
        if (mode === 'group_full' && confirmDeleteData.group_id) {
            url = `${process.env.NEXT_PUBLIC_API_URL}/session/delete-group/${confirmDeleteData.group_id}`;
        } else if (mode === 'group_from_today' && confirmDeleteData.group_id) {
            url = `${process.env.NEXT_PUBLIC_API_URL}/session/terminate-group/${confirmDeleteData.group_id}?from_date=${date}`;
        }

        const res = await fetch(url, { 
            method: "DELETE", 
            headers: { "Authorization": `Bearer ${token}` } 
        });

        const responseData = await res.json();

        if (res.ok) {
            toast.success("تم الحذف بنجاح");
            fetchAuditData(selectedSession.id); // تحديث بيانات الجدول
            setConfirmDeleteData(null);
        } else {
            // رسالة المنع الصارمة في حال وجود اعتماد بالنيابة أو أصالة
            toast.error(responseData.detail || "عفواً، لا يمكن الحذف لوجود حصص معتمدة في هذه السلسلة");
        }
    } catch (e) {
        toast.error("خطأ في الاتصال بالسيرفر");
    } finally {
        setLoading(false);
    }
};
    // 3. حفظ تعديل الحالة (من النافذة المنبثقة)
   const saveEditedAttendance = async (applyToGroup: boolean = false) => {
    if (!editingRecord) return;
    setIsSaving(true);
    try {
        const token = localStorage.getItem("token");
        
        // إذا اختار "السلسلة كاملة" نرسل طلب تعديل المجموعة (تحتاج معالجة في الباك إند)
        // أو نقوم بتنفيذ منطق الحفظ العادي مع إرسال معرف المجموعة
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/attendance/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                ...editingRecord,
                soldier_id: editingRecord.soldier_id,
                date: date,
                session_id: selectedSession.id,
                apply_to_group: applyToGroup, // نمرر هذا المتغير للباك إند
                group_id: editingRecord.group_id
            })
        });

        if (res.ok) {
            toast.success(applyToGroup ? "تم تحديث السلسلة كاملة" : "تم تحديث الحصة بنجاح");
            setIsEditOpen(false);
            fetchAuditData(selectedSession.id);
        }
    } catch (e) { toast.error("فشل حفظ التعديلات"); }
    finally { setIsSaving(false); }
};

    // 🟢 1. تحديث دالة الاعتماد (التي كانت تسمى executeApprove)
    const executeApprove = async (level: string, isProxy: boolean = false) => {
        if (isProxy && !proxyName) return toast.warning("اكتب اسم الضابط المصرح");
        setLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/audit/approve-session`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}` 
                },
                body: JSON.stringify({
                    date, 
                    course: selectedCourse.course, 
                    batch: selectedCourse.batch,
                    session_id: selectedSession.id, 
                    level, 
                    is_proxy: isProxy, 
                    proxy_officer_name: proxyName
                })
            });
            if (res.ok) {
                toast.success(isProxy ? "تم الاعتماد بالنيابة ✅" : "تم الاعتماد بنجاح ✅");
                setIsProxyOpen(false);
                setProxyName(""); // تصفير الاسم بعد النجاح
                fetchAuditData(selectedSession.id);
            }
        } catch (e) { toast.error("فشل العملية"); }
        finally { setLoading(false); }
    };

    // 🟢 2. إضافة دالة فك الاعتماد (handleUnapprove) - كانت ناقصة في كودك
   const handleUnapprove = async (level: string) => {
    setLoading(true);
    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/audit/unapprove-session`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                date,
                course: selectedCourse.course,
                batch: selectedCourse.batch,
                session_id: selectedSession.id,
                level: level // 🟢 إرسال المستوى المطلوب فكه (supervisor أو officer)
            })
        });

        const responseData = await res.json();

        if (res.ok) {
            toast.success(responseData.message || "تم إلغاء الاعتماد بنجاح");
            fetchAuditData(selectedSession.id); // تحديث البيانات فوراً
        } else {
            toast.error(responseData.detail || "فشل إلغاء الاعتماد");
        }
    } catch (e) {
        toast.error("خطأ في الاتصال بالسيرفر");
    } finally {
        setLoading(false);
    }
};
const handleFullExport = () => {
    // 1. تجهيز اسم الملف الديناميكي
    const courseName = selectedCourse?.course || "دورة";
    const batchName = selectedCourse?.batch || "";
    const sessionName = selectedSession?.name || "حصة";
    // تنظيف الاسم ليكون صالحاً كاسم ملف
    const fileName = `كشف الحالات والمخالفات - ${sessionName} - ${courseName} ${batchName} - ${date}.xlsx`;

    // 2. تجهيز بيانات شيت "الحالات"
    const attendanceSheetData = attendanceRows.map((row: any, index: number) => {
        // حساب تاريخ النهاية بدقة
        const startDate = new Date(row.attendance_start_date || date);
        const duration = parseInt(row.attendance_duration) || 1;
        const endDate = addDays(startDate, duration - 1);

        return {
            "#": index + 1,
            "الدورة": selectedCourse?.course,
            "الدفعة": selectedCourse?.batch,
            "السرية": row.company,
            "الفصيل": row.platoon,
            "الاسم": row.name,
            "الرقم العسكري": row.military_id,
            "الحالة": STATUS_TRANSLATIONS[row.attendance_status] || row.attendance_status,
            "المدة": duration,
            "من": format(startDate, "yyyy-MM-dd"),
            "إلى": format(endDate, "yyyy-MM-dd"),
            "الملاحظات": row.attendance_note || "-",
            "المدخل": row.entered_by
        };
    });

    // 3. تجهيز بيانات شيت "المخالفات"
    const violationsSheetData = violationRows.map((row: any, index: number) => ({
        "#": index + 1,
        "الدورة": selectedCourse?.course,
        "الدفعة": selectedCourse?.batch,
        "السرية": row.company,
        "الفصيل": row.platoon,
        "الاسم": row.name,
        "الرقم العسكري": row.military_id,
        "المخالفة": row.violation_name,
        "الجزاء": row.violation_penalty,
        "الملاحظات": row.violation_note || "-",
        "المدخل": row.entered_by
    }));

    // 4. إنشاء ملف الإكسل (Workbook)
    const wb = XLSX.utils.book_new();

    // 5. إنشاء وإضافة شيت الحالات
    // نجبر اتجاه الشيت ليكون من اليمين لليسار (RTL)
    const wsAtt = XLSX.utils.json_to_sheet(attendanceSheetData);
    if(!wsAtt['!views']) wsAtt['!views'] = [];
    wsAtt['!views'].push({ rightToLeft: true });
    // توسيع الأعمدة قليلاً
    wsAtt['!cols'] = [{wch:5}, {wch:20}, {wch:15}, {wch:15}, {wch:15}, {wch:30}, {wch:15}, {wch:15}, {wch:8}, {wch:12}, {wch:12}, {wch:30}, {wch:20}];
    XLSX.utils.book_append_sheet(wb, wsAtt, "الحالات");

    // 6. إنشاء وإضافة شيت المخالفات
    const wsVio = XLSX.utils.json_to_sheet(violationsSheetData);
    if(!wsVio['!views']) wsVio['!views'] = [];
    wsVio['!views'].push({ rightToLeft: true });
    // توسيع الأعمدة
    wsVio['!cols'] = [{wch:5}, {wch:20}, {wch:15}, {wch:15}, {wch:15}, {wch:30}, {wch:15}, {wch:20}, {wch:15}, {wch:30}, {wch:20}];
    XLSX.utils.book_append_sheet(wb, wsVio, "المخالفات");

    // 7. تحميل الملف
    XLSX.writeFile(wb, fileName);
    toast.success("تم تصدير الكشف الشامل بنجاح ✅");
};
    // --- تصفية البيانات للعرض ---
    const attendanceRows = auditData?.attendance_rows || [];
const violationRows = auditData?.violation_rows || [];
    
    // نأخذ الإحصائيات الجاهزة من السيرفر مباشرة دون أي حسابات يدوية هنا
const stats = auditData?.stats || { total: 0, cases: 0, present: 0 };

    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("user") || "{}") : {};
    const isSupervisor = ["military_supervisor", "sports_supervisor", "assistant_admin", "owner"].includes(user.role);
    const isOfficer = ["military_officer", "sports_officer", "owner"].includes(user.role);

    return (
        <ProtectedRoute allowedRoles={["owner", "assistant_admin", "military_officer", "sports_officer", "military_supervisor", "sports_supervisor"]}>
            <div className="p-4 space-y-6 max-w-[1600px] mx-auto min-h-screen bg-slate-50/30 pb-10 md:pb-32" dir="rtl">
                
                <style jsx global>{`
                    @media print {
                        @page { size: A4 Portrait; margin: 5mm; }
                        body { background: white; }
                        .no-print { display: none !important; }
                        .print-border { border: 1px solid #000 !important; }
                        table { page-break-inside: auto; }
                        tr { page-break-inside: avoid; page-break-after: auto; }
                        input { border: none !important; background: transparent !important; }
                    }
                `}</style>

                {/* --- الهيدر (مشترك) --- */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border shadow-sm no-print">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#c5b391]/20 text-[#8a7a5b] rounded-lg"><ShieldCheck className="w-8 h-8"/></div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800"> تدقيق واعتماد </h1>
                            <div className="flex flex-col gap-1.5 no-print">
  <Label className="text-[10px] font-black text-slate-400 mr-1 uppercase tracking-widest">
    تاريخ التدقيق
  </Label>
  
  <div className="relative group">
    {/* أيقونة التقويم الجمالية */}
    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c5b391] group-hover:scale-110 transition-transform" />
    
    <Input 
      type="date" 
      value={date} 
      onChange={(e) => setDate(e.target.value)} 
      className={cn(
        "w-48 h-11 pr-10 font-black text-sm",
        "bg-white border-2 border-slate-100 rounded-xl",
        "shadow-sm cursor-pointer transition-all",
        "hover:border-[#c5b391] hover:shadow-md",
        "focus:ring-2 focus:ring-[#c5b391]/20 focus:border-[#c5b391]"
      )}
    />
    
    {/* لمسة إضافية: سهم صغير يوحي بالقائمة المنسدلة */}
    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
      <ChevronDown className="w-3 h-3" />
    </div>
  </div>
</div>
                        </div>
                    </div>
                    {viewMode !== 'courses' && (
                        <Button variant="outline" onClick={() => setViewMode(viewMode === 'audit' ? 'sessions' : 'courses')}>
                            <ArrowRight className="w-4 h-4 ml-2"/> عودة
                        </Button>
                    )}
                </div>

                {loading && <div className="text-center py-20"><Loader2 className="w-10 h-10 animate-spin mx-auto text-[#c5b391]"/></div>}

                {/* 1️⃣ مشهد الدورات */}
                {!loading && viewMode === 'courses' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
                        {courses.map((c: any, i) => (
                            <Card key={i} onClick={() => handleCourseSelect(c)} className="cursor-pointer hover:border-[#c5b391] hover:shadow-xl transition-all border-2">
                                <CardHeader className="pb-2">
                                    <CardTitle className="flex justify-between items-start font-black text-xl">
    <div className="flex flex-col gap-1">
        <span>{c.course}</span>
        {/* 🟢 إظهار إجمالي القوة لهذه الدورة */}
        <div className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] font-black w-fit">
            القوة: {c.count} {c.course.includes('طالبات') ? 'طالبة' : 'طالب'}
        </div>
    </div>
    <Badge className="bg-blue-600">نشط اليوم</Badge>
</CardTitle>
                                    <CardDescription className="font-bold">الدفعة: {c.batch}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-xs text-slate-400 font-bold flex items-center gap-1">
                                        انقر لعرض جدول الحصص <ChevronLeft className="w-4 h-4"/>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* 2️⃣ مشهد الحصص */}
                {!loading && viewMode === 'sessions' && (
                    <div className="space-y-6 animate-in zoom-in-95">
                        <div className="flex items-center gap-2 font-black text-slate-600 bg-white p-3 rounded-lg border w-fit">
                            <span>{selectedCourse?.course}</span> <ChevronLeft className="w-4 h-4"/> <span>جدول {format(new Date(date), "EEEE", { locale: ar })}</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {sessions.map((sess: any, idx: number) => (
    <div 
        key={idx}
        onClick={() => handleSessionSelect(sess, idx)}
        className="bg-white p-5 rounded-2xl border-2 border-slate-100 hover:border-[#c5b391] hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden"
    >
        <div className="flex justify-between items-start mb-4">
            <div className="bg-[#c5b391]/10 p-2 rounded-lg text-[#c5b391]">
                <BookOpen className="w-6 h-6" />
            </div>
            
            {/* 🟢 إظهار العدادات المزدوجة (حالات ومخالفات) */}
            <div className="flex flex-col gap-1 items-end">
                {sess.cases_count > 0 && (
                    <Badge variant="destructive" className="text-[9px] font-black h-5">
                        حالات: {sess.cases_count}
                    </Badge>
                )}
                {sess.violations_count > 0 && (
                    <Badge className="bg-orange-500 text-white text-[9px] font-black h-5 border-none">
                        مخالفات: {sess.violations_count}
                    </Badge>
                )}
            </div>
        </div>
        
        <h3 className="font-black text-lg text-slate-800">ح{idx + 1}: {sess.name}</h3>
        <p className="text-slate-400 text-[10px] font-bold mt-1">{sess.startTime} - {sess.endTime}</p>
    </div>
))}
                        </div>
                    </div>
                )}

                {/* 3️⃣ مشهد التدقيق (الجدول النهائي) */}
                {!loading && viewMode === 'audit' && auditData && (
                    <div className="bg-white p-8 rounded-3xl shadow-xl border print:shadow-none print:border-none print:p-0">
                        
                        {/* ترويسة الطباعة الرسمية الجديدة */}
<div className="hidden print:flex justify-between items-start border-b-2 border-black pb-4 mb-4">
    
    {/* 1. اليمين: الشعار */}
    <div className="w-1/3 flex justify-start">
    <img src="/logo.jpg" alt="Logo" className="w-24 h-24 object-contain" /> 
</div>

    {/* 2. الوسط: البيانات الإدارية (القسم والدورة) */}
    <div className="w-1/3 text-center pt-2 space-y-2">
        <h2 className="text-xl font-black text-slate-900 leading-tight">قسم التدريب العسكري والرياضي</h2>
        
        {/* اسم الدورة والدفعة داخل إطار أنيق */}
        <div className="inline-block border-2 border-black rounded-lg px-4 py-1 bg-slate-50 mt-1">
            <h3 className="text-lg font-black text-black">
                {selectedCourse.course} 
                {selectedCourse.batch ? ` - ${selectedCourse.batch}` : ""}
            </h3>
        </div>
    </div>

    {/* 3. اليسار: الوقت والتاريخ */}
    <div className="w-1/3 text-left pt-4 pl-2 font-bold text-sm leading-relaxed">
    <p>التاريخ: {date}</p>
    {/* 🟢 التعديل: استخدام 'en-US' لضمان الأرقام الإنجليزية */}
    <p>وقت الطباعة: {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</p>
</div>
</div>

                        {/* داخل الـ div الذي يحتوي على عنوان الحصة وزر الطباعة (تقريباً سطر 219) */}
<div className="flex justify-between items-center mb-6 no-print">
    <div className="space-y-1">
        <h2 className="text-2xl font-black text-slate-800">{selectedSession.name} <span className="text-base font-medium text-slate-400">({selectedSession.displayId})</span></h2>
        <p className="text-xs font-bold text-[#c5b391]">تدقيق واعتماد الحصة</p>
    </div>
    
    <div className="flex gap-2">
        {/* 🟢 الزر الجديد: تصدير إكسل شامل */}
        <Button 
            onClick={handleFullExport} 
            className="bg-green-700 hover:bg-green-800 text-white gap-2 font-bold shadow-md"
        >
            <FileSpreadsheet className="w-4 h-4" />  Excel
        </Button>

        {/* زر الطباعة القديم كما هو */}
        <Button onClick={() => window.print()} className="bg-slate-900 text-white gap-2 font-bold">
            <Printer className="w-4 h-4"/> طباعة 
        </Button>
    </div>
</div>

                       <div className="text-center mb-6 mt-2">
    <div className="inline-block min-w-[300px] border-2 border-black rounded-xl overflow-hidden shadow-sm">
        {/* السطر العلوي: العنوان الثابت */}
        <h1 className="text-xl font-black bg-[#c5b391] text-black py-2 border-b-2 border-black [-webkit-print-color-adjust:exact]">
            كشف الحالات والمخالفات
        </h1>
        
        {/* السطر السفلي: اسم الحصة المتغير */}
        <div className="bg-white py-1.5 px-6">
            <p className="text-lg font-black text-slate-800">
                {selectedSession.name}
            </p>
        </div>
    </div>
</div>
{/* 🟢 جدول القوة الشامل والمحدث */}
{/* 🟢 حاوية الجدول: تضمن عدم وجود هوامش زائدة عند الطباعة */}
<div className="overflow-x-auto rounded-xl border-2 border-[#c5b391] shadow-md mb-8 print:border-black print:rounded-none print:shadow-none print:m-0 print:w-full">
    <table className="w-full text-center text-sm border-collapse print:table-fixed print:w-full">
        <thead className="bg-[#c5b391] text-black font-black print:bg-[#c5b391]! [-webkit-print-color-adjust:exact]">
            <tr className="divide-x divide-black print:divide-black">
                {/* 🎯 توزيع النسب المئوية بدقة لضمان احتواء الـ 14 عموداً */}
                <th className="p-2 print:p-1 print:text-[9px] print:w-[8%] border-black">القوة</th>
                <th className="p-2 print:p-1 print:text-[9px] print:w-[7%] border-black">طبية</th>
                <th className="p-2 print:p-1 print:text-[9px] print:w-[7%] border-black">عيادة</th>
                <th className="p-2 print:p-1 print:text-[9px] print:w-[7%] border-black">مستشفى</th>
                <th className="p-2 print:p-1 print:text-[9px] print:w-[7%] border-black">إجازة</th>
                <th className="p-2 print:p-1 print:text-[9px] print:w-[7%] border-black">إ.إدارية</th>
                <th className="p-2 print:p-1 print:text-[9px] print:w-[7%] border-black">إ.وفاة</th>
                <th className="p-2 print:p-1 print:text-[9px] print:w-[7%] border-black">تأخير</th>
                <th className="p-2 print:p-1 print:text-[9px] print:w-[7%] border-black">استراحة</th>
                <th className="p-2 print:p-1 print:text-[9px] print:w-[7%] border-black bg-[#b5a381]! print:bg-[#b5a381]!">إعفاء</th>
                <th className="p-2 print:p-1 print:text-[9px] print:w-[7%] border-black">غياب</th>
                <th className="p-2 print:p-1 print:text-[9px] print:w-[7%] border-black">أخرى</th>
                <th className="p-2 print:p-1 print:text-[9px] print:w-[8%] border-black bg-blue-50/50">الحالات</th>
                <th className="p-2 print:p-1 print:text-[9px] print:w-[10%] border-black bg-green-50/50">الموجود</th>
            </tr>
        </thead>
        <tbody className="bg-white font-black text-slate-700 print:text-black">
            <tr className="divide-x divide-black border-b border-black print:divide-black">
                <td className="p-2 print:p-1 print:text-[10px] bg-slate-50">{stats.total}</td>
                <td className="p-2 print:p-1 print:text-[10px] text-red-600">{stats.medical || "-"}</td>
                <td className="p-2 print:p-1 print:text-[10px] text-red-600">{stats.clinic || "-"}</td>
                <td className="p-2 print:p-1 print:text-[10px] text-red-600">{stats.hospital || "-"}</td>
                <td className="p-2 print:p-1 print:text-[10px] text-red-600">{stats.leave || "-"}</td>
                <td className="p-2 print:p-1 print:text-[10px] text-red-600">{stats.admin_leave || "-"}</td>
                <td className="p-2 print:p-1 print:text-[10px] text-red-600">{stats.death_leave || "-"}</td>
                <td className="p-2 print:p-1 print:text-[10px] text-red-600">{stats.late_parade || "-"}</td>
                <td className="p-2 print:p-1 print:text-[10px] text-red-600">{stats.rest || "-"}</td>
                <td className="p-2 print:p-1 print:text-[10px] text-red-600">{stats.exempt || "-"}</td>
                <td className="p-2 print:p-1 print:text-[10px] text-red-600">{stats.absent || "-"}</td>
                <td className="p-2 print:p-1 print:text-[10px] text-red-600">{stats.other || "-"}</td>
                <td className="p-2 print:p-1 print:text-[11px] text-red-700 bg-blue-50/30">{stats.cases}</td>
                <td className="p-2 print:p-1 print:text-[11px] text-green-700 bg-green-50/30">{stats.present}</td>
            </tr>
        </tbody>
    </table>
</div>

                        {/* أولاً: جدول الحالات */}
                        <div className="mb-10">
                            <h3 className="text-lg font-black text-slate-800 mb-3 flex items-center gap-2">
                                <span className="bg-blue-600 w-2 h-6 rounded-full"/> أولاً: سجل الحالات والغياب
                            </h3>
                            <div className="border border-slate-300 rounded-lg overflow-hidden print:border-black">
                                <Table>
                                    <TableHeader className="bg-[#c5b391] print:bg-[#c5b391]! [-webkit-print-color-adjust:exact]">
    <TableRow className="print:border-b-2 print:border-black">
                                            
                                            <TableHead className="text-center font-black text-black w-10 border-l border-slate-300 print:border-black">#</TableHead>
                                            <TableHead className="text-right font-black text-black border-l border-slate-300 print:border-black w-64">البيانات العسكرية</TableHead>
                                            <TableHead className="text-center font-black text-black border-l border-slate-300 print:border-black">الحالة</TableHead>
                                            <TableHead className="text-center font-black text-black border-l border-slate-300 print:border-black w-16">المدة</TableHead>
                                            <TableHead className="text-center font-black text-black border-l border-slate-300 print:border-black w-24">من</TableHead>
                                            <TableHead className="text-center font-black text-black border-l border-slate-300 print:border-black w-24">إلى</TableHead>
                                            <TableHead className="text-right font-black text-black border-l border-slate-300 print:border-black">الملاحظات</TableHead>
                                            <TableHead className="text-center font-black text-black border-l border-slate-300 print:hidden w-16">المرفق</TableHead>
                                            <TableHead className="text-center font-black text-black border-l border-slate-300 print:border-black w-24 print:w-20 print:text-[9px]">
    المدخل
</TableHead>
                                            <TableHead className="text-center font-black text-black w-20 no-print">إجراء</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {attendanceRows.length === 0 ? (
    <TableRow><TableCell colSpan={9} className="text-center py-6 text-slate-400 font-bold">لا توجد حالات مسجلة</TableCell></TableRow>
) : attendanceRows.map((row: any, idx: number) => {
    
    // 1. تحديد تاريخ البداية (الأولوية للتاريخ المسجل في السجل نفسه، ثم تاريخ اليوم المختار كاحتياط)
    const rawStart = row.attendance_start_date || date;
    const startDate = new Date(rawStart);
    
    // 2. جلب المدة (تحويلها لرقم، وإذا كانت فارغة نعتبرها 1)
    const duration = parseInt(row.attendance_duration) || 1;
    
    // 3. حساب تاريخ النهاية (تاريخ البداية + المدة - 1)
    // المنطق العسكري: إذا كانت المدة يوم واحد تبدأ اليوم، فهي تنتهي اليوم أيضاً.
    const endDate = addDays(startDate, duration - 1);
    
    return (
        <TableRow key={idx} className="border-b border-slate-300 print:border-black hover:bg-slate-50">
            <TableCell className="text-center font-bold border-l border-slate-300 print:border-black">{idx + 1}</TableCell>
            
            <TableCell className="text-right border-l border-slate-300 print:border-black p-2">
    <div className="flex flex-col gap-0.5">
        {/* السطر الأول: الاسم الكامل بخط بارز */}
        <div className="font-black text-sm text-slate-900 leading-tight">{row.name}</div>
        
        {/* السطر الثاني: دمج كل البيانات العسكرية في سطر واحد */}
        <div className="text-[10px] text-blue-800 font-bold flex items-center flex-wrap gap-1">
            <span className="bg-slate-100 px-1 rounded text-slate-700">{row.rank}</span>
            <span className="text-slate-300">|</span>
            <span className="font-mono text-blue-700">{row.military_id}</span>
            <span className="text-slate-300">|</span>
            <span className="text-orange-700 italic"> {row.company}</span>
            <span className="text-slate-300">/</span>
            <span className="text-orange-700 italic"> {row.platoon}</span>
        </div>
    </div>
</TableCell>

            <TableCell className="text-center font-bold text-blue-700 border-l border-slate-300 print:border-black">
    {/* 🟢 منطق الترجمة الذكي */}
    {STATUS_TRANSLATIONS[row.attendance_status] || row.attendance_status}
</TableCell>

            {/* 🟢 عرض المدة بشكل واضح */}
            <TableCell className="text-center font-black border-l border-slate-300 print:border-black">
                {duration} {duration > 2 ? "أيام" : "يوم"}
            </TableCell>

            {/* 🟢 عرض تاريخ البداية */}
            <TableCell className="text-center text-xs font-bold border-l border-slate-300 print:border-black">
                {isValid(startDate) ? format(startDate, "yyyy-MM-dd") : "-"}
            </TableCell>

            {/* 🟢 عرض تاريخ النهاية المحسوب (باللون الأحمر للتميز) */}
            <TableCell className="text-center text-xs font-black border-l border-slate-300 print:border-black text-red-600">
                {isValid(endDate) ? format(endDate, "yyyy-MM-dd") : "-"}
            </TableCell>
                                                    <TableCell className="p-0 border-l border-slate-300 print:border-black">
                                                        <input 
                                                            className="w-full h-full px-2 bg-transparent outline-none text-xs font-bold text-slate-700 placeholder:text-slate-300" 
                                                            defaultValue={row.attendance_note}
                                                            placeholder="اكتب ملاحظة..."
                                                            onBlur={(e) => handleUpdateNote('attendance', row.attendance_id, e.target.value)} // تحديث عند الخروج
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-center border-l border-slate-300 print:hidden p-1">
    <div className="flex justify-center gap-1 flex-wrap">
        {row.attachments && row.attachments.length > 0 ? (
            row.attachments.map((url: string, i: number) => (
                <a 
                    key={i} 
                    href={url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="p-1.5 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-all hover:scale-110"
                    title="عرض المستند المرفق"
                >
                    <Paperclip className="w-3.5 h-3.5" />
                </a>
            ))
        ) : (
            <span className="text-slate-300">-</span>
        )}
    </div>
</TableCell>
                                                    <TableCell className="text-center border-l border-slate-300 print:border-black p-1">
    <div className="w-24 print:w-16 mx-auto leading-tight break-words whitespace-normal text-[10px] print:text-[8px] font-bold text-slate-500 print:text-black">
        {row.entered_by}
    </div>
</TableCell>
                                                    <TableCell className="text-center no-print">
                                                        <div className="flex justify-center gap-1">
                                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-blue-600" onClick={() => {
                                                                setEditingRecord({ 
                                                                    id: row.attendance_id, 
                                                                    soldier_id: row.soldier_id,
                                                                    name: row.name, 
                                                                    status: row.attendance_status, // يحتاج تحويل للكود الإنجليزي إذا لزم
                                                                    duration: row.attendance_duration || 1,
                                                                    note: row.attendance_note
                                                                });
                                                                setIsEditOpen(true);
                                                            }}>
                                                                <Edit className="w-3 h-3"/>
                                                            </Button>
                                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600" 
    onClick={() => setConfirmDeleteData({ 
        id: row.attendance_id, 
        group_id: row.group_id, 
        name: row.name 
    })}
>
    <Trash2 className="w-3 h-3"/>
</Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* ثانياً: جدول المخالفات */}
                        <div className="mb-12">
                            <h3 className="text-lg font-black text-slate-800 mb-3 flex items-center gap-2">
                                <span className="bg-red-600 w-2 h-6 rounded-full"/> ثانياً: سجل المخالفات والانضباط
                            </h3>
                            <div className="border border-slate-300 rounded-lg overflow-hidden print:border-black">
                                <Table>
                                    <TableHeader className="bg-[#c5b391] print:bg-[#c5b391]! [-webkit-print-color-adjust:exact]">
    <TableRow className="print:border-b-2 print:border-black">
        <TableHead className="text-center font-black text-black w-10 border-l border-slate-300 print:border-black">#</TableHead>
        <TableHead className="text-right font-black text-black border-l border-slate-300 print:border-black w-64">البيانات العسكرية</TableHead>
        
        {/* 🟢 تم زيادة العرض هنا (min-w) لضمان مساحة كافية للمخالفة */}
        <TableHead className="text-right font-black text-black border-l border-slate-300 print:border-black min-w-[300px] md:min-w-[400px]">
            المخالفة
        </TableHead>

        <TableHead className="text-center font-black text-black border-l border-slate-300 print:border-black w-[120px] print:w-[100px]">
            الجزاء
        </TableHead>
        <TableHead className="text-right font-black text-black border-l border-slate-300 print:border-black">الملاحظات</TableHead>
        <TableHead className="text-center font-black text-black border-l border-slate-300 print:hidden w-16">المرفق</TableHead>
        
        {/* 🟢 توحيد مقاس عمود المدخل مع جدول الحالات */}
        <TableHead className="text-center font-black text-black border-l border-slate-300 print:border-black w-24 print:w-20 print:text-[9px]">
            المدخل
        </TableHead>
        
        <TableHead className="text-center font-black text-black w-16 no-print">إجراء</TableHead>
    </TableRow>
</TableHeader>
                                    <TableBody>
                                        {violationRows.length === 0 ? (
                                            <TableRow><TableCell colSpan={7} className="text-center py-6 text-slate-400 font-bold">لا توجد مخالفات مسجلة</TableCell></TableRow>
                                        ) : violationRows.map((row: any, idx: number) => (
                                            <TableRow key={idx} className="border-b border-slate-300 print:border-black hover:bg-slate-50">
                                                <TableCell className="text-center font-bold border-l border-slate-300 print:border-black">{idx + 1}</TableCell>
                                                <TableCell className="text-right border-l border-slate-300 print:border-black p-2 w-[250px] print:w-[220px]">
    <div className="flex flex-col gap-0.5">
        {/* الاسم */}
        <div className="font-black text-sm text-slate-900 leading-tight">{row.name}</div>
        
        {/* البيانات المدمجة (رتبة | رقم | سرية / فصيل) */}
        <div className="text-[10px] text-red-800 font-bold flex items-center flex-wrap gap-1">
            <span className="bg-red-50 px-1 rounded text-red-700">{row.rank}</span>
            <span className="text-slate-300">|</span>
            <span className="font-mono">{row.military_id}</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-600 italic font-black text-[9px]"> {row.company}</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-600 italic font-black text-[9px]"> {row.platoon}</span>
        </div>
    </div>
</TableCell>
                                                <TableCell className="text-right border-l border-slate-300 print:border-black p-2 align-top">
            <div className="whitespace-normal break-words leading-relaxed font-bold text-slate-800 text-xs md:text-sm print:text-[10px]">
                {row.violation_name}
            </div>
        </TableCell>
                                                <TableCell className="text-center border-l border-slate-300 print:border-black p-2 align-middle">
    {/* 🟢 العرض محدد بـ 100 بكسل مع تفعيل الالتفاف */}
    <div className="max-w-[120px] print:max-w-[100px] whitespace-normal break-words leading-tight font-bold text-red-700 text-xs print:text-[9px]">
        {row.violation_penalty}
    </div>
</TableCell>
                                                <TableCell className="p-0 border-l border-slate-300 print:border-black">
                                                    <input 
                                                        className="w-full h-full px-2 bg-transparent outline-none text-xs font-bold text-slate-700 placeholder:text-slate-300" 
                                                        defaultValue={row.violation_note}
                                                        placeholder="ملاحظة..."
                                                        onBlur={(e) => handleUpdateNote('violation', row.violation_id, e.target.value)}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center border-l border-slate-300 print:hidden p-1">
    <div className="flex justify-center gap-1 flex-wrap">
        {row.attachments && row.attachments.length > 0 ? (
            row.attachments.map((url: string, i: number) => (
                <a 
                    key={i} 
                    href={url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="p-1.5 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-all hover:scale-110"
                    title="عرض دليل المخالفة"
                >
                    <Paperclip className="w-3.5 h-3.5" />
                </a>
            ))
        ) : (
            <span className="text-slate-300">-</span>
        )}
    </div>
</TableCell>
                                                <TableCell className="text-center border-l border-slate-300 print:border-black p-1">
            <div className="w-24 print:w-16 mx-auto leading-tight break-words whitespace-normal text-[10px] print:text-[8px] font-bold text-slate-500 print:text-black">
                {row.entered_by}
            </div>
        </TableCell>
                                                <TableCell className="text-center no-print">
                                                    <Button 
    size="icon" 
    variant="ghost" 
    className="h-6 w-6 text-red-600 no-print" 
    onClick={() => triggerDeleteRecord('violation', row.violation_id, row.name)} // 👈 أضفنا row.name
>
    <Trash2 className="w-3 h-3"/>
</Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                       <div className="grid grid-cols-3 gap-10 mt-20 pt-8 border-t-2 border-black break-inside-avoid">
    {['supervisor', 'officer', 'head'].map(role => {
        const app = auditData.approvals[role];
        const labels: any = { 
            'supervisor': 'مشرف التدريب', 
            'officer': 'ضابط التدريب', 
            'head': 'رئيس قسم التدريب العسكري والرياضي' 
        };
        
        const userStr = localStorage.getItem("user");
        const currentUser = JSON.parse(userStr || "{}");
        const userRole = currentUser.role;
        const isActualOfficer = currentUser.role.includes('officer') || currentUser.role === 'owner';
        // 🛡️ [ميزان القوى]: تحديد من يملك حق فك الاعتماد
        // 🛡️ [ميزان القوى المطور]: تحديد من يملك حق فك الاعتماد
let canUnapprove = false;

// 1. المالك (Owner) يفك كل شيء دائماً
if (userRole === 'owner') {
    canUnapprove = true;
} 
// 2. منطق المشرفين (يشمل مساعد المسؤول والمشرف الرياضي/العسكري)
else if (userRole === 'assistant_admin' || userRole.includes('supervisor')) {
    
    if (role === 'supervisor') {
        // يفك خانة المشرف بشرط عدم وجود توقيع ضابط "أصلي" فوقه
        const isOfficerOriginal = auditData.approvals['officer'] && !auditData.approvals['officer'].is_proxy;
        if (!isOfficerOriginal) canUnapprove = true;
    } 
    else if (role === 'officer') {
        // 🟢 [الاستثناء المطلوب]: يفك خانة الضابط فقط "إذا كانت بالنيابة"
        if (app?.is_proxy) canUnapprove = true;
    }
}
// 3. منطق الضباط (Officer)
else if (userRole.includes('officer')) {
    // الضابط يفك خانة الضابط (أصالة أو نيابة) ويفك خانة المشرف
    if (role === 'officer' || role === 'supervisor') canUnapprove = true;
}

       return (
    <div key={role} className="text-center flex flex-col items-center gap-2 relative group">
        {/* 1. المسمى الوظيفي (مشرف، ضابط، رئيس القسم) */}
        <p className="font-black text-[13px] underline underline-offset-4 mb-4">{labels[role]}</p>
        
        {app ? (
            /* --- الحالة: تم الاعتماد (ظهور التوقيع أو علامة النيابة) --- */
            <div className="animate-in zoom-in flex flex-col items-center">
                {/* 🔄 زر فك الاعتماد (اللفافة الحمراء) - يظهر بناءً على ميزان القوى الجديد */}
                {role !== 'head' && canUnapprove && (
                    <Button 
                        variant="ghost" size="icon" 
                        className="no-print absolute -top-4 -right-6 text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-full shadow-sm"
                        onClick={() => setUnapproveConfirm({level: role, label: labels[role]})}
                    >
                        <RotateCcw className="w-4 h-4" />
                    </Button>
                )}
                
                {/* بيانات الرتبة والاسم للمعتمد */}
                <p className="font-bold text-blue-900 text-[13px] leading-tight">{app.rank} / {app.name}</p>

{/* 🟢 إظهار وسم النيابة فقط تحت الاسم */}
{app.is_proxy && <p className="text-[10px] text-red-600 font-black tracking-tighter">(بـالـنـيـابـة)</p>}

{/* 🖼️ عرض التوقيع الإلكتروني - تم إضافة خصائص التصغير عند الطباعة */}
<div className="h-14 mt-1 flex items-center justify-center print:h-14 print:mt-0"> 
    {app.mil_id ? (
        <img 
            src={`https://cynkoossuwenqxksbdhi.supabase.co/storage/v1/object/public/Signatures/${app.mil_id}.png`} 
            // 🟢 أضفنا print:max-h-8 لضمان عدم تجاوز الصورة للارتفاع الجديد
            className="h-full object-contain mix-blend-multiply transition-all hover:scale-110 print:max-h-14"
            onError={(e:any) => {
                const target = e.target;
                if (target.src.includes('.png')) target.src = target.src.replace('.png', '.jpg');
                else if (target.src.includes('.jpg')) target.src = target.src.replace('.jpg', '.jpeg');
                else target.style.display='none';
            }}
        />
    ) : null}
</div>
                
            </div>
        ) : (
            /* --- الحالة: بانتظار الاعتماد (ظهور أزرار التوقيع) --- */
            <div className="no-print mt-2 min-h-[70px] flex items-center justify-center">
                {role === 'head' ? (
                    /* 🟢 رئيس القسم: نص فقط بدون أي أزرار كما طلبت */
                    <p className="italic text-slate-300 text-[10px] font-bold border border-dashed p-2 rounded text-center leading-relaxed">
                        التوقيع 
                    </p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {/* 1. زر اعتماد المشرف: يظهر للمشرفين ومساعد المسؤول والضباط */}
                        {role === 'supervisor' && (
                            <Button 
                                onClick={() => executeApprove('supervisor')} 
                                size="sm" variant="outline" 
                                className="text-xs font-black border-[#c5b391] text-[#c5b391] hover:bg-[#c5b391]/10"
                            >
                                اعتماد المشرف
                            </Button>
                        )}
                        
                        {/* 2. زر توقيع الضابط: يظهر "فقط" للضابط الفعلي أو المالك (لا يظهر للمشرف) */}
                        {role === 'officer' && (userRole.includes('officer') || userRole === 'owner') && (
                            <Button 
                                onClick={() => executeApprove('officer')} 
                                size="sm" 
                                className="bg-blue-700 text-white text-[11px] font-black px-4 shadow-md"
                                disabled={!auditData.approvals.supervisor && userRole !== 'owner'}
                            >
                                توقيع الضابط
                            </Button>
                        )}

                        {/* 3. زر الاعتماد بالنيابة: يظهر للمشرف ومساعد المسؤول (لتسجيل موافقة الضابط هاتفياً مثلاً) */}
                        {role === 'officer' && (userRole.includes('supervisor') || userRole === 'assistant_admin' || userRole === 'owner') && (
                            <Button 
                                onClick={() => { setProxyLevel('officer'); setIsProxyOpen(true); }} 
                                size="sm" variant="ghost" 
                                className="text-[10px] text-orange-600 font-black hover:text-orange-700 hover:bg-orange-50 underline decoration-dotted"
                                disabled={!auditData.approvals.supervisor && userRole !== 'owner'}
                            >
                                اعتماد بالنيابة
                            </Button>
                        )}

                        {/* تنبيه في حال عدم وجود توقيع مشرف مسبق */}
                        {!auditData.approvals.supervisor && role === 'officer' && (
                            <p className="text-[9px] text-slate-300 font-bold max-w-[80px] text-center">بانتظار توقيع المشرف</p>
                        )}
                    </div>
                )}
            </div>
        )}
    </div>
)
    })}
</div>
                    </div>
                )}

                {/* ✏️ نافذة تعديل الحالة المطورة (تدقيق) */}
<Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
    <DialogContent className="max-w-md border-2 border-slate-200" dir="rtl">
        <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-2 text-slate-800">
                <Edit className="w-5 h-5 text-blue-600" /> تعديل سجل: {editingRecord?.name}
            </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-6">
            {/* 🔵 عرض الحالة الحالية المسجلة */}
            <div className="bg-blue-50 p-3 rounded-xl flex justify-between items-center border border-blue-100 shadow-sm">
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">الحالة الحالية</span>
                    <span className="text-sm font-black text-blue-900">
                        {/* فحص الترجمة للحالة المخزنة */}
                        {STATUS_TRANSLATIONS[editingRecord?.status] || editingRecord?.status || "غير محدد"}
                    </span>
                </div>
                <Badge className="bg-blue-600 hover:bg-blue-700 font-black px-3 py-1">قيد التعديل</Badge>
            </div>

            {/* اختيار الحالة الجديدة */}
            <div className="space-y-2">
                <Label className="text-xs font-bold mr-1">تغيير نوع الحالة:</Label>
                <Select 
                    value={editingRecord?.status} 
                    onValueChange={(v) => setEditingRecord({...editingRecord, status: v})}
                >
                    <SelectTrigger className="h-11 font-bold border-slate-300 focus:ring-blue-500">
                        <SelectValue placeholder="اختر الحالة الجديدة" />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(STATUS_TRANSLATIONS).map(([k, v]: any) => (
                            <SelectItem key={k} value={k} className="font-bold">{v}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* المدة والملاحظات في صف واحد */}
            <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1 space-y-2">
                    <Label className="text-xs font-bold mr-1">المدة (أيام)</Label>
                    <Input 
                        type="number" 
                        min="1" 
                        value={editingRecord?.duration} 
                        onChange={(e) => setEditingRecord({...editingRecord, duration: e.target.value})} 
                        className="h-11 font-black text-center border-slate-300"
                    />
                </div>
                <div className="col-span-2 space-y-2">
                    <Label className="text-xs font-bold mr-1">ملاحظات إضافية</Label>
                    <Input 
                        value={editingRecord?.note || ""} 
                        onChange={(e) => setEditingRecord({...editingRecord, note: e.target.value})} 
                        placeholder="سبب التعديل أو ملاحظة..."
                        className="h-11 font-bold border-slate-300"
                    />
                </div>
            </div>
            
            <p className="text-[9px] text-slate-400 text-center italic mt-2">
                * ملاحظة: يمكنك اختيار تعديل هذه الحصة فقط أو تعميم التعديل على السلسلة كاملة.
            </p>
        </div>

        <DialogFooter className="flex flex-col sm:flex-col gap-2 p-4 bg-slate-50 rounded-b-lg border-t">
            {/* الزر الأول: تعديل الحصة الحالية فقط */}
            <Button 
                onClick={() => saveEditedAttendance(false)} 
                className="w-full h-11 bg-slate-900 text-white font-bold gap-2 shadow-lg"
                disabled={isSaving}
            >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                حفظ لهذه الحصة فقط
            </Button>

            {/* الزر الثاني: تعديل السلسلة كاملة */}
            <Button 
                onClick={() => saveEditedAttendance(true)} 
                variant="outline"
                className="w-full h-11 border-blue-600 text-blue-700 hover:bg-blue-50 font-bold gap-2"
                disabled={isSaving}
            >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                تعديل وتعميم على السلسلة كاملة
            </Button>

            {/* زر الإلغاء */}
            <Button 
                variant="ghost" 
                onClick={() => setIsEditOpen(false)} 
                className="text-slate-400 text-xs font-bold"
                disabled={isSaving}
            >
                إلغاء وتراجع
            </Button>
        </DialogFooter>
    </DialogContent>
</Dialog>

                {/* 🛡️ نافذة الاعتماد بالنيابة */}
                <Dialog open={isProxyOpen} onOpenChange={setIsProxyOpen}>
    <DialogContent 
        className="max-w-sm" dir="rtl"
        onOpenAutoFocus={(e) => e.preventDefault()} // 👈 هذا السطر يحل مشكلة الـ Focus Warning
    >
                        <DialogHeader>
                            <DialogTitle className="text-orange-600 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> اعتماد بالنيابة</DialogTitle>
                            <DialogDescription>يستخدم عند أخذ موافقة شفهية من الضابط.</DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <Label className="mb-2 block">اسم الضابط المصرح:</Label>
                            <Input placeholder="الرتبة والاسم..." value={proxyName} onChange={(e) => setProxyName(e.target.value)} className="font-bold"/>
                        </div>
                        <DialogFooter>
                            <Button onClick={() => executeApprove('officer', true)} className="w-full bg-slate-900 text-white font-bold">تأكيد الاعتماد</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
<Dialog open={!!confirmDeleteData} onOpenChange={() => setConfirmDeleteData(null)}>
    <DialogContent className="max-w-md border-2 border-red-500" dir="rtl">
        <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5"/> إدارة حذف حالة: {confirmDeleteData?.name}
            </DialogTitle>
            <DialogDescription className="font-bold text-xs text-slate-500">
                هذا السجل قد يكون جزءاً من سلسلة (إجازة/طبية). حدد نطاق الحذف المطلوب:
            </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 py-4">
            <Button variant="outline" className="justify-start h-12 gap-3" onClick={() => executeDeleteAudit('single')} disabled={loading}>
                {loading ? <Loader2 className="animate-spin w-4 h-4"/> : <span className="bg-slate-100 p-1 rounded text-[10px]">1</span>}
                حذف هذه الحصة فقط ({selectedSession?.name})
            </Button>
            
            <Button variant="outline" className="justify-start h-12 gap-3 border-orange-200 text-orange-700 hover:bg-orange-50" onClick={() => executeDeleteAudit('group_from_today')} disabled={loading}>
                {loading ? <Loader2 className="animate-spin w-4 h-4"/> : <span className="bg-orange-100 p-1 rounded text-[10px]">2</span>}
                إنهاء الحالة من تاريخ اليوم فصاعداً
            </Button>

            <Button variant="destructive" className="justify-start h-12 gap-3 bg-red-600" onClick={() => executeDeleteAudit('group_full')} disabled={loading}>
                {loading ? <Loader2 className="animate-spin w-4 h-4"/> : <span className="bg-white/20 p-1 rounded text-[10px]">3</span>}
                إلغاء السلسلة كاملة (حذف كافة الأيام المرتبطة)
            </Button>
        </div>
        <DialogFooter className="bg-slate-50 p-2">
            <Button variant="ghost" onClick={() => setConfirmDeleteData(null)} className="w-full">تراجع</Button>
        </DialogFooter>
    </DialogContent>
</Dialog>
<Dialog open={isProxyOpen} onOpenChange={setIsProxyOpen}>
    <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
            <DialogTitle className="text-orange-600 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5"/> اعتماد بالنيابة (موافقة شفهية)
            </DialogTitle>
            <DialogDescription className="text-xs font-bold">
                سيتم تسجيل هذا الاعتماد باسمك كمسؤول عن صحة الموافقة.
            </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-3">
            <Label className="text-xs font-bold">اسم ورتبة الضابط المصرح:</Label>
            <Input 
                placeholder="مثال: مقدم/ فلان الفلاني..." 
                value={proxyName} 
                onChange={(e) => setProxyName(e.target.value)} 
                className="font-bold border-orange-200 focus:ring-orange-500"
            />
        </div>
        <DialogFooter>
            <Button 
                onClick={() => executeApprove(proxyLevel, true)}
                className="w-full bg-orange-600 text-white font-bold hover:bg-orange-700"
            >
                تأكيد الاعتماد بالنيابة
            </Button>
        </DialogFooter>
    </DialogContent>
</Dialog>
<Dialog open={!!unapproveConfirm} onOpenChange={() => setUnapproveConfirm(null)}>
    <DialogContent className="max-w-sm border-2 border-red-500" dir="rtl">
        <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
                <RotateCcw className="w-5 h-5"/> تراجع عن الاعتماد
            </DialogTitle>
            <DialogDescription className="font-bold py-2">
                هل أنت متأكد من إلغاء اعتماد <span className="text-red-600">[{unapproveConfirm?.label}]</span>؟ 
                سيتم إعادة فتح الحصة للتعديل والحذف مجدداً.
            </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setUnapproveConfirm(null)} className="flex-1">إلغاء</Button>
            <Button 
                variant="destructive" 
                className="flex-1 font-bold"
                onClick={() => {
                    handleUnapprove(unapproveConfirm!.level);
                    setUnapproveConfirm(null);
                }}
            >
                تأكيد الفك
            </Button>
        </DialogFooter>
    </DialogContent>
</Dialog>
{/* 🗑️ نافذة تأكيد الحذف الاحترافية الجديدة */}
<Dialog open={deleteConfirm.show} onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, show: open })}>
    <DialogContent className="max-w-sm rounded-3xl border-none shadow-2xl p-0 overflow-hidden" dir="rtl">
        <div className="bg-red-50 p-6 flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-2">
                <Trash2 className="w-8 h-8 text-red-500 animate-pulse" />
            </div>
            <DialogTitle className="text-xl font-black text-red-900">تأكيد الحذف النهائي</DialogTitle>
        </div>

        <div className="p-6">
    {/* قمنا بتغيير الوسم هنا ليكون div بدلاً من DialogDescription إذا كنت تريد وضع بلوكات بداخله */}
    <div className="text-center text-slate-600 font-bold leading-relaxed">
        هل أنت متأكد من رغبتك في حذف سجل <br/>
        <span className="text-slate-900 font-black text-base">"{deleteConfirm.name}"</span>؟
        
        {/* تم تغيير p هنا إلى div لحل مشكلة المتصفح نهائياً */}
        <div className="text-[11px] text-red-500 mt-3 bg-red-50 p-2 rounded-lg border border-red-100">
            * هذا الإجراء سيقوم بمسح البيانات نهائياً من سجلات الجندي.
        </div>
    </div>

    {/* باقي الكود (الأزرار) كما هو تماماً */}
    <div className="flex gap-3 mt-8">
        <Button 
            onClick={executeFinalDelete}
            disabled={loading}
            className="flex-1 h-12 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-lg shadow-red-100 transition-all active:scale-95"
        >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "نعم، متأكد"}
        </Button>

        <Button 
            variant="outline"
            onClick={() => setDeleteConfirm({ ...deleteConfirm, show: false })}
            disabled={loading}
            className="flex-1 h-12 border-slate-200 text-slate-500 font-bold rounded-xl hover:bg-slate-50 transition-all"
        >
            تراجع
        </Button>
    </div>
</div>
    </DialogContent>
</Dialog>
            </div>
        </ProtectedRoute>
    )
}