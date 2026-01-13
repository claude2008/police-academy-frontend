"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle, PenTool, ChevronLeft, ChevronRight, X, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface TrainerReportsCardProps {
    trainerId: number;
}

// 🔑 نموذج البيانات المحدث (ReportAPI)
type ReportAPI = {
    id: number;
    report_type: string;
    date: string;
    recipient: string;
    subject: string;
    content: string;
    target_name: string;
    target_rank: string;
    rec1_name: string;
    rec1_rank: string;
    rec2_name: string;
    rec2_rank: string;
    created_at: string;
    military_id: string | null; // الرقم العسكري للكاتب
    
    // حقول الاعتماد المزدوجة
    officer_approved: boolean;
    officer_approver_name: string | null;
    officer_approver_rank: string | null;
    officer_approver_mil_id: string | null;
    manager_approved: boolean;
    manager_approver_name: string | null;
    manager_approver_rank: string | null;
    manager_approver_mil_id: string | null;
}

// 🔑 المكون الفرعي لعرض التوقيعات (جديد)
// 🔑 المكون الفرعي لعرض التوقيعات (محدث للسحابة)
const ReportSignatureBox = ({ title, rank, name, milId, isApproved }: { title: string, rank: string | null, name: string | null, milId: string | null, isApproved: boolean }) => {
    
    // 🟢 التعديل هنا: استخدام رابط سوبابيز مباشرة بدلاً من المجلد المحلي
    // نستخدم الرقم العسكري + الامتداد png (أو التنسيق الذي اعتمدته للتواقيع)
    const signaturePath = milId 
        ? `https://cynkoossuwenqxksbdhi.supabase.co/storage/v1/object/public/Signatures/${milId}.png?t=${new Date().getTime()}` 
        : null;

    const finalName = name || '---';
    const finalRank = rank || '---';

    return (
        <div className={`p-3 rounded-lg border transition-all ${isApproved ? 'border-green-400 bg-green-50/50 shadow-sm' : 'border-slate-300 bg-slate-50'}`}>
            <label className={`text-xs font-bold block mb-2 ${isApproved ? 'text-green-800' : 'text-slate-800'}`}>{title}</label>
            <div className="text-right space-y-1">
                
                <div className="flex flex-col gap-1 text-xs font-medium">
                    <div className="flex justify-start">الرتبة: <span className="font-bold mr-1">{finalRank}</span></div>
                    <div className="flex justify-start">الاسم: <span className="font-bold mr-1">{finalName}</span></div>
                </div>

                <div className="mt-3 pt-2 border-t border-dotted relative h-16 flex items-end justify-center">
                    {/* عرض التوقيع الإلكتروني من سوبابيز */}
                    {isApproved && signaturePath ? (
                        <img 
                            src={signaturePath} 
                            className="h-full w-auto object-contain absolute bottom-0 hover:scale-110 transition-transform" 
                            alt={`${title} Signature`} 
                            onError={(e) => {
                                // إذا فشل تحميل الـ png، نجرب الـ jpg كخيار احتياطي
                                if (!(e.target as HTMLImageElement).src.includes('.jpg')) {
                                    (e.target as HTMLImageElement).src = signaturePath.replace('.png', '.jpg');
                                } else {
                                    (e.target as HTMLImageElement).style.display='none';
                                }
                            }}
                        />
                    ) : (
                         <span className="text-[10px] text-slate-400 font-bold italic">
                            {isApproved ? "تم الاعتماد (توقيع رقمي)" : "في انتظار الاعتماد"}
                         </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default function TrainerReportsCard({ trainerId }: TrainerReportsCardProps) {
    const [reports, setReports] = useState<ReportAPI[]>([]) // 🔑 تحديث نوع البيانات
    const [selectedReport, setSelectedReport] = useState<ReportAPI | null>(null) // 🔑 تحديث نوع البيانات
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [loading, setLoading] = useState(true)
    const [isSigning, setIsSigning] = useState(false)
    
    // 👇 متغيرات الصفحات والتاريخ (Pagination & Filter)
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(5)
    
    // 👇 حقول الفلترة الجديدة
    const [fromDate, setFromDate] = useState("")
    const [toDate, setToDate] = useState("")

    // ❌ متغيرات التوقيع القديمة (signData) تم حذفها

    useEffect(() => {
        fetchTrainerReports()
    }, [trainerId])

    const fetchTrainerReports = async () => {
    setLoading(true)
    try {
        // 🔑 الحل هنا: نستخدم writer_id لأن قاعدة بياناتك تربط التقارير بهذا الاسم
        const params = new URLSearchParams({
            category: "trainers", 
            branch: "all",
            writer_id: trainerId.toString(), // 👈 تأكد أن الحقل هنا اسمه writer_id
        })
        
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }
        })

        if (res.ok) {
            const json = await res.json()
            // حسب البيانات التي أرسلتها، البيانات قد تكون مباشرة في المصفوفة أو داخل data
            const reportsData = json.data || json; 
            
            // 🛡️ تصفية إضافية لضمان الدقة: نأخذ فقط التقارير التي كاتبها هو هذا المدرب
            const finalReports = reportsData.filter((r: any) => r.writer_id === trainerId);
            
            setReports(finalReports);
        }
    } catch (e) { 
        console.error("Error fetching reports:", e);
        setReports([]);
    } finally {
        setLoading(false)
    }
}

    // 🔑 تحديث الدالة: الآن هي فقط للعرض
    const openReportForSigning = (report: ReportAPI) => {
        setSelectedReport(report)
        // ❌ تم حذف منطق setSignData
        setIsDialogOpen(true)
    }

    // ❌ حذف دالة handleSignReport بالكامل (لم تعد مطلوبة)
    /*
    const handleSignReport = async () => { ... }
    */

    // 👇 منطق الفلترة (بالتاريخ)
    const filteredReports = useMemo(() => {
        return reports.filter(r => {
            // إذا لم يتم اختيار تواريخ، نعيد الكل
            if (!fromDate && !toDate) return true;
            
            const rDate = new Date(r.date);
            const start = fromDate ? new Date(fromDate) : null;
            const end = toDate ? new Date(toDate) : null;
            
            // المقارنة
            if (start && rDate < start) return false;
            if (end && rDate > end) return false;
            
            return true;
        });
    }, [reports, fromDate, toDate]);

    // 👇 تقسيم الصفحات
    const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
    const paginatedReports = filteredReports.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // العودة للصفحة الأولى عند التغيير
    useEffect(() => { setCurrentPage(1) }, [itemsPerPage, fromDate, toDate]);

    return (
        <Card className="border-none shadow-none pb-10 md:pb-24 ">
            <CardHeader className="pb-2 px-0 pt-0">
                <div className="flex flex-col md:flex-row justify-between items-end gap-3">
                    
                    {/* 👇 حقول الفلترة الجديدة (يسار) */}
                    <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border w-full md:w-auto">
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">من</span>
                            <Input 
                                type="date" 
                                value={fromDate} 
                                onChange={(e) => setFromDate(e.target.value)} 
                                className="h-7 w-[100px] text-xs bg-white border-slate-200" 
                            />
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">إلى</span>
                            <Input 
                                type="date" 
                                value={toDate} 
                                onChange={(e) => setToDate(e.target.value)} 
                                className="h-7 w-[100px] text-xs bg-white border-slate-200" 
                            />
                        </div>
                        {(fromDate || toDate) && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => { setFromDate(""); setToDate("") }} 
                                className="h-7 w-7 p-0 text-red-500 hover:bg-red-50"
                            >
                                <X className="w-3 h-3" />
                            </Button>
                        )}
                    </div>
                    
                    {/* 👇 خيارات العرض (يمين) */}
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>عرض:</span>
                        <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(Number(v))}>
                            <SelectTrigger className="h-7 w-[65px] bg-white text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="5">5</SelectItem>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="20">20</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            
            <CardContent className="px-0 pb-0">
                {loading ? (
                    <div className="text-center py-6 text-slate-400 text-xs">جارِ تحميل التقارير...</div>
                ) : filteredReports.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-sm border-2 border-dashed rounded-lg bg-slate-50">
                        {(fromDate || toDate) ? "لا توجد تقارير في الفترة المحددة" : "لا توجد طلبات أو تقارير مقدمة من هذا المدرب."}
                    </div>
                ) : (
                    <div className="rounded-lg border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50">
                                    <TableHead className="text-right text-xs font-bold">التاريخ</TableHead>
                                    <TableHead className="text-right text-xs font-bold">النوع</TableHead>
                                    <TableHead className="text-right text-xs font-bold">الموضوع</TableHead>
                                    <TableHead className="text-center text-xs font-bold">الحالة</TableHead>
                                    <TableHead className="text-center text-xs font-bold">إجراء</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedReports.map((report) => {
                                    // 🔑 استخدام حالة الاعتماد المزدوجة الجديدة
                                    const isApproved = report.officer_approved || report.manager_approved;

                                    return (
                                        <TableRow key={report.id} className="hover:bg-slate-50">
                                            <TableCell className="font-mono text-xs whitespace-nowrap">{report.date}</TableCell>
                                            <TableCell className="font-bold text-xs text-blue-700 whitespace-nowrap">{report.report_type}</TableCell>
                                            <TableCell className="font-medium text-xs truncate max-w-[150px]" title={report.subject}>{report.subject}</TableCell>
                                            <TableCell className="text-center">
                                                {isApproved ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">
                                                        <CheckCircle className="w-3 h-3" /> معتمد
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-bold">
                                                        انتظار
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Button size="sm" variant="ghost" onClick={() => openReportForSigning(report)} className="h-7 text-xs gap-1 hover:bg-blue-50 text-blue-600">
                                                    <PenTool className="w-3 h-3" /> عرض
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>

                        {/* 👇 أزرار التنقل */}
                        {filteredReports.length > itemsPerPage && (
                            <div className="flex items-center justify-between gap-2 p-2 bg-slate-50/50 border-t">
                                <span className="text-[10px] text-slate-400 mr-2">
                                    صفحة {currentPage} من {totalPages}
                                </span>
                                <div className="flex gap-1">
                                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-6 px-2">
                                        <ChevronRight className="w-3 h-3" />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="h-6 px-2">
                                        <ChevronLeft className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* نافذة العرض والتوقيع (المعدلة) */}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="max-w-3xl" dir="rtl"> {/* 🔑 زيادة عرض النافذة قليلاً */}
                        <DialogHeader>
                            <DialogTitle>مراجعة التقرير والسجل الاعتمادي</DialogTitle>
                        </DialogHeader>
                        
                        {selectedReport && (
                            <div className="space-y-4 py-4">
                                <div className="bg-slate-50 p-4 rounded-lg border text-sm space-y-2">
                                    <div className="flex justify-between font-bold text-slate-700 border-b pb-2">
                                        <span>النوع: {selectedReport.report_type}</span>
                                        <span>التاريخ: {selectedReport.date}</span>
                                    </div>
                                    <p className="font-bold">الموضوع: {selectedReport.subject}</p>
                                    <div className="mt-2 p-2 bg-white rounded border border-slate-200 min-h-[80px] whitespace-pre-wrap">
                                        {selectedReport.content}
                                    </div>
                                </div>

                                {/* 🔑🔑 القسم الجديد لعرض التوقيعات الثلاثة 🔑🔑 */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t">
                                    
                                    {/* 1. توقيع الكاتب (المدرب) */}
                                    <ReportSignatureBox 
                                        title="الكاتب (مقدم الطلب)"
                                        rank={selectedReport.target_rank}
                                        name={selectedReport.target_name}
                                        milId={selectedReport.military_id} 
                                        isApproved={true}
                                    />

                                    {/* 2. توقيع الضابط/المشرف (المعتمد الأول) */}
                                    <ReportSignatureBox 
                                        title="الضابط المعتمد"
                                        rank={selectedReport.officer_approver_rank || selectedReport.rec1_rank}
                                        name={selectedReport.officer_approver_name || selectedReport.rec1_name}
                                        milId={selectedReport.officer_approver_mil_id}
                                        isApproved={selectedReport.officer_approved}
                                    />
                                    
                                    {/* 3. توقيع المدير/المسؤول (المعتمد الثاني) */}
                                    <ReportSignatureBox 
                                        title="المدير/المسؤول"
                                        rank={selectedReport.manager_approver_rank || selectedReport.rec2_rank}
                                        name={selectedReport.manager_approver_name || selectedReport.rec2_name}
                                        milId={selectedReport.manager_approver_mil_id}
                                        isApproved={selectedReport.manager_approved}
                                    />
                                </div>
                            </div>
                        )}

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={loading}>إغلاق</Button>
                            {/* ❌ تم حذف زر حفظ الاعتماد (handleSignReport) */}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    )
}