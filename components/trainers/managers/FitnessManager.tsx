"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Upload, Save, Trash2, Printer, Loader2, FileSpreadsheet, Search, ChevronLeft, ChevronRight, X, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import * as XLSX from 'xlsx'

interface FitnessRecord {
    id?: number;
    military_id: string;
    name: string;
    is_unknown?: boolean;
    year: string;
    date: string;
    result: string;
    grade: string;
    weight: number | string;
    overweight: number | string;
    notes: string;
}

export default function FitnessManager() {
    const [data, setData] = useState<FitnessRecord[]>([]) 
    const [loading, setLoading] = useState(false)
    const [trainersMap, setTrainersMap] = useState<Record<string, string>>({})
    const [viewMode, setViewMode] = useState<"preview" | "database">("database")

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
    const [selectedMonth, setSelectedMonth] = useState("all")
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [isPrinting, setIsPrinting] = useState(false)

    // حالة نافذة الحذف
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<{type: 'single' | 'bulk', id?: number, index?: number} | null>(null)
   const [isDeleting, setIsDeleting] = useState(false)
    useEffect(() => {
        const fetchTrainers = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/?limit=3000`)
                
                if (res.ok) {
                    const users = await res.json()
                    const mapping: Record<string, string> = {}
                    users.forEach((u: any) => { if (u.military_id) mapping[u.military_id] = u.name })
                    setTrainersMap(mapping)
                }
            } catch (e) { console.error("فشل تحميل المدربين") }
        }
        fetchTrainers()
    }, [])

    const fetchDatabaseRecords = async () => {
    setLoading(true)
    setViewMode("database")
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trainer/fitness/all/filter?year=${selectedYear}&month=${selectedMonth}`, {
            // 🛡️ إضافة التوكن هنا ضروري جداً
            headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }
        })
            if (res.ok) {
                const json = await res.json()
                setData(json)
                setCurrentPage(1)
                if(json.length === 0) toast.info("لا توجد سجلات مطابقة للبحث")
            }
        } catch (e) { toast.error("فشل جلب البيانات") }
        finally { setLoading(false) }
    }

    // 🧠 دالة ذكية لتوحيد أسماء الأشهر
    const normalizeMonth = (input: any): string => {
        const val = String(input).trim();
        if(["1", "01", "شهر 1", "شهر1", "يناير", "Jan"].includes(val)) return "يناير";
        if(["2", "02", "شهر 2", "شهر2", "فبراير", "Feb"].includes(val)) return "فبراير";
        if(["3", "03", "شهر 3", "شهر3", "مارس", "Mar"].includes(val)) return "مارس";
        if(["4", "04", "شهر 4", "شهر4", "أبريل", "ابريل", "Apr"].includes(val)) return "أبريل";
        if(["5", "05", "شهر 5", "شهر5", "مايو", "May"].includes(val)) return "مايو";
        if(["6", "06", "شهر 6", "شهر6", "يونيو", "Jun"].includes(val)) return "يونيو";
        if(["7", "07", "شهر 7", "شهر7", "يوليو", "Jul"].includes(val)) return "يوليو";
        if(["8", "08", "شهر 8", "شهر8", "أغسطس", "اغسطس", "Aug"].includes(val)) return "أغسطس";
        if(["9", "09", "شهر 9", "شهر9", "سبتمبر", "Sep"].includes(val)) return "سبتمبر";
        if(["10", "شهر 10", "شهر10", "أكتوبر", "اكتوبر", "Oct"].includes(val)) return "أكتوبر";
        if(["11", "شهر 11", "شهر11", "نوفمبر", "Nov"].includes(val)) return "نوفمبر";
        if(["12", "شهر 12", "شهر12", "ديسمبر", "Dec"].includes(val)) return "ديسمبر";
        return val; // إذا لم يعرفه، يعيده كما هو
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(ws);

            const formattedData: FitnessRecord[] = json.map((row: any) => {
                let m_id = String(row['الرقم العسكري'] || row['military_id'] || "").trim();
                if (m_id.endsWith('.0')) m_id = m_id.slice(0, -2);

                const foundName = trainersMap[m_id] || "غير مسجل بالنظام";
                const excelName = row['الاسم'] || row['name'];

                return {
                    military_id: m_id,
                    name: excelName || foundName,
                    is_unknown: !trainersMap[m_id],
                    year: String(row['السنة'] || row['year'] || row['عام'] || new Date().getFullYear()), 
                    // 👇 استخدام دالة التوحيد هنا
                    date: normalizeMonth(row['شهر الاختبار'] || row['date'] || row['الشهر']),
                    result: row['النتيجة'] || row['result'],
                    grade: row['التقدير'] || row['grade'],
                    weight: row['الوزن'] || row['weight'] || 0,
                    overweight: row['الوزن الزائد'] || row['overweight'] || 0,
                    notes: row['الملاحظة'] || row['notes'] || ""
                }
            }).filter((item) => item.military_id);

            if (formattedData.length > 0) {
                setData(formattedData);
                setViewMode("preview"); 
                setCurrentPage(1);
                toast.success(`تم استيراد ${formattedData.length} سجل للمعاينة`);
            } else {
                toast.error("الملف فارغ أو التنسيق غير صحيح");
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = ""; 
    };

    const handleSaveAll = async () => {
        if (data.length === 0) return;
        setLoading(true);
        try {
            const cleanPayload = data.map(item => ({
                military_id: String(item.military_id),
                year: String(item.year),
                date: String(item.date),
                result: String(item.result),
                grade: String(item.grade),
                weight: Number(item.weight) || 0,
                overweight: Number(item.overweight) || 0,
                notes: item.notes || ""
            }));

            // داخل دالة handleSaveAll
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trainer/fitness/bulk`, {
    method: "POST",
    headers: { 
        "Content-Type": "application/json",
        // 🔒 إضافة التوكن للحماية
        "Authorization": `Bearer ${localStorage.getItem("token")}`
    },
    // ✅ تأكد أن الاسم هنا cleanPayload ليطابق المتغير الذي عرفته بالأعلى
    body: JSON.stringify(cleanPayload) 
});

            if (res.ok) {
                const result = await res.json();
                toast.success(result.message || "تم الحفظ بنجاح"); // عرض رسالة الباك إند
                setData([]); 
                setViewMode("database"); 
            } else {
                toast.error("حدث خطأ أثناء الحفظ");
            }
        } catch (e) { toast.error("خطأ في الاتصال") } 
        finally { setLoading(false) }
    };

    // طلب فتح نافذة الحذف
    const confirmDelete = (type: 'single' | 'bulk', id?: number, index?: number) => {
        if (type === 'bulk' && selectedYear === 'all') {
            toast.error("يجب تحديد السنة أولاً لحذف الكل");
            return;
        }
        setDeleteTarget({ type, id, index });
        setIsDeleteDialogOpen(true);
    }

   const executeDelete = async () => {
    setIsDeleting(true)
    if (!deleteTarget) { setIsDeleting(false); return; }

    const token = localStorage.getItem("token"); // 🔑 جلب التوكن مرة واحدة

        try {
            // 1. حذف جماعي
            if (deleteTarget.type === 'bulk') {
                const url = `${process.env.NEXT_PUBLIC_API_URL}/trainer/fitness/delete-by-filter?year=${selectedYear}&month=${encodeURIComponent(selectedMonth)}`;
                const res = await fetch(url, { 
                method: "DELETE",
                headers: { 'Authorization': `Bearer ${token}` } // 🛡️ مفقود
            });
                
                
                if (res.ok) {
                    const json = await res.json();
                    toast.success(json.message);
                    await fetchDatabaseRecords(); // انتظار التحديث
                    setIsDeleteDialogOpen(false); // ✅ إغلاق النافذة الآن بعد النجاح
                } else {
                    toast.error("فشل الحذف الجماعي");
                }
            } 
            
            // 2. حذف فردي
            else if (deleteTarget.type === 'single' && deleteTarget.id) {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trainer/fitness/${deleteTarget.id}`, { 
                method: "DELETE",
                headers: { 'Authorization': `Bearer ${token}` } // 🛡️ مفقود
            });
                if (viewMode === "preview" && deleteTarget.index !== undefined) {
                    const newData = [...data];
                    newData.splice(deleteTarget.index, 1);
                    setData(newData);
                    toast.success("تم الحذف من القائمة");
                    setIsDeleteDialogOpen(false);
                } else if (deleteTarget.id) {
                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trainer/fitness/${deleteTarget.id}`, { method: "DELETE" });
                    if (res.ok) {
                        toast.success("تم حذف السجل");
                        setData(prev => prev.filter(item => item.id !== deleteTarget.id));
                        setIsDeleteDialogOpen(false);
                    }
                }
            }
        } catch (e) { 
            toast.error("خطأ في الاتصال");
        } finally {
            setIsDeleting(false) // ⏹️ إيقاف التحميل في كل الأحوال
        }
    }

    const totalPages = Math.ceil(data.length / itemsPerPage);
    const paginatedData = data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const getDayName = (dateStr: string) => { const d = new Date(dateStr); return !isNaN(d.getTime()) ? format(d, "EEEE", { locale: ar }) : "-"; }
    // 👇👇 2. دالة الطباعة الذكية
    const handlePrintAll = () => {
        setIsPrinting(true); // 1. افتح كل الصفحات
        setTimeout(() => {
            window.print(); // 2. اطبع
            setIsPrinting(false); // 3. ارجع للوضع الطبيعي بعد إغلاق نافذة الطباعة
        }, 100); // انتظار بسيط جداً (جزء من الثانية) لضمان ظهور البيانات
    }
// 🛡️ تحديد الأدوار المسموح لها بالعمليات الإدارية
const ALLOWED_ADMIN_ROLES = ["owner", "manager", "admin", "assistant_admin", "military_supervisor"];

// جلب بيانات المستخدم من التخزين المحلي
const userSession = typeof window !== 'undefined' ? localStorage.getItem("user") : null;
const currentUser = userSession ? JSON.parse(userSession) : null;

// التحقق: هل المستخدم الحالي يملك صلاحية إدارية؟
const canManage = currentUser && ALLOWED_ADMIN_ROLES.includes(currentUser.role);
    // تعديل مصدر البيانات: إذا كنا نطبع خذ الكل، وإلا خذ الصفحة الحالية
    const displayData = isPrinting ? data : paginatedData;

    return (
        <div className="space-y-4 font-sans" dir="rtl">
            <style jsx global>{` @media print { @page { size: A4 portrait; margin: 5mm; } body { background: white !important; } nav, header, aside, .print\\:hidden, .no-print { display: none !important; } .print\\:block { display: block !important; } .print\\:no-shadow { box-shadow: none !important; border: none !important; } table { width: 100% !important; direction: rtl; } th { background-color: #c5b391 !important; color: black !important; border: 1px solid black !important; } td { border: 1px solid black !important; } } `}</style>

            <div className="hidden print:block w-full mb-8">
                <div className="flex justify-between items-start w-full border-b-2 border-black pb-4 mb-2">
                     <div className="w-24 text-right"><img src="/logo.jpg" alt="Logo" className="w-full object-contain" /></div>
                     <div className="flex flex-col items-center text-center">
                         <h3 className="font-bold text-xl">معهد الشرطة</h3>
                         <h3 className="font-bold text-lg mt-1">قسم التدريب العسكري والرياضي</h3>
                         <h2 className="font-bold text-2xl mt-2 border-2 border-black px-6 py-1 rounded-lg">كشف اختبارات اللياقة ({selectedYear})</h2>
                     </div>
                     <div className="flex flex-col items-end gap-1"><div className="flex items-center gap-2"><span className="font-bold">اليوم:</span><div className="min-w-[80px] text-center border-b border-dotted border-black pb-1 font-bold">{getDayName(format(new Date(), "yyyy-MM-dd"))}</div></div><div className="flex items-center gap-2"><span className="font-bold">التاريخ:</span><div className="min-w-[80px] text-center border-b border-dotted border-black pb-1 font-bold">{format(new Date(), "yyyy/MM/dd")}</div></div></div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row items-end md:items-center justify-between gap-4 print:hidden bg-white p-4 rounded-xl border shadow-sm">
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="grid grid-cols-2 gap-2 w-full md:flex">
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="w-full md:w-[100px] h-9"><SelectValue placeholder="السنة" /></SelectTrigger>
                            <SelectContent>{Array.from({length: 5}, (_, i) => (new Date().getFullYear() - i + 1).toString()).map(y => (<SelectItem key={y} value={y}>{y}</SelectItem>))}</SelectContent>
                        </Select>
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                            <SelectTrigger className="w-full md:w-[120px] h-9"><SelectValue placeholder="الشهر" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل الأشهر</SelectItem>
                                {["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"].map(m => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={fetchDatabaseRecords} className="bg-slate-900 text-white h-9 px-4 gap-2">
            <Search className="w-4 h-4" /> عرض
        </Button>
        
        {/* 🔒 زر حذف الكل: لا يظهر إلا للمسؤولين */}
        {canManage && viewMode === "database" && data.length > 0 && (
            <Button onClick={() => confirmDelete('bulk')} variant="destructive" className="h-9 px-4 gap-2 mr-2">
                <Trash2 className="w-4 h-4" /> 
                <span className="hidden md:inline">حذف المحدد ({data.length})</span>
            </Button>
        )}
    </div>

    <div className="flex items-center gap-2 w-full md:w-auto justify-end">
        {/* 🔒 قسم الاستيراد والحفظ: محمي بالكامل */}
        {canManage && (
            <>
                <div className="relative">
                    <Input type="file" accept=".xlsx" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-20 w-full" />
                    <Button variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50 h-9 gap-2">
                        <Upload className="w-4 h-4" /> استيراد
                    </Button>
                </div>
                
                {viewMode === "preview" && (
                    <>
                        <Button onClick={handleSaveAll} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white gap-2 h-9">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />} 
                            حفظ ({data.length})
                        </Button>
                        <Button onClick={() => setData([])} variant="ghost" className="text-red-500 h-9 w-9 p-0">
                            <X className="w-4 h-4" />
                        </Button>
                    </>
                )}
            </>
        )}

        {/* زر الطباعة متاح للجميع */}
        <Button onClick={handlePrintAll} variant="outline" className="h-9 gap-2">
            <Printer className="w-4 h-4" />
        </Button>
    </div>
</div>

            {data.length > 0 && (
                <div className={`text-xs px-2 py-1 rounded w-fit font-bold print:hidden ${viewMode === "preview" ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-500"}`}>
                    {viewMode === "preview" ? "⚠️ وضع المعاينة (البيانات لم تُحفظ بعد)" : `📁 أرشيف البيانات (${selectedYear} - ${selectedMonth === 'all' ? 'الكل' : selectedMonth})`}
                </div>
            )}

            <Card className="print:no-shadow min-h-[300px] overflow-hidden">
                <div className="overflow-x-auto">
                    <Table className="text-center w-full border-collapse">
                        <TableHeader>
                            <TableRow className="bg-slate-100">
                                <TableHead className="text-center font-bold border w-[50px] bg-[#c5b391] text-black">#</TableHead>
                                <TableHead className="text-center font-bold border bg-[#c5b391] text-black">الرقم العسكري</TableHead>
                                <TableHead className="text-center font-bold border bg-[#c5b391] text-black">الاسم</TableHead>
                                <TableHead className="text-center font-bold border bg-[#c5b391] text-black">السنة</TableHead>
                                <TableHead className="text-center font-bold border bg-[#c5b391] text-black">الشهر</TableHead>
                                <TableHead className="text-center font-bold border bg-[#c5b391] text-black">النتيجة</TableHead>
                                <TableHead className="text-center font-bold border bg-[#c5b391] text-black">التقدير</TableHead>
                                <TableHead className="text-center font-bold border bg-[#c5b391] text-black">الوزن</TableHead>
                                <TableHead className="text-center font-bold border bg-[#c5b391] text-black">الزيادة</TableHead>
                                <TableHead className="text-center font-bold border bg-[#c5b391] text-black">الملاحظة</TableHead>
                                <TableHead className="text-center font-bold border bg-[#c5b391] text-black print:hidden">إجراء</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {displayData.length === 0 ? (
                                <TableRow><TableCell colSpan={11} className="h-40 text-center text-slate-400"><div className="flex flex-col items-center justify-center gap-2"><FileSpreadsheet className="w-10 h-10 opacity-20" /><p>لا توجد بيانات للعرض</p></div></TableCell></TableRow>
                            ) : (
                                displayData.map((row, i) => (
                                    <TableRow key={i} className={`hover:bg-slate-50 ${row.is_unknown ? 'bg-red-50' : ''}`}>
                                        <TableCell className="border">{isPrinting ? i + 1 : (currentPage - 1) * itemsPerPage + i + 1}</TableCell>
                                        <TableCell className="border font-mono font-bold">{row.military_id}</TableCell>
                                        <TableCell className={`border font-bold ${row.is_unknown ? 'text-red-500' : ''}`}>{row.name}</TableCell>
                                        <TableCell className="border">{row.year}</TableCell>
                                        <TableCell className="border">{row.date}</TableCell>
                                        <TableCell className={`border font-bold ${row.result === 'راسب' ? 'text-red-600' : 'text-green-600'}`}>{row.result}</TableCell>
                                        <TableCell className="border">{row.grade}</TableCell>
                                        <TableCell className="border">{row.weight}</TableCell>
                                        <TableCell className={`border font-bold ${Number(row.overweight) > 0 ? 'text-red-600' : ''}`}>{Number(row.overweight) > 0 ? `+${row.overweight}` : '-'}</TableCell>
                                        <TableCell className="border text-xs text-slate-500 max-w-[150px] truncate print:max-w-none print:whitespace-normal print:overflow-visible print:text-[10px] print:leading-tight">{row.notes}</TableCell>
                                        <TableCell className="border print:hidden">
    {/* 🛡️ تغليف الزر بشرط الصلاحية canManage */}
    {canManage && (
        <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => confirmDelete('single', row.id, (currentPage - 1) * itemsPerPage + i)} 
            className="text-red-500 hover:bg-red-50 h-8 w-8 p-0"
        >
            <Trash2 className="w-4 h-4" />
        </Button>
    )}
</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {data.length > 0 && (
                    <div className="flex flex-col-reverse md:flex-row items-center justify-between gap-4 p-4 border-t bg-slate-50/50 print:hidden">
                        <div className="flex items-center gap-3 text-sm text-slate-600 w-full justify-center md:justify-start">
                            <span>عرض:</span>
                            <Select value={itemsPerPage.toString()} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}><SelectTrigger className="h-9 w-[80px] bg-white border-slate-300"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem></SelectContent></Select>
                            <span className="whitespace-nowrap">من إجمالي {data.length}</span>
                        </div>
                        <div className="flex items-center gap-2 w-full justify-center md:w-auto">
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-9 px-3 bg-white"><ChevronRight className="w-4 h-4 ml-1" /> السابق</Button>
                            <span className="flex items-center justify-center min-w-[80px] text-sm font-bold bg-white border px-3 py-1.5 rounded h-9">{currentPage} / {totalPages || 1}</span>
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="h-9 px-3 bg-white">التالي <ChevronLeft className="w-4 h-4 mr-1" /></Button>
                        </div>
                    </div>
                )}
            </Card>

            {/* 🔥 نافذة تأكيد الحذف الجميلة */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="max-w-sm" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" /> تأكيد الحذف
                        </DialogTitle>
                        <DialogDescription className="pt-2">
                            {deleteTarget?.type === 'bulk' ? (
                                <span>هل أنت متأكد من حذف <b>جميع السجلات</b> المعروضة لـ ({selectedYear} - {selectedMonth === 'all' ? 'كل الأشهر' : selectedMonth})؟ <br/><span className="text-red-500 font-bold">لا يمكن التراجع عن هذا الإجراء.</span></span>
                            ) : (
                                "هل أنت متأكد من حذف هذا السجل نهائياً؟"
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>إلغاء</Button>
                        
                        {/* 👇 الزر المطور */}
                        <Button variant="destructive" onClick={executeDelete} disabled={isDeleting} className="gap-2">
                            {isDeleting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> جاري الحذف...
                                </>
                            ) : (
                                "نعم، احذف"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}