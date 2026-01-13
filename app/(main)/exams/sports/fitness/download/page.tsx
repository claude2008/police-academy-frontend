"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { Save, Plus, Trash2, FileText, WifiOff, User } from "lucide-react" // ➕ أضفنا User
import ProtectedRoute from "@/components/ProtectedRoute"
// --- قائمة الألوان المطلوبة ---
const SHABAHA_COLORS = [
  { name: "أحمر", value: "red", hex: "#ef4444" },
  { name: "أصفر", value: "yellow", hex: "#eab308" },
  { name: "أخضر", value: "green", hex: "#22c55e" },
  { name: "أزرق", value: "blue", hex: "#3b82f6" },
  { name: "رمادي", value: "gray", hex: "#6b7280" },
  { name: "برتقالي", value: "orange", hex: "#f97316" },
  { name: "بنفسجي", value: "purple", hex: "#a855f7" },
  { name: "وردي", value: "pink", hex: "#ec4899" },
]

// دالة تحويل الأرقام العربية إلى إنجليزية
const convertArToEn = (s: string) => {
  return s.replace(/[\u0660-\u0669]/g, (c) => {
    return String(c.charCodeAt(0) - 0x0660);
  });
}

type ExamEntry = {
  id: number;
  shabahaNumber: string;
  shabahaColor: string;
  pushups: string;
  situps: string;
  notes: string;
}

