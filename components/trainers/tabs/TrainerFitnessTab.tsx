"use client"

import { useState, useEffect, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Activity, AlertCircle, ChevronLeft, ChevronRight, Filter } from "lucide-react"
import { toast } from "sonner"

interface TrainerFitnessTabProps {
    trainer: any;
    refreshTrigger?: number;
}

export default function TrainerFitnessTab({ trainer, refreshTrigger }: TrainerFitnessTabProps) {
    const [data, setData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // 👇 متغيرات الفرز والصفحات
    const [selectedYear, setSelectedYear] = useState("all")
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(5) // الافتراضي 5 لكي لا يطول البروفايل

    // جلب البيانات
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trainer/fitness/${trainer.id}`)
                if (res.ok) {
                    const json = await res.json()
                    setData(json)
                }
            } catch (e) {
                toast.error("فشل جلب سجل الاختبارات")
            } finally {
                setLoading(false)
            }
        }
        if (trainer?.id) fetchData()
    }, [trainer?.id, refreshTrigger])

    // 👇 استخراج السنوات الموجودة في البيانات تلقائياً
    const availableYears = useMemo(() => {
        const years = data.map(item => item.year).filter(Boolean); // استخراج السنوات
        return Array.from(new Set(years)).sort().reverse(); // إزالة التكرار وترتيب تنازلي
    }, [data]);

    // 👇 منطق الفلترة (حسب السنة المختارة)
    const filteredData = useMemo(() => {
        if (selectedYear === "all") return data;
        return data.filter(item => String(item.year) === selectedYear);
    }, [data, selectedYear]);

    // 👇 منطق تقسيم الصفحات (Pagination)
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginatedData = filteredData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // إعادة الصفحة للأولى عند تغيير الفلتر
    useEffect(() => { setCurrentPage(1) }, [selectedYear, itemsPerPage]);

    return (
        
        <div className="font-sans" dir="rtl">
            
            {/* شريط التحكم العلوي (فلترة + خيارات عرض) */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                
                {/* اختيار السنة */}
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="h-8 w-[110px] bg-white text-xs"><SelectValue placeholder="السنة" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">كل السنوات</SelectItem>
                            {availableYears.map(year => (
                                <SelectItem key={String(year)} value={String(year)}>{year}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* عدد الصفوف */}
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
                                    <TableHead className="text-center font-bold text-black border-l bg-[#c5b391] w-[15%]">السنة</TableHead>
                                    <TableHead className="text-center font-bold text-black border-l bg-[#c5b391] w-[15%]">الشهر</TableHead>
                                    <TableHead className="text-center font-bold text-black border-l bg-[#c5b391] w-[15%]">النتيجة</TableHead>
                                    <TableHead className="text-center font-bold text-black border-l bg-[#c5b391] w-[15%]">التقدير</TableHead>
                                    <TableHead className="text-center font-bold text-black border-l bg-[#c5b391] w-[15%]">الوزن</TableHead>
                                    <TableHead className="text-center font-bold text-black border-l bg-[#c5b391] w-[15%]">الزيادة</TableHead>
                                    <TableHead className="text-center font-bold text-black bg-[#c5b391]">ملاحظات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={7} className="h-24 text-center">جارِ التحميل...</TableCell></TableRow>
                                ) : filteredData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-slate-400">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <Activity className="w-8 h-8 opacity-20" />
                                                <p>لا توجد بيانات {selectedYear !== 'all' ? `لسنة ${selectedYear}` : ''}</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedData.map((row) => (
                                        <TableRow key={row.id} className="hover:bg-slate-50">
                                            <TableCell className="border-l text-slate-500">{row.year || "-"}</TableCell>
                                            <TableCell className="border-l font-bold text-slate-700">{row.date}</TableCell>
                                            <TableCell className={`border-l font-bold ${row.result === 'راسب' ? 'text-red-600 bg-red-50' : 'text-green-700'}`}>{row.result}</TableCell>
                                            <TableCell className="border-l">{row.grade}</TableCell>
                                            <TableCell className="border-l font-mono">{row.weight > 0 ? row.weight : "-"}</TableCell>
                                            <TableCell className="border-l font-mono">
                                                {row.overweight > 0 ? (
                                                    <span className="text-red-600 font-bold flex items-center justify-center gap-1">+{row.overweight}</span>
                                                ) : <span className="text-green-600 text-xs">سليم</span>}
                                            </TableCell>
                                            <TableCell className="text-xs text-slate-500 max-w-[120px] truncate" title={row.notes}>{row.notes || "-"}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* أزرار التنقل (Pagination Controls) */}
                    {filteredData.length > 0 && (
                        <div className="flex items-center justify-between gap-2 mt-3 text-xs">
                            <span className="text-slate-400 mr-2">
                                صفحة {currentPage} من {totalPages}
                            </span>
                            <div className="flex gap-1">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                                    disabled={currentPage === 1}
                                    className="h-7 px-2"
                                >
                                    <ChevronRight className="w-3 h-3" />
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
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