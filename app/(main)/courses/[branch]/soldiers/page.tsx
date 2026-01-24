"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
    Users, Search, RefreshCw, ArrowRight, Printer, Shield, 
    GraduationCap, Scale, AlertTriangle, FileText, Activity, 
    MapPin, Calendar as CalIcon, User, ChevronLeft, ChevronRight, 
    Dumbbell, Target, ShieldAlert, RotateCcw,
    Swords, Eye, Calculator,
    Paperclip,CheckCircle2 // 👈 أضف هذه الكلمة هنا
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import { useParams } from "next/navigation"
import ProtectedRoute from "@/components/ProtectedRoute"

const absenceKeywords: string[] = ["غياب", "غائب", "إصابة", "لم يختبر", "شطب", "مؤجل", "اعتذار", "طبية", "مستشفى", "ملحق", "عيادة", "مرضية", "مفصول", "اصابة", "استقالة", "إستقالة"];

export default function SoldiersDirectoryPage() {
    // --- 1. States (Directory) ---
    const [loading, setLoading] = useState(false)
    const [filterCourse, setFilterCourse] = useState("all")
    const [filterBatch, setFilterBatch] = useState("all")
    const [filterCompany, setFilterCompany] = useState("all")
    const [filterPlatoon, setFilterPlatoon] = useState("all")
    const [filterOptions, setFilterOptions] = useState<any>({ courses: [], batches: [], companies: [], platoons: [] })
    const [searchQuery, setSearchQuery] = useState("")
    const [soldiersList, setSoldiersList] = useState<any[]>([])
    const [selectedSoldier, setSelectedSoldier] = useState<any>(null)
const [fitExamsPage, setFitExamsPage] = useState(1)
const [fitExamsPerPage, setFitExamsPerPage] = useState(5)
    // --- 2. States (Profile) ---
    const [profileData, setProfileData] = useState<any>({ weights: [], status_stats: {}, violation_stats: {}, reports: [], military_exams: [],
    sports_exams: [] })
    const [loadingProfile, setLoadingProfile] = useState(false)
    const [historyDialog, setHistoryDialog] = useState<{open: boolean, title: string, details: any[]}>({ open: false, title: "", details: [] })
    const [isClient, setIsClient] = useState(false)
const [milSubjectFilter, setMilSubjectFilter] = useState("all"); // الفلتر الجديد (الكل، مشاة، رماية)
    // --- 3. States (Date Filters) ---
    const [weightFrom, setWeightFrom] = useState("");
    const [weightTo, setWeightTo] = useState("");
    const [milFrom, setMilFrom] = useState("");
    const [milTo, setMilTo] = useState("");
    const [reportFrom, setReportFrom] = useState("");
    const [reportTo, setReportTo] = useState("");
    const [vioFrom, setVioFrom] = useState("");
    const [vioTo, setVioTo] = useState("");
    const [sportsFrom, setSportsFrom] = useState("");
    const [sportsTo, setSportsTo] = useState("");
    const [milSectionsList, setMilSectionsList] = useState<any[]>([]);
    // --- 4. States (UI Logic) ---
    const [violationSubjectFilter, setViolationSubjectFilter] = useState("all")
    const [reportSubjectFilter, setReportSubjectFilter] = useState("all")
    
    // Pagination States
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(20)
    const [reportsPage, setReportsPage] = useState(1)
    const [reportsPerPage, setReportsPerPage] = useState(5)
    const [weightsPage, setWeightsPage] = useState(1)
    const [weightsPerPage, setWeightsPerPage] = useState(5)
    const [milExamsPage, setMilExamsPage] = useState(1)
    const [milExamsPerPage, setMilExamsPerPage] = useState(10)

    const params = useParams();
    const currentBranch = params.branch as string; 
    const userRole = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("user") || "{}")?.role : null;
