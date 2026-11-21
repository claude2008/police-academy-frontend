"use client"

import { useState, useEffect, useMemo } from "react"
import { safePrint } from "@/lib/safePrint"
import { 
    ArrowRight, Printer, Download, Search, 
    Loader2, RotateCcw, FileText, Paperclip, 
    Trash2, Edit3, ShieldCheck, CheckCircle2, UserCheck, Calendar,
    ChevronRight, ChevronLeft, BookOpen
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import { toast } from "sonner"
import ProtectedRoute from "@/components/ProtectedRoute"
import * as XLSX from 'xlsx';
import { Badge } from "@/components/ui/badge";
import { useRouter, useSearchParams } from "next/navigation"
const STATUS_TYPES = [
    { id: "medical", label: "طبية" },
    { id: "clinic", label: "عيادة" },
    { id: "leave", label: "إجازة" },
    { id: "admin_leave", label: "إجازة إدارية" },
    { id: "death_leave", label: "إجازة وفاة" },
    { id: "late_parade", label: "تأخير" },
    { id: "late_class", label: "تأخير حصة" },
    { id: "absent", label: "غياب" },
    { id: "exempt", label: "إعفاء" },
    { id: "rest", label: "استراحة" },
    { id: "other", label: "أخرى" },
];

export default function DailyAuditPage() {
    const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({
        course: "all",
        batch: "all"
    });
    const [selectedCourse, setSelectedCourse] = useState("all");
    const [selectedBatch, setSelectedBatch] = useState("all");
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
    const [selectedReport, setSelectedReport] = useState<any>(null);
    const [soldiers, setSoldiers] = useState<any[]>([]);
    const [attendanceData, setAttendanceData] = useState<any>({});
    const [templates, setTemplates] = useState<any[]>([]);
    const [dailySummaries, setDailySummaries] = useState<any[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
const searchParams = useSearchParams();
const [userRole, setUserRole] = useState<string | null>(null);
    // 🟢 استخراج المعلمات من الرابط (التاريخ، الدورة، الدفعة)
    const targetDate = searchParams.get('date');
    const targetCourse = searchParams.get('course');
    const targetBatch = searchParams.get('batch');
    const [options, setOptions] = useState({ courses: [], batches: [] });
const [activeCard, setActiveCard] = useState<string | null>(null);
  useEffect(() => {
    // جلب بيانات المستخدم لتعريف الصلاحيات في الصفحة
    const userStr = localStorage.getItem("user");
    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            setUserRole(user.role); // تعبئة الرتبة هنا
        } catch (e) {
            console.error("خطأ في قراءة بيانات المستخدم");
        }
    }
    fetchInitialOptions();
}, [date]);

   const filteredReports = useMemo(() => {
    return dailySummaries.filter((report: any) => {
        // توحيد مسميات الدفعة في السجلات للمطابقة
        const reportBatch = (!report.batch || report.batch === "None" || report.batch === "none") ? "لا يوجد" : report.batch;
        
        const matchCourse = selectedCourse === "all" || report.course === selectedCourse;
        const matchBatch = selectedBatch === "all" || reportBatch === selectedBatch;
        
        return matchCourse && matchBatch;
    });
}, [dailySummaries, selectedCourse, selectedBatch]);

  const fetchInitialOptions = async () => {
    setLoading(true);
    try {
        const token = localStorage.getItem("token");
        const userStr = localStorage.getItem("user") || "{}";
        const user = JSON.parse(userStr);
        const scope = user?.extra_permissions?.scope;

        const [fRes, tRes, sRes] = await Promise.all([
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/filters-options`),
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/training/templates`, {
                headers: { "Authorization": `Bearer ${token}` }
            }),
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/daily-summaries?date=${date}`, {
                headers: { "Authorization": `Bearer ${token}` }
            })
        ]);
        
        // 1️⃣ معالجة خيارات الفلترة (القوائم المنسدلة)
        if (fRes.ok) {
            let filterData = await fRes.json();

            // 🟢 توحيد مسميات الدفعات فوراً (تحويل أي قيمة فارغة أو None إلى "لا يوجد")
            filterData.batches = Array.from(new Set((filterData.batches || []).map((b: string) => 
    (!b || b === "None" || b === "none" || b === "") ? "لا يوجد" : b
))).sort((a: any, b: any) => a.localeCompare(b, 'ar'));

            // 🛡️ تطبيق قيود النطاق للمستخدم المقيد على القوائم
            if (user.role !== 'owner' && scope?.is_restricted) {
                const allowedKeys = scope.courses || []; 
                const allowedCourseNames = allowedKeys.map((key: string) => key.split('||')[0]);

                // أ. تصفية قائمة الدورات
                filterData.courses = (filterData.courses || []).filter((cName: string) => 
                    allowedCourseNames.includes(cName)
                );

                // ب. تصفية قائمة الدفعات
                filterData.batches = filterData.batches.filter((bName: string) => {
                    return allowedKeys.some((key: string) => 
                        key.endsWith(`||${bName}`) || // صلاحية لدفعة محددة
                        !key.includes("||")           // صلاحية عامة للدورة تفتح كل دفعاتها
                    );
                });
            }
            setOptions(filterData);
        }

        // 2️⃣ معالجة القوالب (كما هي)
        if (tRes.ok) setTemplates(await tRes.json());
        
        // 3️⃣ معالجة ملخصات اليوم (البطاقات المعروضة)
        if (sRes.ok) {
            let summaryData = await sRes.json();

            // 🛡️ تصفية البطاقات الذكية بناءً على الصلاحيات والأسماء الموحدة
            if (user.role !== 'owner' && scope?.is_restricted) {
                const allowedKeys = scope.courses || [];
                
                summaryData = summaryData.filter((item: any) => {
                    const courseName = item.course;
                    
                    // 🟢 توحيد مسمى الدفعة في سجل البطاقة للمطابقة الصحيحة
                    const reportBatch = (!item.batch || item.batch === "all" || item.batch === "None" || item.batch === "none" || item.batch === "") ? "لا يوجد" : item.batch;

                    // فحص الصلاحية العامة (على اسم الدورة)
                    const hasGeneralAccess = allowedKeys.includes(courseName);

                    // فحص الصلاحية المخصصة (دورة + دفعة موحدة)
                    const hasSpecificAccess = allowedKeys.includes(`${courseName}||${reportBatch}`);

                    return hasGeneralAccess || hasSpecificAccess;
                });
            }
            setDailySummaries(summaryData);
        }
    } catch (e) { 
        toast.error("خطأ في جلب البيانات"); 
        console.error("Fetch Options Error:", e);
    } finally { 
        setLoading(false); 
    }
};
// 🔔 موظف الاستقبال لفتح التكميل مباشرة من الإشعارات
useEffect(() => {
    const handleDeepLink = async () => {
        // نتحقق من وجود المعلمات الأساسية (تاريخ ودورة)
        if (targetDate && targetCourse && dailySummaries.length > 0) {
            
            // 1. ضبط التاريخ أولاً (لكي تتوافق البيانات)
            if (date !== targetDate) {
                setDate(targetDate);
                return; // سنتوقف هنا وننتظر الـ useEffect التالي الذي سيُشغل عند تغير التاريخ
            }

            // 2. البحث عن الدورة في الملخصات للتأكد من وجودها
            const found = dailySummaries.find(s => 
                s.course === targetCourse && 
                (targetBatch ? s.batch === targetBatch : true)
            );

            if (found) {
                console.log(`🎯 تم رصد إشعار تكميل لـ ${targetCourse}، جاري الفتح...`);
                
                // 3. استدعاء دالة فتح التقرير تلقائياً
                await openReport(found.course, found.batch);

                // 4. تنظيف الرابط لمنع التكرار
                const newUrl = window.location.pathname;
                window.history.replaceState({}, '', newUrl);

                toast.success(`عرض تقرير: ${found.course}`);
            }
        }
    };

    handleDeepLink();
}, [targetDate, targetCourse, targetBatch, dailySummaries, date]); 
// 🔄 يراقب التغيرات لضمان الفتح حتى لو تأخر تحميل البيانات من السيرفر
const openReport = async (course: string, batch: string) => {
    setActiveCard(course + batch); 
    setLoading(true);

    try {
        const token = localStorage.getItem("token");

        // 🟢 [التعديل الذهبي]: توحيد لغة التخاطب مع الباك إند
        // يجب إرسال "None" حرفياً للدورات العامة لكي يجد الباك إند التواقيع المفقودة
        const cleanBatchForApi = (
            !batch || 
            batch === "all" || 
            batch === "None" || 
            batch === "none" || 
            batch === "لا يوجد" || 
            batch === ""
        ) ? "None" : batch; // 👈 تم تغيير "" إلى "None"

        const queryParams = new URLSearchParams({
            date: date,
            course: course,
            batch: cleanBatchForApi
        });

        const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/session/approved-daily-report?${queryParams.toString()}`,
            { headers: { "Authorization": `Bearer ${token}` } }
        );

        if (res.ok) {
            const data = await res.json();
            setAttendanceData(data);
            
            // 🛡️ تأمين المستقبل: نحفظ التقرير المختار مع المسمى "المطهر"
            // هذا يضمن أن دوال handleApprove و handleUnapprove ستستخدم "" بدلاً من "لا يوجد"
            // مما يمنع حدوث فشل في الاعتماد بسبب اختلاف المسميات
            setSelectedReport({ course, batch: cleanBatchForApi }); 
            
        } else {
            // في حال فشل الاستجابة (مثلاً لا توجد بيانات)
            toast.error("لا توجد حصص معتمدة لهذه الدورة اليوم");
            setActiveCard(null); 
        }
    } catch (e) {
        console.error("🚨 فشل فتح التقرير:", e);
        toast.error("خطأ في الاتصال بالسيرفر");
        setActiveCard(null); 
    } finally {
        setLoading(false);
    }
};

    const handleUnapprove = async (level: string) => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/audit/unapprove`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({
                    date: date,
                    course: selectedReport.course,
                    batch: selectedReport.batch,
                    level: level
                })
            });

            if (res.ok) {
                toast.success("تم إلغاء الاعتماد");
                openReport(selectedReport.course, selectedReport.batch);
            } else {
                const err = await res.json();
                toast.error(err.detail || "فشل الإلغاء");
            }
        } catch (e) { toast.error("خطأ في العملية"); }
    };

    const handleApprove = async (level: string) => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/audit/approve`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json", 
                    "Authorization": `Bearer ${token}` 
                },
                body: JSON.stringify({
                    date: date,
                    course: selectedReport.course,
                    batch: selectedReport.batch,
                    level: level
                })
            });

            if (res.ok) {
                toast.success("تم الاعتماد بنجاح");
                openReport(selectedReport.course, selectedReport.batch);
            } else {
                const err = await res.json();
                toast.error(err.detail || "فشل الاعتماد");
            }
        } catch (e) {
            toast.error("خطأ في تنفيذ العملية");
        }
    };

    // 🟢 استخدام الإحصائيات القادمة من الباك إند مباشرة لضمان الدقة
