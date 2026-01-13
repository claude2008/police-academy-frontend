"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface AddFitnessModalProps {
    isOpen: boolean;
    onClose: () => void;
    trainer: any;
    onSuccess: () => void;
}

export default function AddFitnessModal({ isOpen, onClose, trainer, onSuccess }: AddFitnessModalProps) {
    const [isSaving, setIsSaving] = useState(false)
    const [formData, setFormData] = useState({
        date: format(new Date(), "yyyy-MM-dd"), 
        result: "", 
        grade: "",
        weight: "",
        overweight: "0",
        notes: ""
    })

    const handleSave = async () => {
        if (!formData.result || !formData.grade) { 
            toast.error("يرجى إدخال النتيجة والتقدير"); return; 
        }
        
        setIsSaving(true)
        try {
            // 👇 استخراج السنة من التاريخ (حل مشكلة 422)
            const calculatedYear = formData.date.split("-")[0] || new Date().getFullYear().toString();

            const cleanPayload = {
                military_id: trainer.military_id,
                year: calculatedYear, // ✅ تم إضافة السنة الناقصة
                date: formData.date,
                test_result: formData.result,
                test_grade: formData.grade,
                weight: formData.weight, // نرسلها كنص ليقبل العربي
                overweight: formData.overweight, // نرسلها كنص ليقبل العربي
                notes: formData.notes
            }
            
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trainer/fitness`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(cleanPayload)
            })

            if (res.ok) {
                toast.success("تم تسجيل الاختبار بنجاح");
                setFormData({ date: format(new Date(), "yyyy-MM-dd"), result: "", grade: "", weight: "", overweight: "0", notes: "" });
                onSuccess();
                onClose();
            } else {
                const err = await res.json();
                console.error(err); // للمساعدة في اكتشاف الأخطاء
                toast.error("فشل الحفظ: تأكد من البيانات");
            }
        } catch (e) { toast.error("خطأ في الاتصال") }
        finally { setIsSaving(false) }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md" dir="rtl">
                <DialogHeader>
                    <DialogTitle>تسجيل اختبار جديد: {trainer?.name}</DialogTitle>
                    <DialogDescription>إدخال نتيجة اختبار لياقة ووزن بشكل فردي.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    
                    <div className="space-y-1">
                        <label className="text-xs font-bold">تاريخ الاختبار</label>
                        <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold">النتيجة (درجة)</label>
                            {/* 👇 جعلنا النوع text ليقبل الأرقام العربية */}
                            <Input 
                                type="text" 
                                placeholder="مثال: 99.5 أو ٩٩" 
                                value={formData.result} 
                                onChange={(e) => setFormData({...formData, result: e.target.value})} 
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold">التقدير</label>
                            <Select value={formData.grade} onValueChange={(v) => setFormData({...formData, grade: v})}>
                                <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ممتاز">ممتاز</SelectItem>
                                    <SelectItem value="جيد جدا">جيد جداً</SelectItem>
                                    <SelectItem value="جيد">جيد</SelectItem>
                                    <SelectItem value="مقبول">مقبول</SelectItem>
                                    <SelectItem value="ضعيف">ضعيف</SelectItem>
                                    <SelectItem value="معفى">معفى</SelectItem>
                                    <SelectItem value="غياب">غياب</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold">الوزن الحالي (كغ)</label>
                            {/* 👇 جعلنا النوع text */}
                            <Input type="text" value={formData.weight} onChange={(e) => setFormData({...formData, weight: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-red-600">الوزن الزائد</label>
                            {/* 👇 جعلنا النوع text */}
                            <Input type="text" value={formData.overweight} onChange={(e) => setFormData({...formData, overweight: e.target.value})} className="border-red-200 bg-red-50" />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold">ملاحظات</label>
                        <Input value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave} disabled={isSaving} className="bg-slate-900 text-white gap-2">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ النتيجة
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}