"use client"

import { useEffect, useState, useMemo } from "react"
import Image from "next/image"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Printer, RefreshCcw, Users, UserCheck, UserX, Activity, FileText } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import ProtectedRoute from "@/components/ProtectedRoute"
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, PieChart, Pie, Cell, LabelList 
} from 'recharts';

// === بيانات تجريبية ===
const MOCK_DATA = Array.from({ length: 50 }, (_, i) => ({
  'اسم الدورة': i < 25 ? 'دورة الصاعقة' : 'دورة المشاة',
  'السرية': i < 25 ? 'الأولى' : 'الثانية',
  'الفصيل': i < 12 ? 'فصيل 1' : 'فصيل 2',
  'grade': i % 5 === 0 ? 'ممتاز' : i % 3 === 0 ? 'جيد جدا' : 'جيد',
  'run_grade': i % 4 === 0 ? 'ممتاز' : 'جيد',
  'push_grade': i % 3 === 0 ? 'جيد جدا' : 'مقبول',
  'sit_grade': i % 2 === 0 ? 'ممتاز' : 'جيد',
  'final_result': i % 10 === 0 ? 'Fail' : 'Pass',
  'notes': i === 0 ? 'رأفة' : ''
}));

const COLORS = {
  run: "#5B9BD5",
  push: "#ED7D31",
  sit: "#A5A5A5",
  success: "#00C49F",
  fail: "#FF8042"
};

const RADIAN = Math.PI / 180;

type StatRow = {
  label: string;
  excellent: number; veryGood: number; good: number; pass: number;
  successCount: number; failCount: number; totalPresent: number;
  mercy: number; absent: number; exempt: number; medical: number;
  clinic: number; rest: number; vacation: number; attached: number;
  totalForce: number;
}

export default function StatisticsPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isUsingMock, setIsUsingMock] = useState(false)

  const [filterCourse, setFilterCourse] = useState("all")
  const [filterCompany, setFilterCompany] = useState("all")
  const [filterPlatoon, setFilterPlatoon] = useState("all")
