"use client"

import { useEffect, useState, useMemo } from "react"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { 
  Search, Printer, Download, ChevronLeft, ChevronRight, 
  ArrowUpDown, RefreshCcw, X, FileText, BookOpen, GraduationCap ,Save
} from "lucide-react"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { format } from "date-fns"
import ProtectedRoute from "@/components/ProtectedRoute"
// --- ثوابت الطباعة (من صفحة التقرير القديمة) ---
// في ملف ResultsPage.tsx (أعلى الملف)
const ORDERED_KEYS = [
  'الرتبة', 
  'الرقم العسكري', 
  'الإسم', 
  'الجري', 'درجة الجري', 'تقدير الجري',
  'الضغط', 'درجة الضغط', 'تقدير الضغط',
  'البطن', 'درجة البطن', 'تقدير البطن',
  'الدرجة النهائية', 
  'التقدير العام', 
  'النتيجة', 
  'ملاحظات', 
  'درجة المدرب'
]

const LIST_UNION = [
  'الرتبة', 'الرقم العسكري', 'الإسم', 'تاريخ الميلاد', 
  'الجري', 'الضغط', 'البطن', 'notes'
]

const LIST_CONTROL = [
  'الرتبة', 'الرقم العسكري', 'الإسم', 'تاريخ الميلاد', 
  'average', 'trainer_score', 'notes'
]

const COLUMN_MAPPING: Record<string, string> = {
  'name': 'الإسم', 'age': 'العمر',
  'run_time': 'الجري', 'run_score': 'د.جري', 'run_grade': 'تقدير',
  'pushups': 'الضغط', 'push_score': 'د.ضغط', 'push_grade': 'تقدير',
  'situps': 'البطن', 'sit_score': 'د.بطن', 'sit_grade': 'تقدير',
  'average': 'الدرجة', 
  'grade': 'التقدير العام', 'final_result': 'النتيجة',
  'notes': 'ملاحظات', 'trainer_score': 'درجة المدرب', 
  'dob': 'تاريخ الميلاد', 'تاريخ الميلاد': 'تاريخ الميلاد'
}

const DEFAULT_MAPPING: Record<string, string> = { ...COLUMN_MAPPING };

// لتسميات أعمدة الجدول التفاعلي (الشاشة)
const SCREEN_COLUMN_MAPPING: Record<string, string> = {
  ...COLUMN_MAPPING,
  'run_score': 'درجة الجري', 'run_grade': 'تقدير الجري',
  'push_score': 'درجة الضغط', 'push_grade': 'تقدير الضغط',
  'sit_score': 'درجة البطن', 'sit_grade': 'تقدير البطن',
  'average': 'الدرجة النهائية',
}

