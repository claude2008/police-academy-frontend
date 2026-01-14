"use client"

import { useState, useEffect, useMemo } from "react"
import { 
  Target, Search, Trash2, Save, User, Loader2, 
  ShieldCheck, UserPlus, FileText, AlertTriangle, RotateCcw 
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
const normalizeNumbers = (val: string) => {
  const arabicNums = "٠١٢٣٤٥٦٧٨٩"; const englishNums = "0123456789";
  return val.replace(/[٠-٩]/g, (d) => englishNums[arabicNums.indexOf(d)])
}

type ShootingStudent = {
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
}

export default function ShootingExamsPage() {
  const [activeTab, setActiveTab] = useState("") 
  const [students, setStudents] = useState<ShootingStudent[]>([])
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
  // 1. 🔑 تخزين بيانات الجنود لبناء الفرز المرتبط
  const [rawSoldiersData, setRawSoldiersData] = useState<any[]>([]);

  // 2. 🔍 استخراج القوائم المرتبطة والمنظفة من الفراغات (حل مشكلة الخطأ)
  const coursesList = useMemo(() => {
    return Array.from(new Set(rawSoldiersData.map(s => s.course)))
      .filter(c => c && c.trim() !== "");
  }, [rawSoldiersData]);

  const availableBatches = useMemo(() => {
    let filtered = rawSoldiersData;
    if (course !== "all") {
      filtered = rawSoldiersData.filter(s => s.course === course);
    }
    return Array.from(new Set(filtered.map(s => s.batch)))
      .filter(b => b && b.trim() !== "");
  }, [course, rawSoldiersData]);

  // 3. 🔍 الفلترة اللحظية للجدول حسب اختيار الدورة والدفعة
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchCourse = course === "all" || s.course === course;
      const matchBatch = batch === "all" || s.batch === batch;
      return matchCourse && matchBatch;
    });
  }, [students, course, batch]);

  // 4. 🧮 حساب المجموع الكلي الأقصى لعرضه في رأس الجدول
  const maxTotalScore = useMemo(() => {
    return activeConfig?.criteria.reduce((sum: number, c: any) => sum + c.max, 0) || 0;
  }, [activeConfig]);

  useEffect(() => {
    const initPage = async () => {
      try {
        const headers = { "Authorization": `Bearer ${localStorage.getItem("token")}` };
        
        // جلب إعدادات الرماية
        const resConfig = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/configs?subject=shooting`, { headers });
        if (resConfig.ok) {
          const data = await resConfig.json();
          setExamConfigs(data);
          if (data.length > 0) {
            setActiveTab(data[0].exam_type);
            setActiveConfig(data[0]);
          }
        }

        // جلب بيانات الجنود لبناء فلاتر دقيقة
        const resSoldiers = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/?limit=1000`, { headers });
        if (resSoldiers.ok) {
          const data = await resSoldiers.json();
          setRawSoldiersData(data.data);
        }
      } catch (e) { toast.error("فشل جلب البيانات الأساسية"); }
    };
    initPage();
  }, []);

  useEffect(() => {
    const config = examConfigs.find(c => c.exam_type === activeTab);
    if (config) {
      setActiveConfig(config);
      const saved = localStorage.getItem(`shooting_${activeTab}`);
      if (saved) setStudents(JSON.parse(saved)); else setStudents([]);
    }
  }, [activeTab, examConfigs]);

  const handleCourseChange = (newCourse: string) => {
    setCourse(newCourse);
    setBatch("all"); // إعادة ضبط الدفعة عند تغيير الدورة
  };

  const handleSearch = async () => {
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
    
    // 1. حساب عدد المعايير التي تم إدخال قيم لها فعلياً
    const enteredValuesCount = Object.keys(tempScores).filter(key => tempScores[key] !== "").length;
    const allCriteriaFilled = enteredValuesCount === currentCriteria.length;
    const hasNote = tempNotes.trim().length > 0;

    // 2. تطبيق شرط المنع: (لا توجد ملاحظة) وَ (المعايير ناقصة)
    if (!hasNote && !allCriteriaFilled) {
        return toast.error("يرجى إكمال رصد جميع المعايير أو كتابة ملاحظة (عذر، غياب، طبية...)");
    }

    // 3. معالجة الدرجات
    for (const crit of currentCriteria) {
        const rawVal = tempScores[crit.name];
        
        // إذا كان هناك ملاحظة والمعيار فارغ، لا نضع صفر بل نتركه Null أو نتجاهله
        if (hasNote && (rawVal === "" || rawVal === undefined)) {
            finalScores[crit.name] = 0; // أو يمكن جعلها null حسب رغبتك في قاعدة البيانات
        } else {
            const val = parseFloat(normalizeNumbers(rawVal || "0"));
            if (val > crit.max) return toast.error(`تجاوزت الحد في ${crit.name}`);
            finalScores[crit.name] = val; 
            total += val;
        }
    }

    // التعرف التلقائي عند إضافة أول جندي
    if (students.length === 0) {
        setCourse(selectedSoldier.course);
        setBatch(selectedSoldier.batch);
        setCompany(selectedSoldier.company);
        setPlatoon(selectedSoldier.platoon);
    }

    const updated = [...students, { ...selectedSoldier, scores: finalScores, total, notes: tempNotes }];
    setStudents(updated);
    localStorage.setItem(`shooting_${activeTab}`, JSON.stringify(updated));
    setIsModalOpen(false); 
    setSearchQuery("");
};

  const handleFinalSave = async () => {
    // 1. الحماية الأولية
    if (course === "all" || batch === "all") {
        return toast.error("يرجى تحديد الدورة والدفعة قبل الحفظ");
    }

    if (filteredStudents.length === 0) {
        return toast.error("الجدول فارغ أو لا توجد بيانات مطابقة للفرز");
    }

    setLoading(true);
    try {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const formattedDate = new Date().toISOString().split('T')[0];

        // 🧠 المنطق الذكي لتحديد السرية والفصيل للسجل
        const firstStudent = filteredStudents[0];
        const isUnifiedCompany = filteredStudents.every(s => s.company === firstStudent.company);
        const isUnifiedPlatoon = filteredStudents.every(s => s.platoon === firstStudent.platoon);

        // ✅ تعريف الـ payload أولاً
        const payload = {
    config_id: activeConfig.id,
    title: `${activeConfig.exam_type} - ${formattedDate}`,
    exam_date: formattedDate,
    course: course,
    batch: batch,
    company: isUnifiedCompany ? firstStudent.company : "متعدد",
    platoon: isUnifiedPlatoon ? firstStudent.platoon : "متعدد",
    
    // تم حذف بيانات المنشئ لأن السيرفر سيتعرف عليها من التوكن تلقائياً 🛡️

    students_data: filteredStudents.map(s => ({
        military_id: s.military_id,
        name: s.name,
        rank: s.rank,
        company: s.company,
        platoon: s.platoon,
        scores: s.scores,
        total: s.total,
        notes: s.notes
    }))
};;

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
            toast.success("تم الحفظ بنجاح");
            setStudents([]); // مسح الجدول بعد النجاح
            localStorage.removeItem(`shooting_${activeTab}`); // مسح التخزين المؤقت
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
    <div className="space-y-4" dir="rtl">
      {/* رأس الصفحة */}
      <div className="flex justify-between items-center no-print bg-white dark:bg-slate-900 p-3 rounded-xl border shadow-sm mb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#0f172a] rounded-lg text-[#c5b391] shadow-md"><Target className="w-6 h-6" /></div>
          <h2 className="text-xl font-bold"> اختبارات الرماية</h2>
        </div>
        <Button onClick={handleFinalSave} disabled={loading} className="h-10 bg-green-700 hover:bg-green-800 text-white shadow-md gap-2 px-6">
          {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
          <span className="text-sm font-bold">حفظ </span>
        </Button>
      </div>

      {/* 🔄 قسم الفرز المرتبط الذكي */}
      <div className="no-print mb-4">
        <Card className="border-r-4 border-r-[#c5b391] shadow-sm bg-white h-10 flex items-center w-full md:w-2/3 overflow-hidden">
          <CardContent className="p-0 px-3 w-full flex items-center justify-between gap-4 h-full">
            <div className="flex items-center gap-2 flex-1">
              <Label className="text-[11px] text-slate-500 font-bold mb-0">الدورة:</Label>
              <Select value={course} onValueChange={handleCourseChange}>
                <SelectTrigger className="h-7 text-xs border-none shadow-none focus:ring-0 bg-transparent p-0"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all">كل الدورات</SelectItem>
                  {coursesList.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-px h-4 bg-slate-200" />
            <div className="flex items-center gap-2 flex-1">
              <Label className="text-[11px] text-slate-500 font-bold mb-0">الدفعة:</Label>
              <Select value={batch} onValueChange={setBatch}>
                <SelectTrigger className="h-7 text-xs border-none shadow-none focus:ring-0 bg-transparent p-0"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all">كل الدفعات</SelectItem>
                  {availableBatches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* البحث */}
      <Card className="bg-slate-50 border border-slate-200 shadow-sm p-3 flex flex-col md:flex-row items-center gap-3">
        <div className="flex-1 w-full relative">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
          <Input placeholder="البحث بالاسم أو الرقم العسكري..." className="bg-white pr-9 shadow-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
        </div>
        <Button onClick={handleSearch} disabled={loading} className="w-full md:w-auto bg-[#c5b391] hover:bg-[#b4a280] text-slate-900 font-bold gap-2">
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

        <Card className="border-0 shadow-xl overflow-hidden">
          <div className="overflow-x-auto" dir="rtl"> 
            <Table>
              <TableHeader>
                <TableRow className="bg-[#c5b391] hover:bg-[#c5b391]">
                  <TableHead className="text-slate-900 font-bold text-center w-10">#</TableHead>
                  <TableHead className="text-slate-900 font-bold text-center w-14">الصورة</TableHead>
                  <TableHead className="text-slate-900 font-bold text-right">الرتبة والاسم</TableHead>
                  <TableHead className="text-slate-900 font-bold text-center">الرقم</TableHead>
                  <TableHead className="text-slate-900 font-bold text-center">السرية / الفصيل</TableHead>
                  {activeConfig?.criteria.map((c: any) => (
                    <TableHead key={c.name} className="text-slate-900 font-bold text-center">
                      <div className="flex flex-col text-[10px] items-center"><span>{c.name}</span><span className="opacity-70">({c.max})</span></div>
                    </TableHead>
                  ))}
                  {/* 👇 عرض المجموع الكلي الأقصى تحت عنوان العمود (طلبك الجديد) */}
                  <TableHead className="text-slate-900 font-bold text-center bg-[#b4a280]">
                     <div className="flex flex-col text-[10px] items-center"><span>المجموع</span><span className="text-red-900 font-black">({maxTotalScore})</span></div>
                  </TableHead>
                  <TableHead className="text-slate-900 font-bold text-right">ملاحظات</TableHead>
                  <TableHead className="no-print w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white dark:bg-slate-900">
                {/* 🔍 استخدام المصفوفة المفلترة لحظياً */}
                {filteredStudents.map((s, i) => (
                  <TableRow key={s.military_id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="text-center text-xs text-slate-400">{i+1}</TableCell>
                    <TableCell><div className="w-10 h-10 rounded-full border bg-slate-100 overflow-hidden mx-auto"><img src={`${process.env.NEXT_PUBLIC_API_URL}/static/images/${s.military_id}.jpg`} className="w-full h-full object-cover" onError={(e:any) => e.target.src = "/default-avatar.png"} /></div></TableCell>
                    <TableCell className="text-right"><div className="flex flex-col"><span className="text-[10px] text-blue-600 font-medium">{s.rank}</span><span className="font-bold text-sm text-slate-800">{s.name}</span></div></TableCell>
                    <TableCell className="text-center font-mono font-bold text-blue-800">{s.military_id}</TableCell>
                    <TableCell className="text-center text-xs text-slate-500">{s.company} / {s.platoon}</TableCell>
                    {activeConfig?.criteria.map((c: any) => (<TableCell key={c.name} className="text-center font-bold text-slate-700">{s.scores[c.name] || 0}</TableCell>))}
                    <TableCell className="text-center font-black bg-slate-50/50 text-blue-700 border-x">{s.total}</TableCell>
                    <TableCell className="text-right text-[10px] text-slate-500 max-w-[100px] truncate">{s.notes || "-"}</TableCell>
                    <TableCell className="no-print"><Button variant="ghost" size="icon" onClick={() => setDeleteIdx(i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </Tabs>

      {/* نافذة الرصد المطورة */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto pb-24 md:pb-30" dir="rtl" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle className="flex gap-2 text-[#c5b391] border-b pb-2"><FileText />  درجات الاختبار</DialogTitle></DialogHeader>
          {selectedSoldier && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-[#c5b391]/30 shadow-inner">
                <div className="w-16 h-16 rounded-full border-2 border-[#c5b391] relative overflow-hidden bg-white shadow-md">
  <img 
    // الرابط المعتمد على السيرفر والرقم العسكري
    src={`${process.env.NEXT_PUBLIC_API_URL}/static/images/${selectedSoldier.military_id}.jpg`} 
    className="w-full h-full object-cover"
    alt={selectedSoldier.name}
    // الحل السحري: إذا لم يجد السيرفر الصورة، يضع فوراً الصورة الافتراضية
    onError={(e) => {
      const target = e.target as HTMLImageElement;
      target.src = "/default-avatar.png"; 
    }}
  />
</div>
                <div className="flex flex-col gap-1">
                  <h4 className="font-bold text-slate-900">{selectedSoldier.name}</h4>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                    <span className="font-bold text-blue-700">{selectedSoldier.rank}</span>
                    <span className="font-mono bg-slate-200 px-1 rounded">{selectedSoldier.military_id}</span>
                    {/* 🚀 السرية والفصيل داخل النافذة للتأكيد */}
                    <span className="text-orange-700 font-bold border-r pr-2">السرية: {selectedSoldier.company}</span>
                    <span className="text-orange-700 font-bold">الفصيل: {selectedSoldier.platoon}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2 border-t pt-4">
                {activeConfig?.criteria.map((c: any) => (
                  <div key={c.name} className="flex items-center justify-between p-2 hover:bg-slate-50 border-b">
                    <div className="flex flex-col"><span className="text-xs font-bold">{c.name}</span><span className="text-[10px] text-red-500 font-mono">الأقصى: {c.max}</span></div>
                    <div className="relative w-24">
                      <Input type="text" inputMode="decimal" className="text-center font-bold font-mono h-9 border-[#c5b391]/30" value={tempScores[c.name] || ""} onChange={(e) => {const v = normalizeNumbers(e.target.value); if(parseFloat(v) <= c.max || v === "") setTempScores({...tempScores, [c.name]: v})}} />
                      <span className="absolute left-1 top-2.5 text-[8px] text-slate-300">/{c.max}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Input placeholder="ملاحظات إضافية..." className="h-10 text-xs shadow-sm" value={tempNotes} onChange={(e)=>setTempNotes(e.target.value)} />
              <div className="flex gap-2 pt-2"><Button variant="outline" className="flex-1 font-bold" onClick={() => setIsModalOpen(false)}>إلغاء</Button><Button onClick={confirmAddition} className="flex-[2] bg-[#0f172a] text-[#c5b391] font-extrabold h-11">تأكيد </Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteIdx !== null} onOpenChange={() => setDeleteIdx(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle /> تنبيه حذف</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2 pt-4">
            <AlertDialogCancel className="font-bold">تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={() => {if(deleteIdx!==null){const u=[...students]; u.splice(deleteIdx,1); setStudents(u); localStorage.setItem(`shooting_${activeTab}`, JSON.stringify(u)); setDeleteIdx(null)}}} className="bg-red-600 hover:bg-red-700 text-white font-bold">حذف الجندي</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
</ProtectedRoute>
  )
}