// استخراج المعايير من أول سجل متاح
const testSettings = useMemo(() => {
    if (data.length > 0) {
        return {
            distance: data[0].distance || 3200,
            baseScore: data[0].base_score || 100,
            mercyMode: data[0].mercy_mode ? "مفعّـل" : "معطّـل"
        };
    }
    return { distance: 3200, baseScore: 100, mercyMode: "معطّـل" };
}, [data]);
  const [reportTitle, setReportTitle] = useState("الدفعة....السرية....الفصيل....")
  const [reportSummary, setReportSummary] = useState("")
  const [dataEntryName, setDataEntryName] = useState("")
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  useEffect(() => {
    const checkSignature = async () => {
        try {
            // تعديل الرابط هنا
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/static/signature.png?t=${new Date().getTime()}`)
            if (res.ok) {
                // وتعديل الرابط هنا
                setSignatureUrl(`${process.env.NEXT_PUBLIC_API_URL}/static/signature.png?t=${new Date().getTime()}`)
            }
        } catch (e) { console.log("No signature") }
    }
    checkSignature();
  }, [])
  
  useEffect(() => { fetchResults() }, [])

  const fetchResults = async () => {
    setLoading(true)
    try {
      // تعديل الرابط هنا
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/results`)
      if (res.ok) {
        const json = await res.json()
        if (json.data && json.data.length > 0) {
            setData(json.data)
            setIsUsingMock(false)
        } else {
            setData(MOCK_DATA)
            setIsUsingMock(true)
            toast.info("تم تحميل بيانات تجريبية")
        }
      } else {
        setData(MOCK_DATA)
        setIsUsingMock(true)
      }
    } catch (error) { 
        setData(MOCK_DATA)
        setIsUsingMock(true)
        toast.error("فشل الاتصال - بيانات تجريبية") 
    } finally { setLoading(false) }
  }
// تعريف متغير لتغيير عرض الرسم تلقائياً
const [dynamicWidth, setDynamicWidth] = useState(500); 

useEffect(() => {
    const updateWidth = () => {
        // إذا كان عرض الشاشة أقل من 1024 (تابلت وأصغر) نجعل العرض 450
        if (window.innerWidth < 1024) {
            setDynamicWidth(450);
        } else {
            setDynamicWidth(500); // للحاسوب
        }
    };

    updateWidth(); // تشغيل عند التحميل
    window.addEventListener("resize", updateWidth); // تحديث عند تغيير حجم الشاشة
    return () => window.removeEventListener("resize", updateWidth);
}, []);
  // تنبيه: إذا كانت دالة handleRecalculate موجودة في نفس الملف، لا تنسَ تعديل الرابط فيها أيضاً:
 const handleRecalculate = async () => {
    if(isUsingMock) { toast.error("بيانات تجريبية"); return; }
    setLoading(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/recalculate`, { method: "POST" })
      if (res.ok) { 
          await fetchResults(); 
          // تعديل الرسالة هنا
          toast.success("تم تحديث الإحصائيات", {
              description: "تم تحديث جميع الأرقام والنسب المئوية بنجاح.",
          }) 
      } 
      else { toast.error("فشل التحديث") }
    } catch (e) { toast.error("فشل الاتصال") } finally { setLoading(false) }
  }

  const uniqueCourses = useMemo(() => [...new Set(data.map(item => item['اسم الدورة']).filter(Boolean))], [data])
  
  const uniqueCompanies = useMemo(() => {
    let filtered = data
    if (filterCourse !== "all") filtered = filtered.filter(i => i['اسم الدورة'] === filterCourse)
    return [...new Set(filtered.map(item => item['السرية']).filter(Boolean))]
  }, [data, filterCourse])

  const uniquePlatoons = useMemo(() => {
    let filtered = data
    if (filterCourse !== "all") filtered = filtered.filter(i => i['اسم الدورة'] === filterCourse)
    if (filterCompany !== "all") filtered = filtered.filter(i => i['السرية'] === filterCompany)
    return [...new Set(filtered.map(item => item['الفصيل']).filter(Boolean))]
  }, [data, filterCourse, filterCompany])

  const stats = useMemo(() => {
    let filteredData = data
    if (filterCourse !== "all") filteredData = filteredData.filter(i => i['اسم الدورة'] === filterCourse)
    if (filterCompany !== "all") filteredData = filteredData.filter(i => i['السرية'] === filterCompany)
    if (filterPlatoon !== "all") filteredData = filteredData.filter(i => i['الفصيل'] === filterPlatoon)

    const categories = [
      { key: 'general', label: 'إختبار عام', gradeKey: 'grade' },
      { key: 'run', label: 'جري', gradeKey: 'run_grade' },
      { key: 'push', label: 'ضغط', gradeKey: 'push_grade' },
      { key: 'sit', label: 'بطن', gradeKey: 'sit_grade' },
    ]

    return categories.map(cat => {
      let row: StatRow = {
        label: cat.label,
        excellent: 0, veryGood: 0, good: 0, pass: 0,
        successCount: 0, failCount: 0, totalPresent: 0,
        mercy: 0, absent: 0, exempt: 0, medical: 0,
        clinic: 0, rest: 0, vacation: 0, attached: 0,
        totalForce: filteredData.length
      }

      filteredData.forEach(item => {
        const gradeAr: Record<string, string> = { run_grade: 'تقدير الجري', push_grade: 'تقدير الضغط', sit_grade: 'تقدير البطن', grade: 'التقدير العام' }
        const grade = String(item[cat.gradeKey] || item[gradeAr[cat.gradeKey]] || "").trim()
        const notes = String(item.notes || item["ملاحظات"] || "").trim()
        const status = String(item.status || "").trim()
        const finalRes = String(item.final_result || "").trim()

        // 1. فرز الحالات الخاصة (الاستبعادات من الحضور الفعلي)
        if (notes.includes("غياب") || status.toLowerCase() === "absent") { row.absent++; return }
        if (notes.includes("إعفاء") || status.toLowerCase() === "exempt") { row.exempt++; return }
        if (notes.includes("طبية") || notes.includes("طبي")) { row.medical++; return }
        if (notes.includes("عيادة")) { row.clinic++; return }
        if (notes.includes("لم يكمل") || notes.includes("قطع مسار") || notes.includes("قطع")) { 
    row.rest++;
    row.failCount++; // لم يكمل = راسب أيضاً
    return; // يخرج هنا فلا يُحسب كناجح أو راسب
}
        if (notes.includes("إجازة")) { row.vacation++; return }
        if (notes.includes("ملحق")) { row.attached++; return }

        // 2. احتساب الحضور الفعلي لمن لم يكن لديه حالة خاصة
        row.totalPresent++;

        // 3. تصنيف التقديرات (بناءً على النصوص العربية الواردة من السيرفر)
        if (grade.includes("ممتاز")) row.excellent++
        else if (grade.includes("جيد جدا")) row.veryGood++
        else if (grade.includes("جيد")) row.good++
        else if (grade.includes("مقبول")) row.pass++
        
        // 🟢 4. منطق النجاح والرسوب الجديد (الاعتماد على السيرفر)
        let isPass = false;
        
        if (cat.key === 'general') {
          // للاختبار العام: نعتمد حصراً على قرار السيرفر في حقل النتيجة النهائية
          isPass = finalRes.toLowerCase() === 'pass' || finalRes === 'ناجح';
        } else {
          // للاختبارات الفرعية (جري، ضغط، بطن): نعتمد على عدم وجود كلمة "راسب" ووجود تقدير حقيقي
          isPass = !grade.includes("راسب") && grade !== "" && grade !== "None" && grade !== "nan";
        }

        if (isPass) {
          row.successCount++
        } else {
          row.failCount++
        }

        // 5. احتساب حالات الرأفة بدقة حسب المادة
        if (item.notes && item.notes.includes("رأفة")) {
          if (cat.key === 'general') row.mercy++;
          else if (cat.key === 'run' && item.notes.includes("رأفة جري")) row.mercy++;
          else if (cat.key === 'push' && item.notes.includes("رأفة ضغط")) row.mercy++;
          else if (cat.key === 'sit' && item.notes.includes("رأفة بطن")) row.mercy++;
        }
      })
      return row
    })
  }, [data, filterCourse, filterCompany, filterPlatoon])

  const generalStats = stats[0] 
  const runStats = stats[1]
  const pushStats = stats[2]
  const sitStats = stats[3]

  // دالة حساب النسبة الذكية
  const getSmartPct = (val: number, row: StatRow, type: 'grade' | 'status') => {
    if (type === 'grade') {
        return row.totalPresent === 0 ? "0%" : ((val / row.totalPresent) * 100).toFixed(1) + "%";
    } else {
        return row.totalForce === 0 ? "0%" : ((val / row.totalForce) * 100).toFixed(1) + "%";
    }
  }

  let dynamicTitle = "إحصـائيـات";
  if (filterCourse !== "all") {
    dynamicTitle = `نتائج ${filterCourse}`;
    if (filterCompany !== "all") dynamicTitle += ` / ${filterCompany}`;
    if (filterPlatoon !== "all") dynamicTitle += ` / ${filterPlatoon}`;
  }

  const chartData = [
    { name: 'ممتاز', الجري: runStats.excellent, الضغط: pushStats.excellent, البطن: sitStats.excellent },
    { name: 'جيد جدا', الجري: runStats.veryGood, الضغط: pushStats.veryGood, البطن: sitStats.veryGood },
    { name: 'جيد', الجري: runStats.good, الضغط: pushStats.good, البطن: sitStats.good },
    { name: 'مقبول', الجري: runStats.pass, الضغط: pushStats.pass, البطن: sitStats.pass },
  ];

  const pieData = [
    { name: 'ممتاز', value: generalStats.excellent, fill: '#7030a0' },
    { name: 'جيد جدا', value: generalStats.veryGood, fill: '#2563eb' },
    { name: 'جيد', value: generalStats.good, fill: '#16a34a' },
    { name: 'مقبول', value: generalStats.pass, fill: '#eab308' },
    { name: 'راسب', value: generalStats.failCount, fill: '#dc2626' }
  ].filter(item => item.value > 0);

  return (
    <ProtectedRoute allowedRoles={["owner","assistant_admin"]}>
    <div className="space-y-2 p-2 md:p-4 pb-14 md:pb-24" dir="rtl">
      
      {/* 1. واجهة الشاشة */}
      <div className="space-y-4 print:hidden">
        {isUsingMock && <div className="bg-yellow-100 text-yellow-800 p-2 text-center text-xs rounded">⚠️ بيانات تجريبية</div>}

        <Card className="bg-slate-50 dark:bg-slate-900/50 border-dashed border-2">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-slate-600 dark:text-slate-400"><FileText className="w-4 h-4" /> إعدادات التقرير</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2"><label className="text-xs font-bold text-slate-500">عنوان التقرير</label><Input value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} className="bg-white dark:bg-slate-900" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-slate-500">اسم مدخل البيانات</label><Input value={dataEntryName} onChange={(e) => setDataEntryName(e.target.value)} className="bg-white dark:bg-slate-900" /></div>
                <div className="space-y-2 md:col-span-3"><label className="text-xs font-bold text-slate-500">الخلاصة</label><Textarea value={reportSummary} onChange={(e) => setReportSummary(e.target.value)} className="bg-white dark:bg-slate-900 h-12" /></div>
            </CardContent>
        </Card>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl font-bold text-blue-800 dark:text-blue-400">{dynamicTitle}</h2>
            <div className="flex flex-wrap gap-2">
                <Select value={filterCourse} onValueChange={(val) => { setFilterCourse(val); setFilterCompany("all"); setFilterPlatoon("all"); }}>
                    <SelectTrigger className="w-[140px] h-6 text-xs"><SelectValue placeholder="كل الدورات" /></SelectTrigger>
                    <SelectContent align="end"><SelectItem value="all">كل الدورات</SelectItem>{uniqueCourses.map((c:any)=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filterCompany} onValueChange={(val) => { setFilterCompany(val); setFilterPlatoon("all"); }}>
                    <SelectTrigger className="w-[140px] h-6 text-xs"><SelectValue placeholder="كل السرايا" /></SelectTrigger>
                    <SelectContent align="end"><SelectItem value="all">كل السرايا</SelectItem>{uniqueCompanies.map((c:any)=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filterPlatoon} onValueChange={setFilterPlatoon}>
                    <SelectTrigger className="w-[140px] h-6 text-xs"><SelectValue placeholder="كل الفصائل" /></SelectTrigger>
                    <SelectContent align="end"><SelectItem value="all">كل الفصائل</SelectItem>{uniquePlatoons.map((c:any)=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                
                <Button variant="outline" size="sm" onClick={handleRecalculate} disabled={loading} className="gap-1 h-9"><RefreshCcw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> تحديث</Button>
                <Button size="sm" onClick={() => { document.title = reportTitle; window.print(); }} className="bg-slate-900 text-white gap-1 h-9"><Printer className="w-3 h-3" /> طباعة</Button>
            </div>
        </div>
{/* شريط معايير الاختبار - للشاشة */}
<div className="flex flex-wrap gap-4 print:hidden bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800 mb-4">
    <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-blue-700 dark:text-blue-300">المسافة المعتمدة:</span>
        <Badge variant="secondary" className="bg-white dark:bg-slate-800 text-blue-800 dark:text-blue-400 font-black border-blue-200">
            {testSettings.distance} متر
        </Badge>
    </div>
    <div className="flex items-center gap-2 border-r pr-4 border-blue-200">
        <span className="text-xs font-bold text-blue-700 dark:text-blue-300">الدرجة القصوى:</span>
        <Badge variant="secondary" className="bg-white dark:bg-slate-800 text-blue-800 dark:text-blue-400 font-black border-blue-200">
            {testSettings.baseScore} درجة
        </Badge>
    </div>
    <div className="flex items-center gap-2 border-r pr-4 border-blue-200">
        <span className="text-xs font-bold text-blue-700 dark:text-blue-300">نظام الرأفة:</span>
        <Badge variant={testSettings.mercyMode === "مفعّـل" ? "default" : "outline"} 
               className={testSettings.mercyMode === "مفعّـل" ? "bg-orange-500 hover:bg-orange-600" : "text-slate-500"}>
            {testSettings.mercyMode}
        </Badge>
    </div>
</div>
        {/* البطاقات */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 print:hidden">
            <Card className="bg-slate-900 dark:bg-slate-950 text-white border-0 shadow-md">
                <CardContent className="p-3 md:p-6 flex flex-col md:flex-row items-center md:justify-between text-center md:text-right gap-2">
                    <div><p className="text-slate-400 text-[10px] md:text-sm font-medium">العدد الكلي</p><h3 className="text-xl md:text-3xl font-bold">{generalStats.totalForce}</h3></div>
                    <Users className="w-5 h-5 md:w-8 md:h-8 text-blue-400 opacity-80" />
                </CardContent>
            </Card>
            <Card className="bg-white dark:bg-slate-800 shadow-sm border-r-4 border-r-green-500">
                <CardContent className="p-3 md:p-6 flex flex-col md:flex-row items-center md:justify-between text-center md:text-right gap-2">
                    <div><p className="text-slate-500 dark:text-slate-400 text-[10px] md:text-sm font-medium">الناجحين</p><h3 className="text-xl md:text-3xl font-bold text-slate-900 dark:text-white">{generalStats.successCount}</h3><span className="text-[10px] md:text-xs text-green-600 dark:text-green-400 font-bold block">{getSmartPct(generalStats.successCount, generalStats, 'grade')}</span></div>
                    <UserCheck className="w-5 h-5 md:w-8 md:h-8 text-green-500 opacity-80" />
                </CardContent>
            </Card>
            <Card className="bg-white dark:bg-slate-800 shadow-sm border-r-4 border-r-red-500">
                <CardContent className="p-3 md:p-6 flex flex-col md:flex-row items-center md:justify-between text-center md:text-right gap-2">
                    <div><p className="text-slate-500 dark:text-slate-400 text-[10px] md:text-sm font-medium">الراسبين</p><h3 className="text-xl md:text-3xl font-bold text-slate-900 dark:text-white">{generalStats.failCount}</h3><span className="text-[10px] md:text-xs text-red-600 dark:text-red-400 font-bold block">{getSmartPct(generalStats.failCount, generalStats, 'grade')}</span></div>
                    <UserX className="w-5 h-5 md:w-8 md:h-8 text-red-500 opacity-80" />
                </CardContent>
            </Card>
            <Card className="bg-white dark:bg-slate-800 shadow-sm border-r-4 border-r-orange-500">
                <CardContent className="p-3 md:p-6 flex flex-col md:flex-row items-center md:justify-between text-center md:text-right gap-2">
                    <div><p className="text-slate-500 dark:text-slate-400 text-[10px] md:text-sm font-medium">الرأفة</p><h3 className="text-xl md:text-3xl font-bold text-slate-900 dark:text-white">{generalStats.mercy}</h3><span className="text-[10px] md:text-xs text-orange-600 dark:text-orange-400 font-bold block">حالات</span></div>
                    <Activity className="w-5 h-5 md:w-8 md:h-8 text-orange-500 opacity-80" />
                </CardContent>
            </Card>
        </div>

        {/* الرسوم على الشاشة */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-[300px] border rounded-lg p-4 bg-white dark:bg-slate-900">
                <h3 className="text-center font-bold mb-4">توزيع التقديرات</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="الجري" fill={COLORS.run} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="الضغط" fill={COLORS.push} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="البطن" fill={COLORS.sit} radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="h-[300px] border rounded-lg p-4 bg-white dark:bg-slate-900">
                <h3 className="text-center font-bold mb-4">توزيع التقديرات (عام)</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>
                            {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* هنا نستدعي getSmartPct في واجهة الشاشة */}
        <StatsTable title="1. جدول الأعداد" stats={stats} type="count" getSmartPct={getSmartPct} />
        <StatsTable title="2. جدول النسب المئوية" stats={stats} type="percent" getSmartPct={getSmartPct} />
      </div>

      {/* 2. واجهة الطباعة */}
      <div className="hidden print:block w-full">
        <table className="w-full border-collapse">
            <thead className="print-header">
                <tr>
                    <td colSpan={20}>
                        <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-4 w-full">
                            <div className="w-20 h-20 relative flex items-center justify-center">
                                <img src="/logo.jpg" alt="Logo" className="w-full h-full object-contain" />
                            </div>
                            <div className="text-center flex flex-col items-center">
                                <h2 className="text-base font-bold text-gray-600 whitespace-nowrap">معهد الشرطة - فرع التدريب الرياضي</h2>
                                <div className="h-2"></div>
                                <h1 className="text-xl font-bold text-blue-900 underline mt-1 print:text-blue-900">{reportTitle}</h1>
                                <h3 className="text-lg font-bold text-red-600 mt-1 print:text-red-600">{dynamicTitle}</h3>
                            </div>
                            <div className="text-left text-xs font-bold">
                                <p>تاريخ الطباعة:</p>
                                <p dir="ltr">{format(new Date(), "yyyy-MM-dd")}</p>
                            </div>
                        </div>
                    </td>
                </tr>
            </thead>

            <tbody className="print-body">
                <tr>
                    <td colSpan={20}>
                        <div className="h-1"></div>
                        <div className="flex flex-col gap-2 border border-black p-2 rounded bg-slate-50 mb-2">
                <div className="flex justify-around text-sm font-bold border-b border-gray-300 pb-1">
                    <span>الدورة: {filterCourse !== "all" ? filterCourse : "-"}</span>
                    <span>الدفعة: {uniqueCourses.length > 0 ? (data.find(d => d['اسم الدورة'] === filterCourse)?.['الدفعة'] || "-") : "-"}</span>
                </div>
                <div className="flex justify-around text-[10px] font-black text-blue-900 italic">
                    <span>المسافة المعتمدة: {testSettings.distance} متر</span>
                    <span>|</span>
                    <span>الدرجة القصوى: {testSettings.baseScore} درجة</span>
                    <span>|</span>
                    <span>نظام الرأفة: {testSettings.mercyMode}</span>
                </div>
            </div>
                        <div className="space-y-2 pb-4">
                            
                            <div className="grid grid-cols-4 gap-4 mb-2">
                                <div className="border border-black p-1 text-center rounded"><p className="text-[10px] font-bold">العدد الكلي</p><p className="text-lg font-bold">{generalStats.totalForce}</p></div>
                                <div className="border border-black p-1 text-center rounded bg-green-100"><p className="text-[10px] font-bold">الناجحين</p><p className="text-lg font-bold">{generalStats.successCount}</p></div>
                                <div className="border border-black p-1 text-center rounded bg-red-100"><p className="text-[10px] font-bold">الراسبين</p><p className="text-lg font-bold">{generalStats.failCount}</p></div>
                                <div className="boborder border-black p-1 text-center rounded bg-yellow-100"><p className="text-[10px] font-bold">الرأفة</p><p className="text-lg font-bold">{generalStats.mercy}</p></div>
                            </div>

                           

                            <div className="grid grid-cols-3 gap-4 break-inside-avoid">
                                <div className="col-span-2 border border-gray-300 p-1 rounded h-[220px]">
                                    <h3 className="text-center text-[10px] font-bold mb-1">توزيع التقديرات</h3>
                                    <BarChart 
    width={dynamicWidth} // 👈 هنا سيتم التبديل تلقائياً بين 450 و 500
    height={200} 
    data={chartData} 
    margin={{ top: 10, right: 5, left: 5, bottom: 0 }}
>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" fontSize={9} tick={{ fill: 'black', fontWeight: 'bold' }} />
                                        <YAxis fontSize={9} allowDecimals={false} />
                                        <Legend wrapperStyle={{ fontSize: '9px' }} />
                                        <Bar dataKey="الجري" fill={COLORS.run} isAnimationActive={false}><LabelList dataKey="الجري" position="top" fontSize={9} fill="black" /></Bar>
                                        <Bar dataKey="الضغط" fill={COLORS.push} isAnimationActive={false}><LabelList dataKey="الضغط" position="top" fontSize={9} fill="black" /></Bar>
                                        <Bar dataKey="البطن" fill={COLORS.sit} isAnimationActive={false}><LabelList dataKey="البطن" position="top" fontSize={9} fill="black" /></Bar>
                                    </BarChart>
                                </div>

                                <div className="border border-gray-300 p-1 rounded h-[220px] flex flex-col items-center justify-center">
                                    <h3 className="text-center text-[10px] font-bold mb-1">نسبة التقديرات العامة</h3>
                                    <PieChart width={250} height={200}>
                                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={2} dataKey="value" isAnimationActive={false}
                                            label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
                                                const safeCx = cx || 0; const safeCy = cy || 0; const safeMidAngle = midAngle || 0; const safeOuterRadius = outerRadius || 0;
                                                const radius = safeOuterRadius * 1.7; 
                                                const x = safeCx + radius * Math.cos(-safeMidAngle * RADIAN);
                                                const y = safeCy + radius * Math.sin(-safeMidAngle * RADIAN);
                                                return <text x={x} y={y} fill="black" textAnchor={x > safeCx ? 'start' : 'end'} dominantBaseline="central" fontSize="9" fontWeight="bold">{`${name} ${((percent || 0) * 100).toFixed(0)}%`}</text>;
                                            }}>
                                            {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                        </Pie>
                                        <Legend wrapperStyle={{ fontSize: '9px', bottom: 0 }} />
                                    </PieChart>
                                </div>
                            </div>

                            {/* تجميع الجداول - وهنا نستدعي getSmartPct أيضاً للطباعة */}
                            <div className="mt-1 border-t-1 border-black pt-1 break-inside-avoid">
                                <StatsTable title="أولاً: جدول الأعداد التفصيلي" stats={stats} type="count" getSmartPct={getSmartPct} isPrint />
                                <StatsTable title="ثانياً: جدول النسب المئوية" stats={stats} type="percent" getSmartPct={getSmartPct} isPrint />
                            </div>

                            {reportSummary && (
                                <div className="mt-1 border-t-1 border-black pt-1 break-inside-avoid">
                                    <h3 className="font-bold underline mb-1 text-xs">الخلاصة:</h3>
                                    <p className="text-justify text-xs leading-relaxed whitespace-pre-wrap">{reportSummary}</p>
                                </div>
                            )}
                        </div>
                    </td>
                </tr>
            </tbody>

            {dataEntryName && (
                <tfoot className="print-footer">
                    <tr>
                        <td colSpan={20}>
                            <div className="mt-8 flex justify-end px-4 pb-4"> {/* justify-end لليسار */}
                                <div className="text-center w-[150px]">
                                    <p className="font-bold text-base underline underline-offset-4">مدخل البيانات</p>
                                    <p className="font-bold text-sm mt-2">{dataEntryName}</p>
                                    
                                    {/* مكان التوقيع */}
                                    <div className="mt-2 h-16 flex items-center justify-center">
                                        {signatureUrl ? (
                                            /* استخدام img العادية مع أبعاد صريحة لضمان الطباعة */
                                            <img 
                                                src={signatureUrl} 
                                                alt="Signature" 
                                                className="h-full w-auto object-contain max-w-[120px]" 
                                            />
                                        ) : (
                                            /* في حال عدم وجود توقيع، يظهر النص */
                                            <span className="text-gray-400 text-xs border-2 border-dashed border-gray-300 px-4 py-2 rounded">
                                                (التوقيع)
                                            </span>
                                        )}
                                    </div>

                                </div>
                            </div>
                        </td>
                    </tr>
                </tfoot>
            )}
        </table>
      </div>
    </div>
    </ProtectedRoute>
  )
}

function StatsTable({ title, stats, type, getSmartPct, isPrint = false }: any) {
    const isPercent = type === 'percent';
    const cellClass = `border border-slate-400 dark:border-slate-700 ${isPrint ? 'px-1 py-0 h-6 text-[9px]' : 'p-2'}`;
    const headClass = `font-bold border border-slate-400 dark:border-slate-700 ${isPrint ? 'px-1 py-0 h-6 text-[9px] bg-[#c5b391] text-black' : 'p-2'} align-middle text-center`;

    // دالة مساعدة لاستخدام getSmartPct
    const getValue = (val: number, row: any, pctType: 'grade' | 'status') => {
        if (!isPercent) return val;
        return getSmartPct(val, row, pctType);
    }

    return (
<ProtectedRoute allowedRoles={["owner","assistant_admin"]}>
        <Card className={isPrint ? "border-0 shadow-none break-inside-avoid" : "dark:border-slate-700"}>
            <CardHeader className={`border-b dark:border-slate-700 flex justify-center items-center ${isPrint ? 'p-0 mb-1' : ''}`}>
                <CardTitle className="text-base text-blue-800 dark:text-blue-400 font-bold print:text-black text-center">{title}</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
                <Table className={`border-collapse border border-slate-400 dark:border-slate-700 text-center ${isPrint ? 'text-[9px]' : 'text-xs md:text-sm'}`}>
                    <TableHeader className={isPrint ? "" : "bg-[#c5b391] dark:bg-slate-800"}>
                        <TableRow>
                            <TableHead className={`${headClass} w-18 bg-[#c5b391] dark:bg-slate-700 text-black dark:text-white print:bg-[#c5b391]`}>المادة</TableHead>
                            <TableHead className={`${headClass} ${!isPrint && 'bg-[#7030a0] text-white'}`}>ممتاز</TableHead>
                            <TableHead className={`${headClass} ${!isPrint && 'bg-blue-600 text-white'}`}>جيد جدا</TableHead>
                            <TableHead className={`${headClass} ${!isPrint && 'bg-green-600 text-white'}`}>جيد</TableHead>
                            <TableHead className={`${headClass} ${!isPrint && 'bg-yellow-500 text-white'}`}>مقبول</TableHead>
                            <TableHead className={`${headClass} ${!isPrint && 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'}`}>ناجح</TableHead>
                            <TableHead className={`${headClass} ${!isPrint && 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'}`}>راسب</TableHead>
                            <TableHead className={`${headClass} bg-[#c5b391] dark:bg-slate-800 text-black dark:text-white`}>{isPercent ? 'ن.' : 'ع.'}الحضور</TableHead>
                            <TableHead className={`${headClass} text-orange-600 dark:text-orange-400`}>الرأفة</TableHead>
                            <TableHead className={headClass}>غياب</TableHead>
                            <TableHead className={headClass}>إعفاء</TableHead>
                            <TableHead className={headClass}>طبية</TableHead>
                            <TableHead className={headClass}>عيادة</TableHead>
                            <TableHead className={headClass}>لم يكمل</TableHead>
                            <TableHead className={headClass}>إجازة</TableHead>
                            <TableHead className={headClass}>ملحق</TableHead>
                            {!isPercent && <TableHead className={`${headClass} bg-[#c5b391] dark:bg-slate-950 text-black print:bg-[#c5b391] print:text-black`}>العدد الكلي</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {stats.map((row: any) => (
                            <TableRow key={row.label} className={isPrint ? "" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}>
                                <TableCell className={`${cellClass} font-bold bg-slate-100 dark:bg-slate-800 dark:text-slate-100 print:bg-gray-100`}>{row.label}</TableCell>
                                {/* التقديرات (تقسم على الحضور) */}
                                <TableCell className={`${cellClass} font-bold`} dir="ltr">{getValue(row.excellent, row, 'grade')}</TableCell>
                                <TableCell className={`${cellClass} font-bold`} dir="ltr">{getValue(row.veryGood, row, 'grade')}</TableCell>
                                <TableCell className={`${cellClass} font-bold`} dir="ltr">{getValue(row.good, row, 'grade')}</TableCell>
                                <TableCell className={`${cellClass} font-bold`} dir="ltr">{getValue(row.pass, row, 'grade')}</TableCell>
                                <TableCell className={`${cellClass} font-bold text-green-700 dark:text-green-400`} dir="ltr">{getValue(row.successCount, row, 'grade')}</TableCell>
                                <TableCell className={`${cellClass} font-bold text-red-600 dark:text-red-400`} dir="ltr">{getValue(row.failCount, row, 'grade')}</TableCell>
                                <TableCell className={`${cellClass} font-bold bg-slate-50 dark:bg-slate-800/50`}>{isPercent ? "100%" : row.totalPresent}</TableCell>
                                <TableCell className={`${cellClass} font-bold text-orange-600 dark:text-orange-400`} dir="ltr">{getValue(row.mercy, row, 'status')}</TableCell>
                                {/* الحالات (تقسم على الكلي) */}
                                <TableCell className={`${cellClass} font-bold`}>{isPercent && row.absent === 0 ? "-" : getValue(row.absent, row, 'status')}</TableCell>
                                <TableCell className={`${cellClass} font-bold`}>{isPercent && row.exempt === 0 ? "-" : getValue(row.exempt, row, 'status')}</TableCell>
                                <TableCell className={`${cellClass} font-bold`}>{isPercent && row.medical === 0 ? "-" : getValue(row.medical, row, 'status')}</TableCell>
                                <TableCell className={`${cellClass} font-bold`}>{isPercent && row.clinic === 0 ? "-" : getValue(row.clinic, row, 'status')}</TableCell>
                                <TableCell className={`${cellClass} font-bold`}>{isPercent && row.rest === 0 ? "-" : getValue(row.rest, row, 'status')}</TableCell>
                                <TableCell className={`${cellClass} font-bold`}>{isPercent && row.vacation === 0 ? "-" : getValue(row.vacation, row, 'status')}</TableCell>
                                <TableCell className={`${cellClass} font-bold`}>{isPercent && row.attached === 0 ? "-" : getValue(row.attached, row, 'status')}</TableCell>
                                {!isPercent && <TableCell className={`${cellClass} font-bold text-black dark:text-white`}>{row.totalForce}</TableCell>}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </Card>
        </ProtectedRoute>
    )
}