"use client"

import DashboardView from "./DashboardView"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Save, Printer, Trash2, Loader2, Calendar, Download, Edit, AlertCircle, Search, ChevronLeft, ChevronRight, CheckSquare } from "lucide-react"
import { toast } from "sonner"
import { format, eachDayOfInterval, parseISO, isSameDay, isValid } from "date-fns"
import { ar } from "date-fns/locale"
import * as XLSX from 'xlsx'
import ProtectedRoute from "@/components/ProtectedRoute"
// --- القواعد ---
const VIOLATION_RULES: Record<string, { b: number, e: number, c: number }> = {
    'إعفاء': { b: 0, e: 2, c: 2 },
    'غياب': { b: 2, e: 2, c: 2 },
    'عيادة': { b: 0, e: 2, c: 2 },
    'طبية': { b: 1.5, e: 2, c: 2 },
    'تأخير عن التكميل': { b: 1, e: 0, c: 0 },
    'تأخير عن الحصة': { b: 1, e: 1, c: 1 },
    'قيافة و هندام': { b: 2, e: 0, c: 0 },
    'مخالفة اللبس': { b: 2, e: 0, c: 0 },
    'إجازة': { b: 2, e: 2, c: 2 },
    'تمرد': { b: 1, e: 2, c: 2 },
    'عصيان أوامر': { b: 1, e: 2, c: 2 },
    'مجادلة أو تعطيل سير الحصة': { b: 1, e: 1, c: 1 },
    'الهروب من الحصة': { b: 1, e: 2, c: 2 },
    'عدم إكمال الحصة': { b: 0, e: 1, c: 1 },
    'ضحك': { b: 1, e: 1, c: 1 },
    'تمارض': { b: 1, e: 1, c: 1 },
    'تكاسل': { b: 1, e: 1, c: 1 },
    'إجازة وفاة': { b: 1.5, e: 2, c: 2 },
    'إجازة إدارية': { b: 1.5, e: 2, c: 2 }
};

const DRAFT_KEY = "weekly_grades_draft";