export default function ResultsPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [baseScore, setBaseScore] = useState(100)
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [saveTitle, setSaveTitle] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  // --- بيانات التقرير ---
  const [examName, setExamName] = useState("اختبار نهائي")
  const [subjectName, setSubjectName] = useState("المادة: لياقة بدنية")
  
  // التوقيعات
  const [rightTitle, setRightTitle] = useState("مدخل البيانات")
  const [rightName, setRightName] = useState("")
  
  const [midTitle, setMidTitle] = useState(" رئيــس قســـم التدريــب العسكــري والرياضـــي")
  const [midName, setMidName] = useState("")
  
  const [leftTitle, setLeftTitle] = useState("توقيـع الضـابط المسؤول")
  const [leftName, setLeftName] = useState("")

  const [reportType, setReportType] = useState("general") 

  // الفلاتر
  const [search, setSearch] = useState("")
  const [filterCourse, setFilterCourse] = useState("all")
  const [filterCompany, setFilterCompany] = useState("all")
  const [filterPlatoon, setFilterPlatoon] = useState("all")
  const [filterGrade, setFilterGrade] = useState("all")
  const [filterResult, setFilterResult] = useState("all")

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  // هذا السطر يحدد شكل مكان التوقيع: (تم حذف الحدود المتقطعة لضمان التساوي والنظافة)
const signatureBoxClass = "mt-2 w-40 h-20 flex items-center justify-center overflow-hidden shrink-0";
  // التوقيع الإلكتروني
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)

  useEffect(() => { 
    fetchResults();
    // جلب التوقيع عند التحميل
    const checkSignature = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/static/signature.png?t=${new Date().getTime()}`)
            if (res.ok) {
                setSignatureUrl(`${process.env.NEXT_PUBLIC_API_URL}/static/signature.png?t=${new Date().getTime()}`)
            }
        } catch (e) { console.log("No signature") }
    }
    checkSignature();
  }, [])

 const fetchResults = async (forcedSettings?: { base_score: number }) => {
  setLoading(true)
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/results`)
    if (res.ok) {
      const json = await res.json()
      const fetchedData = json.data || []
      setData(fetchedData)

      // 🟢 الأولوية 1: إذا مررنا معايير جديدة يدوياً (عند ضغط زر تحديث)
      if (forcedSettings && typeof forcedSettings.base_score === 'number') {
        setBaseScore(forcedSettings.base_score);
        console.log("✅ تم استخدام المعيار الممرر قسراً:", forcedSettings.base_score);
      } 
      // 🟢 الأولوية 2: إذا كانت البيانات تحتوي على ختم المعيار (من المسودة)
      else if (fetchedData.length > 0 && fetchedData[0].base_score) {
        const internalScore = Number(fetchedData[0].base_score);
        setBaseScore(internalScore);
        console.log("📦 تم اكتشاف المعيار من داخل البيانات:", internalScore);
      } 
      // 🟢 الأولوية 3: الحالة الافتراضية (من الإعدادات العامة)
      else {
        const settingsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings`)
        if (settingsRes.ok) {
          const settings = await settingsRes.json()
          setBaseScore(settings.base_score)
        }
      }
    }
  } catch (error) { 
    toast.error("فشل جلب البيانات") 
  } finally { 
    setLoading(false) 
  }
}
const handleSaveToArchive = async () => {
    if (!saveTitle) return toast.error("يرجى كتابة عنوان للاختبار")
    setIsSaving(true)
    
    // 1. استخراج اسم الدورة (Course)
    let targetCourse = "عام";
    
    // أولوية 1: إذا اختار المستخدم دورة من الفلتر، نعتمدها
    if (filterCourse !== "all" && filterCourse !== "") {
        targetCourse = filterCourse;
    } 
    // أولوية 2: إذا لم يختر، نبحث في بيانات الطالب الأول عن أي مسمى للدورة
    else if (data.length > 0) {
        targetCourse = data[0]['course'] || data[0]['اسم الدورة'] || data[0]['الدورة'] || "عام";
    }

    // 2. استخراج اسم الدفعة (Batch)
    let targetBatch = "عام";
    
    // نبحث في بيانات الطالب الأول عن أي مسمى للدفعة
    if (data.length > 0) {
        targetBatch = data[0]['batch'] || data[0]['الدفعة'] || data[0]['رقم الدفعة'] || "عام";
    }

    // للتأكد (يمكنك رؤية هذا في الكونسول F12)
    console.log("سيتم الحفظ بالبيانات التالية:", { Course: targetCourse, Batch: targetBatch });

    try {
        const payload = {
            title: saveTitle,
            exam_date: new Date().toISOString().split('T')[0],
            course: targetCourse, // 👈 القيمة المستخرجة
            batch: targetBatch,   // 👈 القيمة المستخرجة
            results: data 
        }

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/save-calculated`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify(payload)
        })

        if (res.ok) {
            toast.success(`تم الحفظ بنجاح (الدورة: ${targetCourse} - الدفعة: ${targetBatch})`)
            setIsSaveDialogOpen(false)
        } else {
            toast.error("فشل الحفظ")
        }
    } catch (e) {
        toast.error("خطأ في الاتصال")
    } finally {
        setIsSaving(false)
    }
}
 // في ملف ResultsPage.tsx

