"use client"

import { useEffect, useState, useMemo } from "react"
import { safePrint } from "@/lib/safePrint"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Printer, TrendingUp, Activity, Dumbbell, FileText, CheckSquare, Square, Bot, Filter } from "lucide-react"
import { format, differenceInDays, parseISO } from "date-fns"
import ProtectedRoute from "@/components/ProtectedRoute"
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, PieChart, Pie, Cell 
} from 'recharts';

// === 1. بيانات تجريبية ===
// === 1. بيانات تجريبية ذكية (مصححة) ===
// === 1. بيانات تجريبية (مصححة) ===
// التعديل 1: جعلنا الدالة تستقبل متغيراً واحداً فقط (baseScore)
const generateMockData = (baseScore: number) => {
  return Array.from({ length: 100 }, (_, i) => {
    const score = Math.min(100, Math.max(0, baseScore + (Math.random() * 25 - 10))); 
    const run = Math.min(100, Math.max(0, score + (Math.random() * 10 - 5)));
    const push = Math.min(100, Math.max(0, score + (Math.random() * 15 - 10)));
    const sit = Math.min(100, Math.max(0, score + (Math.random() * 5 - 2)));

    const getGrade = (s: number) => {
        if (s >= 90) return 'ممتاز';
        if (s >= 80) return 'جيد جدا';
        if (s >= 70) return 'جيد';
        if (s >= 60) return 'مقبول';
        return 'راسب';
    }

    return {
      'الرقم العسكري': `2024${i}`,
      'اسم الدورة': i < 50 ? 'دورة الصاعقة' : 'دورة المشاة',
      'السرية': i < 25 ? 'السرية الأولى' : i < 50 ? 'السرية الثانية' : 'السرية الثالثة',
      'الفصيل': `فصيل ${(i % 4) + 1}`,
      'average': score,
      'grade': getGrade(score),
      'run_score': run, 'run_grade': getGrade(run),
      'push_score': push, 'push_grade': getGrade(push),
      'sit_score': sit, 'sit_grade': getGrade(sit),
      'final_result': score >= 60 ? 'Pass' : 'Fail'
    };
  });
};

const MOCK_ARCHIVES = [
  // التعديل 2: التأكد من أن التاريخ يسمى date وليس data
  { id: 'exam1', name: '1. اختبار تحديد المستوى', date: '2024-01-10', data: generateMockData(55) }, 
  { id: 'exam2', name: '2. اختبار الشهر الأول', date: '2024-02-15', data: generateMockData(68) },   
  { id: 'exam3', name: '3. اختبار منتصف الدورة', date: '2024-03-20', data: generateMockData(78) },     
  { id: 'exam4', name: '4. الاختبار النهائي', date: '2024-04-30', data: generateMockData(90) },     
];

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

// وظائف التحليل
const generateSectionAnalysis = (sectionName: string, averages: any[]) => {
    if (averages.length < 2) return "بيانات غير كافية.";
    const first = averages[0];
    const last = averages[averages.length - 1];
    const diff = last.avg - first.avg;
    const isPositive = diff > 0;
    let text = `📌 تحليل ${sectionName}: `;
    if (isPositive) text += `تطور إيجابي بمقدار ${(diff).toFixed(1)} درجة. `;
    else text += `تراجع في الأداء بمقدار ${(Math.abs(diff)).toFixed(1)} درجة. `;
    text += `نسبة النجاح الحالية ${last.passRate.toFixed(1)}%.`;
    return text;
}

const generateReportIntro = (exams: any[]) => {
    if (exams.length < 2) return "";
    // معالجة التواريخ الوهمية للتجربة
    const startDate = exams[0].date ? parseISO(exams[0].date) : new Date();
    const endDate = exams[exams.length-1].date ? parseISO(exams[exams.length-1].date) : new Date();
    const duration = differenceInDays(endDate, startDate) || 90; // افتراضي 90 يوم
    const count = exams.length;
    return `يستعرض هذا التقرير التحليلي نتائج ${count} اختبارات قياسية تم إجراؤها خلال فترة تدريبية، بهدف قياس مدى كفاءة البرنامج التدريبي وتحديد مؤشرات التطور في اللياقة البدنية للمتدربين.`;
}

