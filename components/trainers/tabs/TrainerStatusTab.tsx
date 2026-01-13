"use client"

import { useState, useEffect, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, X, ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { toast } from "sonner"

interface TrainerStatusTabProps {
    trainer: any;
    refreshTrigger?: number;
}

export default function TrainerStatusTab({ trainer, refreshTrigger }: TrainerStatusTabProps) {
    const [data, setData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    
    // متغيرات البحث
    const [fromDate, setFromDate] = useState("")
    const [toDate, setToDate] = useState("")

    // 👇 متغيرات الصفحات (الجديدة)
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(5) // الافتراضي 5 ليبقى البروفايل أنيقاً

    // جلب البيانات
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trainer/status/${trainer.id}`)
                if (res.ok) setData(await res.json())
            } catch (e) { toast.error("فشل جلب السجل") }
            finally { setLoading(false) }
        }
        fetchData()
    }, [trainer.id, refreshTrigger])

    // 👇 1. تصفية البيانات (بالتاريخ)
    const filteredData = useMemo(() => {
        return data.filter(item => {
            if (!fromDate && !toDate) return true;
            const itemDate = new Date(item.start_date);
            const start = fromDate ? new Date(fromDate) : null;
            const end = toDate ? new Date(toDate) : null;
            if (start && itemDate < start) return false;
            if (end && itemDate > end) return false;
            return true;
        });
    }, [data, fromDate, toDate]);

    // 👇 2. تقسيم الصفحات (Pagination)
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginatedData = filteredData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // العودة للصفحة الأولى عند البحث أو تغيير العدد
    useEffect(() => { setCurrentPage(1) }, [fromDate, toDate, itemsPerPage]);

    return (

        <div className="font-sans" dir="rtl">
            
            {/* الشريط العلوي: بحث + خيارات عرض */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                
                {/* البحث بالتاريخ */}
                <div className="flex flex-wrap items-end gap-2 w-full md:w-auto">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500">من:</label>
                        <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 w-28 bg-white text-xs" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500">إلى:</label>
                        <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 w-28 bg-white text-xs" />
                    </div>
                    {(fromDate || toDate) && (
                        <Button variant="ghost" size="sm" onClick={() => { setFromDate(""); setToDate(""); }} className="text-red-500 hover:bg-red-50 h-8 w-8 p-0">
                            <X className="w-4 h-4" />
                        </Button>
                    )}
                </div>

                {/* خيارات العرض (يسار) */}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>عرض:</span>
                    <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(Number(v))}>
                        <SelectTrigger className="h-8 w-[70px] bg-white text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="5">5</SelectItem>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* الجدول */}
            <Card className="border-none shadow-none">
                <CardContent className="p-0">
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <Table className="text-center w-full text-xs md:text-sm">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-center font-bold text-black border-l bg-[#c5b391]">الحالة</TableHead>
                                    <TableHead className="text-center font-bold text-black border-l bg-[#c5b391]">تاريخ البداية</TableHead>
                                    <TableHead className="text-center font-bold text-black border-l bg-[#c5b391]">المدة</TableHead>
                                    <TableHead className="text-center font-bold text-black border-l bg-[#c5b391]">تاريخ العودة</TableHead>
                                    <TableHead className="text-center font-bold text-black bg-[#c5b391]">ملاحظات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center">جارِ التحميل...</TableCell></TableRow>
                                ) : filteredData.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center text-slate-400">
                                        {(fromDate || toDate) ? "لا توجد نتائج في هذه الفترة" : "سجل المدرب نظيف (لا توجد حالات)"}
                                    </TableCell></TableRow>
                                ) : (
                                    paginatedData.map((row) => (
                                        <TableRow key={row.id} className="hover:bg-slate-50">
                                            <TableCell className="font-bold text-orange-700 bg-orange-50/50 border-l">{row.status_type}</TableCell>
                                            <TableCell className="border-l">{row.start_date}</TableCell>
                                            <TableCell className="border-l font-bold">{row.duration} يوم</TableCell>
                                            <TableCell className="font-bold text-blue-700 border-l">{row.end_date}</TableCell>
                                            <TableCell className="text-xs text-slate-500 max-w-[150px] truncate" title={row.notes}>{row.notes || "-"}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* 👇 أزرار التنقل (Pagination Controls) */}
                    {filteredData.length > 0 && (
                        <div className="flex items-center justify-between gap-2 mt-3 text-xs">
                            <span className="text-slate-400 mr-2">
                                صفحة {currentPage} من {totalPages}
                            </span>
                            <div className="flex gap-1">
                                <Button 
                                    variant="outline" size="sm" 
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                                    disabled={currentPage === 1}
                                    className="h-7 px-2"
                                >
                                    <ChevronRight className="w-3 h-3" />
                                </Button>
                                <Button 
                                    variant="outline" size="sm" 
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                                    disabled={currentPage >= totalPages}
                                    className="h-7 px-2"
                                >
                                    <ChevronLeft className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}