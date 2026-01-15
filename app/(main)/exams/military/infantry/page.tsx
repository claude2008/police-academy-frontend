"use client"

import { useState, useEffect, useMemo } from "react"
import { 
  Footprints, Search, Trash2, Save, User, Loader2, 
  ShieldCheck, UserPlus, FileText, AlertTriangle, X, RotateCcw 
} from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import ProtectedRoute from "@/components/ProtectedRoute"
import { Badge } from "@/components/ui/badge"
const normalizeNumbers = (val: string) => {
  const arabicNums = "٠١٢٣٤٥٦٧٨٩"; const englishNums = "0123456789";
  return val.replace(/[٠-٩]/g, (d) => englishNums[arabicNums.indexOf(d)])
}

export default function InfantryExamsPage() {
  const [activeTab, setActiveTab] = useState("")
  const [students, setStudents] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [course, setCourse] = useState("all")
  const [batch, setBatch] = useState("all")
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedSoldier, setSelectedSoldier] = useState<any>(null)
  const [tempScores, setTempScores] = useState<Record<string, string>>({})
  const [tempNotes, setTempNotes] = useState("")
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null)
  const [examConfigs, setExamConfigs] = useState<any[]>([])
  const [activeConfig, setActiveConfig] = useState<any>(null)
  const [company, setCompany] = useState("all")
const [platoon, setPlatoon] = useState("all")
  // 1. 🔑 تخزين الخيارات الحقيقية (الدورة وما يتبعها من دفعات)
  // سنفترض أن الباك إند يرسل مصفوفة من الجنود لاستخراج العلاقات بينهم
  const [rawSoldiersData, setRawSoldiersData] = useState<any[]>([]);

  // 2. استخراج الدورات والدفعات بشكل "مرتبط" ذكي
  // 1. استخراج الدورات مع تنظيفها من القيم الفارغة
const coursesList = useMemo(() => {
  return Array.from(new Set(rawSoldiersData.map(s => s.course)))
    .filter(c => c && c.trim() !== ""); // 👈 هذا السطر يحذف أي دورة فارغة
}, [rawSoldiersData]);

