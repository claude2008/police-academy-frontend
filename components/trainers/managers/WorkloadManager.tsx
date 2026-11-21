"use client"

import { useState, useEffect } from "react"
import { safePrint } from "@/lib/safePrint"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, Save, Trash2, Printer, Loader2, FileSpreadsheet, ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import * as XLSX from 'xlsx'
import { addDays, format, isValid } from "date-fns"
import { ar } from "date-fns/locale"

export default function WorkloadManager() {
    const [data, setData] = useState<any[]>([]) 
    const [loading, setLoading] = useState(false)
    const [trainersMap, setTrainersMap] = useState<Record<string, string>>({})

    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [isPrinting, setIsPrinting] = useState(false)
    const [printReady, setPrintReady] = useState(false)

    useEffect(() => {
        const fetchTrainers = async () => {
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/?limit=3000`, {
            // 🛡️ إضافة حماية لعملية جلب القائمة
            headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }
        })
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

   const processExcelDate = (val: any) => {
        if (!val) return "";

        // 1. إذا كان التاريخ رقم تسلسلي من إكسل (مثل 45285)
        if (typeof val === 'number') {
            try {
                // استخدام مكتبة XLSX لتحويل الرقم لتاريخ حقيقي بدقة
                const dateObj = XLSX.SSF.parse_date_code(val);
                const jsDate = new Date(dateObj.y, dateObj.m - 1, dateObj.d);
                return isValid(jsDate) ? format(jsDate, "yyyy-MM-dd") : "";
            } catch { return "" }
        }

        // 2. إذا كان نصاً، نحاول تنظيفه ومعالجته
        if (typeof val === 'string') {
            const cleanStr = val.trim();
            
            // محاولة المعالجة المباشرة
            let date = new Date(cleanStr);
            if (isValid(date)) return format(date, "yyyy-MM-dd");

            // محاولة معالجة التنسيق العربي المشهور (يوم/شهر/سنة)
            if (cleanStr.includes('/') || cleanStr.includes('-')) {
                const separator = cleanStr.includes('/') ? '/' : '-';
                const parts = cleanStr.split(separator);
                
                if (parts.length === 3) {
                    // إذا كان الجزء الأول هو السنة (2025/12/30)
                    if (parts[0].length === 4) {
                        date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    } 
                    // إذا كان الجزء الأخير هو السنة (30/12/2025)
                    else {
                        date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                    }
                    
                    if (isValid(date)) return format(date, "yyyy-MM-dd");
                }
            }
        }

        return val; // العودة بالقيمة الأصلية إذا فشلت كل المحاولات
    }

    const calculateEndDate = (startDateStr: string, durationStr: string) => {
        try {
            if (!startDateStr) return "";
            const start = new Date(startDateStr);
            if (!isValid(start)) return "";
            const weeks = parseInt(durationStr.replace(/\D/g, '')) || 0;
            if (weeks > 0) {
                const end = addDays(start, (weeks * 7) - 3);
                return format(end, "yyyy-MM-dd");
            }
            return "";
        } catch { return "" }
    }
const downloadWorkloadTemplate = () => {
        const headers = [[
            'الرقم العسكري',
            'السنة',
            'اسم الدورة',
            'المهمة',
            'الصفة',
            'المدة',
            'تاريخ البداية',
            'تاريخ النهاية',
            'الساعات',
            'الملاحظة'
        ]];
        const ws = XLSX.utils.aoa_to_sheet(headers);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Workload");
        XLSX.writeFile(wb, "نموذج_العبء_الوظيفي.xlsx");
    };
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(ws);

            const formattedData = json.map((row: any) => {
                let m_id = String(row['الرقم العسكري'] || row['military_id'] || "").trim();
                if (m_id.endsWith('.0')) m_id = m_id.slice(0, -2);

                const foundName = trainersMap[m_id] || "غير مسجل بالنظام";
                const excelName = row['الاسم'] || row['name'];

                const start_date = processExcelDate(row['تاريخ البداية'] || row['start_date']);
                const duration = String(row['المدة'] || row['duration'] || "");
                
                let end_date = processExcelDate(row['تاريخ النهاية'] || row['end_date']);
                if (!end_date) end_date = calculateEndDate(start_date, duration);

                return {
                    military_id: m_id,
                    name: excelName || foundName,
                    is_unknown: !trainersMap[m_id],
                    year: String(row['السنة'] || row['year'] || new Date().getFullYear()),
                    course_name: row['اسم الدورة'] || row['course_name'] || row['الدورة'] || "",
                    task: row['المهمة'] || row['task'] || "مدرب",
                    assignment_type: row['الصفة'] || row['assignment_type'] || "أساسي",
                    duration: duration,
                    start_date: start_date,
                    end_date: end_date,
                    hours: Number(row['الساعات'] || row['hours'] || 0),
                    notes: row['الملاحظة'] || row['notes'] || ""
                }
            }).filter((item: any) => item.military_id);

            if (formattedData.length > 0) {
                setData(formattedData);
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
                course_name: String(item.course_name),
                task: String(item.task),
                assignment_type: String(item.assignment_type),
                hours: Number(item.hours),
                start_date: String(item.start_date),
                end_date: String(item.end_date),
                year: String(item.year),
                duration: String(item.duration),
                notes: item.notes || ""
            }));

           // داخل دالة handleSaveAll في ملف WorkloadManager
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trainer/workload/bulk`, {
    method: "POST",
    headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}` 
    },
    // ✅ يجب أن يكون cleanPayload هنا أيضاً
    body: JSON.stringify(cleanPayload)
});
            const result = await res.json();

            if (res.ok) {
                toast.success(`تم حفظ ${result.saved_count} سجل بنجاح`);
                setData([]); 
            } else {
                toast.error("حدث خطأ أثناء الحفظ");
            }
        } catch (e) { toast.error("خطأ في الاتصال") } 
        finally { setLoading(false) }
    };

    const handlePreparePrint = () => {
        setIsPrinting(true);
        setPrintReady(true);
    }
    const handlePrintNow = () => {
        safePrint()
        setIsPrinting(false);
        setPrintReady(false);
    }
// 🛡️ الأدوار المسموح لها بالتحكم الكامل
const ADMIN_ACCESS_ROLES = ["owner", "manager", "admin", "assistant_admin", "military_supervisor"];

// جلب بيانات المستخدم الحالي
const userStr = typeof window !== 'undefined' ? localStorage.getItem("user") : null;
const currentUser = userStr ? JSON.parse(userStr) : null;

// التحقق هل المستخدم الحالي لديه صلاحية إدارية؟
const hasFullAccess = currentUser && ADMIN_ACCESS_ROLES.includes(currentUser.role);
    const totalPages = Math.ceil(data.length / itemsPerPage);
    const paginatedData = data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const displayData = isPrinting ? data : paginatedData;
    
    const getDayName = (dateStr: string) => { 
        const d = new Date(dateStr); 
        return !isNaN(d.getTime()) ? format(d, "EEEE", { locale: ar }) : "-"; 
    }

    return (
        <div className="space-y-4 font-sans" dir="rtl">
            <style jsx global>{`
                @media print {
                    @page { size: A4 landscape; margin: 10mm; }
                    body { background: white !important; }
                    .print\\:hidden, .no-print { display: none !important; }
                    .print\\:block { display: block !important; }
                    table { width: 100% !important; direction: rtl; border-collapse: collapse !important; table-layout: fixed !important; }
                    th { background-color: #f3e8ff !important; color: black !important; border: 1px solid black !important; font-size: 10px !important; }
                    td { border: 1px solid black !important; word-wrap: break-word !important; font-size: 10px !important; }
                }
            `}</style>

            <div className="hidden print:block w-full mb-6">
                <div className="flex justify-between items-start w-full border-b-2 border-black pb-4 mb-2">
                     <div className="w-24 text-right"><img src="/logo.jpg" alt="Logo" className="w-full object-contain" /></div>
                     <div className="flex flex-col items-center text-center">
                         <h3 className="font-bold text-xl">معهد الشرطة</h3>
                         <h3 className="font-bold text-lg mt-1">قسم التدريب العسكري والرياضي</h3>
                         <h2 className="font-bold text-2xl mt-2 border-2 border-black px-6 py-1 rounded-lg">
                             كشف العبء الوظيفي ({new Date().getFullYear()})
                         </h2>
                     </div>
                     <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2"><span className="font-bold">اليوم:</span><div className="min-w-[80px] text-center border-b border-dotted border-black pb-1 font-bold">{getDayName(format(new Date(), "yyyy-MM-dd"))}</div></div>
                        <div className="flex items-center gap-2"><span className="font-bold">التاريخ:</span><div className="min-w-[80px] text-center border-b border-dotted border-black pb-1 font-bold">{format(new Date(), "yyyy/MM/dd")}</div></div>
                    </div>
                </div>
            </div>

           <div className="flex flex-wrap items-center gap-2 print:hidden bg-slate-50 p-3 rounded-lg border justify-between">
    <div className="flex items-center gap-2">
        {/* 🔒 أزرار التحميل والاستيراد: تظهر فقط للمسؤولين */}
        {hasFullAccess && (
            <>
                <Button 
                    onClick={downloadWorkloadTemplate}
                    variant="outline" 
                    className="text-purple-700 border-purple-200 hover:bg-purple-50 gap-2 h-9 text-sm"
                >
                    <FileSpreadsheet className="w-4 h-4" /> تحميل النموذج
                </Button>

                <div className="relative">
                    <Input type="file" accept=".xlsx" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-20" />
                    <Button className="bg-purple-600 hover:bg-purple-700 text-white gap-2 h-9 text-sm">
                        <Upload className="w-4 h-4" /> استيراد إكسل
                    </Button>
                </div>
            </>
        )}
    </div>

    <div className="flex items-center gap-2">
        {data.length > 0 && (
            <>
                {/* 🔒 زر الحفظ: محمي بالصلاحيات */}
                {hasFullAccess && (
                    <Button onClick={handleSaveAll} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white gap-2 h-9 text-sm">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />} 
                        حفظ الكل ({data.length})
                    </Button>
                )}

                {/* زر الطباعة متاح للجميع */}
                <Button onClick={handlePreparePrint} variant="outline" className="gap-2 h-9 text-sm">
                    <Printer className="w-4 h-4" /> تجهيز للطباعة
                </Button>
                {printReady && (
                    <Button onClick={handlePrintNow} variant="outline" className="gap-2 h-9 text-sm">
                        <Printer className="w-4 h-4" /> اطبع الآن
                    </Button>
                )}

                {/* 🔒 زر مسح القائمة (السلة): محمي بالصلاحيات */}
                {hasFullAccess && (
                    <Button onClick={() => setData([])} variant="ghost" className="text-red-500 hover:bg-red-50 h-9 w-9 p-0">
                        <Trash2 className="w-4 h-4" />
                    </Button>
                )}
            </>
        )}
    </div>
</div>

            {data.length === 0 && (
                <div className="text-sm text-slate-500 mr-2 flex items-center gap-2 justify-center py-4 print:hidden">
                    <FileSpreadsheet className="w-4 h-4" />
                    قم باستيراد ملف (الرقم العسكري، السنة، اسم الدورة، المهمة، الصفة، المدة، تاريخ البداية، الساعات)
                </div>
            )}

            <Card className="print:no-shadow min-h-[300px]">
                {data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[300px] text-slate-400 border-2 border-dashed rounded-lg m-4">
                        <FileSpreadsheet className="w-12 h-12 mb-2 opacity-20" />
                        <p>لا توجد بيانات للعرض</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <Table className="text-center w-full border-collapse text-xs md:text-sm">
                                <TableHeader>
                                    <TableRow className="bg-slate-100">
                                        <TableHead className="text-center font-bold border w-[40px] bg-purple-100 text-black">#</TableHead>
                                        <TableHead className="text-center font-bold border bg-purple-100 text-black">الرقم العسكري</TableHead>
                                        <TableHead className="text-center font-bold border bg-purple-100 text-black w-[60px]">السنة</TableHead>
                                        <TableHead className="text-center font-bold border bg-purple-100 text-black">الاسم</TableHead>
                                        <TableHead className="text-center font-bold border bg-purple-100 text-black">اسم الدورة</TableHead>
                                        <TableHead className="text-center font-bold border bg-purple-100 text-black w-[80px]">المهمة</TableHead>
                                        <TableHead className="text-center font-bold border bg-purple-100 text-black w-[80px]">الصفة</TableHead>
                                        <TableHead className="text-center font-bold border bg-purple-100 text-black w-[80px]">المدة</TableHead>
                                        <TableHead className="text-center font-bold border bg-purple-100 text-black w-[90px]">تاريخ البداية</TableHead>
                                        <TableHead className="text-center font-bold border bg-purple-100 text-black w-[90px]">تاريخ النهاية</TableHead>
                                        <TableHead className="text-center font-bold border bg-purple-100 text-black w-[50px]">الساعات</TableHead>
                                        <TableHead className="text-center font-bold border bg-purple-100 text-black">الملاحظة</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayData.map((row, i) => (
                                        <TableRow key={i} className={`hover:bg-slate-50 ${row.is_unknown ? 'bg-red-50' : ''}`}>
                                            <TableCell className="border">
                                                {isPrinting ? i + 1 : (currentPage - 1) * itemsPerPage + i + 1}
                                            </TableCell>
                                            <TableCell className="border font-mono font-bold">{row.military_id}</TableCell>
                                            <TableCell className="border">{row.year}</TableCell>
                                            <TableCell className={`border font-bold ${row.is_unknown ? 'text-red-500' : ''}`}>{row.name}</TableCell>
                                            <TableCell className="border">{row.course_name}</TableCell>
                                            <TableCell className="border">{row.task}</TableCell>
                                            <TableCell className="border">{row.assignment_type}</TableCell>
                                            <TableCell className="border">{row.duration}</TableCell>
                                            <TableCell className="border font-mono">{row.start_date}</TableCell>
                                            <TableCell className="border font-mono text-blue-700 font-bold">{row.end_date}</TableCell>
                                            <TableCell className="border font-mono">{row.hours}</TableCell>
                                            <TableCell className="border text-xs text-slate-500 max-w-[150px] truncate print:max-w-none print:whitespace-normal">{row.notes}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="flex flex-col-reverse md:flex-row items-center justify-between gap-4 p-4 border-t bg-slate-50/50 print:hidden">
                            <div className="flex items-center gap-3 text-sm text-slate-600 w-full justify-center md:justify-start">
                                <span>عرض:</span>
                                <Select value={itemsPerPage.toString()} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
                                    <SelectTrigger className="h-9 w-[80px] bg-white border-slate-300"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem></SelectContent>
                                </Select>
                                <span className="whitespace-nowrap">من إجمالي {data.length}</span>
                            </div>
                            <div className="flex items-center gap-2 w-full justify-center md:w-auto">
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-9 px-3 bg-white"><ChevronRight className="w-4 h-4 ml-1" /> السابق</Button>
                                <span className="flex items-center justify-center min-w-[80px] text-sm font-bold bg-white border px-3 py-1.5 rounded h-9">{currentPage} / {Math.ceil(data.length / itemsPerPage) || 1}</span>
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(Math.ceil(data.length / itemsPerPage), p + 1))} disabled={currentPage >= Math.ceil(data.length / itemsPerPage)} className="h-9 px-3 bg-white">التالي <ChevronLeft className="w-4 h-4 mr-1" /></Button>
                            </div>
                        </div>
                    </>
                )}
            </Card>
        </div>
    )
}