const generateFinalConclusion = (generalTrend: number, runTrend: number, pushTrend: number) => {
    let conclusion = "خلاصة الموقف التدريبي: ";
    if (generalTrend > 15) conclusion += "أظهرت الدورة نجاحاً باهراً في تحقيق أهداف اللياقة البدنية. ";
    else if (generalTrend > 0) conclusion += "تسير الدورة في نسق تصاعدي جيد. ";
    else conclusion += "هناك ثبات أو تراجع في المستوى العام. ";
    conclusion += "\nالتوصيات المقترحة: ";
    if (runTrend < 5) conclusion += "1. تكثيف حصص الجري الطويل. ";
    if (pushTrend < 5) conclusion += "2. التركيز على تمارين القوة العضلية. ";
    conclusion += "3. إجراء اختبار مفاجئ لقياس ثبات المستوى.";
    return conclusion;
}

export default function ComparisonsPage() {
  const [selectedIds, setSelectedIds] = useState<string[]>(['exam1', 'exam4'])
  
  const [filterCourse, setFilterCourse] = useState("all")
  const [filterCompany, setFilterCompany] = useState("all")
  const [filterPlatoon, setFilterPlatoon] = useState("all")

  const [reportTitle, setReportTitle] = useState("تقرير تحليل تطور اللياقة البدنية")
  const [dataEntryName, setDataEntryName] = useState("")
  
  // === 1. متغير جديد لحفظ رابط التوقيع ===
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  
  const [notes, setNotes] = useState({ general: "", run: "", push: "", sit: "" })

  const updateNote = (section: string, text: string) => {
    setNotes(prev => ({ ...prev, [section]: text }));
  }

  // === 2. التأكد من وجود التوقيع عند فتح الصفحة ===
 useEffect(() => {
    const checkSignature = async () => {
        try {
            // استبدال الرابط الثابت بالمتغير البيئي
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/static/signature.png?t=${new Date().getTime()}`)
            if (res.ok) {
                // استبدال الرابط الثابت هنا أيضاً
                setSignatureUrl(`${process.env.NEXT_PUBLIC_API_URL}/static/signature.png?t=${new Date().getTime()}`)
            }
        } catch (e) { console.log("No signature") }
    }
    checkSignature();
  }, [])

  const baseData = MOCK_ARCHIVES[0].data; 
  const uniqueCourses = useMemo(() => [...new Set(baseData.map(item => item['اسم الدورة']).filter(Boolean))], [])
  const uniqueCompanies = useMemo(() => {
      let d = filterCourse !== "all" ? baseData.filter(i => i['اسم الدورة'] === filterCourse) : baseData;
      return [...new Set(d.map(item => item['السرية']).filter(Boolean))]
  }, [filterCourse])
  const uniquePlatoons = useMemo(() => {
      let d = baseData;
      if (filterCourse !== "all") d = d.filter(i => i['اسم الدورة'] === filterCourse)
      if (filterCompany !== "all") d = d.filter(i => i['السرية'] === filterCompany)
      return [...new Set(d.map(item => item['الفصيل']).filter(Boolean))]
  }, [filterCourse, filterCompany])

  const analysis = useMemo(() => {
    const selectedExams = MOCK_ARCHIVES
        .filter(arc => selectedIds.includes(arc.id))
        .map(arc => {
            const filteredData = arc.data.filter(item => {
                if (filterCourse !== "all" && item['اسم الدورة'] !== filterCourse) return false;
                if (filterCompany !== "all" && item['السرية'] !== filterCompany) return false;
                if (filterPlatoon !== "all" && item['الفصيل'] !== filterPlatoon) return false;
                return true;
            });
            return { id: arc.id, name: arc.name, date: arc.date, data: filteredData };
        });

    if (selectedExams.length === 0) return null;

    const analyzeSection = (gradeKey: string, scoreKey: string) => {
        const distribution = ['ممتاز', 'جيد جدا', 'جيد', 'مقبول', 'راسب'].map(grade => {
            const row: any = { name: grade };
            selectedExams.forEach(exam => {
                row[exam.id] = exam.data.filter((d: any) => d[gradeKey] === grade).length;
            });
            return row;
        });

        const averages = selectedExams.map(exam => ({
            name: exam.name,
            avg: exam.data.length ? exam.data.reduce((acc: number, curr: any) => acc + (curr[scoreKey] || 0), 0) / exam.data.length : 0,
            passRate: exam.data.length ? (exam.data.filter((d: any) => d[gradeKey] !== 'راسب').length / exam.data.length) * 100 : 0
        }));

        const chartData = averages.map(a => ({
            name: a.name.split(' ').slice(0, 2).join(' '), 
            المتوسط: a.avg
        }));

        return { distribution, averages, chartData };
    };

    return {
        exams: selectedExams,
        general: analyzeSection('grade', 'average'),
        run: analyzeSection('run_grade', 'run_score'),
        push: analyzeSection('push_grade', 'push_score'),
        sit: analyzeSection('sit_grade', 'sit_score'),
    };

  }, [selectedIds, filterCourse, filterCompany, filterPlatoon]);

  const toggleExam = (id: string) => {
    if (selectedIds.includes(id)) {
        setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
        const newIds = [...selectedIds, id];
        const sortedIds = MOCK_ARCHIVES.filter(a => newIds.includes(a.id)).map(a => a.id);
        setSelectedIds(sortedIds);
    }
  }

  const introText = analysis ? generateReportIntro(analysis.exams) : "";
  const finalConclusionText = analysis ? generateFinalConclusion(
      analysis.general.averages[analysis.general.averages.length-1].avg - analysis.general.averages[0].avg,
      analysis.run.averages[analysis.run.averages.length-1].avg - analysis.run.averages[0].avg,
      analysis.push.averages[analysis.push.averages.length-1].avg - analysis.push.averages[0].avg
  ) : "";

  return (
    <ProtectedRoute allowedRoles={["owner","assistant_admin"]}>
    <div className="space-y-8 p-4 pb-14 md:pb-24" dir="rtl">
      
      <div className="print:hidden space-y-6">
        <Card className="bg-slate-50 border-2 border-dashed">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-slate-600"><FileText className="w-4 h-4" /> إعدادات التقرير</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-xs font-bold text-slate-500">عنوان التقرير</label><Input value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} className="bg-white" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-slate-500">اسم مدخل البيانات</label><Input value={dataEntryName} onChange={(e) => setDataEntryName(e.target.value)} className="bg-white" /></div>
            </CardContent>
        </Card>

        <div className="bg-white p-4 rounded-lg border shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-4">
                <div className="space-y-1"><label className="text-xs font-bold text-slate-500 flex gap-1"><Filter className="w-3 h-3"/> الدورة</label>
                    <Select value={filterCourse} onValueChange={(val) => { setFilterCourse(val); setFilterCompany("all"); setFilterPlatoon("all"); }}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="الكل" /></SelectTrigger>
                        <SelectContent align="end"><SelectItem value="all">الكل</SelectItem>{uniqueCourses.map((c:any)=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-1"><label className="text-xs font-bold text-slate-500 flex gap-1"><Filter className="w-3 h-3"/> السرية</label>
                    <Select value={filterCompany} onValueChange={(val) => { setFilterCompany(val); setFilterPlatoon("all"); }}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="الكل" /></SelectTrigger>
                        <SelectContent align="end"><SelectItem value="all">الكل</SelectItem>{uniqueCompanies.map((c:any)=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-1"><label className="text-xs font-bold text-slate-500 flex gap-1"><Filter className="w-3 h-3"/> الفصيل</label>
                    <Select value={filterPlatoon} onValueChange={setFilterPlatoon}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="الكل" /></SelectTrigger>
                        <SelectContent align="end"><SelectItem value="all">الكل</SelectItem>{uniquePlatoons.map((c:any)=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>

            <div>
                <h2 className="font-bold text-sm mb-2">اختر الاختبارات للمقارنة:</h2>
                <div className="flex flex-wrap gap-3">
                    {MOCK_ARCHIVES.map(arc => {
                        const isSelected = selectedIds.includes(arc.id);
                        return (
                            <div key={arc.id} onClick={() => toggleExam(arc.id)} className={`cursor-pointer px-4 py-2 rounded-lg border-2 flex items-center gap-2 transition-all text-sm ${isSelected ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold' : 'border-slate-200 text-slate-500'}`}>
                                {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                {arc.name}
                            </div>
                        )
                    })}
                </div>
            </div>

            <Button onClick={() => { document.title = reportTitle; safePrint(); }} className="w-full bg-slate-900 text-white gap-2"><Printer className="w-4 h-4" /> طباعة التقرير الشامل</Button>
        </div>
      </div>

      {/* 2. جسم التقرير */}
      {analysis && analysis.exams.length > 0 && (
        <div className="w-full">
            
            {/* ترويسة الطباعة */}
            <div className="hidden print:block w-full border-b-2 border-black pb-4 mb-4">
                <div className="flex justify-between items-center w-full">
                    <div className="w-20 h-20 relative flex items-center justify-center">
                        <img src="/logo.jpg" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <div className="text-center">
                        <h2 className="text-base font-bold text-gray-600 whitespace-nowrap">أكاديمية الشرطة - فرع التدريب الرياضي</h2>
                        <h1 className="text-xl font-bold text-blue-900 underline mt-2">{reportTitle}</h1>
                        <p className="text-sm mt-2 text-gray-500">
                            {filterCourse !== 'all' ? filterCourse : 'جميع الدورات'} 
                            {filterCompany !== 'all' && ` - ${filterCompany}`}
                        </p>
                    </div>
                    <div className="text-left text-xs font-bold">
                        <p>تاريخ الطباعة:</p>
                        <p dir="ltr">{format(new Date(), "yyyy-MM-dd")}</p>
                    </div>
                </div>
            </div>

            {/* مقدمة التقرير */}
            <div className="break-inside-avoid page-break-inside-avoid">
                <div className="hidden print:block mb-1 text-sm leading-relaxed text-justify border-b border-dashed border-gray-300 pb-1">
                    <p>
                        <span className="font-bold text-blue-800 ml-1"><Bot className="w-4 h-4 inline ml-1"/> مقدمة:</span>
                        {introText}
                    </p>
                </div>
            
                {/* القسم الأول */}
                <div className="mt-2">
                    <SectionBlock 
                        title="أولاً: التحليل العام (المعدل التراكمي)" 
                        icon={TrendingUp} 
                        exams={analysis.exams} 
                        data={analysis.general} 
                        color="#2563eb"
                        aiAnalysis={generateSectionAnalysis('المستوى العام', analysis.general.averages)}
                        note={notes.general}
                        onNoteChange={(v: string) => updateNote('general', v)}
                    />
                </div>
            </div>

            {/* باقي الأقسام */}
            <div className="space-y-6 print:space-y-4">
                
                <SectionBlock title="ثانياً: تحليل الجري (Endurance)" icon={Activity} exams={analysis.exams} data={analysis.run} color="#00C49F" aiAnalysis={generateSectionAnalysis('اللياقة البدنية (الجري)', analysis.run.averages)} note={notes.run} onNoteChange={(v: string) => updateNote('run', v)} />

                <SectionBlock title="ثالثاً: تحليل الضغط (Push-ups)" icon={Dumbbell} exams={analysis.exams} data={analysis.push} color="#ED7D31" aiAnalysis={generateSectionAnalysis('قوة التحمل (الضغط)', analysis.push.averages)} note={notes.push} onNoteChange={(v: string) => updateNote('push', v)} />

                <SectionBlock title="رابعاً: تحليل البطن (Sit-ups)" icon={Activity} exams={analysis.exams} data={analysis.sit} color="#A5A5A5" aiAnalysis={generateSectionAnalysis('عضلات الجذع (البطن)', analysis.sit.averages)} note={notes.sit} onNoteChange={(v: string) => updateNote('sit', v)} />

                {/* الخلاصة والتوصيات */}
                <div className="break-inside-avoid mt-6">
                    <h3 className="text-base font-bold flex items-center gap-2 mb-2 text-slate-900 underline decoration-blue-500 underline-offset-4">
                        <Bot className="w-5 h-5 text-blue-600" />
                        الخلاصة والتوصيات النهائية (تحليل النظام):
                    </h3>
                    <p className="text-sm leading-loose text-justify font-medium text-slate-800">{finalConclusionText}</p>
                </div>

            </div>

            {dataEntryName && (
                        <tfoot className="print-footer">
                            <tr>
                                <td colSpan={20}>
                                    <div className="mt-8 flex justify-end px-4 pb-4">
                                        <div className="text-center w-[150px]">
                                            <p className="font-bold text-base underline underline-offset-4">مدخل البيانات</p>
                                            <p className="font-bold text-sm mt-2">{dataEntryName}</p>
                                            <div className="mt-2 h-16 flex items-center justify-center">
                                                {signatureUrl ? (
                                                    <img src={signatureUrl} alt="Signature" className="h-full w-auto object-contain max-w-[120px]" />
                                                ) : (
                                                    <span className="text-gray-400 text-xs border-2 border-dashed border-gray-300 px-4 py-2 rounded">(التوقيع)</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </tfoot>
            )}

        </div>
      )}
    </div>
    </ProtectedRoute>
  )
}

// مكون القسم المكرر
function SectionBlock({ title, icon: Icon, exams, data, color, aiAnalysis, note, onNoteChange }: any) {
    return (
        <ProtectedRoute allowedRoles={["owner","assistant_admin"]}>
        <div className="break-inside-avoid border rounded-lg p-4 print:p-0 print:border-0 shadow-sm print:shadow-none bg-white mb-6 print:mb-2">
            <div className="flex items-center gap-2 mb-4 border-b pb-2 print:mb-1 print:pb-1">
                <Icon className="w-5 h-5 text-slate-600" style={{ color }} />
                <h2 className="text-lg font-bold text-slate-800 print:text-sm">{title}</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:gap-2">
                <div className="lg:col-span-2 space-y-4 print:space-y-1">
                    <Card className="border shadow-none print:border-slate-400">
                        <CardHeader className="p-2 bg-slate-100 border-b print:p-0.5 print:bg-[#c5b391]">
                            <CardTitle className="text-xs text-center text-black font-bold">توزيع التقديرات</CardTitle>
                        </CardHeader>
                        <div className="overflow-x-auto">
                            <Table className="text-center text-xs border-collapse">
                                <TableHeader>
                                    <TableRow className="bg-slate-50 print:bg-white">
                                        <TableHead className="text-center border border-slate-300 font-bold text-black print:py-0 print:h-5">التقدير</TableHead>
                                        {exams.map((exam: any) => (
                                            <TableHead key={exam.id} className="text-center border border-slate-300 text-black print:py-0 print:h-5">{exam.name}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.distribution.map((row: any) => (
                                        <TableRow key={row.name} className="print:h-4">
                                            <TableCell className="font-bold border border-slate-300 bg-slate-50 print:py-0">{row.name}</TableCell>
                                            {exams.map((exam: any) => (
                                                <TableCell key={exam.id} className="border border-slate-300 print:py-0">{row[exam.id]}</TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                    <Card className="border shadow-none print:border-slate-400">
                        <CardHeader className="p-2 bg-slate-100 border-b print:p-0.5 print:bg-[#c5b391]">
                            <CardTitle className="text-xs text-center text-black font-bold">المتوسط ونسبة النجاح</CardTitle>
                        </CardHeader>
                        <div className="overflow-x-auto">
                            <Table className="text-center text-xs border-collapse">
                                <TableHeader>
                                    <TableRow className="bg-slate-50 print:bg-white">
                                        <TableHead className="text-center border border-slate-300 font-bold text-black print:py-0 print:h-5">الاختبار</TableHead>
                                        <TableHead className="text-center border border-slate-300 text-black print:py-0 print:h-5">متوسط الدرجة</TableHead>
                                        <TableHead className="text-center border border-slate-300 text-black print:py-0 print:h-5">نسبة النجاح</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.averages.map((avg: any) => (
                                        <TableRow key={avg.name} className="print:h-4">
                                            <TableCell className="font-bold border border-slate-300 text-right bg-slate-50 print:py-0">{avg.name}</TableCell>
                                            <TableCell className="border border-slate-300 font-bold text-blue-700 print:py-0">{avg.avg.toFixed(1)}</TableCell>
                                            <TableCell className="border border-slate-300 font-bold text-green-700 print:py-0">{avg.passRate.toFixed(1)}%</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </div>
                <div className="space-y-4 print:space-y-1">
                    <div className="border rounded-lg p-2 h-[180px] print:h-[140px] flex flex-col items-center justify-center bg-white print:border-slate-400">
                        <p className="text-[10px] text-slate-500 mb-2 font-bold">مؤشر التطور</p>
                        <BarChart width={200} height={100} data={data.chartData}>
                             <CartesianGrid strokeDasharray="3 3" vertical={false} />
                             <XAxis dataKey="name" hide /> 
                             <Tooltip />
                             <Bar dataKey="المتوسط" fill={color} isAnimationActive={false} radius={[4, 4, 0, 0]}>
                                <LabelList dataKey="المتوسط" position="top" fontSize={9} fill="black" formatter={(val:any) => Number(val).toFixed(1)} />
                             </Bar>
                        </BarChart>
                    </div>
                    <div className="bg-blue-50/50 border border-blue-200 rounded p-2">
                        <p className="text-[10px] font-bold text-blue-800 mb-1 flex gap-1 items-center"><Bot className="w-3 h-3"/> تحليل النظام (AI):</p>
                        <p className="text-[10px] text-slate-700 leading-snug text-justify">{aiAnalysis}</p>
                    </div>
                    {(note && note.trim() !== "") ? (
                        <div className="bg-yellow-50/50 border border-yellow-200 rounded p-2 print:bg-transparent print:border print:border-dashed print:border-gray-400">
                            <p className="text-[10px] font-bold text-yellow-800 mb-1 print:text-black">ملاحظات المسؤول:</p>
                            <p className="text-xs text-slate-800 print:block hidden whitespace-pre-wrap">{note}</p>
                            <Textarea placeholder="سجل ملاحظاتك هنا..." value={note} onChange={(e) => onNoteChange(e.target.value)} className="w-full bg-white text-xs min-h-[40px] print:hidden" />
                        </div>
                    ) : (
                        <div className="bg-yellow-50/50 border border-yellow-200 rounded p-2 print:hidden">
                             <p className="text-[10px] font-bold text-yellow-800 mb-1">ملاحظات المسؤول:</p>
                             <Textarea placeholder="سجل ملاحظاتك هنا..." value={note} onChange={(e) => onNoteChange(e.target.value)} className="w-full bg-white text-xs min-h-[40px]" />
                        </div>
                    )}
                </div>
            </div>
        </div>
        </ProtectedRoute>
    )
}