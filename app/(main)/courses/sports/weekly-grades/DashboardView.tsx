"use client"

import { useState, useEffect } from "react"
import { safePrint } from "@/lib/safePrint"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
    Users, ChevronLeft, Clock, User, LayoutDashboard, ArrowRight, 
    Loader2, Eye, Dumbbell, Swords, FileText, Calculator, 
    Download, Printer, CheckCircle2 ,Trash2 // 👈 أضف هذه هنا
} from "lucide-react"
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
import { toast } from "sonner" // 👈 تأكد من أنك تستخدم مكتبة sonner كما في الملفات الأخرى
import { format, parseISO } from "date-fns"
import { ar } from "date-fns/locale"
import * as XLSX from 'xlsx'
import ProtectedRoute from "@/components/ProtectedRoute"
export default function DashboardView() {
    const [loading, setLoading] = useState(false)
    const [filterCourse, setFilterCourse] = useState("all")
    const [filterBatch, setFilterBatch] = useState("all") 
    const [filterCompany, setFilterCompany] = useState("all")
    const [subject, setSubject] = useState("لياقة بدنية")
    const [filterOptions, setFilterOptions] = useState<any>({ courses: [], batches: [], companies: [] })
    const [reportToDelete, setReportToDelete] = useState<number | null>(null);
    const [dashboardData, setDashboardData] = useState<any[]>([])
    const [viewMode, setViewMode] = useState<'cards' | 'details' | 'report-view' | 'final-grades'>('cards')
    const [filterPeriod, setFilterPeriod] = useState("all")
    const [selectedPlatoon, setSelectedPlatoon] = useState<any>(null)
    const [weeksList, setWeeksList] = useState<any[]>([])
    const [savedPlatoons, setSavedPlatoons] = useState<string[]>([]);
    const [selectedReport, setSelectedReport] = useState<any>(null)
    const [reportGrades, setReportGrades] = useState<any[]>([])
    
    const [finalMatrix, setFinalMatrix] = useState<{headers: any[], data: any[]} | null>(null)
    const [loadingDetails, setLoadingDetails] = useState(false)

   useEffect(() => {
        const fetchFilters = async () => {
            try {
                const params = new URLSearchParams()
                if (filterCourse !== 'all') params.append('course', filterCourse)
                if (filterBatch !== 'all') params.append('batch', filterBatch)
                if (filterCompany !== 'all') params.append('company', filterCompany)
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/filters-options?${params.toString()}`)
                
                if (res.ok) {
                    let data = await res.json();

                    // 🟢 [تطبيق قيود النطاق الذكية]
                    const user = JSON.parse(localStorage.getItem("user") || "{}");
                    const scope = user?.extra_permissions?.scope;

                    if (user.role !== 'owner' && scope?.is_restricted) {
                        const allowedCourses = scope.courses || [];
                        const allowedCompanies = scope.companies || [];

                        // 1. فلترة الدورات
                        data.courses = data.courses.filter((courseName: string) => {
                            return allowedCourses.some((ac: any) => ac.startsWith(courseName));
                        });

                        // 2. فلترة السرايا بناءً على الدورة والدفعة المختارة
                        if (filterCourse !== "all" && filterBatch !== "all") {
                            const currentKeyPrefix = `${filterCourse}||${filterBatch}->`;
                            data.companies = data.companies.filter((companyName: string) => {
                                return allowedCompanies.includes(`${currentKeyPrefix}${companyName}`);
                            });
                        } else {
                            data.companies = [];
                        }
                    }
                    setFilterOptions(data)
                }
            } catch (e) { console.error("Filter error") }
        }
        fetchFilters()
    }, [filterCourse, filterBatch, filterCompany])

   // ابحث عن دالة fetchDashboardStats وعدلها لتصبح هكذا:
const fetchDashboardStats = async () => {
    if (filterCourse === "all") return; 

    setLoading(true);
    try {
        const params = new URLSearchParams();
        if (filterCourse !== 'all') params.append('course', filterCourse);
        if (filterBatch !== 'all') params.append('batch', filterBatch);
        if (filterCompany !== 'all') params.append('company', filterCompany);
        // إضافة دعم الفلاتر الخاصة بالدبلوم
        if (filterCourse === "طلبة الدبلوم" && filterPeriod !== "all") params.append('period', filterPeriod);
        params.append('subject', subject);

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/stats?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (res.ok) {
            let data = await res.json();

            const user = JSON.parse(localStorage.getItem("user") || "{}");
            const scope = user?.extra_permissions?.scope;

            // نظام التحقق الذكي من النطاق (Scope Enforcement)
            if (user.role !== 'owner' && scope?.is_restricted) {
                const allowedPlatoons = scope?.platoons || [];
                const allowedCourses = scope?.courses || [];

                data = data.filter((item: any) => {
                    const currentCourseName = filterCourse;
                    // تنظيف وتوحيد مسميات البيانات القادمة من السيرفر
                    const iBatch = (item.batch === "all" || item.batch === "None" || !item.batch) ? "" : item.batch;
                    const iPlatoon = (item.platoon === "عام" || item.platoon === "None" || !item.platoon) ? "" : item.platoon;

                    // 1. فحص الدورات العامة (التي تظهر كـ "عام" أو بلا فصيل)
                    if (iPlatoon === "") {
                        return allowedCourses.includes(currentCourseName);
                    }

                    // 2. فحص الفصائل (دعم كافة أنماط تخزين مفاتيح الصلاحية)
                    return allowedPlatoons.some((pKey: string) => {
                        const pattern1 = `${currentCourseName}||${iBatch}->${item.platoon}`;
                        const pattern2 = `${currentCourseName}->${item.platoon}`;
                        const pattern3 = `${currentCourseName}||->${item.platoon}`;

                        return pKey === pattern1 || pKey === pattern2 || pKey === pattern3;
                    });
                });
            }

            setDashboardData(data);
        } else {
            setDashboardData([]);
        }
    } catch (e) { 
        setDashboardData([]); 
    } finally { 
        setLoading(false); 
    }
}

// ✅ نسخة واحدة منظفة ومدمجة تشمل كل الفلاتر
useEffect(() => {
    if (filterCourse !== "all") {
        fetchDashboardStats();
    } else {
        setDashboardData([]);
    }
    // أضف filterPeriod هنا لضمان تحديث البطاقات عند تغيير الفصل الدراسي
}, [filterCourse, filterBatch, filterCompany, subject, filterPeriod])

    const fetchWeeksList = async (platoonName: string) => {
    setLoadingDetails(true);
    try {
        const params = new URLSearchParams();
        
        // 💡 إرسال الفلاتر فقط إذا لم تكن قيمتها "all"
        if (filterCourse && filterCourse !== 'all') params.append('course', filterCourse);
        if (filterBatch && filterBatch !== 'all') params.append('batch', filterBatch); // أضفنا الدفعة
        if (filterCompany && filterCompany !== 'all') params.append('company', filterCompany);
        
        // إرسال الفصيل المختار حالياً
        if (platoonName && platoonName !== 'all') params.append('platoon', platoonName);
        
        params.append('subject', subject);

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/weekly-reports/list?${params.toString()}`, {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
});
        if (res.ok) setWeeksList(await res.json());
        else setWeeksList([]);
    } catch (e) { 
        console.error(e); 
        setWeeksList([]); 
    } finally { 
        setLoadingDetails(false); 
    }
}
const handleDeleteSavedGrades = async () => {
    if (!confirm("هل أنت متأكد من حذف الدرجات المعتمدة؟ سيتم مسح الدرجة النهائية من سجلات الطلاب.")) return;
    
    setLoadingDetails(true);
    try {
        const params = new URLSearchParams({
            course: filterCourse,
            batch: filterBatch,
            subject: subject,
            platoon: selectedPlatoon.platoon
        });

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/delete-final-grades?${params.toString()}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });

        if (res.ok) {
            toast.success("تم حذف الاعتماد بنجاح، يمكنك إعادة الحساب الآن");
            handleBackToCards(); // العودة لتحديث الحالة
            fetchDashboardStats();
        }
    } catch (e) { toast.error("خطأ في الحذف"); }
    finally { setLoadingDetails(false); }
};
  const handleCalculateFinal = async () => {
    if (!selectedPlatoon) return;
    setLoadingDetails(true);
    try {
        const cleanBatch = filterBatch === "all" ? "" : filterBatch;
        const cleanCompany = filterCompany === "all" ? "" : filterCompany;
        const cleanPlatoon = selectedPlatoon.platoon === "عام" ? "" : selectedPlatoon.platoon;
        const cleanPeriod = filterPeriod === "all" ? "" : filterPeriod;

        const params = new URLSearchParams();
        params.append('course', filterCourse);
        params.append('batch', cleanBatch);
        params.append('company', cleanCompany);
        params.append('platoon', cleanPlatoon);
        params.append('subject', subject);
        params.append('period', cleanPeriod);

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/final-grades?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
            setFinalMatrix(await res.json());
            setViewMode('final-grades');
        }
    } catch (e) { console.error(e); }
    finally { setLoadingDetails(false); }
}

    // --- 1. التعديل الأول: تصدير الإكسل بالمسار الكامل ---
    const handleExportFinalExcel = () => {
        if (!finalMatrix || !selectedPlatoon) return;
        const exportData = finalMatrix.data.map((row, idx) => {
            const excelRow: any = {
                "م": idx + 1,
                "الرقم العسكري": row.military_id,
                "الاسم": row.name,
            };
            finalMatrix.headers.forEach((h, i) => { excelRow[`الأسبوع ${i + 1}`] = row.weeks[h.id]; });
            // تغيير اسم العمود في الإكسل
            excelRow["درجة المدرب"] = row.final_average; 
            return excelRow;
        });
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "الدرجات النهائية");
        
        // بناء اسم الملف: الدفعة_السرية_الفصيل_المادة
        const fileName = `درجة_المدرب_${filterBatch}_${filterCompany}_${selectedPlatoon.platoon}_${subject}.xlsx`;
        XLSX.writeFile(wb, fileName);
    }
