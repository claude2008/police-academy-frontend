"use client"

import { useState, useEffect, useMemo } from "react"
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

    const [options, setOptions] = useState({ courses: [], batches: [] });

   useEffect(() => {
    fetchInitialOptions();
}, [date]);

   const filteredReports = useMemo(() => {
    return dailySummaries.filter((report: any) => {
        // نستخدم القيم المختارة من القوائم المنسدلة (selectedCourse / selectedBatch)
        const matchCourse = selectedCourse === "all" || report.course === selectedCourse;
        const matchBatch = selectedBatch === "all" || report.batch === selectedBatch;
        return matchCourse && matchBatch;
    });
}, [dailySummaries, selectedCourse, selectedBatch]);

   const fetchInitialOptions = async () => {
    setLoading(true);
    try {
        const token = localStorage.getItem("token");
        const [fRes, tRes, sRes] = await Promise.all([
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/filters-options`),
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/training/templates`, {
                headers: { "Authorization": `Bearer ${token}` }
            }),
            // 🟢 التعديل هنا: نستخدم الرابط الجديد والذكي الذي أنشأناه في الباك إند
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/daily-summaries?date=${date}`, {
                headers: { "Authorization": `Bearer ${token}` }
            })
        ]);
        
        if (fRes.ok) setOptions(await fRes.json());
        if (tRes.ok) setTemplates(await tRes.json());
        
        // 🟢 معالجة البيانات أصبحت أسهل بكثير لأن الباك إند يرسلها جاهزة
        if (sRes.ok) {
            const data = await sRes.json();
            // البيانات تصل الآن بالشكل: [{course: "...", batch: "...", count: 2}, ...]
            setDailySummaries(data);
        }
    } catch (e) { 
        toast.error("خطأ في جلب البيانات"); 
    } finally { 
        setLoading(false); 
    }
};

    const openReport = async (course: string, batch: string) => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/session/audit-report-data?date=${date}&course=${course}&batch=${batch}`,
                { headers: { "Authorization": `Bearer ${token}` } }
            );

            if (res.ok) {
                const data = await res.json();
                setAttendanceData(data);
                setSelectedReport({ course, batch }); 
            } else {
                toast.error("فشل في جلب بيانات التقرير");
            }
        } catch (e) {
            toast.error("خطأ في الاتصال");
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

    // 1. بناء البيانات صفاً بصف
    const dataForExcel = attendanceData.rows.map((row: any, i: number) => {
        // أ. البيانات الأساسية في بداية الصف
        const excelRow: any = {
            "م": i + 1,
            "الرقم العسكري": row.soldier.military_id,
            "الاسم": row.soldier.name,
            "السرية/الفصيل": `${row.soldier.company} / ${row.soldier.platoon}`,
        };

        // ب. إضافة أعمدة الحصص مع الوقت في العنوان (Header)
        attendanceData.template.forEach((sess: any, index: number) => {
            // تجهيز نص الوقت إذا وجد (مثال: ح1 05:00-06:00)
            const timeInfo = (sess.startTime && sess.endTime && sess.startTime !== "00:00") 
                ? ` (${sess.startTime}-${sess.endTime})` 
                : "";
            
            const sessionKey = `ح${index + 1}${timeInfo}`; // هذا سيكون عنوان العمود
            
            const sessionObj = row.sessions[index];
    
    if (sessionObj) {
        // 🟢 التعديل هنا ليدعم "أخرى" في الإكسل
        const statusText = (sessionObj.status === "أخرى" && sessionObj.note) 
            ? sessionObj.note 
            : sessionObj.status;

        excelRow[sessionKey] = `${statusText} (${sessionObj.created_by})`;
    } else {
        excelRow[sessionKey] = "-";
    }
});

        // ج. البيانات النهائية في نهاية الصف
        excelRow["المدة"] = row.duration ? `${row.duration} يوم` : "-";
        excelRow["البداية"] = row.start_date || "-";

        return excelRow;
    });

    // 2. تحويل البيانات إلى ورقة عمل (Worksheet)
    const ws = XLSX.utils.json_to_sheet(dataForExcel);

    // 3. تحسين شكل الإكسل (توسيع الأعمدة قليلاً لأن العنوان أصبح أطول)
    const wscols = [
        { wch: 5 },   // م
        { wch: 15 },  // الرقم العسكري
        { wch: 35 },  // الاسم
        { wch: 25 },  // السرية
        ...attendanceData.template.map(() => ({ wch: 20 })), // زيادة العرض لـ 20 لاستيعاب الوقت واسم المدخل
        { wch: 10 },  // المدة
        { wch: 15 }   // البداية
    ];
    ws['!cols'] = wscols;

    // 4. إنشاء الملف وتحميله
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "كشف التدقيق اليومي");
    XLSX.writeFile(wb, `تدقيق_${selectedReport.course}_${date}.xlsx`);
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
    window.print();

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
                                <ShieldCheck className="w-8 h-8 text-[#c5b391]" /> تدقيق واعتماد التكميل اليومي
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
    {paginatedReports.map((report: any, index: number) => (
        <div 
            key={index}
            onClick={() => openReport(report.course, report.batch)}
            className="bg-white p-6 rounded-2xl border-2 border-slate-100 hover:border-[#c5b391] hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden"
        >
            {/* الديكور الجانبي القديم */}
            <div className="absolute top-0 right-0 w-2 h-full bg-[#c5b391] opacity-20 group-hover:opacity-100 transition-opacity" />
            
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-black text-xl text-slate-800 mb-1">
                        {report.course}
                    </h3>
                    <p className="text-[#c5b391] font-bold text-sm">
                        {report.batch && report.batch !== "none" ? report.batch : "بدون دفعة"}
                    </p>
                    <div className="flex gap-2 items-center">
            {report.status === "fully_approved" ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 font-black text-[10px]">
                    معتمد بالكامل ✅
                </Badge>
            ) : report.status === "officer_approved" ? (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-black text-[10px]">
                    تم اعتماد الضابط 🔵
                </Badge>
            ) : report.status === "supervisor_approved" ? (
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 font-black text-[10px]">
                    تم اعتماد المشرف 🟣
                </Badge>
            ) : (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 font-black text-[10px]">
                    قيد المراجعة ⏳
                </Badge>
            )}
        </div>
                </div>
                <div className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-black">
                    {report.count} طلاب
                </div>
            </div>

            <div className="mt-6 flex items-center justify-between text-slate-400 text-[11px] font-bold">
                <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>تاريخ: {date}</span>
                </div>
                <span className="group-hover:text-[#c5b391] transition-colors">عرض التقرير ←</span>
            </div>
        </div>
    ))}
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
        @page { size: A4 ; margin: 4mm; }
        .no-print { display: none !important; }
        body { background: white !important; padding: 0 !important; }
        
        /* 🟢 السماح للجدول بتحديد العرض بناءً على المحتوى مع الالتزام بعرض الورقة */
        table { 
            width: 100% !important; 
            table-layout: auto !important; 
            border-collapse: collapse !important;
        }
        
        th, td { 
            word-wrap: break-word !important; 
            padding: 4px 2px !important; 
            line-height: 1.2 !important;
        }
        
        /* منع انقسام الصفوف بين ورقتين */
        tr { page-break-inside: avoid !important; }

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
                            {selectedReport.batch && selectedReport.batch !== "all" && selectedReport.batch !== "none" ? ` - ${selectedReport.batch}` : ""}
                        </h1>
                    </div>

                   <div className="no-print overflow-x-auto rounded-xl border-2 border-[#c5b391] shadow-md mb-6">
    <table className="w-full min-w-[800px] text-center text-sm">
        <thead className="bg-[#c5b391] text-black font-black">
            <tr className="divide-x divide-black">
                <th className="p-2 border-l border-black">القوة</th>
                <th className="p-2 border-l border-black">طبية</th>
                <th className="p-2 border-l border-black">عيادة</th>
                <th className="p-2 border-l border-black">إجازة</th>
                <th className="p-2 border-l border-black">إجازة إدارية</th>
                <th className="p-2 border-l border-black">إجازة وفاة</th>
                <th className="p-2 border-l border-black">تأخير</th>
                <th className="p-2 border-l border-black">استراحة</th>
                <th className="p-2 border-l border-black">غياب</th>
                {/* 🟢 العمود الجديد لضبط الحساب */}
                <th className="p-2 border-l border-black bg-[#b5a381]">أخرى</th>
                <th className="p-2 border-l border-black bg-[#c5b391]">الحالات</th>
                <th className="p-2 bg-[#c5b391]">الموجود</th>
            </tr>
        </thead>
        <tbody className="bg-white font-black text-slate-700">
            <tr className="divide-x divide-black">
                <td className="p-2 bg-slate-50 border-l border-black">{displayStats.total}</td>
                <td className="p-2 border-l border-black text-red-600">{displayStats.medical || "-"}</td>
                <td className="p-2 border-l border-black text-red-600">{displayStats.clinic || "-"}</td>
                <td className="p-2 border-l border-black text-red-600">{displayStats.leave || "-"}</td>
                <td className="p-2 border-l border-black text-red-600">{displayStats.admin_leave || "-"}</td>
                <td className="p-2 border-l border-black text-red-600">{displayStats.death_leave || "-"}</td>
                <td className="p-2 border-l border-black text-red-600">{displayStats.late_parade || "-"}</td>
                <td className="p-2 border-l border-black text-red-600">{displayStats.rest || "-"}</td>
                <td className="p-2 border-l border-black text-red-600">{displayStats.absent || "-"}</td>
                {/* 🟢 عرض القيمة المحسوبة للحالات الإضافية */}
                <td className="p-2 border-l border-black text-red-600">{displayStats.calculatedOther || "-"}</td>
                <td className="p-2 text-red-600 bg-blue-50/30 border-l border-black">{displayStats.cases}</td>
                <td className="p-2 text-green-700">{displayStats.present}</td>
            </tr>
        </tbody>
    </table>
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
            <span className="text-[11px] leading-none">{`ح${i+1}`}</span>
            
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
    // المنطق الجديد: إذا كانت الحالة "أخرى" وهناك ملاحظة، نعرض الملاحظة (مثل: مستشفى)
    const displayValue = (sessionObj?.status === "أخرى" && sessionObj?.note) 
        ? sessionObj.note 
        : (sessionObj?.status || "-");

    return (
        <TableCell 
            key={sIdx} 
            className="text-center p-0 font-black text-[10px] text-red-600 border-l border-black min-w-[60px]"
        >
            {displayValue}
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
                        className="h-32 text-center text-slate-400 font-bold"
                    >
                        لا يوجد حالات مسجلة لهذا اليوم (الكل حاضر)
                    </TableCell>
                </TableRow>
            )}
        </TableBody>
                        </Table>
                    </div>

                    <div className="grid grid-cols-3 gap-6 pt-16 text-center border-t-2 border-dashed border-slate-200 mt-10">
                        {[
                            { label: "  مشرف التدريب", key: "supervisor" },
                            { label: "  ضابط التدريب", key: "officer" },
                            { label: "رئيس قسم التدريب العسكري والرياضي", key: "head" }
                        ].map((item) => {
                            const approval = attendanceData.approvals?.[item.key];
                            return (
                                <div key={item.key} className="flex flex-col items-center gap-2">
                                    <p className="font-black text-sm underline underline-offset-8 mb-4">{item.label}</p>
                                    {approval ? (
                                        <div className="relative group flex flex-col items-center">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="no-print absolute -top-4 -right-8 text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                                                onClick={() => handleUnapprove(item.key)}
                                            >
                                                <RotateCcw className="w-3 h-3" />
                                            </Button>
                                            <p className="font-black text-[14px] text-blue-900">{approval.rank} / {approval.name}</p>
                                          {/* كود عرض التوقيع المعدل */}
<div className="h-10 mt-0.5 print:h-14 print:mt-0 flex justify-center"> 
    <img 
        // 🟢 رابط سوبابيز المباشر (تأكد من استبدال YOUR_PROJECT_URL برابط مشروعك)
        src={`https://cynkoossuwenqxksbdhi.supabase.co/storage/v1/object/public/Signatures/${approval.mil_id}.png`} 
        
        className="h-full print:max-h-14 object-contain mix-blend-multiply" 
        
        // معالجة ذكية للصيغة (png -> jpg -> jpeg)
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
                                            <p className="italic text-slate-300 text-[10px] mb-2">بانتظار الاعتماد...</p>
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className="border-[#c5b391] text-[#c5b391] hover:bg-[#c5b391]/10 font-bold text-xs"
                                                onClick={() => handleApprove(item.key)}
                                            >
                                                اعتماد الآن
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