// 2. استخراج الدفعات مع تنظيفها من القيم الفارغة
const availableBatches = useMemo(() => {
  let filtered = rawSoldiersData;
  if (course !== "all") {
    filtered = rawSoldiersData.filter(s => s.course === course);
  }
  return Array.from(new Set(filtered.map(s => s.batch)))
    .filter(b => b && b.trim() !== ""); // 👈 هذا السطر يحذف أي دفعة فارغة
}, [course, rawSoldiersData]);

  // 3. الفلترة الذكية للجدول
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchCourse = course === "all" || s.course === course;
      const matchBatch = batch === "all" || s.batch === batch;
      return matchCourse && matchBatch;
    });
  }, [students, course, batch]);

  const maxTotalScore = useMemo(() => {
    return activeConfig?.criteria.reduce((sum: number, c: any) => sum + c.max, 0) || 0;
  }, [activeConfig]);

  useEffect(() => {
    const initPage = async () => {
      try {
        const headers = { "Authorization": `Bearer ${localStorage.getItem("token")}` };
        const resConfig = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/configs?subject=infantry`, { headers });
        if (resConfig.ok) {
          const data = await resConfig.json();
          setExamConfigs(data);
          if (data.length > 0) { setActiveTab(data[0].exam_type); setActiveConfig(data[0]); }
        }
        
        // جلب كل الجنود لبناء قوائم الفرز المرتبطة
        const resSoldiers = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/?limit=1000`, { headers });
        if (resSoldiers.ok) {
          const data = await resSoldiers.json();
          setRawSoldiersData(data.data);
        }
      } catch (e) { toast.error("فشل جلب البيانات"); }
    };
    initPage();
  }, []);

  useEffect(() => {
    const config = examConfigs.find(c => c.exam_type === activeTab);
    if (config) {
      setActiveConfig(config);
      const saved = localStorage.getItem(`infantry_${activeTab}`);
      if (saved) setStudents(JSON.parse(saved)); else setStudents([]);
    }
  }, [activeTab, examConfigs]);

  // عند تغيير الدورة، نصفر الدفعة لضمان عدم وجود دفعة لا تنتمي لهذه الدورة
  const handleCourseChange = (newCourse: string) => {
    setCourse(newCourse);
    setBatch("all");
  };

  const handleSearch = async () => {
    const cleanQuery = normalizeNumbers(searchQuery).trim()
    if (!cleanQuery) return;
    if (students.find(s => s.military_id === cleanQuery)) return toast.error("مضاف مسبقاً");

    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/?search=${cleanQuery}`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      const data = await res.json();
      if (data.data?.[0]) {
        setSelectedSoldier(data.data[0]); setTempScores({}); setTempNotes(""); setIsModalOpen(true);
      } else { toast.error("الجندي غير موجود"); }
    } finally { setLoading(false); }
  };

 const confirmAddition = () => {
    if (!activeConfig || !selectedSoldier) return;

    const currentCriteria = activeConfig.criteria;
    const finalScores: Record<string, number> = {};
    let total = 0;

    // 1. حساب عدد المعايير التي تم إدخال قيم لها فعلياً (تصفية الخانات الفارغة)
    const enteredValuesCount = Object.keys(tempScores).filter(key => tempScores[key] !== "").length;
    const allCriteriaFilled = enteredValuesCount === currentCriteria.length;
    const hasNote = tempNotes.trim().length > 0;

    // 2. التحقق من الشرط: (لا توجد ملاحظة) و (المعايير ناقصة)
    if (!hasNote && !allCriteriaFilled) {
        return toast.error("يرجى إكمال رصد جميع المعايير أو كتابة ملاحظة (عذر، إصابة، طبية...)");
    }

    // 3. معالجة الدرجات بناءً على الحالة
    for (const crit of currentCriteria) {
        const rawVal = tempScores[crit.name];

        // إذا كان هناك ملاحظة والمعيار فارغ، نعتبر الدرجة 0 ولا نعطل العملية
        if (hasNote && (rawVal === "" || rawVal === undefined)) {
            finalScores[crit.name] = 0;
        } else {
            const val = parseFloat(normalizeNumbers(rawVal || "0"));
            if (val > crit.max) {
                return toast.error(`تجاوزت الحد الأقصى في ${crit.name}`);
            }
            finalScores[crit.name] = val;
            total += val;
        }
    }

    // 4. التحديد التلقائي للدورة والفصيل عند إضافة أول جندي
    if (students.length === 0) {
        setCourse(selectedSoldier.course);
        setBatch(selectedSoldier.batch);
        setCompany(selectedSoldier.company);
        setPlatoon(selectedSoldier.platoon);
    }

    // 5. تحديث القائمة وحفظها في التخزين المؤقت الخاص بالمشاة
    const updated = [...students, { ...selectedSoldier, scores: finalScores, total, notes: tempNotes }];
    setStudents(updated);
    
    // 🔑 التأكد من البادئة infantry_
    localStorage.setItem(`infantry_${activeTab}`, JSON.stringify(updated));
    
    // 6. إغلاق النافذة وتصفير البحث
    setIsModalOpen(false);
    setSearchQuery("");
};

 const handleFinalSave = async () => {
    // 1. الحماية الأولية (تم تعديلها لتسمح بالحفظ طالما يوجد طلاب في الجدول)
    if (students.length === 0) {
        return toast.error("الجدول فارغ أو لا توجد بيانات للرصد");
    }

    setLoading(true);
    try {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const formattedDate = new Date().toISOString().split('T')[0];

        // 🧠 المنطق الذكي لتحديد السرية والفصيل للسجل
        // نستخدم أول طالب كمرجع للقيم الافتراضية للرأس (Header)
        const firstStudent = students[0];
        const isUnifiedCompany = students.every(s => s.company === firstStudent.company);
        const isUnifiedPlatoon = students.every(s => s.platoon === firstStudent.platoon);

        // ✅ تعريف الـ payload أولاً (محدث لدعم الفرز الآلي في الباك إند)
        const payload = {
            config_id: activeConfig.id,
            title: `${activeConfig.exam_type} - ${formattedDate}`,
            exam_date: formattedDate,
            // 🟢 نرسل وسم المزامنة المختلطة لكي يقوم الباك إند بالفرز بناءً على بيانات كل طالب
            course: "mixed_sync",
            batch: "mixed_sync",
            // إذا كانت البيانات مختلطة نكتب "متعدد"، وإذا كانت موحدة نكتب اسم السرية/الفصيل
            company: isUnifiedCompany ? firstStudent.company : "متعدد",
            platoon: isUnifiedPlatoon ? firstStudent.platoon : "متعدد",
            
            // 🟢 إرسال بيانات الطلاب كاملة (بما فيها الدورة والدفعة الخاصة بكل فرد)
            students_data: students.map((s: any) => ({
                military_id: s.military_id,
                name: s.name,
                rank: s.rank,
                // حقن البيانات الأصلية للطالب لضمان فرزها في السجل الصحيح
                course: s.course,
                batch: s.batch,
                company: s.company,
                platoon: s.platoon,
                scores: s.scores,
                total: s.total,
                notes: s.notes
            }))
        };

        // 📡 الآن نقوم بالإرسال باستخدام الـ payload المعرف أعلاه
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/records`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}` 
            },
            body: JSON.stringify(payload) // هنا يتم استخدام المتغير
        });

        if (res.ok) {
            toast.success("تم ترحيل بيانات المشاة وحفظها بنجاح");
            setStudents([]); // مسح الجدول بعد النجاح
            localStorage.removeItem(`infantry_${activeTab}`); // مسح التخزين المؤقت
        } else {
            const errData = await res.json();
            toast.error(errData.detail || "فشل الحفظ في السيرفر");
        }
    } catch (e) {
        toast.error("خطأ في الاتصال بالشبكة");
        console.error(e);
    } finally {
        setLoading(false);
    }
};

  return (
<ProtectedRoute allowedRoles={["owner","manager","admin","military_officer","military_supervisor", "military_trainer"]}>
    <div className="space-y-4"  dir="rtl">
      {/* الرأس */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-3 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg text-white"><Footprints className="w-6 h-6" /></div>
            <h2 className="text-xl font-bold">  اختبارات المشاة</h2>
        </div>
        <Button onClick={handleFinalSave} disabled={loading} className="bg-green-700 hover:bg-green-800 text-white font-bold gap-2 px-6">
          {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />} حفظ 
        </Button>
      </div>

      
      <Card className="bg-slate-50 border-dashed border-2 p-3 flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
            <Input placeholder="الرقم العسكري للمجند..." className="pr-9 h-11 bg-white shadow-sm" value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&handleSearch()} />
        </div>
        <Button onClick={handleSearch} disabled={loading} className="w-full md:w-auto h-11 px-8 bg-[#c5b391] hover:bg-[#b4a280] text-slate-900 font-bold gap-2">
            <UserPlus className="w-4 h-4" /> إضافة مختبر
        </Button>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-200 dark:bg-slate-800 mb-4 p-1 rounded-xl w-full flex h-auto flex-wrap">
          {examConfigs.map((config) => (
            <TabsTrigger key={config.id} value={config.exam_type} className="flex-1 py-2 font-bold data-[state=active]:bg-[#0f172a] data-[state=active]:text-[#c5b391]">
              {config.exam_type}
            </TabsTrigger>
          ))}
        </TabsList>
        
        <Card className="shadow-lg border-0 overflow-hidden">
          <div className="overflow-x-auto" dir="rtl"> 
            <Table>
              <TableHeader>
                <TableRow className="bg-[#c5b391] hover:bg-[#c5b391]">
                  <TableHead className="text-slate-900 text-center w-10 font-bold">#</TableHead>
                  <TableHead className="text-slate-900 font-bold text-center w-14">الصورة</TableHead>
                  <TableHead className="text-slate-900 text-right font-bold">الرتبة والاسم</TableHead>
                  <TableHead className="text-slate-900 text-center font-bold">الرقم</TableHead>
                  <TableHead className="text-slate-900 font-bold text-center">السرية / الفصيل</TableHead>
                  {activeConfig?.criteria.map((c: any) => (
                    <TableHead key={c.name} className="text-slate-900 text-center font-bold">
                        <div className="flex flex-col text-[10px] items-center"><span>{c.name}</span><span className="opacity-70">({c.max})</span></div>
                    </TableHead>
                  ))}
                  {/* 👇 عرض المجموع الكلي الأقصى تحت عنوان العمود (طلبك الثالث) */}
                  <TableHead className="text-slate-900 text-center font-bold bg-[#b4a280]">
                    <div className="flex flex-col text-[10px] items-center"><span>المجموع</span><span className="text-red-900 font-black">({maxTotalScore})</span></div>
                  </TableHead>
                  <TableHead className="text-slate-900 text-right font-bold">ملاحظات</TableHead>
                  <TableHead className="no-print w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white dark:bg-slate-900">
                {students.map((s, i) => (
                  <TableRow key={s.military_id} className="hover:bg-slate-50">
                    <TableCell className="text-center text-xs text-slate-400">{i + 1}</TableCell>
                    <TableCell>
  <div className="w-10 h-10 rounded-full border bg-slate-100 overflow-hidden mx-auto">
    <img 
      // 🟢 نستخدم الرابط السحابي image_url وإذا لم يوجد نستخدم البديل من البداية
      src={s.image_url ? `${s.image_url}?t=${new Date().getTime()}` : "/placeholder-user.png"} 
      className="w-full h-full object-cover" 
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        // 🛑 إذا كان الخطأ أصلاً في الصورة البديلة، توقف تماماً
        if (target.src.includes("placeholder-user.png")) return; 
        
        // إذا فشلت الصورة الأصلية، استبدلها بالبديلة الموجودة في public
        target.src = "/placeholder-user.png"; 
      }} 
    />
  </div>
</TableCell>
                    <TableCell className="text-right"><div className="flex flex-col"><span className="text-[10px] text-blue-600 font-medium">{s.rank}</span><span className="font-bold text-sm text-slate-800">{s.name}</span></div></TableCell>
                    <TableCell className="text-center font-mono font-bold text-blue-800">{s.military_id}</TableCell>
                    <TableCell className="text-center text-xs text-slate-500">{s.company} / {s.platoon}</TableCell>
                    {activeConfig?.criteria.map((c: any) => (<TableCell key={c.name} className="text-center font-bold text-slate-700">{s.scores[c.name] || 0}</TableCell>))}
                    <TableCell className="text-center font-black bg-slate-50/50 text-blue-700 border-x">{s.total}</TableCell>
                    <TableCell className="text-right text-[10px] text-slate-500 max-w-[150px] truncate">{s.notes || "-"}</TableCell>
                    <TableCell className="no-print"><Button variant="ghost" size="icon" onClick={()=>setDeleteIdx(i)} className="text-red-400"><Trash2 className="w-4 h-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </Tabs>

      {/* نافذة الرصد */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto pb-24 md:pb-30" dir="rtl" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle className="flex gap-2 text-blue-600 border-b pb-2"><Footprints />  درجات المشاة</DialogTitle></DialogHeader>
          {selectedSoldier && (
            <div className="space-y-4 pt-2">
             <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-blue-200">
    <div className="w-16 h-16 rounded-full border-2 border-blue-500 overflow-hidden bg-white shadow-sm">
        <img 
  src={selectedSoldier.image_url ? `${selectedSoldier.image_url}?t=${new Date().getTime()}` : "/placeholder-user.png"} 
  className="w-full h-full object-cover"
  onError={(e) => {
    const target = e.target as HTMLImageElement;
    if (target.src.includes("placeholder-user.png")) return; 
    target.src = "/placeholder-user.png"; 
  }}
/>
    </div>
    <div className="flex flex-col flex-1">
        <h4 className="font-bold text-slate-900">{selectedSoldier.name}</h4>
        <div className="flex gap-2 text-[10px] mt-1">
            <Badge className="bg-blue-700">{selectedSoldier.rank}</Badge>
            <Badge variant="outline">{selectedSoldier.military_id}</Badge>
        </div>
        
        {/* إظهار الدورة والدفعة للتأكيد اللحظي */}
        <div className="text-[11px] text-blue-800 font-black mt-2 bg-blue-50 p-1.5 rounded border border-blue-100">
            📌 {selectedSoldier.course} {selectedSoldier.batch ? `- الدفعة ${selectedSoldier.batch}` : ""}
        </div>
        <div className="text-[10px] text-slate-500 font-bold mt-1">
            السرية: {selectedSoldier.company} | الفصيل: {selectedSoldier.platoon}
        </div>
    </div>
</div>
              <div className="space-y-2 border-t pt-4">
                {activeConfig?.criteria.map((c: any) => (
                  <div key={c.name} className="flex items-center justify-between p-2 hover:bg-slate-50 border-b">
                    <div className="flex flex-col"><span className="text-xs font-bold">{c.name}</span><span className="text-[10px] text-red-500 font-mono">الأقصى: {c.max}</span></div>
                    <div className="relative w-24"><Input type="text" inputMode="decimal" className="text-center font-bold font-mono h-9" value={tempScores[c.name] || ""} onChange={(e) => { const v = normalizeNumbers(e.target.value); if(parseFloat(v) <= c.max || v === "") setTempScores({...tempScores, [c.name]: v}) }} /><span className="absolute left-1 top-2.5 text-[8px] text-slate-300">/{c.max}</span></div>
                  </div>
                ))}
              </div>
              <Input placeholder="ملاحظات..." className="h-10 text-xs shadow-sm" value={tempNotes} onChange={(e)=>setTempNotes(e.target.value)} />
              <div className="flex gap-2 pt-2"><Button variant="outline" className="flex-1 font-bold" onClick={() => setIsModalOpen(false)}>إلغاء</Button><Button onClick={confirmAddition} className="flex-[2] bg-blue-600 text-white font-extrabold h-11 shadow-md">تأكيد </Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteIdx !== null} onOpenChange={() => setDeleteIdx(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle /> تنبيه حذف</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogDescription className="text-right">سيتم حذف الطالب من الجدول الحالي فقط، هل أنت متأكد؟</AlertDialogDescription>
          <AlertDialogFooter className="flex-row-reverse gap-2 pt-4"><AlertDialogCancel>تراجع</AlertDialogCancel><AlertDialogAction onClick={() => { if(deleteIdx!==null){ const u=[...students]; u.splice(deleteIdx,1); setStudents(u); localStorage.setItem(`infantry_${activeTab}`, JSON.stringify(u)); setDeleteIdx(null) } }} className="bg-red-600">نعم، احذف</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
</ProtectedRoute>
  )
}