const [isViewOnlyFinal, setIsViewOnlyFinal] = useState(false);

const handleViewFinalSavedRecord = async () => {
    setLoadingDetails(true);
    try {
        // 🟢 تنظيف المسميات لضمان مطابقة الباك إند (تحويل الكل وعام إلى نصوص فارغة)
        const cleanBatch = filterBatch === "all" ? "" : filterBatch;
        const cleanPlatoon = selectedPlatoon.platoon === "عام" ? "" : selectedPlatoon.platoon;
        const cleanPeriod = filterPeriod === "all" ? "" : filterPeriod;

        const params = new URLSearchParams({
            course: filterCourse,
            batch: cleanBatch,
            subject: subject,
            platoon: cleanPlatoon,
            period: cleanPeriod
        });

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/final-saved-only?${params.toString()}`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        
        if (res.ok) {
            const result = await res.json();
            setReportGrades(result.data);
            setSelectedReport({ 
                title: "الدرجة النهائية المعتمدة", 
                last_update: result.last_update 
            });
            setIsViewOnlyFinal(true);
            setViewMode('report-view');
        }
    } catch (e) { toast.error("خطأ في جلب البيانات"); }
    finally { setLoadingDetails(false); }
};
    // --- 2. التعديل الثاني: دالة الطباعة الخاصة ---
    const handlePrintFinal = () => {
        // حفظ العنوان الأصلي للصفحة
        const originalTitle = document.title;
        // تغيير العنوان ليكون اسم الملف عند الحفظ PDF
        document.title = `درجة_المدرب_${filterBatch}_${filterCompany}_${selectedPlatoon.platoon}_${subject}`;
        safePrint();
        // إعادة العنوان الأصلي بعد الطباعة (مهلة قصيرة)
        setTimeout(() => { document.title = originalTitle; }, 1000);
    }

   const handleViewReportGrades = async (reportId: number) => {
    // 1. جلب التوكن من الذاكرة المحلية (Local Storage)
    const token = localStorage.getItem("token");
    if (!token) {
        // يمكنك توجيه المستخدم لصفحة الدخول هنا إذا لزم الأمر
        console.error("Authentication token not found.");
        return; 
    }

    setLoadingDetails(true);
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/weekly-reports/${reportId}/details`, {
            // 2. إضافة التوكن إلى Headers
            headers: {
                "Authorization": `Bearer ${token}`, 
                "Content-Type": "application/json",
            },
        }); // <--- تم تعديل هذا السطر

        if (res.ok) {
            const data = await res.json();
            setSelectedReport(data.report_info);
            setReportGrades(data.grades);
            setViewMode('report-view');
        } else {
            // 3. معالجة الأخطاء غير 404 (مثل 401 Unauthorized)
            const errorData = await res.json();
            console.error("API Error:", errorData.detail || res.statusText);
        }
    } catch (e) { 
        // 4. معالجة أخطاء الشبكة/الـ TypeError
        console.error("Network or Fetch Error:", e); 
    }
    finally { setLoadingDetails(false); }
}
// داخل DashboardView.tsx
const handleSaveFinalGrades = async () => {
    if (!finalMatrix || !selectedPlatoon) return;
    
    setLoadingDetails(true);
    try {
        const payload = {
            course: filterCourse,
            batch: filterBatch,
            subject: subject,
            period: filterCourse === "طلبة الدبلوم" ? filterPeriod : null,
            grades: finalMatrix.data.map(row => ({
                // 🟢 الآن سنستخدم row.id الذي أضفناه في الباك إند
                soldier_id: row.id, 
                trainer_avg_grade: row.final_average
            }))
        };

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/save-final-grades`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            toast.success("تم اعتماد وحفظ الدرجات بنجاح ✅");
        } else {
            const errData = await res.json();
            console.log("Validation Error:", errData);
            toast.error("فشل في حفظ الدرجات، تأكد من البيانات");
        }
    } catch (e) {
        toast.error("خطأ في الاتصال");
    } finally {
        setLoadingDetails(false);
    }
};
const executeDeleteReport = async () => {
    if (!reportToDelete) return;
    
    const toastId = toast.loading("جاري حذف الأسبوع والدرجات...");
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/weekly-reports/${reportToDelete}`, {
            method: "DELETE",
            headers: { 
                "Authorization": `Bearer ${localStorage.getItem("token")}` 
            }
        });

        if (res.ok) {
            toast.success("تم الحذف بنجاح ✅", { id: toastId });
            // تحديث القائمة فوراً في الواجهة لحذف السطر
            setWeeksList(prev => prev.filter(w => w.id !== reportToDelete));
            setReportToDelete(null);
        } else {
            const err = await res.json();
            toast.error(err.detail || "فشل الحذف", { id: toastId });
        }
    } catch (e) {
        toast.error("خطأ في الاتصال بالسيرفر", { id: toastId });
    }
};
    const handleViewDetails = (platoonItem: any) => { setSelectedPlatoon(platoonItem); setViewMode('details'); fetchWeeksList(platoonItem.platoon); }
    const handleBackToCards = () => { setViewMode('cards'); setSelectedPlatoon(null); setWeeksList([]); }
    const handleBackToWeeks = () => { setViewMode('details'); setSelectedReport(null); setReportGrades([]); setFinalMatrix(null); }

    const formatDateSafe = (dateString: string) => {
        if (!dateString || dateString === "-") return "-";
        try { return format(parseISO(dateString), "yyyy-MM-dd"); } catch (e) { return dateString; }
    };

    return (
        <ProtectedRoute allowedRoles={["owner","manager","admin","assistant_admin","sports_officer","sports_supervisor"]}>
        <div className="space-y-4 md:space-y-6 pb-20 md:pb-32 animate-in fade-in slide-in-from-bottom-4" dir="rtl">
            
            {viewMode === 'cards' && (
                <>
                    <div className="bg-slate-50 p-3 md:p-4 rounded-xl border shadow-sm space-y-3">
    <div className="flex items-center gap-2 text-slate-600 font-bold text-sm">
        <LayoutDashboard className="w-4 h-4 text-blue-600"/>
        <span>تخصيص عرض النتائج:</span>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* الدورة */}
        <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 mr-1">الدورة</label>
            <Select value={filterCourse} onValueChange={(v) => { setFilterCourse(v); setFilterBatch("all"); setFilterPeriod("all"); }}>
                <SelectTrigger className="bg-white h-10 text-xs shadow-sm border-slate-200">
                    <SelectValue placeholder="اختر الدورة" />
                </SelectTrigger>
                <SelectContent>
                    {filterOptions.courses?.map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>

        {/* الدفعة */}
        <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 mr-1">الدفعة</label>
            <Select value={filterBatch} onValueChange={(v) => { setFilterBatch(v); setFilterCompany("all"); }} disabled={filterCourse === "all"}>
                <SelectTrigger className="bg-white h-10 text-xs shadow-sm">
                    <SelectValue placeholder="الدفعة" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {filterOptions.batches?.map((b: any) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>

        {/* السرية */}
        <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 mr-1">السرية </label>
            <Select value={filterCompany} onValueChange={setFilterCompany} disabled={filterBatch === "all" && filterCourse !== "دورة صاعقة"}>
                <SelectTrigger className="bg-white h-10 text-xs shadow-sm">
                    <SelectValue placeholder="السرية" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {filterOptions.companies?.map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>

        {/* المادة */}
        <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 mr-1">المادة الدراسية</label>
            <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className={`h-10 text-xs font-bold border-2 shadow-sm ${subject === 'لياقة بدنية' ? 'border-blue-100 text-blue-700' : 'border-red-100 text-red-700'}`}>
                    <div className="flex items-center gap-2">
                        {subject === 'لياقة بدنية' ? <Dumbbell className="w-3.5 h-3.5" /> : <Swords className="w-3.5 h-3.5" />}
                        <SelectValue />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="لياقة بدنية">لياقة بدنية</SelectItem>
                    <SelectItem value="اشتباك">اشتباك</SelectItem>
                </SelectContent>
            </Select>
        </div>

        {/* الفترة (تظهر فقط للدبلوم) */}
        {filterCourse === "طلبة الدبلوم" && (
            <div className="space-y-1 animate-in zoom-in-95">
                <label className="text-[10px] font-bold text-blue-500 mr-1">الفترة / الفصل</label>
                <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                    <SelectTrigger className="bg-blue-50 border-blue-200 h-10 text-xs font-bold text-blue-700 shadow-sm">
                        <SelectValue placeholder="اختر الفترة" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">كل الفترات</SelectItem>
                        <SelectItem value="الفترة التأسيسية">الفترة التأسيسية</SelectItem>
                        <SelectItem value="الفصل الأول">الفصل الأول</SelectItem>
                        <SelectItem value="الفصل الثاني">الفصل الثاني</SelectItem>
                        <SelectItem value="الفصل الثالث">الفصل الثالث</SelectItem>
                        <SelectItem value="الفصل الرابع">الفصل الرابع</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        )}
    </div>
</div>

                    <div className="min-h-[300px]">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-400"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div><p>جاري التحميل...</p></div>
                        ) : dashboardData.length > 0 ? (
                            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
                                {dashboardData.map((item, idx) => (
                                    <Card key={idx} className="hover:shadow-md transition-all cursor-pointer group border-t-4 border-t-transparent hover:border-t-blue-500 overflow-hidden">
                                        <CardHeader className="flex flex-row items-start justify-between p-3 md:p-6 pb-2 md:pb-2 space-y-0">
                                            <div className="flex items-center gap-2 md:gap-3">
                                                <div className="bg-slate-100 p-1.5 md:p-2 rounded-lg group-hover:bg-blue-50 transition-colors"><Users className="w-4 h-4 md:w-5 md:h-5 text-slate-600 group-hover:text-blue-600" /></div>
                                                <div><CardTitle className="text-sm md:text-base font-bold"> {item.platoon}</CardTitle></div>
                                            </div>
                                           <div className="flex flex-col items-end gap-1">
    {item.status === 'completed' && <Badge className="bg-green-100 text-green-700">نشط</Badge>}
    {/* 🟢 إضافة هذه العلامة */}
    {item.is_final_saved && (
        <Badge className="bg-blue-600 text-white animate-pulse text-[9px]">تم حفظ الدرجة النهائية</Badge>
    )}
</div>
                                        </CardHeader>
                                        <CardContent className="p-3 md:p-6 pt-0 md:pt-0 space-y-2 md:space-y-3">
                                            <div><div className="flex justify-between mb-1 font-semibold text-[10px] md:text-xs"><span className="text-slate-500">الإنجاز ({subject})</span><span className="text-blue-600">{item.weeksCount} أسابيع</span></div><Progress value={(item.weeksCount / 16) * 100} className="h-1.5" /></div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-2 bg-slate-50 p-2 rounded border">
                                                <div><span className="text-[9px] md:text-[10px] text-slate-400 block">المدرب</span><div className="font-bold text-[10px] md:text-xs truncate flex items-center gap-1"><User className="w-3 h-3 text-slate-400"/> {item.trainer}</div></div>
                                                <div><span className="text-[9px] md:text-[10px] text-slate-400 block">التحديث</span><div className="font-bold text-[10px] md:text-xs truncate flex items-center gap-1"><Clock className="w-3 h-3 text-slate-400"/> {formatDateSafe(item.lastUpdate)}</div></div>
                                            </div>
                                        </CardContent>
                                        <CardFooter className="p-2 md:p-4 pt-0 md:pt-0"><Button size="sm" variant="ghost" className="w-full text-[10px] md:text-xs h-8 hover:bg-slate-100" onClick={() => handleViewDetails(item)}>عرض التفاصيل <ChevronLeft className="w-3 h-3 mr-1" /></Button></CardFooter>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-xl bg-slate-50 text-slate-400"><LayoutDashboard className="w-10 h-10 text-slate-300 mb-2" /><p className="text-sm">الرجاء اختيار (الدورة، الدفعة، السرية) لعرض البطاقات</p></div>
                        )}
                    </div>
                </>
            )}

            {viewMode === 'details' && selectedPlatoon && (
                <div className="space-y-4 animate-in slide-in-from-left-4">
                    <div className="flex items-center justify-between border-b pb-4">
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={handleBackToCards}><ArrowRight className="w-4 h-4 ml-1"/> رجوع</Button>
                            <div><h2 className="text-xl font-bold flex items-center gap-2"> {selectedPlatoon.platoon} <Badge variant="outline" className="text-xs font-normal">{subject}</Badge></h2><p className="text-xs text-slate-500">سجل الأسابيع التفصيلي</p></div>
                        </div>
                        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
    {weeksList.length > 0 && (
        <>
            {/* زر حساب درجة المدرب */}
            <Button 
                onClick={handleCalculateFinal} 
                className="bg-purple-700 hover:bg-purple-800 text-white gap-2 h-10 text-xs md:text-sm font-bold shadow-md w-full md:w-auto order-2 md:order-1"
            >
                <Calculator className="w-4 h-4"/> 
                درجة المدرب
            </Button>
            
            {/* زر حذف الاعتماد الحالي - يظهر فقط إذا كانت الدرجات محفوظة */}
            {selectedPlatoon?.is_final_saved && (
                <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={handleDeleteSavedGrades}
                    className="gap-2 h-10 text-xs md:text-sm font-bold shadow-md w-full md:w-auto order-1 md:order-2"
                >
                    <Trash2 className="w-4 h-4"/> 
                    حذف الاعتماد الحالي
                </Button>
            )}
        </>
    )}
</div>
                        
                    </div>

                    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                        {loadingDetails ? (
                            <div className="flex justify-center items-center h-40"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
                        ) : weeksList.length > 0 ? (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-slate-100">
                                        <TableRow>
                                            <TableHead className="w-[50px] text-center font-bold text-black">#</TableHead>
                                            <TableHead className="text-right font-bold text-black">عنوان الأسبوع</TableHead>
                                            <TableHead className="text-center font-bold text-black">الفترة</TableHead>
                                            <TableHead className="text-center font-bold text-black">المدرب المسؤول</TableHead>
                                            <TableHead className="text-center font-bold text-black">آخر تحديث</TableHead>
                                            <TableHead className="text-center font-bold text-black">الإجراء</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
    {/* 1. الأسابيع العادية تظل هنا */}
    {/* 1. الأسابيع العادية */}
{weeksList.map((week) => (
    <TableRow key={week.id} className="hover:bg-slate-50">
        <TableCell className="text-center font-mono font-bold bg-slate-50">{week.week_number}</TableCell>
        <TableCell className="font-bold text-blue-700">{week.title}</TableCell>
        
        {/* 🟢 الآن سيعرض الفترة الحقيقية القادمة من السيرفر */}
        <TableCell className="text-center text-slate-600 font-medium">
            {week.period || "عام"} 
        </TableCell>
        
        {/* 🟢 الآن سيعرض اسم الشخص الذي حفظ (سواء مدرب أو مساعد) */}
        <TableCell className="text-center font-bold text-slate-700">
            {week.trainer_name}
        </TableCell>
        
        <TableCell className="text-center text-xs text-slate-500">
            {formatDateSafe(week.last_update)}
        </TableCell>
        <TableCell className="text-center">
    <div className="flex items-center justify-center gap-2">
        {/* زر العرض الموجود مسبقاً */}
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleViewReportGrades(week.id)}>
            عرض الدرجات
        </Button>

        {/* 🔴 زر الحذف الجديد (يظهر فقط للأدوار المخولة) */}
        <Button 
            size="icon" 
            variant="ghost" 
            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
            onClick={(e) => {
                e.stopPropagation(); // لمنع تداخل الضغطات
                setReportToDelete(week.id);
            }}
        >
            <Trash2 className="w-4 h-4" />
        </Button>
    </div>
</TableCell>
    </TableRow>
))}

    {/* 2. 🟢 السطر الإضافي: ضعه هنا (خارج حلقة map) ليكون سطراً مستقلاً في الأسفل */}
    {selectedPlatoon?.is_final_saved && (
        <TableRow className="bg-green-50/80 border-t-2 border-green-200 hover:bg-green-100/50">
            <TableCell className="text-center font-bold text-green-700 font-mono">FIN</TableCell>
            <TableCell className="font-black text-green-800">الدرجة النهائية المعتمدة (الرسمية)</TableCell>
            <TableCell className="text-center text-slate-400">---</TableCell>
            <TableCell className="text-center text-slate-400">---</TableCell>
            <TableCell className="text-center text-[10px] font-bold text-green-600">سجل معتمد حالياً</TableCell>
            <TableCell className="text-center">
                <Button 
                    size="sm" 
                    className="bg-green-600 hover:bg-green-700 h-7 text-xs gap-1 shadow-sm" 
                    onClick={handleViewFinalSavedRecord}
                >
                    <CheckCircle2 className="w-3 h-3" /> عرض النتيجة
                </Button>
            </TableCell>
        </TableRow>
    )}
</TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-40 text-slate-400"><Clock className="w-10 h-10 mb-2 opacity-20" /><p>لا توجد أسابيع مسجلة لمادة <span className="font-bold text-slate-600">{subject}</span> بعد.</p></div>
                        )}
                    </div>
                </div>
            )}

           {viewMode === 'report-view' && selectedReport && (
    <div className="space-y-4 animate-in slide-in-from-left-4">
        <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => { handleBackToWeeks(); setIsViewOnlyFinal(false); }}>
                    <ArrowRight className="w-4 h-4 ml-1"/> العودة للقائمة
                </Button>
                <div>
                    <h2 className="text-xl font-bold text-blue-800 flex items-center gap-2">
                        <FileText className="w-5 h-5"/>
                        {selectedReport.title}
                    </h2>
                    {!isViewOnlyFinal && (
                        <p className="text-xs text-slate-500">
                            {selectedReport.start_date} - {selectedReport.end_date} | {selectedReport.subject}
                        </p>
                    )}
                </div>
            </div>
        </div>

        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <Table className="text-right">
                    <TableHeader className={isViewOnlyFinal ? "bg-green-900 text-white" : "bg-slate-900 text-white"}>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="text-white text-center w-[50px]">#</TableHead>
                            <TableHead className="text-white text-center w-[120px]">الرقم العسكري</TableHead>
                            <TableHead className="text-white w-[200px] text-right">الاسم</TableHead>
                            
                            {/* 🟢 إظهار هذه الأعمدة فقط إذا لم تكن "نتيجة نهائية" */}
                            {!isViewOnlyFinal && (
                                <>
                                    <TableHead className="text-white text-center">السلوك</TableHead>
                                    <TableHead className="text-white text-center">الجهد</TableHead>
                                    <TableHead className="text-white text-center">الاستيعاب</TableHead>
                                </>
                            )}

                            <TableHead className={`text-white text-center font-bold ${isViewOnlyFinal ? "bg-green-800" : "bg-blue-900"}`}>
                                {isViewOnlyFinal ? "الدرجة المعتمدة نهائياً" : "المجموع"}
                            </TableHead>

                            {!isViewOnlyFinal && <TableHead className="text-white text-center w-[200px]">الملاحظات</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reportGrades.map((grade, idx) => (
                            <TableRow key={idx} className="hover:bg-slate-50">
                                <TableCell className="text-center font-mono text-slate-500">{idx + 1}</TableCell>
                                <TableCell className="text-center font-bold">{grade.military_id}</TableCell>
                                <TableCell className="font-medium">{grade.name}</TableCell>
                                
                                {/* 🟢 إظهار القيم فقط إذا لم تكن "نتيجة نهائية" */}
                                {!isViewOnlyFinal && (
                                    <>
                                        <TableCell className="text-center">{grade.b}</TableCell>
                                        <TableCell className="text-center">{grade.e}</TableCell>
                                        <TableCell className="text-center">{grade.c}</TableCell>
                                    </>
                                )}

                                <TableCell className={`text-center font-black text-lg ${isViewOnlyFinal ? "text-green-700 bg-green-50" : "text-blue-700 bg-blue-50"}`}>
                                    {isViewOnlyFinal 
                                        ? (grade.final_grade?.toFixed(2) || "--") 
                                        : (grade.total?.toFixed(2) || "--")
                                    }
                                </TableCell>

                                {!isViewOnlyFinal && <TableCell className="text-center text-xs text-slate-500 max-w-[200px] truncate">{grade.notes || "-"}</TableCell>}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    </div>
)}

            {viewMode === 'final-grades' && finalMatrix && (
                <div className="space-y-4 animate-in slide-in-from-left-4">
                    
                    {/* Header */}
                    {/* 👇👇 التعديل هنا: أضفنا print:hidden لإخفاء الأزرار والعنوان عند الطباعة 👇👇 */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 gap-4 print:hidden">
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={handleBackToWeeks}>
                                <ArrowRight className="w-4 h-4 ml-1"/> العودة للقائمة
                            </Button>
                            <div>
                                <h2 className="text-xl font-bold text-purple-800 flex items-center gap-2">
                                    <Calculator className="w-5 h-5"/> النتائج النهائية
                                </h2>
                                <p className="text-xs text-slate-500">متوسط درجات {finalMatrix.headers.length} أسابيع</p>
                            </div>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
    {/* 🟢 الزر الجديد */}
    <Button 
        onClick={handleSaveFinalGrades} 
        disabled={loadingDetails}
        className="bg-green-600 hover:bg-green-700 text-white gap-2 flex-1 md:flex-none shadow-md animate-in zoom-in-95"
    >
        {loadingDetails ? <Loader2 className="animate-spin w-4 h-4"/> : <CheckCircle2 className="w-4 h-4"/>}
        اعتماد وحفظ الدرجات
    </Button>
    
    <Button variant="outline" onClick={handlePrintFinal}> <Printer className="w-4 h-4 ml-1"/> طباعة </Button>
    <Button variant="outline" onClick={handleExportFinalExcel}> <Download className="w-4 h-4 ml-1"/> Excel </Button>
</div>
                    </div>

                    {/* --- 4. جدول الطباعة الخاص (The Printable Matrix) --- */}
                    <div className="hidden print:block mb-8">
                        <div className="text-center mb-6">
                            <div className="flex justify-between items-center w-full mb-4">
                                <div className="w-32 h-32"><img src="/logo.jpg" alt="Logo" className="w-full h-full object-contain" /></div>
                                <div className="text-center flex-1">
                                    <h2 className="text-xl font-bold">معهدالشرطة - فرع التدريب الرياضي</h2>
                                    <h1 className="text-2xl font-bold underline mt-2 mb-1">كشف درجات المدرب ({subject})</h1>
                                    <h3 className="text-lg font-semibold">{filterCourse} / {filterBatch}</h3>
                                    <h3 className="text-md font-bold">{filterCompany} /  {selectedPlatoon?.platoon}</h3>
                                </div>
                                
                               {/* 3. التاريخ واليوم (يسار) - 👈 تعديل الترتيب للعربية */}
                                <div className="w-auto flex flex-col items-end gap-1 pl-2">
                                    {/* سطر اليوم */}
                                    <div className="flex items-center gap-2">
                                        {/* 1. العنوان أولاً (ليظهر يمين) */}
                                        <span className="text-[10px] font-bold text-slate-500 border-b border-slate-300">:اليوم</span>
                                        {/* 2. القيمة ثانياً (لتظهر يسار) */}
                                        <span className="font-bold text-black text-sm">
                                            {format(new Date(), "EEEE", { locale: ar })}
                                        </span>
                                    </div>

                                    {/* سطر التاريخ */}
                                    <div className="flex items-center gap-2">
                                        {/* 1. العنوان أولاً */}
                                        <span className="text-[10px] font-bold text-slate-500 border-b border-slate-300">:التاريخ</span>
                                        {/* 2. القيمة ثانياً */}
                                        <span className="font-bold font-mono text-black text-sm">
                                            {format(new Date(), "yyyy-MM-dd")}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <table className="w-full border-collapse text-sm text-center">
                            <thead>
                                <tr>
                                    <th style={{border: '1px solid black', padding: '4px', width: '30px', backgroundColor: '#e5e7eb'}}>#</th>
                                    <th style={{border: '1px solid black', padding: '4px', width: '100px', backgroundColor: '#e5e7eb'}}>الرقم العسكري</th>
                                    <th style={{border: '1px solid black', padding: '4px', textAlign: 'right', paddingRight: '10px', backgroundColor: '#e5e7eb'}}>الاسم</th>
                                    {finalMatrix.headers.map((h, i) => (
                                        <th key={h.id} style={{border: '1px solid black', padding: '4px', fontSize: '10px', backgroundColor: '#e5e7eb'}}>
                                            الأسبوع {i + 1}
                                        </th>
                                    ))}
                                    <th style={{border: '1px solid black', padding: '4px', backgroundColor: '#d1d5db', fontWeight: 'bold'}}>درجة المدرب</th>
                                </tr>
                            </thead>
                            <tbody>
                                {finalMatrix.data.map((row, idx) => (
                                    <tr key={idx}>
                                        <td style={{border: '1px solid black', padding: '4px'}}>{idx + 1}</td>
                                        <td style={{border: '1px solid black', padding: '4px'}}>{row.military_id}</td>
                                        <td style={{border: '1px solid black', padding: '4px', textAlign: 'right', paddingRight: '10px'}}>{row.name}</td>
                                        {finalMatrix.headers.map(h => (
                                            <td key={h.id} style={{border: '1px solid black', padding: '4px'}}>
                                                {row.weeks[h.id] ? row.weeks[h.id].toFixed(2) : "-"}
                                            </td>
                                        ))}
                                        <td style={{border: '1px solid black', padding: '4px', fontWeight: 'bold', backgroundColor: '#f3f4f6'}}>
                                            {row.final_average}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Screen Table */}
                    <div className="bg-white rounded-lg border shadow-sm overflow-hidden print:hidden">
                        <div className="overflow-x-auto">
                            <Table className="text-right">
                                <TableHeader className="bg-purple-900 text-white">
                                    <TableRow className="hover:bg-purple-900">
                                        <TableHead className="text-white text-center w-[50px]">#</TableHead>
                                        <TableHead className="text-white text-center w-[120px]">الرقم العسكري</TableHead>
                                        <TableHead className="text-white w-[200px] text-right">الاسم</TableHead>
                                        {finalMatrix.headers.map((h, i) => (
                                            <TableHead key={h.id} className="text-white text-center">أسبوع {i + 1}</TableHead>
                                        ))}
                                        <TableHead className="text-white text-center bg-purple-950 font-bold">درجة المدرب</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {finalMatrix.data.map((row, idx) => (
                                        <TableRow key={idx} className="hover:bg-slate-50">
                                            <TableCell className="text-center font-mono text-slate-500">{idx + 1}</TableCell>
                                            <TableCell className="text-center font-bold">{row.military_id}</TableCell>
                                            <TableCell className="font-medium">{row.name}</TableCell>
                                            {finalMatrix.headers.map(h => (
                                                <TableCell key={h.id} className="text-center text-slate-600">{row.weeks[h.id] ? row.weeks[h.id].toFixed(2) : "-"}</TableCell>
                                            ))}
                                            <TableCell className="text-center font-bold text-purple-700 bg-purple-50">{row.final_average}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            )}
            {/* نافذة تأكيد الحذف */}
<AlertDialog open={reportToDelete !== null} onOpenChange={() => setReportToDelete(null)}>
    <AlertDialogContent dir="rtl" className="max-w-[400px] rounded-2xl border-none shadow-2xl bg-white">
        <AlertDialogHeader className="text-right">
            <div className="bg-red-50 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <AlertDialogTitle className="text-xl font-black text-slate-800">
                حذف سجل الأسبوع نهائياً؟
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 font-bold leading-relaxed pt-2">
                هل أنت متأكد من حذف هذا الأسبوع؟ 
                <br />
                <span className="text-red-500 text-xs mt-2 block">
                    ⚠️ سيتم مسح كافة درجات الطلاب المرتبطة بهذا الأسبوع من قاعدة البيانات ولا يمكن التراجع!
                </span>
            </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row-reverse gap-3 mt-6">
            <AlertDialogAction 
                onClick={executeDeleteReport}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold h-11 rounded-xl"
            >
                نعم، احذف الكل
            </AlertDialogAction>
            <AlertDialogCancel className="flex-1 h-11 rounded-xl border-slate-200 text-slate-500 font-medium mt-0">
                تراجع
            </AlertDialogCancel>
        </AlertDialogFooter>
    </AlertDialogContent>
</AlertDialog>
        </div>
        </ProtectedRoute>
    )
}