export default function WeeklyGradesPage() {
    // --- State ---
    const [soldiers, setSoldiers] = useState<any[]>([])
    const [attendanceData, setAttendanceData] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [activeTab, setActiveTab] = useState("entry")
    const [existingReportId, setExistingReportId] = useState<number | null>(null)

    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(20)

    const [weekTitle, setWeekTitle] = useState("")
    const [subject, setSubject] = useState("لياقة بدنية")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    
    // Filters
    const [filterCourse, setFilterCourse] = useState("all")
    const [filterBatch, setFilterBatch] = useState("all")
    const [filterCompany, setFilterCompany] = useState("all")
    const [filterPlatoon, setFilterPlatoon] = useState("all")
    const [filterOptions, setFilterOptions] = useState<any>({ courses: [], batches: [], companies: [], platoons: [] })

    const [selectedPeriod, setSelectedPeriod] = useState("")
    const [userRole, setUserRole] = useState<string | null>(null);
    const SPORTS_RESTRICTED_ROLES = ["sports_trainer"]; // مدرب فرع التدريب الرياضي فقط
    
    const canAccessDashboard = useMemo(() => {
        if (!userRole) return false;
        // يُسمح بالوصول إذا لم يكن مدرباً رياضياً مقيداً
        return !SPORTS_RESTRICTED_ROLES.includes(userRole);
    }, [userRole]);
    // Bulk Actions & Notes
    const [selectedSoldiers, setSelectedSoldiers] = useState<Set<number>>(new Set())
    const [isBulkEditOpen, setIsBulkEditOpen] = useState(false)
    const [bulkType, setBulkType] = useState<"effort" | "comprehension">("effort")
    const [bulkValue, setBulkValue] = useState("")
    
    const [noteModalOpen, setNoteModalOpen] = useState(false)
    const [currentNoteId, setCurrentNoteId] = useState<number | null>(null)
    const [currentNoteText, setCurrentNoteText] = useState("")

    const [isClient, setIsClient] = useState(false);
    useEffect(() => { setIsClient(true) }, []);

    // --- Effects ---
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
        if (isClient) fetchFilters()
    }, [filterCourse, filterBatch, filterCompany, isClient])

    useEffect(() => {
        if (!isClient) return;
        
        // 🔑 NEW: جلب دور المستخدم
        try {
            const userStr = localStorage.getItem("user");
            if (userStr) {
                const user = JSON.parse(userStr);
                setUserRole(user.role || null);
            }
        } catch (e) { /* ignore */ }

        // استعادة المسودة
        const saved = localStorage.getItem(DRAFT_KEY)
        if (saved) {
            try {
                const draft = JSON.parse(saved)
                if (draft) {
                    setWeekTitle(draft.weekTitle || "")
                    setStartDate(draft.startDate || "")
                    setEndDate(draft.endDate || "")
                    setSoldiers(draft.soldiers || [])
                    if (draft.selectedPeriod) setSelectedPeriod(draft.selectedPeriod);
                    toast.info("تم استعادة مسودة سابقة غير محفوظة")
                }
            } catch (e) {}
        }
    }, [isClient])

    useEffect(() => {
        if (isClient && soldiers.length > 0) {
            const draft = { weekTitle, startDate, endDate, soldiers, selectedPeriod }
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
        }
    }, [soldiers, weekTitle, startDate, endDate, selectedPeriod, isClient])

    useEffect(() => { setCurrentPage(1); }, [soldiers.length, itemsPerPage])

    // --- Helpers ---
    const daysList = useMemo(() => {
        if (!startDate || !endDate) return [];
        try {
            const start = parseISO(startDate);
            const end = parseISO(endDate);
            if (!isValid(start) || !isValid(end) || start > end) return [];
            return eachDayOfInterval({ start, end });
        } catch (e) { return [] }
    }, [startDate, endDate]);

    const normalizeNumber = (val: string) => val.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());

    // --- Logic ---
    const fetchData = async () => {
        if (!startDate || !endDate || !weekTitle) {
            return toast.error("الرجاء إدخال العنوان والتاريخ");
        }
        if (filterCourse === "طلبة الدبلوم" && !selectedPeriod) {
            return toast.error("الرجاء اختيار الفترة الدراسية لطلبة الدبلوم");
        }

        setLoading(true);
        setExistingReportId(null); 

        try {
            const checkParams = new URLSearchParams({
                course: filterCourse, batch: filterBatch, company: filterCompany, platoon: filterPlatoon, title: weekTitle, subject: subject
            });
            const checkRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/weekly-reports/check?${checkParams.toString()}`);
            const checkJson = await checkRes.json();

            const params = new URLSearchParams({ limit: "1000" })
            if (filterCourse !== 'all') params.append('course', filterCourse)
            if (filterBatch !== 'all') params.append('batch', filterBatch)
            if (filterCompany !== 'all') params.append('company', filterCompany)
            if (filterPlatoon !== 'all') params.append('platoon', filterPlatoon)
            
            const soldiersRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/?${params.toString()}`, {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
});
            const soldiersJson = await soldiersRes.json()

            const attParams = new URLSearchParams({ 
    class_type: subject === "لياقة بدنية" ? "fitness" : "combat", 
    start_date: startDate, 
    end_date: endDate,
    // 🟢 أضف هذين السطرين ليعمل الفلتر الذكي
    course: filterCourse,
    batch: filterBatch
})
            const attRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance/?${attParams.toString()}`, {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
});
            const attJson = await attRes.json()
            setAttendanceData(attJson)

            let processedSoldiers = [];

            if (checkJson.found) {
                toast.success("تم استرجاع التقرير المحفوظ للتعديل عليه 📂");
                setExistingReportId(checkJson.report_id);
                const savedGradesMap = new Map(checkJson.grades.map((g: any) => [g.soldier_id, g]));

                processedSoldiers = (soldiersJson.data || []).map((s: any) => {
                    const studentAtt = attJson.filter((a: any) => a.soldier_id === s.id);
                    const saved: any = savedGradesMap.get(s.id); 
                    let b_deduct = 0, e_deduct = 0, c_deduct = 0;
                    studentAtt.forEach((a: any) => {
                        const rule = VIOLATION_RULES[a.value]; 
                        if (rule) { b_deduct += rule.b; e_deduct += rule.e; c_deduct += rule.c; } 
                        else { b_deduct += 1; e_deduct += 1; c_deduct += 1; }
                    });
                    const max_b = Math.max(0, 10 - b_deduct);
                    const max_e = Math.max(0, 10 - e_deduct);
                    const max_c = Math.max(0, 10 - c_deduct);

                    return {
                        ...s,
                        attendance: studentAtt,
                        calc: { max_b, max_e, max_c },
                        scores: { 
                            b: saved ? saved.b : max_b,
                            e: saved ? saved.e : max_e,
                            c: saved ? saved.c : max_c
                        },
                        notes: saved ? saved.notes : ""
                    }
                });
            } else {
                toast.info("جاري إنشاء تقرير جديد 🆕");
                processedSoldiers = (soldiersJson.data || []).map((s: any) => {
                    const studentAtt = attJson.filter((a: any) => a.soldier_id === s.id);
                    let b_deduct = 0, e_deduct = 0, c_deduct = 0;
                    studentAtt.forEach((a: any) => {
                        const rule = VIOLATION_RULES[a.value]; 
                        if (rule) { b_deduct += rule.b; e_deduct += rule.e; c_deduct += rule.c; } 
                        else { b_deduct += 1; e_deduct += 1; c_deduct += 1; }
                    });
                    const max_b = Math.max(0, 10 - b_deduct);
                    const max_e = Math.max(0, 10 - e_deduct);
                    const max_c = Math.max(0, 10 - c_deduct);
                    return {
                        ...s,
                        attendance: studentAtt,
                        calc: { max_b, max_e, max_c },
                        scores: { b: max_b, e: max_e, c: max_c },
                        notes: ""
                    }
                });
            }
            setSoldiers(processedSoldiers);
            setSelectedSoldiers(new Set());
            setCurrentPage(1);
        } catch (e) { console.error(e); toast.error("حدث خطأ أثناء جلب البيانات"); } 
        finally { setLoading(false) }
    }

    const handleScoreChange = (id: number, type: 'e' | 'c', val: string) => {
        const cleanVal = normalizeNumber(val);
        if (cleanVal === "" || cleanVal === ".") {
             setSoldiers(prev => prev.map(s => s.id === id ? { ...s, scores: { ...s.scores, [type]: cleanVal } } : s));
             return;
        }
        if (!/^\d*\.?\d*$/.test(cleanVal)) return;
        setSoldiers(prev => prev.map(s => {
            if (s.id !== id) return s;
            const numVal = parseFloat(cleanVal);
            const maxVal = type === 'e' ? s.calc.max_e : s.calc.max_c;
            if (numVal > maxVal) {
                toast.warning(`لا يمكن تجاوز القيمة المحسوبة (${maxVal})`);
                return { ...s, scores: { ...s.scores, [type]: maxVal } };
            }
            return { ...s, scores: { ...s.scores, [type]: cleanVal } }
        }))
    }

    const executeBulkEdit = () => {
        const cleanVal = normalizeNumber(bulkValue);
        const numVal = parseFloat(cleanVal);
        if (isNaN(numVal)) return;
        setSoldiers(prev => prev.map(s => {
            if (selectedSoldiers.has(s.id)) {
                const maxVal = bulkType === 'effort' ? s.calc.max_e : s.calc.max_c;
                const finalVal = Math.min(Math.max(0, numVal), maxVal);
                return { ...s, scores: { ...s.scores, [bulkType === 'effort' ? 'e' : 'c']: finalVal } }
            }
            return s;
        }));
        setIsBulkEditOpen(false);
        setBulkValue("");
        toast.success("تم التعديل الجماعي بنجاح");
    }

    const openNoteModal = (id: number, note: string) => {
        setCurrentNoteId(id);
        setCurrentNoteText(note || "");
        setNoteModalOpen(true);
    }

    const saveNote = () => {
        if (currentNoteId !== null) {
            setSoldiers(prev => prev.map(s => s.id === currentNoteId ? {...s, notes: currentNoteText} : s));
            setNoteModalOpen(false);
        }
    }

    const handleSave = async () => {
    if (!weekTitle || soldiers.length === 0) return toast.error("البيانات ناقصة");
    if (filterCourse === "طلبة الدبلوم" && !selectedPeriod) return toast.error("الرجاء اختيار الفترة الدراسية");

    setIsSaving(true);
    try {
        const reportData = {
            title: weekTitle, start_date: startDate, end_date: endDate, subject,
            course: filterCourse, batch: filterBatch, company: filterCompany, platoon: filterPlatoon,
            period: filterCourse === "طلبة الدبلوم" ? selectedPeriod : null,
            // 💡 ملاحظة أمنية: يفضل أن يستخرج السيرفر trainer_id من التوكن تلقائياً
            trainer_id: 22 
        };
        
        // 🚀 لا نضع Headers هنا، المفتش سيقوم بالواجب
        // البحث عن هذا الجزء وتعديله:
const reportRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/weekly-reports/save`, {
    method: "POST", 
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}` // 🛡️ أضف هذا السطر
    },
    body: JSON.stringify({ 
        report_id: existingReportId, 
        report: reportData, 
        grades: soldiers 
    })
});

        if (reportRes.ok) {
            const responseData = await reportRes.json();
            toast.success(responseData.message || "تمت العملية بنجاح ✅");
            setSoldiers([]); setWeekTitle(""); setStartDate(""); setEndDate(""); 
            setSelectedPeriod(""); setExistingReportId(null); 
            localStorage.removeItem(DRAFT_KEY);
        } else {
            const err = await reportRes.json();
            toast.error(err.detail || "فشل الحفظ");
        }
    } catch (e) {
        toast.error("خطأ في الاتصال بالسيرفر");
    } finally {
        setIsSaving(false);
    }
}

   const handleExportExcel = () => {
    if (soldiers.length === 0) return toast.warning("لا توجد بيانات للتصدير");

    // 1. تجهيز مسميات نظيفة للملف (استبدال "all" بنص فارغ أو كلمة مناسبة)
    const subjectTitle = subject || "درجات";
    const courseTitle = filterCourse !== "all" ? filterCourse : "";
    const batchTitle = filterBatch !== "all" ? filterBatch : "";
    const companyTitle = filterCompany !== "all" ? `سرية ${filterCompany}` : "";
    const platoonTitle = filterPlatoon !== "all" ? `فصيل ${filterPlatoon}` : "";
    
    // 2. تجميع اسم الملف (بفصل الكلمات بشرطة لتحسين شكل الملف)
    // الاسم: المادة - الدورة - الدفعة - السرية - الفصيل - من تاريخ - إلى تاريخ
    const fileName = [
        subjectTitle,
        courseTitle,
        batchTitle,
        companyTitle,
        platoonTitle,
        `من ${startDate}`,
        `إلى ${endDate}`
    ].filter(Boolean).join(" - "); // filter(Boolean) يحذف القيم الفارغة

    const exportData = soldiers.map((s, idx) => {
        const total = (Number(s.scores.b) + Number(s.scores.e) + Number(s.scores.c)) / 3;
        const row: any = {
            "م": idx + 1, 
            "الرقم العسكري": s.military_id, 
            "الاسم": s.name,
            "السلوك والمواظبة": s.scores.b, 
            "الجهد المبذول": s.scores.e,
            "الاستيعاب والاستفادة": s.scores.c, 
            "المجموع": total.toFixed(2), 
            "الملاحظات": s.notes
        };
        
        daysList.forEach(day => {
            const dayAtt = s.attendance.filter((a: any) => isSameDay(parseISO(a.date), day));
            // تنسيق رأس العمود في الإكسل ليكون (اليوم والتاريخ) مثل الجدول تماماً
            const dayHeader = format(day, "EEEE (dd-MM)", { locale: ar });
            row[dayHeader] = dayAtt.map((a: any) => a.value).join(", ");
        });
        return row;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الدرجات الأسبوعية");

    // 3. الحفظ بالاسم الجديد الديناميكي
    XLSX.writeFile(wb, `${fileName}.xlsx`);
}

    const paginatedSoldiers = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return soldiers.slice(start, start + itemsPerPage);
    }, [soldiers, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(soldiers.length / itemsPerPage);

    if (!isClient) return null;

    return (
<ProtectedRoute allowedRoles={["owner","manager","admin","assistant_admin","sports_officer","sports_supervisor", "sports_trainer"]}>
        <div className="space-y-6 pb-20 md:pb-32 " dir="rtl">
            <style jsx global>{`
                @media print {
                    @page { size: portrait; margin: 5mm; }
                    nav, aside, header, .print\\:hidden, button, input[type="checkbox"], [role="dialog"], [data-sonner-toaster] { display: none !important; }
                    body { background: white; font-size: 9pt; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .print-only-table { display: table !important; width: 100%; border-collapse: collapse; }
                    * { position: static !important; overflow: visible !important; box-shadow: none !important; }
                    th, td { border: 1px solid black !important; padding: 4px !important; text-align: center; font-size: 9pt; }
                    th { background-color: #c5b391 !important; color: black !important; font-weight: bold; }
                    thead { display: table-header-group; } tbody { display: table-row-group; } tr { page-break-inside: avoid; }
                }
            `}</style>

            {/* 👇👇 التعديل الجوهري: حذفنا print:hidden من هنا */}
            <div className="space-y-6">
                
                {/* Header (مشترك) - نخفيه فقط عند الطباعة */}
                <div className="flex justify-between items-center print:hidden">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Calendar className="w-6 h-6 text-blue-600" />
                        نظام الدرجات الأسبوعي
                    </h1>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    {/* قائمة التابات - نخفيها عند الطباعة */}
                    {canAccessDashboard && (
                    <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-6 print:hidden">
                        <TabsTrigger value="entry">إدخال الدرجات</TabsTrigger>
                        <TabsTrigger value="dashboard" className="text-purple-700 data-[state=active]:bg-purple-100">سجل الدرجات</TabsTrigger>
                    </TabsList>
)}
                    {/* التاب الأول: نخفي محتواه من الشاشة عند الطباعة، لأن له جدول طباعة خاص في الأسفل */}
                    <TabsContent value="entry" className="space-y-6 print:hidden">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex gap-2">
                                <Button 
    variant="outline" 
    onClick={() => {
        // 1. تجهيز المسميات (نفس منطق الإكسل لضمان التطابق)
        const courseTitle = filterCourse !== 'all' ? filterCourse : '';
        const batchTitle = filterBatch !== 'all' ? filterBatch : '';
        const companyTitle = filterCompany !== 'all' ? `سرية_${filterCompany}` : '';
        const platoonTitle = filterPlatoon !== 'all' ? `فصيل_${filterPlatoon}` : '';
        
        // 2. بناء اسم الملف الكامل
        const fileName = [
            subject,
            courseTitle,
            batchTitle,
            companyTitle,
            platoonTitle,
            `من_${startDate}`,
            `إلى_${endDate}`
        ].filter(Boolean).join(" - ");

        // 3. تغيير عنوان الصفحة مؤقتاً (هذا ما يراه نظام الويندوز/الماك كاسم للملف)
        const originalTitle = document.title;
        document.title = fileName;
        
        // 4. تنفيذ أمر الطباعة
        window.print();
        
        // 5. إعادة العنوان الأصلي بعد ثانية واحدة
        setTimeout(() => {
            document.title = originalTitle;
        }, 1000);
    }}
>
    <Printer className="w-4 h-4 ml-2"/> طباعة
</Button>
                                <Button variant="outline" onClick={handleExportExcel} className="border-green-600 text-green-700 hover:bg-green-50"><Download className="w-4 h-4 ml-2"/> Excel</Button>
                            </div>
                        </div>
                        <Card dir="rtl">
                            <CardContent className="p-4 space-y-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div><label className="text-xs font-bold text-slate-500 mb-1 block">الدورة</label><Select value={filterCourse} onValueChange={(v) => { setFilterCourse(v); setFilterBatch("all"); }}><SelectTrigger><SelectValue placeholder="اختر الدورة" /></SelectTrigger><SelectContent>{filterOptions.courses?.map((c:any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                                    <div><label className="text-xs font-bold text-slate-500 mb-1 block">الدفعة</label><Select value={filterBatch} onValueChange={(v) => { setFilterBatch(v); setFilterCompany("all"); }}><SelectTrigger><SelectValue placeholder="اختر الدفعة" /></SelectTrigger><SelectContent>{filterOptions.batches?.map((b:any) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>
                                    <div><label className="text-xs font-bold text-slate-500 mb-1 block">السرية</label><Select value={filterCompany} onValueChange={(v) => { setFilterCompany(v); setFilterPlatoon("all"); }}><SelectTrigger><SelectValue placeholder="اختر السرية" /></SelectTrigger><SelectContent>{filterOptions.companies?.map((c:any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                                    <div><label className="text-xs font-bold text-slate-500 mb-1 block">الفصيل</label><Select value={filterPlatoon} onValueChange={setFilterPlatoon}><SelectTrigger><SelectValue placeholder="اختر الفصيل" /></SelectTrigger><SelectContent>{filterOptions.platoons?.map((p:any) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                                </div>
                                {filterCourse === "طلبة الدبلوم" && (
                                    <div className="animate-in fade-in slide-in-from-top-2"><label className="text-xs font-bold text-blue-600 mb-1 block">الفترة الدراسية (مطلوب)</label><Select value={selectedPeriod} onValueChange={setSelectedPeriod}><SelectTrigger className="w-full md:w-1/2 border-blue-200 bg-blue-50"><SelectValue placeholder="اختر الفترة" /></SelectTrigger><SelectContent><SelectItem value="الفترة التأسيسية">الفترة التأسيسية</SelectItem><SelectItem value="الفصل الأول">الفصل الأول</SelectItem><SelectItem value="الفصل الثاني">الفصل الثاني</SelectItem><SelectItem value="الفصل الثالث">الفصل الثالث</SelectItem><SelectItem value="الفصل الرابع">الفصل الرابع</SelectItem></SelectContent></Select></div>
                                )}
                                <div className="flex flex-wrap items-end gap-3 pt-4 border-t">
                                    <div className="w-32 md:w-40"><label className="text-xs font-bold text-slate-500 mb-1 block">المادة</label><Select value={subject} onValueChange={setSubject}><SelectTrigger className="h-10 bg-slate-50"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="لياقة بدنية">لياقة بدنية</SelectItem><SelectItem value="اشتباك">اشتباك</SelectItem></SelectContent></Select></div>
                                    <div className="w-full md:w-48"><label className="text-xs font-bold text-slate-500 mb-1 block">عنوان الأسبوع</label><Input value={weekTitle} onChange={e => setWeekTitle(e.target.value)} placeholder="مثال: الأسبوع الأول" className="h-10" /></div>
                                    <div className="flex items-center gap-2 flex-grow md:flex-grow-0"><div><label className="text-xs font-bold text-slate-500 mb-1 block">من</label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10 w-32 md:w-36" /></div><div><label className="text-xs font-bold text-slate-500 mb-1 block">إلى</label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10 w-32 md:w-36" /></div></div>
                                    <div className="flex gap-2 mr-auto w-full md:w-auto mt-2 md:mt-0"><Button onClick={fetchData} disabled={loading} className="bg-slate-900 text-white h-10 flex-1 md:flex-none">{loading ? <Loader2 className="animate-spin"/> : "جلب البيانات"}</Button><Button onClick={handleSave} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white h-10 flex-1 md:flex-none">{isSaving ? <Loader2 className="animate-spin"/> : <div className="flex items-center gap-2"><Save className="w-4 h-4"/> حفظ</div>}</Button></div>
                                </div>
                            </CardContent>
                        </Card>
                        {/* Smart Table */}
                        {soldiers.length > 0 && (
                            <div className="border rounded-lg bg-white shadow-sm overflow-hidden relative flex flex-col">
                                <div className="overflow-x-auto min-h-[400px]" dir="rtl">
                                    <Table className="border-collapse w-max min-w-full text-right">
                                        <TableHeader className="bg-slate-100 sticky top-0 z-20 shadow-sm">
                                            <TableRow>
                                                <TableHead className="w-[40px] text-center border p-1 bg-slate-100 sticky right-0 z-30">
                                                    <Checkbox checked={soldiers.length > 0 && selectedSoldiers.size === soldiers.length} onCheckedChange={(checked: any) => { if(checked) setSelectedSoldiers(new Set(soldiers.map(s => s.id))); else setSelectedSoldiers(new Set()); }} />
                                                </TableHead>
                                                <TableHead className="w-[50px] text-center border p-1 bg-slate-100 sticky right-[40px] z-30 hidden md:table-cell">الصورة</TableHead>
                                                <TableHead className="w-[120px] md:w-[180px] text-right border p-1 bg-slate-100 sticky right-[40px] md:right-[90px] z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">الاسم</TableHead>
                                                <TableHead className="w-[50px] min-w-[50px] md:w-[80px] md:min-w-[80px] text-center border bg-blue-50 text-blue-900 font-bold p-1"><span className="text-[10px] md:text-xs">السلوك</span></TableHead>
                                                <TableHead className="w-[35px] min-w-[35px] md:w-[80px] md:min-w-[80px] text-center border bg-yellow-50 text-yellow-900 font-bold p-0"><span className="text-[9px] md:text-xs">الجهد</span></TableHead>
                                                <TableHead className="w-[40px] min-w-[40px] md:w-[80px] md:min-w-[80px] text-center border bg-green-50 text-green-900 font-bold p-0"><span className="text-[8px] md:text-xs tracking-tighter">الاستيعاب</span></TableHead>
                                                {/* 👇 تم ترتيب الأسطر هنا لمنع المسافات الزائدة */}
                                                {daysList.map(day => (
                                                    <TableHead key={day.toString()} className="w-[50px] text-center border p-1 min-w-[50px]">
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[10px] font-bold">{format(day, "EEE", { locale: ar })}</span>
                                                            <span className="text-[9px] text-slate-400">{format(day, "d/M")}</span>
                                                        </div>
                                                    </TableHead>
                                                ))}
                                                <TableHead className="w-[60px] md:w-[80px] text-center border bg-slate-800 text-white font-bold p-1 static md:sticky md:left-0 z-20">المجموع</TableHead>
                                                <TableHead className="w-[100px] md:w-[150px] text-center border p-1">ملاحظات</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {paginatedSoldiers.map((soldier, idx) => {
                                                const total = (Number(soldier.scores.b) + Number(soldier.scores.e) + Number(soldier.scores.c)) / 3;
                                                return (
                                                    <TableRow key={soldier.id} className="hover:bg-slate-50 group h-12">
                                                        <TableCell className="p-1 border text-center sticky right-0 bg-white group-hover:bg-slate-50 z-10">
                                                            <Checkbox checked={selectedSoldiers.has(soldier.id)} onCheckedChange={(checked: any) => { const newSet = new Set(selectedSoldiers); if(checked) newSet.add(soldier.id); else newSet.delete(soldier.id); setSelectedSoldiers(newSet); }} />
                                                        </TableCell>
                                                        <TableCell className="p-1 border text-center sticky right-[40px] bg-white group-hover:bg-slate-50 z-10 hidden md:table-cell">
                                                            <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 mx-auto">
                                                                <img src={`${process.env.NEXT_PUBLIC_API_URL}/static/images/${soldier.military_id}.jpg`} className="w-full h-full object-cover" onError={(e:any) => e.target.style.display='none'} />
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="p-1 border text-right font-medium text-xs sticky right-[40px] md:right-[90px] bg-white group-hover:bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] truncate max-w-[120px] md:max-w-none">{soldier.name}</TableCell>
                                                        <TableCell className="p-1 border text-center font-bold text-blue-700 bg-blue-50/50 text-xs md:text-sm">{soldier.scores.b}</TableCell>
                                                        <TableCell className="p-0 border text-center bg-yellow-50/50"><Input inputMode="decimal" className="h-8 w-full text-center text-[10px] md:text-sm font-bold p-0 border-transparent hover:border-slate-300 focus:bg-white" value={soldier.scores.e} onChange={(e) => handleScoreChange(soldier.id, 'e', e.target.value)} /></TableCell>
                                                        <TableCell className="p-0 border text-center bg-green-50/50"><Input inputMode="decimal" className="h-8 w-full text-center text-[10px] md:text-sm font-bold p-0 border-transparent hover:border-slate-300 focus:bg-white" value={soldier.scores.c} onChange={(e) => handleScoreChange(soldier.id, 'c', e.target.value)} /></TableCell>
                                                        {/* 👇 تم ترتيب الأسطر هنا أيضاً */}
                                                        {daysList.map(day => {
                                                            const dayAtt = soldier.attendance.filter((a: any) => isSameDay(parseISO(a.date), day));
                                                            return (
                                                                <TableCell key={day.toString()} className="p-1 border text-center relative">
                                                                    {dayAtt.length > 0 && (
                                                                        <Popover>
                                                                            <PopoverTrigger asChild>
                                                                                <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 border border-red-200 flex items-center justify-center text-[10px] font-bold cursor-pointer hover:bg-red-200 mx-auto transition-colors">{dayAtt.length}</div>
                                                                            </PopoverTrigger>
                                                                           <PopoverContent className="w-56 p-3 text-xs z-50 shadow-xl border-slate-200">
  <div className="space-y-3">
    {/* القسم الأول: الحالات (تأتي من جدول session_attendance) */}
    {(() => {
      // 🟢 التعديل هنا: نفلتر بناءً على الحقل type القادم من السيرفر
      const statuses = dayAtt.filter((a: any) => a.type === "status");
      
      if (statuses.length === 0) return null;
      return (
        <div>
          <div className="font-bold mb-1.5 flex items-center gap-1 text-blue-700 border-b border-blue-100 pb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            الحالات:
          </div>
          <ul className="space-y-1 pr-2">
            {statuses.map((a: any, i: number) => (
              <li key={i} className="text-blue-600 font-medium list-disc list-inside">{a.value}</li>
            ))}
          </ul>
        </div>
      );
    })()}

    {/* القسم الثاني: المخالفات (تأتي من جدول session_violations) */}
    {(() => {
      // 🟢 التعديل هنا: نفلتر بناءً على الحقل type القادم من السيرفر
      const violations = dayAtt.filter((a: any) => a.type === "violation");
      
      if (violations.length === 0) return null;
      return (
        <div>
          <div className="font-bold mb-1.5 flex items-center gap-1 text-red-700 border-b border-red-100 pb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
            المخالفات:
          </div>
          <ul className="space-y-1 pr-2">
            {violations.map((a: any, i: number) => (
              <li key={i} className="text-red-700 font-medium list-disc list-inside">{a.value}</li>
            ))}
          </ul>
        </div>
      );
    })()}
  </div>
</PopoverContent>
                                                                        </Popover>
                                                                    )}
                                                                </TableCell>
                                                            )
                                                        })}
                                                        <TableCell className="p-1 border text-center font-bold bg-slate-50 static md:sticky md:left-0 z-10">
                                                            <span className={`px-2 py-1 rounded text-[10px] md:text-xs ${total >= 9 ? 'bg-green-100 text-green-700' : total >= 7 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{total.toFixed(2)}</span>
                                                        </TableCell>
                                                        <TableCell className="p-1 border text-center">
                                                            <Button variant="ghost" size="sm" className={`h-8 w-full text-xs justify-start px-2 ${soldier.notes ? "text-blue-600 bg-blue-50" : "text-slate-400"}`} onClick={() => openNoteModal(soldier.id, soldier.notes)}>
                                                                <Edit className="w-3 h-3 ml-1" /><span className="truncate max-w-[60px] md:max-w-[80px]">{soldier.notes || "ملاحظة"}</span>
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                                <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-50 p-3 border-t gap-4">
                                    <div className="flex items-center gap-4 text-xs text-slate-500">
                                        <span>صفحة <b>{currentPage}</b> من <b>{totalPages || 1}</b></span>
                                        <div className="flex items-center gap-2 mr-4 border-r pr-4">
                                            <span className="font-bold">عرض:</span>
                                            <Select value={String(itemsPerPage)} onValueChange={(val) => { setItemsPerPage(Number(val)); setCurrentPage(1); }}><SelectTrigger className="w-[60px] h-7 text-xs bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem></SelectContent></Select>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="h-8 text-xs"><ChevronLeft className="w-3 h-3 ml-1" /> السابق</Button>
                                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage >= totalPages} className="h-8 text-xs">التالي <ChevronRight className="w-3 h-3 mr-1" /></Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    {/* التاب الثاني: DashboardView */}
                    {/* 👇👇 التعديل: هنا لا يوجد كلاس print:hidden، لذا سيظهر إذا كان التاب نشطاً */}
                    <TabsContent value="dashboard">
                        <DashboardView />
                    </TabsContent>
                </Tabs>
            </div>

            {/* --- Print Content (جدول الطباعة الخاص بتاب الإدخال فقط) --- */}
            {/* 👇👇 التعديل: هذا القسم يظهر فقط إذا كنا في تاب الإدخال */}
            {activeTab === 'entry' && (
                <div className="hidden print:block">
                    <div className="mb-6 border-b-2 border-black pb-4">
                        <div className="flex justify-between items-center w-full mb-4">
                            <div className="w-32 h-32"><img src="/logo.jpg" alt="Logo" className="w-full h-full object-contain" /></div>
                            <div className="text-center flex-1">
                                <h2 className="text-xl font-bold">مـعهد الشرطـة - فرع التدريب الرياضـي</h2>
                                <h1 className="text-2xl font-bold underline mt-2 mb-1">سجل الدرجات الأسبوعـي ({subject})</h1>
                                <h3 className="text-lg font-semibold">{weekTitle}</h3>
                            </div>
                            <div className="text-left text-sm font-bold flex flex-col gap-1"><div>من: {startDate}</div><div>إلى: {endDate}</div></div>
                        </div>
                        <div className="border border-black p-2 text-center font-bold bg-slate-100 text-sm rounded">
                            {[filterCourse !== 'all' ? filterCourse : 'جميع الدورات', filterBatch !== 'all' ? filterBatch : '', filterCompany !== 'all' ? `السرية ${filterCompany}` : '', filterPlatoon !== 'all' ? `فصيل ${filterPlatoon}` : ''].filter(Boolean).join(' / ')}
                        </div>
                    </div>
                    <table className="print-only-table">
                        <thead>
                            <tr>
                                <th style={{width: '20px'}}>#</th><th style={{width: '50px'}}>الرقم العسكري</th><th style={{width: '160px', textAlign: 'center', paddingRight: '5px'}}>الاسم</th><th style={{width: '40px'}}>السلوك</th><th style={{width: '40px'}}>الجهد</th><th style={{width: '40px'}}>الاستيعاب</th>
                                {daysList.map(day => (<th key={day.toString()} style={{width: '60px', fontSize: '8pt'}}>{format(day, "EEE", { locale: ar })}<br/>{format(day, "d/M")}</th>))}
                                <th style={{width: '30px'}}>المجموع</th><th style={{width: '30px'}}>ملاحظات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {soldiers.map((s, idx) => {
                                const total = (Number(s.scores.b) + Number(s.scores.e) + Number(s.scores.c)) / 3;
                                return (
                                    <tr key={s.id}>
                                        <td>{idx + 1}</td><td>{s.military_id}</td><td style={{textAlign: 'right', paddingRight: '5px'}}>{s.name}</td><td>{s.scores.b}</td><td>{s.scores.e}</td><td>{s.scores.c}</td>
                                        {daysList.map(day => { const dayAtt = s.attendance.filter((a: any) => isSameDay(parseISO(a.date), day)); return <td key={day.toString()} style={{fontSize: '7pt', whiteSpace: 'pre-wrap'}}>{dayAtt.length > 0 ? dayAtt.map((a: any) => a.value).join("، ") : ''}</td> })}
                                        <td style={{fontWeight: 'bold'}}>{total.toFixed(2)}</td><td style={{fontSize: '8pt'}}>{s.notes}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modals */}
            <div className="print:hidden">
                {selectedSoldiers.size > 0 && (
                    <div className="fixed bottom-8 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-auto bg-slate-900/95 backdrop-blur shadow-2xl text-white p-3 rounded-xl z-[100] flex flex-col md:flex-row items-center justify-center gap-3 border border-slate-700 animate-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center justify-between w-full md:w-auto gap-4"><span className="font-bold text-sm bg-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-2 whitespace-nowrap"><CheckSquare className="w-4 h-4 text-green-400"/>{selectedSoldiers.size} طالب</span><Button size="sm" variant="ghost" onClick={() => setSelectedSoldiers(new Set())} className="text-slate-400 hover:text-white md:hidden h-8 px-2">إلغاء</Button></div>
                        <div className="flex gap-2 w-full md:w-auto"><Button size="sm" variant="secondary" onClick={() => { setBulkType("effort"); setIsBulkEditOpen(true); }} className="text-xs h-9 flex-1 font-bold shadow-sm">تعديل الجهد</Button><Button size="sm" variant="secondary" onClick={() => { setBulkType("comprehension"); setIsBulkEditOpen(true); }} className="text-xs h-9 flex-1 font-bold shadow-sm">تعديل الاستيعاب</Button><Button size="sm" variant="destructive" onClick={() => setSelectedSoldiers(new Set())} className="text-xs h-9 px-3 hidden md:flex"><Trash2 className="w-4 h-4"/></Button></div>
                    </div>
                )}
                <Dialog open={isBulkEditOpen} onOpenChange={setIsBulkEditOpen}><DialogContent><DialogHeader><DialogTitle>تعديل جماعي ({selectedSoldiers.size} طالب)</DialogTitle></DialogHeader><div className="py-4"><label className="block text-sm font-bold mb-2">أدخل درجة {bulkType === 'effort' ? 'الجهد المبذول' : 'الاستيعاب والاستفادة'} الجديدة:</label><Input inputMode="decimal" value={bulkValue} onChange={(e) => setBulkValue(normalizeNumber(e.target.value))} placeholder="مثال: 9.5" autoFocus /><p className="text-xs text-slate-500 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> لن يتم تجاوز "السقف المحسوب" لكل طالب.</p></div><DialogFooter><Button variant="outline" onClick={() => setIsBulkEditOpen(false)}>إلغاء</Button><Button onClick={executeBulkEdit}>تطبيق التعديل</Button></DialogFooter></DialogContent></Dialog>
                <Dialog open={noteModalOpen} onOpenChange={setNoteModalOpen}><DialogContent><DialogHeader><DialogTitle>تعديل الملاحظات</DialogTitle><DialogDescription>اكتب ملاحظة لهذا الطالب.</DialogDescription></DialogHeader><div className="py-2"><textarea className="w-full p-3 border rounded-md min-h-[100px] text-right" value={currentNoteText} onChange={(e) => setCurrentNoteText(e.target.value)} placeholder="اكتب هنا..." /></div><DialogFooter><Button variant="outline" onClick={() => setNoteModalOpen(false)}>إلغاء</Button><Button onClick={saveNote}>حفظ الملاحظة</Button></DialogFooter></DialogContent></Dialog>
            </div>
        </div>
        </ProtectedRoute>
    )
}