const [showWeightFilter, setShowWeightFilter] = useState(false);
const [showMilFilter, setShowMilFilter] = useState(false);
const [showSportsFilter, setShowSportsFilter] = useState(false);
const [showVioFilter, setShowVioFilter] = useState(false);
const [showReportFilter, setShowReportFilter] = useState(false);
    // --- 5. Logic: Data Processing (useMemo MUST come before any return) ---

    // Directory Pagination Logic
    const paginatedSoldiers = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return soldiersList.slice(start, start + itemsPerPage);
    }, [soldiersList, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(soldiersList.length / itemsPerPage);

    // Profile Filtering Logic (Date Filters)
    const filteredWeightsList = useMemo(() => {
        return (profileData.weights || []).filter((w: any) => {
            if (!weightFrom && !weightTo) return true;
            return w.date >= (weightFrom || "0000-00-00") && w.date <= (weightTo || "9999-99-99");
        });
    }, [profileData.weights, weightFrom, weightTo]);

   // 🟢 تعديل فلتر "الاختبارات العسكرية" لاستبعاد اللياقة
const milExamsList = useMemo(() => {
    return (profileData.military_exams || []).filter((ex: any) => {
        // 1. استبعاد اختبارات اللياقة (بالاعتماد على وجود مفاتيح الجري/الضغط)
        const isFitness = ex["الجري"] !== undefined || ex["الضغط"] !== undefined || ex["البطن"] !== undefined;
        if (isFitness) return false;

        // 2. تحديد قسم الاختبار (Subject)
        // نحاول جلب القسم من الحقل الصريح، وإذا لم يوجد نكهن به من العنوان
        const examSubject = ex.subject || ex.config?.subject || "";
        const title = (ex.title || "").toLowerCase();

        // 3. تطبيق فلتر الاختيار (الكل، مشاة، رماية، إلخ)
        let matchesSubject = true;
        if (milSubjectFilter !== "all") {
            // أ - التحقق من المفتاح البرمجي (مثلاً shooting أو infantry)
            const matchByKey = examSubject === milSubjectFilter;
            
            // ب - التحقق بالكلمات المفتاحية (دعم إضافي للسجلات التي قد لا تملك subject صريح)
            let matchByTitle = false;
            if (milSubjectFilter === "shooting") {
                matchByTitle = title.includes("رماية") || title.includes("مسدس") || title.includes("بندقية");
            } else if (milSubjectFilter === "infantry") {
                matchByTitle = title.includes("مشاة") || title.includes("عصا");
            } else {
                // للأقسام الأخرى، نعتمد على مسمى القسم في الإعدادات
                const sectionName = milSectionsList.find(s => s.key === milSubjectFilter)?.name || "";
                matchByTitle = title.includes(sectionName);
            }

            matchesSubject = matchByKey || matchByTitle;
        }

        // 4. فلتر التاريخ
        const matchesDate = (!milFrom || ex.exam_date >= milFrom) && (!milTo || ex.exam_date <= milTo);
        
        return matchesSubject && matchesDate;
    });
}, [profileData.military_exams, milFrom, milTo, milSubjectFilter, milSectionsList]);

    const filteredReports = useMemo(() => {
        let base = profileData.reports || [];
        if (reportSubjectFilter !== 'all') {
            base = base.filter((r: any) => {
                const branch = r.branch || 'sports';
                if (reportSubjectFilter === 'fitness') return branch === 'sports' || branch === 'fitness';
                return branch === 'military';
            });
        }
        return base.filter((r: any) => {
            if (!reportFrom && !reportTo) return true;
            const clean = r.date?.replace(/\//g, '-');
            return clean >= (reportFrom || "0000-00-00") && clean <= (reportTo || "9999-99-99");
        });
    }, [profileData.reports, reportSubjectFilter, reportFrom, reportTo]);
const sportsExamsList = useMemo(() => {
    return (profileData.sports_exams || []).filter((ex: any) => {
        if (!sportsFrom && !sportsTo) return true;
        return ex.exam_date >= (sportsFrom || "0000-00-00") && ex.exam_date <= (sportsTo || "9999-99-99");
    });
}, [profileData.sports_exams, sportsFrom, sportsTo]);
    // Violations Logic (Date + Subject Filter)
    const filteredStatusStats = useMemo(() => {
        const filtered: any = {};
        Object.entries(profileData.status_stats || {}).forEach(([key, val]: any) => {
            let details = val.details;
            // 1. Subject Filter
            if (violationSubjectFilter !== 'all') {
                details = details.filter((d: any) => d.subject === violationSubjectFilter);
            }
            // 2. Date Filter
            if (vioFrom || vioTo) {
                details = details.filter((d: any) => {
                    const cleanDate = d.date?.replace(/\//g, '-');
                    return cleanDate >= (vioFrom || "0000-00-00") && cleanDate <= (vioTo || "9999-99-99");
                });
            }
            if (details.length > 0) filtered[key] = { count: details.length, details };
        });
        return filtered;
    }, [profileData.status_stats, violationSubjectFilter, vioFrom, vioTo]);

    const filteredViolationStats = useMemo(() => {
        const filtered: any = {};
        Object.entries(profileData.violation_stats || {}).forEach(([key, val]: any) => {
            let details = val.details;
            if (violationSubjectFilter !== 'all') {
                details = details.filter((d: any) => d.subject === violationSubjectFilter);
            }
            if (vioFrom || vioTo) {
                details = details.filter((d: any) => {
                    const cleanDate = d.date?.replace(/\//g, '-');
                    return cleanDate >= (vioFrom || "0000-00-00") && cleanDate <= (vioTo || "9999-99-99");
                });
            }
            if (details.length > 0) filtered[key] = { count: details.length, details };
        });
        return filtered;
    }, [profileData.violation_stats, violationSubjectFilter, vioFrom, vioTo]);

    // Sub-Pagination (Based on filtered lists)
    const paginatedWeights = useMemo(() => {
        const start = (weightsPage - 1) * weightsPerPage;
        return filteredWeightsList.slice(start, start + weightsPerPage);
    }, [filteredWeightsList, weightsPage, weightsPerPage]);
    
    const paginatedMilExams = useMemo(() => {
        const start = (milExamsPage - 1) * milExamsPerPage;
        return milExamsList.slice(start, start + milExamsPerPage);
    }, [milExamsList, milExamsPage, milExamsPerPage]);
    
    const paginatedReports = useMemo(() => {
        const start = (reportsPage - 1) * reportsPerPage;
        return filteredReports.slice(start, start + reportsPerPage);
    }, [filteredReports, reportsPage, reportsPerPage]);
    
 const fitnessExamsList = useMemo(() => {
    // البيانات تأتي جاهزة من الباك إند، لا داعي للبحث داخل JSON
    return (profileData.military_exams || []).filter((ex: any) => {
        
        // التحقق من وجود درجات لياقة (بالمفاتيح العربية أو الإنجليزية)
        const hasFitnessData = 
            ex["الجري"] !== undefined || 
            ex["الضغط"] !== undefined || 
            ex["البطن"] !== undefined ||
            ex.run_time !== undefined;

        // فلترة التاريخ
        const matchesDate = (!sportsFrom || ex.exam_date >= sportsFrom) && (!sportsTo || ex.exam_date <= sportsTo);
        
        return hasFitnessData && matchesDate;

    }).sort((a: any, b: any) => b.exam_date.localeCompare(a.exam_date));
}, [profileData.military_exams, sportsFrom, sportsTo]);

// 🟢 2. التحقق من وجود درجة مدرب (بالمفتاح العربي)
const hasTrainerScore = useMemo(() => {
    return fitnessExamsList.some((ex: any) => 
        ex.students_data?.some((s: any) => s["درجة المدرب"] !== null && s["درجة المدرب"] !== undefined && s["درجة المدرب"] !== "")
    );
}, [fitnessExamsList]);
// 🟢 التحقق من وجود درجة مدرب في الاختبارات العسكرية (رماية/مشاة)
const hasTrainerScoreMil = useMemo(() => {
    return milExamsList.some((ex: any) => 
        ex.trainer_score !== null && ex.trainer_score !== undefined && ex.trainer_score !== 0
    );
}, [milExamsList]);
// 🟢 3. الترقيم الخاص بجدول اللياقة
const paginatedFitExams = useMemo(() => {
    const start = (fitExamsPage - 1) * fitExamsPerPage;
    return fitnessExamsList.slice(start, start + fitExamsPerPage);
}, [fitnessExamsList, fitExamsPage, fitExamsPerPage]);

const totalFitExamsPages = Math.ceil(fitnessExamsList.length / fitExamsPerPage);
    // Total Pages
    const totalReportsPages = Math.ceil(filteredReports.length / reportsPerPage);
    const totalWeightsPages = Math.ceil(filteredWeightsList.length / weightsPerPage);
    const totalMilExamsPages = Math.ceil(milExamsList.length / milExamsPerPage);

    // Helpers
    const showHistory = (title: string, details: any[]) => setHistoryDialog({ open: true, title, details });
    const isDiploma = useMemo(() => selectedSoldier?.course?.includes("دبلوم"), [selectedSoldier]);
    const canAccessAcademic = useMemo(() => ["owner", "manager", "admin", "sports_officer", "military_officer"].includes(userRole || ""), [userRole]);

    const pageTitle = currentBranch === 'military' 
        ? "دليل المجندين (التدريب العسكري)" 
        : "دليل المجندين (التدريب الرياضي)";

    // --- 6. Effects ---
    // 1️⃣ هذا الـ Effect مسؤول عن جلب البيانات الأولية "مرة واحدة فقط" عند فتح الصفحة
    useEffect(() => {
        setIsClient(true);
        
        const fetchInitialData = async () => {
            const token = localStorage.getItem("token");
            if (!token) return;
            const headers = { "Authorization": `Bearer ${token}` };
            
            try {
                // جلب الأقسام العسكرية (رماية، مشاة، أسلحة، إلخ)
                const resSec = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/military-sections`, { headers });
                if (resSec.ok) {
                    const sections = await resSec.json();
                    setMilSectionsList(sections);
                }

                // جلب خيارات الفلاتر الأولية
                const resFilters = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/filters-options`, { headers });
                if (resFilters.ok) setFilterOptions(await resFilters.json());
            } catch (e) {
                console.error("Initial Data Fetch Error:", e);
            }
        };

        fetchInitialData();
    }, []);

    // 2️⃣ هذا الـ Effect مسؤول عن تحديث خيارات الفلاتر "فقط" عند تغيير الاختيارات
    useEffect(() => {
        if (!isClient) return;

        const fetchDependentFilters = async () => {
            const token = localStorage.getItem("token");
            const headers = { "Authorization": `Bearer ${token}` };
            try {
                const p = new URLSearchParams();
                if (filterCourse !== 'all') p.append('course', filterCourse);
                if (filterBatch !== 'all') p.append('batch', filterBatch);
                if (filterCompany !== 'all') p.append('company', filterCompany);

                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/filters-options?${p.toString()}`, { headers });
                if (res.ok) setFilterOptions(await res.json());
            } catch (e) {
                console.error("Filter Update Error:", e);
            }
        };

        fetchDependentFilters();
    }, [filterCourse, filterBatch, filterCompany, isClient]);
    const fetchSoldiers = async () => {
        setLoading(true);
        const token = localStorage.getItem("token");
        try {
            const p = new URLSearchParams({ limit: "1000" });
            if (filterCourse !== 'all') p.append('course', filterCourse);
            if (filterBatch !== 'all') p.append('batch', filterBatch);
            if (filterCompany !== 'all') p.append('company', filterCompany);
            if (filterPlatoon !== 'all') p.append('platoon', filterPlatoon);
            if (searchQuery) p.append('search', searchQuery);
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/?${p.toString()}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            setSoldiersList(data.data || []);
            setCurrentPage(1);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }

    const fetchProfileDetails = async (id: number) => {
        setLoadingProfile(true);
        const token = localStorage.getItem("token");
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/${id}/full-profile`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) setProfileData(await res.json());
        } catch (e) { console.error(e); }
        finally { setLoadingProfile(false); }
    }

    const handleOpenProfile = (soldier: any) => { setSelectedSoldier(soldier); fetchProfileDetails(soldier.id); }
    const handleBackToDirectory = () => { setSelectedSoldier(null); setProfileData({ weights: [], status_stats: {}, violation_stats: {}, reports: [], military_exams: [] }); }
    
    const handlePrint = () => {
        const originalTitle = document.title;
        document.title = selectedSoldier ? `ملف_المجند_${selectedSoldier.name}` : "دليل_المجندين";
        window.print();
        setTimeout(() => { document.title = originalTitle; }, 1000);
    }

    const calculateGrade = (total: any, notes: string) => {
        if (absenceKeywords.some((k: string) => notes?.includes(k)) || total === null || total === undefined) return "-";
        const s = parseFloat(total);
        if (s >= 90) return "ممتاز";
        if (s >= 80) return "جيد جداً";
        if (s >= 70) return "جيد";
        if (s >= 60) return "مقبول";
        return "رسوب";
    };

    const mockAcademicData = [
        { subject: "التاريخ القطري", date: "2025-11-10", result: "95.00", grade: "ممتاز", category: "أ", notes: "-" },
        { subject: "اللغة العربية", date: "2025-11-12", result: "88.00", grade: "جيد جداً", category: "ب", notes: "مستوى متميز" },
        { subject: "قانون العقوبات", date: "2025-11-15", result: "75.00", grade: "جيد", category: "ج", notes: "-" },
        { subject: "حقوق الإنسان", date: "2025-11-18", result: "92.00", grade: "ممتاز", category: "أ", notes: "-" },
        { subject: "الإجراءات الجنائية", date: "2025-11-20", result: "65.00", grade: "مقبول", category: "د", notes: "يحتاج تركيز" },
    ];

    const getSubjectInfo = (type: string) => {
        if (type === 'fitness') return { label: 'لياقة', icon: <Activity className="w-3 h-3"/>, color: 'bg-blue-100 text-blue-700' };
        if (type === 'combat') return { label: 'اشتباك', icon: <Dumbbell className="w-3 h-3"/>, color: 'bg-purple-100 text-purple-700' };
        if (type === 'sports') return { label: 'فرع التدريب الرياضي', icon: <Activity className="w-3 h-3"/>, color: 'bg-blue-100 text-blue-700' };
        if (type === 'military') return { label: 'فرع التدريب العسكري', icon: <Target className="w-3 h-3"/>, color: 'bg-green-100 text-green-700' };
        return { label: type || 'عام', icon: <FileText className="w-3 h-3"/>, color: 'bg-slate-100 text-slate-700' };
    }

    const DateFilterUI = ({ from, setFrom, to, setTo }: any) => (
        <div className="no-print bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500">من:</span>
                <Input type="date" className="h-8 text-xs w-32 bg-white" value={from} onChange={(e)=>setFrom(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500">إلى:</span>
                <Input type="date" className="h-8 text-xs w-32 bg-white" value={to} onChange={(e)=>setTo(e.target.value)} />
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); }} className="h-8 text-[10px] text-red-500 gap-1"><RotateCcw className="w-3 h-3"/> إلغاء</Button>
        </div>
    );

    const renderAcademicTable = (data: any[]) => (
        <div className="space-y-4">
            <div className="overflow-x-auto border rounded-lg">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="text-right font-bold">المادة</TableHead>
                            <TableHead className="text-center font-bold">التاريخ</TableHead>
                            <TableHead className="text-center font-bold">النتيجة</TableHead>
                            <TableHead className="text-center font-bold">التقدير</TableHead>
                            <TableHead className="text-center font-bold">الفئة</TableHead>
                            <TableHead className="text-right font-bold px-4">الملاحظات</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((row, idx) => (
                            <TableRow key={idx}>
                                <TableCell className="text-right font-bold text-slate-700">{row.subject}</TableCell>
                                <TableCell className="text-center font-mono text-xs">{row.date}</TableCell>
                                <TableCell className="text-center font-black text-blue-600">{row.result}</TableCell>
                                <TableCell className="text-center"><Badge className="bg-green-100 text-green-700 border-green-200">{row.grade}</Badge></TableCell>
                                <TableCell className="text-center font-bold text-purple-600">{row.category}</TableCell>
                                <TableCell className="text-right text-xs text-slate-400">{row.notes}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            {/* Fake Pagination */}
            <div className="no-print flex flex-col sm:flex-row items-center justify-between pt-2 gap-4 border-t mt-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>عرض:</span>
                    <Select defaultValue="10">
                        <SelectTrigger className="w-[70px] h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem></SelectContent>
                    </Select>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled className="h-7 text-xs"><ChevronRight className="w-3 h-3 ml-1" /> السابق</Button>
                    <Button variant="outline" size="sm" disabled className="h-7 text-xs">التالي <ChevronLeft className="w-3 h-3 mr-1" /></Button>
                </div>
            </div>
        </div>
    );

    const renderDiplomaTabs = (content: React.ReactNode) => (
        <Tabs defaultValue="foundation" className="w-full" dir="rtl">
            <TabsList className="bg-slate-100 p-1 w-full justify-start overflow-x-auto flex-nowrap h-10 mb-4 no-print">
                <TabsTrigger value="foundation" className="text-[10px] md:text-xs font-bold">الفترة التأسيسية</TabsTrigger>
                <TabsTrigger value="sem1" className="text-[10px] md:text-xs font-bold">الفصل الأول</TabsTrigger>
                <TabsTrigger value="sem2" className="text-[10px] md:text-xs font-bold">الفصل الثاني</TabsTrigger>
                <TabsTrigger value="sem3" className="text-[10px] md:text-xs font-bold">الفصل الثالث</TabsTrigger>
                <TabsTrigger value="sem4" className="text-[10px] md:text-xs font-bold">الفصل الرابع</TabsTrigger>
            </TabsList>
            <TabsContent value="foundation">{content}</TabsContent>
            {["sem1", "sem2", "sem3", "sem4"].map(sem => (
                <TabsContent key={sem} value={sem} className="text-center py-10 text-slate-400 border-2 border-dashed rounded-lg">لا توجد بيانات لهذا الفصل حالياً</TabsContent>
            ))}
        </Tabs>
    );
// 🟢 دالة احترافية لفتح المرفقات وتجاوز حظر المتصفح
// 🟢 دالة مطورة لفتح المرفقات (سواء كانت رابطاً من السيرفر أو Base64)
const handleOpenAnyFile = (fileData: string) => {
    if (!fileData) return;

    // 1. إذا كان الملف يبدأ بـ /static (رابط فيزيائي من السيرفر)
    if (fileData.startsWith('/static') || fileData.startsWith('http')) {
        const fullUrl = fileData.startsWith('/static') 
            ? `${process.env.NEXT_PUBLIC_API_URL}${fileData}` 
            : fileData;
        window.open(fullUrl, '_blank');
        return;
    }

    // 2. إذا كان الملف Base64 (كما في الحالات الطبية المسجلة محلياً)
    try {
        const isPDF = fileData.includes("application/pdf") || fileData.startsWith("data:application/pdf");
        const base64Content = fileData.split(',')[1];
        const byteCharacters = atob(base64Content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: isPDF ? 'application/pdf' : 'image/jpeg' });
        const fileURL = URL.createObjectURL(blob);
        window.open(fileURL, '_blank');
    } catch (e) {
        toast.error("عفواً، فشل فتح هذا المرفق");
    }
};
// 🟢 فلترة الحالات الإدارية (تستخدم reportFrom / reportTo)
const filteredAttendance = useMemo(() => {
    return (profileData.attendance_list || []).filter((item: any) => {
        if (!reportFrom && !reportTo) return true;
        const d = item.start_date;
        return d >= (reportFrom || "0000-00-00") && d <= (reportTo || "9999-99-99");
    });
}, [profileData.attendance_list, reportFrom, reportTo]);

// 🔴 فلترة المخالفات (تستخدم vioFrom / vioTo)
const filteredViolations = useMemo(() => {
    return (profileData.violations_list || []).filter((item: any) => {
        const matchesDate = (!vioFrom || item.date >= vioFrom) && (!vioTo || item.date <= vioTo);
        const matchesSubject = violationSubjectFilter === 'all' || item.branch === violationSubjectFilter;
        return matchesDate && matchesSubject;
    });
}, [profileData.violations_list, vioFrom, vioTo, violationSubjectFilter]);
    if (!isClient) return null;
const hasFullAccess = ["owner", "manager", "admin", "assistant_admin", "sports_officer", "military_officer"].includes(userRole || "");
    return (
        <ProtectedRoute allowedRoles={["owner","manager","admin","assistant_admin","sports_officer","sports_supervisor", "sports_trainer","military_officer","military_supervisor", "military_trainer"]}>
        <div className="space-y-6 p-2 md:p-6 pb-20 md:pb-32" dir="rtl">
            <style jsx global>{`
                @media print {
                    @page { size: portrait; margin: 2mm; }
                    nav, aside, header, button, .print\\:hidden, [role="dialog"], .no-print { display: none !important; }
                    body { background: white; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .print-header { display: flex !important; }
                    th { background-color: #c5b391 !important; color: black !important; font-weight: bold; border: 1px solid black !important; }
                    td { border: 1px solid black !important; text-align: center !important; }
                    [data-state="closed"] { display: block !important; height: auto !important; visibility: visible !important; }
                    .border-t { border-top: 1px solid black !important; }
                    .accordion-trigger-text { font-weight: bold !important; color: black !important; font-size: 14pt !important; display: block !important; }
                    button[aria-expanded] { display: flex !important; }
                    .break-avoid { break-inside: avoid; page-break-inside: avoid; }
                    .print-profile-card { display: flex !important; flex-direction: row !important; align-items: center !important; border: 2px solid black !important; padding: 15px !important; border-radius: 10px !important; background: white !important; margin-bottom: 20px !important; box-shadow: none !important; height: auto !important; }
                    .screen-profile-header { display: none !important; }
                    .print-path-fix { border: none !important; background: transparent !important; margin: 0 !important; padding: 0 !important; color: black !important; }
                }
                .print-header { display: none; }
            `}</style>
            
            {/* VIEW 1: DIRECTORY */}
            {!selectedSoldier && (
                <div className="space-y-6 animate-in fade-in print:hidden">
                    <div className="flex justify-between items-center border-b pb-4">
                        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-slate-800">
                            {pageTitle}
                        </h1>
                        <Button variant="outline" onClick={fetchSoldiers} disabled={loading} className="gap-2 h-9 text-xs md:text-sm">
                            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> تحديث
                        </Button>
                    </div>

                    <Card className="bg-slate-50 border-slate-200 shadow-sm">
                        <CardContent className="p-3 md:p-4 space-y-3">
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
                                    <Input className="pr-10 h-10 bg-white" placeholder="بحث بالاسم أو الرقم العسكري..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchSoldiers()} />
                                </div>
                                <Button onClick={fetchSoldiers} className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-6 gap-2">
                                    {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <><Search className="w-4 h-4" /> بحث</>}
                                </Button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {["الدورة", "الدفعة", "السرية", "الفصيل"].map((label, idx) => (
                                    <div key={idx}>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">{label}</label>
                                        <Select 
                                            value={idx === 0 ? filterCourse : idx === 1 ? filterBatch : idx === 2 ? filterCompany : filterPlatoon} 
                                            onValueChange={(v) => [setFilterCourse, setFilterBatch, setFilterCompany, setFilterPlatoon][idx](v)}
                                        >
                                            <SelectTrigger className="bg-white h-9 text-xs"><SelectValue placeholder={`اختر ${label}`} /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">الكل</SelectItem>
                                                {(idx === 0 ? filterOptions.courses : idx === 1 ? filterOptions.batches : idx === 2 ? filterOptions.companies : filterOptions.platoons)?.map((opt: any) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                        {loading ? (<div className="col-span-full flex justify-center py-12"><Loader2 className="w-8 h-8 text-slate-300 animate-spin" /></div>) : paginatedSoldiers.length > 0 ? (
                            paginatedSoldiers.map((soldier) => (
                                <div key={soldier.id} className="bg-white border rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden group relative flex flex-col items-center p-4 text-center border-t-4 border-t-transparent hover:border-t-blue-600" onClick={() => handleOpenProfile(soldier)}>
                                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-slate-100 border-4 border-white shadow-sm mb-3 overflow-hidden group-hover:scale-105 transition-transform">
                                        <img 
    // 🟢 نستخدم الرابط السحابي المخزن في قاعدة البيانات
    src={soldier.image_url || "/placeholder-user.png"} 
    className="w-full h-full object-cover" 
    onError={(e:any) => {
        // إذا فشل التحميل، نضع الصورة الافتراضية بدلاً من إخفائها
        e.target.src = "/placeholder-user.png";
    }} 
/>
                                    </div>
                                    <h3 className="font-bold text-slate-800 text-sm md:text-base line-clamp-1">{soldier.name}</h3>
                                    <Badge variant="secondary" className="mt-1 font-mono text-[10px] md:text-xs px-2">{soldier.military_id}</Badge>
                                    <div className="mt-3 w-full grid grid-cols-2 gap-1 text-[10px] md:text-xs text-slate-500 bg-slate-50 p-2 rounded-lg"><div>السرية</div><div>الفصيل</div><div className="font-bold text-slate-700">{soldier.company}</div><div className="font-bold text-slate-700">{soldier.platoon}</div></div>
                                </div>
                            ))
                        ) : (<div className="col-span-full text-center py-12 text-slate-400 border-2 border-dashed rounded-xl bg-slate-50"><Users className="w-10 h-10 mx-auto mb-2 opacity-20" /><p className="text-sm">لا توجد نتائج</p></div>)}
                    </div>

                    {soldiersList.length > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-3 border rounded-xl shadow-sm gap-4 mt-4">
                            <div className="flex items-center gap-4 text-xs text-slate-500"><span>صفحة <b>{currentPage}</b> من <b>{totalPages || 1}</b></span><div className="flex items-center gap-2 mr-4 border-r pr-4"><span className="font-bold">عرض:</span><Select value={String(itemsPerPage)} onValueChange={(val) => { setItemsPerPage(Number(val)); setCurrentPage(1); }}><SelectTrigger className="w-[70px] h-8 text-xs bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem></SelectContent></Select></div></div>
                            <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="h-8 text-xs"><ChevronRight className="w-3 h-3 ml-1" /> السابق</Button><Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage >= totalPages} className="h-8 text-xs">التالي <ChevronLeft className="w-3 h-3 mr-1" /></Button></div>
                        </div>
                    )}
                </div>
            )}

            {/* VIEW 2: PROFILE */}
            {selectedSoldier && (
                <div className="space-y-6 animate-in slide-in-from-left-4 max-w-5xl mx-auto">
                    
                    <div className="print-header flex-col mb-8 w-full">
                        <div className="flex justify-between items-end w-full mb-4 pb-4 border-b-2 border-black">
                            <div className="w-24 h-24"><img src="/logo.jpg" alt="Logo" className="w-full h-full object-contain" /></div>
                            <div className="text-center flex-1">
                                <h2 className="text-xl font-bold">معهد الشرطة</h2>
                                <h3 className="text-lg font-semibold">قسم التدريب العسكري والرياضي</h3>
                                <h3 className="text-lg font-semibold">فرع التدريب {currentBranch === 'military' ? 'العسكري' : 'الرياضي'}</h3>
                            </div>
                            <div className="w-auto flex flex-col items-end gap-1 pl-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold border-b border-black">:اليوم</span>
                                    <span className="font-bold text-sm">{format(new Date(), "EEEE", { locale: ar })}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold border-b border-black">:التاريخ</span>
                                    <span className="font-bold font-mono text-sm">{format(new Date(), "yyyy-MM-dd")}</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-center"><h1 className="text-2xl font-bold underline mb-4">بطاقة بيانات مجند</h1></div>
                    </div>

                    <div className="flex justify-between items-center print:hidden">
                        <Button variant="ghost" onClick={handleBackToDirectory} className="gap-2 hover:bg-slate-100"><ArrowRight className="w-4 h-4" /> العودة للدليل</Button>
                        <Button variant="outline" onClick={handlePrint} className="gap-2 border-slate-300">
                            <Printer className="w-4 h-4" /> طباعة الملف
                        </Button>
                    </div>

                    {/* 1. Header Card (Screen) */}
                    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden screen-profile-header print:hidden">
                        <div className="h-32 bg-slate-900 w-full relative">
                            <div className="absolute top-4 left-4 flex gap-2"><Badge className="bg-white/10 text-white hover:bg-white/20 backdrop-blur border-0">{selectedSoldier.rank || "مستجد"}</Badge></div>
                        </div>
                        <div className="px-6 pb-6 relative">
                            <div className="flex flex-col md:flex-row gap-6 items-start">
                                <div className="-mt-12 md:-mt-16 z-10 flex-shrink-0 mx-auto md:mx-0">
                                    <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-white p-1.5 shadow-lg">
                                        <div className="w-full h-full rounded-xl bg-slate-200 overflow-hidden relative border border-slate-100">
                                            <img src={selectedSoldier.image_url || "/placeholder-user.png"} className="w-full h-full object-cover" onError={(e:any) => { e.target.src = "/placeholder-user.png"; }} />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 pt-2 md:pt-4 text-center md:text-right w-full">
                                    <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                        <div>
                                            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">{selectedSoldier.name}</h1>
                                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2 text-slate-500">
                                                <span className="font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-sm text-slate-700 border">{selectedSoldier.military_id}</span>
                                               <span className="hidden md:inline">•</span>
<span className="text-sm">{selectedSoldier.nationality || "غير محدد"}</span>
                                                <span className="hidden md:inline">•</span>
<span className="text-sm">
    {selectedSoldier.dob 
        ? `${new Date().getFullYear() - new Date(selectedSoldier.dob).getFullYear()} سنة` 
        : ""} 
</span>
                                                <span className="hidden md:inline">•</span><span className="text-sm">الطول: {selectedSoldier.height || "-"} سم</span>
                                                <span className="hidden md:inline">•</span><span className="text-sm">الوزن: {selectedSoldier.initial_weight || "-"} كغ</span>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-lg border w-full md:w-auto mt-2 md:mt-0 print-path-fix">
                                            <div className="flex items-center gap-2 text-sm text-slate-600 mb-1"><MapPin className="w-4 h-4 text-blue-500"/><span className="font-bold">المسار التدريبي</span></div>
                                            <div className="text-xs font-bold text-black">{selectedSoldier.course} / {selectedSoldier.company} / {selectedSoldier.platoon}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 1. Header Card (Print) */}
                    <div className="hidden print-profile-card">
                        <div className="w-32 h-32 flex-shrink-0 ml-6 border border-black p-1 print:w-32 print:h-32">
                            <img src={selectedSoldier.image_url || "/placeholder-user.png"} className="w-full h-full object-cover" onError={(e:any) => { e.target.src = "/placeholder-user.png"; }} />
                        </div>
                        <div className="flex-1 text-right space-y-2">
                            <div className="flex gap-2 text-sm border-b border-gray-300 pb-1">
                                <span className="font-bold w-24">الاسم الكامل:</span><span>{selectedSoldier.name}</span>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex gap-2 text-sm"><span className="font-bold">الرقم العسكري:</span><span className="font-mono">{selectedSoldier.military_id}</span></div>
                                <div className="flex gap-2 text-sm"><span className="font-bold">الرتبة:</span><span>{selectedSoldier.rank || "مستجد"}</span></div>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex gap-2 text-sm">
    <span className="font-bold">الجنسية:</span>
    <span>{selectedSoldier.nationality || "غير محدد"}</span>
</div>
                                <div className="flex gap-2 text-sm">
    <span className="font-bold">العمر:</span>
    <span>
        {selectedSoldier.dob 
            ? `${new Date().getFullYear() - new Date(selectedSoldier.dob).getFullYear()} سنة` 
            : ""}
    </span>
</div>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex gap-2 text-sm"><span className="font-bold">الطول:</span><span>{selectedSoldier.height || "-"} سم</span></div>
                                <div className="flex gap-2 text-sm"><span className="font-bold">الوزن الأولي:</span><span>{selectedSoldier.initial_weight || "-"} كغ</span></div>
                            </div>
                            <div className="flex gap-2 text-sm pt-1"><span className="font-bold">المسار:</span><span>{selectedSoldier.course} / {selectedSoldier.company} / {selectedSoldier.platoon}</span></div>
                        </div>
                    </div>

                    <Accordion type="multiple" defaultValue={[]} className="w-full space-y-4">
                        
                       {/* 🟢 كرت اختبارات اللياقة البدنية (جديد) */}
<AccordionItem value="item-fitness-new" className="border rounded-xl bg-white px-4 shadow-sm break-avoid" dir="rtl">
    <AccordionTrigger className="hover:no-underline py-4 accordion-trigger-text text-right">
        <div className="flex items-center gap-3 justify-start w-full">
            <div className="p-2 bg-blue-50 rounded-lg">
                <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <span className="font-bold text-slate-800 text-lg">سجل اختبارات اللياقة البدنية</span>
            {fitnessExamsList.length > 0 && (
                <Badge className="bg-blue-600 text-white mr-2">{fitnessExamsList.length}</Badge>
            )}
        </div>
    </AccordionTrigger>
    
    <AccordionContent className="pb-4 pt-2 border-t text-right">
        {fitnessExamsList.length > 0 ? (
            <div className="space-y-4">
                {/* التمرير الأفقي للجدول الكبير */}
                <div className="overflow-x-auto border rounded-lg shadow-sm">
    {/* 🟢 التعديل: w-full للطباعة و min-w للشاشة، مع fixed layout عند الطباعة */}
    <Table className="w-full lg:min-w-[1200px] text-center border-collapse print:table-fixed print:text-[9px]">
        <TableHeader className="bg-slate-50">
            <TableRow className="border-b border-slate-300">
                {/* 🟢 تحديد عرض الأعمدة بالنسبة المئوية عند الطباعة لضمان التنسيق */}
                <TableHead className="text-right font-bold border-l w-40 print:w-[18%]">اسم الاختبار</TableHead>
                <TableHead className="text-center font-bold border-l w-28 print:w-[12%]">التاريخ</TableHead>
                
                {/* الجري */}
                <TableHead className="text-center font-bold border-l bg-amber-50/50 print:w-[8%]">الجري</TableHead>
                <TableHead className="text-center font-bold border-l bg-amber-50/50 print:hidden">الدرجة</TableHead>
                <TableHead className="text-center font-bold border-l bg-amber-50/50 print:hidden">التقدير</TableHead>

                {/* الضغط */}
                <TableHead className="text-center font-bold border-l bg-blue-50/50 print:w-[8%]">الضغط</TableHead>
                <TableHead className="text-center font-bold border-l bg-blue-50/50 print:hidden">الدرجة</TableHead>
                <TableHead className="text-center font-bold border-l bg-blue-50/50 print:hidden">التقدير</TableHead>

                {/* البطن */}
                <TableHead className="text-center font-bold border-l bg-green-50/50 print:w-[8%]">البطن</TableHead>
                <TableHead className="text-center font-bold border-l bg-green-50/50 print:hidden">الدرجة</TableHead>
                <TableHead className="text-center font-bold border-l bg-green-50/50 print:hidden">التقدير</TableHead>

                {/* الخلاصة والتقدير */}
                <TableHead className="text-center font-bold border-l bg-slate-100 print:hidden">النهائية</TableHead>
                <TableHead className="text-center font-bold border-l bg-slate-100 print:w-[12%]">التقدير العام</TableHead>
                <TableHead className="text-center font-bold border-l bg-slate-100 print:hidden">النتيجة</TableHead>

                {/* درجة المدرب */}
                {hasTrainerScore && <TableHead className="text-center font-bold border-l bg-purple-50 print:w-[10%]">درجة المدرب</TableHead>}
                
                <TableHead className="text-right font-bold px-4 print:w-[24%]">ملاحظات</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {paginatedFitExams.map((ex: any, idx: number) => (
    <TableRow key={idx} className="hover:bg-slate-50 transition-colors border-b border-slate-200">
        <TableCell className="text-right font-bold border-l truncate">
            {ex.title?.split(" - ")[0]}
        </TableCell>
        <TableCell className="text-center font-mono text-[10px] border-l">
            {ex.exam_date}
        </TableCell>
        
        {/* الجري: نقرأ من ex مباشرة مع دعم المسميات المختلفة */}
        <TableCell className="text-center border-l font-black text-amber-700">
            {ex["الجري"] ?? ex["الجرى"] ?? ex.run_time ?? "-"}
        </TableCell>
        <TableCell className="text-center border-l print:hidden">
            {ex["درجة الجري"] ?? ex["درجة الجرى"] ?? ex.run_score ?? "-"}
        </TableCell>
        <TableCell className="text-center border-l text-[10px] print:hidden">
            {ex["تقدير الجري"] ?? ex["تقدير الجرى"] ?? ex.run_grade ?? "-"}
        </TableCell>

        {/* الضغط */}
        <TableCell className="text-center border-l font-black text-blue-700">
            {ex["الضغط"] ?? ex.pushups ?? ex.push_count ?? "-"}
        </TableCell>
        <TableCell className="text-center border-l print:hidden">
            {ex["درجة الضغط"] ?? ex.push_score ?? "-"}
        </TableCell>
        <TableCell className="text-center border-l text-[10px] print:hidden">
            {ex["تقدير الضغط"] ?? ex.push_grade ?? "-"}
        </TableCell>

        {/* البطن */}
        <TableCell className="text-center border-l font-black text-green-700">
            {ex["البطن"] ?? ex.situps ?? ex.sit_count ?? "-"}
        </TableCell>
        <TableCell className="text-center border-l print:hidden">
            {ex["درجة البطن"] ?? ex.sit_score ?? "-"}
        </TableCell>
        <TableCell className="text-center border-l text-[10px] print:hidden">
            {ex["تقدير البطن"] ?? ex.sit_grade ?? "-"}
        </TableCell>

        {/* النهائيات */}
        <TableCell className="text-center border-l font-black bg-slate-50 print:hidden">
            {ex["الدرجة النهائية"] ?? ex["الدرجة_النهائية"] ?? ex.average ?? ex.total_final ?? "-"}
        </TableCell>
        <TableCell className="text-center border-l bg-slate-50">
            <span className="font-bold">
                {ex["التقدير العام"] ?? ex["التقدير"] ?? ex.grade ?? "-"}
            </span>
        </TableCell>
        <TableCell className="text-center border-l bg-slate-50 print:hidden">
            {ex["النتيجة"] ?? ex.result ?? ex.final_result ?? "-"}
        </TableCell>

        {hasTrainerScore && (
            <TableCell className="text-center border-l font-bold text-purple-700">
                {ex["درجة المدرب"] ?? ex.trainer_score ?? "-"}
            </TableCell>
        )}
        
        <TableCell className="text-right text-[10px] text-slate-500 px-4 leading-tight">
            {ex["ملاحظات"] ?? ex.notes ?? "-"}
        </TableCell>
    </TableRow>
))}
        </TableBody>
    </Table>
</div>

                {/* شريط الترقيم الداخلي */}
                <div className="no-print flex flex-col sm:flex-row items-center justify-between pt-2 gap-4 border-t">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>صفحة <b>{fitExamsPage}</b> من <b>{totalFitExamsPages || 1}</b></span>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setFitExamsPage(p => Math.max(p - 1, 1))} disabled={fitExamsPage === 1} className="h-7 text-xs">السابق</Button>
                        <Button variant="outline" size="sm" onClick={() => setFitExamsPage(p => Math.min(p + 1, totalFitExamsPages))} disabled={fitExamsPage >= totalFitExamsPages} className="h-7 text-xs">التالي</Button>
                    </div>
                </div>
            </div>
        ) : (
            <div className="text-center py-12 text-slate-400 border-2 border-dashed rounded-lg bg-slate-50/50">
                <Calculator className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium italic">لا توجد اختبارات لياقة بدنية مسجلة لهذا المجند بعد.</p>
            </div>
        )}
    </AccordionContent>
</AccordionItem>

{/* 🟢 كرت اختبارات الاشتباك والدفاع عن النفس (معدل) */}
<AccordionItem value="item-1" className="border rounded-xl bg-white px-4 shadow-sm break-avoid" dir="rtl">
    <AccordionTrigger className="hover:no-underline py-4 accordion-trigger-text text-right">
        <div className="flex items-center gap-3 justify-start w-full">
            <div className="p-2 bg-purple-50 rounded-lg">
                <Swords className="w-5 h-5 text-purple-600" />
            </div>
            <span className="font-bold text-slate-800 text-lg">اختبارات الاشتباك والدفاع عن النفس</span>
            {sportsExamsList.filter((ex: any) => ex.subject === "اشتباك").length > 0 && (
                <Badge className="bg-purple-600 text-white mr-2">
                    {sportsExamsList.filter((ex: any) => ex.subject === "اشتباك").length}
                </Badge>
            )}
        </div>
    </AccordionTrigger>
    
    <AccordionContent className="pb-4 pt-2 border-t text-right" dir="rtl">
        
        {/* زر العين للفلترة بالتاريخ */}
        <div className="flex items-center gap-2 mb-4 no-print">
            <Button 
                variant="outline" 
                size="sm" 
                className={cn(
                    "h-8 gap-2 text-[10px] font-bold transition-all",
                    showSportsFilter ? "bg-purple-50 text-purple-600 border-purple-200" : "bg-slate-50 text-slate-500"
                )}
                onClick={() => setShowSportsFilter(!showSportsFilter)}
            >
                <Eye className="w-3.5 h-3.5" />
                {showSportsFilter ? "إخفاء فلاتر التاريخ" : "بحث بالتاريخ"}
            </Button>
        </div>

        {showSportsFilter && (
            <div className="animate-in zoom-in-95 fade-in duration-300">
                <DateFilterUI from={sportsFrom} setFrom={setSportsFrom} to={sportsTo} setTo={setSportsTo} />
            </div>
        )}
        
        {/* عرض جدول الاشتباك مباشرة بدون Tabs */}
        {sportsExamsList.filter((ex: any) => ex.subject === "اشتباك").length > 0 ? (
            <div className="overflow-x-auto border rounded-lg shadow-sm">
                <Table className="w-full text-right" dir="rtl">
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="text-right font-bold text-slate-900 px-4">اسم الاختبار</TableHead>
                            <TableHead className="text-center font-bold text-slate-900">التاريخ</TableHead>
                            <TableHead className="text-center font-bold text-slate-900 bg-blue-50/30">المجموع  (90%)</TableHead>
        <TableHead className="text-center font-bold text-slate-900 bg-purple-50/30">درجة المدرب (10%)</TableHead>
                            <TableHead className="text-center font-bold text-slate-900">المجموع (100%)</TableHead>
                            <TableHead className="text-center font-bold text-slate-900">التقدير</TableHead>
                            <TableHead className="text-right font-bold text-slate-900 px-4">الملاحظات</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
    {sportsExamsList.filter((ex: any) => ex.subject === "اشتباك").map((ex: any, idx: number) => (
        <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors">
            <TableCell className="text-right font-bold text-slate-700 px-4">
                {ex.exam_title}
            </TableCell>
            <TableCell className="text-center font-mono text-xs text-slate-600">
                {ex.exam_date}
            </TableCell>
            
            {/* عرض القيم التفصيلية 🟢 */}
            <TableCell className="text-center font-bold text-blue-600">
                {ex.field_score || "0.00"}
            </TableCell>
            <TableCell className="text-center font-bold text-purple-600">
                {ex.trainer_score || "0.00"}
            </TableCell>

            <TableCell className="text-center font-black text-slate-900 text-base bg-slate-50/50">
                {ex.total?.toFixed(2) || "0.00"}
            </TableCell>
            <TableCell className="text-center">
                <Badge className={cn(
                    "font-bold px-3 py-0.5 shadow-sm",
                    calculateGrade(ex.total, ex.notes) === "رسوب" 
                        ? "bg-red-100 text-red-700 border-red-200" 
                        : "bg-green-100 text-green-700 border-green-200"
                )}>
                    {calculateGrade(ex.total, ex.notes)}
                </Badge>
            </TableCell>
            <TableCell className="text-right text-xs text-slate-500 px-4 leading-relaxed">
                {ex.notes || ""}
            </TableCell>
        </TableRow>
    ))}
</TableBody>
                </Table>
            </div>
        ) : (
            <div className="text-center py-12 text-slate-400 border-2 border-dashed rounded-lg bg-slate-50/50">
                <Swords className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium italic">عفواً، لا توجد نتائج اشتباك معتمدة لهذا المجند.</p>
            </div>
        )}
    </AccordionContent>
</AccordionItem>
                       {/* 2. كرت العسكري (تم إزالة التبويبات) */}
<AccordionItem value="item-2" className="border rounded-xl bg-white px-4 shadow-sm break-avoid">
    <AccordionTrigger className="hover:no-underline py-4 accordion-trigger-text">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
                <Shield className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">اختبارات فرع التدريب العسكري</span>
                {milExamsList.length > 0 && (
                    <Badge className="bg-green-100 text-green-700">{milExamsList.length}</Badge>
                )}
            </div>
        </div>
    </AccordionTrigger>
    
    <AccordionContent className="pb-4 pt-2 border-t">
        
        <div className="flex items-center justify-between mb-4 no-print gap-2">
        <div className="flex items-center gap-2">
            <Button 
                variant="outline" 
                size="sm" 
                className={cn(
                    "h-8 gap-2 text-[10px] font-bold transition-all",
                    showMilFilter ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-slate-50 text-slate-500"
                )}
                onClick={() => setShowMilFilter(!showMilFilter)}
            >
                <Eye className="w-3.5 h-3.5" />
                {showMilFilter ? "إخفاء التاريخ" : "بحث بالتاريخ"}
            </Button>
        </div>

       {/* قائمة اختيار نوع الاختبار - ديناميكية من قاعدة البيانات */}
<Select value={milSubjectFilter} onValueChange={(val) => { setMilSubjectFilter(val); setMilExamsPage(1); }}>
    <SelectTrigger className="w-[180px] h-8 text-[10px] bg-slate-50 border-slate-200 font-bold">
        <SelectValue placeholder="نوع الاختبار العسكري" />
    </SelectTrigger>
    <SelectContent dir="rtl">
        <SelectItem value="all">كل الاختبارات العسكرية</SelectItem>
        
        {/* 🟢 عرض كافة الأقسام المسجلة في الإعدادات (رماية، مشاة، أسلحة، الخ) */}
        {milSectionsList.map((sec: any) => (
            <SelectItem key={sec.id} value={sec.key}>
                {sec.name}
            </SelectItem>
        ))}
    </SelectContent>
</Select>
    </div>

        {/* 🟢 مربع التاريخ: يظهر فقط إذا كانت showMilFilter تساوي true */}
        {showMilFilter && (
            <div className="animate-in zoom-in-95 fade-in duration-300">
                <DateFilterUI from={milFrom} setFrom={setMilFrom} to={milTo} setTo={setMilTo} />
            </div>
        )}
        
        {/* عرض الجدول مباشرة دون شرط isDiploma */}
        {milExamsList.length > 0 ? (
            <div className="space-y-4">
                <div className="overflow-x-auto border rounded-lg">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="text-center font-bold">اسم الاختبار</TableHead>
                                <TableHead className="text-center font-bold">التاريخ</TableHead>
                                <TableHead className="text-center font-bold">
            {hasTrainerScoreMil ? "المجموع (90%)" : "المجموع"}
        </TableHead>

        {/* 🟢 إضافة عمود درجة المدرب إذا وجدت */}
        {hasTrainerScoreMil && (
            <TableHead className="text-center font-bold bg-purple-50/50 text-purple-700">
                درجة المدرب (10%)
            </TableHead>
        )}
                                <TableHead className="text-center font-bold">التقدير</TableHead>
                                <TableHead className="text-right font-bold px-4">الملاحظات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedMilExams.map((ex: any, idx: number) => (
                                <TableRow key={idx} className="hover:bg-slate-50/50">
                                    <TableCell className="text-center font-bold text-slate-700">{ex.title?.split(" - ")[0] || "اختبار"}</TableCell>
                                    <TableCell className="text-center font-mono text-xs">{ex.exam_date}</TableCell>
                                    <TableCell className="text-center font-black text-blue-700">
                {ex.total ?? "-"}
            </TableCell>

            {/* 🟢 خلية درجة المدرب تظهر فقط إذا كان العمود مفعلاً */}
            {hasTrainerScoreMil && (
                <TableCell className="text-center font-bold text-purple-700 bg-purple-50/30">
                    {ex.trainer_score ?? "-"}
                </TableCell>
            )}

            <TableCell className="text-center">
                {/* استخدام المجموع الكلي (الميداني + المدرب) لحساب التقدير إذا وجد */}
                <Badge variant="outline" className="font-bold">
                    {calculateGrade(ex.total_with_trainer || ex.total, ex.notes)}
                </Badge>
            </TableCell>
            <TableCell className="text-right text-xs text-slate-500 max-w-[200px] truncate">{ex.notes || "-"}</TableCell>
        </TableRow>
    ))}
</TableBody>
                    </Table>
                </div>
                
                {/* شريط الترقيم */}
                <div className="no-print flex flex-col sm:flex-row items-center justify-between pt-2 gap-4 border-t mt-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>صفحة <b>{milExamsPage}</b> من <b>{totalMilExamsPages || 1}</b></span>
                        <div className="flex items-center gap-2 mr-4 border-r pr-4">
                            <span className="font-bold">عرض:</span>
                            <Select value={String(milExamsPerPage)} onValueChange={(val) => { setMilExamsPerPage(Number(val)); setMilExamsPage(1); }}>
                                <SelectTrigger className="w-[70px] h-7 text-xs bg-white"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="5">5</SelectItem>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="20">20</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setMilExamsPage(p => Math.max(p - 1, 1))} disabled={milExamsPage === 1} className="h-7 text-xs"><ChevronRight className="w-3 h-3 ml-1" /> السابق</Button>
                        <Button variant="outline" size="sm" onClick={() => setMilExamsPage(p => Math.min(p + 1, totalMilExamsPages))} disabled={milExamsPage >= totalMilExamsPages} className="h-7 text-xs">التالي <ChevronLeft className="w-3 h-3 mr-1" /></Button>
                    </div>
                </div>
            </div>
        ) : (
            <div className="text-center py-8 text-slate-400">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">لا توجد اختبارات عسكرية مسجلة لهذا المجند.</p>
            </div>
        )}
    </AccordionContent>
</AccordionItem>

                        {/* 3. كرت الأكاديمي */}
                        {hasFullAccess && (
                        <AccordionItem value="item-3" className="border rounded-xl bg-white px-4 shadow-sm break-avoid relative overflow-hidden">
                            {!canAccessAcademic && <div className="absolute inset-0 bg-slate-50/50 backdrop-blur-[1px] z-10 cursor-not-allowed flex items-center justify-center"><Badge variant="outline" className="bg-white text-slate-400 gap-1"><ShieldAlert className="w-3 h-3"/> للعرض فقط للمسؤولين</Badge></div>}
                            <AccordionTrigger className={cn("hover:no-underline py-4 accordion-trigger-text", !canAccessAcademic && "pointer-events-none")}>
                                <div className="flex items-center gap-3"><div className="p-2 bg-yellow-50 rounded-lg"><GraduationCap className="w-5 h-5 text-yellow-600" /></div><span className="font-bold text-slate-800">المقرارات الأكاديمية</span></div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-4 pt-2 border-t">
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-3 text-amber-800 animate-pulse"><FileText className="w-5 h-5" /><p className="text-xs font-bold">هذا نموذج عرض تقديمي (Demo) لشكل عرض النتائج الأكاديمية مستقبلاً.</p></div>
                                {isDiploma ? renderDiplomaTabs(renderAcademicTable(mockAcademicData)) : renderAcademicTable(mockAcademicData)}
                            </AccordionContent>
                        </AccordionItem>
                        )}

                        {/* 4. كرت الوزن */}
                       <AccordionItem value="item-4" className="border rounded-xl bg-white px-4 shadow-sm break-avoid">
    <AccordionTrigger className="hover:no-underline py-4 accordion-trigger-text">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
                <Scale className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">الوزن الشهري</span>
                {(profileData.weights || []).length > 0 && (
                    <Badge className="bg-slate-200 text-slate-800 hover:bg-slate-300">
                        {(profileData.weights || []).length}
                    </Badge>
                )}
            </div>
        </div>
    </AccordionTrigger>

    <AccordionContent className="pb-4 pt-2 border-t">
        {/* 🟢 زر العين (مفتاح البحث بالتاريخ) الخاص بالوزن */}
        <div className="flex items-center gap-2 mb-4 no-print">
            <Button 
                variant="outline" 
                size="sm" 
                className={cn(
                    "h-8 gap-2 text-[10px] font-bold transition-all",
                    showWeightFilter ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-slate-50 text-slate-500"
                )}
                onClick={() => setShowWeightFilter(!showWeightFilter)}
            >
                <Eye className="w-3.5 h-3.5" />
                {showWeightFilter ? "إخفاء فلاتر التاريخ" : "بحث بالتاريخ"}
            </Button>
        </div>

        {/* 🟢 مربع التاريخ يظهر فقط عند تفعيل showWeightFilter */}
        {showWeightFilter && (
            <div className="animate-in zoom-in-95 fade-in duration-300">
                <DateFilterUI from={weightFrom} setFrom={setWeightFrom} to={weightTo} setTo={setWeightTo} />
            </div>
        )}

        {paginatedWeights.length > 0 ? (
            <div className="space-y-4">
                <div className="overflow-x-auto border rounded-lg">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="text-center font-bold">التاريخ</TableHead>
                                <TableHead className="text-center font-bold">الوزن (كغ)</TableHead>
                                <TableHead className="text-center font-bold">مؤشر (BMI)</TableHead>
                                <TableHead className="text-center font-bold">ملاحظات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedWeights.map((w: any, idx: number) => (
                                <TableRow key={idx} className="hover:bg-slate-50/50">
                                    <TableCell className="text-center font-mono">{w.date}</TableCell>
                                    <TableCell className="text-center font-bold text-slate-700">{w.weight}</TableCell>
                                    <TableCell className="text-center font-bold text-purple-600">
                                        {w.imc ? w.imc.toFixed(1) : "-"}
                                    </TableCell>
                                    <TableCell className="text-center text-sm text-slate-500">{w.note || "-"}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                
                {/* شريط الترقيم */}
                <div className="flex flex-col sm:flex-row items-center justify-between pt-2 gap-4 border-t mt-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>صفحة <b>{weightsPage}</b> من <b>{totalWeightsPages}</b></span>
                        <div className="flex items-center gap-2 mr-4 border-r pr-4">
                            <span className="font-bold">عرض:</span>
                            <Select value={String(weightsPerPage)} onValueChange={(val) => { setWeightsPerPage(Number(val)); setWeightsPage(1); }}>
                                <SelectTrigger className="w-[60px] h-7 text-xs bg-white"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="5">5</SelectItem>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="20">20</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setWeightsPage(prev => Math.max(prev - 1, 1))} disabled={weightsPage === 1} className="h-7 text-xs">
                            <ChevronRight className="w-3 h-3 ml-1" /> السابق
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setWeightsPage(prev => Math.min(prev + 1, totalWeightsPages))} disabled={weightsPage >= totalWeightsPages} className="h-7 text-xs">
                            التالي <ChevronLeft className="w-3 h-3 mr-1" />
                        </Button>
                    </div>
                </div>
            </div>
        ) : (
            <div className="text-center py-8 text-slate-400">
                <Scale className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">لا توجد بيانات وزن مسجلة لهذا المجند.</p>
            </div>
        )}
    </AccordionContent>
</AccordionItem>

                     {/* 🟢 كرت سجل الحالات الإدارية والطبية (الجديد) */}
                     {hasFullAccess && (
<AccordionItem value="item-admin-status" className="border rounded-xl bg-white px-4 shadow-sm break-avoid">
    <AccordionTrigger className="hover:no-underline py-4 accordion-trigger-text">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg"><CalIcon className="w-5 h-5 text-blue-600" /></div>
            <span className="font-bold text-slate-800 text-lg">سجل الحالات الإدارية والطبية</span>
            <Badge className="bg-blue-600 text-white mr-2">{filteredAttendance.length}</Badge>
        </div>
    </AccordionTrigger>
    <AccordionContent className="pb-4 pt-2 border-t text-right">
        {/* شريط البحث */}
        <div className="flex items-center gap-2 mb-4 no-print">
            <Button variant="outline" size="sm" 
                className={cn("h-8 gap-2 text-[10px] font-bold transition-all", showReportFilter ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-slate-50")}
                onClick={() => setShowReportFilter(!showReportFilter)}
            >
                <Eye className="w-3.5 h-3.5" /> {showReportFilter ? "إخفاء فلاتر التاريخ" : "بحث بالتاريخ"}
            </Button>
        </div>

        {showReportFilter && (
            <div className="animate-in zoom-in-95 fade-in duration-300">
                <DateFilterUI from={reportFrom} setFrom={setReportFrom} to={reportTo} setTo={setReportTo} />
            </div>
        )}

        <div className="overflow-x-auto border rounded-lg">
            <Table className="text-right">
                <TableHeader className="bg-slate-50">
                    <TableRow>
                        <TableHead className="font-bold text-slate-900 text-center w-28">تاريخ البداية</TableHead>
                        <TableHead className="text-center font-bold text-slate-900">الحالة</TableHead>
                        <TableHead className="text-center font-bold text-slate-900">المدة</TableHead>
                        <TableHead className="text-right font-bold text-slate-900">الملاحظات</TableHead>
                        <TableHead className="text-center font-bold text-slate-900 no-print">المرفق</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredAttendance.map((item: any) => (
                        <TableRow key={item.id} className="hover:bg-slate-50">
                            <TableCell className="font-mono text-xs text-center border-l border-slate-100 font-bold">{item.start_date}</TableCell>
                            <TableCell className="text-center">
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 font-bold text-[10px]">
                                    {item.status_label}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-center font-black text-xs">{item.duration} يوم</TableCell>
                            <TableCell className="text-[11px] text-slate-500 leading-relaxed max-w-[250px]">{item.note || "-"}</TableCell>
                            <TableCell className="text-center no-print">
                                <div className="flex justify-center gap-1">
                                    {item.attachments?.map((file: string, fIdx: number) => (
                                        <Button key={fIdx} variant="ghost" size="icon" className="h-7 w-7 text-blue-600" onClick={() => handleOpenAnyFile(file)}>
                                            {file.includes("pdf") ? <FileText className="w-4 h-4 text-red-500" /> : <Paperclip className="w-4 h-4" />}
                                        </Button>
                                    ))}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    </AccordionContent>
</AccordionItem>
)}
{/* 🔴 كرت سجل المخالفات الانضباطية (المحدث للعرض الشامل) */}
{hasFullAccess && (
<AccordionItem value="item-disciplinary-new" className="border rounded-xl bg-white px-4 shadow-sm break-avoid">
    <AccordionTrigger className="hover:no-underline py-4 accordion-trigger-text">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg"><ShieldAlert className="w-5 h-5 text-red-600" /></div>
            <span className="font-bold text-slate-800 text-lg">سجل المخالفات والجزاءات</span>
            <Badge className="bg-red-600 text-white mr-2">{filteredViolations.length}</Badge>
        </div>
    </AccordionTrigger>
    <AccordionContent className="pb-4 pt-2 border-t text-right">
        {/* شريط البحث */}
        <div className="flex items-center gap-2 mb-4 no-print">
            <Button variant="outline" size="sm" 
                className={cn("h-8 gap-2 text-[10px] font-bold transition-all", showVioFilter ? "bg-red-50 text-red-600 border-red-200" : "bg-slate-50")}
                onClick={() => setShowVioFilter(!showVioFilter)}
            >
                <Eye className="w-3.5 h-3.5" /> {showVioFilter ? "إخفاء فلاتر التاريخ" : "بحث بالتاريخ"}
            </Button>
        </div>

        {showVioFilter && (
            <div className="animate-in zoom-in-95 fade-in duration-300">
                <DateFilterUI from={vioFrom} setFrom={setVioFrom} to={vioTo} setTo={setVioTo} />
            </div>
        )}

        <div className="overflow-x-auto border rounded-lg shadow-sm">
            <Table className="text-right border-collapse">
                <TableHeader className="bg-[#c5b391] bg-beige-print">
                    <TableRow className="divide-x divide-black/10">
                        <TableHead className="font-bold text-black text-center w-28">التاريخ</TableHead>
                        <TableHead className="font-bold text-black text-right">المخالفة</TableHead>
                        <TableHead className="font-bold text-black text-center w-24">الجزاء</TableHead>
                        <TableHead className="font-bold text-black text-center w-20">الخصم</TableHead>
                        <TableHead className="font-bold text-black text-center w-20 no-print">المرفق</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredViolations.map((vio: any) => (
                        <TableRow key={vio.id} className="hover:bg-red-50/30 transition-colors border-b">
                            <TableCell className="font-mono text-[10px] text-center text-red-700 border-l border-slate-100 font-bold">{vio.date}</TableCell>
                            <TableCell className="text-right py-3 max-w-[400px]">
                                <div className="font-bold text-slate-800 text-xs whitespace-normal break-words leading-relaxed">{vio.type}</div>
                                {vio.note && <p className="text-[10px] text-slate-500 mt-1 italic whitespace-normal">{vio.note}</p>}
                            </TableCell>
                            <TableCell className="text-center">
                                <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50 text-[10px] font-black">{vio.penalty}</Badge>
                            </TableCell>
                            <TableCell className="text-center font-black text-red-600 text-xs">-{vio.deduction}</TableCell>
                            <TableCell className="text-center no-print">
                                <div className="flex justify-center gap-1 flex-wrap">
                                    {vio.attachments?.map((file: string, fIdx: number) => (
                                        <Button key={fIdx} variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => handleOpenAnyFile(file)}>
                                            <Paperclip className="w-4 h-4" />
                                        </Button>
                                    ))}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    </AccordionContent>
</AccordionItem>
)}
                        {/* 6. كرت التقارير */}
{hasFullAccess && (
                        <AccordionItem value="item-6" className="border rounded-xl bg-white px-4 shadow-sm break-avoid">
    <AccordionTrigger className="hover:no-underline py-4 accordion-trigger-text">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
                <FileText className="w-5 h-5 text-slate-600" />
            </div>
            <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">التقارير</span>
                {filteredReports.length > 0 && (
                    <Badge className="bg-slate-200 text-slate-800 hover:bg-slate-300">
                        {filteredReports.length}
                    </Badge>
                )}
            </div>
        </div>
    </AccordionTrigger>
    
    <AccordionContent className="pb-4 pt-2 border-t">
        {/* 🟢 شريط التحكم العلوي لبطاقة التقارير */}
        <div className="flex items-center justify-between mb-4 no-print gap-2">
            {/* زر العين (مفتاح البحث بالتاريخ) الخاص بالتقارير */}
            <Button 
                variant="outline" 
                size="sm" 
                className={cn(
                    "h-8 gap-2 text-[10px] font-bold transition-all",
                    showReportFilter ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-slate-50 text-slate-500"
                )}
                onClick={() => setShowReportFilter(!showReportFilter)}
            >
                <Eye className="w-3.5 h-3.5" />
                {showReportFilter ? "إخفاء فلاتر التاريخ" : "بحث بالتاريخ"}
            </Button>

            {/* فلتر تصنيف التقارير (موجود سابقاً) */}
            <Select value={reportSubjectFilter} onValueChange={(val) => { setReportSubjectFilter(val); setReportsPage(1); }}>
                <SelectTrigger className="w-[180px] h-8 text-[10px] bg-slate-50 border-slate-200 font-bold">
                    <SelectValue placeholder="تصفية حسب المادة" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="fitness">فرع التدريب الرياضي</SelectItem>
                    <SelectItem value="military">فرع التدريب العسكري</SelectItem>
                </SelectContent>
            </Select>
        </div>

        {/* 🟢 مربع التاريخ يظهر فقط عند تفعيل زر العين (showReportFilter) */}
        {showReportFilter && (
            <div className="animate-in zoom-in-95 fade-in duration-300 mb-4">
                <DateFilterUI from={reportFrom} setFrom={setReportFrom} to={reportTo} setTo={setReportTo} />
            </div>
        )}

        {paginatedReports.length > 0 ? (
            <div className="space-y-4">
                <div className="space-y-3">
                    {paginatedReports.map((rep: any, idx: number) => {
                        const sub = getSubjectInfo(rep.branch || 'sports');
                        return (
                            <div key={idx} className="bg-slate-50 p-3 rounded-lg border flex flex-col md:flex-row justify-between items-start gap-2 hover:border-blue-200 transition-colors">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-slate-800 text-sm">{rep.title}</span>
                                        <Badge className={`${sub.color} border-0 text-[9px] h-5 flex items-center gap-1 font-bold`}>
                                            {sub.icon} {sub.label}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-slate-500 whitespace-pre-wrap leading-relaxed">{rep.details}</p>
                                    <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-slate-400">
                                        <User className="w-3 h-3"/> {rep.trainer}
                                    </div>
                                </div>
                                <Badge variant="outline" className="bg-white whitespace-nowrap text-[10px] font-mono">
                                    {rep.date}
                                </Badge>
                            </div>
                        )
                    })}
                </div>
                
                {/* شريط الترقيم للتقارير */}
                <div className="flex flex-col sm:flex-row items-center justify-between pt-2 gap-4 border-t mt-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>صفحة <b>{reportsPage}</b> من <b>{totalReportsPages}</b></span>
                        <div className="flex items-center gap-2 mr-4 border-r pr-4">
                            <span className="font-bold">عرض:</span>
                            <Select value={String(reportsPerPage)} onValueChange={(val) => { setReportsPerPage(Number(val)); setReportsPage(1); }}>
                                <SelectTrigger className="w-[60px] h-7 text-xs bg-white"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="5">5</SelectItem>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="20">20</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setReportsPage(prev => Math.max(prev - 1, 1))} disabled={reportsPage === 1} className="h-7 text-xs">
                            <ChevronRight className="w-3 h-3 ml-1" /> السابق
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setReportsPage(prev => Math.min(prev + 1, totalReportsPages))} disabled={reportsPage >= totalReportsPages} className="h-7 text-xs">
                            التالي <ChevronLeft className="w-3 h-3 mr-1" />
                        </Button>
                    </div>
                </div>
            </div>
        ) : (
            <div className="text-center py-10 text-slate-400 border-2 border-dashed rounded-lg bg-slate-50/50">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium italic">لا توجد تقارير مسجلة حالياً.</p>
            </div>
        )}
    </AccordionContent>
</AccordionItem>
)}

                    </Accordion>

                    <Dialog open={historyDialog.open} onOpenChange={(open) => setHistoryDialog(prev => ({ ...prev, open }))}>
                        <DialogContent>
                            <DialogHeader><DialogTitle>سجل التواريخ: {historyDialog.title}</DialogTitle></DialogHeader>
                            <div className="py-4 max-h-[300px] overflow-y-auto">
                                <ul className="space-y-2">
                                    {historyDialog.details.map((item, idx) => {
                                        const sub = getSubjectInfo(item.subject);
                                        return (
                                            <li key={idx} className="flex items-center justify-between border-b pb-2 last:border-0">
                                                <div className="flex items-center gap-2"><CalIcon className="w-4 h-4 text-slate-400"/><span className="font-mono text-sm">{item.date}</span></div>
                                                <Badge className={`${sub.color} border-0 text-[10px]`}>{sub.label}</Badge>
                                            </li>
                                        )
                                    })}
                                </ul>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            )}
        </div>
        </ProtectedRoute>
    )
}