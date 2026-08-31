"use client"

import { useState, useEffect, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Shield, ChevronLeft, ChevronRight, Trash2, Filter, AlertTriangle, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface TrainerWorkloadTabProps {
    trainer: any;
    refreshTrigger?: number;
}

export default function TrainerWorkloadTab({ trainer, refreshTrigger }: TrainerWorkloadTabProps) {
    const [data, setData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // متغيرات الفلترة والصفحات
    const [selectedYear, setSelectedYear] = useState("all")
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(5)

    // 👇 متغيرات الحذف الجديدة (للنافذة الجميلة)
    const [deleteTarget, setDeleteTarget] = useState<{id: number, name: string} | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
// 🛡️ تحديد الأدوار المسموح لها بالحذف
const ALLOWED_DELETE_ROLES = ["owner", "manager", "admin", "assistant_admin", "sports_officer", "military_officer"];

// جلب بيانات المستخدم الحالي من المتصفح
const userStr = typeof window !== 'undefined' ? localStorage.getItem("user") : null;
const currentUser = userStr ? JSON.parse(userStr) : null;
const canDelete = currentUser && ALLOWED_DELETE_ROLES.includes(currentUser.role);
    // جلب البيانات
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trainer/workload/${trainer.id}`)
                if (res.ok) setData(await res.json())
            } catch (e) { toast.error("فشل جلب العبء الوظيفي") }
            finally { setLoading(false) }
        }
        if (trainer?.id) fetchData()
    }, [trainer?.id, refreshTrigger])

    // 👇 دالة فتح نافذة الحذف
    const confirmDelete = (id: number, courseName: string) => {
        setDeleteTarget({ id, name: courseName });
    }

    // 👇 دالة تنفيذ الحذف الفعلي (عند ضغط زر "نعم، احذف")
   const executeDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trainer/workload/${deleteTarget.id}`, { 
            method: "DELETE",
            headers: {
                // 🔑 إرسال التوكن لضمان الحماية في السيرفر
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            }
        })
        
        if(res.status === 403) {
            toast.error("عذراً، لا تملك صلاحية الحذف");
            return;
        }

        if(res.ok) {
            toast.success("تم الحذف بنجاح");
            setData(prev => prev.filter(item => item.id !== deleteTarget.id));
            setDeleteTarget(null); 
        } else {
            toast.error("فشل الحذف");
        }
    } catch(e) { toast.error("خطأ في الاتصال") }
    finally { setIsDeleting(false) }
}

    // استخراج السنوات وتصفية البيانات (نفس المنطق السابق)
    const years = useMemo(() => {
        const y = data.map(item => item.year).filter(Boolean);
        return Array.from(new Set(y)).sort().reverse();
    }, [data]);

    const filteredData = useMemo(() => {
        if (selectedYear === "all") return data;
        return data.filter(item => String(item.year) === selectedYear);
    }, [data, selectedYear]);

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginatedData = filteredData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    useEffect(() => { setCurrentPage(1) }, [selectedYear, itemsPerPage]);

    return (
        <div className="font-sans" dir="rtl">
            
            {/* شريط التحكم العلوي */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="h-8 w-[110px] bg-white text-xs"><SelectValue placeholder="السنة" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">كل السنوات</SelectItem>
                            {years.map((y: any) => (<SelectItem key={String(y)} value={String(y)}>{y}</SelectItem>))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>عرض:</span>
                    <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(Number(v))}>
                        <SelectTrigger className="h-8 w-[70px] bg-white text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="5">5</SelectItem><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem></SelectContent>
                    </Select>
                </div>
            </div>

            <Card className="border-none shadow-none">
                <CardContent className="p-0">
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <Table className="text-center w-full text-xs md:text-sm print:text-[7px] print:table-fixed print:w-full">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-center font-bold text-black border-l bg-purple-100 w-[10%] print:p-0.5">السنة</TableHead>
                                    <TableHead className="text-center font-bold text-black border-l bg-purple-100 print:p-0.5">اسم الدورة</TableHead>
                                    <TableHead className="text-center font-bold text-black border-l bg-purple-100 w-[12%] print:p-0.5">المهمة</TableHead>
                                    <TableHead className="text-center font-bold text-black border-l bg-purple-100 w-[12%] print:p-0.5">الصفة</TableHead>
                                    <TableHead className="text-center font-bold text-black border-l bg-purple-100 w-[12%] print:p-0.5">المدة</TableHead>
                                    <TableHead className="text-center font-bold text-black border-l bg-purple-100 w-[18%] print:p-0.5">التاريخ</TableHead>
                                    <TableHead className="text-center font-bold text-black border-l bg-purple-100 w-[10%] print:p-0.5">الساعات العملية</TableHead>
                                    <TableHead className="text-center font-bold text-black border-l bg-purple-100 print:hidden">نوع الدورة</TableHead>
                                    <TableHead className="text-center font-bold text-black border-l bg-purple-100 print:hidden">مدة التدريب اليومي</TableHead>
                                    <TableHead className="text-center font-bold text-black border-l bg-purple-100 print:hidden">عدد ساعات الحالات</TableHead>
                                    <TableHead className="text-center font-bold text-black border-l bg-purple-100 print:p-0.5">الساعات الفعلية</TableHead>
                                    <TableHead className="text-center font-bold text-black bg-purple-100 w-[10%] print:hidden">إجراء</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={12} className="h-24 text-center print:p-0.5">جارِ التحميل...</TableCell></TableRow>
                                ) : filteredData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={12} className="h-32 text-center text-slate-400 print:p-0.5">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <Shield className="w-8 h-8 opacity-20" />
                                                <p>لا يوجد عبء وظيفي {selectedYear !== 'all' ? `لسنة ${selectedYear}` : ''}</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedData.map((row) => (
                                        <TableRow key={row.id} className="hover:bg-slate-50">
                                            <TableCell className="border-l text-slate-500 print:p-0.5">{row.year}</TableCell>
                                            <TableCell className="border-l font-bold print:p-0.5">{row.course_name}</TableCell>
                                            <TableCell className="border-l print:p-0.5">{row.task}</TableCell>
                                            <TableCell className="border-l print:p-0.5">
                                                <span className={`px-2 py-0.5 rounded text-[10px] ${row.assignment_type === 'أساسي' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                    {row.assignment_type}
                                                </span>
                                            </TableCell>
                                            <TableCell className="border-l print:p-0.5">{row.duration || "-"}</TableCell>
                                           <TableCell className="border-l text-[10px] whitespace-nowrap print:p-0.5">
                                                {row.start_date ? (
                                                    <div className="flex flex-col gap-1">
                                                        <span>{row.start_date}</span>
                                                        <span className="text-slate-400 text-[9px]">إلى</span>
                                                        <span className="text-blue-600 font-bold">{row.end_date}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="border-l font-mono print:p-0.5">{row.hours}</TableCell>
                                            <TableCell className="border-l print:hidden">{row.course_type || "-"}</TableCell>
                                            <TableCell className="border-l font-mono print:hidden">{row.daily_hours ?? "-"}</TableCell>
                                            <TableCell className="border-l font-mono print:hidden">{row.case_hours ?? "-"}</TableCell>
                                            <TableCell className="border-l font-mono print:p-0.5">{row.actual_hours ?? "-"}</TableCell>
                                            {/* 🛡️ الزر لن يظهر إلا لمن يملك الصلاحية */}
{canDelete && (
    <TableCell className="print:hidden">
        <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => confirmDelete(row.id, row.course_name)} 
            className="h-7 w-7 p-0 text-red-500 hover:bg-red-50"
        >
            <Trash2 className="w-4 h-4" />
        </Button>
    </TableCell>
)}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {filteredData.length > 0 && (
                        <div className="flex items-center justify-between gap-2 mt-3 text-xs">
                            <span className="text-slate-400 mr-2">صفحة {currentPage} من {totalPages}</span>
                            <div className="flex gap-1">
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-7 px-2"><ChevronRight className="w-3 h-3" /></Button>
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="h-7 px-2"><ChevronLeft className="w-3 h-3" /></Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {filteredData.length > 0 && (
                <div className="flex justify-center gap-4 mt-4">
                    <div className="flex flex-col items-center bg-blue-50 border-2 border-blue-200 rounded-2xl px-8 py-4 shadow">
                        <span className="text-xs font-bold text-blue-500 mb-1">مجموع الساعات الفعلية</span>
                        <span className="text-3xl font-black text-blue-700">
                            {filteredData.reduce((sum, r) => sum + (Number(r.actual_hours) || 0), 0)}
                        </span>
                        <span className="text-xs text-blue-400">ساعة</span>
                    </div>
                    <div className="flex flex-col items-center bg-red-50 border-2 border-red-200 rounded-2xl px-8 py-4 shadow">
                        <span className="text-xs font-bold text-red-500 mb-1">مجموع ساعات الحالات</span>
                        <span className="text-3xl font-black text-red-700">
                            {filteredData.reduce((sum, r) => sum + (Number(r.case_hours) || 0), 0)}
                        </span>
                        <span className="text-xs text-red-400">ساعة</span>
                    </div>
                </div>
            )}

            {/* 👇👇👇 نافذة الحذف الجديدة والجميلة 👇👇👇 */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent className="max-w-sm" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" /> تأكيد الحذف
                        </DialogTitle>
                        <DialogDescription className="pt-2 text-right">
                            هل أنت متأكد من حذف تكليف <span className="font-bold text-slate-900">"{deleteTarget?.name}"</span> نهائياً؟
                            <br />
                            <span className="text-xs text-red-500 mt-1 block">لا يمكن التراجع عن هذا الإجراء.</span>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>إلغاء</Button>
                        <Button variant="destructive" onClick={executeDelete} disabled={isDeleting} className="gap-2">
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            نعم، احذف
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}