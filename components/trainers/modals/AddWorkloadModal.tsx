"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { addDays, format, isValid } from "date-fns"

interface AddWorkloadModalProps {
    isOpen: boolean;
    onClose: () => void;
    trainer: any;
    onSuccess: () => void;
}

export default function AddWorkloadModal({ isOpen, onClose, trainer, onSuccess }: AddWorkloadModalProps) {
    const [isSaving, setIsSaving] = useState(false)
    
    const initialData = {
        year: new Date().getFullYear().toString(),
        course_name: "",
        task: "",
        assignment_type: "",
        hours: "",
        start_date: "",
        duration: "", 
        end_date: "",
        notes: ""
    }
    const [formData, setFormData] = useState(initialData)

    // 🧠 دالة التحويل (عربي -> إنجليزي)
    const normalizeInput = (val: string) => {
        if (!val) return "";
        return val.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
    }

    // 🧠 دالة حساب تاريخ النهاية
    useEffect(() => {
        // نضمن أن المدة رقم صحيح ونظيف
        const cleanDuration = parseInt(formData.duration) || 0;
        
        if (formData.start_date && cleanDuration > 0) {
            const start = new Date(formData.start_date);
            if (isValid(start)) {
                // المعادلة: (عدد الأسابيع * 7) - 3 أيام
                const end = addDays(start, (cleanDuration * 7) - 3);
                setFormData(prev => ({ ...prev, end_date: format(end, "yyyy-MM-dd") }));
            }
        } else {
            setFormData(prev => ({ ...prev, end_date: "" }));
        }
    }, [formData.start_date, formData.duration])

    const handleSave = async () => {
        if (!formData.course_name || !formData.task || !formData.hours) { 
            toast.error("يرجى تعبئة الحقول الأساسية"); return; 
        }
        
        setIsSaving(true)
        try {
            const payload = { 
                military_id: trainer.military_id,
                year: normalizeInput(formData.year),
                course_name: formData.course_name,
                task: formData.task,
                assignment_type: formData.assignment_type,
                hours: parseInt(formData.hours) || 0, // الساعات الآن مضمونة أنها إنجليزية
                start_date: formData.start_date,
                duration: formData.duration, // المدة الآن مضمونة أنها إنجليزية
                end_date: formData.end_date,
                notes: formData.notes
            }
            
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trainer/workload`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })

            if (res.ok) {
                toast.success("تم إضافة العبء الوظيفي بنجاح");
                setFormData(initialData);
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
            <DialogContent className="max-w-xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle>إضافة عبء وظيفي: {trainer?.name}</DialogTitle>
                    <DialogDescription>تسجيل دورة تدريبية أو مهمة إشرافية.</DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                    
                    {/* الصف الأول */}
                    <div className="grid grid-cols-4 gap-3">
                        <div className="col-span-1 space-y-1">
                            <label className="text-xs font-bold">السنة</label>
                            <Input 
                                value={formData.year} 
                                onChange={(e) => {
                                    // تحويل السنة أيضاً
                                    const val = normalizeInput(e.target.value).replace(/\D/g, '');
                                    setFormData({...formData, year: val});
                                }} 
                                placeholder="2024"
                            />
                        </div>
                        <div className="col-span-3 space-y-1">
                            <label className="text-xs font-bold">اسم الدورة / النشاط</label>
                            <Input 
                                value={formData.course_name} 
                                onChange={(e) => setFormData({...formData, course_name: e.target.value})} 
                                placeholder="مثال: دورة الصاعقة..." 
                            />
                        </div>
                    </div>

                    {/* الصف الثاني */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-bold">المهمة</label>
                            <Select value={formData.task} onValueChange={(v) => setFormData({...formData, task: v})}>
                                <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="مدرب">مدرب</SelectItem>
                                    <SelectItem value="مشرف">مشرف</SelectItem>
                                    <SelectItem value="إداري">إداري</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold">الصفة</label>
                            <Select value={formData.assignment_type} onValueChange={(v) => setFormData({...formData, assignment_type: v})}>
                                <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="أساسي">أساسي</SelectItem>
                                    <SelectItem value="مساعد">مساعد</SelectItem>
                                    <SelectItem value="تعويض">تعويض</SelectItem>
                                    <SelectItem value="احتياط">احتياط</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold">عدد الساعات</label>
                            {/* 👇👇 التعديل 1: الساعات تتحول فوراً */}
                            <Input 
                                type="text"
                                value={formData.hours} 
                                placeholder="مثال: 50"
                                onChange={(e) => {
                                    const val = e.target.value;
                                    let clean = normalizeInput(val); // تحويل
                                    clean = clean.replace(/\D/g, ''); // تنظيف
                                    setFormData({...formData, hours: clean});
                                }} 
                            />
                        </div>
                    </div>

                    {/* الصف الثالث */}
                    <div className="grid grid-cols-3 gap-3 bg-slate-50 p-2 rounded border border-slate-100">
                        <div className="space-y-1">
                            <label className="text-xs font-bold">تاريخ البداية</label>
                            <Input 
                                type="date" 
                                value={formData.start_date} 
                                onChange={(e) => setFormData({...formData, start_date: e.target.value})} 
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold">المدة (بالأسابيع)</label>
                            {/* 👇👇 التعديل 2: المدة تتحول فوراً */}
                            <Input 
                                type="text"
                                placeholder="مثال: 5"
                                value={formData.duration} 
                                onChange={(e) => {
                                    const val = e.target.value;
                                    let clean = normalizeInput(val); // تحويل
                                    clean = clean.replace(/\D/g, ''); // تنظيف
                                    setFormData({...formData, duration: clean});
                                }} 
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-blue-700">تاريخ النهاية (تلقائي)</label>
                            <Input 
                                type="date" 
                                value={formData.end_date} 
                                readOnly 
                                className="bg-blue-50 border-blue-200 font-bold text-blue-800"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold">ملاحظات</label>
                        <Input value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
                    </div>
                </div>
                
                <DialogFooter>
                    <Button onClick={handleSave} disabled={isSaving} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ البيانات
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}