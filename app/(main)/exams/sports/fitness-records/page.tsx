"use client"



import { useState, useEffect, useMemo } from "react"

import { 

    Table as TableIcon, Search, Printer, Download, 

    Eye, ShieldCheck, CheckCircle2, X, Loader2, RotateCcw, 

    ArrowRight, Calendar, Trash2, ChevronRight, ChevronLeft, 

    AlertTriangle, ListFilter, Save, Swords, Activity, UserCheck, FileWarning,Layers

} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { Button } from "@/components/ui/button"

import { Input } from "@/components/ui/input"

import { Label } from "@/components/ui/label"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { Badge } from "@/components/ui/badge"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

import { format } from "date-fns"

import { ar } from "date-fns/locale"

import { toast } from "sonner"

import ProtectedRoute from "@/components/ProtectedRoute"

import * as XLSX from 'xlsx';

import { useRouter, useSearchParams } from "next/navigation"



const absenceKeywords = ["غياب", "غائب", "إصابة", "لم يختبر", "شطب", "مؤجل", "اعتذار", "طبية", "مستشفى", "ملحق", "عيادة", "مرضية", "مفصول", "اصابة", "استقالة", "إستقالة"];



export default function FitnessRecordsPage() {

    const [activeTab, setActiveTab] = useState("engagement")

    const [selectedGroup, setSelectedGroup] = useState<any>(null)

    const [userRole, setUserRole] = useState<string>("")

    const [records, setRecords] = useState<any[]>([])

    const [loading, setLoading] = useState(false)

    const [searchQuery, setSearchQuery] = useState("")

    const [dateSearch, setDateSearch] = useState("")

    const [currentPage, setCurrentPage] = useState(1)

    const [itemsPerPage, setItemsPerPage] = useState(12)

    const [mainPage, setMainPage] = useState(1)

    const [mainItemsPerPage, setMainItemsPerPage] = useState(12)

    const [filterCourse, setFilterCourse] = useState("all")

    const [filterBatch, setFilterBatch] = useState("all")

    const [viewMode, setViewMode] = useState<"field" | "official">("field");

    const [allSoldiersInBatch, setAllSoldiersInBatch] = useState<any[]>([]);

    const [tempNotes, setTempNotes] = useState<Record<string, string>>({});

    const [innerCurrentPage, setInnerCurrentPage] = useState(1);

    const [innerItemsPerPage, setInnerItemsPerPage] = useState(50);

    const [showTrainerColumn, setShowTrainerColumn] = useState(true);

    const [innerCompany, setInnerCompany] = useState("all")

    const [innerPlatoon, setInnerPlatoon] = useState("all")

    const [customExamType, setCustomExamType] = useState("") 

    const [deleteTarget, setDeleteTarget] = useState<{id: number, title: string, all_ids: number[]} | null>(null);

    const [trainerScores, setTrainerScores] = useState<Record<string, number>>({});
    const [selectedEvaluator, setSelectedEvaluator] = useState("all"); // اسم المدرب/المقيم
const [evaluatorType, setEvaluatorType] = useState<"technical" | "scenario">("technical"); // نوع الاختبار

    const [printDestination, setPrintDestination] = useState<"sports" | "control">("sports");
    // 🟢 أضف هذا الجزء تحت تعريف userRole (تقريباً سطر 55)
const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("user") || "{}") : {};
const scope = user?.extra_permissions?.scope;
const isRestricted = user.role !== 'owner' && scope?.is_restricted;
    const router = useRouter()

const searchParams = useSearchParams() // 👈 إضافة هذا

const targetRecordId = searchParams.get('record_id') // 👈 استخراج المعرف

  const [activeGroup, setActiveGroup] = useState<{ course: string; batch: string } | null>(null);

   useEffect(() => {

    const user = JSON.parse(localStorage.getItem("user") || "{}")

    setUserRole(user.role || "")

    fetchRecords();

    const handleFocus = () => {

        console.log("تمت العودة للصفحة، جاري تحديث البيانات...");

        fetchRecords();

    };

    window.addEventListener('focus', handleFocus);

    return () => {

        window.removeEventListener('focus', handleFocus);

    };

}, []);



