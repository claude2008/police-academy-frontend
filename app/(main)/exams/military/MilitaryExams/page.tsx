"use client"

import { useState, useEffect, useMemo } from "react"
import { 
  Target, Search, Trash2, Save, User, Loader2, 
  ShieldCheck, UserPlus, FileText, AlertTriangle, Filter, ChevronDown
} from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import ProtectedRoute from "@/components/ProtectedRoute"
import { Badge } from "@/components/ui/badge"

const normalizeNumbers = (val: string) => {
  const arabicNums = "٠١٢٣٤٥٦٧٨٩"; const englishNums = "0123456789";
  return val.replace(/[٠-٩]/g, (d) => englishNums[arabicNums.indexOf(d)])
}

type StudentRecord = {
  military_id: string;
  name: string;
  rank: string;
  company: string;
  platoon: string;
  course: string;
  batch: string;
  scores: Record<string, number>;
  total: number;
  notes: string;
  image_url?: string;
}

export default function MilitaryExamsPage() {
  // 1. حالات الاختيار الرئيسية (القسم والاختبار)
  const [selectedSectionKey, setSelectedSectionKey] = useState<string>("")
  const [selectedExamId, setSelectedExamId] = useState<string>("")
  
  // بيانات النظام (تُجلب من الباك إند)
  const [militarySections, setMilitarySections] = useState<any[]>([])
  const [allExamConfigs, setAllExamConfigs] = useState<any[]>([])
  
  // حالات الجدول والرصد (نفس منطق الرماية)
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedSoldier, setSelectedSoldier] = useState<any>(null)
  const [tempScores, setTempScores] = useState<Record<string, string>>({})
  const [tempNotes, setTempNotes] = useState("")
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null)

  // 1. جلب البيانات الأولية (الأقسام + الاختبارات)
  useEffect(() => {
    const initPage = async () => {
      try {
        const headers = { "Authorization": `Bearer ${localStorage.getItem("token")}` };
        
        // جلب الأقسام (رماية، مشاة..)
        const resSections = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/military-sections`, { headers });
        if (resSections.ok) setMilitarySections(await resSections.json());

        // جلب كل الاختبارات مرة واحدة لتسريع التنقل
        const resConfigs = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/configs`, { headers });
        if (resConfigs.ok) setAllExamConfigs(await resConfigs.json());

      } catch (e) { toast.error("فشل جلب إعدادات الاختبارات"); }
    };
    initPage();
  }, []);

  // 2. تصفية الاختبارات بناءً على القسم المختار
  const filteredExams = useMemo(() => {
    if (!selectedSectionKey) return [];
    return allExamConfigs.filter(conf => conf.subject === selectedSectionKey);
  }, [selectedSectionKey, allExamConfigs]);

  // 3. تحديد الاختبار النشط (Active Config)
  const activeConfig = useMemo(() => {
    return allExamConfigs.find(c => c.id.toString() === selectedExamId);
  }, [selectedExamId, allExamConfigs]);

  // 4. استرجاع البيانات المحفوظة محلياً عند تغيير الاختبار
  useEffect(() => {
    if (selectedExamId) {
      const saved = localStorage.getItem(`exam_draft_${selectedExamId}`);
      if (saved) setStudents(JSON.parse(saved)); else setStudents([]);
    } else {
      setStudents([]);
    }
  }, [selectedExamId]);

  // 5. حساب المجموع الأقصى (للعرض في الجدول)
  const maxTotalScore = useMemo(() => {
    return activeConfig?.criteria.reduce((sum: number, c: any) => sum + c.max, 0) || 0;
  }, [activeConfig]);

  // --- دوال البحث والإضافة (نسخة طبق الأصل من الرماية) ---
  const handleSearch = async () => {
    if (!selectedExamId) return toast.error("يرجى اختيار نوع الاختبار أولاً");
    
    const cleanQuery = normalizeNumbers(searchQuery).trim();
    if (!cleanQuery) return;
    if (students.find(s => s.military_id === cleanQuery)) return toast.error("هذا المختبر مضاف بالفعل");

    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/?search=${cleanQuery}`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      const data = await res.json();
      if (data.data?.[0]) {
        setSelectedSoldier(data.data[0]); setTempScores({}); setTempNotes(""); setIsModalOpen(true);
      } else { toast.error("لم يتم العثور على جندي"); }
    } finally { setLoading(false); }
  };

  const confirmAddition = () => {
    if (!activeConfig || !selectedSoldier) return;
    
    const currentCriteria = activeConfig.criteria;
    const finalScores: Record<string, number> = {};
    let total = 0;
    
    // التحقق من الإدخال
    const enteredValuesCount = Object.keys(tempScores).filter(key => tempScores[key] !== "").length;
    const allCriteriaFilled = enteredValuesCount === currentCriteria.length;
    const hasNote = tempNotes.trim().length > 0;

    if (!hasNote && !allCriteriaFilled) {
        return toast.error("يرجى إكمال رصد جميع المعايير أو كتابة ملاحظة");
    }

    for (const crit of currentCriteria) {
        const rawVal = tempScores[crit.name];
        if (hasNote && (rawVal === "" || rawVal === undefined)) {
            finalScores[crit.name] = 0; 
        } else {
            const val = parseFloat(normalizeNumbers(rawVal || "0"));
            if (val > crit.max) return toast.error(`تجاوزت الحد في ${crit.name}`);
            finalScores[crit.name] = val; 
            total += val;
        }
    }

    const updated = [...students, { ...selectedSoldier, scores: finalScores, total, notes: tempNotes }];
    setStudents(updated);
    localStorage.setItem(`exam_draft_${selectedExamId}`, JSON.stringify(updated));
    setIsModalOpen(false); 
    setSearchQuery("");
  };

  const handleFinalSave = async () => {
    if (students.length === 0) return toast.error("الجدول فارغ");
    if (!activeConfig) return;

    setLoading(true);
    try {
        const formattedDate = new Date().toISOString().split('T')[0];
        
        // تجهيز الـ Payload بنفس الهيكل الموحد
        const payload = {
            config_id: activeConfig.id,
            title: `${activeConfig.exam_type} - ${formattedDate}`,
            exam_date: formattedDate,
            course: "mixed_sync", // سيتم الفرز في الباك إند
            batch: "mixed_sync",
            company: "متعدد",
            platoon: "متعدد",
            students_data: students.map((s) => ({
                military_id: s.military_id,
                name: s.name,
                rank: s.rank,
                course: s.course, 
                batch: s.batch,   
                company: s.company,
                platoon: s.platoon,
                scores: s.scores,
                total: s.total,
                notes: s.notes
            }))
        };

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/records`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}` 
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            toast.success("تم الحفظ بنجاح ✅");
            setStudents([]); 
            localStorage.removeItem(`exam_draft_${selectedExamId}`);
        } else {
            const errData = await res.json();
            toast.error(errData.detail || "فشل الحفظ");
        }
    } catch (e) { toast.error("خطأ في الاتصال"); } 
    finally { setLoading(false); }
  };

  return (
    <ProtectedRoute allowedRoles={["owner","manager","admin","military_officer","military_supervisor", "military_trainer"]}>
    <div className="space-y-6 pb-20" dir="rtl">
      
      {/* 1. منطقة الاختيار العلوية (القسم والاختبار) */}
      <Card className="bg-white dark:bg-slate-900 border-t-4 border-t-[#c5b391] shadow-md">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* اختيار القسم */}
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-600">اختر القسم التدريبي</Label>
              <Select value={selectedSectionKey} onValueChange={(val) => {
                  setSelectedSectionKey(val);
                  setSelectedExamId(""); // تصفير الاختبار عند تغيير القسم
              }}>
                <SelectTrigger className="h-12 bg-slate-50 border-slate-200 text-lg font-bold">
                  <SelectValue placeholder="-- اختر القسم --" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {militarySections.map(sec => (
                    <SelectItem key={sec.id} value={sec.key} className="text-right font-bold focus:bg-[#c5b391]/20">
                      {sec.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* اختيار الاختبار (يظهر فقط بعد اختيار القسم) */}
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-600">اختر نوع الاختبار</Label>
              <Select value={selectedExamId} onValueChange={setSelectedExamId} disabled={!selectedSectionKey}>
                <SelectTrigger className="h-12 bg-slate-50 border-slate-200 text-lg font-bold">
                  <SelectValue placeholder={selectedSectionKey ? "-- اختر الاختبار --" : "يرجى اختيار القسم أولاً"} />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {filteredExams.map(exam => (
                    <SelectItem key={exam.id} value={exam.id.toString()} className="text-right font-bold focus:bg-[#c5b391]/20">
                      {exam.exam_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* 2. منطقة العمل (تظهر فقط عند اختيار اختبار) */}
      {activeConfig ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* شريط الأدوات (بحث + حفظ) */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
                <div className="relative w-full md:w-1/2">
                    <Search className="absolute right-3 top-3 w-5 h-5 text-slate-400" />
                    <Input 
                        placeholder="البحث بالرقم العسكري لإضافة طالب..." 
                        className="bg-slate-50 pr-10 h-11 text-lg"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <Button onClick={handleSearch} className="flex-1 md:w-auto bg-[#c5b391] hover:bg-[#b4a280] text-slate-900 font-bold h-11 gap-2">
                        <UserPlus className="w-5 h-5" /> إضافة
                    </Button>
                    <Button onClick={handleFinalSave} disabled={loading || students.length===0} className="flex-1 md:w-auto bg-green-700 hover:bg-green-800 text-white font-bold h-11 gap-2 shadow-lg">
                        {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                        حفظ النتائج
                    </Button>
                </div>
            </div>

            {/* الجدول (نفس تصميم الرماية تماماً) */}
            <Card className="border-0 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-[#c5b391] hover:bg-[#c5b391]">
                                <TableHead className="text-slate-900 font-bold text-center w-10">#</TableHead>
                                <TableHead className="text-slate-900 font-bold text-center w-14">الصورة</TableHead>
                                <TableHead className="text-slate-900 font-bold text-right">البيانات الشخصية</TableHead>
                                <TableHead className="text-slate-900 font-bold text-center">الموقع</TableHead>
                                {/* توليد الأعمدة ديناميكياً بناءً على معايير الاختبار المختار */}
                                {activeConfig.criteria.map((c: any) => (
                                    <TableHead key={c.name} className="text-slate-900 font-bold text-center bg-[#bfa87e]">
                                        <div className="flex flex-col text-[10px] items-center">
                                            <span>{c.name}</span>
                                            <span className="opacity-70">({c.max})</span>
                                        </div>
                                    </TableHead>
                                ))}
                                <TableHead className="text-slate-900 font-bold text-center bg-[#b4a280] w-20">
                                    <div className="flex flex-col text-[10px] items-center">
                                        <span>المجموع</span>
                                        <span className="text-red-900 font-black">({maxTotalScore})</span>
                                    </div>
                                </TableHead>
                                <TableHead className="text-slate-900 font-bold text-right">ملاحظات</TableHead>
                                <TableHead className="w-10"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="bg-white">
                            {students.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={10} className="h-40 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <FileText className="w-10 h-10 opacity-20" />
                                            <p>لا توجد بيانات.. ابدأ بالبحث لإضافة طلاب</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                students.map((s, i) => (
                                    <TableRow key={s.military_id} className="hover:bg-slate-50 transition-colors">
                                        <TableCell className="text-center font-mono text-xs text-slate-400">{i+1}</TableCell>
                                        <TableCell>
                                            <div className="w-10 h-10 rounded-full border bg-slate-100 overflow-hidden mx-auto">
                                                <img 
                                                    src={s.image_url ? `${s.image_url}?t=${Date.now()}` : "/placeholder-user.png"} 
                                                    className="w-full h-full object-cover" 
                                                    onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-user.png" }}
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm text-slate-800">{s.name}</span>
                                                <div className="flex gap-2 mt-1">
                                                    <Badge variant="outline" className="text-[10px] px-1 h-5">{s.rank}</Badge>
                                                    <span className="font-mono text-xs text-blue-700 font-bold">{s.military_id}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center text-xs text-slate-500">
                                            <div className="flex flex-col items-center gap-1">
                                                <span>{s.company}</span>
                                                <span className="text-[10px] opacity-70">{s.platoon}</span>
                                            </div>
                                        </TableCell>
                                        {/* درجات المعايير */}
                                        {activeConfig.criteria.map((c: any) => (
                                            <TableCell key={c.name} className="text-center font-bold text-slate-700 bg-slate-50/30">
                                                {s.scores[c.name] || 0}
                                            </TableCell>
                                        ))}
                                        {/* المجموع */}
                                        <TableCell className="text-center font-black text-blue-800 bg-blue-50/50 border-x border-blue-100 text-lg">
                                            {s.total}
                                        </TableCell>
                                        <TableCell className="text-right text-xs text-slate-500 max-w-[150px] truncate">
                                            {s.notes || "-"}
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" onClick={() => setDeleteIdx(i)} className="text-red-400 hover:text-red-600 hover:bg-red-50">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
            <Target className="w-16 h-16 text-slate-300 mb-4" />
            <p className="text-slate-500 font-bold text-lg">يرجى اختيار القسم والاختبار للبدء</p>
            <p className="text-slate-400 text-sm">ستظهر لوحة الرصد فور التحديد</p>
        </div>
      )}

     {/* نافذة الرصد (نسخة طبق الأصل من التصميم القديم الذي تفضله) */}
<Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
  <DialogContent 
    className="max-w-md max-h-[90vh] overflow-y-auto pb-24 md:pb-30" 
    dir="rtl" 
    onPointerDownOutside={(e) => e.preventDefault()}
    onEscapeKeyDown={(e) => e.preventDefault()}
  >
    <DialogHeader>
      <DialogTitle className="flex gap-2 text-[#c5b391] border-b pb-2 font-black">
        <FileText /> درجات الاختبار
      </DialogTitle>
    </DialogHeader>

    {selectedSoldier && (
      <div className="space-y-4 pt-2">
        
        {/* 1. بطاقة بيانات الجندي */}
        <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-[#c5b391]/30 shadow-inner">
          <div className="w-16 h-16 rounded-full border-2 border-[#c5b391] relative overflow-hidden bg-white shadow-md shrink-0">
            <img 
              src={selectedSoldier.image_url ? `${selectedSoldier.image_url}?t=${new Date().getTime()}` : "/placeholder-user.png"} 
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-user.png" }}
            />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <h4 className="font-bold text-slate-900 truncate">{selectedSoldier.name}</h4>
            <div className="flex gap-2 text-[10px] mt-1">
                <Badge className="bg-blue-700">{selectedSoldier.rank}</Badge>
                <Badge variant="outline" className="font-mono">{selectedSoldier.military_id}</Badge>
            </div>
            
            <div className="text-[11px] text-[#8a7a5b] font-black mt-2 bg-amber-50 p-1.5 rounded border border-amber-100">
                📌 {selectedSoldier.course} {selectedSoldier.batch ? `- الدفعة ${selectedSoldier.batch}` : ""}
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 mt-1">
              <span className="text-orange-700 font-bold border-r pr-2">السرية: {selectedSoldier.company}</span>
              <span className="text-orange-700 font-bold">الفصيل: {selectedSoldier.platoon}</span>
            </div>
          </div>
        </div>

        {/* 2. قائمة المعايير (بدون سكرول داخلي - تتحرك مع النافذة) */}
        <div className="space-y-2 border-t pt-4">
          {activeConfig?.criteria.map((c: any) => (
            <div key={c.name} className="flex items-center justify-between p-2 hover:bg-slate-50 border-b">
              <div className="flex flex-col text-right">
                <span className="text-xs font-bold text-slate-700">{c.name}</span>
                <span className="text-[10px] text-red-500 font-mono">الأقصى: {c.max}</span>
              </div>
              <div className="relative w-24">
                <Input 
                  type="text" 
                  inputMode="decimal" 
                  className="text-center font-bold font-mono h-9 border-[#c5b391]/30 focus:ring-[#c5b391] rounded-md" 
                  value={tempScores[c.name] || ""} 
                  onChange={(e) => {
                    const v = normalizeNumbers(e.target.value); 
                    if(v === "" || (parseFloat(v) <= c.max && !isNaN(Number(v)))) {
                      setTempScores({...tempScores, [c.name]: v})
                    }
                  }} 
                />
                <span className="absolute left-1 top-2.5 text-[9px] text-slate-300 font-bold">/{c.max}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 3. الملاحظات والأزرار */}
        <div className="space-y-4">
          <Input 
            placeholder="ملاحظات إضافية..." 
            className="h-11 text-xs shadow-sm border-[#c5b391]/20 rounded-lg" 
            value={tempNotes} 
            onChange={(e)=>setTempNotes(e.target.value)} 
          />
          
          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              className="flex-1 font-bold h-11 border-slate-200" 
              onClick={() => setIsModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button 
              onClick={confirmAddition} 
              className="flex-[2] bg-[#0f172a] text-[#c5b391] font-extrabold h-11 text-lg shadow-lg active:scale-95 transition-transform"
            >
              تأكيد ورصد الدرجة
            </Button>
          </div>
        </div>

      </div>
    )}
  </DialogContent>
</Dialog>

      {/* نافذة الحذف */}
      <AlertDialog open={deleteIdx !== null} onOpenChange={() => setDeleteIdx(null)}>
        <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
                <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" /> حذف السجل
                </AlertDialogTitle>
            </AlertDialogHeader>
            <p className="text-slate-600 text-right">هل أنت متأكد من حذف هذا الطالب من القائمة الحالية؟</p>
            <AlertDialogFooter className="flex-row-reverse gap-2">
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={() => {
                    if(deleteIdx !== null) {
                        const u = [...students]; u.splice(deleteIdx, 1); setStudents(u);
                        localStorage.setItem(`exam_draft_${selectedExamId}`, JSON.stringify(u));
                        setDeleteIdx(null);
                    }
                }} className="bg-red-600 hover:bg-red-700">حذف</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
    </ProtectedRoute>
  )
}