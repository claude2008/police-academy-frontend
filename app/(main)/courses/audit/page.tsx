"use client"

import { useState, useEffect, useMemo } from "react"
import { 
    ChevronLeft, ShieldCheck, Clock, Users, Printer, 
    ArrowRight, Loader2, Calendar, FileSignature, 
    UserCheck, AlertTriangle, CheckCircle2, Trash2, Edit, Save, X,RotateCcw,FileSpreadsheet,BookOpen,Paperclip,ChevronDown,Edit3
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

    // 2. حالات البيانات
    const [courses, setCourses] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [auditData, setAuditData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [unapproveConfirm, setUnapproveConfirm] = useState<{level: string, label: string} | null>(null);
    
    // 3. حالات التعديل والاعتماد
    const [isProxyOpen, setIsProxyOpen] = useState(false);
    const [proxyName, setProxyName] = useState("");
    const [confirmDeleteData, setConfirmDeleteData] = useState<any>(null);

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

    const [proxyLevel, setProxyLevel] = useState(""); 
    const searchParams = useSearchParams();

    // 🟢 1. إصلاح معالجة الإشعارات (Notification Handler)
    useEffect(() => {
        const paramDate = searchParams.get('date');
        const paramCourse = searchParams.get('course');
        const paramBatch = searchParams.get('batch');
        const paramSessionId = searchParams.get('session_id');

        if (paramDate && paramCourse && paramSessionId) {
            console.log("🚀 [1] بدأ التفعيل من الإشعار");

            // 🧼 التطهير الذكي: إذا كانت الدفعة "None" نحافظ عليها، وإلا نستخدم القيمة الموجودة
            // هذا يضمن التطابق مع قاعدة البيانات
            const cleanBatch = (paramBatch === "null" || !paramBatch || paramBatch === "none") 
                ? "None"  // 👈 التعديل هنا: نستخدم "None" بدلاً من ""
                : paramBatch;

            setDate(paramDate);
            
            setSelectedCourse({
                course: paramCourse,
                batch: cleanBatch 
            });

            const initializeFromNotification = async () => {
                setLoading(true);
                try {
                    // أ) جلب قائمة الحصص
                    const templateRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/template?course=${encodeURIComponent(paramCourse)}&date=${paramDate}&batch=${encodeURIComponent(cleanBatch)}`, {
                        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
                        cache: "no-store"
                    });

                    const displayId = Number(paramSessionId) + 1;
                    let correctName = `حصة ${displayId}`; 
                    let fullSessionData = null;

                    if (templateRes.ok) {
                        const sessionsList = await templateRes.json();
                        setSessions(sessionsList);

                        const targetSession = sessionsList.find((s: any, index: number) => {
                            if (String(s.id) === String(paramSessionId)) return true;
                            if (String(index) === String(paramSessionId)) return true;
                            return false;
                        });
                        
                        if (targetSession) {
                            correctName = targetSession.name || targetSession.label || correctName;
                            fullSessionData = targetSession;
                        }
                    }

                    // ب) التحديث النهائي للحصة
                    setSelectedSession({ 
                        ...(fullSessionData || {}), 
                        id: paramSessionId, 
                        name: correctName, 
                        displayId: displayId 
                    });

                    // ج) جلب بيانات الجدول
                    const auditRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/audit-report-data?date=${paramDate}&course=${encodeURIComponent(paramCourse)}&batch=${encodeURIComponent(cleanBatch)}&session_id=${paramSessionId}`, {
                        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
                    });
                    
                    if (auditRes.ok) {
                        setAuditData(await auditRes.json());
                        setViewMode('audit');
                    }

                } catch (e) {
                    console.error("❌ خطأ في الإشعار:", e);
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
            const documentTitle = `التكميل اليومي - ${selectedSession.name} - ${selectedCourse.course} ${selectedCourse.batch || ""} - ${date}`;
            const originalTitle = document.title;
            document.title = documentTitle;
            return () => { document.title = originalTitle; };
        }
    }, [viewMode, selectedCourse, selectedSession, date]);

    useEffect(() => { if (viewMode === 'courses') fetchCourses(); }, [date, viewMode]);
    
    useEffect(() => {
        if (viewMode === 'sessions' && selectedCourse) {
            // إعادة تحميل الحصص عند تغيير التاريخ فقط
            handleCourseSelect(selectedCourse);
        }
    }, [date]); 

    const fetchCourses = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const userStr = localStorage.getItem("user");
            const user = JSON.parse(userStr || "{}");
            const scope = user?.extra_permissions?.scope;
            const isRestricted = user.role !== 'owner' && scope?.is_restricted;
            const userCourses = scope?.courses || [];

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/daily-summaries?date=${date}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (res.ok) {
                let data = await res.json();

                if (isRestricted) {
                    data = data.filter((c: any) => {
                        const cKey = c.course;
                        // 🟢 هنا نحول لـ "لا يوجد" فقط لأغراض العرض والمقارنة
                        const bKey = (c.batch === "all" || !c.batch || c.batch === "None") ? "لا يوجد" : c.batch;
                        
                        const hasGeneralAccess = userCourses.includes(cKey);
                        const hasSpecificAccess = userCourses.includes(`${cKey}||${bKey}`);
                        
                        return hasGeneralAccess || hasSpecificAccess;
                    });
                }
                setCourses(data);
            }
        } catch (e) { toast.error("خطأ في الاتصال"); }
        finally { setLoading(false); }
    };

    // 🟢 2. إصلاح اختيار الدورة (handleCourseSelect)
    const handleCourseSelect = async (course: any) => {
        setSelectedCourse(course);
        setLoading(true);
        try {
            // 🧼 التطهير الحاسم: إذا كانت الدفعة "لا يوجد" أو غير موجودة، نرسل "None"
            // هذا يضمن أن الباك إند سيجد السجلات التي تخزن "None" كقيمة نصية
            const cleanBatch = (course.batch === "لا يوجد" || !course.batch) ? "None" : course.batch;
            
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/template?course=${encodeURIComponent(course.course)}&date=${date}&batch=${encodeURIComponent(cleanBatch)}`, {
    headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
    cache: "no-store"
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

    // 🟢 3. إصلاح جلب بيانات التدقيق (fetchAuditData)
    const fetchAuditData = async (sessionId: string) => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");

            // 🧼 التطهير الحاسم مرة أخرى: توحيد القيمة المرسلة مع المخزن في الداتابيز
            const cleanBatch = (selectedCourse.batch === "لا يوجد" || !selectedCourse.batch) 
                ? "None" 
                : selectedCourse.batch;

            const url = `${process.env.NEXT_PUBLIC_API_URL}/session/audit-report-data` + 
                        `?date=${date}` +
                        `&course=${encodeURIComponent(selectedCourse.course)}` +
                        `&batch=${encodeURIComponent(cleanBatch)}` + // نرسل "None" هنا
                        `&session_id=${sessionId}`;

            const res = await fetch(url, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setAuditData(data);
                setViewMode('audit');
            } else {
                const errData = await res.json();
                toast.error(errData.detail || "فشل جلب بيانات التدقيق");
            }
        } catch (e) { 
            console.error("Audit Data Fetch Error:", e);
            toast.error("خطأ في الاتصال بالسيرفر"); 
        } finally { 
            setLoading(false); 
        }
    };

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
                setDeleteConfirm({ ...deleteConfirm, show: false }); 
                if (selectedSession?.id) await fetchAuditData(selectedSession.id); 
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
        try {
            const endpoint = type === 'attendance' ? '/session/attendance/update-note' : '/session/violation/update-note';
            console.log(`Updating ${type} ${id} note to: ${newNote}`);
        } catch (e) { console.error(e); }
    };

   const executeDeleteAudit = async (mode: 'single' | 'group_full' | 'group_from_today') => {
    if (!confirmDeleteData) return;
    setLoading(true);

    try {
        const token = localStorage.getItem("token");
        let url = `${process.env.NEXT_PUBLIC_API_URL}/session/delete/attendance/${confirmDeleteData.id}`;
        
        // 🟢 تصحيح الروابط لتتطابق مع الباك إند المحدث
        if (mode === 'group_full' && confirmDeleteData.group_id) {
            url = `${process.env.NEXT_PUBLIC_API_URL}/session/delete-group/${confirmDeleteData.group_id}`;
        } else if (mode === 'group_from_today' && confirmDeleteData.group_id) {
            // تأكدنا من تمرير تاريخ اليوم (date) كبداية للحذف
            url = `${process.env.NEXT_PUBLIC_API_URL}/session/terminate-group/${confirmDeleteData.group_id}?from_date=${date}`;
        }

        const res = await fetch(url, { 
            method: "DELETE", 
            headers: { "Authorization": `Bearer ${token}` } 
        });

        // 🟢 قراءة الرد كـ JSON دائماً لفحص الأخطاء المنطقية (مثل القفل)
        const responseData = await res.json();

        if (res.ok) {
            toast.success(responseData.message || "تم الحذف بنجاح ✅");
            // تحديث البيانات فوراً
            if (selectedSession?.id) await fetchAuditData(selectedSession.id);
            setConfirmDeleteData(null);
        } else {
            // عرض رسالة الخطأ القادمة من الباك إند (التي تحتوي على تفاصيل القفل)
            toast.error(responseData.detail || "عفواً، لا يمكن الحذف لوجود حصص معتمدة 🔒");
        }
    } catch (e) {
        toast.error("حدث خطأ في الاتصال بالسيرفر");
        console.error(e);
    } finally {
        setLoading(false);
    }
};
    
    // 🟢 4. إصلاح دالة الاعتماد (executeApprove) لتستخدم "None" بدلاً من الفراغ
    const executeApprove = async (level: string, isProxy: boolean = false) => {
        if (isProxy && !proxyName) return toast.warning("اكتب اسم الضابط المصرح");
        setLoading(true);
        try {
            // 🧼 التطهير: نرسل "None" للدورات العامة
            const cleanBatch = (selectedCourse.batch === "لا يوجد" || !selectedCourse.batch) ? "None" : selectedCourse.batch;

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/audit/approve-session`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}` 
                },
                body: JSON.stringify({
                    date, 
                    course: selectedCourse.course, 
                    batch: cleanBatch, // ✅ هنا التغيير
                    session_id: selectedSession.id, 
                    level, 
                    is_proxy: isProxy, 
                    proxy_officer_name: proxyName
                })
            });
            if (res.ok) {
                toast.success(isProxy ? "تم الاعتماد بالنيابة ✅" : "تم الاعتماد بنجاح ✅");
                setIsProxyOpen(false);
                setProxyName(""); 
                fetchAuditData(selectedSession.id);
            }
        } catch (e) { toast.error("فشل العملية"); }
        finally { setLoading(false); }
    };

    // 🟢 5. إصلاح دالة فك الاعتماد (handleUnapprove) لتستخدم "None"
    const handleUnapprove = async (level: string) => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            
            // 🧼 التطهير: نرسل "None" للدورات العامة
            const cleanBatch = (selectedCourse.batch === "لا يوجد" || !selectedCourse.batch) ? "None" : selectedCourse.batch;

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/audit/unapprove-session`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({
                    date,
                    course: selectedCourse.course,
                    batch: cleanBatch, // ✅ هنا التغيير
                    session_id: selectedSession.id,
                    level: level 
                })
            });

            const responseData = await res.json();

            if (res.ok) {
                toast.success(responseData.message || "تم إلغاء الاعتماد بنجاح");
                fetchAuditData(selectedSession.id); 
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
        const courseName = selectedCourse?.course || "دورة";
        const batchName = (selectedCourse?.batch && selectedCourse.batch !== "None") ? selectedCourse.batch : "بدون دفعة";
        const sessionName = selectedSession?.name || "حصة";
        const fileName = `كشف الحالات والمخالفات - ${sessionName} - ${courseName} ${batchName} - ${date}.xlsx`;

        const attendanceSheetData = attendanceRows.map((row: any, index: number) => {
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

        const wb = XLSX.utils.book_new();

        const wsAtt = XLSX.utils.json_to_sheet(attendanceSheetData);
        if(!wsAtt['!views']) wsAtt['!views'] = [];
        wsAtt['!views'].push({ rightToLeft: true });
        wsAtt['!cols'] = [{wch:5}, {wch:20}, {wch:15}, {wch:15}, {wch:15}, {wch:30}, {wch:15}, {wch:15}, {wch:8}, {wch:12}, {wch:12}, {wch:30}, {wch:20}];
        XLSX.utils.book_append_sheet(wb, wsAtt, "الحالات");

        const wsVio = XLSX.utils.json_to_sheet(violationsSheetData);
        if(!wsVio['!views']) wsVio['!views'] = [];
        wsVio['!views'].push({ rightToLeft: true });
        wsVio['!cols'] = [{wch:5}, {wch:20}, {wch:15}, {wch:15}, {wch:15}, {wch:30}, {wch:15}, {wch:20}, {wch:15}, {wch:30}, {wch:20}];
        XLSX.utils.book_append_sheet(wb, wsVio, "المخالفات");

        XLSX.writeFile(wb, fileName);
        toast.success("تم تصدير الكشف الشامل بنجاح ✅");
    };

    const attendanceRows = useMemo(() => {
        const rows = auditData?.attendance_rows || [];
        return [...rows].sort((a, b) => (Number(a.soldier_id) || 0) - (Number(b.soldier_id) || 0));
    }, [auditData]);

    const violationRows = useMemo(() => {
        const rows = auditData?.violation_rows || [];
        return [...rows].sort((a, b) => (Number(a.soldier_id) || 0) - (Number(b.soldier_id) || 0));
    }, [auditData]);
    
    const stats = auditData?.stats || { total: 0, cases: 0, present: 0 };

    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("user") || "{}") : {};
    const isSupervisor = ["military_supervisor", "sports_supervisor", "assistant_admin", "owner"].includes(user.role);
    const isOfficer = ["military_officer", "sports_officer", "owner"].includes(user.role);

    return (
        <ProtectedRoute allowedRoles={["owner", "assistant_admin", "military_officer", "sports_officer", "military_supervisor", "sports_supervisor"]}>
            <div className="p-4 space-y-6 max-w-[1600px] mx-auto min-h-screen bg-slate-50/30 pb-10 md:pb-32" dir="rtl">
                
                <style jsx global>{`
                    @media print {
                        @page { size: A4 Portrait; margin: 3mm; }
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
        <div className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] font-black w-fit">
            القوة: {c.count} {c.course.includes('طالبات') ? 'طالبة' : 'طالب'}
        </div>
    </div>
    <Badge className="bg-blue-600">نشط اليوم</Badge>
</CardTitle>
                                    <CardDescription className="font-bold">
    الدفعة: {(c.batch === "all" || !c.batch || c.batch === "None") ? "لا يوجد" : c.batch}
</CardDescription>
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
                           {sessions.map((sess: any, idx: number) => {
    const isOfficer = sess.is_officer_approved;
    const isSupervisor = sess.is_supervisor_approved;

    return (
        <div 
            key={idx}
            onClick={() => handleSessionSelect(sess, idx)}
            className={cn(
                "bg-white p-5 rounded-2xl border-2 transition-all cursor-pointer group relative overflow-hidden",
                isOfficer ? "border-green-500 shadow-green-50" : 
                isSupervisor ? "border-orange-400 shadow-orange-50" : "border-slate-100 hover:border-[#c5b391] hover:shadow-lg"
            )}
        >
            <div className="flex justify-between items-start mb-4">
                <div className={cn(
                    "p-2 rounded-lg",
                    isOfficer ? "bg-green-100 text-green-600" : "bg-[#c5b391]/10 text-[#c5b391]"
                )}>
                    <BookOpen className="w-6 h-6" />
                </div>
                
                <div className="flex flex-col gap-1 items-end">
                    {isOfficer ? (
                        <Badge className="bg-green-600 text-white text-[8px] font-black h-5 border-none">
                            <ShieldCheck className="w-3 h-3 ml-1"/> اعتماد الضابط
                        </Badge>
                    ) : isSupervisor ? (
                        <Badge className="bg-orange-500 text-white text-[8px] font-black h-5 border-none">
                            <ShieldCheck className="w-3 h-3 ml-1"/> اعتماد المشرف
                        </Badge>
                    ) : null}

                    <div className="flex flex-col gap-1 mt-1">
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
            </div>
            
            <h3 className="font-black text-lg text-slate-800"> {sess.name}</h3>
            <p className="text-slate-400 text-[10px] font-bold mt-1">{sess.startTime} - {sess.endTime}</p>

            {isOfficer && (
                <CheckCircle2 className="absolute -bottom-2 -left-2 w-12 h-12 text-green-500/10 rotate-12" />
            )}
        </div>
    );
})}
                        </div>
                    </div>
                )}

                {/* 3️⃣ مشهد التدقيق (الجدول النهائي) */}
                {!loading && viewMode === 'audit' && auditData && (
                    <div className="bg-white p-8 rounded-3xl shadow-xl border print:shadow-none print:border-none print:p-0">
                        
                        {/* ترويسة الطباعة الرسمية */}
<div className="hidden print:flex justify-between items-start border-b-2 border-black pb-4 mb-4">
    <div className="w-1/3 flex justify-start">
    <img src="/logo.jpg" alt="Logo" className="w-24 h-24 object-contain" /> 
</div>

    <div className="w-1/3 text-center pt-2 space-y-2">
        <h2 className="text-xl font-black text-slate-900 leading-tight">قسم التدريب العسكري والرياضي</h2>
        
           <h2 className="text-xl font-black text-slate-900 leading-tight">
        {selectedSession.type === 'sports' ? 'فرع التدريب الرياضي' : 'فرع التدريب العسكري'}
    </h2>
        
    </div>

    <div className="w-1/3 text-left pt-4 pl-2 font-bold text-sm leading-relaxed">
    <p>التاريخ: {date}</p>
    <p>وقت الطباعة: {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</p>
</div>
</div>

<div className="flex justify-between items-center mb-6 no-print">
    <div className="space-y-1">
        <h2 className="text-2xl font-black text-slate-800">{selectedSession.name} <span className="text-base font-medium text-slate-400">({selectedSession.displayId})</span></h2>
        <p className="text-xs font-bold text-[#c5b391]">تدقيق واعتماد الحصة</p>
    </div>
    
    <div className="flex gap-2">
        <Button 
            onClick={handleFullExport} 
            className="bg-green-700 hover:bg-green-800 text-white gap-2 font-bold shadow-md"
        >
            <FileSpreadsheet className="w-4 h-4" />  Excel
        </Button>

        <Button onClick={() => window.print()} className="bg-slate-900 text-white gap-2 font-bold">
            <Printer className="w-4 h-4"/> طباعة 
        </Button>
    </div>
</div>

   <div className="text-center mb-6 mt-2 px-2"> 
    <div className="inline-block w-full max-w-[400px] border-2 border-black rounded-xl overflow-hidden shadow-sm">
        <h1 className="text-lg md:text-xl font-black bg-[#c5b391] text-black py-2 border-b-2 border-black [-webkit-print-color-adjust:exact]">
           التكميل اليومي
        </h1>
        <div className="bg-white py-2 px-4 flex flex-wrap justify-center items-center gap-1.5">
           <p className="text-sm md:text-lg font-black text-slate-800 leading-tight">
    <span className="text-[#8a7a5b]">الدورة: </span>
    {selectedCourse.course}
    {/* منع ظهور كلمة None */}
    {(selectedCourse.batch && selectedCourse.batch !== "None" && selectedCourse.batch !== "none") 
        ? ` (${selectedCourse.batch})` 
        : ""}
</p>
        </div>
    </div>
</div>

{/* جدول القوة الشامل */}
<div className="overflow-x-auto rounded-xl border-2 border-[#c5b391] shadow-md mb-8 print:border-black print:rounded-none print:shadow-none print:m-0 print:w-full">
    <table className="w-full text-center text-sm border-collapse print:table-fixed print:w-full">
        <thead className="bg-[#c5b391] text-black font-black print:bg-[#c5b391]! [-webkit-print-color-adjust:exact]">
            <tr className="divide-x divide-black print:divide-black">
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
                        <div className={cn("mb-10", attendanceRows.length === 0 && "print:hidden")}>
                            <h3 className="text-lg font-black text-slate-800 mb-3 flex items-center gap-2">
                                <span className="bg-blue-600 w-2 h-6 rounded-full"/> أولاً: سجل الحالات 
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
    <TableRow><TableCell colSpan={10} className="text-center py-6 text-slate-400 font-bold">لا توجد حالات مسجلة</TableCell></TableRow>
) : attendanceRows.map((row: any, idx: number) => {
    
    const rawStart = row.attendance_start_date || date;
    const startDate = new Date(rawStart);
    const duration = parseInt(row.attendance_duration) || 1;
    const endDate = addDays(startDate, duration - 1);
    
    return (
        <TableRow key={idx} className="border-b border-slate-300 print:border-black hover:bg-slate-50">
            <TableCell className="text-center font-bold border-l border-slate-300 print:border-black">{idx + 1}</TableCell>
            
            <TableCell className="text-right border-l border-slate-300 print:border-black p-2">
    <div className="flex flex-col gap-0.5">
        <div className="font-black text-sm text-slate-900 leading-tight">{row.name}</div>
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
    {STATUS_TRANSLATIONS[row.attendance_status] || row.attendance_status}
</TableCell>

            <TableCell className="text-center font-black border-l border-slate-300 print:border-black">
                {duration} {duration > 2 ? "أيام" : "يوم"}
            </TableCell>

            <TableCell className="text-center text-xs font-bold border-l border-slate-300 print:border-black">
                {isValid(startDate) ? format(startDate, "yyyy-MM-dd") : "-"}
            </TableCell>

            <TableCell className="text-center text-xs font-black border-l border-slate-300 print:border-black text-red-600">
                {isValid(endDate) ? format(endDate, "yyyy-MM-dd") : "-"}
            </TableCell>
                                                    <TableCell className="p-0 border-l border-slate-300 print:border-black">
                                                        <input 
                                                            className="w-full h-full px-2 bg-transparent outline-none text-xs font-bold text-slate-700 placeholder:text-slate-300" 
                                                            defaultValue={row.attendance_note}
                                                            placeholder="اكتب ملاحظة..."
                                                            onBlur={(e) => handleUpdateNote('attendance', row.attendance_id, e.target.value)} 
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
        <Button 
            size="icon" 
            variant="ghost" 
            className="h-6 w-6 text-red-600 hover:bg-red-50" 
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
                        <div className={cn("mb-12", violationRows.length === 0 && "print:hidden")}>
                            <h3 className="text-lg font-black text-slate-800 mb-3 flex items-center gap-2">
                                <span className="bg-red-600 w-2 h-6 rounded-full"/> ثانياً: سجل المخالفات 
                            </h3>
                            <div className="border border-slate-300 rounded-lg overflow-hidden print:border-black">
                                <Table>
                                    <TableHeader className="bg-[#c5b391] print:bg-[#c5b391]! [-webkit-print-color-adjust:exact]">
    <TableRow className="print:border-b-2 print:border-black">
        <TableHead className="text-center font-black text-black w-10 border-l border-slate-300 print:border-black">#</TableHead>
        <TableHead className="text-right font-black text-black border-l border-slate-300 print:border-black w-64 print:w-[250px]">البيانات العسكرية</TableHead>
        
        <TableHead className="text-right font-black text-black border-l border-slate-300 print:border-black min-w-[200px] md:min-w-[300px] print:w-[200px]">
            المخالفة
        </TableHead>

        <TableHead className="text-center font-black text-black border-l border-slate-300 print:border-black w-[120px] print:w-[80px]">
            الجزاء
        </TableHead>

        <TableHead className="text-right font-black text-black border-l border-slate-300 print:border-black print:w-[300px]">
            الملاحظات
        </TableHead>

        <TableHead className="text-center font-black text-black border-l border-slate-300 print:hidden w-16">المرفق</TableHead>
        
        <TableHead className="text-center font-black text-black border-l border-slate-300 print:border-black w-24 print:w-20 print:text-[9px]">
            المدخل
        </TableHead>
        
        <TableHead className="text-center font-black text-black w-16 no-print">إجراء</TableHead>
    </TableRow>
</TableHeader>
                                    <TableBody>
                                        {violationRows.length === 0 ? (
                                            <TableRow><TableCell colSpan={8} className="text-center py-6 text-slate-400 font-bold">لا توجد مخالفات مسجلة</TableCell></TableRow>
                                        ) : violationRows.map((row: any, idx: number) => (
                                            <TableRow key={idx} className="border-b border-slate-300 print:border-black hover:bg-slate-50">
                                                <TableCell className="text-center font-bold border-l border-slate-300 print:border-black">{idx + 1}</TableCell>
                                                <TableCell className="text-right border-l border-slate-300 print:border-black p-2 w-[250px] print:w-[220px]">
    <div className="flex flex-col gap-0.5">
        <div className="font-black text-sm text-slate-900 leading-tight">{row.name}</div>
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
                                                <TableCell className="text-right border-l border-slate-300 print:border-black p-2 align-top print:w-[200px]">
    <div className="whitespace-normal break-words leading-relaxed font-bold text-slate-800 text-xs print:text-[9px]">
        {row.violation_name}
    </div>
</TableCell>
                                                <TableCell className="text-center border-l border-slate-300 print:border-black p-2 align-middle">
    <div className="max-w-[120px] print:max-w-[100px] whitespace-normal break-words leading-tight font-bold text-red-700 text-xs print:text-[9px]">
        {row.violation_penalty}
    </div>
</TableCell>
                                                <TableCell className="p-0 border-l border-slate-300 print:border-black align-top relative print:w-[300px]">
    <textarea 
        className="no-print w-full min-h-[40px] p-2 bg-transparent outline-none text-xs font-bold text-slate-700 resize-none overflow-hidden"
        dir="rtl"
        defaultValue={row.violation_note}
        onBlur={(e) => handleUpdateNote('violation', row.violation_id, e.target.value)}
    />
    <div className="hidden print:block p-2 text-[10px] font-bold text-black leading-tight whitespace-normal break-words text-right">
        {row.violation_note || "-"}
    </div>
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
    onClick={() => triggerDeleteRecord('violation', row.violation_id, row.name)}
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
    // إذا كان رياضي يبقى "ضابط التدريب"، غير ذلك (عسكري/اشتباك) يصبح "قائد الدفعة"
    'officer': selectedSession.type === 'sports' ? 'ضابط التدريب  الرياضي' : 'قائد الدفعة', 
    'head': 'رئيس قسم التدريب العسكري والرياضي' 
};
        
        const userStr = localStorage.getItem("user");
        const currentUser = JSON.parse(userStr || "{}");
        const userRole = currentUser.role;

let canUnapprove = false;

if (userRole === 'owner') {
    canUnapprove = true;
} 
else if (userRole === 'assistant_admin' || userRole.includes('supervisor')) {
    
    if (role === 'supervisor') {
        const isOfficerOriginal = auditData.approvals['officer'] && !auditData.approvals['officer'].is_proxy;
        if (!isOfficerOriginal) canUnapprove = true;
    } 
    else if (role === 'officer') {
        if (app?.is_proxy) canUnapprove = true;
    }
}
else if (userRole.includes('officer')) {
    if (role === 'officer' || role === 'supervisor') canUnapprove = true;
}

       return (
    <div key={role} className="text-center flex flex-col items-center gap-2 relative group">
        <p className="font-black text-[13px] underline underline-offset-4 mb-4">{labels[role]}</p>
        
        {app ? (
            /* --- الحالة: تم الاعتماد (ظهور التوقيع أو علامة النيابة) --- */
            <div className="animate-in zoom-in flex flex-col items-center">
                {role !== 'head' && canUnapprove && (
                    <Button 
                        variant="ghost" size="icon" 
                        className="no-print absolute -top-4 -right-6 text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-full shadow-sm"
                        onClick={() => setUnapproveConfirm({level: role, label: labels[role]})}
                    >
                        <RotateCcw className="w-4 h-4" />
                    </Button>
                )}
                
                <p className="font-bold text-blue-900 text-[13px] leading-tight">{app.rank} / {app.name}</p>

{app.is_proxy && <p className="text-[10px] text-red-600 font-black tracking-tighter">(بـالـنـيـابـة)</p>}

<div className="h-14 mt-1 flex items-center justify-center print:h-14 print:mt-0"> 
    {app.mil_id ? (
        <img 
            src={`https://cynkoossuwenqxksbdhi.supabase.co/storage/v1/object/public/Signatures/${app.mil_id}.png`} 
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
            /* --- الحالة: بانتظار الاعتماد --- */
            <div className="no-print mt-2 min-h-[70px] flex items-center justify-center">
                {role === 'head' ? (
                    <p className="italic text-slate-300 text-[10px] font-bold border border-dashed p-2 rounded text-center leading-relaxed">
                        التوقيع 
                    </p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {role === 'supervisor' && (
                            <Button 
                                onClick={() => executeApprove('supervisor')} 
                                size="sm" variant="outline" 
                                className="text-xs font-black border-[#c5b391] text-[#c5b391] hover:bg-[#c5b391]/10"
                            >
                                اعتماد المشرف
                            </Button>
                        )}
                        
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

                <Dialog open={isProxyOpen} onOpenChange={setIsProxyOpen}>
    <DialogContent 
        className="max-w-sm" dir="rtl"
        onOpenAutoFocus={(e) => e.preventDefault()} 
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
    <div className="text-center text-slate-600 font-bold leading-relaxed">
        هل أنت متأكد من رغبتك في حذف سجل <br/>
        <span className="text-slate-900 font-black text-base">"{deleteConfirm.name}"</span>؟
        
        <div className="text-[11px] text-red-500 mt-3 bg-red-50 p-2 rounded-lg border border-red-100">
            * هذا الإجراء سيقوم بمسح البيانات نهائياً من سجلات الجندي.
        </div>
    </div>

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