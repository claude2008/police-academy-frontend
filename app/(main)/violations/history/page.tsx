"use client"

import { useState, useEffect, useMemo } from "react"
import { 
    ArrowRight, Printer, Download, Search, 
    Loader2, RotateCcw, FileText, Paperclip, 
    Trash2, ShieldAlert, CheckCircle2, User, Calendar,
    ChevronRight, ChevronLeft, Filter, ListFilter, Eye,AlertTriangle
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
// أضف هذا السطر في الأعلى
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter,
    DialogDescription 
} from "@/components/ui/dialog"
export default function ViolationsRegistryPage() {
    const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [selectedCourse, setSelectedCourse] = useState("all");
    const [selectedBatch, setSelectedBatch] = useState("all");
    const [loading, setLoading] = useState(false);
    const [dailySummaries, setDailySummaries] = useState<any[]>([]);
    const [selectedReport, setSelectedReport] = useState<any>(null);
    const [reportRows, setReportRows] = useState<any[]>([]); 
    const [approvals, setApprovals] = useState<any>({}); // 🟢 حالة حفظ التوقيعات
    const [options, setOptions] = useState({ courses: [], batches: [] });
    const [currentPage, setCurrentPage] = useState(1);
    // أضف هذا السطر مع بقية الـ states في الأعلى
const [confirmDeleteId, setConfirmDeleteId] = useState<any>(null);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    // أضف هذه في أعلى المكون مع بقية الـ states
const [deleteModalOpen, setDeleteModalOpen] = useState(false);
const [selectedStudentForDelete, setSelectedStudentForDelete] = useState<any>(null);
const [isDeleting, setIsDeleting] = useState(false);
    const [customTitles, setCustomTitles] = useState({
    supervisor: "مشرف التدريب",
    officer: "ضابط التدريب",
    head: "رئيس قسم التدريب العسكري والرياضي"
});
    // 🟢 تحديث منطق التجميع ليشمل محرر المخالفة
const groupedRows = useMemo(() => {
    const groups: { [key: string]: any } = {};
    
    reportRows.forEach((row) => {
        const id = row.military_id;

        // 1. تجهيز كائن المخالفة المنفردة
        const violationTicket = {
            id: row.id,
            name: row.violation_name,
            penalty: row.penalty,
            editor: row.entered_by,
            // التأكد من تقسيم النص بشكل آمن
            type: row.period ? String(row.period).split(" ")[0] : "عام", 
            date: row.date,
            // حفظ المرفقات الخاصة بهذه المخالفة تحديداً
            attachments: Array.isArray(row.attachments) ? row.attachments : []
        };

        if (!groups[id]) {
            // 2. إنشاء سجل جديد للطالب في القائمة
            groups[id] = { 
                ...row, 
                violationTickets: [violationTicket],
                // تجميع كافة المرفقات في مصفوفة واحدة للعرض الكلي
                all_attachments: Array.isArray(row.attachments) ? [...row.attachments] : [] 
            };
        } else {
            // 3. إضافة المخالفة الجديدة لقائمة مخالفات نفس الطالب
            groups[id].violationTickets.push(violationTicket);
            
            // دمج المرفقات الجديدة مع المرفقات السابقة بدون تكرار
            if (Array.isArray(row.attachments)) {
                row.attachments.forEach((img: string) => {
                    if (img && !groups[id].all_attachments.includes(img)) {
                        groups[id].all_attachments.push(img);
                    }
                });
            }
        }
    });
    
    return Object.values(groups);
}, [reportRows]);
    useEffect(() => {
        fetchInitialOptions();
        fetchSummaries();
    }, [startDate, endDate]);

    const fetchInitialOptions = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/filters-options`);
            if (res.ok) setOptions(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchSummaries = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/violations/summaries?start_date=${startDate}&end_date=${endDate}`,
                { headers: { "Authorization": `Bearer ${token}` } }
            );
            if (res.ok) setDailySummaries(await res.json());
        } catch (e) { toast.error("خطأ في الاتصال"); } finally { setLoading(false); }
    };

    const openViolationReport = async (course: string, batch: string) => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/violations/report-details?start_date=${startDate}&end_date=${endDate}&course=${course}&batch=${batch}`,
                { headers: { "Authorization": `Bearer ${token}` } }
            );
            if (res.ok) {
                const data = await res.json();
                setReportRows(data.rows || []);
                setApprovals(data.approvals || {}); // 🟢 استقبال التوقيعات من الباك إند
                setSelectedReport({ course, batch });
            }
        } catch (e) { toast.error("فشل جلب التفاصيل"); } finally { setLoading(false); }
    };

    // 🟢 دالة تنفيذ الاعتماد (التوقيع)
   // 🟢 تحديث تعريف الدالة لتستقبل المسمى المخصص أيضاً
const handleApprove = async (level: string, customTitle: string) => {
    setLoading(true);
    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/violations/audit/approve`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${token}` 
            },
            body: JSON.stringify({
                start_date: startDate,
                end_date: endDate,
                course: selectedReport.course,
                batch: selectedReport.batch,
                level: level,
                // 🟢 إرسال المسمى المخصص للباك إند
                custom_title: customTitle 
            })
        });

        if (res.ok) {
            toast.success("تم الاعتماد بنجاح ✅");
            // إعادة جلب البيانات لتحديث التوقيعات على الشاشة
            openViolationReport(selectedReport.course, selectedReport.batch);
        } else {
            const err = await res.json();
            toast.error(err.detail || "فشل الاعتماد");
        }
    } catch (e) {
        toast.error("خطأ في الاتصال");
    } finally {
        setLoading(false);
    }
};

    // 🟢 دالة فك الاعتماد
    const handleUnapprove = async (level: string) => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/violations/audit/unapprove`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({
                    start_date: startDate,
                    end_date: endDate,
                    course: selectedReport.course,
                    batch: selectedReport.batch,
                    level: level
                })
            });
            if (res.ok) {
                toast.success("تم إلغاء الاعتماد");
                openViolationReport(selectedReport.course, selectedReport.batch);
            }
        } catch (e) { toast.error("خطأ في العملية"); }
    };

   const handleOpenAttachment = (path: string) => {
    if (!path) return;
    // إذا كان الرابط يبدأ بـ http (سحابي) نفتحه مباشرة
    // إذا كان يبدأ بـ /static نضع رابط السيرفر المحلي
    const fullUrl = path.startsWith('http') ? path : `${process.env.NEXT_PUBLIC_API_URL}${path}`;
    window.open(fullUrl, '_blank');
};

    const filteredReports = useMemo(() => {
        return dailySummaries.filter((r: any) => 
            (selectedCourse === "all" || r.course === selectedCourse) &&
            (selectedBatch === "all" || r.batch === selectedBatch)
        );
    }, [dailySummaries, selectedCourse, selectedBatch]);

    const paginatedReports = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredReports.slice(start, start + itemsPerPage);
    }, [filteredReports, currentPage, itemsPerPage]);

   const exportToExcel = () => {
    // 🟢 تحديث استخراج البيانات لتقرأ من violationTickets الجديدة
    const data = groupedRows.map((r, i) => ({
        "م": i + 1,
        "الرقم العسكري": r.military_id,
        "الاسم": r.name,
        "السرية": r.company,
        "الفصيل": r.platoon,
        // 🟢 تجميع البيانات من داخل مصفوفة التذاكر (Tickets)
        "المخالفات": r.violationTickets.map((v: any) => v.name).join(' | '),
        "المادة": r.violationTickets.map((v: any) => v.type).join(' | '),
        "محرر المخالفة": r.violationTickets.map((v: any) => v.editor).join(' | '),
        "الجزاءات": r.violationTickets.map((v: any) => v.penalty).join(' | '),
        "التاريخ": r.violationTickets.map((v: any) => v.date.split(" ")[0]).join(' | ')
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "سجل المخالفات");
    const excelFileName = `سجل_مخالفات_${selectedReport.course}_${selectedReport.batch}_من_${startDate}_إلى_${endDate}.xlsx`;
    XLSX.writeFile(wb, excelFileName);
};
// 1. دالة حذف مخالفة واحدة
// 1. دالة حذف مخالفة واحدة (نسخة محسنة)
const executeSingleDelete = async (violationId: number) => {
    setIsDeleting(true); // 🟢 تفعيل حالة التحميل لمنع الضغط المتكرر
    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/violations/delete-by-id/${violationId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        const data = await res.json();

        if (res.ok) {
            toast.success("تم حذف المخالفة بنجاح ✅");
            // 🔄 تحديث البيانات أولاً ثم إغلاق النافذة
            await openViolationReport(selectedReport.course, selectedReport.batch);
            setDeleteModalOpen(false); 
            setConfirmDeleteId(null);
        } else {
            // 🛡️ إظهار رسالة المنع (مثلاً: السجل معتمد)
            toast.error(data.detail || "فشل عملية الحذف");
            setConfirmDeleteId(null); // العودة للقائمة داخل المودال
        }
    } catch (e) {
        toast.error("خطأ في الاتصال بالسيرفر");
    } finally {
        setIsDeleting(false); // 🔴 إيقاف حالة التحميل
    }
};

// 2. دالة حذف كافة مخالفات الطالب (نسخة محسنة)
const executeDeleteAll = async () => {
    if (!selectedStudentForDelete) return;
    setIsDeleting(true); // 🟢 تفعيل حالة التحميل
    try {
        const token = localStorage.getItem("token");
        const ids = selectedStudentForDelete.violationTickets.map((v: any) => v.id);
        
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/violations/bulk-delete-ids`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` 
            },
            body: JSON.stringify({ ids })
        });
        
        const data = await res.json();

        if (res.ok) {
            toast.success("تم مسح كافة المخالفات بنجاح ✅");
            await openViolationReport(selectedReport.course, selectedReport.batch);
            setDeleteModalOpen(false);
            setConfirmDeleteId(null);
        } else {
            toast.error(data.detail || "فشل حذف السجلات");
            setConfirmDeleteId(null);
        }
    } catch (e) {
        toast.error("فشل الاتصال بالخادم");
    } finally {
        setIsDeleting(false); // 🔴 إيقاف حالة التحميل
    }
};