useEffect(() => {

    if (selectedGroup) {

        // إذا كان الاختبار "اشتباك" اجعل الوضع الافتراضي هو الكشف الرسمي

        if (selectedGroup.type === "engagement") {

            setViewMode("official");

        } else {

            // إذا كان "لياقة" اجعل الوضع الافتراضي هو الرصد

           setViewMode("field");

        }

    }

}, [selectedGroup]);



 const fetchRecords = async () => {
    setLoading(true);
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/records`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });

        if (res.ok) {
            const rawData = await res.json();
            const user = JSON.parse(localStorage.getItem("user") || "{}");
            const scope = user?.extra_permissions?.scope;

            // 🧼 المرحلة 1: التطهير والتوحيد (Normalization) 🧼
            let processed = rawData.map((r: any) => {
                const sData = typeof r.students_data === 'string' ? JSON.parse(r.students_data) : r.students_data;
                const apps = typeof r.approvals === 'string' ? JSON.parse(r.approvals) : r.approvals;
                
                const normalizedBatch = (r.batch === null || r.batch === "None" || r.batch === "null" || r.batch === "" || r.batch === "عام") 
                    ? "لا يوجد" 
                    : r.batch;

                return {
                    ...r,
                    batch: normalizedBatch,
                    students_data: sData,
                    approvals: apps
                };
            });

            // 🛡️ المرحلة 2: نظام فحص النطاق الذكي (الإصلاح الجوهري هنا)
            
            // 1. تحديد الرتب التي تملك صلاحية كاملة
            const isSuperUser = ["owner", "manager", "admin"].includes(user.role);

            // 2. لا يتم تطبيق الفلترة إلا إذا كان المستخدم (ليس قيادياً) وحسابه (مقيد)
            if (!isSuperUser && scope?.is_restricted === true) {
                const allowedCourses = scope.courses || [];
                const allowedPlatoons = scope.platoons || [];

                // إذا كان مدرباً مقيداً ولكن ليس لديه أي دورات أو فصائل مسندة، نمنع العرض
                if (allowedCourses.length === 0 && allowedPlatoons.length === 0) {
                    processed = [];
                } else {
                    processed = processed.filter((r: any) => {
                        const courseName = r.course;
                        const courseKeyWithBatch = `${courseName}||${r.batch}`;

                        // أ. فحص الوصول للدورة
                        const hasCourseAccess = allowedCourses.includes(courseName) || allowedCourses.includes(courseKeyWithBatch);

                        // ب. فحص الوصول للفصائل
                        const hasPlatoonAccess = allowedPlatoons.some((pKey: string) => {
                            return pKey.startsWith(`${courseName}->`) || pKey.startsWith(`${courseKeyWithBatch}->`);
                        });

                        return hasCourseAccess || hasPlatoonAccess;
                    });
                }
            }

            // للـ SuperUser، ستبقى مصفوفة processed كاملة كما جاءت من السيرفر
            setRecords(processed);
        }
    } catch (e) { 
        toast.error("فشل الاتصال بالسيرفر"); 
        console.error(e);
    } finally { 
        setLoading(false); 
    }
};



const uniqueCourses = useMemo(() => [...new Set(records.map(r => r.course))].filter(Boolean), [records]);

    const uniqueBatches = useMemo(() => [...new Set(records.map(r => r.batch))].filter(Boolean), [records]);

    const filteredGroupedRecords = useMemo(() => {

        const filtered = records.filter(r => {

            const titleLower = (r.title || "").toLowerCase();

            const subject = r.subject || "";

            // 1. استبعاد العسكري الصريح

            const militaryKeywords = ["رماية", "مسدس", "بندقية", "مشاة", "تلميذ", "أسلحة", "اسلحة", "رشاش", "m16", "mp5", "جلوك"];

            if (militaryKeywords.some(k => titleLower.includes(k))) return false;

          // 2. تصنيف السجل (لياقة أم اشتباك)

            const firstStudent = Array.isArray(r.students_data) && r.students_data.length > 0 ? r.students_data[0] : {};   

            // الاشتباك: نعرفه من الـ axes_fingerprint أو كلمة اشتباك في العنوان

            const isEngagement = titleLower.includes("اشتباك") || !!firstStudent.axes_fingerprint || subject.startsWith("engagement");            

            // اللياقة: نعرفها من أعمدة (جري، ضغط، بطن) أو كلمة لياقة/رياضة

            const isFitness = titleLower.includes("لياقة") || titleLower.includes("رياضة") || 

                              (firstStudent["الجري"] !== undefined || firstStudent["الضغط"] !== undefined);



            // 3. الفلترة حسب التاب

            let matchesTab = false;

            if (activeTab === "fitness") {

                // يظهر في اللياقة إذا كان لياقة، أو (ليس اشتباك وليس عسكري)

                matchesTab = isFitness || (!isEngagement);

            } else {

                // يظهر في الاشتباك فقط إذا كان اشتباك

                matchesTab = isEngagement;

            }



            // 4. بقية الفلاتر

            const matchesCourse = filterCourse === "all" || r.course === filterCourse;

            const matchesBatch = filterBatch === "all" || r.batch === filterBatch;

            const matchesSearch = !searchQuery || r.title.includes(searchQuery);

            const matchesDate = !dateSearch || r.exam_date === dateSearch;



            return matchesTab && matchesCourse && matchesBatch && matchesSearch && matchesDate;

        });



        // 🟢 التجميع وتوحيد العنوان

        const groups: Record<string, any> = {};

        filtered.forEach(r => {

            const sData = Array.isArray(r.students_data) ? r.students_data : [];

            const axesFingerprint = sData[0]?.axes_fingerprint || `legacy-${r.config_id}`;

            const groupKey = activeTab === "fitness" 

                ? `${r.exam_date}-${r.course}-${r.batch}-${r.title}`

                : `${r.exam_date}-${r.course}-${r.batch}-${axesFingerprint}`;



            if (!groups[groupKey]) {

                // 🎯 هنا الحل لمشكلة العنوان:

                // إذا كنا في تاب الاشتباك -> نصنع عنواناً موحداً ونظيفاً

                // إذا كنا في تاب اللياقة -> نترك العنوان كما هو (مثل: نهائي)

                const cleanTitle = activeTab === "engagement" 

                    ? `اختبار اشتباك - ${r.exam_date} - ${r.course} (${r.batch})` 

                    : r.title;



                groups[groupKey] = { 

                    key: groupKey, 

                    title: cleanTitle, // استخدام العنوان النظيف

                    exam_date: r.exam_date, course: r.course, batch: r.batch, 

                    sub_records: [r], status: r.status, type: activeTab 

                };

            } else {

                groups[groupKey].sub_records.push(r);

                if (r.status === 'approved') groups[groupKey].status = 'approved';

                

                // تحديث العنوان للتأكيد في حالة الدمج

                if (activeTab === "engagement") {

                    groups[groupKey].title = `اختبار اشتباك - ${r.exam_date} - ${r.course} (${r.batch})`;

                }

            }

        });



        return Object.values(groups).map((group: any) => {

            const uniqueSoldiers = new Set();

            group.sub_records.forEach((record: any) => {

                record.students_data.forEach((s: any) => {

                    const id = s.military_id || s["الرقم العسكري"];

                    if (id) uniqueSoldiers.add(id);

                });

            });

            return { ...group, student_count_ref: uniqueSoldiers.size };

        });

    }, [records, searchQuery, dateSearch, activeTab, filterCourse, filterBatch]);





const courseBatchGroups = useMemo(() => {
    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("user") || "{}") : {};
    const scope = user?.extra_permissions?.scope;
    
    // 🟢 1. تعريف القيادة العليا (الذين لا يخضعون لفحص النطاق)
    const isSuperUser = ["owner", "manager", "admin"].includes(user.role);

    // 🛡️ 2. حماية النطاق المحدثة: 
    // يتم المنع فقط إذا كان المستخدم (ليس قيادياً) و (حسابه مقيد) و (ليس لديه دورات مسندة)
    if (!isSuperUser && scope?.is_restricted && (!scope.courses || scope.courses.length === 0)) {
        return [];
    }

    const groups: Record<string, any> = {};
    
    // 🔍 ملاحظة: الباك إند أصبح الآن يرسل سجلات مفلترة للمدربين وكاملة للمدراء
    // لذلك سنقوم بمعالجة كل ما يصل من السيرفر (records)
    records.forEach(r => {
        const titleLower = (r.title || "").toLowerCase();
        const subject = r.subject || "";
        
        // منطق التصنيف (لياقة / اشتباك) - اترك كما هو
        const isEngagement = titleLower.includes("اشتباك") || subject.startsWith("engagement_");
        const militaryKeywords = ["اشتباك", "رماية", "مسدس", "بندقية", "مشاة", "تلميذ"];
        const isMilitary = militaryKeywords.some(k => titleLower.includes(k)) && !isEngagement;
        const isFitness = !isMilitary && !isEngagement;

        let matchesTab = false;
        if (activeTab === "fitness") matchesTab = isFitness;
        else matchesTab = isEngagement;

        if (!matchesTab) return;

        // تجميع حسب الدورة والدفعة
        const key = `${r.course}-${r.batch}`;
        if (!groups[key]) {
            groups[key] = {
                course: r.course,
                batch: r.batch,
                examsUniqueKeys: new Set(), 
            };
        }
        
        // توحيد مفتاح العد لمنع التكرار في البطاقة
        let uniqueKey;
        if (activeTab === "engagement") {
            uniqueKey = `${r.exam_date}-engagement-unified`;
        } else {
            uniqueKey = `${r.exam_date}-${r.title}`;
        }

        groups[key].examsUniqueKeys.add(uniqueKey);
    });

    // تحويل الكائن إلى مصفوفة وتطبيق فلاتر البحث العلوية
    return Object.values(groups).map(g => ({
        ...g,
        examCount: g.examsUniqueKeys.size,
    })).filter(g => {
        const matchCourse = filterCourse === "all" || g.course === filterCourse;
        const matchBatch = filterBatch === "all" || g.batch === filterBatch;
        return matchCourse && matchBatch;
    });

}, [records, activeTab, filterCourse, filterBatch]);

 

const groupedRecords = useMemo(() => {
    // 🛡️ حارس أمن النطاق
    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("user") || "{}") : {};
    const scope = user?.extra_permissions?.scope;
    
    // 🟢 1. تعريف القيادة العليا (الاستثناء الذهبي)
    const isSuperUser = ["owner", "manager", "admin"].includes(user.role);

    // 🛡️ 2. التعديل: لا يتم حظر الحساب إلا إذا كان (ليس قيادياً) و (مقيداً) و (نطاقه فارغ)
    if (!isSuperUser && scope?.is_restricted && (!scope.courses || scope.courses.length === 0)) {
        return [];
    }

    // 🚨 شرط الحماية الأصلي الخاص بك: إذا لم نكن داخل دورة، لا نحسب شيئاً
    if (!activeGroup) return [];

    const filtered = records.filter(r => {
        // 🟢 قيد إضافي: يجب أن يطابق الدورة والدفعة المختارة
        const isSameGroup = r.course === activeGroup.course && r.batch === activeGroup.batch;
        if (!isSameGroup) return false;

        const titleLower = r.title.toLowerCase();
        const subject = r.subject || "";
        const isEngagement = titleLower.includes("اشتباك") || subject.startsWith("engagement_");
        const militaryKeywords = ["اشتباك", "رماية", "مسدس", "بندقية", "مشاة", "تلميذ"];
        const isMilitary = militaryKeywords.some(k => titleLower.includes(k)) || subject.startsWith("engagement_");
        const isFitness = !isMilitary; 

        let matchesTab = false;
        if (activeTab === "fitness") matchesTab = isFitness;
        else matchesTab = isEngagement;

        return matchesTab && (!searchQuery || r.title.includes(searchQuery)) && (!dateSearch || r.exam_date === dateSearch);
    });

    // ... (باقي كود التجميع كما هو بدون تغيير) ...
    const groups: Record<string, any> = {};
    filtered.forEach(r => {
        const sData = Array.isArray(r.students_data) ? r.students_data : [];
        const axesFingerprint = sData[0]?.axes_fingerprint || `legacy-${r.config_id}`;
        const groupKey = activeTab === "fitness" 
            ? `${r.exam_date}-${r.course}-${r.batch}-${r.title}`
            : `${r.exam_date}-${r.course}-${r.batch}-${axesFingerprint}`;

        if (!groups[groupKey]) {
            const displayTitle = activeTab === "engagement" 
                ? `اختبار اشتباك - ${r.exam_date} - ${r.course} (${r.batch})` 
                : r.title;

            groups[groupKey] = { 
                key: groupKey, 
                title: displayTitle, 
                exam_date: r.exam_date, 
                course: r.course, 
                batch: r.batch, 
                sub_records: [r], 
                status: r.status, 
                type: activeTab 
            };
        } else {
            groups[groupKey].sub_records.push(r);
            if (r.status === 'approved') groups[groupKey].status = 'approved';
        }
    });

    return Object.values(groups).map((group: any) => {
        const uniqueSoldiers = new Set();
        group.sub_records.forEach((record: any) => {
            record.students_data.forEach((s: any) => {
                const id = s.military_id || s["الرقم العسكري"];
                if (id) uniqueSoldiers.add(id);
            });
        });
        return { ...group, student_count_ref: uniqueSoldiers.size };
    });
}, [records, searchQuery, dateSearch, activeTab, activeGroup]);



// 🟢 تعديل: اجعل الترقيم يأخذ من المجموعة المفلترة للدورة المختارة فقط

const paginatedCards = useMemo(() => {

    const start = (mainPage - 1) * mainItemsPerPage;

    // ابدل filteredGroupedRecords بـ groupedRecords

    return groupedRecords.slice(start, start + mainItemsPerPage);

}, [groupedRecords, mainPage, mainItemsPerPage]);



    const totalMainPages = Math.ceil(groupedRecords.length / mainItemsPerPage);



    useEffect(() => {



        if (selectedGroup && viewMode === "official") {



            const fetchBatch = async () => {



                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/?course=${selectedGroup.course}&batch=${selectedGroup.batch}&limit=2000`, {



                    headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }



                });



                if (res.ok) {



                    const data = await res.json();



                    setAllSoldiersInBatch(data.data);



                }



            };



            fetchBatch();



        }



    }, [selectedGroup, viewMode]);







 

// 🔔 موظف الاستقبال الذكي لصفحة الرياضة

// 🟢 تأكد أن هذا الـ useEffect موجود "بعد" تعريف groupedRecords في الملف