const handleRecalculate = async () => {
  setLoading(true)
  // تنظيف الكونسول للمراقبة
  console.clear();
  console.log("%c🚀 بدء عملية التحديث", "color: orange; font-weight: bold; font-size: 14px;");

  try {
    // أ. جلب أحدث إعدادات من السيرفر (بدون كاش)
    const settingsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings`, {
      cache: 'no-store',
      headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
    })
    
    const latestSettings = await settingsRes.json()
    console.log("1️⃣ الإعدادات الجديدة المعتمدة:", latestSettings);

    // ب. تجهيز البيانات للإرسال
    const payload = {
      distance: Number(latestSettings.distance),
      pass_rate: Number(latestSettings.pass_rate),
      base_score: Number(latestSettings.base_score),
      mercy_mode: latestSettings.mercy_mode
    };

    // ج. طلب إعادة الحساب من السيرفر
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/recalculate`, { 
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify(payload)
    })

    if (res.ok) { 
      // 🟢 الخطوة الذكية: نمرر المعيار الجديد لدالة الجلب فوراً
      // هذا يجبر الجدول على تغيير شكله (إظهار/إخفاء الأعمدة) في نفس لحظة وصول البيانات
      await fetchResults({ base_score: Number(latestSettings.base_score) }); 
      
      toast.success(`تم تحديث الحسابات بنجاح (المعيار: ${latestSettings.base_score})`) 
    } else { 
      toast.error("فشل التحديث من السيرفر") 
    }
  } catch (e) { 
    console.error(e);
    toast.error("فشل الاتصال") 
  } finally { 
    setLoading(false) 
  }
}

  const handlePrint = () => {
    document.title = examName || "تقرير اللياقة"
    window.print()
  }

  const handleDownloadExcel = () => {
    const fileName = examName || "النتائج_النهائية"
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/export/excel?filename=${encodeURIComponent(fileName)}`
  }

  // --- القوائم الفريدة للفلاتر ---
  const uniqueCourses = useMemo(() => [...new Set(data.map(item => item['اسم الدورة']).filter(Boolean))], [data])
  const uniqueCompanies = useMemo(() => [...new Set(data.map(item => item['السرية']).filter(Boolean))], [data])
  const uniquePlatoons = useMemo(() => [...new Set(data.map(item => item['الفصيل']).filter(Boolean))], [data])
  const uniqueGrades = useMemo(() => [...new Set(data.map(item => item['grade']).filter(Boolean))], [data])

  // --- معالجة البيانات (فلترة وترتيب) ---
  const processedData = useMemo(() => {
    let filtered = [...data]
    if (search) {
      const lowerSearch = search.toLowerCase()
      filtered = filtered.filter((item) => Object.values(item).some(val => String(val).toLowerCase().includes(lowerSearch)))
    }
    if (filterCourse !== "all") filtered = filtered.filter(i => i['اسم الدورة'] === filterCourse)
    if (filterCompany !== "all") filtered = filtered.filter(i => i['السرية'] === filterCompany)
    if (filterPlatoon !== "all") filtered = filtered.filter(i => i['الفصيل'] === filterPlatoon)
    if (filterGrade !== "all") filtered = filtered.filter(i => i['grade'] === filterGrade)
    if (filterResult !== "all") filtered = filtered.filter(i => i['final_result'] === filterResult)
    if (sortConfig) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key]; const bValue = b[sortConfig.key]
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }
    return filtered
  }, [data, search, filterCourse, filterCompany, filterPlatoon, filterGrade, filterResult, sortConfig])

  // --- بيانات العرض التفاعلي (Pagination) ---
  const paginatedData = processedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  const totalPages = Math.ceil(processedData.length / itemsPerPage)

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
  }

  const resetFilters = () => {
    setSearch(""); setFilterCourse("all"); setFilterCompany("all"); 
    setFilterPlatoon("all"); setFilterGrade("all"); setFilterResult("all"); setCurrentPage(1);
  }

 // --- إعدادات الطباعة المطورة ---
  let targetKeys = ORDERED_KEYS
  let currentMapping = { ...DEFAULT_MAPPING }
  const isLandscape = reportType === 'general';
  
  // 🟢 استخراج المعيار الحقيقي من أول سجل في البيانات (سواء مسودة أو إكسل)
// 🟢 التعديل المضمون لقراءة المعيار من البيانات مباشرة
const effectiveBaseScore = data.length > 0 && (data[0].base_score || data[0]['base_score']) 
    ? Number(data[0].base_score || data[0]['base_score']) 
    : baseScore;

  if (reportType === 'union') {
    targetKeys = LIST_UNION
  } 
  else if (reportType === 'control') {
    // 1. الأعمدة الأساسية التي تظهر دائماً في الكنترول
    let controlKeys = ['الرتبة', 'الرقم العسكري', 'الإسم'];

    // 2. 🟢 إضافة السرية والفصيل "ديناميكياً" إذا كانا يحتويان على بيانات
    const hasCompany = data.some(row => row['السرية'] && row['السرية'] !== "");
    const hasPlatoon = data.some(row => row['الفصيل'] && row['الفصيل'] !== "");

    if (hasCompany) controlKeys.push('السرية');
    if (hasPlatoon) controlKeys.push('الفصيل');

    // 3. إضافة الدرجة النهائية
    controlKeys.push('الدرجة النهائية');

    // 4. فحص المعيار: إذا كان 90، نضيف عمود درجة المدرب
    if (effectiveBaseScore === 90) {
      controlKeys.push('درجة المدرب');
      currentMapping['الدرجة النهائية'] = 'الدرجة (90%)';
      currentMapping['درجة المدرب'] = 'درجة المدرب (10%)';
    } else {
      currentMapping['الدرجة النهائية'] = 'الدرجة (100%)';
    }

    // 5. إضافة الملاحظات في النهاية
    controlKeys.push('ملاحظات');
    
    targetKeys = controlKeys;
  }

  // تصفية الصفوف: إظهار جميع الطلاب دون استثناء في كل أنواع التقارير
  const printableRows = processedData;

  // الأعمدة المرئية للطباعة
  const printVisibleColumns = targetKeys.filter(key => {
    if (key === 'trainer_score' && reportType === 'control' && baseScore === 90) return true;
    return printableRows.some(row => {
        const val = row[key];
        return val !== "" && val !== null && val !== 0 && val !== undefined;
    })
  })

  
const screenVisibleColumns = useMemo(() => {
    if (data.length === 0) return []

    // 1. الترتيب الصارم الذي تريده
    const myExactOrder = [
      'الدفعة',
      'السرية', 
      'الفصيل',
      'الرتبة', 
      'الرقم العسكري', 
      'الإسم', 
       'العمر',
      'الجري', 
      'درجة الجري', 
      'تقدير الجري', 
      'الضغط', 
      'درجة الضغط', 
      'تقدير الضغط', 
      'البطن', 
      'درجة البطن', 
      'تقدير البطن', 
      'الدرجة النهائية', 
      'التقدير العام', 
      'النتيجة', 
      'ملاحظات',
      'درجة المدرب'
    ]

    // 2. قائمة الحجب للبيانات التقنية والإنجليزية
    const ignoredKeys = [
      'dob', 'تاريخ الميلاد', 'exam_title', 'status', 'الحالة', 
      'is_special_row', 'config_details', 'created_at', 'base_score', 
      'soldier_id', 'id', 'military_id', 'name', 'rank', 'average', 
      'grade', 'final_result', 'trainer_score',
      'batch', 'company', 'platoon', 'course', 'اسم الدورة'
    ]

    // 🟢 استخراج المعيار الفعلي من أول سجل لضمان دقة الشرط
    const currentBase = data[0].base_score || baseScore;

    const allKeysInData = Object.keys(data[0])
    
    // 3. بناء القائمة النهائية مع شروط الحذف الذكي
    return myExactOrder.filter(key => {
      // أ- التحقق من وجود المفتاح في البيانات وعدم وجوده في قائمة الحجب
      if (!allKeysInData.includes(key) || ignoredKeys.includes(key)) return false;

      // ب- 🛑 شرط درجة المدرب: تختفي إذا كان المعيار 100
      if (key === 'درجة المدرب' && Number(currentBase) === 100) return false;

      // ج- 🛑 شرط الأعمدة الفارغة: لا يظهر العمود إذا كان فارغاً في كل الصفوف
      const hasData = data.some(row => {
        const val = row[key];
        // نعتبر العمود فارغاً إذا كانت القيمة null، undefined، نص فارغ، أو أصفاراً لا معنى لها
        return val !== null && val !== undefined && val !== "" && val !== 0 && val !== "0" && val !== "-";
      });

      return hasData;
    });
  }, [data, baseScore]) // أضفنا baseScore هنا لضمان تحديث الجدول فور تغيير الإعدادات

  const getCellClass = (key: string, value: any) => {
    const valStr = String(value)
    if (valStr.includes('ممتاز')) return 'text-[#7030a0] font-extrabold' 
    if (valStr.includes('راسب') || valStr === 'Fail') return 'text-red-600 font-bold'
    if (key === 'average') return 'font-bold text-blue-600 dark:text-blue-400'
    return ''
  }

  // ثوابت تصميم الطباعة
  const fontSizeClass = isLandscape ? "text-[10px]" : "text-[11px]";
  const cellPaddingClass = isLandscape ? "p-[2px]" : "p-2"; 
  const colSpanCount = printVisibleColumns.length + 1;

  // تحديد من نظهر توقيعه
  const showRight = rightName.trim() !== "";
  const showMid = midName.trim() !== "";
  const showLeft = leftName.trim() !== "";

  return (
<ProtectedRoute allowedRoles={["owner","assistant_admin"]}>
    <div className="space-y-6 pb-10 md:pb-24 max-w-full overflow-x-hidden" dir="rtl">
      
      {/* القسم العلوي */}
      <div className="print:hidden space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
               <h1 className="text-3xl font-bold text-slate-900 dark:text-white">سجل النتائج {baseScore === 90 && <span className="text-sm text-orange-600 bg-orange-100 px-2 py-1 rounded-full mr-2">نظام 90 درجة</span>}</h1>
               <p className="text-slate-500 dark:text-slate-400">عرض {processedData.length} سجل</p>
            </div>
            <div className="grid grid-cols-2 md:flex md:flex-row gap-2 w-full md:w-auto">
            
            {/* 👇 زر الحفظ الجديد */}
            <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700 text-white gap-2">
                    <Save className="w-4 h-4" /> حفظ للأرشيف
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>حفظ النتائج في السجل الدائم</DialogTitle>
                  <DialogDescription>
                    سيتم حفظ هذه النتائج في صفحة "نتائج اللياقة" للرجوع إليها لاحقاً.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label>عنوان الاختبار</Label>
                    <Input 
                        value={saveTitle} 
                        onChange={(e) => setSaveTitle(e.target.value)} 
                        placeholder="مثال: اختبار اللياقة النهائي - الدفعة الرابعة"
                        className="mt-2"
                    />
                </div>
                <DialogFooter>
                    <Button onClick={handleSaveToArchive} disabled={isSaving} className="bg-green-600 hover:bg-green-700 w-full">
                        {isSaving ? "جاري الحفظ..." : "تأكيد الحفظ"}
                    </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button variant="outline" onClick={handleRecalculate} className="gap-2"><RefreshCcw className="w-4 h-4" /> تحديث</Button>
            <Button variant="outline" onClick={handleDownloadExcel} className="gap-2"><Download className="w-4 h-4" /> Excel</Button>
            <Button onClick={handlePrint} className="bg-slate-900 text-white gap-2 hover:bg-slate-800"><Printer className="w-4 h-4" /> طباعة</Button>
            </div>
        </div>

        {/* كارت إعدادات التقرير */}
        <Card className="bg-slate-50 dark:bg-slate-900/50 border-dashed border-2 border-slate-300 dark:border-slate-700">
            <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2"><FileText className="w-5 h-5 text-blue-600" />إعدادات التقرير (للطباعة)</CardTitle>
            </CardHeader>
            <CardContent>
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label className="text-xs text-slate-500">نوع التقرير</Label>
                        <Select value={reportType} onValueChange={setReportType}>
                            <SelectTrigger className="bg-white dark:bg-slate-900 text-right" dir="rtl"><SelectValue /></SelectTrigger>
                            <SelectContent align="end">
                            <SelectItem value="general">عام (التدريب الرياضي)</SelectItem>
                            <SelectItem value="union">الاتحاد الرياضي</SelectItem>
                            <SelectItem value="control">مكتب الكنترول</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    
                    <div className="space-y-2">
                        <Label className="text-xs text-slate-500">اسم الاختبار (السطر 2)</Label>
                        <div className="relative">
                            <GraduationCap className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input className="pr-9 bg-white dark:bg-slate-900" value={examName} onChange={(e) => setExamName(e.target.value)} placeholder="اختبار ترقي..." />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs text-slate-500">اسم المادة (السطر 3)</Label>
                        <div className="relative">
                            <BookOpen className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input className="pr-9 bg-white dark:bg-slate-900" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="لياقة بدنية..." />
                        </div>
                    </div>
                </div>

                <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 border rounded bg-white dark:bg-slate-950 space-y-2">
                        <h3 className="font-bold text-xs text-slate-400 mb-2">الطرف الأيمن (مدخل البيانات)</h3>
                        <Input className="h-8 text-xs" value={rightTitle} onChange={(e) => setRightTitle(e.target.value)} placeholder="المسمى..." />
                        <Input className="h-8 text-xs" value={rightName} onChange={(e) => setRightName(e.target.value)} placeholder="الاسم..." />
                    </div>
                    <div className="p-3 border rounded bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900 space-y-2">
                        <h3 className="font-bold text-xs text-blue-500 mb-2">المنتصف (رئيس القسم)</h3>
                        <Input className="h-8 text-xs" value={midTitle} onChange={(e) => setMidTitle(e.target.value)} placeholder="المسمى..." />
                        <Input className="h-8 text-xs" value={midName} onChange={(e) => setMidName(e.target.value)} placeholder="الاسم..." />
                    </div>
                    <div className="p-3 border rounded bg-white dark:bg-slate-950 space-y-2">
                        <h3 className="font-bold text-xs text-slate-400 mb-2">الطرف الأيسر (الضابط)</h3>
                        <Input className="h-8 text-xs" value={leftTitle} onChange={(e) => setLeftTitle(e.target.value)} placeholder="المسمى..." />
                        <Input className="h-8 text-xs" value={leftName} onChange={(e) => setLeftName(e.target.value)} placeholder="الاسم..." />
                    </div>
                </div>
            </div>
            </CardContent>
        </Card>

        {/* الفلاتر */}
        <Card className="border-t-4 border-t-blue-600 shadow-sm">
            <CardContent className="p-4 space-y-4">
            <div className="flex gap-2">
                <div className="relative flex-1">
                <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                <Input placeholder="بحث سريع..." className="pr-10 bg-slate-50 dark:bg-slate-900" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <Button variant="ghost" onClick={resetFilters} className="text-red-500"><X className="w-4 h-4 ml-1" />مسح</Button>
            </div>
            <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-5 gap-3">
                <Select value={filterCourse} onValueChange={setFilterCourse}><SelectTrigger className="text-right" dir="rtl"><SelectValue placeholder="الدورة" /></SelectTrigger><SelectContent align="end"><SelectItem value="all">الكل</SelectItem>{uniqueCourses.map((c:any)=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                <Select value={filterCompany} onValueChange={setFilterCompany}><SelectTrigger className="text-right" dir="rtl"><SelectValue placeholder="السرية" /></SelectTrigger><SelectContent align="end"><SelectItem value="all">الكل</SelectItem>{uniqueCompanies.map((c:any)=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                <Select value={filterPlatoon} onValueChange={setFilterPlatoon}><SelectTrigger className="text-right" dir="rtl"><SelectValue placeholder="الفصيل" /></SelectTrigger><SelectContent align="end"><SelectItem value="all">الكل</SelectItem>{uniquePlatoons.map((c:any)=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                <Select value={filterGrade} onValueChange={setFilterGrade}><SelectTrigger className="text-right" dir="rtl"><SelectValue placeholder="التقدير" /></SelectTrigger><SelectContent align="end"><SelectItem value="all">الكل</SelectItem>{uniqueGrades.map((c:any)=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                <Select value={filterResult} onValueChange={setFilterResult}><SelectTrigger className="text-right" dir="rtl"><SelectValue placeholder="النتيجة" /></SelectTrigger><SelectContent align="end"><SelectItem value="all">الكل</SelectItem><SelectItem value="Pass" className="text-green-600">ناجح</SelectItem><SelectItem value="Fail" className="text-red-600">راسب</SelectItem></SelectContent></Select>
            </div>
            </CardContent>
        </Card>

        {/* الجدول التفاعلي (للشاشة) */}
        <div className="border rounded-lg bg-white dark:bg-slate-900 overflow-hidden shadow-sm overflow-x-auto">
            <Table>
            <TableHeader className="bg-slate-100 dark:bg-slate-800">
                <TableRow>
                <TableHead className="w-[50px] text-center font-bold bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white">#</TableHead>
                {screenVisibleColumns.map((key) => (
                    <TableHead key={key} className="text-right font-bold whitespace-nowrap cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200" onClick={() => handleSort(key)}>
                    <div className="flex items-center gap-1">{SCREEN_COLUMN_MAPPING[key] || key}{sortConfig?.key === key && <ArrowUpDown className="w-3 h-3 text-blue-500" />}</div>
                    </TableHead>
                ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading ? (
                <TableRow><TableCell colSpan={screenVisibleColumns.length + 1} className="h-24 text-center">جارِ التحميل...</TableCell></TableRow>
                ) : paginatedData.length === 0 ? (
                <TableRow><TableCell colSpan={screenVisibleColumns.length + 1} className="h-24 text-center text-slate-500">لا توجد نتائج.</TableCell></TableRow>
                ) : (
                paginatedData.map((row, index) => (
                    <TableRow key={index} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 group ${row.is_special_row ? 'bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/20' : ''}`}>
                    <TableCell className="text-center text-slate-500 font-mono text-xs">{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
                    {screenVisibleColumns.map((key) => (
                        <TableCell key={key} className={`text-right whitespace-nowrap py-3 text-sm ${getCellClass(key, row[key])}`}>
                        {key === 'final_result' ? (
                            (row[key] !== 'Pass' && row[key] !== 'Fail') ? (
                            <span className="font-bold text-slate-700 dark:text-slate-300">{row[key]}</span>
                            ) : (
                            <Badge variant={row[key] === 'Pass' ? 'default' : 'destructive'} 
                                className={row[key] === 'Pass' ? 'bg-green-100 text-green-800 hover:bg-green-200' : ''}>
                                {row[key] === 'Pass' ? 'ناجح' : 'راسب'}
                            </Badge>
                            )
                        ) : String(row[key]).includes('ممتاز') ? (
                            <Badge className="bg-[#7030a0] text-white hover:bg-[#7030a0]/90 font-bold">{row[key]}</Badge>
                        ) : key === 'average' ? (
                            <span className="font-bold text-blue-600 dark:text-blue-400">{isNaN(Number(row[key])) ? row[key] : `${Number(row[key]).toFixed(2)}%`}</span>
                        ) : (
                            <span className={String(row[key]).includes('راسب') ? 'text-red-600 font-bold' : ''}>{row[key]}</span>
                        )}
                        </TableCell>
                    ))}
                    </TableRow>
                ))
                )}
            </TableBody>
            </Table>
        </div>

        {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 border rounded-lg shadow-sm">
            <div className="text-sm text-slate-500">صفحة <b>{currentPage}</b> من <b>{totalPages}</b></div>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}><ChevronRight className="w-4 h-4 ml-1" />السابق</Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>التالي<ChevronLeft className="w-4 h-4 mr-1" /></Button>
            </div>
            </div>
        )}
      </div>

      {/* -------------------------------------------------------------------------------- */}
      {/* القسم الثاني: واجهة الطباعة المخفية (تظهر فقط عند الطباعة) */}
      {/* -------------------------------------------------------------------------------- */}
      <div className="hidden print:block font-sans text-black bg-white">
        
        {/* Style للتحكم في اتجاه الورقة */}
        <style type="text/css" media="print">
            {`
                @page { 
                    size: ${isLandscape ? 'A4 landscape' : 'A4 portrait'}; 
                    margin: 0mm 5mm 0mm 5mm;
                    
                }
            `}
        </style>

        <div className="flex-grow print:w-full print:h-auto">
            <table className={`w-full border-collapse ${fontSizeClass} print:w-full`}>
            <thead>
                <tr>
                <th colSpan={colSpanCount} className="border-0 pb-0">
                    <div className="flex justify-between items-center border-b-2 border-slate-800 pb-4 mb-2 w-full">
                        <div className="w-24 h-24 relative">
                            <img src="/logo.jpg" alt="Logo" className="w-full h-full object-contain" />
                        </div>
                        <div className="text-center flex flex-col items-center gap-1">
                            <h2 className="text-lg font-bold text-slate-600">معهد الشرطة - قسم التدريب العسكري والرياضي</h2>
                            <h2 className="text-sm font-bold text-slate-600">- فرع التدريب الرياضي-</h2>
                            <h1 className={`font-bold text-blue-800 underline decoration-blue-800 decoration-2 underline-offset-8 print:text-blue-800 ${isLandscape ? 'text-2xl' : 'text-xl'}`}>
                                {examName}
                            </h1>
                            <h3 className="text-lg font-bold text-red-600 print:text-red-600 mt-1">
                                {subjectName}
                            </h3>
                        </div>
                        <div className="text-left text-sm font-bold">
                            <p>تاريخ الطباعة:</p>
                            <p dir="ltr">{format(new Date(), "yyyy-MM-dd")}</p>
                        </div>
                    </div>
                </th>
                </tr>

                <tr className="bg-[#c5b391] print:bg-[#c5b391]">
                {/* تغيير حدود الرقم التسلسلي */}
