"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import * as XLSX from 'xlsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
// أضف هذا السطر مع الاستيرادات في الأعلى
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { UploadCloud, Calculator, CheckCircle, AlertCircle, FileSpreadsheet, ArrowLeft, Users,Loader2, Download } from "lucide-react"
import { toast } from "sonner"
import ProtectedRoute from "@/components/ProtectedRoute"
export default function DataEntryPage() {
  const router = useRouter()

  // --- حالة الإدخال اليدوي ---
  const [manualData, setManualData] = useState({ dob: "", run_time: "", pushups: "", situps: "" })
  const [manualResult, setManualResult] = useState<any>(null)
 const [selectedPeriod, setSelectedPeriod] = useState("")
const [trainerScoresMap, setTrainerScoresMap] = useState<Record<string, number> | null>(null)
const [isFetchingTrainer, setIsFetchingTrainer] = useState(false)
  // --- حالة رفع ملف اللياقة ---
  const [file, setFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState("idle") 
  const [uploadStats, setUploadStats] = useState<any>(null) 
// حالات التحكم في معايير المعالجة اللحظية
const [customSettings, setCustomSettings] = useState({
  distance: "3200",
  pass_rate: 60,
  base_score: 100,
  mercy_mode: false
})
  // --- حالة رفع درجات المدرب (ملفات متعددة) ---
  const [trainerFiles, setTrainerFiles] = useState<FileList | null>(null)
  const [trainerStatus, setTrainerStatus] = useState("idle")
const [drafts, setDrafts] = useState<any[]>([]) // لجلب المسودات من القاعدة
const [configs, setConfigs] = useState<any[]>([]) // لجلب المعايير
const [selectedDraft, setSelectedDraft] = useState("")
const [selectedConfig, setSelectedConfig] = useState("")
 // أضف هذه الدالة داخل المكون DataEntryPage
const downloadTemplate = (type: 'fitness' | 'trainer') => {
  // 1. تحديد العناوين العربية (إضافة الأعمدة التنظيمية في بداية نموذج اللياقة)
  const headers = type === 'fitness' 
    ? [[
        'اسم الدورة', 
        'الدفعة', 
        'السرية', 
        'الفصيل', 
        'الرقم العسكري', 
        'الإسم', 
        'تاريخ الميلاد', 
        'الجري', 
        'الضغط', 
        'البطن'
      ]] 
    : [[
        'الرقم العسكري', 
        'درجة المدرب'
      ]];

  // 2. إنشاء ورقة العمل (Worksheet)
  const ws = XLSX.utils.aoa_to_sheet(headers);

  // 3. ضبط عرض الأعمدة تلقائياً لتكون العناوين واضحة
  const wscols = type === 'fitness' 
    ? [{wch:15}, {wch:10}, {wch:10}, {wch:10}, {wch:15}, {wch:25}, {wch:15}, {wch:10}, {wch:10}, {wch:10}]
    : [{wch:15}, {wch:15}];
  ws['!cols'] = wscols;

  // 4. إنشاء كتاب العمل (Workbook)
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");

  // 5. توليد وتحميل الملف بصيغة .xlsx الحقيقية
  const fileName = type === 'fitness' ? "نموذج_اختبار_اللياقة.xlsx" : "نموذج_درجات_المدرب.xlsx";
  XLSX.writeFile(wb, fileName);
};
useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [draftsRes, configsRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/drafts`, {
             headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/configs`, {
             headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          })
        ]);
        if (draftsRes.ok) setDrafts(await draftsRes.ok ? await draftsRes.json() : []);
        if (configsRes.ok) setConfigs(await configsRes.json());
      } catch (e) {
        console.error("Failed to load initial data");
      }
    };
    loadInitialData();
  }, []);

  // 3. الدالة التي تسببت في الخطأ الأخير (handleProcessDraft)
 const handleProcessDraft = async () => {
    if (!selectedDraft) return;
    
    // 1. العثور على كائن المسودة المختار من المصفوفة لجلب بياناته الحقيقية
    const currentDraftData = drafts.find(d => d.id.toString() === selectedDraft);
    
    if (!currentDraftData) {
        toast.error("فشل العثور على بيانات المسودة المحددة");
        return;
    }

    const toastId = toast.loading("جاري معالجة البيانات ودمج الدرجات...");
    
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/calculate/process-draft`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                'Authorization': `Bearer ${localStorage.getItem('token')}` 
            },
            body: JSON.stringify({
                draft_id: Number(selectedDraft),
                // 🟢 التعديل الجوهري: إرسال الدورة والدفعة الحقيقية للباك إند
                course: currentDraftData.course || "عام",
                batch: currentDraftData.batch || "عام",
                
                distance: Number(customSettings.distance),
                pass_rate: Number(customSettings.pass_rate),
                base_score: Number(customSettings.base_score),
                mercy_mode: customSettings.mercy_mode,
                trainer_scores: trainerScoresMap,
                period: selectedPeriod 
            })
        });

        if (res.ok) {
            toast.success("تم توليد النتائج النهائية بنجاح", { id: toastId });
            router.push("/results"); 
        } else {
            toast.error("حدث خطأ أثناء المعالجة");
        }
    } catch (e) {
        toast.error("خطأ في النظام");
    }
}
const handleFetchTrainerFitness = async () => {
    if (!selectedDraft) return toast.error("يرجى اختيار المسودة أولاً");
    
    // العثور على بيانات المسودة المختارة لمعرفة الدورة والدفعة
    const draft = drafts.find(d => d.id.toString() === selectedDraft);
    if (!draft) return;

    setIsFetchingTrainer(true);
    try {
        const params = new URLSearchParams({
            course: draft.course,
            batch: draft.batch,
            period: selectedPeriod
        });

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/get-trainer-scores-fitness?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (res.ok) {
            const scores = await res.json();
            setTrainerScoresMap(scores);
            toast.success(`تم جلب درجات المدرب لـ ${Object.keys(scores).length} طالب بنجاح`);
        } else {
            toast.error("فشل جلب درجات المدرب");
        }
    } catch (e) {
        toast.error("خطأ في الاتصال بالسيرفر");
    } finally {
        setIsFetchingTrainer(false);
    }
}
const handleManualCalculate = async () => {
    setManualResult(null)
    try {
      const payload = {
        dob: manualData.dob,
        run_time: manualData.run_time,
        pushups: Number(manualData.pushups),
        situps: Number(manualData.situps)
      }
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/calculate/single`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok) setManualResult(data.data)
    } catch (error) {
      toast.error("فشل الاتصال بالخادم")
    }
  }

  const handleFileUpload = async () => {
    if (!file) return
    setUploadStatus("loading")
    setUploadStats(null)
    
    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/calculate/excel`, {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        setUploadStatus("success")
        setUploadStats(data)
      } else {
        setUploadStatus("error")
        toast.error("حدث خطأ أثناء المعالجة")
      }
    } catch (error) {
      setUploadStatus("error")
      toast.error("فشل الاتصال")
    }
  }

  // --- دالة رفع ملفات المدرب الجديدة ---
  const handleTrainerUpload = async () => {
    if (!trainerFiles || trainerFiles.length === 0) return
    setTrainerStatus("loading")

    const formData = new FormData()
    // إضافة جميع الملفات المحددة
    for (let i = 0; i < trainerFiles.length; i++) {
      formData.append("files", trainerFiles[i])
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/trainer-scores`, {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      
      if (res.ok) {
        setTrainerStatus("success")
        // الرسالة التفصيلية الجديدة
        toast.success("تم دمج الدرجات بنجاح", {
            description: `تم تحديث درجات المدرب لـ (${data.updated_count}) طالب.`,
            duration: 5000, // تبقى الرسالة 5 ثوانٍ لقرائتها
        })
      } else {
        setTrainerStatus("error")
        toast.error("فشل عملية الدمج", {
            description: data.detail || "تأكد من مطابقة الأرقام العسكرية في الملف.",
        })
      }
    } catch (error) {
      setTrainerStatus("error")
      toast.error("فشل الاتصال بالخادم")
    }
  }

  return (
    <ProtectedRoute allowedRoles={["owner","assistant_admin"]}>
    <div className="space-y-6 pb-10 md:pb-24 " dir="rtl">
      <h1 className="text-3xl font-bold text-slate-800 dark:text-white">إدخال البيانات</h1>
      
      <Tabs defaultValue="excel" className="w-full" dir="rtl">
        <TabsList className="grid w-full grid-cols-3 max-w-[600px] mb-4">
          <TabsTrigger value="excel">رفع ملف اللياقة</TabsTrigger>
          <TabsTrigger value="trainer">درجات المدرب</TabsTrigger>
          <TabsTrigger value="manual">إدخال يدوي</TabsTrigger>
        </TabsList>

        {/* --- 1: رفع ملف اللياقة --- */}
        <TabsContent value="excel">
          <Card>
            <CardHeader>
  <div className="flex justify-between items-start">
    <div>
      <CardTitle>بيانات اللياقة الأساسية</CardTitle>
      <CardDescription>ارفع ملف الإكسل الخاص باختبارات اللياقة (جري، ضغط، بطن).</CardDescription>
    </div>
    {/* الزر الجديد هنا */}
    <Button 
  variant="outline" 
  size="sm" 
  onClick={() => downloadTemplate('fitness')} 
  className="text-green-700 border-green-200 hover:bg-green-50 shadow-sm"
>
  <FileSpreadsheet className="w-4 h-4 ml-2" /> تحميل نموذج XLSX العربي
</Button>
  </div>
</CardHeader>
            <CardContent>
              {!uploadStatus.includes("success") && (
                <div className="flex items-center justify-center w-full">
                  <label htmlFor="dropzone-file" className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${file ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-gray-300 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100'}`}>
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <UploadCloud className={`w-12 h-12 mb-4 ${file ? 'text-green-500' : 'text-gray-400'}`} />
                      <p className="mb-2 text-lg text-gray-500 dark:text-gray-400">
                        {file ? <span className="font-semibold text-green-600">{file.name}</span> : <> <span className="font-semibold">اضغط للتحميل</span> أو اسحب الملف هنا </>}
                      </p>
                      <p className="text-sm text-gray-500">XLSX, XLS</p>
                    </div>
                    <Input id="dropzone-file" type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              )}

              {uploadStatus === "success" && uploadStats && (
                <div className="flex flex-col items-center justify-center p-8 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center animate-in fade-in zoom-in duration-300">
                  <div className="p-3 bg-green-100 dark:bg-green-800 rounded-full mb-4"><CheckCircle className="w-12 h-12 text-green-600 dark:text-green-200" /></div>
                  <h3 className="text-2xl font-bold text-green-800 dark:text-green-300 mb-2">تمت المعالجة بنجاح!</h3>
                  <p className="text-green-700 dark:text-green-400 mb-6">تم استيراد {uploadStats.count} سجل.</p>
                  <div className="flex gap-4 w-full max-w-md">
                    <Button onClick={() => { setFile(null); setUploadStatus("idle"); }} variant="outline" className="flex-1">ملف آخر</Button>
                    <Button onClick={() => router.push("/results")} className="flex-1 bg-green-700 hover:bg-green-800 text-white"><FileSpreadsheet className="w-4 h-4 ml-2" />عرض النتائج</Button>
                  </div>
                </div>
              )}
            </CardContent>
            {uploadStatus !== "success" && (
              <CardFooter>
                <Button onClick={handleFileUpload} disabled={!file || uploadStatus === "loading"} className="w-full bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-700">
                  {uploadStatus === "loading" ? "جارِ المعالجة..." : "بدء المعالجة"}
                </Button>
              </CardFooter>
            )}
          </Card>
        </TabsContent>

        {/* --- 2: رفع درجات المدرب (جديد) --- */}
        <TabsContent value="trainer">
          <Card className="border-t-4 border-t-blue-500">
            <CardHeader>
  <div className="flex justify-between items-start">
    <div>
      <CardTitle>إلحاق درجات المدرب</CardTitle>
      <CardDescription>يمكنك رفع ملف أو أكثر يحتوي على (الرقم العسكري + درجة المدرب) لدمجها.</CardDescription>
    </div>
    {/* الزر الجديد هنا */}
    <Button 
  variant="outline" 
  size="sm" 
  onClick={() => downloadTemplate('trainer')} 
  className="text-blue-700 border-blue-200 hover:bg-blue-50 shadow-sm"
>
  <FileSpreadsheet className="w-4 h-4 ml-2" /> تحميل نموذج XLSX العربي
</Button>
  </div>
</CardHeader>
            <CardContent>
              <div className="flex items-center justify-center w-full">
                <label htmlFor="trainer-files" className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${trainerFiles && trainerFiles.length > 0 ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10' : 'border-gray-300 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100'}`}>
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Users className={`w-12 h-12 mb-4 ${trainerFiles && trainerFiles.length > 0 ? 'text-blue-500' : 'text-gray-400'}`} />
                    <p className="mb-2 text-lg text-gray-500 dark:text-gray-400">
                      {trainerFiles && trainerFiles.length > 0 ? (
                        <span className="font-semibold text-blue-600">تم اختيار {trainerFiles.length} ملف</span>
                      ) : (
                        <> <span className="font-semibold">اضغط لاختيار الملفات</span> (يدعم التعدد) </>
                      )}
                    </p>
                    <p className="text-sm text-gray-500">XLSX, XLS</p>
                  </div>
                  {/* السماح بملفات متعددة multiple */}
                  <Input id="trainer-files" type="file" multiple className="hidden" accept=".xlsx, .xls" onChange={(e) => setTrainerFiles(e.target.files)} />
                </label>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleTrainerUpload} disabled={!trainerFiles || trainerStatus === "loading"} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                {trainerStatus === "loading" ? "جارِ الدمج..." : "دمج الدرجات"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* --- 3: الإدخال اليدوي --- */}
<TabsContent value="manual">
  <Card className="border-t-4 border-t-orange-500 shadow-lg">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Calculator className="w-5 h-5 text-orange-600" />
        معالجة المسودات المحفوظة (رسمي)
      </CardTitle>
      <CardDescription>
        اختر الاختبار المراد معالجته، وحدد المعايير المطلوبة حالياً لهذا الاختبار.
      </CardDescription>
    </CardHeader>
    
    <CardContent className="space-y-8">
      {/* 1. اختيار المسودة */}
      <div className="bg-slate-50 p-4 rounded-xl border-dashed border-2 border-slate-200">
        <Label className="text-orange-700 font-bold mb-2 block text-sm">1. اختر مسودة الاختبار (الرصد الميداني)</Label>
        <Select onValueChange={(val) => { setSelectedDraft(val); setTrainerScoresMap(null); }}>
          <SelectTrigger className="bg-white h-12 shadow-sm font-bold text-slate-700">
            <SelectValue placeholder="اضغط لاختيار الاختبار المراد معالجته..." />
          </SelectTrigger>
          <SelectContent align="end">
            {drafts.map((d: any) => (
              <SelectItem key={d.id} value={d.id.toString()}>
                {d.title} ({new Date(d.exam_date).toISOString().split('T')[0]})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 2. لوحة التحكم بالمعايير اللحظية */}
      <div className="space-y-4">
        <Label className="text-blue-700 font-bold block border-b pb-2 text-sm">2. تحديد معايير القياس الحالية (أوامر الإدارة)</Label>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* المسافة */}
          <div className="space-y-2">
            <Label className="text-xs text-slate-500">مسافة الجري</Label>
            <Select 
              value={customSettings.distance} 
              onValueChange={(val) => setCustomSettings({...customSettings, distance: val})}
            >
              <SelectTrigger className="h-11 font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3200">3200 متر</SelectItem>
                <SelectItem value="2400">2400 متر</SelectItem>
                <SelectItem value="1600">1600 متر</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* نسبة النجاح */}
          <div className="space-y-2">
            <Label className="text-xs text-slate-500">نسبة النجاح (%)</Label>
            <Input 
              type="number" 
              value={customSettings.pass_rate} 
              onChange={(e) => setCustomSettings({...customSettings, pass_rate: Number(e.target.value)})}
              className="h-11 text-center font-black text-green-700"
            />
          </div>

          {/* الدرجة القصوى */}
          <div className="space-y-2">
            <Label className="text-xs text-slate-500">الدرجة القصوى للاختبار</Label>
            <Input 
              type="number" 
              value={customSettings.base_score} 
              onChange={(e) => setCustomSettings({...customSettings, base_score: Number(e.target.value)})}
              className="h-11 text-center font-black text-blue-700"
            />
          </div>
        </div>

        {/* تفعيل الرأفة */}
        <div className="flex items-center justify-between p-4 bg-orange-50 border border-orange-100 rounded-lg mt-2">
          <div className="flex items-center gap-3">
             <AlertCircle className="w-5 h-5 text-orange-600" />
             <Label className="font-bold cursor-pointer text-slate-700" htmlFor="mercy-mode">تفعيل نظام الرأفة (Mercy Mode)</Label>
          </div>
          <Switch 
            id="mercy-mode"
            checked={customSettings.mercy_mode} 
            onCheckedChange={(val: boolean) => setCustomSettings({...customSettings, mercy_mode: val})} 
          />
        </div>
      </div>

      {/* 3. القسم الذكي لجلب درجات المدرب (يظهر فقط عند الدرجة 90) */}
      {customSettings.base_score === 90 && (
        <div className="space-y-4 p-4 bg-blue-50 border border-blue-100 rounded-xl animate-in zoom-in-95">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            {/* اختيار الفترة - يظهر فقط إذا كانت الدورة دبلوم */}
            {drafts.find(d => d.id.toString() === selectedDraft)?.course === "طلبة الدبلوم" ? (
              <div className="flex-1 space-y-2">
                <Label className="text-blue-700 font-bold text-xs">اختر الفترة الدراسية لدرجة المدرب:</Label>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="bg-white h-11 border-blue-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="الفترة التأسيسية">الفترة التأسيسية</SelectItem>
                    <SelectItem value="الفصل الأول">الفصل الأول</SelectItem>
                    <SelectItem value="الفصل الثاني">الفصل الثاني</SelectItem>
                    <SelectItem value="الفصل الثالث">الفصل الثالث</SelectItem>
                    <SelectItem value="الفصل الرابع">الفصل الرابع</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
                <div className="flex-1 text-xs text-blue-600 font-bold mb-3 italic">
                    * سيتم جلب درجة المدرب العامة لهذه الدورة.
                </div>
            )}
            
            <Button 
  onClick={handleFetchTrainerFitness}
  // التعديل هنا: الزر سيتعطل إذا كانت الدورة دبلوم ولم يتم اختيار فترة
  disabled={
    isFetchingTrainer || 
    !selectedDraft || 
    (drafts.find(d => d.id.toString() === selectedDraft)?.course === "طلبة الدبلوم" && !selectedPeriod)
  }
  className="bg-blue-700 hover:bg-blue-800 text-white gap-2"
>
  {isFetchingTrainer ? <Loader2 className="animate-spin" /> : <Users className="w-4 h-4" />}
  جلب درجات المدرب (10%)
</Button>
          </div>

          {trainerScoresMap && (
            <div className="flex items-center gap-2 text-green-700 font-black text-xs bg-green-50 p-3 rounded-lg border border-green-200 animate-in fade-in">
               <CheckCircle className="w-4 h-4" />
               تم ربط {Object.keys(trainerScoresMap).length} درجة أسبوعية من أرشيف اللياقة بنجاح.
            </div>
          )}
        </div>
      )}
    </CardContent>

    <CardFooter>
      <Button 
        onClick={handleProcessDraft} 
        disabled={!selectedDraft || (customSettings.base_score === 90 && !trainerScoresMap)}
        className="w-full h-14 bg-orange-600 hover:bg-orange-700 text-white font-black text-lg shadow-xl"
      >
        <Calculator className="w-6 h-6 ml-2" />
        تأكيد المعايير وبدء المعالجة النهائية
      </Button>
    </CardFooter>
  </Card>
</TabsContent>
      </Tabs>
    </div>
    </ProtectedRoute>
  )
}