useEffect(() => {

    // 1. فحص الشروط الأساسية: وجود معرف السجل وتحميل البيانات

    if (!targetRecordId || records.length === 0) return;



    const recordIdNum = parseInt(targetRecordId);

    const foundRecord = records.find(r => r.id === recordIdNum);



    if (foundRecord) {

        console.log("🎯 معالجة إشعار رياضي للسجل رقم:", recordIdNum);



        // 2. تحديد التبويب (لياقة أم اشتباك)

        const titleLower = (foundRecord.title || "").toLowerCase();

        const isEngagement = titleLower.includes("اشتباك") || (foundRecord.subject && foundRecord.subject.includes("engagement"));

        

        // تحديث الحالة لمرة واحدة

        setActiveTab(isEngagement ? "engagement" : "fitness");

        setActiveGroup({ course: foundRecord.course, batch: foundRecord.batch });



        // 3. 🛡️ الحل الذكي للعثور على المجموعة المدمجة دون التسبب في انهيار

        // بدلاً من مراقبة groupedRecords، سنبحث فيها مباشرة إذا كانت موجودة

        // أو نقوم بتجميع السجلات المرتبطة يدوياً فوراً

        const relatedSubRecords = records.filter(r => 

            r.exam_date === foundRecord.exam_date && 

            r.course === foundRecord.course && 

            r.batch === foundRecord.batch &&

            (isEngagement ? (r.title.includes("اشتباك") || (r.subject && r.subject.includes("engagement"))) : !r.title.includes("اشتباك"))

        );



        if (relatedSubRecords.length > 0) {

            setSelectedGroup({

                key: `${foundRecord.exam_date}-${foundRecord.course}-${foundRecord.batch}`,

                title: isEngagement ? `اختبار اشتباك - ${foundRecord.exam_date}` : foundRecord.title,

                exam_date: foundRecord.exam_date,

                course: foundRecord.course,

                batch: foundRecord.batch,

                sub_records: relatedSubRecords,

                type: isEngagement ? "engagement" : "fitness",

                status: relatedSubRecords.some(r => r.status === 'approved') ? 'approved' : 'pending'

            });

        }



        // 4. تنظيف الرابط لمنع تكرار العملية

        const newUrl = window.location.pathname;

        window.history.replaceState({}, '', newUrl);

        

        toast.success(`تم التوجه إلى: ${foundRecord.title}`);

    }

}, [records.length, targetRecordId]); // 🔄 تم إزالة groupedRecords من هنا لكسر حلقة الانهيار (Infinite Loop)



   const processedGroupData = useMemo(() => {



        // إذا لم يتم اختيار مجموعة، نرجع فارغ



        if (!selectedGroup) return { students: [], meta: { maxTechEvaluators: 0, maxScenEvaluators: 0 }, validation: [] };



        



        const allStudentsMap: Record<string, any> = {};



        let maxTechEvaluators = 0; 



        let maxScenEvaluators = 0;







        selectedGroup.sub_records.forEach((record: any) => {



            // تحديد نوع السجل (فني أم سيناريو)



            let type = record.title.includes("سيناريو") ? "scenario" : "technical";



            



            // التأكد من أن students_data مصفوفة لتجنب الأخطاء



            const dataList = Array.isArray(record.students_data) ? record.students_data : [];







            dataList.forEach((s: any) => {

    // يبحث في المفتاحين (الإنجليزي والعربي) لضمان إيجاد الرقم العسكري

    const id = s.military_id || s["الرقم العسكري"]; 

    

    if (id && !allStudentsMap[id]) {

        allStudentsMap[id] = { 

            ...s, 

            technical_scores: [], 



                        scenario_scores: [], 



                        recorders: new Set() 



                    };



                }



                



                const scoreVal = s.total !== null ? parseFloat(s.total) : null;



                const recorderName = record.creator_name || "النظام";



                



                // 🟢 التعديل الجوهري والوحيد هنا:



                // سحب تفاصيل الاختبار (snapshot) وحفظها مع الدرجة



                const snapshotData = s.exam_snapshot || s.snapshot || null;







                allStudentsMap[id].recorders.add(recorderName);



                



                if (scoreVal !== null) {



                    // الكائن الذي يحمل الدرجة + التفاصيل



                    const scoreEntry = { 



                        val: scoreVal, 



                        by: recorderName,



                        snapshot: snapshotData // ✅ تم إرفاق التفاصيل هنا لكي يراها الإكسل



                    };







                    if (type === "technical") allStudentsMap[id].technical_scores.push(scoreEntry);



                    if (type === "scenario") allStudentsMap[id].scenario_scores.push(scoreEntry);



                }



            });



        });







        // حساب الحد الأقصى للمقيمين (لتنسيق الجدول)



        Object.values(allStudentsMap).forEach((s: any) => {



            if (s.technical_scores.length > maxTechEvaluators) maxTechEvaluators = s.technical_scores.length;



            if (s.scenario_scores.length > maxScenEvaluators) maxScenEvaluators = s.scenario_scores.length;



        });







        // حساب المتوسطات النهائية



        const finalStudents = Object.values(allStudentsMap).map((s: any) => {



            const techCount = s.technical_scores.length;



            const scenCount = s.scenario_scores.length;



            



            const avgTech = techCount > 0 ? s.technical_scores.reduce((a:any, b:any) => a + b.val, 0) / techCount : 0;



            const avgScen = scenCount > 0 ? s.scenario_scores.reduce((a:any, b:any) => a + b.val, 0) / scenCount : 0;



            



            return {



                ...s, 



                tech_avg: avgTech, 



                scen_avg: avgScen,



                total_final: (techCount === 0 && scenCount === 0) ? null : Math.round((avgTech + avgScen) / 2),



                issue_flag: (techCount < maxTechEvaluators || scenCount < maxScenEvaluators) ? "alert" : "ok"



            };



        });







        return { students: finalStudents, meta: { maxTechEvaluators, maxScenEvaluators }, validation: [] };



    }, [selectedGroup]);







  const finalReportData = useMemo(() => {
    if (!selectedGroup) return [];

    // --- 1. منطق اختبار اللياقة البدنية (يبقى كما هو بدون تغيير) ---
    if (selectedGroup.type === "fitness") {
        const rawData = selectedGroup.sub_records[0]?.students_data || [];
        const dataArray = Array.isArray(rawData) ? rawData : [];
        return dataArray.filter((s) => {
            const sCo = s["السرية"] || s.company || "";
            const sPl = s["الفصيل"] || s.platoon || "";
            const matchCo = innerCompany === "all" || sCo === innerCompany;
            const matchPl = innerPlatoon === "all" || sPl === innerPlatoon;
            return matchCo && matchPl;
        });
    }

    // --- 2. منطق اختبار الاشتباك (التعديل الجوهري هنا) ---
    let baseData = processedGroupData.students;

    if (selectedEvaluator !== "all") {
        baseData = baseData.filter((s: any) => {
            const scores = evaluatorType === "technical" ? s.technical_scores : s.scenario_scores;
            return (scores || []).some((score: any) => score.by === selectedEvaluator);
        }).map((s: any) => {
            // 🎯 التعديل الجوهري: البحث عن الدرجة واللقطة (Snapshot) للنوع المختار فقط
            const scoreSource = evaluatorType === "technical" ? s.technical_scores : s.scenario_scores;
            const matchingScore = (scoreSource || []).find((sc: any) => sc.by === selectedEvaluator);
            
            return {
                ...s,
                total_final: matchingScore?.val || 0,
                // نأخذ الـ snapshot الخاص بهذه الدرجة تحديداً
                display_snapshot: matchingScore?.snapshot || null,
                is_specific_evaluator: true 
            };
        });
    }

    // 🔵 ب: معالجة وضع العرض (رصد ميداني أم كشف رسمي)
    let processedResult = [];
    if (viewMode === "field") {
        processedResult = baseData;
    } else {
        // وضع الكشف الرسمي: دمج الناجحين مع الغائبين من الدفعة بالكامل
        const fieldDataMap = new Map(baseData.map(s => [String(s.military_id), s]));
        const targetGroups = new Set(baseData.map((s) => `${s.company}-${s.platoon}`));

        processedResult = allSoldiersInBatch
            .filter((soldier) => {
                const soldierGroupKey = `${soldier.company}-${soldier.platoon}`;
                return targetGroups.has(soldierGroupKey);
            })
            .map((soldier) => {
                const match = fieldDataMap.get(String(soldier.military_id));
                if (match) return match;
                return { 
                    ...soldier, 
                    total_final: null, 
                    is_absent: true, 
                    notes: tempNotes[soldier.military_id] || "" 
                };
            });
    }

    // 🟡 ج: الفلترة النهائية حسب السرية والفصيل المختارين من الواجهة
    return processedResult.filter((s) => {
        const sCo = s.company || s["السرية"] || "";
        const sPl = s.platoon || s["الفصيل"] || "";
        const matchCo = innerCompany === "all" || sCo === innerCompany;
        const matchPl = innerPlatoon === "all" || sPl === innerPlatoon;
        return matchCo && matchPl;
    });

}, [
    selectedGroup, 
    viewMode, 
    allSoldiersInBatch, 
    innerCompany, 
    innerPlatoon, 
    tempNotes, 
    processedGroupData.students,
    selectedEvaluator, // التبعية الجديدة
    evaluatorType      // التبعية الجديدة
]);







    // 🟢 التحقق من وجود بيانات في عمود درجة المدرب (لإخفائه إذا كان فارغاً)



    const hasTrainerScore = useMemo(() => {



        if (!finalReportData.length) return false;



        // إذا وجدنا ولو طالب واحد لديه درجة مدرب، نعرض العمود



        return finalReportData.some(s => {



            const val = s["درجة المدرب"] || s.trainer_score;



            return val && val !== "0" && val !== 0 && val !== "-" && val !== "";



        });



    }, [finalReportData]);







    const paginatedStudents = useMemo(() => {



        const start = (innerCurrentPage - 1) * innerItemsPerPage;



        return finalReportData.slice(start, start + innerItemsPerPage);



    }, [finalReportData, innerCurrentPage, innerItemsPerPage]);







    const getGradeInfo = (total: any, notes: string = "") => {



        const isActuallyAbsent = absenceKeywords.some(k => notes?.includes(k)) || total === null;



        if (isActuallyAbsent) return { result: "-", category: "-" };



        const s = parseFloat(total);



        if (s >= 90) return { result: "ممتاز", category: "أ" };



        if (s >= 80) return { result: "جيد جداً", category: "ب" };



        if (s >= 70) return { result: "جيد", category: "ج" };



        if (s >= 60) return { result: "مقبول", category: "د" };



        return { result: "راسب", category: "-" };



    };







    const renderNoteCell = (student: any) => {



    const isAbsent = student.total_final === null;



    // 🟢 قراءة الملاحظة المحفوظة مسبقاً بدقة



    const savedNote = student.notes || student["ملاحظات"] || student["الملاحظات"] || ""; 



    const currentTempNote = tempNotes[student.military_id];







    if (viewMode === "official" && isAbsent) {



        return (



            <div className="no-print">



                <Input 



                    className="h-7 text-[10px] border-orange-200 bg-orange-50/50 font-bold" 



                    placeholder="اكتب ملاحظة ..."



                    value={currentTempNote !== undefined ? currentTempNote : savedNote}



                    onChange={(e) => setTempNotes({...tempNotes, [student.military_id]: e.target.value})}



                />



            </div>



        );



    }



    // إذا لم يكن في وضع التعديل، يعيد نص الملاحظة (سيتم استخدامه في الخلية أعلاه)



    return savedNote ? <span className="text-[10px] text-slate-500">{savedNote}</span> : null;



};



   const saveAbsenteeNotes = async () => {



    const currentUser = JSON.parse(localStorage.getItem("user") || "{}");



    const firstSubRecord = selectedGroup.sub_records[0];



    const updatedStudentsList = [...firstSubRecord.students_data];



    Object.entries(tempNotes).forEach(([milId, note]) => {



        const soldier = allSoldiersInBatch.find(sol => String(sol.military_id) === String(milId));



        if (soldier) {



            updatedStudentsList.push({ ...soldier, total: null, notes: note, recorded_by: currentUser.name, axes_fingerprint: firstSubRecord.students_data[0]?.axes_fingerprint, exam_snapshot: firstSubRecord.students_data[0]?.exam_snapshot });



        }



    });



    try {



        setLoading(true);



        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/records/${firstSubRecord.id}`, { method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` }, body: JSON.stringify({ students_data: JSON.stringify(updatedStudentsList) }) });



        if (res.ok) {



            toast.success("تم الحفظ");



            setSelectedGroup((prev: any) => { if (!prev) return prev; const newSubRecords = [...prev.sub_records]; newSubRecords[0] = { ...newSubRecords[0], students_data: updatedStudentsList }; return { ...prev, sub_records: newSubRecords }; });



            setTempNotes({}); await fetchRecords();



        }



    } catch (e) { toast.error("فشل الحفظ"); } finally { setLoading(false); }



};







