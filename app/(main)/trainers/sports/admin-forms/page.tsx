"use client"

import { useState, useEffect } from "react"
import { safePrint } from "@/lib/safePrint"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Printer, FileText, Trash2, Users, UserPlus } from "lucide-react"
import ProtectedRoute from "@/components/ProtectedRoute"

// --- ترويسة الصفحة الرسمية ---
const HeaderPrint = () => (
    <div className="flex justify-between items-start w-full mb-4 pb-2 pt-0 mt-[-20px] border-none">
        <div className="text-center font-bold text-sm space-y-0.5 border-none">
            <p>معهد الشرطة</p>
            <p>قسم التدريب العسكري والرياضي</p>
            <p>فرع التدريب الرياضي</p>
        </div>
        <div className="w-28 h-28 overflow-hidden border-none outline-none">
            <img 
                src="/logo.jpg" 
                alt="Logo" 
                className="w-full h-full object-contain mix-blend-multiply border-none shadow-none" 
            />
        </div>
    </div>
);

export default function AdminFormsPage() {
    const [allTrainers, setAllTrainers] = useState<any[]>([]);
    
    const [examForm, setExamForm] = useState({
    courseName: "",
    examType: "إختبـار تحديـد المستـوى",
    examDate: "",
    examDay: "",
    examTime: "05:00 صباحاً",
    // 🟢 التعديل: تحويل اللجنة إلى مصفوفة قابلة للزيادة
    committeeHeads: [
        { id: 1, name: " غانم هداف القحطاني", rank: "ملازم 1", note: "رئيس اللجنة" }
    ],
    footerNotes: "مكان الإختبار: خلف ثكنة الدبلوم\n• حضور المدربين الساعة 5:00 صباحاً\n• كل المدربين معنيين بإعداد الاختبار",
    trainers: [
        { id: 1, military_id: "", name: "", rank: "", note: "مشرف الاختبار" },
        { id: 2, military_id: "", name: "", rank: "", note: "(صافرة ضغط وبطن)+ ميقاتي" },
    ]
});
// 1. تعريف حالة بيانات نموذج توزيع المدربين (State)
const [distForm, setDistForm] = useState({
    courseName: "",
    officerInCharge: "",
    subject: "لياقة بدنية",
    period: "من الأحد إلى الخميس",
    startDate: "",
    trainers: [
        { id: 1, military_id: "", name: "", rank: "", phone: "", note: "" }
    ]
});

// 2. دالة البحث الذكي الخاصة بجدول التوزيع ( handleDistLookup )
const handleDistLookup = (value: string, index: number, field: 'name' | 'military_id') => {
    const trainers = [...distForm.trainers];
    trainers[index][field] = value;

    if (!value || value.trim() === "" || value.length < 2) {
        setDistForm({ ...distForm, trainers });
        return;
    }

    const found = allTrainers.find(u => 
        field === 'military_id' 
            ? String(u.military_id) === value 
            : u.name.trim().toLowerCase().includes(value.trim().toLowerCase())
    );

    if (found) {
        trainers[index].name = found.name;
        trainers[index].military_id = found.military_id;
        trainers[index].rank = found.rank;
    }
    setDistForm({ ...distForm, trainers });
};

// 3. دالة إضافة سطر جديد لجدول التوزيع ( addDistRow )
const addDistRow = () => {
    setDistForm({
        ...distForm,
        trainers: [...distForm.trainers, { id: Date.now(), military_id: "", name: "", rank: "", phone: "", note: "" }]
    });
};
    useEffect(() => {
        const fetchTrainers = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/`);
                if (res.ok) setAllTrainers(await res.json());
            } catch (e) { console.error("Error fetching trainers", e); }
        };
        fetchTrainers();
    }, []);

    const handleTrainerLookup = (value: string, index: number, field: 'name' | 'military_id') => {
        const trainers = [...examForm.trainers];
        trainers[index][field] = value;

        if (!value || value.trim() === "" || value.length < 2) {
            setExamForm({ ...examForm, trainers });
            return;
        }

        const found = allTrainers.find(u => 
            field === 'military_id' 
                ? String(u.military_id) === value 
                : u.name.trim().toLowerCase().includes(value.trim().toLowerCase())
        );

        if (found) {
            trainers[index].name = found.name;
            trainers[index].military_id = found.military_id;
            trainers[index].rank = found.rank;
        }
        setExamForm({ ...examForm, trainers });
    };

    const addTrainerRow = () => {
        setExamForm({
            ...examForm,
            trainers: [...examForm.trainers, { id: Date.now(), military_id: "", name: "", rank: "", note: "" }]
        });
    };
const addCommitteeHeadRow = () => {
    setExamForm({
        ...examForm,
        committeeHeads: [...examForm.committeeHeads, { id: Date.now(), name: "", rank: "", note: "" }]
    });
};
    return (
        <ProtectedRoute allowedRoles={["owner", "manager", "admin","assistant_admin","sports_officer"]}>
            <div className="p-4 md:p-8 space-y-6 bg-slate-50 min-h-screen" dir="rtl">
                
                <div className="flex justify-between items-center print:hidden border-b pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-lg text-white"><FileText className="w-6 h-6" /></div>
                        <h1 className="text-2xl font-bold text-slate-800">النماذج الإدارية</h1>
                    </div>
                    <Button onClick={() => safePrint()} className="bg-slate-900 gap-2"><Printer className="w-4 h-4" /> طباعة</Button>
                </div>

                <Tabs defaultValue="exam-committee" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 max-w-md mb-6 print:hidden">
                        <TabsTrigger value="exam-committee" className="font-bold gap-2">
                             <Users className="w-4 h-4"/> لجنة الاختبار
                        </TabsTrigger>
                        <TabsTrigger value="distribution" className="font-bold gap-2">
                            <UserPlus className="w-4 h-4"/> توزيع المدربين
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="exam-committee">
                        <Card className="border shadow-2xl bg-white print:shadow-none print:border-none">
                            <CardContent className="p-10 space-y-6 print:p-0">
                                <div className="hidden print:block"><HeaderPrint /></div>

                                <div className="text-center space-y-4 ">
                                    <div className="inline-block bg-[#c5b391] border border-black px-12 py-1">
                                        <Input 
                                            className="bg-transparent border-none text-center font-black text-2xl text-black w-full h-auto p-0 focus-visible:ring-0" 
                                            value={examForm.examType} 
                                            onChange={(e) => setExamForm({...examForm, examType: e.target.value})}
                                        />
                                    </div>
                                    <div className="flex flex-col items-center gap-1" dir="rtl" >
                                        <div className="flex items-right gap-2 justify-center w-full">
    {/* كلمة "لدورة" - حافظنا عليها كما هي */}
    <span className="font-bold text-2xl underline">لدورة:</span>
    
    {/* مربع الإدخال - تم تكبير الخط ليتطابق تماماً */}
    <Input 
        className="w-auto min-w-[300px] h-10 border-none text-right font-black text-2xl focus-visible:ring-0 p-0"
        style={{ fontSize: '1.5rem' }} // ضمان الحجم حتى في بعض المتصفحات
        value={examForm.courseName}
        onChange={(e) => setExamForm({...examForm, courseName: e.target.value})}
    />
</div>
                                        <h3 className="text-2xl font-black underline">لمـادة اليـاقـة البدنيـة</h3>
                                    </div>
                                </div>

                                <div className="max-w-4xl mx-auto space-y-4" dir="rtl">
                                    <div className="space-y-2">
    <Table className="border-collapse border border-black w-full">
        <TableHeader className="bg-[#c5b391]">
            <TableRow className="border-b border-black">
                <TableHead className="text-center font-bold text-black border-l border-black w-1/3">الرتبة</TableHead>
                <TableHead className="text-center font-bold text-black border-l border-black w-1/3">الإسم</TableHead>
                <TableHead className="text-center font-bold text-black w-1/3">ملاحظات</TableHead>
                <TableHead className="print:hidden w-10 border-r border-black"></TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {examForm.committeeHeads.map((head, index) => (
                <TableRow key={head.id} className="text-center font-bold border-b border-black last:border-b-0">
                    <TableCell className="border-l border-black p-1">
                        <Input 
                            className="text-center font-bold border-none p-0 h-8 focus-visible:ring-0" 
                            value={head.rank} 
                            onChange={(e) => {
                                const newHeads = [...examForm.committeeHeads];
                                newHeads[index].rank = e.target.value;
                                setExamForm({...examForm, committeeHeads: newHeads});
                            }} 
                        />
                    </TableCell>
                    <TableCell className="border-l border-black p-1">
                        <Input 
                            className="text-center font-black text-lg border-none p-0 h-8 focus-visible:ring-0" 
                            value={head.name} 
                            onChange={(e) => {
                                const newHeads = [...examForm.committeeHeads];
                                newHeads[index].name = e.target.value;
                                setExamForm({...examForm, committeeHeads: newHeads});
                            }} 
                        />
                    </TableCell>
                    <TableCell className="p-1 border-l border-black">
                         <Input 
                            className="text-center font-bold border-none p-0 h-8 focus-visible:ring-0" 
                            value={head.note} 
                            onChange={(e) => {
                                const newHeads = [...examForm.committeeHeads];
                                newHeads[index].note = e.target.value;
                                setExamForm({...examForm, committeeHeads: newHeads});
                            }} 
                        />
                    </TableCell>
                    <TableCell className="print:hidden text-center">
                        {index > 0 && (
                            <Button variant="ghost" size="icon" onClick={() => {
                                setExamForm({
                                    ...examForm,
                                    committeeHeads: examForm.committeeHeads.filter((_, i) => i !== index)
                                });
                            }} className="h-6 w-6 text-red-500">
                                <Trash2 className="w-4 h-4"/>
                            </Button>
                        )}
                    </TableCell>
                </TableRow>
            ))}
        </TableBody>
    </Table>
    <Button variant="outline" onClick={addCommitteeHeadRow} className="w-full border-dashed border border-black print:hidden text-xs h-7">
        + إضافة مسؤول/رئيس لجنة آخر
    </Button>
</div>

                                    <Table className="border-collapse border border-black text-center font-bold w-full" >
                                        <TableHeader className="bg-[#c5b391]">
                                            <TableRow className="border-b border-black" >
                                                <TableHead className="text-center font-bold text-black">التاريخ</TableHead>
                                                
                                                <TableHead className="text-center font-bold text-black border-l border-black">اليوم</TableHead>
                                                <TableHead className="text-center font-bold text-black border-l border-black">توقيت الإختبار</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            <TableRow className="border-b border-black">
                                                <TableCell className="p-1">
                                                    <Input 
                                                        type="date" 
                                                        className="text-center border-none font-bold p-4 h-8 focus-visible:ring-0" 
                                                        value={examForm.examDate} 
                                                        onChange={(e) => {
                                                            const date = e.target.value;
                                                            const day = date ? new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(new Date(date)) : "";
                                                            setExamForm({...examForm, examDate: date, examDay: day});
                                                        }} 
                                                    />
                                                </TableCell>
                                                
                                                <TableCell className="border-l border-black p-1"><Input className="text-center border-none font-bold p-0 h-8 focus-visible:ring-0" value={examForm.examDay} readOnly placeholder="اليوم" /></TableCell>
                                                <TableCell className="border-l border-black p-1"><Input className="text-center border-none font-black p-0 h-8 focus-visible:ring-0" value={examForm.examTime} onChange={(e)=>setExamForm({...examForm, examTime: e.target.value})} /></TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>

                                    <div className="space-y-2">
                                        <div className="flex justify-start" dir="rtl">
                                            <h4 className="font-bold text-lg underline">لجنة الضغط والبطن والجري:</h4>
                                        </div>
                                        <Table className="border-collapse border border-black w-full" dir="rtl">
                                            <TableHeader className="bg-[#c5b391]">
                                                <TableRow className="border-b border-black text-center">
                                                    <TableHead className="text-center font-bold text-black border-l border-black w-12">م</TableHead>
                                                    <TableHead className="text-center font-bold text-black border-l border-black w-[15%]">الرتبة</TableHead>
                                                    <TableHead className="text-center font-bold text-black border-l border-black w-[15%]">الرقم العسكري</TableHead>
                                                    <TableHead className="text-center font-bold text-black border-l border-black w-[35%]">الاسم</TableHead>
                                                    <TableHead className="text-center font-bold text-black w-[35%]">ملاحظات</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {examForm.trainers.map((trainer, index) => (
                                                    <TableRow key={trainer.id} className="border-b border-black font-bold">
                                                        <TableCell className="border-l border-black text-center p-1">{index + 1}</TableCell>
                                                        <TableCell className="border-l border-black p-1">
                                                            <Input className="text-center border-none font-bold p-0 h-8 focus-visible:ring-0" value={trainer.rank} onChange={(e) => { const t = [...examForm.trainers]; t[index].rank = e.target.value; setExamForm({...examForm, trainers: t}); }} />
                                                        </TableCell>
                                                        <TableCell className="border-l border-black p-1">
                                                            <Input 
                                                                className="text-center border-none font-bold p-0 h-8 focus-visible:ring-0" 
                                                                value={trainer.military_id} 
                                                                onBlur={(e) => handleTrainerLookup(e.target.value, index, 'military_id')}
                                                                onChange={(e) => { const t = [...examForm.trainers]; t[index].military_id = e.target.value; setExamForm({...examForm, trainers: t}); }}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="border-l border-black p-1">
                                                            <Input 
                                                                className="text-right pr-2 border-none font-black p-0 h-8 bg-transparent focus-visible:ring-0" 
                                                                value={trainer.name} 
                                                                onBlur={(e) => handleTrainerLookup(e.target.value, index, 'name')}
                                                                onChange={(e) => { const t = [...examForm.trainers]; t[index].name = e.target.value; setExamForm({...examForm, trainers: t}); }}
                                                                placeholder="ادخل الاسم..."
                                                            />
                                                        </TableCell>
                                                        <TableCell className="p-1">
                                                            <Input className="text-center border-none h-8 text-sm p-0 focus-visible:ring-0" value={trainer.note} onChange={(e) => { const t = [...examForm.trainers]; t[index].note = e.target.value; setExamForm({...examForm, trainers: t}); }} />
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        <Button variant="outline" onClick={addTrainerRow} className="w-full border-dashed border border-black print:hidden text-xs md:text-sm h-8">
                                            + إضافة مدرب جديد
                                        </Button>
                                    </div>
                                </div>

                                <div className="pt-4 w-full max-w-4xl mx-auto text-right">
                                    <Textarea 
                                        className="w-full border-none font-bold text-base leading-relaxed focus-visible:ring-0 resize-none min-h-[100px] p-0 text-right" 
                                        value={examForm.footerNotes} 
                                        onChange={(e) => setExamForm({...examForm, footerNotes: e.target.value})}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="distribution">
    <Card className="border shadow-xl bg-white print:shadow-none print:border-none">
        <CardContent className="p-8 space-y-6 print:p-0">
            {/* الترويسة تظهر في الطباعة فقط */}
            <div className="hidden print:block"><HeaderPrint /></div>

            {/* العنوان الرئيسي للنموذج */}
            <div className="text-center space-y-4" dir="rtl">
                <div className="inline-block bg-[#c5b391] border border-black px-12 py-1">
                    <h2 className="font-black text-2xl text-black">توزيع مدربي فرع التدريب الرياضي</h2>
                </div>
                
                <div className="flex flex-col items-center gap-2 max-w-2xl mx-auto">
                    <div className="flex items-center gap-2 w-full justify-center">
                        <span className="font-bold text-lg underline">اسم الدورة:</span>
                        <Input 
                            className="w-full h-8 border-none text-right font-black text-2xl focus-visible:ring-0 p-0"
                            placeholder="مثال: الدفعة الرابعة - الفترة التأسيسية"
                            value={distForm.courseName}
                            onChange={(e) => setDistForm({...distForm, courseName: e.target.value})}
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full justify-center">
                        <span className="font-bold text-lg underline">المسؤول:</span>
                        <Input 
                            className="w-full h-8 border-none text-right font-bold text-xl focus-visible:ring-0 p-0"
                            placeholder="الملازم 1 /  غانم هداف القحطاني"
                            value={distForm.officerInCharge}
                            onChange={(e) => setDistForm({...distForm, officerInCharge: e.target.value})}
                        />
                    </div>
                </div>
            </div>

            {/* جدول المواعيد والمادة (مستوحى من الـ PDF) */}
            <div className="max-w-4xl mx-auto" >
                <Table className="border-collapse border border-black text-center font-bold">
                    <TableHeader className="bg-[#c5b391]">
                        <TableRow className="border-b border-black">
                            <TableHead className="text-center font-bold text-black border-l border-black">مادة التدريب</TableHead>
                            <TableHead className="text-center font-bold text-black border-l border-black">الفترة الزمنية</TableHead>
                            <TableHead className="text-center font-bold text-black">من تاريخ</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow className="border-b border-black">
                            <TableCell className="border-l border-black p-1">
                                <Input className="text-center border-none font-black p-0 h-8" value={distForm.subject} onChange={(e)=>setDistForm({...distForm, subject: e.target.value})} />
                            </TableCell>
                            <TableCell className="border-l border-black p-1">
                                <Input className="text-center border-none font-bold p-0 h-8" value={distForm.period} onChange={(e)=>setDistForm({...distForm, period: e.target.value})} />
                            </TableCell>
                            <TableCell className="p-1">
                                <Input type="date" className="text-center border-none font-bold p-4 h-8" value={distForm.startDate} onChange={(e)=>setDistForm({...distForm, startDate: e.target.value})} />
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>

            {/* الجدول الرئيسي لتوزيع المدربين (مخطط بالكامل) */}
            <div className="space-y-2" dir="rtl">
                <div className="flex justify-start">
                    <h4 className="font-bold text-lg underline">كشف أسماء المدربين وتوزيع المهام:</h4>
                </div>
                <Table className="border-collapse border border-black w-full">
                    <TableHeader className="bg-[#c5b391]">
                        <TableRow className="border-b border-black text-center text-[10px] md:text-xs">
                            <TableHead className="text-center font-bold text-black border-l border-black w-10">م</TableHead>
                            <TableHead className="text-center font-bold text-black border-l border-black w-[15%]">الرتبة</TableHead>
                            <TableHead className="text-center font-bold text-black border-l border-black w-[15%]">الرقم العسكري</TableHead>
                            <TableHead className="text-center font-bold text-black border-l border-black w-[35%]">الاسم</TableHead>
                            <TableHead className="text-center font-bold text-black border-l border-black w-[15%]">رقم التواصل</TableHead>
                            <TableHead className="text-center font-bold text-black w-[20%]">الدوام / ملاحظات</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {distForm.trainers.map((trainer, index) => (
                            <TableRow key={trainer.id} className="border-b border-black font-bold">
                                <TableCell className="border-l border-black text-center p-1">{index + 1}</TableCell>
                                <TableCell className="border-l border-black p-1">
                                    <Input className="text-center border-none font-bold p-0 h-8 focus-visible:ring-0" value={trainer.rank} onChange={(e) => {
                                        const t = [...distForm.trainers]; t[index].rank = e.target.value; setDistForm({...distForm, trainers: t});
                                    }} />
                                </TableCell>
                                <TableCell className="border-l border-black p-1">
                                    <Input 
                                        className="text-center border-none font-bold p-0 h-8 focus-visible:ring-0" 
                                        value={trainer.military_id} 
                                        onBlur={(e) => handleDistLookup(e.target.value, index, 'military_id')}
                                        onChange={(e) => {
                                            const t = [...distForm.trainers]; t[index].military_id = e.target.value; setDistForm({...distForm, trainers: t});
                                        }}
                                    />
                                </TableCell>
                               <TableCell className="border border-black p-1">
    <Input 
      
        className="text-right pr-1 border-none font-bold text-xs p-0 h-8 bg-transparent focus-visible:ring-0" 
        value={trainer.name} 
        onBlur={(e) => handleDistLookup(e.target.value, index, 'name')}
        onChange={(e) => {
            const t = [...distForm.trainers]; 
            t[index].name = e.target.value; 
            setDistForm({...distForm, trainers: t});
        }}
        placeholder="الاسم..."
    />
</TableCell>
                                <TableCell className="border-l border-black p-1">
                                    <Input className="text-center border-none h-8 font-mono" value={trainer.phone} onChange={(e) => {
                                        const t = [...distForm.trainers]; t[index].phone = e.target.value; setDistForm({...distForm, trainers: t});
                                    }} />
                                </TableCell>
                                <TableCell className="p-1">
                                    <Input className="text-center border-none h-8 text-sm" value={trainer.note} onChange={(e) => {
                                        const t = [...distForm.trainers]; t[index].note = e.target.value; setDistForm({...distForm, trainers: t});
                                    }} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    
                </Table>
                <Button variant="outline" onClick={addDistRow} className="w-full border-dashed border border-black print:hidden">+ إضافة مدرب للتوزيع</Button>
            </div>
        </CardContent>
    </Card>
</TabsContent>
                </Tabs>

               <style jsx global>{`
    /* تنسيقات عامة للجدول */
    table { 
        border-collapse: collapse; 
        border: 1px solid black; 
        width: 100%; 
    }
    th, td { 
        border: 1px solid black; 
        padding: 4px;
    }

    /* تنسيقات الطباعة */
    @media print {
        @page { 
            size: portrait; 
            margin: 10mm 5mm 5mm 5mm; 
        }
        
        body { 
            background: white !important; 
            padding-top: 0 !important; 
        }

        /* إخفاء العناصر غير المرغوبة */
        nav, aside, header, button, .print\\:hidden, [role="tablist"] { 
            display: none !important; 
        }

        /* تنسيق الجداول والمدخلات للطباعة */
        .Card { 
            border: none !important; 
            box-shadow: none !important; 
        }
        
        input, textarea { 
            border: none !important; 
            background: transparent !important; 
            box-shadow: none !important; 
            resize: none !important;
        }

        /* الحفاظ على الألوان */
        .bg-[#c5b391] { 
            background-color: #c5b391 !important; 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
        }
        
        /* إظهار الترويسة المخفية */
        .hidden.print\\:block {
            display: block !important;
        }
    }
    .pdf-mode body { background: white !important; padding-top: 0 !important; }
    .pdf-mode nav, .pdf-mode aside, .pdf-mode header, .pdf-mode button, .pdf-mode .print\\:hidden, .pdf-mode [role="tablist"] { display: none !important; }
    .pdf-mode .Card { border: none !important; box-shadow: none !important; }
    .pdf-mode input, .pdf-mode textarea { border: none !important; background: transparent !important; box-shadow: none !important; resize: none !important; }
    .pdf-mode .bg-\\[\\#c5b391\\] { background-color: #c5b391 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .pdf-mode .hidden.print\\:block { display: block !important; }
`}</style>
            </div>
        </ProtectedRoute>
    )
}