const displayStats = useMemo(() => {
    const stats = attendanceData.stats || { total: 0, present: 0, cases: 0 };
    
    // 🟢 قمنا بوضع rest بدلاً من late_class في الحساب
    const mainCasesSum = 
        (stats.medical || 0) + (stats.clinic || 0) + (stats.leave || 0) + 
        (stats.admin_leave || 0) + (stats.death_leave || 0) + 
        (stats.late_parade || 0) + (stats.rest || 0) + (stats.absent || 0);

    const otherCases = stats.cases - mainCasesSum;

    return { 
        ...stats, 
        calculatedOther: otherCases > 0 ? otherCases : 0 
    };
}, [attendanceData]);

    const paginatedReports = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredReports.slice(start, start + itemsPerPage);
    }, [filteredReports, currentPage, itemsPerPage]);

 const exportToExcel = () => {
    if (!attendanceData.rows || !attendanceData.template) {
        toast.error("لا توجد بيانات جاهزة للتصدير");
        return;
    }

    // 1. بناء البيانات صفاً بصف مع تنظيف كامل من null و undefined
    const dataForExcel = attendanceData.rows.map((row: any, i: number) => {
        // تنظيف بيانات السرية والفصيل
        const comp = (row.soldier.company && row.soldier.company !== "null") ? row.soldier.company : "---";
        const plat = (row.soldier.platoon && row.soldier.platoon !== "null") ? row.soldier.platoon : "---";

        // أ. البيانات الأساسية
        const excelRow: any = {
            "م": i + 1,
            "الرقم العسكري": row.soldier.military_id,
            "الاسم": row.soldier.name,
            "السرية / الفصيل": `${comp} / ${plat}`,
        };

        // ب. إضافة أعمدة الحصص مع معالجة الحالات والمدخلين
        attendanceData.template.forEach((sess: any, index: number) => {
            const timeInfo = (sess.startTime && sess.endTime && sess.startTime !== "00:00") 
                ? ` (${sess.startTime}-${sess.endTime})` 
                : "";
            
            const sessionKey = `حصة ${index + 1}${timeInfo}`;
            const sessionObj = row.sessions[index];

            if (sessionObj) {
                // معالجة حالة "أخرى" مع الملاحظة
                const statusText = (sessionObj.status === "أخرى" && sessionObj.note) 
                    ? sessionObj.note 
                    : (sessionObj.status || "حاضر");

                // تنظيف اسم المدخل (إزالة undefined)
                const creatorText = (sessionObj.created_by && sessionObj.created_by !== "undefined") 
                    ? ` (${sessionObj.created_by})` 
                    : "";

                // إذا كان الجندي "حاضر" لا نحتاج لكتابة اسم المدخل بجانبه لجمالية الجدول
                excelRow[sessionKey] = statusText === "حاضر" ? "حاضر" : `${statusText}${creatorText}`;
            } else {
                excelRow[sessionKey] = "حاضر";
            }
        });

        // ج. البيانات النهائية
        excelRow["المدة"] = row.duration ? `${row.duration} يوم` : "-";
        excelRow["البداية"] = row.start_date || "-";

        return excelRow;
    });

    // 2. تحويل البيانات إلى ورقة عمل (Worksheet)
    const ws = XLSX.utils.json_to_sheet(dataForExcel);

    // 3. ضبط اتجاه الورقة لتكون من اليمين لليسار (RTL) ليتناسب مع اللغة العربية
    if (!ws['!views']) ws['!views'] = [];
    ws['!views'].push({ RTL: true });

    // 4. تحسين شكل الإكسل وتوسيع الأعمدة
    const wscols = [
        { wch: 5 },   // م
        { wch: 15 },  // الرقم العسكري
        { wch: 35 },  // الاسم
        { wch: 25 },  // السرية/الفصيل
        ...attendanceData.template.map(() => ({ wch: 22 })), // عرض الحصص
        { wch: 10 },  // المدة
        { wch: 15 }   // البداية
    ];
    ws['!cols'] = wscols;

    // 5. إنشاء الملف وتحميله باسم الدورة والتاريخ
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "كشف الحالات المعتمدة");
    
    const fileName = `تدقيق_${selectedReport.course}_${date}.xlsx`.replace(/\s+/g, '_');
    XLSX.writeFile(wb, fileName);
};
// 🟢 دالة الطباعة مع تسمية الملف بشكل ديناميكي
const handlePrint = () => {
    // 1. حفظ العنوان الأصلي للمتصفح
    const originalTitle = document.title;

    // 2. تجهيز الاسم الجديد (التكميل اليومي لـ الدورة - الدفعة - التاريخ)
    const courseName = selectedReport?.course || "";
    const batchName = (selectedReport?.batch && selectedReport.batch !== "all") ? ` - ${selectedReport.batch}` : "";
    const fileName = `التكميل اليومي لـ ${courseName}${batchName} - ${date}`;

    // 3. تغيير عنوان الصفحة مؤقتاً
    document.title = fileName;

    // 4. استدعاء أمر الطباعة
    safePrint();

    // 5. إعادة العنوان الأصلي بعد إغلاق نافذة الطباعة
    document.title = originalTitle;
};
    if (!selectedReport) {
        return (
            <ProtectedRoute allowedRoles={["owner","manager","admin","assistant_admin","military_officer","sports_officer","sports_supervisor","military_supervisor"]}>
                <div className="p-6 space-y-6 bg-slate-50 min-h-screen " dir="rtl">
                    <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl border shadow-sm no-print">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                                <ShieldCheck className="w-8 h-8 text-[#c5b391]" /> اعتماد التكميل اليومي
                            </h1>
                            <div className="flex items-center gap-2">
                                <Input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="w-40 font-bold border-[#c5b391]" />
                                <Button onClick={fetchInitialOptions} variant="outline" className="gap-2 border-[#c5b391] text-[#c5b391]">
                                    <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> تحديث
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t">
                            <Select value={selectedCourse} onValueChange={(v)=>{setSelectedCourse(v); setCurrentPage(1);}}>
                                <SelectTrigger className="bg-slate-50 border-none font-bold"><SelectValue placeholder="كل الدورات" /></SelectTrigger>
                                <SelectContent><SelectItem value="all">كل الدورات</SelectItem>{options.courses?.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={selectedBatch} onValueChange={(v)=>{setSelectedBatch(v); setCurrentPage(1);}}>
                                <SelectTrigger className="bg-slate-50 border-none font-bold"><SelectValue placeholder="كل الدفعات" /></SelectTrigger>
                                <SelectContent><SelectItem value="all">كل الدفعات</SelectItem>{options.batches?.map(b=><SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                            </Select>
                            <div className="flex items-center gap-2 bg-slate-50 px-3 rounded-lg">
                                <Label className="text-xs font-bold text-slate-400">عرض:</Label>
                                <Select value={String(itemsPerPage)} onValueChange={(v)=>{setItemsPerPage(Number(v)); setCurrentPage(1);}}>
                                    <SelectTrigger className="w-20 border-none bg-transparent font-bold h-8"><SelectValue /></SelectTrigger>
                                    <SelectContent>{[10, 20, 50].map(n=><SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
   {paginatedReports.map((report: any, index: number) => {
    // التحقق هل هذه البطاقة هي التي جاري تحميلها حالياً؟
    const isThisCardLoading = loading && activeCard === (report.course + report.batch);

    return (
        <div 
            key={index}
            onClick={() => !loading && openReport(report.course, report.batch)}
            className={`bg-white p-6 rounded-2xl border-2 transition-all cursor-pointer group relative overflow-hidden ${
                isThisCardLoading 
                ? 'border-[#c5b391] bg-[#c5b391]/5 scale-[0.98] shadow-inner' // شكل البطاقة أثناء الضغط
                : 'border-slate-100 hover:border-[#c5b391] hover:shadow-xl' // الشكل الطبيعي
            }`}
        >
            {/* الديكور الجانبي يتوهج عند التحميل */}
            <div className={`absolute top-0 right-0 w-2 h-full transition-all ${
                isThisCardLoading ? 'bg-[#c5b391] opacity-100' : 'bg-[#c5b391] opacity-20 group-hover:opacity-100'
            }`} />
            
            <div className="flex justify-between items-start">
                <div>
                    <h3 className={`font-black text-xl mb-1 transition-colors ${isThisCardLoading ? 'text-[#8a7a5b]' : 'text-slate-800'}`}>
                        {report.course}
                    </h3>
                    
<p className="text-[#c5b391] font-bold text-sm">
    {(!report.batch || report.batch === "none" || report.batch === "None") ? "لا يوجد" : report.batch}
</p>
                    
                    <div className="flex gap-2 items-center mt-2">
                        {/* إظهار علامة انتظار إذا كانت جاري التحميل، وإلا إظهار البادج العادي */}
                        {isThisCardLoading ? (
                            <Badge variant="outline" className="bg-white text-[#c5b391] border-[#c5b391] animate-pulse font-black text-[10px]">
                                جاري جلب البيانات...
                            </Badge>
                        ) : (
                            report.status === "fully_approved" ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 font-black text-[10px]">
                                    معتمد بالكامل ✅
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 font-black text-[10px]">
                                    قيد المراجعة ⏳
                                </Badge>
                            )
                        )}
                    </div>
                </div>

                {/* استبدال رقم الطلاب بأيقونة دوارة أثناء التحميل */}
                {isThisCardLoading ? (
                    <div className="p-2 bg-[#c5b391]/20 rounded-full">
                        <Loader2 className="w-5 h-5 animate-spin text-[#8a7a5b]" />
                    </div>
                ) : (
                    <div className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-black">
                        {report.count} طلاب
                    </div>
                )}
            </div>

            <div className="mt-6 flex items-center justify-between text-slate-400 text-[11px] font-bold">
                <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>تاريخ: {date}</span>
                </div>
                <span className={`transition-colors ${isThisCardLoading ? 'text-[#c5b391] font-black' : 'group-hover:text-[#c5b391]'}`}>
                    {isThisCardLoading ? "فتح التقرير..." : "عرض التقرير ←"}
                </span>
            </div>
        </div>
    );
})}
</div>

                    <div className="flex items-center justify-between bg-white p-4 rounded-xl border shadow-sm">
                        <span className="text-xs font-bold text-slate-400 italic">عرض {paginatedReports.length} من أصل {filteredReports.length} دورة</span>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={()=>setCurrentPage(p=>p-1)} disabled={currentPage===1} className="h-8 gap-1 font-bold"><ChevronRight className="w-4 h-4"/> السابق</Button>
                            <Button variant="outline" size="sm" onClick={()=>setCurrentPage(p=>p+1)} disabled={currentPage >= Math.ceil(filteredReports.length/itemsPerPage)} className="h-8 gap-1 font-bold">التالي <ChevronLeft className="w-4 h-4"/></Button>
                        </div>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute allowedRoles={["owner","manager","admin","assistant_admin","military_officer","sports_officer","sports_supervisor","military_supervisor"]}>
            <div className="min-h-screen bg-white p-4  pb-32 " dir="rtl">
               <style jsx global>{`
    @media print {
        @page { 
            size: A4 landscape; 
            margin: 5mm; 
        }

        .no-print { display: none !important; }
        
        body { 
            background: white !important; 
            padding: 0 !important; 
            margin: 0 !important;
            -webkit-print-color-adjust: exact;
        }

        /* 1. جعل الجدول يملأ العرض وضبط الخط */
        table { 
            width: 100% !important; 
            table-layout: fixed !important; /* استخدام fixed لتوزيع الأعمدة بدقة */
            border-collapse: collapse !important;
            font-size: 9px !important;
        }

        /* 2. محاذاة كل البيانات للمنتصف */
        th, td { 
            border: 1px solid black !important;
            text-align: center !important; /* محاذاة أفقية للمنتصف */
            vertical-align: middle !important; /* محاذاة رأسية للمنتصف */
            padding: 2px !important;
            word-wrap: break-word !important;
            overflow: hidden !important;
        }

        /* 3. تقليص عرض عمود التسلسل (#) */
        table tr th:first-child,
        table tr td:first-child {
            width: 25px !important; /* عرض صغير جداً لعمود # */
        }

        /* 4. توسيع عمود الاسم قليلاً لأنه يحتاج مساحة */
        table tr th:nth-child(2),
        table tr td:nth-child(2) {
            width: 180px !important;
            text-align: right !important; /* الأسماء يفضل بقاؤها لليمين قليلاً لجمالية القراءة */
            padding-right: 5px !important;
        }

        /* 5. ضبط محاذاة التواقيع */
        .grid-cols-3 {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            margin-top: 20px !important;
            text-align: center !important;
        }
    }
`}</style>

                <div className="no-print flex justify-between items-center mb-8 bg-slate-100 border p-4 rounded-2xl shadow-sm">
                    <Button variant="ghost" onClick={() => setSelectedReport(null)} className="text-slate-600 hover:bg-slate-200 gap-2 font-bold">
                        <ArrowRight className="w-5 h-5" /> العودة للدورات
                    </Button>
                    <div className="flex gap-3">
                       <Button onClick={handlePrint} className="bg-[#c5b391] text-black font-bold gap-2 hover:bg-[#b5a381] shadow-md">
    <Printer className="w-4 h-4" /> طباعة
</Button>
                        <Button onClick={exportToExcel} variant="outline" className="border-green-600 text-green-700 hover:bg-green-50 gap-2 font-bold shadow-sm">
                            <Download className="w-4 h-4" /> تصدير
                        </Button>
                    </div>
                </div>

                <div className="max-w-[1000px] mx-auto space-y-6">
                    <div className="flex justify-between items-start border-b-2 border-black pb-6">
                        <div className="w-1/3 flex flex-col items-center"><img src="/logo.jpg" alt="Logo" className="w-24 h-24 object-contain" /></div>
                        <div className="w-1/3 text-center space-y-1 font-black">
                            <h2 className="text-xl font-black">معهد الشرطة</h2>
                            <h3 className="text-lg font-bold">قسم التدريب العسكري والرياضي</h3>
                            <h4 className="text-md underline underline-offset-4 font-bold">فرع التدريب العسكري</h4>
                        </div>
                        <div className="w-1/3 text-left font-bold text-sm space-y-1">
                            <p>اليوم: {format(new Date(date), "EEEE", { locale: ar })}</p>
                            <p>التاريخ: {date}</p>
                        </div>
                    </div>

                    <div className="text-center">
                        <h1 className="text-2xl font-black bg-[#c5b391] py-4 border-2 border-black rounded-xl shadow-inner">
    التكميل اليومي لـ {selectedReport.course} 
    {/* 🟢 التعديل: شرط صارم لإخفاء None */}
    {(selectedReport.batch && 
      selectedReport.batch !== "all" && 
      selectedReport.batch.toLowerCase() !== "none" && 
      selectedReport.batch.toLowerCase() !== "null" && 
      selectedReport.batch !== "لا يوجد") 
        ? ` - ${selectedReport.batch}` 
        : ""}
</h1>
                    </div>

                  

                    <div className="border-2 border-black rounded-lg overflow-x-auto shadow-sm">
                        <Table className="border-collapse min-w-full">
                            <TableHeader className="bg-[#c5b391]">
                                <TableRow className="border-b-2 border-black divide-x divide-black">
                                    <TableHead className="w-12 text-center font-black text-black">#</TableHead>
                                    <TableHead className="min-w-[200px] text-right font-black text-black">الاسم والبيانات</TableHead>
                                   {attendanceData.template && attendanceData.template.map((sess: any, i: number) => (
    <TableHead key={i} className="text-center font-black text-black border-l border-black min-w-[50px] p-1 bg-[#c5b391]">
        <div className="flex flex-col items-center justify-center gap-0.5">
            {/* رقم الحصة */}
            <span className="text-[11px] leading-none">{`حصة${i+1}`}</span>
            
            {/* 🟢 إضافة الوقت (من - إلى) بخط أصغر */}
            {sess.startTime && sess.endTime && sess.startTime !== "00:00" && (
                <span className="text-[8px] text-slate-700 font-bold opacity-80 leading-none">
                    {`${sess.startTime} - ${sess.endTime}`}
                </span>
            )}
        </div>
    </TableHead>
))}
                                    <TableHead className="text-center font-black text-black text-xs border-l border-black">المدة</TableHead>
                                    <TableHead className="text-center font-black text-black text-xs border-l border-black">البداية</TableHead>
                                   
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {attendanceData.rows?.map((row: any, idx: number) => (
                                    <TableRow key={row.soldier.id} className="border-b border-black divide-x divide-black h-14 hover:bg-slate-50 transition-colors">
                                        <TableCell className="text-center font-bold">{idx + 1}</TableCell>
                                        <TableCell className="text-right p-2">
                                            <div className="font-black text-sm text-black mb-0.5">{row.soldier.name}</div>
                                            <div className="text-[10px] text-slate-600 font-bold flex gap-2 italic">
                                                <span>{row.soldier.military_id}</span>
                                                <span className="text-slate-300">|</span>
                                                <span>{row.soldier.company}</span>
                                                <span className="text-slate-300">|</span>
                                                <span>{row.soldier.platoon}</span>
                                                {row.attachments && row.attachments.length > 0 && (
            <div className="flex gap-1 no-print">
                {row.attachments.map((file: string, fIdx: number) => (
                    <Button
                        key={fIdx}
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 border-[#c5b391] text-[#c5b391] hover:bg-[#c5b391] hover:text-white"
                onClick={() => {
    if (!file) return;

    // 1. معالجة الرابط بذكاء
    const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
    const finalUrl = file.startsWith('http') 
        ? file 
        : file.startsWith('data:') 
            ? file 
            : `${baseUrl}${file.startsWith('/') ? '' : '/'}${file}`;

    // 2. فحص نوع الملف
    const isPDF = finalUrl.toLowerCase().includes(".pdf") || finalUrl.startsWith("data:application/pdf");

    if (isPDF) {
        // إذا كان PDF (سواء رابط سحابي أو Base64) افتحه في تبويب جديد
        if (finalUrl.startsWith('data:')) {
            const base64Data = finalUrl.split(',')[1];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
            window.open(URL.createObjectURL(blob), '_blank');
        } else {
            window.open(finalUrl, '_blank');
        }
    } else {
        // إذا كانت صورة (سواء سحابية أو Base64) افتحها في نافذة معاينة احترافية
        const newWindow = window.open('', '_blank');
        if (newWindow) {
            newWindow.document.write(`
                <html>
                    <head>
                        <title>معاينة المرفق</title>
                        <style>
                            body { margin: 0; background: #1a1a1a; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; }
                            .toolbar { width: 100%; background: #333; padding: 10px; display: flex; justify-content: center; position: fixed; top: 0; z-index: 10; }
                            button { padding: 10px 25px; background: #c5b391; color: black; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
                            img { max-width: 95%; max-height: 85vh; margin-top: 60px; box-shadow: 0 0 50px rgba(0,0,0,0.7); border: 2px solid #444; }
                        </style>
                    </head>
                    <body>
                        <div class="toolbar"><button onclick="window.close()">إغلاق المعاينة ×</button></div>
                        <img src="${finalUrl}" />
                    </body>
                </html>
            `);
            newWindow.document.close();
        }
    }
}}
                        title={file.includes('pdf') ? "عرض ملف PDF" : "عرض صورة"}
                    >
                        {file.includes('pdf') ? <FileText className="w-3.5 h-3.5" /> : <Paperclip className="w-3.5 h-3.5" />}
                    </Button>
                ))}
            </div>
        )}
    </div>
</TableCell>
                                        {/* ✅ ضع هذا الكود مكانه تماماً */}
{row.sessions.map((sessionObj: any, sIdx: number) => {
    // 🔍 1. جلب بيانات الحصة من القالب (Template) للتأكد من الاعتماد
    const sessionTemplate = attendanceData.template?.[sIdx];
    
    // 🛡️ 2. فحص هل الحصة معتمدة من الضابط أو بالنيابة؟
    // (هذا هو الشرط الذي كان يحمي البيانات سابقاً)
    const isSessionApproved = sessionTemplate?.is_officer_approved || sessionTemplate?.is_proxy_approval;

    const status = sessionObj?.status || "حاضر";
    const isPresent = status === "حاضر";

    // 🛑 3. المنطق: إذا كانت الحصة غير معتمدة، نعرض "-" دائماً (كأنه حاضر)
    if (!isSessionApproved) {
        return (
            <TableCell 
                key={sIdx} 
                className="text-center p-0 font-black text-[10px] border-l border-black min-w-[60px] text-slate-300 opacity-40"
            >
                -
            </TableCell>
        );
    }

    // 🟢 4. إذا كانت معتمدة، نعرض الحالة الحقيقية (طبية، غياب، إلخ)
    return (
        <TableCell 
            key={sIdx} 
            className={`text-center p-0 font-black text-[10px] border-l border-black min-w-[60px] ${isPresent ? 'text-slate-300' : 'text-red-600'}`}
        >
            {isPresent ? "-" : (sessionObj.note && status === "أخرى" ? sessionObj.note : status)}
        </TableCell>
    );
})}
                                        <TableCell className="text-center font-black text-xs border-l border-black">
                                            {row.duration ? `${row.duration} يوم` : "-"}
                                        </TableCell>
                                        <TableCell className="text-center font-bold text-[9px] text-slate-500 border-l border-black">
                                            {row.start_date || "-"}
                                        </TableCell>
                                        
                                    </TableRow>
                                ))}
                               {(!attendanceData.rows || attendanceData.rows.length === 0) && (
    <TableRow>
        <TableCell 
            colSpan={(attendanceData.template?.length || 0) + 5} 
            className="h-40 text-center text-slate-400 font-bold bg-slate-50/50"
        >
            <div className="flex flex-col items-center gap-2">
                <CheckCircle2 className="w-10 h-10 text-green-500 opacity-20" />
                <p>لم يتم اعتماد أي حالات غياب لهذه الدورة اليوم حتى الآن</p>
                <p className="text-[10px] text-slate-400 font-medium">(أو أن جميع الطلبة حاضرون في الحصص المعتمدة)</p>
            </div>
        </TableCell>
    </TableRow>
)}
        </TableBody>
                        </Table>
                    </div>

                   <div className="grid grid-cols-3 gap-6 pt-16 text-center border-t-2 border-dashed border-slate-200 mt-10">
    {[
        { label: "ضابط التدريب الرياضي", key: "supervisor" }, // برمجياً هو supervisor ولكن يظهر كضابط
        { label: "ضابط التدريب العسكري", key: "officer" },    // برمجياً هو officer ويظهر كضابط
        { label: "رئيس قسم التدريب العسكري والرياضي", key: "head" }
    ].map((item) => {
        const approval = attendanceData.approvals?.[item.key];
        return (
            <div key={item.key} className="flex flex-col items-center gap-2">
                {/* العنوان المحدث */}
                <p className="font-black text-sm underline underline-offset-8 mb-4">
                    {item.label}
                </p>
                
                {approval ? (
                    <div className="relative group flex flex-col items-center">
                        {/* 🛡️ زر إلغاء الاعتماد يظهر فقط للاونر أو المدير لزيادة الأمان */}
                        {(userRole === "owner" || userRole === "manager" || userRole === "admin" || userRole === "military_officer" || userRole === "sports_officer") && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="no-print absolute -top-4 -right-8 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                                onClick={() => handleUnapprove(item.key)}
                            >
                                <RotateCcw className="w-3 h-3" />
                            </Button>
                        )}
                        
                        {/* عرض الرتبة والاسم */}
                        <p className="font-black text-[14px] text-blue-900">
                            {approval.rank} / {approval.name}
                        </p>

                        {/* كود عرض التوقيع مع المعالجة الذكية للصيغ */}
                        <div className="h-10 mt-0.5 print:h-14 print:mt-0 flex justify-center"> 
                            <img 
                                src={`https://cynkoossuwenqxksbdhi.supabase.co/storage/v1/object/public/Signatures/${approval.mil_id}.png`} 
                                className="h-full print:max-h-14 object-contain mix-blend-multiply" 
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    if (target.src.includes('.png')) {
                                        target.src = target.src.replace('.png', '.jpg');
                                    } else if (target.src.includes('.jpg')) {
                                        target.src = target.src.replace('.jpg', '.jpeg');
                                    } else {
                                        target.style.display = 'none';
                                    }
                                }} 
                            />
                        </div>
                    </div>
                ) : (
                    <div className="no-print">
                        <p className="italic text-slate-300 text-[10px] mb-2">بانتظار اعتماد الضابط...</p>
                        <Button 
                            size="sm" 
                            variant="outline" 
                            className="border-[#c5b391] text-[#c5b391] hover:bg-[#c5b391]/10 font-bold text-xs"
                            onClick={() => handleApprove(item.key)}
                        >
                            اعتماد الضابط
                        </Button>
                    </div>
                )}
            </div>
        );
    })}
</div>
                </div>
            </div>
        </ProtectedRoute>
    );
}