const handleFetchTrainerScores = async () => {



    if (!selectedGroup) return;



    const currentSubject = activeTab === "engagement" ? "اشتباك" : "لياقة بدنية";



    setLoading(true);



    try {



        const params = new URLSearchParams({ course: selectedGroup.course, subject: currentSubject, batch: selectedGroup.batch });



        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/get-trainer-scores?${params.toString()}`, { headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` } });



        if (res.ok) {



            const scoresMap = await res.json();



            setTrainerScores(scoresMap);



            toast.success("تم جلب الدرجات");



        }



    } catch (e) { toast.error("فشل الجلب"); } finally { setLoading(false); }



};







  const handleApprove = async (recordIds: number[], level: string) => {



    try {



        setLoading(true);



        const currentUser = JSON.parse(localStorage.getItem("user") || "{}");







        // 1. إرسال طلب الاعتماد للسيرفر



        const promises = recordIds.map(id => 



            fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/records/${id}/approve?level=${level}`, {



                method: "PATCH",



                headers: {



                    "Authorization": `Bearer ${localStorage.getItem("token")}`



                }



            })



        );







        const results = await Promise.all(promises);



        



        if (results.every(res => res.ok)) {



            toast.success("تم الاعتماد وحفظ التوقيع بنجاح ✅");







            // 🚀 2. التحديث اللحظي للشاشة (Real-time UI Update)



            // نقوم بتحديث بيانات التوقيع داخل الكائن المفتوح حالياً لكي تظهر الصورة فوراً



            const newApprovalData = {



                approved: true,



                name: currentUser.name,



                rank: currentUser.rank,



                mil_id: currentUser.military_id,



                at: new Date().toISOString()



            };







            setSelectedGroup((prev: any) => {



                if (!prev) return prev;



                return {



                    ...prev,



                    sub_records: prev.sub_records.map((r: any) => ({



                        ...r,



                        approvals: {



                            ...r.approvals,



                            [level]: newApprovalData



                        }



                    }))



                };



            });







            // 3. تحديث قائمة السجلات في الخلفية لضمان مزامنة الأرشيف



            fetchRecords(); 







        } else {



            const errorData = await results[0].json();



            toast.error(errorData.detail || "فشل في حفظ الاعتماد");



        }



    } catch (e) {



        toast.error("خطأ في الاتصال بالسيرفر");



    } finally {



        setLoading(false);



    }



};







   const handleResetApproval = async (recordIds: number[], level: string) => {



    // 1. فحص تسلسل الإلغاء (حماية منطقية)



    const currentApprovals = selectedGroup.sub_records[0]?.approvals || {};



    if (level === "officer" && currentApprovals.head?.approved) return toast.error("يجب إلغاء اعتماد رئيس القسم أولاً");



    if (level === "supervisor" && currentApprovals.officer?.approved) return toast.error("يجب إلغاء اعتماد الضابط أولاً");







    try {



        setLoading(true);







        // 2. إرسال طلب الحذف للسيرفر



        const promises = recordIds.map(id => 



            fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/records/${id}/approve?level=${level}`, {



                method: "PATCH",



                headers: {



                    "Authorization": `Bearer ${localStorage.getItem("token")}`



                }



            })



        );







        const results = await Promise.all(promises);



        



        if (results.every(res => res.ok)) {



            toast.info("تم إلغاء الاعتماد بنجاح ✅");







            // 🚀 3. التحديث اللحظي للشاشة (Real-time UI Clear)



            // نقوم بتصفير بيانات التوقيع في الذاكرة الحالية فوراً



            setSelectedGroup((prev: any) => {



                if (!prev) return prev;



                return {



                    ...prev,



                    sub_records: prev.sub_records.map((r: any) => ({



                        ...r,



                        approvals: {



                            ...r.approvals,



                            [level]: { approved: false, name: null, rank: null, mil_id: null, at: null }



                        }



                    }))



                };



            });







            // 4. تحديث الأرشيف في الخلفية



            fetchRecords(); 



            



        } else {



            const errorData = await results[0].json();



            toast.error(errorData.detail || "فشل في إلغاء الاعتماد");



        }



    } catch (e) {



        toast.error("خطأ في الاتصال بالخادم");



    } finally {



        setLoading(false);



    }



};







    const confirmDelete = async () => {



    if (!deleteTarget) return;



    try {



        const deletePromises = deleteTarget.all_ids.map(async (id) => {



            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/records/${id}`, {



                method: "DELETE",



                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }



            });



            



            if (!res.ok) {



                const errorData = await res.json().catch(() => ({}));



                throw new Error(errorData.detail || "فشل الحذف");



            }



            return res;



        });







        await Promise.all(deletePromises);



        toast.success("تم الحذف بنجاح");



        setDeleteTarget(null);



        fetchRecords();



    } catch (e: any) {



        // 🛡️ هنا ستظهر الرسالة التي وضعناها في الباك إند (لا يمكن حذف سجل معتمد...)



        toast.error(e.message || "حدث خطأ أثناء الحذف");



    }



};







 const exportToExcel = async () => {



    if (!finalReportData.length) return;



    try {



        const wb = XLSX.utils.book_new();







        // 1. تجهيز بيانات الشيت الرئيسي (كشف النتائج)



        const summaryData = finalReportData.map((s: any, i: number) => {



            // أ. البيانات الأساسية المشتركة



            const row: any = { 



                "م": i + 1, 



                "الرتبة": s.rank || s["الرتبة"] || "-", 



                "الرقم العسكري": s.military_id || s["الرقم العسكري"], 



                "الاسم": s.name || s["الإسم"], 



                "السرية": s.company || s["السرية"], 



                "الفصيل": s.platoon || s["الفصيل"] 



            };







            // ب. تخصيص الأعمدة حسب نوع الاختبار



            if (selectedGroup.type === "fitness") {



                // --- أعمدة اللياقة البدنية ---



                row["الجري"] = s["الجري"] || s.run_time || "-";



                row["درجة الجري"] = s["درجة الجري"] || s.run_score || "-";



                row["تقدير الجري"] = s["تقدير الجري"] || s.run_grade || "-";







                row["الضغط"] = s["الضغط"] || s.pushups || s.push_count || "-";



                row["درجة الضغط"] = s["درجة الضغط"] || s.push_score || "-";



                row["تقدير الضغط"] = s["تقدير الضغط"] || s.push_grade || "-";







                row["البطن"] = s["البطن"] || s.situps || s.sit_count || "-";



                row["درجة البطن"] = s["درجة البطن"] || s.sit_score || "-";



                row["تقدير البطن"] = s["تقدير البطن"] || s.sit_grade || "-";







                row["الدرجة النهائية"] = s["الدرجة النهائية"] || s.average || "-";



                row["التقدير العام"] = s["التقدير العام"] || s.grade || "-";



                row["النتيجة"] = s["النتيجة"] || s.final_result || "-";







                // 🟢 إضافة درجة المدرب (إذا وجدت)



                if (hasTrainerScore || s.trainer_score) {



                    row["درجة المدرب"] = s["درجة المدرب"] || s.trainer_score || "-";



                }







                







            } else {



                // --- أعمدة الاشتباك ---



                row["المعدل الفني"] = s.tech_avg ? s.tech_avg.toFixed(2) : "-";



                row["المعدل السيناريو"] = s.scen_avg ? s.scen_avg.toFixed(2) : "-";



                row["المعدل العام (90%)"] = s.total_final || "-";



                



                // درجة المدرب في الاشتباك (من الكشف الرسمي)



                if (viewMode === "official") {



                    row["درجة المدرب (10%)"] = trainerScores[s.military_id] || "-";



                }



                



                row["التقدير"] = getGradeInfo(s.total_final, s.notes).result;



            }







            // ج. الملاحظات (مشتركة)



            row["ملاحظات"] = s.notes || s["ملاحظات"] || "";



            



            return row;



        });







        // إضافة الشيت الرئيسي



        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "كشف النتائج");







        // 2. الشيتات التفصيلية (للاشتباك فقط)



        if (selectedGroup.type === "engagement") {



const buildDetailSheet = (scoreKey: 'technical_scores' | 'scenario_scores') => {



    const rows: any[] = [];



    finalReportData.forEach((s: any, i: number) => {



        const evaluatorScores = s[scoreKey] || [];



        



        evaluatorScores.forEach((evaluator: any, idx: number) => {



            const detailRow: any = {



                "م": i + 1,



                "الرقم العسكري": s.military_id,



                "الاسم": s.name,



                // 🟢 التعديل الجوهري هنا:



                // يبحث عن الاسم في 'by' (الذي حقناه يدوياً) 



                // أو في 'creator_name' (الذي يأتي من السجل الأصلي)



                "المقيم": evaluator.by || s.creator_name || `مقيم ${idx + 1}`



            };







            // معالجة الـ Snapshot (المعايير)



            let snap = evaluator.exam_snapshot || evaluator.snapshot || s.exam_snapshot;



            



            // تحويل النص إلى Object إذا كان القادم من الباك إند نصاً



            if (typeof snap === 'string') { 



                try { snap = JSON.parse(snap); } catch { snap = null; } 



            }







            let configsList = [];



            if (Array.isArray(snap)) configsList = snap;



            else if (snap && typeof snap === 'object') configsList = [snap];







            // استخراج الدرجات التفصيلية لكل معيار



            configsList.forEach((config: any) => {



                if (config.axes && Array.isArray(config.axes)) {



                    config.axes.forEach((axis: any) => {



                        if (axis.criteria && Array.isArray(axis.criteria)) {



                            axis.criteria.forEach((crit: any) => {



                                // دمج اسم المحور مع اسم المعيار ليكون عنوان العمود واضحاً



                                const colName = `${axis.title || axis.name} - ${crit.name}`;



                                const val = crit.score;



                                if (val !== undefined && val !== null) {



                                    detailRow[colName] = val;



                                }



                            });



                        }



                    });



                }



            });







            detailRow["إجمالي الدرجة"] = evaluator.val;



            rows.push(detailRow);



        });



    });



    return rows;



};







            const techRows = buildDetailSheet('technical_scores');



            if (techRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(techRows), "تفاصيل الفني");







            const scenRows = buildDetailSheet('scenario_scores');



            if (scenRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(scenRows), "تفاصيل السيناريو");



        }







        // 🟢 3. تسمية الملف (الاسم العربي الكامل)



        // التنسيق: اسم الاختبار - اسم الدورة - اسم الدفعة - التاريخ



        const safeTitle = selectedGroup.title ? selectedGroup.title.replace(/[\\/:*?"<>|]/g, "-") : "اختبار";



        const safeCourse = selectedGroup.course ? selectedGroup.course.replace(/[\\/:*?"<>|]/g, "-") : "دورة";



        const safeBatch = selectedGroup.batch ? selectedGroup.batch.replace(/[\\/:*?"<>|]/g, "-") : "دفعة";



        const safeDate = selectedGroup.exam_date || new Date().toISOString().split('T')[0];







        const fileName = `${safeTitle}_${safeCourse}_${safeBatch}_${safeDate}.xlsx`;



        



        XLSX.writeFile(wb, fileName);



        toast.success("تم التصدير بنجاح");



    } catch (error) {



        console.error("Export Error:", error);



        toast.error("خطأ في التصدير");



    }



};







    const signatureConfig = [



        { label: selectedGroup?.type === "fitness" ? "مشرف اللياقة" : "مشرف الاشتباك", key: "supervisor", role: "sports_trainer" },



        { label: "ضابط التدريب الرياضي", key: "officer", role: "sports_officer" },



        { label: "رئيس قسم التدريب العسكري والرياضي", key: "head", role: "manager" }



    ];



// فحص هل يوجد أي بيانات في أعمدة السرية أو الفصيل

const hasCompanyData = finalReportData.some(s => (s.company || s["السرية"])?.trim());

const hasPlatoonData = finalReportData.some(s => (s.platoon || s["الفصيل"])?.trim());



    return (



        <ProtectedRoute allowedRoles={["owner","manager","admin","assistant_admin","sports_officer","sports_supervisor","sports_trainer"]}>



            <div className="space-y-6" dir="rtl">



                {/* 🟢 الستايل الديناميكي للطباعة */}



               <style jsx global>{`
    @media print {
        @page { 
            /* 🟢 التعديل: تصبح الورقة landscape في حالتين: 
               1- اختبار اللياقة. 
               2- اختبار الاشتباك عند اختيار مقيم محدد (لوجود أعمدة تفصيلية). */
            size: A4 ${
                selectedGroup?.type === 'fitness' || (selectedGroup?.type === 'engagement' && selectedEvaluator !== 'all')
                ? 'landscape' 
                : 'portrait'
            }; 
            margin: 5mm; 
        }

        body { 
            /* 💡 تصغير الزووم قليلاً عند طباعة المقيم لضمان احتواء كل الأعمدة */
            zoom: ${selectedEvaluator !== "all" ? '0.75' : '0.85'}; 
            -webkit-print-color-adjust: exact; 
        }

        .no-print { display: none !important; }
        .archive-view { display: none !important; } 
        .force-print { display: table-row !important; }

        table { 
            width: 100% !important; 
            border-collapse: collapse !important; 
            table-layout: auto !important; /* السماح للمتصفح بضبط عرض الأعمدة حسب النص */
        }

        th { 
            background-color: #c5b391 !important; 
            color: black !important; 
            border: 1px solid black !important; 
            /* 🟢 حماية النصوص الطويلة في العناوين */
            word-wrap: break-word;
            white-space: normal !important; 
            line-height: 1.1 !important;
            padding: 2px !important;
        }

        td { 
            border: 1px solid black !important; 
            padding: 4px !important; 
            font-size: 10px !important; 
        }
    }
`}</style>






                {selectedGroup ? (



                    <div className="min-h-screen bg-white p-2 md:p-8 flex flex-col space-y-6 pb-10 md:pb-32 relative animate-in fade-in duration-300">



                        {/* شريط التحكم */}



                        <div className="flex flex-col gap-4 no-print bg-slate-50 p-3 md:p-4 rounded-xl shadow-sm border">



                            <div className="flex items-center justify-between gap-3">



                               <Button 



  variant="ghost" 



  onClick={() => {



    setSelectedGroup(null); // إغلاق البطاقة



    setViewMode("field"); 



    setTempNotes({}); 



    setInnerCurrentPage(1);



    fetchRecords(); // 👈 أضف هذا السطر هنا ليتم تحديث الأرشيف فوراً عند العودة



  }} 



  className="font-bold text-slate-600 h-9"



>



    <ArrowRight className="w-5 h-5 ml-2" /> العودة



</Button>



                                <div className="flex bg-white rounded-lg border p-1 shadow-inner">



                    <Button 



                        variant={viewMode === "field" ? "default" : "ghost"} 



                        size="sm" 



                        onClick={()=>setViewMode("field")} 



                        className="text-[10px] h-7 font-bold"



                    >



                        الرصد



                    </Button>



                    



                    {selectedGroup.type === "engagement" && (



                        <Button 



                            variant={viewMode === "official" ? "default" : "ghost"} 



                            size="sm" 



                            onClick={()=>setViewMode("official")} 



                            className="text-[10px] h-7 font-bold gap-1"



                        >



                            <ListFilter className="w-3 h-3"/> الكشف الرسمي



                        </Button>



                    )}



                </div>



                            </div>



                            <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2" >



                                <div className="flex items-center gap-2 bg-white px-2 rounded-lg border h-10 shadow-sm">



                                    <Label className="text-[10px] font-bold whitespace-nowrap">السرية:</Label>



                                    <Select value={innerCompany} onValueChange={(v)=>{setInnerCompany(v); setInnerCurrentPage(1);}}>
    <SelectTrigger className="w-full md:w-24 h-7 border-none text-xs font-bold"><SelectValue /></SelectTrigger>
    <SelectContent>
        {/* 🟢 إذا كان مقيداً ولديه سرية واحدة فقط، لا نظهر خيار "الكل" */}
        {(!isRestricted || Array.from(new Set(processedGroupData.students.map((s:any)=>s.company || s["السرية"]))).length > 1) && (
            <SelectItem value="all">الكل</SelectItem>
        )}
        
        {processedGroupData?.students?.length > 0 && Array.from(new Set(processedGroupData.students.map((s:any)=>s.company || s["السرية"])))
            .filter(Boolean)
            .sort((a: any, b: any) => a.localeCompare(b, 'ar', { numeric: true }))
            .map(c => <SelectItem key={c as string} value={c as string}>{c as string}</SelectItem>)}
    </SelectContent>
</Select>



                                </div>



                                <div className="flex items-center gap-2 bg-white px-2 rounded-lg border h-10 shadow-sm">



                                    <Label className="text-[10px] font-bold whitespace-nowrap">الفصيل:</Label>



                                   <Select value={innerPlatoon} onValueChange={(v)=>{setInnerPlatoon(v); setInnerCurrentPage(1);}}>
    <SelectTrigger className="w-full md:w-24 h-7 border-none text-xs font-bold"><SelectValue /></SelectTrigger>
    <SelectContent>
        {(!isRestricted || Array.from(new Set(processedGroupData?.students?.map((s:any)=>s.platoon || s["الفصيل"]))).length > 1) && (
            <SelectItem value="all">الكل</SelectItem>
        )}
        
        {Array.from(new Set(processedGroupData?.students?.map((s:any)=>s.platoon || s["الفصيل"])))
            .filter(Boolean)
            .sort((a: any, b: any) => a.localeCompare(b, 'ar', { numeric: true }))
            .map(p => <SelectItem key={p as string} value={p as string}>{p as string}</SelectItem>)}
    </SelectContent>
</Select>



                                </div>



                               {/* 🟢 حاوية التحكم والأزرار المطورة: متوافقة تماماً مع الهاتف والحاسوب */}



<div className="flex flex-col md:flex-row items-center justify-between gap-3 w-full no-print bg-slate-50 p-3 rounded-xl border shadow-sm">



    
{/* 🟢 فرز المقيمين (يظهر فقط في الاشتباك) */}
{selectedGroup.type === "engagement" && (
    <div className="flex flex-wrap gap-2 items-center bg-blue-50/50 p-2 rounded-lg border border-blue-100">
        <Label className="text-[10px] font-bold text-blue-800">طباعة كشف مقيم:</Label>
        
        {/* اختيار اسم المقيم */}
        <Select value={selectedEvaluator} onValueChange={setSelectedEvaluator}>
            <SelectTrigger className="w-40 h-8 text-[10px] font-bold bg-white">
                <SelectValue placeholder="اختر المقيم" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">الكشف العام (الكل)</SelectItem>
                {/* استخراج أسماء المقيمين من البيانات المعالجة */}
                {Array.from(new Set(processedGroupData.students.flatMap((s:any) => Array.from(s.recorders || []))))
                    .map(name => <SelectItem key={name as string} value={name as string}>{name as string}</SelectItem>)
                }
            </SelectContent>
        </Select>

        {/* اختيار نوع الاختبار (فني/سيناريو) - يظهر فقط إذا تم اختيار مقيم معين */}
        {selectedEvaluator !== "all" && (
            <Select value={evaluatorType} onValueChange={(v:any) => setEvaluatorType(v)}>
                <SelectTrigger className="w-32 h-8 text-[10px] font-bold bg-white border-blue-300 text-blue-700">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="technical">الجزء الفني</SelectItem>
                    <SelectItem value="scenario">جزء السيناريو</SelectItem>
                </SelectContent>
            </Select>
        )}
    </div>
)}


    {/* 1. جهة الطباعة (تظهر فقط في الاشتباك) */}



    {selectedGroup.type === "engagement" ? (



        <div className="flex bg-white rounded-lg border h-10 px-2 items-center gap-2 shadow-sm w-full md:w-auto">



            <Label className="text-[9px] font-bold text-slate-500 whitespace-nowrap">جهة الطباعة:</Label>



            <Select value={printDestination} onValueChange={(v:any)=>setPrintDestination(v)}>



                <SelectTrigger className="w-full md:w-32 border-none text-[10px] font-bold focus:ring-0 h-7">



                    <SelectValue />



                </SelectTrigger>



                <SelectContent>



                    <SelectItem value="sports">المكتب الرياضي</SelectItem>



                    <SelectItem value="control">مكتب الكنترول</SelectItem>



                </SelectContent>



            </Select>



        </div>



    ) : (



        <div className="hidden md:block w-1"></div> // مساحة فارغة للتوازن



    )}







    {/* 2. مجموعة الأزرار: 2 جنب بعض في الهاتف وسطر واحد في الكمبيوتر */}



    <div className="grid grid-cols-2 sm:grid-cols-2 md:flex md:flex-row items-center gap-2 w-full md:w-auto">



        



        {/* زر جلب الدرجات - يظهر في سطر كامل في الهاتف إذا كان متاحاً */}



        {viewMode === "official" && showTrainerColumn && (



            <Button 



                onClick={handleFetchTrainerScores} 



                disabled={loading} 



                className="col-span-2 md:col-auto bg-orange-600 hover:bg-orange-700 h-10 px-3 text-[10px] gap-1 font-bold shadow-md text-white"



            >



                {loading ? <Loader2 className="animate-spin w-3 h-3"/> : <UserCheck className="w-3 h-3" />}



                جلب الدرجات



            </Button>



        )}







        {/* زر إخفاء/إظهار الدرجة */}



        {selectedGroup.type === "engagement" && (



            <Button 



                onClick={() => setShowTrainerColumn(!showTrainerColumn)} 



                variant="outline"



                className={`h-10 px-2 text-[10px] font-bold border-2 transition-all ${



                    !showTrainerColumn ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-slate-300 text-slate-600'



                }`}



            >



                {showTrainerColumn ? "إخفاء الدرجة" : "إظهار (100%)"}



            </Button>



        )}







        {/* زر الطباعة */}



        <Button 



            onClick={() => {

        const originalTitle = document.title;

        const examType = selectedGroup.type === "fitness" ? "اختبار_لياقة_بدنية" : "اختبار_اشتباك";

        

        // 🛡️ تأمين اسم الدورة: إذا كانت null نضع كلمة "دورة"

        const courseName = (selectedGroup.course || "دورة").replace(/\s+/g, '_');

        

        // 🛡️ تأمين اسم الدفعة: إذا كانت null نضع كلمة "بدون_دفعة" لمنع انهيار replace

        const batchName = (selectedGroup.batch || "بدون_دفعة").replace(/\s+/g, '_');

        

        const examDate = selectedGroup.exam_date || "تاريخ_غير_محدد";

        

        // تغيير اسم الملف عند الطباعة بشكل آمن

        document.title = `${examType}_${courseName}_${batchName}_${examDate}`;

        

        window.print();

        

        // إعادة العنوان الأصلي للمتصفح بعد الطباعة

        setTimeout(() => { document.title = originalTitle; }, 500);

    }}



            className="bg-slate-900 h-10 px-3 text-[10px] md:text-xs gap-1 font-bold shadow-md text-white"



        >



            <Printer className="w-4 h-4" /> طباعة



        </Button>







        {/* زر الإكسل */}



        {/* 🟢 إخفاء زر الإكسل عن المدرب والمشرف الرياضي */}
{!["sports_trainer", "sports_supervisor"].includes(userRole) && (
    <Button 
        variant="outline" 
        onClick={exportToExcel} 
        className="text-green-700 border-green-600 h-10 px-2 text-[10px] bg-white font-bold shadow-sm gap-1"
    >
        <Download className="w-4 h-4" /> Excel
    </Button>
)}



    </div>



</div>



                            </div>



                        </div>







                        {/* الترويسة */}



                        <div className="text-center space-y-2">



                            <div className="flex justify-between items-start border-b-2 border-black pb-3">



                                <div className="w-1/3 flex justify-start"><img src="/logo.jpg" className="w-28 h-28 object-contain" /></div>



                                <div className="text-center font-black w-1/3 space-y-1">



                                    <p className="text-lg">معهد الشرطة</p>



                                    <p className="text-md">قسم التدريب العسكري والرياضي</p>



                                    <p className="text-xs underline font-bold">فرع التدريب الرياضي</p>



                                </div>



                                <div className="text-left font-bold text-xs w-1/3 mt-1">



                                    <p>اليوم: {format(new Date(selectedGroup.exam_date), "EEEE", { locale: ar })}</p>



                                    <p>تاريخ الاختبار: {selectedGroup.exam_date}</p>



                                </div>



                            </div>



                           <h1 className="text-lg md:text-xl font-black py-4 underline underline-offset-8 uppercase leading-relaxed">
    {/* 1. تحديد نوع الاختبار الأساسي */}
    {selectedGroup.type === "fitness" ? (
        "اختبار اللياقة البدنية"
    ) : (
        /* 2. منطق الاشتباك: هل هو عام أم لمقيم محدد؟ */
        selectedEvaluator === "all" 
            ? "اختبار اشتباك - الكشف العام" 
            : `كشف درجات اختبار الاشتباك (${evaluatorType === 'technical' ? 'الجزء الفني' : 'جزء السيناريو'}) - المقيم: ${selectedEvaluator}`
    )}

    {/* 3. الإضافات (النوع المخصص، الدورة، الدفعة) */}
    {customExamType && ` (${customExamType})`} 
    {" - "} دورة: {selectedGroup.course} 

    {/* 🟢 شرط الدفعة: يطبع فقط إذا لم تكن "لا يوجد" */}
    {selectedGroup.batch !== "لا يوجد" && ` / الدفعة: ${selectedGroup.batch}`}
</h1>



                            <div className="no-print flex justify-center pb-4">



                                <Input placeholder="اكتب نوع الاختبار (مثلاً: نهائي)" className="w-64 h-8 text-center font-bold border-orange-200 bg-orange-50/50" value={customExamType} onChange={(e) => setCustomExamType(e.target.value)} />



                            </div>



                        </div>







                        {/* الجدول الموحد */}



                        <div className="border-2 border-transparent rounded-lg overflow-x-auto shadow-sm">



                            <Table className="w-full border-2 border-black">



                               <TableHeader className="bg-[#c5b391]">
    <TableRow className="border-b-2 border-black text-black">
        <TableHead className="text-center border-l border-black font-bold w-12">#</TableHead>
        <TableHead className="text-center border-l border-black font-bold w-24">الرتبة</TableHead>
        <TableHead className="text-center border-l border-black font-bold w-32">الرقم العسكري</TableHead>
        <TableHead className="text-right border-l border-black font-bold px-4">الاسم</TableHead>

        {hasCompanyData && <TableHead className="text-center border-l border-black font-bold w-20">السرية</TableHead>}
        {hasPlatoonData && <TableHead className="text-center border-l border-black font-bold w-20">الفصيل</TableHead>}

        {selectedGroup.type === "fitness" ? (
            <>
                {/* --- أعمدة اللياقة (بدون تغيير) --- */}
                <TableHead className="text-center border-l border-black font-bold w-16 bg-slate-50">الجري</TableHead>
                <TableHead className="text-center border-l border-black font-bold w-12 text-[10px] bg-slate-50">د.جري</TableHead>
                <TableHead className="text-center border-l border-black font-bold w-14 text-[10px] bg-slate-50">تق.جري</TableHead>
                <TableHead className="text-center border-l border-black font-bold w-12">الضغط</TableHead>
                <TableHead className="text-center border-l border-black font-bold w-12 text-[10px]">د.ضغط</TableHead>
                <TableHead className="text-center border-l border-black font-bold w-14 text-[10px]">تق.ضغط</TableHead>
                <TableHead className="text-center border-l border-black font-bold w-12 bg-slate-50">البطن</TableHead>
                <TableHead className="text-center border-l border-black font-bold w-12 text-[10px] bg-slate-50">د.بطن</TableHead>
                <TableHead className="text-center border-l border-black font-bold w-14 text-[10px] bg-slate-50">تق.بطن</TableHead>
                <TableHead className="text-center border-l border-black font-black bg-[#b4a280] w-16">النهائية</TableHead>
            </>
        ) : (
            <>
                {/* --- أعمدة الاشتباك (التعديل الذكي هنا) --- */}
                {selectedEvaluator === "all" ? (
                    /* 1. الحالة العادية: الكشف العام (متوسطات) */
                    <>
                        <TableHead className="text-center border-l border-black font-black bg-[#b4a280] w-24 transition-colors">
                            {showTrainerColumn ? "المعدل (90%)" : "المعدل (100%)"}
                        </TableHead>
                        {viewMode === "official" && showTrainerColumn && (
                            <TableHead className="text-center border-l border-black font-black bg-[#a39170] w-24 animate-in fade-in">
                                درجة المدرب
                            </TableHead>
                        )}
                    </>
                ) : (
                   /* 2. حالة المقيم المحدد: إظهار المعايير التفصيلية */
<>
    {(() => {
        // البحث عن أول طالب يملك snapshot للنوع المختار حالياً
        const firstWithSnap = finalReportData.find((s: any) => s.display_snapshot);
        if (!firstWithSnap) return null;
        
        const snap = firstWithSnap.display_snapshot;
        // التأكد من أن الـ snapshot هو مصفوفة أو تحويله لمصفوفة
        const configsList = Array.isArray(snap) ? snap : [snap];
        
        return configsList.flatMap((config: any) => 
            (config.axes || []).flatMap((axis: any, axisIdx: number) => 
                (axis.criteria || []).map((crit: any, critIdx: number) => (
                    <TableHead 
                        // ✅ حل مشكلة الـ Key: نستخدم اسم المعيار مع أرقام ترتيبية لضمان عدم التكرار
                        key={`head-${axisIdx}-${critIdx}-${crit.name}`} 
                        className="text-center border-l border-black font-bold text-[9px] bg-blue-50/50 min-w-[50px] leading-tight"
                    >
                        {crit.name}
                    </TableHead>
                ))
            )
        );
    })()}
    <TableHead className="text-center border-l border-black font-black bg-[#b4a280] w-20">
        درجة {evaluatorType === 'technical' ? 'الفني' : 'السيناريو'}
    </TableHead>
</>
                )}
            </>
        )}

        {/* 🟢 التقدير: يظهر فقط في الكشف العام */}
{selectedEvaluator === "all" && (
    <TableHead className={`text-center border-l border-black font-bold w-20 ${printDestination === 'control' ? 'print:hidden' : ''}`}>
        التقدير
    </TableHead>
)}

{/* 🟢 النتيجة: تظهر فقط في الكشف العام */}
{selectedEvaluator === "all" && (
    <TableHead className={`text-center border-l border-black font-bold w-16 ${
        selectedGroup.type === "engagement" && printDestination === "control" ? "print:hidden" : ""
    }`}>
        النتيجة
    </TableHead>
)}

        {selectedGroup.type === "fitness" && hasTrainerScore && (
            <TableHead className="text-center border-l border-black font-bold bg-[#a39170] w-16">المدرب</TableHead>
        )}

        <TableHead className="text-right font-bold px-4">ملاحظات</TableHead>
    </TableRow>
</TableHeader>



                               <TableBody>
    {finalReportData.map((s: any, idx: number) => {
        const gradeInfo = getGradeInfo(s.total_final, s.notes);
        const isAbsent = s.total_final === null && !s.average;
        const isVisibleOnScreen = idx >= (innerCurrentPage - 1) * innerItemsPerPage && idx < innerCurrentPage * innerItemsPerPage;

        return (
            <TableRow 
                key={s.military_id || idx} 
                className={`border-b border-black font-bold text-center h-10 hover:bg-slate-50 
                ${isVisibleOnScreen ? 'table-row' : 'hidden print:table-row force-print'}`}
            >
                {/* البيانات الأساسية */}
                <TableCell className="border-l border-black">{idx + 1}</TableCell>
                <TableCell className="border-l border-black">{s["الرتبة"] || s.rank || "-"}</TableCell>
                <TableCell className="border-l border-black font-mono">{s["الرقم العسكري"] || s.military_id}</TableCell>
                <TableCell className="text-right border-l border-black px-4 whitespace-nowrap">{s["الإسم"] || s.name}</TableCell>
                
                {hasCompanyData && <TableCell className="border-l border-black text-[10px]">{s["السرية"] || s.company || "-"}</TableCell>}
                {hasPlatoonData && <TableCell className="border-l border-black text-[10px]">{s["الفصيل"] || s.platoon || "-"}</TableCell>}

                {/* --- منطق عرض الدرجات --- */}
                {selectedGroup.type === "fitness" ? (
                    <>
                        {/* خلايا اللياقة البدنية (بدون تغيير) */}
                        <TableCell className="border-l border-black bg-slate-50/50">{s["الجري"] ?? s.run_time ?? "-"}</TableCell>
                        <TableCell className="border-l border-black text-[10px] bg-slate-50/50">{s["درجة الجري"] ?? s.run_score ?? "-"}</TableCell>
                        <TableCell className="border-l border-black text-[10px] bg-slate-50/50">{s["تقدير الجري"] ?? s.run_grade ?? "-"}</TableCell>
                        <TableCell className="border-l border-black">{s["الضغط"] ?? s.pushups ?? "-"}</TableCell>
                        <TableCell className="border-l border-black text-[10px]">{s["درجة الضغط"] ?? s.push_score ?? "-"}</TableCell>
                        <TableCell className="border-l border-black text-[10px]">{s["تقدير الضغط"] ?? s.push_grade ?? "-"}</TableCell>
                        <TableCell className="border-l border-black bg-slate-50/50">{s["البطن"] ?? s.situps ?? "-"}</TableCell>
                        <TableCell className="border-l border-black text-[10px] bg-slate-50/50">{s["درجة البطن"] ?? s.sit_score ?? "-"}</TableCell>
                        <TableCell className="border-l border-black text-[10px] bg-slate-50/50">{s["تقدير البطن"] ?? s.sit_grade ?? "-"}</TableCell>
                        <TableCell className="border-l border-black font-black text-lg">{s["الدرجة النهائية"] ?? s.average ?? "-"}</TableCell>
                    </>
                ) : (
                    <>
                        {/* --- منطق الاشتباك المطور --- */}
                        {selectedEvaluator === "all" ? (
                            /* 1. عرض الكشف العام (المتوسطات) */
                            <>
                                <TableCell className="border-l border-black font-black text-lg">
                                    {isAbsent ? "-" : s.total_final}
                                </TableCell>
                                {viewMode === "official" && showTrainerColumn && (
                                    <TableCell className="border-l border-black font-black text-lg">
                                        {isAbsent ? "-" : (trainerScores[s.military_id] || "-")}
                                    </TableCell>
                                )}
                            </>
                        ) : (
                           /* 2. عرض كشف المقيم (المعايير التفصيلية) */
<>
    {(() => {
        if (isAbsent || !s.display_snapshot) {
            const firstWithSnap = finalReportData.find((st: any) => st.display_snapshot);
            const count = firstWithSnap?.display_snapshot ? (Array.isArray(firstWithSnap.display_snapshot) ? firstWithSnap.display_snapshot : [firstWithSnap.display_snapshot]).flatMap((c:any)=>(c.axes || [])).flatMap((a:any)=>(a.criteria || [])).length : 0;
            return Array(count).fill(0).map((_, i) => <TableCell key={`absent-${s.military_id}-${i}`} className="border-l border-black text-slate-300">-</TableCell>);
        }

        const configsList = Array.isArray(s.display_snapshot) ? s.display_snapshot : [s.display_snapshot];
        return configsList.flatMap((config: any) => 
            (config.axes || []).flatMap((axis: any, axisIdx: number) => 
                (axis.criteria || []).map((crit: any, critIdx: number) => (
                    <TableCell 
                        // ✅ استخدام مفتاح فريد يربط الرقم العسكري مع ترتيب المعيار
                        key={`cell-${s.military_id}-${axisIdx}-${critIdx}`} 
                        className="border-l border-black text-[11px] font-mono bg-blue-50/20"
                    >
                        {crit.score ?? "-"}
                    </TableCell>
                ))
            )
        );
    })()}
    <TableCell className="border-l border-black font-black text-lg bg-slate-100">
        {isAbsent ? "-" : s.total_final}
    </TableCell>
</>
                        )}
                    </>
                )}

                {/* 🟢 التقدير: يختفي عند اختيار مقيم محدد */}
{selectedEvaluator === "all" && (
    <TableCell className={`border-l border-black ${printDestination === 'control' ? 'print:hidden' : ''}`}>
        {selectedGroup.type === "fitness" 
            ? (s["التقدير العام"] || s.grade || "-") 
            : (isAbsent ? "-" : gradeInfo.result)}
    </TableCell>
)}

{/* 🟢 النتيجة: تختفي عند اختيار مقيم محدد */}
{selectedEvaluator === "all" && (
    <TableCell className={`border-l border-black font-bold ${
        selectedGroup.type === "engagement" && printDestination === "control" ? "print:hidden" : ""
    }`}>
        {selectedGroup.type === "fitness" ? (
            s["النتيجة"] === "ناجح" || s.final_result === "Pass" ? <span className="text-green-700">ناجح</span> : 
            s["النتيجة"] === "راسب" || s.final_result === "Fail" ? <span className="text-red-600">راسب</span> : "-"
        ) : (
            isAbsent ? "-" : gradeInfo.result === "راسب" ? <span className="text-red-600">راسب</span> : <span className="text-green-700">ناجح</span>
        )}
    </TableCell>
)}

                {selectedGroup.type === "fitness" && hasTrainerScore && (
                    <TableCell className="border-l border-black font-bold text-blue-800">{s["درجة المدرب"] || s.trainer_score || "-"}</TableCell>
                )}

                <TableCell className="text-right border-l border-black px-2 no-print min-w-[150px]">
                    {renderNoteCell(s) || s["ملاحظات"] || s["الملاحظات"] || s.notes || "-"}
                </TableCell>

                <TableCell className="text-right px-2 hidden print:table-cell text-[10px]">
                    {tempNotes[s.military_id] || s.notes || s["ملاحظات"] || s["الملاحظات"] || ""} 
                </TableCell>
            </TableRow>
        );
    })}
</TableBody>



                            </Table>



                        </div>







                        {/* ترقيم الصفحات */}



                        <div className="no-print flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border">



                            <div className="flex items-center gap-2">



                                <Label className="text-xs font-bold text-slate-500">عرض:</Label>



                                <Select value={String(innerItemsPerPage)} onValueChange={(v) => {setInnerItemsPerPage(Number(v)); setInnerCurrentPage(1);}}>



                                    <SelectTrigger className="w-24 h-8 text-xs bg-white font-bold"><SelectValue /></SelectTrigger>



                                    <SelectContent><SelectItem value="10">10 طلاب</SelectItem><SelectItem value="20">20 طالب</SelectItem><SelectItem value="50">50 طالب</SelectItem><SelectItem value="100">100 طالب</SelectItem><SelectItem value="5000">الكل</SelectItem></SelectContent>



                                </Select>



                                <span className="text-[10px] text-slate-400 font-bold mr-2">إجمالي: {finalReportData.length}</span>



                            </div>



                            <div className="flex items-center gap-3">



                                <Button variant="outline" size="sm" disabled={innerCurrentPage === 1} onClick={() => setInnerCurrentPage(p => p - 1)} className="font-bold h-8 px-4 bg-white">السابق</Button>



                                <div className="text-xs font-black bg-white px-4 py-1 rounded-lg border shadow-inner text-orange-700">صفحة {innerCurrentPage}</div>



                                <Button variant="outline" size="sm" disabled={paginatedStudents.length < innerItemsPerPage} onClick={() => setInnerCurrentPage(p => p + 1)} className="font-bold h-8 px-4 bg-white">التالي</Button>



                            </div>



                        </div>







                        {/* التوقيعات */}



                        <div className="grid grid-cols-3 gap-8 p-8 border-t mt-10 text-center">



    {signatureConfig.map((item) => {



        const approval = selectedGroup.sub_records[0]?.approvals?.[item.key];



        



        // 🛡️ منطق التحقق من صلاحية التوقيع لكل خانة



        const canApproveThisBox = (() => {



    const isHighAdmin = ["owner", "admin", "manager"].includes(userRole);



    



    if (item.key === "supervisor") {



        // خانة المشرف: يوقع فيها (المشرف، المدرب، أو مساعد المسؤول) ✅



        return isHighAdmin || ["sports_supervisor", "sports_trainer", "assistant_admin"].includes(userRole);



    } 



    



    if (item.key === "officer") {



        // خانة الضابط: يوقع فيها الضابط فقط (المساعد ممنوع هنا) ❌



        return isHighAdmin || ["sports_officer"].includes(userRole);



    } 



    



    if (item.key === "head") {



        // خانة رئيس القسم: للقيادة العليا فقط



        return isHighAdmin;



    }



    



    return false;



})();







        return (



            <div key={item.key} className="signature-box flex flex-col items-center gap-1">



                <span className="font-bold underline text-xs mb-2 text-slate-700">{item.label}</span>



                



                {approval?.approved ? (



                    /* عرض التوقيع إذا تم الاعتماد */



                    <div className="space-y-1 w-full relative group animate-in fade-in duration-500">



                        <p className="font-black text-[14px] text-blue-900">{approval.rank} / {approval.name}</p>



                        <div className="h-10 md:h-12 flex items-center justify-center mt-1">



                            <img 



    // 🟢 رابط سوبابيز المباشر (تأكد من مطابقة اسم الباكت Signatures)



    src={`https://cynkoossuwenqxksbdhi.supabase.co/storage/v1/object/public/Signatures/${approval.mil_id || approval.military_id}.png`} 



    



    className="h-full object-contain mix-blend-multiply signature-print-force" 



    



    // 🕵️ معالجة ذكية للصيغ (png ثم jpg ثم jpeg)



    onError={(e) => {



        const target = e.target as HTMLImageElement;



        if (target.src.includes('.png')) {



            target.src = target.src.replace('.png', '.jpg');



        } else if (target.src.includes('.jpg')) {



             target.src = target.src.replace('.jpg', '.jpeg');



        } else {



            target.style.display = 'none'; // إخفاء الصورة تماماً إذا فشلت كل المحاولات



        }



    }} 



/>



                        </div>



                        {/* زر إلغاء الاعتماد (يظهر فقط لمن له صلاحية عالية) */}



                        {["owner", "admin", "manager", "assistant_admin"].includes(userRole) && (



                            <Button 



                                variant="ghost" 



                                size="icon" 



                                className="no-print absolute -top-2 -right-2 text-red-400 opacity-0 group-hover:opacity-100" 



                                onClick={() => handleResetApproval(selectedGroup.sub_records.map((r:any)=>r.id), item.key)}



                            >



                                <RotateCcw className="w-3 h-3" />



                            </Button>



                        )}



                    </div>



                ) : (



                    /* حالة انتظار الاعتماد */



                    <div className="text-slate-300 italic text-[9px] py-4">



                        بانتظار الاعتماد...



                        {canApproveThisBox && (



                            <Button 



                                size="sm" 



                                variant="outline" 



                                className="no-print mt-2 h-6 text-[9px] border-blue-200 text-blue-600 hover:bg-blue-50 font-bold" 



                                onClick={()=>handleApprove(selectedGroup.sub_records.map((r:any)=>r.id), item.key)}



                            >



                                اعتماد



                            </Button>



                        )}



                    </div>



                )}



            </div>



        );



    })}