export default function DownloadExamPage() {
  // --- State ---
  // تم حذف userName من هنا لأننا سنستخدم التوكن
  const [rows, setRows] = useState<ExamEntry[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [displayName, setDisplayName] = useState("")
  // للنوتة
  const [isNoteOpen, setIsNoteOpen] = useState(false)
  const [currentNoteRowId, setCurrentNoteRowId] = useState<number | null>(null)
  const [tempNote, setTempNote] = useState("")

  // 1. استرجاع البيانات المحفوظة محلياً عند فتح الصفحة (مرة واحدة)
 // 1. استرجاع البيانات المحفوظة محلياً عند فتح الصفحة (مرة واحدة)
  useEffect(() => {
    // أ. جلب اسم المستخدم من الذاكرة
    const userData = localStorage.getItem("user")
    if (userData) {
        try {
            const userObj = JSON.parse(userData)
            setDisplayName(userObj.name || "مستخدم")
        } catch (e) { console.error("Error parsing user data") }
    }

    // ب. استرجاع بيانات الجدول
    const savedData = localStorage.getItem("fitness_exam_draft")
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData)
        const loadedRows = parsed.rows || []
        
        setRows(loadedRows)

        // 🟢 التعديل هنا: فحص ذكي.. هل هناك بيانات حقيقية؟
        const hasRealData = loadedRows.some((r: ExamEntry) => 
            r.shabahaNumber.trim() !== "" || 
            r.shabahaColor.trim() !== "" || 
            r.pushups.trim() !== "" || 
            r.situps.trim() !== "" || 
            r.notes.trim() !== ""
        );

        // لا تظهر الرسالة إلا إذا وجدنا بيانات حقيقية
        if (hasRealData) {
            toast.info("تم استرجاع مسودة غير محفوظة", { description: "يمكنك متابعة العمل من حيث توقفت." })
        }

      } catch (e) { console.error("Error parsing local storage", e) }
    } else {
      setRows([{ id: Date.now(), shabahaNumber: "", shabahaColor: "", pushups: "", situps: "", notes: "" }])
    }
    setIsLoaded(true)
  }, [])

  // 2. الحفظ التلقائي في LocalStorage عند أي تغيير
  useEffect(() => {
    if (isLoaded) {
      // نحفظ الصفوف فقط بدون اسم المستخدم
      localStorage.setItem("fitness_exam_draft", JSON.stringify({ rows }))
    }
  }, [rows, isLoaded])

  // إضافة صف جديد
  const addNewRow = () => {
    setRows([...rows, { id: Date.now(), shabahaNumber: "", shabahaColor: "", pushups: "", situps: "", notes: "" }])
  }

  // حذف صف
  const deleteRow = (id: number) => {
    if (rows.length === 1) {
      toast.warning("يجب أن يحتوي الجدول على صف واحد على الأقل")
      return
    }
    setRows(rows.filter(r => r.id !== id))
  }

  // معالجة التغييرات في الإدخال (مع تحويل الأرقام)
  const handleInputChange = (id: number, field: keyof ExamEntry, value: string) => {
    let cleanValue = value;
    
    // إذا كان الحقل رقمي، نحول الأرقام ونقبل الأرقام فقط
    if (['shabahaNumber', 'pushups', 'situps'].includes(field)) {
        cleanValue = convertArToEn(value).replace(/\D/g, ''); // إزالة أي شيء ليس رقماً
    }

    setRows(prev => prev.map(row => row.id === id ? { ...row, [field]: cleanValue } : row))
  }

  // معالجة الملاحظات
  const openNoteModal = (id: number, note: string) => {
    setCurrentNoteRowId(id)
    setTempNote(note)
    setIsNoteOpen(true)
  }

  const saveNote = () => {
    if (currentNoteRowId) {
      setRows(prev => prev.map(row => row.id === currentNoteRowId ? { ...row, notes: tempNote } : row))
      setIsNoteOpen(false)
    }
  }

  // --- منطق الحفظ النهائي والربط بالباك إند ---
  const handleFinalSave = async () => {
    
    // 1. تصفية الصفوف وتجاهل الفارغة تماماً
    const rowsToSave = rows.filter(r => 
      r.shabahaNumber.trim() !== "" || 
      r.shabahaColor.trim() !== "" || 
      r.pushups.trim() !== "" || 
      r.situps.trim() !== "" || 
      r.notes.trim() !== ""
    );

    if (rowsToSave.length === 0) {
      toast.warning("الجدول فارغ، لا يوجد بيانات للحفظ");
      return;
    }

    const errors: string[] = [];
    const checkDuplicateMap = new Set<string>();

    // 2. التحقق من صحة الصفوف
    for (const row of rowsToSave) {
      const originalRowIndex = rows.findIndex(r => r.id === row.id) + 1;

      // أ. التحقق من البيانات الناقصة
      if (!row.shabahaNumber || !row.shabahaColor || !row.pushups || !row.situps) {
        errors.push(`صف رقم ${originalRowIndex}: بيانات ناقصة (يجب تعبئة الرقم، اللون، الضغط، والبطن)`);
        continue;
      }

      // ب. التحقق من التكرار
      const uniqueKey = `${row.shabahaColor}-${row.shabahaNumber}`;
      if (checkDuplicateMap.has(uniqueKey)) {
        errors.push(`صف رقم ${originalRowIndex}: تكرار الشباحة (${row.shabahaNumber} - ${getSafeColorName(row.shabahaColor)})`);
      } else {
        checkDuplicateMap.add(uniqueKey);
      }
    }

    if (errors.length > 0) {
      toast.error("لا يمكن الحفظ لوجود أخطاء", {
        description: (
          <ul className="list-disc pr-4 mt-2 max-h-32 overflow-y-auto" dir="rtl">
            {errors.map((err, idx) => <li key={idx} className="text-xs">{err}</li>)}
          </ul>
        ),
        duration: 5000,
      });
      return;
    }

    // 3. الإرسال للباك إند
    setIsSubmitting(true);
    const token = localStorage.getItem("token");

    if (!token) {
        toast.error("خطأ في المصادقة", { description: "يرجى تسجيل الدخول أولاً" });
        setIsSubmitting(false);
        return;
    }

    try {
      // تجهيز البيانات حسب هيكلية الباك إند (FieldExamSessionCreate)
      const payload = {
          entries: rowsToSave.map(r => ({
              shabahaNumber: r.shabahaNumber,
              shabahaColor: r.shabahaColor,
              pushups: r.pushups,
              situps: r.situps,
              notes: r.notes
          })),
          notes: "" // يمكن إضافة حقل ملاحظات عامة للجلسة مستقبلاً
      };

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/fitness/offline-save`, {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(payload)
      });

      if (res.ok) {
          const data = await res.json();
          toast.success("تم الحفظ بنجاح!", { 
              description: `تم ترحيل ${data.count} سجلات باسم المدرب: ${data.saved_by || 'الحالي'}` 
          });
          
          // تنظيف البيانات بعد النجاح
          localStorage.removeItem("fitness_exam_draft");
          setRows([{ id: Date.now(), shabahaNumber: "", shabahaColor: "", pushups: "", situps: "", notes: "" }]);
      } else {
          const errData = await res.json();
          toast.error("فشل الحفظ", { description: errData.detail || "حدث خطأ في السيرفر" });
      }

    } catch (error) {
      toast.error("فشل الاتصال", { description: "تأكد من اتصال الإنترنت وحاول مجدداً." });
    } finally {
        setIsSubmitting(false);
    }
  }
  
  const getSafeColorName = (val: string) => SHABAHA_COLORS.find(c => c.value === val)?.name || val;

  if (!isLoaded) return null; 

  return (
    <ProtectedRoute allowedRoles={["owner","manager","admin","assistant_admin","sports_officer","sports_supervisor", "sports_trainer"]}>
    <div className="space-y-6 pb-20 p-0.5md:p-8" dir="rtl">
      
      {/* الترويسة */}
<div className="flex flex-col md:flex-row justify-between items-start gap-4">
  <div>
    <h1 className="text-2xl font-bold flex items-center gap-2">
      <FileText className="w-6 h-6 text-blue-600" />
      تنزيل اختبار اللياقة (ميداني)
    </h1>
    
    {/* 🟢 التعديل هنا: إظهار اسم المستخدم بدلاً من جملة الاوفلاين */}
    <p className="text-slate-600 text-sm mt-2 flex items-center gap-2 bg-slate-100 w-fit px-3 py-1 rounded-full border">
       <User className="w-4 h-4 text-slate-500" />
       <span>مدخل البيانات: <span className="font-bold text-black">{displayName}</span></span>
    </p>
  </div>
  
  <div className="w-full md:w-auto">
    <Button 
      onClick={handleFinalSave} 
      disabled={isSubmitting}
      className="bg-green-600 hover:bg-green-700 text-white gap-2 w-full md:w-auto"
    >
      {isSubmitting ? "جاري الحفظ..." : <><Save className="w-4 h-4" /> حفظ وترحيل البيانات</>}
    </Button>
  </div>
</div>

      {/* منطقة الإدخال */}
      <Card className="border-t-4 border-t-blue-600 shadow-md">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#c5b391]">
                <TableRow>
                    <TableHead className="w-[50px] text-center text-black font-bold border-b border-black">#</TableHead>
                    <TableHead className="min-w-[120px] text-center text-black font-bold border-b border-black border-l border-black/20">رقم الشباحة</TableHead>
                    <TableHead className="min-w-[140px] text-center text-black font-bold border-b border-black border-l border-black/20">لون الشباحة</TableHead>
                    <TableHead className="min-w-[100px] text-center text-black font-bold border-b border-black border-l border-black/20">الضغط (تكرار)</TableHead>
                    <TableHead className="min-w-[100px] text-center text-black font-bold border-b border-black border-l border-black/20">البطن (تكرار)</TableHead>
                    <TableHead className="min-w-[100px] text-center text-black font-bold border-b border-black border-l border-black/20">ملاحظات</TableHead>
                    <TableHead className="w-[50px] text-center text-black font-bold border-b border-black">حذف</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.id}>
                  <TableCell className="text-center font-bold text-slate-500">{index + 1}</TableCell>
                  
                  {/* رقم الشباحة */}
                  <TableCell className="p-1">
                    <Input 
                      value={row.shabahaNumber}
                      onChange={(e) => handleInputChange(row.id, 'shabahaNumber', e.target.value)}
                      className="text-center h-9 font-bold text-lg focus-visible:ring-blue-500"
                      placeholder=""
                      inputMode="numeric" 
                    />
                  </TableCell>

                  {/* لون الشباحة */}
                  <TableCell className="p-1">
                    <Select value={row.shabahaColor} onValueChange={(val) => handleInputChange(row.id, 'shabahaColor', val)}>
                        <SelectTrigger className="h-9 w-full" dir="rtl">
                            <SelectValue placeholder="اختر اللون" />
                        </SelectTrigger>
                        <SelectContent>
                            {SHABAHA_COLORS.map(color => (
                                <SelectItem key={color.value} value={color.value}>
                                    <div className="flex items-center gap-2 w-full">
                                        <div className="w-4 h-4 rounded-full border shadow-sm shrink-0" style={{ backgroundColor: color.hex }}></div>
                                        <span>{color.name}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                  </TableCell>

                  {/* الضغط */}
                  <TableCell className="p-1 bg-blue-50/30">
                    <Input 
                      value={row.pushups}
                      onChange={(e) => handleInputChange(row.id, 'pushups', e.target.value)}
                      className="text-center h-9 font-bold focus-visible:ring-blue-500"
                      placeholder=""
                      inputMode="numeric"
                    />
                  </TableCell>

                  {/* البطن */}
                  <TableCell className="p-1 bg-green-50/30">
                    <Input 
                      value={row.situps}
                      onChange={(e) => handleInputChange(row.id, 'situps', e.target.value)}
                      className="text-center h-9 font-bold focus-visible:ring-green-500"
                      placeholder=""
                      inputMode="numeric"
                    />
                  </TableCell>

                  {/* الملاحظات */}
                  <TableCell className="p-1 text-center">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => openNoteModal(row.id, row.notes)}
                        className={`w-full h-9 border border-dashed ${row.notes ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : 'text-slate-400 border-slate-300'}`}
                    >
                        {row.notes ? <FileText className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </Button>
                  </TableCell>

                  {/* زر الحذف */}
                  <TableCell className="text-center p-1">
                    <Button variant="ghost" size="icon" onClick={() => deleteRow(row.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8">
                        <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* زر إضافة صف جديد */}
      <Button variant="outline" onClick={addNewRow} className="w-full py-6 border-dashed border-2 border-slate-300 text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50">
        <Plus className="w-5 h-5 mr-2" /> إضافة سجل جديد
      </Button>

      {/* نافذة الملاحظات */}
      <Dialog open={isNoteOpen} onOpenChange={setIsNoteOpen}>
        <DialogContent dir="rtl">
            <DialogHeader>
                <DialogTitle>إضافة ملاحظات</DialogTitle>
                <DialogDescription>اكتب أي ملاحظات خاصة بهذا الطالب (إعفاء، إصابة، إلخ).</DialogDescription>
            </DialogHeader>
            <Textarea 
                value={tempNote}
                onChange={(e) => setTempNote(e.target.value)}
                placeholder="اكتب هنا..."
                className="min-h-[120px] text-right"
            />
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsNoteOpen(false)}>إلغاء</Button>
                <Button onClick={saveNote}>حفظ</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
    </ProtectedRoute>
  )
}