<th className={`border border-black ${cellPaddingClass} w-8 font-bold text-black`}>#</th>

{/* تغيير حدود بقية رؤوس الأعمدة */}
{printVisibleColumns.map((key) => (
    <th key={key} className={`border border-black ${cellPaddingClass} text-center font-bold whitespace-nowrap text-black`}>
        {currentMapping[key] || key}
    </th>
))}
                </tr>
            </thead>

            <tbody>
                {printableRows.map((row, index) => (
                <tr key={index} className={row.is_special_row ? 'bg-yellow-100 print:bg-yellow-100' : ''}>
                    <td className={`border border-black ${cellPaddingClass} text-center font-bold text-black`}>{index + 1}</td>
                    {printVisibleColumns.map((key) => (
                   <td key={key} className={`border border-black ${cellPaddingClass} text-center whitespace-nowrap font-bold text-black`}>
    {(() => {
        // 1. معالجة عمود النتيجة النهائية
        if (key === 'final_result') {
            return row[key] === 'Pass' ? <span className="text-green-700 print:text-green-700">ناجح</span> :
                   row[key] === 'Fail' ? <span className="text-red-600 print:text-red-600">راسب</span> :
                   <span>{row[key]}</span>;
        }

        // 2. معالجة عمود تاريخ الميلاد (حل مشكلة 33940)
        if (key === 'تاريخ الميلاد' || key === 'dob') {
            const val = row[key];
            if (!val || val === "" || val === "-") return "-";
            
            // إذا كان الرقم هو الرقم التسلسلي لإكسل (5 خانات تقريباً)
            if (typeof val === 'number' || (!isNaN(Number(val)) && String(val).length <= 5)) {
                try {
                    const date = new Date(Math.round((Number(val) - 25569) * 86400 * 1000));
                    return <span>{format(date, "yyyy-MM-dd")}</span>;
                } catch (e) { return <span>{val}</span>; }
            }
            return <span>{val}</span>;
        }

        // 3. معالجة الدرجة النهائية (المعدل %)
        if (key === 'average') {
            return <span>{isNaN(Number(row[key])) ? row[key] : `${Number(row[key]).toFixed(2)}%`}</span>;
        }

        // 4. معالجة درجة المدرب (10%)
        if (key === 'trainer_score') {
            return (
                <span className="font-bold">
                    {(row[key] && String(row[key]).trim() !== "" && String(row[key]).trim() !== "-") 
                        ? row[key] 
                        : "-"}
                </span>
            );
        }

        // 5. معالجة الملاحظات
        if (key === 'notes') {
            return <span>{row[key] || ""}</span>;
        }

        // 6. معالجة التلوين لتقدير (ممتاز) أو (راسب) في أي عمود آخر
        const valStr = String(row[key]);
        if (valStr.includes('ممتاز')) {
            return <span className="text-[#7030a0] print:text-[#7030a0]">{row[key]}</span>;
        }
        if (valStr.includes('راسب')) {
            return <span className="text-red-600 print:text-red-600">{row[key]}</span>;
        }

        // 7. القيمة الافتراضية لأي عمود آخر
        return row[key];
    })()}
</td>
                    ))}
                </tr>
                ))}
            </tbody>
            </table>
        </div>

        
       {/* قسم التوقيعات */}
        {/* قسم التوقيعات - نسخة الطباعة */}
        <div className="mt-10 pt-4 break-inside-avoid page-break-inside-avoid w-full print:block">
            
            {/* السطر الأول: اليمين واليسار */}
            <div className="flex justify-between px-10 w-full mb-8">
                {/* اليمين (مدخل البيانات) */}
                <div className={`text-center flex flex-col items-center gap-2 min-w-[200px] shrink-0 ${!showRight ? 'invisible' : ''}`}>
                    <p className="font-bold text-base underline underline-offset-4">{rightTitle}</p>
                    <p className="font-bold text-sm mt-2">{rightName}</p>
                    
                    {/* هنا تم استخدام الكلاس الموحد */}
                    <div className={signatureBoxClass}>
                        {signatureUrl ? (
                            <img src={signatureUrl} alt="Signature" className="w-full h-full object-contain p-1" />
                        ) : (
                            <span className="text-slate-400 text-xs">(التوقيع)</span>
                        )}
                    </div>
                </div>
                
                {/* اليسار (الضابط) */}
                <div className={`text-center flex flex-col items-center gap-2 min-w-[200px] shrink-0 ${!showLeft ? 'invisible' : ''}`}>
                    <p className="font-bold text-base underline underline-offset-4">{leftTitle}</p>
                    <p className="font-bold text-sm mt-2">{leftName}</p>
                    
                    {/* هنا تم استخدام الكلاس الموحد */}
                    <div className={signatureBoxClass}>
                        <span className="text-slate-400 text-xs">(التوقيع)</span>
                    </div>
                </div>
            </div>

            {/* السطر الثاني: الوسط (رئيس القسم) */}
            {showMid && (
                <div className="flex justify-center w-full mt-4">
                    <div className="text-center flex flex-col items-center gap-2 min-w-[300px] shrink-0">
                        <p className="font-bold text-base underline underline-offset-4">{midTitle}</p>
                        <p className="font-bold text-sm mt-2">{midName}</p>
                        
                        {/* هنا تم استخدام الكلاس الموحد */}
                        <div className={signatureBoxClass}>
                            <span className="text-slate-400 text-xs">(التوقيع)</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>

    </div>
    </ProtectedRoute>
  )
}