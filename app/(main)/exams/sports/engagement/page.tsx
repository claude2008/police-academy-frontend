"use client"

import { useState, useEffect, useMemo } from "react"
import { 
  Swords, Search, Trash2, Save, User, Loader2, 
  ShieldCheck, UserPlus, FileText, AlertTriangle, MapPin
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

// دالة تحويل الأرقام العربية
const normalizeNumbers = (val: string) => {
  const arabicNums = "٠١٢٣٤٥٦٧٨٩"; const englishNums = "0123456789";
  return val.replace(/[٠-٩]/g, (d) => englishNums[arabicNums.indexOf(d)])
}

export default function EngagementExamsPage() {
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
  const [rawSoldiersData, setRawSoldiersData] = useState<any[]>([]);

  // 1. حساب المجموع الكلي الأقصى للمحاور النشطة فقط
const maxTotalScore = useMemo(() => {
  if (!activeConfig || !activeConfig.axes) return 0;
  
  // 🟢 التعديل: فلترة المحاور النشطة قبل بدء عملية الجمع
  const activeAxes = activeConfig.axes.filter((axis: any) => axis.is_active !== false);
  
  return activeAxes.reduce((acc: number, axis: any) => {
      const axisTotal = axis.criteria?.reduce((sum: number, c: any) => sum + (Number(c.max) || 0), 0) || 0;
      return acc + axisTotal;
  }, 0);
}, [activeConfig]);

  // 2. فلاتر البحث
  const coursesList = useMemo(() => {
    return Array.from(new Set(rawSoldiersData.map(s => s.course))).filter(c => c && c.trim() !== "");
  }, [rawSoldiersData]);

  const availableBatches = useMemo(() => {
    let filtered = rawSoldiersData;
    if (course !== "all") filtered = rawSoldiersData.filter(s => s.course === course);
    return Array.from(new Set(filtered.map(s => s.batch))).filter(b => b && b.trim() !== "");
  }, [course, rawSoldiersData]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchCourse = course === "all" || s.course === course;
      const matchBatch = batch === "all" || s.batch === batch;
      return matchCourse && matchBatch;
    });
  }, [students, course, batch]);

  // 3. جلب البيانات
 useEffect(() => {
  const initPage = async () => {
    try {
      const headers = { "Authorization": `Bearer ${localStorage.getItem("token")}` };
      const resConfig = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/engagement-configs`, { headers });
      
      if (resConfig.ok) {
        const data = await resConfig.json();
        
        // 🛠️ هذا هو "المثبت" (Sorter):
        // نقوم بترتيب المصفوفة يدوياً قبل وضعها في State
        const orderedData = data.sort((a: any, b: any) => {
          // نبحث عن كلمة technical في الـ subject أو الـ key
          const aIsTechnical = a.subject?.includes('technical') || a.id === 'technical';
          const bIsTechnical = b.subject?.includes('technical') || b.id === 'technical';
          
          if (aIsTechnical) return -1; // الفني يرجع للخلف (يعني يظهر أولاً)
          if (bIsTechnical) return 1;  // أي شيء آخر يتقدم للأمام
          return 0;
        });

        setExamConfigs(orderedData);
        
        // تثبيت التبويب النشط على أول عنصر بعد الترتيب (الذي سيكون الفني)
        if (orderedData.length > 0 && activeTab === "") {
          setActiveTab(orderedData[0].id);
        }
      }
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
    const config = examConfigs.find(c => c.id === activeTab);
    if (config) {
      setActiveConfig(config);
      const saved = localStorage.getItem(`engagement_${activeTab}`);
      if (saved) setStudents(JSON.parse(saved)); else setStudents([]);
    }
  }, [activeTab, examConfigs]);

  // 4. منطق الإضافة والرصد
 const handleSearch = async () => {
    const cleanQuery = normalizeNumbers(searchQuery).trim();
    
    if (!cleanQuery) {
        return toast.error("يرجى إدخال الرقم العسكري أو اسم المجند أولاً");
    }

    if (students.find(s => s.military_id === cleanQuery)) return toast.error("هذا المختبر مضاف بالفعل");

    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/search?query=${cleanQuery}`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      
      const data = await res.json();

      // 🟢 التعديل الجذري هنا:
      // دالة البحث تعيد مصفوفة مباشرة [ ], لذا نفحص المصفوفة نفسها
      if (Array.isArray(data) && data.length > 0) {
        setSelectedSoldier(data[0]); 
        setTempScores({}); 
        setTempNotes(""); 
        setIsModalOpen(true);
      } else { 
        toast.error("لم يتم العثور على جندي بهذا الرقم"); 
      }
    } catch (e) {
        toast.error("حدث خطأ في الاتصال بالسيرفر");
    } finally { setLoading(false); }
};

  const confirmAddition = () => {
    if (!activeConfig || !selectedSoldier) return;
    
    const finalScores: Record<string, number> = {};
    let totalAccumulated = 0;
    let anyEmpty = false;

    // 1. 🟢 التعديل: تصفية المحاور النشطة فقط للجمع
    const activeAxes = activeConfig.axes?.filter((axis: any) => axis.is_active !== false) || [];

    activeAxes.forEach((axis: any) => {
        axis.criteria?.forEach((crit: any) => {
            const rawVal = tempScores[crit.id];
            if (rawVal === undefined || rawVal === "") {
                anyEmpty = true;
            } else {
                const val = parseFloat(normalizeNumbers(rawVal));
                finalScores[crit.id] = val;
                totalAccumulated += val;
            }
        });
    });

    if (anyEmpty && tempNotes.trim().length === 0) {
        return toast.error("يرجى إكمال رصد جميع المعايير أو كتابة ملاحظة توضح السبب.");
    }

    // 2. 🟢 التعديل: القسمة على عدد المحاور النشطة فقط
    const axesCount = activeAxes.length || 1;
    const averageResult = Math.round(totalAccumulated / axesCount);

    const updated = [
        ...students, 
        { ...selectedSoldier, scores: finalScores, total: averageResult, notes: tempNotes }
    ];

    setStudents(updated);
    localStorage.setItem(`engagement_${activeTab}`, JSON.stringify(updated));
    setIsModalOpen(false); 
    setSearchQuery("");
};

 const handleFinalSave = async () => {
    if (students.length === 0) return toast.error("الجدول فارغ");

    setLoading(true);
    try {
        const formattedDate = new Date().toISOString().split('T')[0];

        // 1. بصمة المحاور - إصلاح متغير 'a' (السطر 201-202 في رسائل الخطأ)
        const axesFingerprint = examConfigs
            .map((cfg: any) => {
                const activeAxesNames = cfg.axes
                    ?.filter((a: any) => a.is_active !== false) // أضفنا : any هنا
                    .map((a: any) => a.title || a.name)         // أضفنا : any هنا
                    .sort().join("-");
                return `${cfg.name}:${activeAxesNames}`;
            })
            .sort().join("|");

        const payload = {
            config_id: parseInt(activeConfig.id), 
            title: `اختبار اشتباك (${activeConfig.name}) - ${formattedDate}`,
            exam_date: formattedDate,
            course: "mixed_sync", 
            batch: "mixed_sync",
            company: students[0]?.company || "عام",
            platoon: students[0]?.platoon || "عام",
            
            // 🟢 إصلاح المتغيرات داخل students_data (السطر 226-229 في رسائل الخطأ)
            students_data: students.map((s: any) => {
                const studentSnapshot = {
                    id: activeConfig.id,
                    name: activeConfig.name,
                    axes: activeConfig.axes?.filter((a: any) => a.is_active !== false).map((axis: any) => ({ // أضفنا : any هنا
                        title: axis.title || axis.name,
                        name: axis.name,
                        criteria: axis.criteria?.map((c: any) => ({ // أضفنا : any هنا
                            id: c.id,
                            name: c.name,
                            max: c.max,
                            score: s.scores[c.id] !== undefined ? Number(s.scores[c.id]) : 0
                        }))
                    }))
                };

                return {
                    military_id: String(s.military_id),
                    name: s.name,
                    rank: s.rank,
                    course: s.course,
                    batch: s.batch,
                    company: s.company,
                    platoon: s.platoon,
                    scores: s.scores, 
                    total: Number(s.total) || 0,
                    notes: s.notes || "",
                    axes_fingerprint: axesFingerprint,
                    exam_snapshot: studentSnapshot 
                };
            })
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
            toast.success("تم ترحيل البيانات وحفظها بنجاح");
            setStudents([]);
            localStorage.removeItem(`engagement_${activeTab}`);
        } else {
            const errorData = await res.json().catch(() => ({}));
            toast.error(errorData.detail || "فشل الحفظ: تأكد من صلاحية الاتصال");
        }
    } catch (e) {
        toast.error("خطأ في الاتصال بالشبكة");
    } finally {
        setLoading(false);
    }
};

  return (
    <ProtectedRoute allowedRoles={["owner","manager","admin","assistant_admin","sports_officer","sports_supervisor", "sports_trainer"]}>
      <div className="space-y-4" dir="rtl">
        {/* Header */}
        <div className="flex justify-between items-center no-print bg-white dark:bg-slate-900 p-3 rounded-xl border shadow-sm mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#0f172a] rounded-lg text-orange-500 shadow-md"><Swords className="w-6 h-6" /></div>
            <h2 className="text-xl font-bold"> اختبارات الاشتباك والدفاع عن النفس</h2>
          </div>
          <Button onClick={handleFinalSave} disabled={loading} className="h-10 bg-green-700 hover:bg-green-800 text-white shadow-md gap-2 px-6">
            {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span className="text-sm font-bold">حفظ </span>
          </Button>
        </div>

        {/* Filters */}
       

        {/* Search */}
        <Card className="bg-slate-50 border border-slate-200 shadow-sm p-3 flex flex-col md:flex-row items-center gap-3">
          <div className="flex-1 w-full relative">
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
            <Input placeholder="البحث بالاسم أو الرقم العسكري..." className="bg-white pr-9 shadow-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
          </div>
          {/* زر إضافة مختبر باللون البيج الرسمي */}
<Button 
  onClick={handleSearch} 
  disabled={loading} 
  className="w-full md:w-auto bg-[#c5b391] hover:bg-[#b4a280] text-slate-900 font-bold gap-2 shadow-sm"
>
  <UserPlus className="w-4 h-4" /> إضافة مختبر
</Button>
        </Card>

        {/* Tabs & Table */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* 🛠️ تعديل ألوان التبويبات (تاب فني وسيناريو) */}
<TabsList className="bg-slate-200 dark:bg-slate-800 mb-4 p-1 rounded-xl w-full flex h-auto flex-wrap">
  {examConfigs.map((cfg) => (
    <TabsTrigger 
      key={cfg.id} 
      value={cfg.id} 
      className="flex-1 py-2 font-bold transition-all
                 data-[state=active]:bg-[#0f172a] 
                 data-[state=active]:text-[#c5b391] 
                 data-[state=active]:shadow-lg"
    >
      {cfg.name}
    </TabsTrigger>
  ))}
</TabsList>

          <Card className="border-0 shadow-xl overflow-hidden">
            <div className="overflow-x-auto" dir="rtl"> 
              <Table>
               <TableHeader>
  {/* الصف الأول: المحاور - جعلناه بالبيج الرسمي */}
  <TableRow className="bg-[#c5b391] hover:bg-[#c5b391] border-b border-[#b4a280]">
    <TableHead rowSpan={2} className="text-slate-900 font-bold text-center w-10 border-l border-[#b4a280]">#</TableHead>
    <TableHead rowSpan={2} className="text-slate-900 font-bold text-center w-14 border-l border-[#b4a280]">الصورة</TableHead>
    <TableHead rowSpan={2} className="text-slate-900 font-bold text-right min-w-[180px] border-l border-[#b4a280]">الرتبة والاسم</TableHead>
    <TableHead rowSpan={2} className="text-slate-900 font-bold text-center border-l border-[#b4a280]">الرقم</TableHead>
    <TableHead rowSpan={2} className="text-slate-900 font-bold text-center border-l border-[#b4a280]">السرية / الفصيل</TableHead>
    
    {activeConfig?.axes?.filter((axis: any) => axis.is_active !== false).map((axis: any) => (
      <TableHead 
        key={axis.id} 
        colSpan={axis.criteria?.length || 1} 
        className="text-slate-900 font-black text-center border-l border-[#b4a280] bg-[#b4a280]/30"
      >
        {axis.name}
      </TableHead>
    ))}

   {/* في TableHeader - عمود المعدل */}
<TableHead rowSpan={2} className="text-slate-900 font-bold text-center bg-[#b4a280] border-l border-[#b4a280]">
    <div className="flex flex-col items-center">
        <span>المجموع</span>
        <span className="text-[10px] text-red-900 font-black">
            ({Math.round(maxTotalScore / (activeConfig?.axes?.filter((a: any) => a.is_active !== false).length || 1))})
        </span>
    </div>
</TableHead>
    <TableHead rowSpan={2} className="text-slate-900 font-bold text-right w-40">ملاحظات</TableHead>
    <TableHead rowSpan={2} className="no-print w-10"></TableHead>
  </TableRow>
  
  {/* الصف الثاني: المعايير والمحطات - بالبيج الرسمي أيضاً */}
  <TableRow className="bg-[#c5b391] hover:bg-[#c5b391]">
    {activeConfig?.axes?.filter((axis: any) => axis.is_active !== false).map((axis: any) => (
      axis.criteria?.map((crit: any) => (
        <TableHead key={crit.id} className="text-slate-800 font-bold text-center border-l border-[#b4a280] px-1 py-2 leading-tight">
            <div className="text-[10px]">{crit.name} ({crit.max})</div>
            <div className="text-[8px] text-slate-600 font-normal">({crit.stations?.length > 0 ? crit.stations.join(' - ') : '-'})</div>
        </TableHead>
      ))
    ))}
  </TableRow>
</TableHeader>

                <TableBody className="bg-white dark:bg-slate-900 font-bold text-slate-700">
                  {students.map((s, i) => (
                    <TableRow key={s.military_id} className="hover:bg-orange-50 transition-colors border-b">
                      <TableCell className="text-center text-xs text-slate-400 border-l">{i+1}</TableCell>
                      <TableCell className="border-l">
  <div className="w-10 h-10 rounded-full border bg-slate-100 overflow-hidden mx-auto">
    <img 
      // 🟢 التعديل: استخدام image_url المباشر مع بصمة الوقت لكسر الكاش
      src={s.image_url ? `${s.image_url}?t=${new Date().getTime()}` : "/placeholder-user.png"} 
      className="w-full h-full object-cover" 
      onError={(e:any) => {
        e.target.src = "/placeholder-user.png";
      }} 
    />
  </div>
</TableCell>
                      <TableCell className="text-right border-l"><div className="flex flex-col"><span className="text-[10px] text-blue-600">{s.rank}</span><span className="text-sm">{s.name}</span></div></TableCell>
                      <TableCell className="text-center font-mono text-blue-800 border-l">{s.military_id}</TableCell>
                      <TableCell className="text-center text-[10px] text-slate-500 border-l">{s.company} / {s.platoon}</TableCell>
                      
                      {activeConfig?.axes?.filter((axis: any) => axis.is_active !== false).map((axis: any) => (
                        axis.criteria?.map((crit: any) => (
                          <TableCell key={crit.id} className="text-center border-l border-slate-50">
                            {s.scores[crit.id] ?? 0}
                          </TableCell>
                        ))
                      ))}
                      
                      <TableCell className="text-center font-black bg-[#c5b391] text-slate-900 border-l border-[#b4a280]">
  {Math.round(s.total || 0)}
</TableCell>
                      <TableCell className="text-right text-[10px] text-slate-500 max-w-[120px] truncate border-l">{s.notes || "-"}</TableCell>
                      <TableCell className="no-print text-center"><Button variant="ghost" size="icon" onClick={() => setDeleteIdx(i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </Tabs>

        {/* Data Entry Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto pb-24 md:pb-30" dir="rtl" onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader><DialogTitle className="flex gap-2 text-orange-600 border-b pb-2"><FileText /> رصد درجات الاشتباك</DialogTitle></DialogHeader>
            {selectedSoldier && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-orange-200">
                  <div className="w-16 h-16 rounded-full border-2 border-orange-500 overflow-hidden bg-white">
  <img 
    // 🟢 التعديل: استخدام image_url من الجندي المختار
    src={selectedSoldier.image_url ? `${selectedSoldier.image_url}?t=${new Date().getTime()}` : "/placeholder-user.png"} 
    className="w-full h-full object-cover"
    onError={(e:any) => {
      e.target.src = "/placeholder-user.png";
    }}
  />
</div>
                  <div className="flex flex-col flex-1">
    <h4 className="font-bold text-slate-900">{selectedSoldier.name}</h4>
    <div className="flex gap-2 text-[10px] mt-1">
        <Badge className="bg-blue-700">{selectedSoldier.rank}</Badge>
        <Badge variant="outline">{selectedSoldier.military_id}</Badge>
    </div>
    
    {/* 🟢 الإضافة الجديدة: إظهار الدورة والدفعة هنا للتأكيد اللحظي */}
    <div className="text-[11px] text-blue-800 font-black mt-2 bg-blue-50 p-1.5 rounded border border-blue-100">
        📌 {selectedSoldier.course} {selectedSoldier.batch ? `- الدفعة ${selectedSoldier.batch}` : ""}
    </div>

    <div className="text-[10px] text-orange-700 font-bold mt-1">
        السرية: {selectedSoldier.company} | الفصيل: {selectedSoldier.platoon}
    </div>
</div>
                </div>

                <div className="space-y-4">
                  {activeConfig?.axes?.filter((axis: any) => axis.is_active !== false).map((axis: any) => (
                    <div key={axis.id} className="space-y-2 bg-white border rounded-lg p-2">
                        <div className="text-xs font-black text-orange-700 border-b pb-1 bg-orange-50 px-2 rounded">{axis.name}</div>
                        {axis.criteria?.map((crit: any) => (
                            <div key={crit.id} className="flex items-center justify-between p-1 border-b last:border-0">
                                <div className="flex flex-col flex-1">
    {/* اسم المعيار وبجانبه الدرجة القصوى بالأحمر */}
    <div className="flex items-center gap-1">
        <span className="text-[11px] font-bold text-slate-700">{crit.name}</span>
        <span className="text-[11px] text-red-600 font-black">({crit.max})</span>
    </div>
    {/* المحطات التعريفية بخط صغير */}
    <span className="text-[8px] text-slate-400 italic">
        ({crit.stations?.join(' - ') || '-'})
    </span>
</div>
                                <div className="relative w-24">
                                    <Input type="text" inputMode="decimal" className="text-center font-bold h-8 border-orange-100" value={tempScores[crit.id] || ""} onChange={(e) => {
                                        const v = normalizeNumbers(e.target.value);
                                        if (v === "" || (parseFloat(v) >= 0 && parseFloat(v) <= crit.max)) setTempScores({...tempScores, [crit.id]: v})
                                    }} />
                                    <span className="absolute left-1 top-2 text-[8px] text-slate-300">/{crit.max}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                  ))}
                </div>
                <Input placeholder="ملاحظات إجبارية في حال نقص الدرجات..." className="h-10 text-xs shadow-sm" value={tempNotes} onChange={(e)=>setTempNotes(e.target.value)} />
                <div className="flex gap-2 pt-2"><Button variant="outline" className="flex-1 font-bold" onClick={() => setIsModalOpen(false)}>إلغاء</Button><Button onClick={confirmAddition} className="flex-[2] bg-[#0f172a] text-orange-400 font-extrabold h-11">تأكيد </Button></div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={deleteIdx !== null} onOpenChange={() => setDeleteIdx(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle /> حذف من القائمة</AlertDialogTitle></AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-2 pt-4">
              <AlertDialogCancel className="font-bold">تراجع</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
    if(deleteIdx !== null){
      const updatedStudents = [...students];
      updatedStudents.splice(deleteIdx, 1);
      
      // 1. تحديث الواجهة
      setStudents(updatedStudents);
      
      // 2. 🟢 التعديل: تحديث ذاكرة المتصفح فوراً لضمان عدم عودتهم
      localStorage.setItem(`engagement_${activeTab}`, JSON.stringify(updatedStudents));
      
      setDeleteIdx(null);
      toast.success("تم الحذف من القائمة المؤقتة");
    }
}} className="bg-red-600 text-white font-bold">حذف</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ProtectedRoute>
  )
}