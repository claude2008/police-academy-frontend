"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { addDays, format, isValid } from "date-fns"

interface AddStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
    trainer: any;
    onSuccess: () => void;
}

export default function AddStatusModal({ isOpen, onClose, trainer, onSuccess }: AddStatusModalProps) {
    const [isSaving, setIsSaving] = useState(false)
    
    const [formData, setFormData] = useState({
    status_type: "",
    start_date: format(new Date(), "yyyy-MM-dd"), 
    duration: "1", 
    end_date: format(addDays(new Date(), 1), "yyyy-MM-dd"), // العودة غداً تلقائياً
    notes: ""
})

    // 🧠 1. دالة التحويل الفوري (عربي -> إنجليزي)
    const normalizeInput = (val: string) => {
        return val.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
    }

    // 🧠 2. الحساب التلقائي لتاريخ النهاية
    useEffect(() => {
    const cleanDuration = parseInt(normalizeInput(formData.duration)) || 0;
    
    if (formData.start_date && cleanDuration > 0) {
        const start = new Date(formData.start_date);
        if (isValid(start)) {
            // المعادلة الجديدة: (تاريخ البداية + عدد الأيام)
            // إذا بدأ اليوم (السبت) لمدة يوم واحد، يعود غداً (الأحد)
            const end = addDays(start, cleanDuration); 
            const formattedEnd = format(end, "yyyy-MM-dd");
            
            if (formData.end_date !== formattedEnd) {
                setFormData(prev => ({ ...prev, end_date: formattedEnd }));
            }
        }
    } else {
        if (formData.end_date !== "") {
            setFormData(prev => ({ ...prev, end_date: "" }));
        }
    }
}, [formData.start_date, formData.duration])

    const handleSave = async () => {
        if (!formData.status_type || !formData.start_date || !formData.duration) { 
            toast.error("يرجى تعبئة البيانات الأساسية"); return; 
        }
        
        setIsSaving(true)
        try {
            const cleanDuration = parseInt(normalizeInput(formData.duration));

            const payload = { 
                military_id: trainer.military_id,
                status_type: formData.status_type,
                start_date: formData.start_date,
                duration: cleanDuration,
                end_date: formData.end_date,
                notes: formData.notes
            }
            
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trainer/status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })

            if (res.ok) {
                toast.success("تم تسجيل الحالة بنجاح");
                setFormData({ status_type: "", start_date: "", duration: "", end_date: "", notes: "" });
                onSuccess();
                onClose();
            } else {
                toast.error("فشل الحفظ");
            }
        } catch (e) { toast.error("خطأ في الاتصال") }
        finally { setIsSaving(false) }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md" dir="rtl">
                <DialogHeader>
                    <DialogTitle>تسجيل حالة/إجازة: {trainer?.name}</DialogTitle>
                    <DialogDescription>تسجيل إجازة، دورة خارجية، أو إلحاق.</DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                    
                    <div className="space-y-1">
                        <label className="text-xs font-bold">نوع الحالة</label>
                        <Select value={formData.status_type} onValueChange={(v) => setFormData({...formData, status_type: v})}>
                            <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="إجازة سنوية">إجازة سنوية</SelectItem>
                                <SelectItem value="إجازة مرضية">إجازة مرضية</SelectItem>
                                <SelectItem value="إجازة عرضية">إجازة عرضية</SelectItem>
                                <SelectItem value="دورة خارجية">دورة خارجية</SelectItem>
                                <SelectItem value="دورة داخلية">دورة داخلية</SelectItem>
                                <SelectItem value="إلحاق">إلحاق</SelectItem>
                                <SelectItem value="مهمة عمل">مهمة عمل</SelectItem>
                                <SelectItem value="أخرى">أخرى</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold">تاريخ البداية</label>
                            <Input 
                                type="date" 
                                value={formData.start_date} 
                                onChange={(e) => setFormData({...formData, start_date: e.target.value})} 
                            />
                        </div>
                        
                        <div className="space-y-1">
                            <label className="text-xs font-bold">المدة (بالأيام)</label>
                            {/* 👇 هنا السحر: نحول الرقم فوراً أثناء الكتابة */}
                            <Input 
                                type="text" 
                                placeholder="مثال: 5"
                                value={formData.duration} 
                                onChange={(e) => {
                                    // 1. خذ القيمة كما كتبها المستخدم (عربي أو إنجليزي)
                                    const rawVal = e.target.value;
                                    // 2. حولها لإنجليزي فوراً
                                    const englishVal = normalizeInput(rawVal);
                                    // 3. تأكد أنها أرقام فقط (اختياري لكن أفضل)
                                    if (/^\d*$/.test(englishVal)) {
                                        setFormData({...formData, duration: englishVal});
                                    }
                                }} 
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-blue-700">تاريخ العودة (تلقائي)</label>
                        <Input 
                            value={formData.end_date} 
                            readOnly 
                            className="bg-blue-50 border-blue-200 font-bold text-blue-800" 
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold">ملاحظات</label>
                        <Input value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
                    </div>
                </div>
                
                <DialogFooter>
                    <Button onClick={handleSave} disabled={isSaving} className="bg-orange-600 hover:bg-orange-700 text-white gap-2">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ الحالة
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}