const confirmDeleteAll = async () => {
    if (!window.confirm("تحذير: سيتم مسح كافة مخالفات هذا الطالب في هذه الفترة. هل تود الاستمرار؟")) return;
    
    // تنفيذ حلقة تكرارية لحذف الكل أو إنشاء endpoint في الباك اند لحذف مصفوفة IDs
    const ids = selectedStudentForDelete.violationTickets.map((v: any) => v.id);
    // ... تنفيذ الاتصال بالباك اند ...
};
    if (!selectedReport) {
        return (

            <ProtectedRoute allowedRoles={["owner","manager","admin","assistant_admin","military_officer","sports_officer","sports_supervisor","military_supervisor"]}>
                <div className="p-6 space-y-6 bg-slate-50 min-h-screen " dir="rtl">
                    <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                                <ShieldAlert className="w-8 h-8 text-red-600" /> سجل المخالفات الانضباطية
                            </h1>
                            <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl border">
                                <div className="flex items-center gap-2">
                                    <Label className="text-[10px] font-bold">من:</Label>
                                    <Input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="h-8 w-36 font-bold text-xs" />
                                </div>
                                <div className="flex items-center gap-2 border-r pr-2 mr-2">
                                    <Label className="text-[10px] font-bold">إلى:</Label>
                                    <Input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="h-8 w-36 font-bold text-xs" />
                                </div>
                                
                            </div>
                            <Button onClick={fetchSummaries} size="sm" className="bg-slate-900 text-[#c5b391] h-8">
                                    <Search className="w-3 h-3 ml-1"/> بحث
                                </Button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                            <Select value={selectedCourse} onValueChange={setSelectedCourse}><SelectTrigger className="font-bold h-9"><SelectValue placeholder="كل الدورات" /></SelectTrigger><SelectContent><SelectItem value="all">كل الدورات</SelectItem>{options.courses?.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                            <Select value={selectedBatch} onValueChange={setSelectedBatch}><SelectTrigger className="font-bold h-9"><SelectValue placeholder="كل الدفعات" /></SelectTrigger><SelectContent><SelectItem value="all">كل الدفعات</SelectItem>{options.batches?.map(b=><SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select>
                            <div className="flex items-center gap-2 bg-slate-50 px-4 rounded-lg border h-9">
                                <Label className="text-xs font-bold text-slate-400">عرض:</Label>
                                <Select value={String(itemsPerPage)} onValueChange={(v)=>setItemsPerPage(Number(v))}>
                                    <SelectTrigger className="w-16 border-none bg-transparent font-bold h-8"><SelectValue /></SelectTrigger>
                                    <SelectContent>{[10, 20, 50].map(n=><SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20"><Loader2 className="w-12 h-12 animate-spin text-[#c5b391]" /></div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {paginatedReports.map((report: any, index: number) => (
                                <div key={index} onClick={() => openViolationReport(report.course, report.batch)} className="bg-white p-6 rounded-2xl border-2 border-slate-100 hover:border-red-400 hover:shadow-2xl transition-all cursor-pointer group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-2 h-full bg-red-600 opacity-20 group-hover:opacity-100 transition-opacity" />
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-black text-xl text-slate-800">{report.course}</h3>
                                            <p className="text-slate-500 font-bold">الدفعة: {report.batch && report.batch !== 'none' ? report.batch : '---'}</p>
                                            <div className="flex gap-2 mt-2">
                                                <Badge className="bg-red-50 text-red-700 border-red-100 font-black">
    {report.count} طلاب مخالفين
</Badge>
                                                {report.status === "fully_approved" && <Badge className="bg-green-50 text-green-700 border-green-100">معتمد ✅</Badge>}
                                            </div>
                                        </div>
                                        <div className="p-3 bg-red-50 rounded-xl"><FileText className="w-6 h-6 text-red-600" /></div>
                                    </div>
                                    <div className="mt-6 flex justify-between items-center text-[10px] font-black text-slate-400">
                                        <span>الفترة: {startDate} / {endDate}</span>
                                        <span className="text-red-600">فتح السجل ←</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center justify-between bg-white p-4 rounded-xl border shadow-sm">
                        <p className="text-xs font-bold text-slate-400 italic">عدد الدورات المكتشفة: {filteredReports.length}</p>
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
            <div className="min-h-screen bg-white p-4  pb-32" dir="rtl">
                <style jsx global>{`
                    @media print {
    @page { size: A4; margin: 5mm; }
    .no-print { display: none !important; }
    body { background: white; }
    
    /* 🟢 إجبار الجدول على احترام عرض الورقة ومنع التمدد */
    table { 
        width: 100% !important; 
        table-layout: fixed !important; /* هذا السطر هو الأهم لمنع تمدد الأعمدة */
        border-collapse: collapse !important; 
    }

    th, td { 
        border: 1px solid black !important; 
        padding: 4px !important; 
        font-size: 9px !important; /* تصغير الخط قليلاً للوضوح */
        word-wrap: break-word !important; 
        white-space: normal !important; /* السماح للنص بالنزول لسطر جديد */
        overflow: hidden !important;
    }

    /* 🟢 تحديد عرض كل عمود بدقة (مجموعهم 100%) */
    th:nth-child(1), td:nth-child(1) { width: 5% !important; }  /* # */
    th:nth-child(2), td:nth-child(2) { width: 25% !important; } /* الاسم والبيانات */
    th:nth-child(3), td:nth-child(3) { width: 35% !important; } /* المخالفات - مساحة أكبر */
    th:nth-child(4), td:nth-child(4) { width: 15% !important; } /* المحرر */
    th:nth-child(5), td:nth-child(5) { width: 15% !important; } /* الجزاءات */
    th:nth-child(6), td:nth-child(6) { width: 5% !important; }  /* المرفق */

    .bg-beige-print { background-color: #c5b391 !important; -webkit-print-color-adjust: exact; }
}
                `}</style>

                <div className="no-print flex justify-between items-center mb-8 bg-slate-100 p-4 rounded-2xl border">
                    <Button variant="ghost" onClick={() => setSelectedReport(null)} className="gap-2 font-bold"><ArrowRight className="w-5 h-5"/> العودة</Button>
                    <div className="flex gap-3">
                        <Button onClick={() => {
    // 1. حفظ العنوان القديم
    const originalTitle = document.title;
    
    // 2. تجهيز الاسم الجديد: المخالفات_من_إلى_الدورة_الدفعة
    const fileName = `المخالفات_${startDate}_إلى_${endDate}_${selectedReport.course}_${selectedReport.batch}`;
    
    // 3. تعيين العنوان الجديد للمتصفح
    document.title = fileName;
    
    // 4. فتح نافذة الطباعة
    window.print();
    
    // 5. إعادة العنوان الأصلي بعد ثانية (لكي لا يتغير شكل التبويب دائماً)
    setTimeout(() => { document.title = originalTitle; }, 1000);
}} className="bg-slate-900 text-white gap-2">
    <Printer className="w-4 h-4"/> طباعة
</Button>
                        <Button onClick={exportToExcel} variant="outline" className="border-green-600 text-green-700 gap-2"><Download className="w-4 h-4"/> إكسل</Button>
                    </div>
                </div>

                <div className="max-w-[1000px] mx-auto space-y-6">
                    <div className="flex justify-between items-start border-b-2 border-black pb-6">
                        <div className="w-1/3"><img src="/logo.jpg" className="w-20 h-20 object-contain" /></div>
                        <div className="w-1/3 text-center font-black">
                            <h2 className="text-lg">معهد الشرطة</h2>
                            <h3 className="text-sm">قسم التدريب العسكري والرياضي</h3>
                            <h4 className="text-xs underline mt-2">سجل المخالفات الانضباطية</h4>
                        </div>
                        <div className="w-1/3 text-left font-bold text-[10px]">
                            <p>الفترة: {startDate} إلى {endDate}</p>
                            <p>التاريخ: {format(new Date(), "yyyy-MM-dd")}</p>
                        </div>
                    </div>

                    <div className="text-center">
                        <h1 className="text-xl font-black bg-[#c5b391] py-3 border-2 border-black rounded-xl shadow-inner bg-beige-print">
                            سجل مخالفات: {selectedReport.course} ({selectedReport.batch})
                        </h1>
                    </div>

                    <div className="border-2 border-black rounded-lg overflow-hidden">
                        <Table className="border-collapse w-full">
                            <TableHeader className="bg-[#c5b391] bg-beige-print">
                                <TableRow className="border-b-2 border-black divide-x divide-black">
                                    <TableHead className="w-10 text-center font-black text-black border-l border-black">#</TableHead>
                                    <TableHead className="w-[220px] text-right font-black text-black border-l border-black">الاسم والبيانات</TableHead>
                                    <TableHead className="text-right font-black text-black border-l border-black">المخالفات</TableHead>
                                    <TableHead className="w-32 text-right font-black text-black border-l border-black">محرر المخالفة</TableHead>
                                    <TableHead className="w-36 text-center font-black text-black border-l border-black">الجزاءات</TableHead>
                                    <TableHead className="w-12 text-center font-black text-black no-print">مرفق</TableHead>
                                    <TableHead className="w-16 text-center font-black text-black no-print">إجراءات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
    {groupedRows.map((row, idx) => (
        <TableRow key={idx} className="border-b border-black divide-x divide-black hover:bg-slate-50 transition-colors">
            <TableCell className="text-center font-bold border-l border-black">{idx + 1}</TableCell>
            
            {/* 🟢 عمود الاسم: قمنا بتصغير العرض ليعطي مساحة للمخالفة */}
<TableCell className="text-right border-l border-black w-1/4 min-w-[150px]">
    <div className="font-black text-xs truncate" title={row.name}>{row.name}</div>
    <div className="text-[9px] text-slate-600 font-bold leading-tight">
        {row.rank} | {row.military_id}
        <br />
        س: {row.company} | ف: {row.platoon}
    </div>
</TableCell>

{/* 🔴 عمود المخالفات: جعلناه يأخذ المساحة الأكبر (نصف عرض الجدول تقريباً) */}
<TableCell className="text-right font-bold text-[10px] text-red-700 border-l border-black py-2 w-1/2 min-w-[250px]">
    <div className="flex flex-col gap-1.5">
        {row.violationTickets.map((v: any, i: number) => (
            <div key={i} className={i !== 0 ? "border-t border-black/10 pt-1" : ""}>
                <p className="whitespace-normal break-words leading-tight text-justify">
                    • {v.name}
                </p>
            </div>
        ))}
    </div>
</TableCell>

            {/* 🟢 تحديث عمود المحرر ليقرأ من violationTickets */}
            <TableCell className="text-right font-bold text-[9px] text-slate-500 border-l border-black py-2">
                <div className="flex flex-col gap-1.5">
                    {row.violationTickets.map((v: any, i: number) => (
                        <div key={i} className={i !== 0 ? "border-t border-black/10 pt-1" : ""}>
                            {v.editor || "---"}
                        </div>
                    ))}
                </div>
            </TableCell>

            {/* 🟢 تحديث عمود الجزاءات ليقرأ من violationTickets */}
            <TableCell className="text-center border-l border-black py-2">
                <div className="flex flex-col gap-1.5 items-center">
                    {row.violationTickets.map((v: any, i: number) => (
                        <span key={i} className="text-[9px] font-black px-2 py-0.5 bg-red-50 text-red-700 rounded border border-red-100">
                            {v.penalty}
                        </span>
                    ))}
                </div>
            </TableCell>

           <TableCell className="text-center no-print">
    <div className="flex flex-wrap justify-center gap-1">
        {row.all_attachments?.map((file: string, fIdx: number) => {
            if (!file) return null;

            // 🔍 الفحص الجوهري: هل الرابط يحتوي على كلمة pdf؟
            const isPDF = file.toLowerCase().includes('.pdf');

            return (
                <Button 
                    key={fIdx} 
                    size="sm" 
                    variant="ghost" 
                    // 🎨 تنسيق الألوان: أحمر للـ PDF لتمييزه فوراً
                    className={`h-7 w-7 p-0 ${isPDF ? 'text-red-600 hover:bg-red-50' : 'text-blue-600 hover:bg-blue-50'}`} 
                    onClick={() => handleOpenAttachment(file)}
                    title={isPDF ? "فتح ملف PDF" : "عرض الصورة"}
                >
                    {isPDF ? (
                        <FileText className="w-4 h-4" /> // 📄 أيقونة ملف للـ PDF
                    ) : (
                        <Paperclip className="w-4 h-4" /> // 📎 أيقونة مشبك للصور
                    )}
                </Button>
            );
        })}
    </div>
</TableCell>

            {/* 🟢 أضف عمود الحذف هنا في النهاية (الإجراءات) */}
            <TableCell className="text-center no-print border-r">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                    onClick={() => {
                        setSelectedStudentForDelete(row);
                        setDeleteModalOpen(true);
                    }}
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            </TableCell>
        </TableRow>
    ))}
</TableBody>
                        </Table>
                    </div>

                    {/* 🟢 قسم الاعتماد والتوقيعات الإلكترونية المحدث */}
                   <div className="grid grid-cols-3 gap-6 pt-16 text-center border-t-2 border-dashed border-black mt-10">
    {[
        { label: "supervisor", defaultName: "مشرف التدريب" },
        { label: "officer", defaultName: "ضابط التدريب" },
        { label: "head", defaultName: "رئيس قسم التدريب العسكري والرياضي" }
    ].map((item) => {
        const approval = approvals[item.label];
        const isApproved = !!approval;

        return (
    <div key={item.label} className="flex flex-col items-center gap-1">
        {/* 🟢 حقل إدخال المسمى المخصص - يعمل الآن بشكل تفاعلي */}
        <input 
            type="text"
            /* 1. ربط القيمة بالحالة الحالية لضمان الاستجابة */
            value={approval?.title || customTitles[item.label as keyof typeof customTitles]}
            /* 2. قفل التعديل فقط إذا كان هناك اعتماد رسمي */
            disabled={isApproved} 
            className="no-print text-center font-black text-xs underline underline-offset-8 mb-3 bg-transparent border-none focus:ring-0 w-full hover:bg-slate-50 transition-colors cursor-edit"
            /* 3. دالة التحديث الفوري عند الكتابة */
            onChange={(e) => {
                const newTitle = e.target.value;
                setCustomTitles(prev => ({...prev, [item.label]: newTitle}));
            }}
        />

        {/* المسمى في الطباعة يظهر كنص ثابت وجميل */}
        <p className="hidden print:block font-black text-[10px] underline underline-offset-8 mb-4">
            {approval?.title || customTitles[item.label as keyof typeof customTitles]}
        </p>

        {isApproved ? (
            <div className="relative group flex flex-col items-center">
                <Button variant="ghost" size="icon" className="no-print absolute -top-4 -right-8 text-red-500 opacity-0 group-hover:opacity-100 h-6 w-6" onClick={() => handleUnapprove(item.label)}>
                    <RotateCcw className="w-3 h-3" />
                </Button>
                <p className="font-black text-[11px] text-blue-900">{approval.rank} / {approval.name}</p>
                
                {/* 🟢 التوقيع بحجمه الصغير والمثالي في الطباعة */}
                <div className="h-14 mt-1 flex justify-center items-center overflow-hidden"> 
                    <img 
    // 🟢 تم وضع رابط مشروعك الحقيقي هنا
    src={`https://cynkoossuwenqxksbdhi.supabase.co/storage/v1/object/public/Signatures/${approval.mil_id}.png`}
    
    className="h-full w-auto object-contain mix-blend-multiply print:max-h-10"
    
    // معالجة ذكية: إذا لم يجد PNG يحاول JPG، وإذا فشل يخفي الصورة
    onError={(e) => {
        const target = e.target as HTMLImageElement;
        // تجنب الدخول في حلقة لا نهائية (Infinite Loop)
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
                <Button 
                    size="sm" variant="outline" 
                    className="border-[#c5b391] text-[#c5b391] hover:bg-[#c5b391]/10 font-bold text-[10px] h-7 px-4"
                    onClick={() => handleApprove(item.label, customTitles[item.label as keyof typeof customTitles])}
                >
                    اعتماد
                </Button>
            </div>
        )}
    </div>
);
    })}
</div>
                </div>
            
            </div>    
           {/* 🟢 نافذة الحذف المنبثقة المطورة */}
<Dialog open={deleteModalOpen} onOpenChange={(open) => {
    setDeleteModalOpen(open);
    if(!open) setConfirmDeleteId(null); // تصفير التأكيد عند الإغلاق
}}>
    <DialogContent className="max-w-md border-t-4 border-red-500 shadow-2xl" dir="rtl">
        <DialogHeader className="space-y-3">
            <DialogTitle className="flex items-center gap-2 text-red-600 font-black text-xl">
                <Trash2 className="w-6 h-6 animate-pulse" /> إدارة سجل المخالفات
            </DialogTitle>
            <DialogDescription className="bg-slate-50 p-3 rounded-lg border-r-4 border-blue-500 font-bold text-slate-700">
                الطالب: <span className="text-blue-700">{selectedStudentForDelete?.name}</span>
            </DialogDescription>
        </DialogHeader>

        <div className="py-4">
            {/* 🔴 واجهة التأكيد الجميلة (تظهر عند الرغبة في الحذف) */}
            {confirmDeleteId ? (
                <div className="bg-red-50 p-6 rounded-2xl border-2 border-red-200 text-center animate-in zoom-in-95 duration-300">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="w-10 h-10 text-red-600" />
                    </div>
                    <h3 className="font-black text-red-800 mb-2 text-lg">تأكيد الحذف النهائي</h3>
                    <p className="text-sm text-red-600 font-bold mb-6">
                        {confirmDeleteId === 'all' 
                            ? "هل أنت متأكد من مسح جميع مخالفات هذا الطالب؟ لا يمكن التراجع عن هذا الإجراء." 
                            : "سيتم حذف هذه المخالفة نهائياً من سجل المجند."}
                    </p>
                    <div className="flex gap-3">
                        <Button 
    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black"
    onClick={() => confirmDeleteId === 'all' ? executeDeleteAll() : executeSingleDelete(confirmDeleteId)}
    disabled={isDeleting} // ⬅️ تعطيل الزر أثناء المسح لمنع الضغط المتكرر
>
    {isDeleting ? (
        <>
            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            جاري الحذف...
        </>
    ) : (
        "نعم، احذف الآن"
    )}
</Button>
                        <Button 
                            variant="outline" 
                            className="flex-1 border-slate-300 font-bold"
                            onClick={() => setConfirmDeleteId(null)}
                        >
                            تراجع
                        </Button>
                    </div>
                </div>
            ) : (
                /* القائمة العادية للمخالفات */
                <div className="space-y-3">
                    <p className="text-[11px] font-black text-slate-500 flex items-center gap-1 mb-2">
                        <ListFilter className="w-3 h-3" /> اختر المخالفة المراد حذفها:
                    </p>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto p-1 custom-scrollbar">
                        {selectedStudentForDelete?.violationTickets.map((v: any) => (
                            <div key={v.id} className="flex items-center justify-between p-3 border-2 border-slate-100 rounded-xl hover:border-red-200 hover:bg-red-50/30 transition-all group">
                                <div className="flex-1">
                                    <div className="text-[12px] font-black text-slate-800 mb-1">{v.name}</div>
                                    <div className="flex flex-wrap gap-2 text-[9px] font-bold">
                                        <Badge variant="outline" className="bg-white text-purple-700 border-purple-100">
                                            المادة: {v.type || "عام"}
                                        </Badge>
                                        <Badge variant="outline" className="bg-white text-orange-700 border-orange-100">
                                            المحرر: {v.editor}
                                        </Badge>
                                    </div>
                                </div>
                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="text-red-400 hover:text-red-600 hover:bg-red-100 rounded-full h-8 w-8 transition-colors"
                                    onClick={() => setConfirmDeleteId(v.id)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* 🟢 الفوتر بترتيب عمودي لمنع الخروج عن الإطار */}
        {!confirmDeleteId && (
            <DialogFooter className="flex flex-col gap-2 sm:flex-col"> 
                {selectedStudentForDelete?.violationTickets.length > 1 && (
                    <Button 
                        variant="outline" 
                        className="w-full border-red-200 text-red-600 hover:bg-red-50 font-black h-11"
                        onClick={() => setConfirmDeleteId('all')}
                    >
                        <ShieldAlert className="w-4 h-4 ml-2" /> حذف كافة مخالفات الطالب
                    </Button>
                )}
                <Button 
                    variant="ghost" 
                    onClick={() => setDeleteModalOpen(false)} 
                    className="w-full font-bold h-10 text-slate-400"
                >
                    إغلاق
                </Button>
            </DialogFooter>
        )}
    </DialogContent>
</Dialog>
        </ProtectedRoute>
    );
}