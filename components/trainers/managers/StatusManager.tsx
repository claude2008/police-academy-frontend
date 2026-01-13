"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Plus, Printer, Download, Search, Loader2, Trash2, Edit, ChevronLeft, ChevronRight, Upload } from "lucide-react"
import { toast } from "sonner"
import { format, addDays, isValid } from "date-fns" 
import { ar } from "date-fns/locale"
import * as XLSX from 'xlsx'

interface StatusManagerProps {
    branch: string;
}

export default function StatusManager({ branch }: StatusManagerProps) {
    const [data, setData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isAddOpen, setIsAddOpen] = useState(false)
    
    // متغيرات الفلترة والصفحات
    const [searchDate, setSearchDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)

    // متغيرات الحذف والاستيراد
    const [deleteId, setDeleteId] = useState<number | null>(null)
    const [isImporting, setIsImporting] = useState(false)

    // منطق "أخرى"
    const [isCustomType, setIsCustomType] = useState(false)

    // 🧠 1. دالة توليد البيانات الابتدائية (تضمن ظهور تاريخ الغد فوراً عند المدة 1)
    const getInitialData = () => {
        const today = new Date();
        return {
            id: null,
            military_id: "", 
            status_type: "",
            custom_status: "", 
            start_date: format(today, "yyyy-MM-dd"),
            duration: "1",
            end_date: format(addDays(today, 1), "yyyy-MM-dd"), // المباشرة غداً تلقائياً
            notes: ""
        };
    };

    // نموذج الإضافة/التعديل (تم تعديله ليستدعي الدالة أعلاه)
    const [formData, setFormData] = useState(getInitialData())

    // 🧠 2. دالة فتح نافذة الإضافة الموحدة (لضمان تصفير البيانات للقيم المحسوبة)
    const handleOpenAdd = () => {
        setFormData(getInitialData());
        setIsCustomType(false);
        setIsAddOpen(true);
    };

    // 🧠 دالة التحويل (عربي -> إنجليزي)
    const normalizeInput = (val: string) => {
        if (!val) return "";
        return val.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
    }

    // 🧠 3. حساب تاريخ العودة (البداية + المدة)
    useEffect(() => {
        const cleanDuration = parseInt(normalizeInput(formData.duration)) || 0;

        if (formData.start_date && cleanDuration > 0) {
            const start = new Date(formData.start_date)
            if (isValid(start)) {
                // القاعدة: المباشرة في اليوم التالي (بدون -1)
                const end = addDays(start, cleanDuration);
                const formattedEnd = format(end, "yyyy-MM-dd");
                
                if (formData.end_date !== formattedEnd) {
                    setFormData(prev => ({ ...prev, end_date: formattedEnd }))
                }
            }
        } else if (formData.end_date !== "") {
            setFormData(prev => ({ ...prev, end_date: "" }))
        }
    }, [formData.start_date, formData.duration])

    // جلب البيانات
   const fetchData = async () => {
    setLoading(true)
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trainer/status/all?branch=${branch}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` } // 🛡️ مفقود
        }) 
        if (res.ok) setData(await res.json())
    } catch (e) { toast.error("خطأ في جلب البيانات") }
    finally { setLoading(false) }
}

    useEffect(() => { fetchData() }, [branch])

    // الحفظ
    const handleSave = async () => {
        const finalStatusType = isCustomType ? formData.custom_status : formData.status_type;

        if (!formData.military_id || !finalStatusType) { 
            toast.error("البيانات ناقصة"); return; 
        }
        
        setIsSaving(true)
        try {
            const cleanDuration = parseInt(normalizeInput(formData.duration));
            const cleanMilId = normalizeInput(formData.military_id);

            const payload = { 
                ...formData, 
                military_id: cleanMilId,
                status_type: finalStatusType, 
                duration: cleanDuration
            }
            
            // داخل دالة handleSave في ملف StatusManager
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trainer/status`, {
    method: "POST",
    headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}` 
    },
    // هنا الاسم payload صحيح ويطابق الكود الخاص بك
    body: JSON.stringify(payload)
});

            if (res.ok) {
                toast.success("تم الحفظ بنجاح");
                setIsAddOpen(false);
                setFormData(getInitialData()); // العودة للقيم المحسوبة مسبقاً
                setIsCustomType(false);
                fetchData(); 
            } else {
                const err = await res.json();
                toast.error(err.detail || "فشل الحفظ");
            }
        } catch (e) { toast.error("خطأ في الاتصال") }
        finally { setIsSaving(false) }
    }

    // الحذف الحقيقي
   const confirmDelete = async () => {
    if(!deleteId) return;
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trainer/status/${deleteId}`, { 
            method: "DELETE",
            headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` } // 🛡️ مفقود
        })
        if(res.ok) {
            toast.success("تم حذف السجل");
            setDeleteId(null);
            fetchData(); 
        } else {
            toast.error("فشل الحذف");
        }
    } catch(e) { toast.error("خطأ في الاتصال") }
}

    // استيراد إكسل
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append("file", file);

        setIsImporting(true);
        const t = toast.loading("جاري استيراد الملف...");
        
        try {
           const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trainer/status/import`, {
    method: "POST",
    headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }, // 🛡️ مفقود
    body: formData
});
            if (res.ok) {
                const json = await res.json();
                toast.dismiss(t);
                toast.success(json.message);
                fetchData();
            } else {
                toast.dismiss(t);
                toast.error("فشل الاستيراد");
            }
        } catch (e) { 
            toast.dismiss(t);
            toast.error("خطأ في الاتصال"); 
        } finally {
            setIsImporting(false);
            e.target.value = ""; 
        }
    }

    // التصدير
    const handleExport = () => {
        if (data.length === 0) return toast.error("لا توجد بيانات");
        const exportData = data.map(d => ({
            "الرقم العسكري": d.military_id,
            "الاسم": d.trainer_name,
            "نوع الحالة": d.status_type,
            "تاريخ البداية": d.start_date,
            "المدة": d.duration,
            "تاريخ العودة": d.end_date,
            "ملاحظات": d.notes
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "الحالات");
        XLSX.writeFile(wb, "سجل_الحالات.xlsx");
    }
// 🛡️ الأدوار المسموح لها بالتحكم الكامل
const ADMIN_ACCESS_ROLES = ["owner", "manager", "admin", "assistant_admin", "military_supervisor"];

// جلب بيانات المستخدم الحالي
const userStr = typeof window !== 'undefined' ? localStorage.getItem("user") : null;
const currentUser = userStr ? JSON.parse(userStr) : null;

// التحقق هل المستخدم الحالي لديه صلاحية إدارية؟
const hasFullAccess = currentUser && ADMIN_ACCESS_ROLES.includes(currentUser.role);
    // --- منطق الفلترة والصفحات ---
    const filteredData = data.filter(d => !searchDate || d.start_date === searchDate);
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentData = filteredData.slice(startIndex, endIndex);

    const getDayName = (dateStr: string) => {
        const d = new Date(dateStr);
        return !isNaN(d.getTime()) ? format(d, "EEEE", { locale: ar }) : "-";
    }

    return (
        <div className="space-y-4 font-sans">
            <style jsx global>{`
                @media print {
                    @page { size: A4 portrait; margin: 10mm; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
                    nav, header, aside, .print\\:hidden, .no-print, [role="tablist"], .toaster, .sonner-toast { display: none !important; }
                    .print\\:block { display: block !important; }
                    .print\\:no-shadow { box-shadow: none !important; border: none !important; }
                    .actions-col { display: none !important; }
                    table { width: 100% !important; direction: rtl; border-collapse: collapse !important; }
                    th { background-color: #c5b391 !important; color: black !important; border: 1px solid black !important; }
                    td { border: 1px solid black !important; }
                }
            `}</style>

            {/* ترويسة الطباعة */}
            <div className="hidden print:block w-full mb-8">
                <div className="flex justify-between items-start w-full border-b-2 border-black pb-4 mb-2">
                     <div className="flex flex-col items-start gap-1">
                        <div className="flex items-center gap-2"><div className="min-w-[80px] text-center border-b border-dotted border-black pb-1 font-bold">{getDayName(format(new Date(), "yyyy-MM-dd"))}</div><span className="font-bold">:اليوم</span></div>
                        <div className="flex items-center gap-2"><div className="min-w-[80px] text-center border-b border-dotted border-black pb-1 font-bold">{format(new Date(), "yyyy/MM/dd")}</div><span className="font-bold">:التاريخ</span></div>
                    </div>
                     <div className="flex flex-col items-center text-center">
                         <h3 className="font-bold text-xl">معهد الشرطة</h3>
                         <h3 className="font-bold text-lg mt-1">قسم التدريب العسكري والرياضي</h3>
                         <h2 className="font-bold text-2xl mt-2 border-2 border-black px-6 py-1 rounded-lg">سجل الحالات والإجازات</h2>
                     </div>
                     <div className="w-24 text-left"><img src="/logo.jpg" alt="Logo" className="w-full object-contain" /></div>
                </div>
            </div>

            {/* شريط الأدوات */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-lg border shadow-sm print:hidden">
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <span className="text-sm font-bold text-slate-500">بحث بالتاريخ:</span>
                    <Input type="date" value={searchDate} onChange={(e) => { setSearchDate(e.target.value); setCurrentPage(1); }} className="w-full md:w-48" />
                    {searchDate && <Button variant="ghost" size="sm" onClick={() => setSearchDate("")} className="text-red-500 text-xs">مسح</Button>}
                </div>
               
                <div className="grid grid-cols-2 gap-2 w-full md:flex md:w-auto md:gap-2">
                    {hasFullAccess && (
                    <div className="relative col-span-1 md:w-auto">
                        <Input type="file" accept=".xlsx" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20" />
                        <Button variant="outline" className="w-full md:w-auto gap-2 border-blue-600 text-blue-700 hover:bg-blue-50 px-4 h-9" disabled={isImporting}>
                            {isImporting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4" />} 
                            <span>استيراد</span>
                        </Button>
                    </div>
                    )}
                    {hasFullAccess && (
                    <Button variant="outline" onClick={handleExport} className="col-span-1 w-full md:w-auto gap-2 border-green-600 text-green-700 hover:bg-green-50 px-4 h-9">
                        <Download className="w-4 h-4" /> 
                        <span>Excel</span>
                    </Button>
)}
{hasFullAccess && (
                    <Button variant="outline" onClick={() => window.print()} className="col-span-1 w-full md:w-auto gap-2 px-4 h-9">
                        <Printer className="w-4 h-4" /> 
                        <span>طباعة</span>
                    </Button>
                    )}
                    {hasFullAccess && (
                    <Button onClick={handleOpenAdd} className="col-span-1 w-full md:w-auto bg-slate-900 text-white gap-2 px-4 h-9">
                        <Plus className="w-4 h-4" /> 
                        <span>إضافة</span>
                    </Button>
                    )}
                </div>
            </div>

            {/* الجدول */}
            <Card className="print:no-shadow">
                <div className="overflow-x-auto">
                    <Table className="text-center w-full" dir="rtl">
                        <TableHeader>
                            <TableRow className="border-b-2 border-slate-300">
                                <TableHead className="text-center font-bold text-black border w-[50px]" style={{ backgroundColor: '#c5b391' }}>#</TableHead>
                                <TableHead className="text-center font-bold text-black border" style={{ backgroundColor: '#c5b391' }}>الرقم العسكري</TableHead>
                                <TableHead className="text-center font-bold text-black border" style={{ backgroundColor: '#c5b391' }}>الاسم</TableHead>
                                <TableHead className="text-center font-bold text-black border" style={{ backgroundColor: '#c5b391' }}>نوع الحالة</TableHead>
                                <TableHead className="text-center font-bold text-black border" style={{ backgroundColor: '#c5b391' }}>تاريخ البداية</TableHead>
                                <TableHead className="text-center font-bold text-black border" style={{ backgroundColor: '#c5b391' }}>المدة</TableHead>
                                <TableHead className="text-center font-bold text-black border" style={{ backgroundColor: '#c5b391' }}>تاريخ العودة</TableHead>
                                <TableHead className="text-center font-bold text-black border" style={{ backgroundColor: '#c5b391' }}>ملاحظات</TableHead>
                                <TableHead className="text-center font-bold text-black border actions-col print:hidden" style={{ backgroundColor: '#c5b391' }}>إجراءات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={9} className="h-24 text-center">جارِ التحميل...</TableCell></TableRow>
                            ) : currentData.length === 0 ? (
                                <TableRow><TableCell colSpan={9} className="h-24 text-center text-slate-500">
                                    {searchDate ? "لا توجد حالات في هذا التاريخ" : "لا توجد سجلات محفوظة"}
                                </TableCell></TableRow>
                            ) : (
                                currentData.map((row, i) => (
                                    <TableRow key={row.id} className="hover:bg-slate-50">
                                        <TableCell className="border border-slate-200">{startIndex + i + 1}</TableCell>
                                        <TableCell className="border border-slate-200 font-mono font-bold">{row.military_id}</TableCell>
                                        <TableCell className="border border-slate-200 font-bold">{row.trainer_name}</TableCell>
                                        <TableCell className="border border-slate-200 font-bold text-orange-700 bg-orange-50/50">{row.status_type}</TableCell>
                                        <TableCell className="border border-slate-200">{row.start_date}</TableCell>
                                        <TableCell className="border border-slate-200 font-bold">{row.duration}</TableCell>
                                        <TableCell className="border border-slate-200 font-bold text-blue-700">{row.end_date}</TableCell>
                                        <TableCell className="border border-slate-200 text-xs text-slate-500 max-w-[150px] truncate">{row.notes}</TableCell>
                                        <TableCell className="border border-slate-200 actions-col print:hidden bg-white">
                                            {hasFullAccess ? (
                                                <div className="flex items-center justify-center gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => { setIsAddOpen(true); setFormData({...row, custom_status: "", duration: row.duration.toString()}); }}>
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => setDeleteId(row.id)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                           ) : (
        <span className="text-xs text-slate-400">للعرض فقط</span>
    )}
</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {/* نافذة الإضافة/التعديل */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="max-w-lg" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>{formData.id ? "تعديل الحالة" : "تسجيل حالة جديدة"}</DialogTitle>
                        <DialogDescription className="hidden">نموذج الإضافة</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold">الرقم العسكري للمدرب</label>
                            <Input 
                                placeholder="مثال: 202..." 
                                value={formData.military_id} 
                                onChange={(e) => {
                                    const val = normalizeInput(e.target.value).replace(/\D/g, '');
                                    setFormData({...formData, military_id: val});
                                }}
                                className="font-bold text-center bg-slate-50" 
                                disabled={!!formData.id} 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold">نوع الحالة</label>
                            <Select value={isCustomType ? "أخرى" : formData.status_type} onValueChange={(v) => {
                                if(v === "أخرى") setIsCustomType(true);
                                else { setIsCustomType(false); setFormData({...formData, status_type: v}); }
                            }}>
                                <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="إجازة اعتيادية">إجازة اعتيادية</SelectItem>
                                    <SelectItem value="إجازة مرضية">إجازة مرضية</SelectItem>
                                    <SelectItem value="راحة طبية">راحة طبية</SelectItem>
                                    <SelectItem value="عيادة">عيادة</SelectItem>
                                    <SelectItem value="غياب">غياب</SelectItem>
                                    <SelectItem value="إلحاق">إلحاق</SelectItem>
                                    <SelectItem value="أخرى">أخرى (كتابة يدوية)</SelectItem>
                                </SelectContent>
                            </Select>
                            {isCustomType && (
                                <Input 
                                    placeholder="اكتب نوع الحالة هنا..." 
                                    value={formData.custom_status} 
                                    onChange={(e) => setFormData({...formData, custom_status: e.target.value})}
                                    className="mt-2 bg-yellow-50 border-yellow-200" 
                                    autoFocus
                                />
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><label className="text-sm font-bold">من تاريخ</label><Input type="date" value={formData.start_date} onChange={(e) => setFormData({...formData, start_date: e.target.value})} /></div>
                            
                            <div className="space-y-2">
                                <label className="text-sm font-bold">المدة (أيام)</label>
                                <Input 
                                    type="text" 
                                    value={formData.duration} 
                                    onChange={(e) => {
                                        const val = normalizeInput(e.target.value).replace(/\D/g, '');
                                        setFormData({...formData, duration: val});
                                    }} 
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-blue-600">تاريخ العودة</label>
                            <Input value={formData.end_date} readOnly className="bg-blue-50 text-center font-bold text-blue-800" />
                        </div>
                        <div className="space-y-2"><label className="text-sm font-bold">ملاحظات</label><Input value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} /></div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSave} disabled={isSaving} className="w-full bg-slate-900 text-white gap-2">
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ البيانات"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-600">حذف السجل</AlertDialogTitle>
                        <AlertDialogDescription>هل أنت متأكد من حذف هذا السجل نهائياً؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">نعم، حذف</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}