</div>



                    </div>



                ) : (



                    /* واجهة الأرشيف الرئيسية */



                    <div className="archive-view space-y-6" >



    <div className="flex flex-col gap-4 px-2">



        <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">



            <Activity className="w-6 h-6 text-orange-600" /> أرشيف النتائج الرياضية



        </h1>



        



        {/* 🟢 شريط الفلاتر المطور للبطاقات */}



        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 bg-slate-100 p-3 rounded-xl border no-print shadow-sm">



            <div className="md:col-span-2 relative">



                <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />



                <Input placeholder="بحث بالعنوان..." className="h-9 pr-9 bg-white" value={searchQuery} onChange={(e)=>{setSearchQuery(e.target.value); setMainPage(1);}} />



            </div>



            



            {/* 🟢 مربع البحث عن التاريخ - حل جذري لمشكلة الآيفون والتموج */}



<div className="relative w-full overflow-hidden">



    <Calendar className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 z-10 pointer-events-none" />



    <Input 



        type="date" 



        className="h-9 pr-9 bg-white font-bold w-full text-[14px] md:text-sm shadow-sm" 



        style={{ 



            minWidth: '0',



            maxWidth: '100%',



            display: 'block',



            // 🍎 خصائص سحرية لإجبار الآيفون على احترام العرض



            WebkitAppearance: 'none',



            MozAppearance: 'none',



            appearance: 'none'



        }}



        value={dateSearch} 



        onChange={(e)=>{setDateSearch(e.target.value); setMainPage(1);}} 



    />



</div>







            {/* فلتر الدورة */}



            <Select value={filterCourse} onValueChange={(v)=>{setFilterCourse(v); setMainPage(1);}}>



                <SelectTrigger className="h-9 bg-white font-bold"><SelectValue placeholder="الدورة" /></SelectTrigger>



                <SelectContent>



                    <SelectItem value="all">كل الدورات</SelectItem>



                    {uniqueCourses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}



                </SelectContent>



            </Select>







            {/* فلتر الدفعة */}



            <Select value={filterBatch} onValueChange={(v)=>{setFilterBatch(v); setMainPage(1);}}>



                <SelectTrigger className="h-9 bg-white font-bold"><SelectValue placeholder="الدفعة" /></SelectTrigger>



                <SelectContent>



                    <SelectItem value="all">كل الدفعات</SelectItem>



                    {uniqueBatches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}



                </SelectContent>



            </Select>







            <Button onClick={fetchRecords} disabled={loading} className="h-9 bg-blue-600 hover:bg-blue-700 text-white gap-2">



                <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> تحديث



            </Button>



        </div>



    </div>







   <Tabs 

    value={activeTab} 

    onValueChange={(v) => { 

        setActiveTab(v); 

        setTrainerScores({}); 

        setMainPage(1); 

        

        // 🟢 الحل السحري هنا: تصفير كل الاختيارات لتعود للرئيسية

        setActiveGroup(null);   // إغلاق الدورة المختارة

        setSelectedGroup(null); // إغلاق أي اختبار مفتوح

        setCustomExamType("");  // تنظيف حقل البحث المخصص

        setInnerCurrentPage(1); // إعادة الترقيم للبداية

    }}

>



        <TabsList className="bg-slate-200 p-1 rounded-xl w-full max-w-md mx-auto mb-8 flex h-10 shadow-md">



            <TabsTrigger value="engagement" className="flex-1 font-bold h-8 data-[state=active]:bg-orange-600 data-[state=active]:text-white">نتائج الاشتباك</TabsTrigger>



            <TabsTrigger value="fitness" className="flex-1 font-bold h-8 data-[state=active]:bg-green-600 data-[state=active]:text-white">نتائج اللياقة</TabsTrigger>



        </TabsList>



        



       <TabsContent value={activeTab}>

    {loading ? (

        <div className="flex justify-center py-20"><Loader2 className="animate-spin w-10 h-10 text-orange-500" /></div>

    ) : (

        <>

            {/* 1️⃣ المستوى الأول: بطاقات الدورات */}

            {!activeGroup && (

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in zoom-in-95" dir="rtl">

                    {courseBatchGroups.length === 0 ? (

                        <div className="col-span-full text-center py-20 bg-slate-50 rounded-2xl border-dashed border-2">

                            <FileWarning className="w-12 h-12 text-slate-300 mx-auto mb-4" />

                            <p className="text-slate-500 font-bold">لا توجد دورات مسجلة في هذا القسم</p>

                        </div>

                    ) : (

                        courseBatchGroups.map((group: any) => (

                            <Card 

    key={`${group.course}-${group.batch}`} 

    className={`group cursor-pointer border-none hover:shadow-2xl transition-all duration-500 bg-white relative overflow-hidden h-[230px] flex flex-col shadow-md rounded-[2rem] ${activeTab === 'fitness' ? 'border-[3px] border-green-600' : 'border-[3px] border-orange-600'}`}

    onClick={() => setActiveGroup(group)}

>

                                {/* خلفية حسب التاب */}

                                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full -mr-16 -mt-16 transition-colors duration-500 ${activeTab === 'fitness' ? 'bg-green-50 group-hover:bg-green-100' : 'bg-orange-50 group-hover:bg-orange-100'}`} />

    

    <CardHeader className="relative z-10 pb-0">

        <div className="flex justify-between items-start">

            <div className={`p-3 text-white rounded-2xl shadow-lg transition-transform duration-500 group-hover:scale-110 ${activeTab === 'fitness' ? 'bg-green-600 shadow-green-200' : 'bg-orange-600 shadow-orange-200'}`}>

                {activeTab === 'fitness' ? <Activity className="w-6 h-6" /> : <Swords className="w-6 h-6" />}

            </div>

            <div className="flex flex-col items-end gap-1">

                <Badge variant="secondary" className="bg-slate-100 text-slate-500 font-bold border-none px-3 py-1 rounded-full text-[10px]">

                    أرشيف {activeTab === 'fitness' ? 'اللياقة' : 'الاشتباك'}

                </Badge>

                <span className={`text-[10px] font-black px-1 ${activeTab === 'fitness' ? 'text-green-600' : 'text-orange-600'}`}>

                    عدد الاختبارات ({group.examCount})

                </span>

            </div>

        </div>

    </CardHeader>



    <CardContent className="relative z-10 flex-1 flex flex-col justify-center pt-4 text-center">

        <h3 className={`text-xl font-black text-slate-800 transition-colors line-clamp-1 ${activeTab === 'fitness' ? 'group-hover:text-green-700' : 'group-hover:text-orange-700'}`}>

            {group.course}

        </h3>

        <div className="flex items-center justify-center gap-2 mt-2 text-slate-500">

            <Layers className="w-4 h-4 opacity-50" />

            <span className="text-sm font-bold tracking-wide">{group.batch}</span>

        </div>

    </CardContent>



{/* 📊 تذييل البطاقة - عريض وواضح */}

<div className={`mt-auto w-full flex justify-between items-center text-white px-6 py-6 ${ // 🟢 زدنا الـ py-6 ليكون عريضاً

    activeTab === 'fitness' 

        ? 'bg-gradient-to-l from-green-600 to-green-500' 

        : 'bg-gradient-to-l from-orange-600 to-orange-500'

}`}>

    <div className="flex flex-col text-right justify-center">

        <span className="text-[12px] font-bold opacity-90 uppercase tracking-tighter mb-1">

            الحالة

        </span>

        {/* 🟢 leading-relaxed تمنع قص الحروف من الأسفل + pb-1 مسافة أمان */}

        <span className="text-xl font-black tracking-wide whitespace-nowrap leading-relaxed pb-1">

            جاهز للعرض

        </span>

    </div>

    

    <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md group-hover:bg-white/40 transition-all shadow-sm">

        <ArrowRight className="w-6 h-6 text-white" />

    </div>

</div>

</Card>

                        ))

                    )}

                </div>

            )}



            {/* 2️⃣ المستوى الثاني: الاختبارات داخل الدورة */}

            {activeGroup && (

                <div className="space-y-6" dir="rtl">

                    <Button 

                        variant="outline" 

                        onClick={() => { setActiveGroup(null); setCustomExamType(""); }}

                        className={`mb-4 gap-2 font-bold border-2 ${activeTab === 'fitness' ? 'text-green-700 border-green-200 bg-green-50' : 'text-orange-700 border-orange-200 bg-orange-50'}`}

                    >

                        <ChevronRight className="w-4 h-4" /> العودة للدورات

                    </Button>



                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-left-4" dir="rtl">

                        {paginatedCards.map((group: any) => (

                            <Card 

                                key={group.key} 

                                className={`cursor-pointer border-r-8 hover:shadow-2xl transition-all group relative overflow-hidden ${

                                    activeTab === 'fitness' ? 'border-green-500' : 'border-orange-500'

                                }`} 

                                onClick={() => { setSelectedGroup(group); setCustomExamType(""); setInnerCurrentPage(1); }}

                            >

                                <CardHeader className="pb-2">

                                    <div className="flex justify-between items-start flex-row-reverse mb-2" >

                                        <Badge className={group.status === 'approved' ? "bg-green-600" : "bg-orange-100 text-orange-700"}>

                                            {group.status === 'approved' ? "مُعتمد" : "قيد المراجعة"}

                                        </Badge>

                                        <span className="text-[10px] font-black text-slate-400 bg-white px-2 py-1 rounded border shadow-sm">

                                            {group.exam_date}

                                        </span>

                                    </div>

                                    <CardTitle className="text-md font-bold flex items-center gap-2" >

                                        {activeTab === 'fitness' ? <Activity className="w-4 h-4 text-green-600" /> : <Swords className="w-4 h-4 text-orange-600" />} 

                                        {group.title}

                                    </CardTitle>

                                </CardHeader>

                                <CardContent className="pt-4 border-t flex justify-between items-center flex-row-reverse bg-slate-50/30">

                                    <span className={`text-xs font-black px-3 py-1 rounded-full border ${

                                        activeTab === 'fitness' ? 'text-green-700 bg-green-50 border-green-100' : 'text-blue-700 bg-blue-50 border-blue-100'

                                    }`}>

                                        {group.student_count_ref} طالب

                                    </span>

                                    {["owner", "admin", "manager"].includes(userRole) && (

                                        <Button variant="ghost" size="icon" className="text-red-300 hover:text-red-600 h-8 w-8 hover:bg-red-50" 

                                            onClick={(e)=>{

                                                e.stopPropagation(); 

                                                setDeleteTarget({

                                                    id: group.sub_records[0].id, 

                                                    title: group.title, 

                                                    all_ids: group.sub_records.map((r:any)=>r.id)

                                                })

                                            }}

                                        >

                                            <Trash2 className="w-4 h-4" />

                                        </Button>

                                    )}

                                </CardContent>

                            </Card>

                        ))}

                    </div>

                   {/* 🟢 شريط الترقيم والتحكم (مطابق تماماً للسجل العسكري) */}

{!loading && groupedRecords.length > 0 && (

    <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-white border rounded-xl mt-8 shadow-sm no-print animate-in fade-in duration-500">

        

        {/* 1. اختيار عدد البطاقات في الصفحة */}

        <div className="flex items-center gap-2">

            <Label className="text-xs font-bold text-slate-500">عرض:</Label>

            <Select 

                value={String(mainItemsPerPage)} 

                onValueChange={(v) => {

                    setMainItemsPerPage(Number(v)); 

                    setMainPage(1);

                }}

            >

                <SelectTrigger className="w-24 h-8 text-xs bg-white font-bold shadow-sm">

                    <SelectValue />

                </SelectTrigger>

                <SelectContent>

                    <SelectItem value="12">12 بطاقة</SelectItem>

                    <SelectItem value="24">24 بطاقة</SelectItem>

                    <SelectItem value="50">50 بطاقة</SelectItem>

                </SelectContent>

            </Select>

            <span className="text-[10px] text-slate-400 font-bold mr-2">

                إجمالي الاختبارات: {groupedRecords.length}

            </span>

        </div>



        {/* 2. أزرار التنقل بين الصفحات */}

        <div className="flex items-center gap-3">

            <Button 

                variant="outline" 

                size="sm" 

                disabled={mainPage === 1} 

                onClick={() => {

                    setMainPage(p => p - 1);

                    window.scrollTo({ top: 0, behavior: 'smooth' });

                }} 

                className="font-bold h-8 px-4 bg-white shadow-sm"

            >

                <ChevronRight className="w-4 h-4 ml-1" /> السابق

            </Button>



            <div className={`text-xs font-black px-4 py-1 rounded-lg border shadow-inner ${

                activeTab === 'fitness' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'

            }`}>

                صفحة {mainPage} من {Math.max(1, Math.ceil(groupedRecords.length / mainItemsPerPage))}

            </div>



            <Button 

                variant="outline" 

                size="sm" 

                disabled={mainPage >= Math.ceil(groupedRecords.length / mainItemsPerPage)} 

                onClick={() => {

                    setMainPage(p => p + 1);

                    window.scrollTo({ top: 0, behavior: 'smooth' });

                }} 

                className="font-bold h-8 px-4 bg-white shadow-sm"

            >

                التالي <ChevronLeft className="w-4 h-4 mr-1" />

            </Button>

        </div>

    </div>

)}

                </div>

                

            )}

        </>

    )}

</TabsContent>



    </Tabs>



</div>



                )}







                <AlertDialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>



                    <AlertDialogContent dir="rtl">



                        <AlertDialogHeader><AlertDialogTitle className="text-red-600 flex items-center gap-2"><AlertTriangle /> حذف سجل رياضي</AlertDialogTitle><AlertDialogDescription>هل أنت متأكد من حذف هذا السجل بالكامل؟</AlertDialogDescription></AlertDialogHeader>



                        <AlertDialogFooter className="flex-row-reverse gap-3 mt-6"><AlertDialogAction onClick={confirmDelete} className="bg-red-600 text-white font-bold flex-1 h-11 rounded-xl shadow-lg">حذف نهائياً</AlertDialogAction><AlertDialogCancel className="font-bold flex-1 h-11 rounded-xl border-slate-200">إلغاء</AlertDialogCancel></AlertDialogFooter>



                    </AlertDialogContent>



                </AlertDialog>



            </div>



        </ProtectedRoute>



    );



}