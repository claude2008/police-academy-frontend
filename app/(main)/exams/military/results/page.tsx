"use client"

import { useState, useEffect, useMemo } from "react"
import { 
    Table as TableIcon, Search, Printer, Download, 
    Eye, ShieldCheck, CheckCircle2, X, Loader2, RotateCcw, 
    ArrowRight, Calendar, Trash2, ChevronRight, ChevronLeft, 
    AlertTriangle, ListFilter, Save,
    // 🟢 الأيقونات المفقودة التي سببت الخطأ:
    GraduationCap, Layers, FileCheck 
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
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import ProtectedRoute from "@/components/ProtectedRoute"
import * as XLSX from 'xlsx';
const absenceKeywords = ["غياب", "غائب", "إصابة", "لم يختبر", "شطب", "مؤجل", "اعتذار", "طبية", "مستشفى", "ملحق", "عيادة", "مرضية", "مفصول", "اصابة", "استقالة", "إستقالة"];
export default function ResultsArchivePage() {
    const [selectedSection, setSelectedSection] = useState<string>("all")
const [selectedExamType, setSelectedExamType] = useState<string>("all")
const [militarySections, setMilitarySections] = useState<any[]>([])
    const [selectedRecord, setSelectedRecord] = useState<any>(null)
    const [userRole, setUserRole] = useState<string>("")
    const [records, setRecords] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [dateSearch, setDateSearch] = useState("")
    const [courseFilter, setCourseFilter] = useState("all")
const [batchFilter, setBatchFilter] = useState("all")
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(12)
    const [innerCurrentPage, setInnerCurrentPage] = useState(1);
const [innerItemsPerPage, setInnerItemsPerPage] = useState(20);
    const [innerCompany, setInnerCompany] = useState("all")
    const [innerPlatoon, setInnerPlatoon] = useState("all")
    const [showTrainerScore, setShowTrainerScore] = useState(false);
const [trainerScores, setTrainerScores] = useState<Record<string, number>>({});
    const [viewMode, setViewMode] = useState<"field" | "official">("field");
    const [allSoldiersInBatch, setAllSoldiersInBatch] = useState<any[]>([]);
    const [tempNotes, setTempNotes] = useState<Record<string, string>>({});
  const [configs, setConfigs] = useState<any[]>([])
const [availableRecords, setAvailableRecords] = useState<any[]>([]);
const [committeeDialog, setCommitteeDialog] = useState(false);
const [availableAuthors, setAvailableAuthors] = useState<any[]>([]); // قائمة من رصدوا فعلياً
const [committeeMapping, setCommitteeMapping] = useState<Record<string, string>>({});
const [pendingGroup, setPendingGroup] = useState<any>(null);
    const [deleteTarget, setDeleteTarget] = useState<{id: number, title: string, all_ids: number[]} | null>(null);
    const [activeGroup, setActiveGroup] = useState<{ course: string; batch: string } | null>(null);
    const router = useRouter()
const searchParams = useSearchParams() // 👈 إضافة هذا
    const targetRecordId = searchParams.get('record_id')
    // كلمات مفتاحية لتحديد حالات الغياب
    useEffect(() => {
        if (selectedRecord) {
            setViewMode("official");
        }
    }, [selectedRecord]);

   useEffect(() => {
        const user = JSON.parse(localStorage.getItem("user") || "{}")
        setUserRole(user.role || "")
        
        const fetchInitialData = async () => {
            const headers = { "Authorization": `Bearer ${localStorage.getItem("token")}` };
            
            // 1. جلب الأقسام (رماية، مشاة...)
            const resSec = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/military-sections`, { headers });
            if (resSec.ok) setMilitarySections(await resSec.json());
            
            // 2. 🟢 جلب الإعدادات (المرجع الأساسي للهوية)
            const resConf = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/configs`, { headers });
            if (resConf.ok) setConfigs(await resConf.json());
            
            await fetchRecords();
        };

        fetchInitialData();
    }, [])
// 🔔 موظف الاستقبال الذكي - النسخة المصححة والمؤمنة
useEffect(() => {
    if (targetRecordId && records.length > 0) {
        const recordIdNum = parseInt(targetRecordId);
        const found = records.find(r => r.id === recordIdNum);
        
        if (found) {
            // 1. تفعيل المستوى الأول
            setActiveGroup({ course: found.course, batch: found.batch });

            // 2. 🟢 التصحيح: نمرر السجل الكامل 'found' وليس كائناً من صنعنا
            // لضمان وجود students_data وكل المعلومات المطلوبة للفلاتر
            handleCardClick(found);

            // 3. تنظيف الرابط
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
            
            toast.success(`تم فتح: ${found.title}`);
        }
    }
}, [records, targetRecordId]);
const fetchRecords = async () => {
    setLoading(true);
    try {
        const token = localStorage.getItem("token");
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const scope = user?.extra_permissions?.scope;
        const isRestricted = user.role !== 'owner' && scope?.is_restricted;
        
        // 🟢 [التعديل الذهبي]: تنظيف المصفوفة من الصلاحيات الإدارية
        // نعتبر أن مفتاح الدورة الحقيقي يجب أن يحتوي على "||" (الخاص بالدفعة)
        // أو نستبعد الكلمات المحجوزة يدوياً
        const rawCourses = scope?.courses || [];
        const userCourses = rawCourses.filter((key: string) => 
            key !== "fitness_standards" &&  // استبعاد معايير اللياقة
            key.includes("||")              // استبعاد أي شيء ليس بصيغة (دورة||دفعة)
        );

        // 🛑 [نقطة التفتيش المعدلة]
        // الآن، إذا كان لديه فقط "fitness_standards"، ستصبح userCourses فارغة، وسيتم الحجب
        if (isRestricted && userCourses.length === 0) {
            console.log("⛔ وصول محظور: تم استبعاد الصلاحيات الإدارية، ولا توجد دورات.");
            setRecords([]);
            setLoading(false);
            return; // ✋ إغلاق فوري
        }

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/records`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (res.ok) {
            const rawData = await res.json();
            
            let processed = rawData.map((r: any) => ({
                ...r,
                students_data: typeof r.students_data === 'string' ? JSON.parse(r.students_data) : r.students_data,
                approvals: typeof r.approvals === 'string' ? JSON.parse(r.approvals) : r.approvals
            }));

            // 🛡️ تصفية النتائج
            if (isRestricted) {
                processed = processed.filter((r: any) => {
                    const key = `${r.course}${r.batch ? `||${r.batch}` : ''}`;
                    // نستخدم المصفوفة النظيفة userCourses للمقارنة
                    return userCourses.includes(key);
                });
            }

            setRecords(processed);
        }
    } catch (e) {
        toast.error("فشل الاتصال بالسيرفر");
    } finally {
        setLoading(false);
    }
};

    useEffect(() => {
        if (selectedRecord && viewMode === "official") {
            const fetchBatch = async () => {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/?course=${selectedRecord.course}&batch=${selectedRecord.batch}&limit=2000`, {
                    headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setAllSoldiersInBatch(data.data);
                }
            };
            fetchBatch();
        }
    }, [selectedRecord, viewMode]);
 const handleCardClick = (group: any) => {
    // 1. جلب كافة سجلات الدفعة (الخزان الرئيسي)
    const allBatchRecords = records.filter(r => 
        r.config_id === group.config_id && 
        r.course === group.course && 
        r.batch === group.batch &&
        r.exam_date === group.exam_date
    );

    const platoonKeys = Array.from(new Set(allBatchRecords.map(r => `${r.company}-${r.platoon}`)));
    
    // كائن لتخزين الفصائل التي بها مشكلة فقط وسجلاتها
    let conflictedGroups: Record<string, any[]> = {};
    let hasAnyConflict = false;

    platoonKeys.forEach(pKey => {
        const platoonRecs = allBatchRecords.filter(r => `${r.company}-${r.platoon}` === pKey);
        const roles = platoonRecs.map(r => r.examiner_role).filter(role => role !== 'none' && role !== "");
        
        // فحص التضارب في هذا الفصيل تحديداً
        if (roles.length !== new Set(roles).size) {
            hasAnyConflict = true;
            conflictedGroups[pKey] = platoonRecs;
        }
    });

    // تحديث السجلات المتاحة (الكل للجدول)
    setAvailableRecords(allBatchRecords);

    if (hasAnyConflict) {
        // 🚨 إرسال بيانات الفصائل المتعارضة للنافذة
        setPendingGroup({ ...group, conflictedGroups }); 
        setCommitteeMapping({}); // تصفير التعيينات لبدء حل النزاع
        setCommitteeDialog(true);
        toast.warning("تنبيه: يوجد تضارب في أدوار الرصد لعدة فصائل");
    } else {
        // ✅ لا يوجد تضارب
        setSelectedRecord(group);
    }
};

// استخراج قوائم الفلاتر ديناميكياً من السجلات
const coursesList = useMemo(() => {
    return Array.from(new Set(records.map(r => r.course))).filter(Boolean);
}, [records]);

const batchesList = useMemo(() => {
    let filtered = records;
    if (courseFilter !== "all") filtered = records.filter(r => r.course === courseFilter);
    return Array.from(new Set(filtered.map(r => r.batch))).filter(Boolean);
}, [records, courseFilter]);
    // 🧠 دالة فحص حالة الغياب (لتحويل الـ 0 إلى -)
    const isStudentAbsent = (student: any) => {
        return absenceKeywords.some(k => student.notes?.includes(k)) || student.total === null;
    };

 const finalReportData = useMemo(() => {
    if (!selectedRecord || !availableRecords.length) return [];

    const currentConfig = configs.find(c => c.id === selectedRecord.config_id);
    const isShooting = currentConfig?.subject === "shooting";

    // 1️⃣ بناء قائمة الطلاب الأساسية (دمج كافة الطلاب من كافة السجلات المتاحة)
    let baseStudentsList = [];
    if (viewMode === "field") {
        const allMergedStudents = new Map();
        availableRecords.forEach(rec => {
            const sData = Array.isArray(rec.students_data) ? rec.students_data : [];
            sData.forEach((s: any) => {
                const milId = String(s.military_id);
                if (!allMergedStudents.has(milId)) {
                    allMergedStudents.set(milId, {
                        military_id: s.military_id,
                        name: s.name,
                        rank: s.rank,
                        company: s.company,
                        platoon: s.platoon
                    });
                }
            });
        });
        baseStudentsList = Array.from(allMergedStudents.values());
    } else {
        // في الوضع الرسمي، نأتي بكل طلاب الدفعة للفصائل التي تم اختبارها فعلياً
        const testedPlatoonKeys = new Set();
        availableRecords.forEach(rec => {
            const sData = Array.isArray(rec.students_data) ? rec.students_data : [];
            sData.forEach((s: any) => testedPlatoonKeys.add(`${s.company}-${s.platoon}`));
        });
        
        baseStudentsList = allSoldiersInBatch.filter((s: any) => 
            testedPlatoonKeys.has(`${s.company}-${s.platoon}`)
        );
    }

    // 2️⃣ معالجة الدرجات بنظام "البحث عن الدور" لكل طالب على حدة
   const processedData = baseStudentsList.map((soldier: any) => {
    const milId = String(soldier.military_id);

    // 1. دالة مساعدة للبحث عن سجل الطالب بناءً على دور المقيّم (للمواد العسكرية)
    const findStudentByRole = (role: string) => {
        const record = availableRecords.find(r => r.examiner_role === role && 
            r.students_data?.some((s: any) => String(s.military_id) === milId));
        return record?.students_data?.find((s: any) => String(s.military_id) === milId);
    };

    // 2. البحث عن سجل الطالب في "أي مكان" (مخصص لاختبار الرماية والبحث الحر)
    const studentShooting = isShooting 
        ? availableRecords.find(r => r.students_data?.some((s: any) => String(s.military_id) === milId))
            ?.students_data?.find((s: any) => String(s.military_id) === milId)
        : null;

    const studentM1 = findStudentByRole('member1');
    const studentM2 = findStudentByRole('member2');
    const studentHead = findStudentByRole('head');

    // 3. استخراج الدرجات (مع إضافة درجة الرماية)
    const s1 = studentM1 ? parseFloat(studentM1.total) : null;
    const s2 = studentM2 ? parseFloat(studentM2.total) : null;
    const sH = studentHead ? parseFloat(studentHead.total) : null;
    const sShoot = studentShooting ? parseFloat(studentShooting.total) : null;

    // 4. حساب المتوسط بناءً على نوع الاختبار
    // إذا كان رماية: نأخذ درجة سجل الرماية الوحيد
    // إذا كان مواد أخرى: نحسب متوسط اللجنة (عضو 1، 2، رئيس)
    const validScores = isShooting 
        ? (sShoot !== null && !isNaN(sShoot) ? [sShoot] : [])
        : ([s1, s2, sH].filter(v => v !== null && !isNaN(v as number)) as number[]);

    const average = validScores.length > 0 
        ? parseFloat((validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(2)) 
        : null;

    // 5. جلب الملاحظات (دمج ملاحظات الرماية مع منطق اللجنة)
    const anySavedNote = isShooting 
        ? (studentShooting?.notes || "")
        : (studentHead?.notes || studentM1?.notes || studentM2?.notes || "");

    // 🟢 منطق الرماية: إرجاع البيانات الشاملة (الأهداف + المجموع)
    if (isShooting) {
        const mainStudent = studentShooting || studentHead || studentM1 || studentM2;
        if (mainStudent) {
            return {
                ...soldier,       // معلومات الجندي الأساسية
                ...mainStudent,   // معلومات الاختبار (الأهداف، السجل الفني)
                total: average !== null ? average : mainStudent.total,
                isAbsent: (mainStudent.total === null || mainStudent.total === undefined),
                notes: tempNotes[milId] || anySavedNote || ""
            };
        }
    }

    // 🟠 منطق المواد العسكرية الأخرى (اللجنة)
    return {
        ...soldier,
        member1_score: s1,
        member2_score: s2,
        head_score: sH,
        total: average,
        notes: tempNotes[milId] || anySavedNote,
        isAbsent: validScores.length === 0
    };
});

    // 3️⃣ الفلترة النهائية (سرية/فصيل) بناءً على اختيارات المستخدم من شريط الأدوات
    return processedData.filter((s: any) => {
        const matchCo = innerCompany === "all" || s.company === innerCompany;
        const matchPl = innerPlatoon === "all" || s.platoon === innerPlatoon;
        return matchCo && matchPl;
    });

}, [selectedRecord, availableRecords, viewMode, allSoldiersInBatch, innerCompany, innerPlatoon, tempNotes, configs]);

    const getGradeInfo = (total: any, notes: string) => {
        // 🚀 إذا كانت هناك ملاحظة غياب، نلغي النتيجة والتقدير فوراً
        if (absenceKeywords.some(k => notes?.includes(k)) || total === null || total === undefined) {
            return { result: "-", category: "-" };
        }
        const s = parseFloat(total);
        if (s >= 90) return { result: "ممتاز", category: "أ" };
        if (s >= 80) return { result: "جيد جداً", category: "ب" };
        if (s >= 70) return { result: "جيد", category: "ج" };
        if (s >= 60) return { result: "مقبول", category: "د" };
        return { result: "راسب", category: "-" };
    };

    // 🚀 دالة عرض الملاحظات (تُظهر المحفوظ وتسمح بالكتابة)
    const renderNoteCell = (student: any) => {
        const isAbsent = student.total === null;
        const savedNote = student.notes || ""; 
        const currentTempNote = tempNotes[student.military_id];

        if (viewMode === "official" && isAbsent) {
            return (
                <div className="no-print">
                    <Input 
                        className="h-7 text-[10px] border-blue-200 bg-blue-50/50 font-bold" 
                        placeholder="اكتب ملاحظة..."
                        value={currentTempNote !== undefined ? currentTempNote : savedNote}
                        onChange={(e) => setTempNotes({...tempNotes, [student.military_id]: e.target.value})}
                    />
                </div>
            );
        }
        return <span className="text-[10px] text-slate-500">{savedNote || "-"}</span>;
    };

    const saveAbsenteeNotes = async () => {
    const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
    
    // 🔑 التعديل هنا: نأخذ كل الطلاب الحاليين ونضمن وجود حقل recorded_by لكل واحد منهم
    const updatedStudents = selectedRecord.students_data.map((s: any) => ({
        ...s,
        recorded_by: s.recorded_by || selectedRecord.creator_name || "النظام"
    }));

    // إضافة الطلاب الجدد (أصحاب الملاحظات) وختمهم باسم المشرف الحالي
    Object.entries(tempNotes).forEach(([milId, note]) => {
        const soldier = allSoldiersInBatch.find(sol => String(sol.military_id) === String(milId));
        if (soldier) {
            updatedStudents.push({ 
                ...soldier, 
                total: null, 
                notes: note,
                recorded_by: currentUser.name // خـتم المشرف
            });
        }
    });

    try {
        setLoading(true);
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/records/${selectedRecord.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify({ students_data: updatedStudents })
        });
        if (res.ok) {
            toast.success("تم تثبيت البيانات والملاحظات بنجاح");
            setTempNotes({});
            await fetchRecords();
        }
    } finally { setLoading(false); }
};

    const handleApprove = async (recordId: number, level: string) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/records/${recordId}/approve?level=${level}`, {
                method: "PATCH",
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
            });
            if (res.ok) {
                await fetchRecords();
                toast.success("تم إدراج التوقيع بنجاح");
            }
        } catch (e) { toast.error("خطأ في الاعتماد"); }
    };

const exportToExcel = () => {
    if (!selectedRecord || !availableRecords.length) return;

    try {
        const wb = XLSX.utils.book_new();
        const currentConfig = configs.find(c => c.id === selectedRecord.config_id);
        const isShooting = currentConfig?.subject === "shooting";

        const getShootingClass = (total: any) => {
            const score = Number(total);
            if (isNaN(score) || score === 0) return "-";
            if (score >= 90) return "هداف";
            if (score >= 80) return "درجة أولى";
            if (score >= 70) return "درجة ثانية";
            if (score >= 60) return "درجة ثالثة";
            return "راسب";
        };

        // 🟢 الدالة المساعدة المطورة: تأخذ البيانات جاهزة مع اسم المدخل لكل طالب
        const prepareSheetData = (studentsList: any[]) => {
            const criteria = new Set<string>();
            studentsList.forEach((s: any) => {
                if (s.scores) Object.keys(s.scores).forEach(k => criteria.add(k));
            });
            const sortedCrit = Array.from(criteria).sort();

            return studentsList.map((s: any, i: number) => {
                const isAbs = s.total === null || s.total === undefined;
                const row: any = {
                    "م": i + 1,
                    "الرتبة": s.rank || "-",
                    "الرقم العسكري": s.military_id,
                    "الاسم": s.name,
                    "السرية": s.company,
                    "الفصيل": s.platoon
                };

                sortedCrit.forEach(crit => {
                    row[crit] = s.scores?.[crit] ?? "-";
                });

                row["المجموع"] = isAbs ? "-" : s.total;
                if (isShooting) {
                    row["التصنيف"] = isAbs ? "-" : getShootingClass(s.total);
                }

                row["الملاحظات"] = s.notes || "";
                // 🟢 هنا السر: نستخدم اسم المدخل المرفق مع بيانات الطالب
                row["مدخل البيانات"] = isAbs ? "-" : (s.recordedBy || "-");

                return row;
            });
        };

        // 🔵 منطق اللجنة: تجميع كافة السجلات حسب الدور
        if (availableRecords.length > 1) {
            const rolesOrder = [
                { key: 'head', label: 'رئيس اللجنة' },
                { key: 'member1', label: 'عضو 1' },
                { key: 'member2', label: 'عضو 2' }
            ];

            rolesOrder.forEach(role => {
                // 🟢 تجميع كافة السجلات التي تحمل هذا الدور (من كافة الفصائل)
                const roleRecords = availableRecords.filter(r => r.examiner_role === role.key);
                
                if (roleRecords.length > 0) {
                    let combinedStudents: any[] = [];
                    
                    roleRecords.forEach(rec => {
                        let sData = [];
                        try {
                            sData = typeof rec.students_data === 'string' ? JSON.parse(rec.students_data) : rec.students_data;
                        } catch (e) { sData = rec.students_data || []; }
                        
                        // نرفق اسم المنشئ مع كل طالب في هذا السجل
                        const studentsWithRecorder = sData.map((s: any) => ({
                            ...s,
                            recordedBy: rec.creator_name
                        }));
                        combinedStudents = [...combinedStudents, ...studentsWithRecorder];
                    });

                    // إنشاء الشيت لهذا الدور
                    const sheetJson = prepareSheetData(combinedStudents);
                    const ws = XLSX.utils.json_to_sheet(sheetJson);
                    XLSX.utils.book_append_sheet(wb, ws, role.label);
                }
            });

            // 🔵 شيت النتيجة النهائية (المدمجة)
            const finalDataWithRecorder = finalReportData.map((s: any) => ({
                ...s,
                recordedBy: "دمج آلي للنظام"
            }));
            const summaryWs = XLSX.utils.json_to_sheet(prepareSheetData(finalDataWithRecorder));
            XLSX.utils.book_append_sheet(wb, summaryWs, "النتيجة النهائية");

        } else {
            // 🔵 منطق الرصد الفردي
            const rec = availableRecords[0];
            const finalDataWithRecorder = finalReportData.map((s: any) => ({
                ...s,
                recordedBy: rec.creator_name
            }));
            const sheetJson = prepareSheetData(finalDataWithRecorder);
            const ws = XLSX.utils.json_to_sheet(sheetJson);
            XLSX.utils.book_append_sheet(wb, ws, "نتائج الاختبار");
        }

        // 📁 حفظ الملف
        const safeTitle = selectedRecord.title.split(" - ")[0].replace(/[\\/:*?"<>|]/g, "_");
        const fileName = `اختبار_عملي_${safeTitle}_${selectedRecord.course}_${selectedRecord.batch}_${selectedRecord.exam_date}.xlsx`;
        
        XLSX.writeFile(wb, fileName);
        toast.success("تم التصدير بنجاح ✅");

    } catch (e) {
        console.error("Export Error:", e);
        toast.error("حدث خطأ أثناء التصدير");
    }
};
// 🟢 الدالة المفقودة التي تحل الخطأ 2304
    const detectRealType = (record: any) => {
        const shootingKeywords = ["رماية", "مسدس", "بندقية", "m16", "رشاش", "shooting"];
        const engagementKeywords = ["اشتباك", "دفاع عن النفس", "engagement"];
        const fitnessKeywords = ["لياقة", "بدنية", "fitness", "رياضة", "sports"];

        const title = (record.title || "").toLowerCase();
        const subject = (record.subject || "").toLowerCase();

        if (shootingKeywords.some(k => title.includes(k) || subject.includes(k))) return "shooting";
        if (engagementKeywords.some(k => title.includes(k) || subject.includes(k))) return "engagement";
        if (fitnessKeywords.some(k => title.includes(k) || subject.includes(k))) return "fitness";

        return "infantry"; // الافتراضي للمواد العسكرية الأخرى (مشاة، أسلحة..)
    };
const courseBatchGroups = useMemo(() => {
    // 🛡️ الحارس: جلب بيانات المستخدم والنطاق فوراً
    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("user") || "{}") : {};
    const scope = user?.extra_permissions?.scope;
    
    // إذا كان المستخدم مقيداً كلياً، نوقف المعالجة ونرجع مصفوفة فارغة فوراً
    if (user.role !== 'owner' && scope?.is_restricted && (!scope.courses || scope.courses.length === 0)) {
        return [];
    }

    const groups: Record<string, any> = {};
    
    records.forEach(r => {
        // 1. 🛡️ تطبيق نفس الفلاتر المستخدمة في العرض الداخلي لضمان تطابق الأرقام
        const config = configs.find(c => c.id === r.config_id);
        const realSubject = config ? config.subject : (r.subject || "infantry");
        
        // 🚫 استبعاد اختبارات الرياضة والاشتباك من العد (لأن هذا أرشيف عسكري)
        if (realSubject.includes("engagement") || 
            realSubject === "fitness" || 
            realSubject.includes("اشتباك") || 
            (r.title && r.title.includes("اشتباك"))) {
            return; 
        }

        // احترام فلاتر البحث العلوية (القسم والنوع)
        const realExamType = config ? config.exam_type : r.title.split(" - ")[0];
        const matchesSection = selectedSection === "all" || realSubject === selectedSection;
        const matchesExamType = selectedExamType === "all" || realExamType === selectedExamType;
        
        if (!matchesSection || !matchesExamType) return;

        // 2. تجميع المفاتيح
        const key = `${r.course}-${r.batch}`;
        
        if (!groups[key]) {
            groups[key] = {
                course: r.course,
                batch: r.batch,
                examsUniqueKeys: new Set(), 
            };
        }

        // 🟢 الاعتماد على (التاريخ + العنوان النظيف) لدمج لجان الاختبار الواحد
        const cleanTitle = r.title ? r.title.split("-")[0].trim() : "بدون عنوان";
        const testIdentifier = `${r.exam_date}_${cleanTitle}`;

        groups[key].examsUniqueKeys.add(testIdentifier);
    });

    return Object.values(groups).map((g: any) => ({
        ...g,
        examCount: g.examsUniqueKeys.size,
    })).filter(g => {
        const matchCourse = courseFilter === "all" || g.course === courseFilter;
        const matchBatch = batchFilter === "all" || g.batch === batchFilter;
        return matchCourse && matchBatch;
    });
}, [records, configs, selectedSection, selectedExamType, courseFilter, batchFilter]);
   // 1. ابحث عن هذا المتغير
const groupedRecords = useMemo(() => {
    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("user") || "{}") : {};
    const scope = user?.extra_permissions?.scope;
    
    // 🛡️ حماية: منع عرض السجلات الفردية إذا كان النطاق فارغاً
    if (user.role !== 'owner' && scope?.is_restricted && (!scope.courses || scope.courses.length === 0)) {
        return [];
    }

    // 🚨 شرط الحماية الأصلي الخاص بك
    if (!activeGroup) return [];

    const filtered = records.filter(r => {
        // 🟢 القيد الأول: الفلترة الصارمة حسب الدورة والدفعة المختارة من البطاقة
        const isSameGroup = r.course === activeGroup.course && r.batch === activeGroup.batch;
        if (!isSameGroup) return false;

        const config = configs.find(c => c.id === r.config_id);
        const realSubject = config ? config.subject : (r.subject || "infantry");
        const realExamType = config ? config.exam_type : r.title.split(" - ")[0];

        // استبعاد الرياضة والاشتباك
        if (realSubject.includes("engagement") || realSubject === "fitness") return false;

        // احترام فلاتر البحث والسكشن المختارة داخل المجموعة
        const matchesSection = selectedSection === "all" || realSubject === selectedSection;
        const matchesExamType = selectedExamType === "all" || realExamType === selectedExamType;
        const matchesSearch = r.title.includes(searchQuery);
        const matchesDate = !dateSearch || r.exam_date === dateSearch;

        return matchesSection && matchesExamType && matchesSearch && matchesDate;
    });

    const groups: Record<string, any> = {};
    filtered.forEach(r => {
        // المفتاح الفريد لدمج الفصائل والمقيمين في بطاقة واحدة شاملة
        const key = `${r.exam_date}-${r.config_id}-${r.course}-${r.batch}`;
        
        const currentStudentIds = Array.isArray(r.students_data) 
            ? r.students_data.map((s: any) => String(s.military_id)) 
            : [];

        if (!groups[key]) {
            groups[key] = { 
                ...r, 
                all_ids: [r.id],
                config_id: r.config_id,
                course: r.course,
                batch: r.batch,
                exam_date: r.exam_date,
                unique_students: new Set(currentStudentIds) 
            };
        } else {
            // تجميع معرفات السجلات (IDs) لتمكين الحذف الجماعي أو الفتح الجماعي
            if (!groups[key].all_ids.includes(r.id)) {
                groups[key].all_ids.push(r.id);
            }
            
            // تحديث حالة الاعتماد (إذا كان أحدهم معتمداً، البطاقة تظهر معتمدة)
            if (r.status === 'approved') groups[key].status = 'approved';
            
            // إضافة الطلاب للمجموعة الفريدة لضمان دقة العدد الإجمالي
            currentStudentIds.forEach((id: any) => groups[key].unique_students.add(id));
        }
    });

    // تحويل الكائن إلى مصفوفة وإرفاق العدد النهائي للطلاب
    return Object.values(groups).map((group: any) => ({
        ...group,
        total_count: group.unique_students.size
    }));
// 🟢 إضافة activeGroup لمصفوفة الاعتماديات لضمان التحديث عند الضغط على أي بطاقة دورة
}, [records, configs, selectedSection, selectedExamType, searchQuery, dateSearch, activeGroup]);
    const paginatedRecords = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return groupedRecords.slice(startIndex, startIndex + itemsPerPage);
    }, [groupedRecords, currentPage, itemsPerPage]);

   const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
        const deletePromises = deleteTarget.all_ids.map(async (id) => {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/records/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
            });
            
            // 🛡️ الجزء المضاف لقراءة رسالة الخطأ من السيرفر
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.detail || "فشل الحذف");
            }
            return res;
        });

        await Promise.all(deletePromises);
        toast.success("تم حذف السجل بنجاح");
        fetchRecords();
        setDeleteTarget(null);

    } catch (e: any) {
        // 📢 هنا ستظهر رسالة "لا يمكن حذف سجل معتمد..." في التوست
        toast.error(e.message || "حدث خطأ في الاتصال");
    }
};
const paginatedStudents = useMemo(() => {
    const start = (innerCurrentPage - 1) * innerItemsPerPage;
    return finalReportData.slice(start, start + innerItemsPerPage);
}, [finalReportData, innerCurrentPage, innerItemsPerPage]);
const saveTrainerScoresToDB = async () => {
    if (!selectedRecord || Object.keys(trainerScores).length === 0) return;

    // 1. تجهيز القائمة المحدثة بالدرجات
    const updatedStudentsData = selectedRecord.students_data.map((student: any) => {
        const milId = String(student.military_id);
        const newTrainerScore = trainerScores[milId];
        
        if (newTrainerScore !== undefined) {
            return {
                ...student,
                trainer_score: newTrainerScore, // حفظ الدرجة في الكائن
            };
        }
        return student;
    });

    try {
        setLoading(true);
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/records/${selectedRecord.id}`, {
            method: "PUT",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${localStorage.getItem("token")}` 
            },
            body: JSON.stringify({ students_data: updatedStudentsData })
        });

        if (res.ok) {
            toast.success("تم الحفظ بنجاح");
            
            // 🟢 التحديث الذكي للعرض الحالي:
            setSelectedRecord({
                ...selectedRecord,
                students_data: updatedStudentsData
            });

            setTrainerScores({}); // الآن يمكن تصفيرها ولن تختفي الدرجات لأنها أصبحت جزءاً من selectedRecord
            await fetchRecords(); // تحديث الأرشيف في الخلفية
        }
    } catch (e) {
        toast.error("خطأ في الاتصال");
    } finally {
        setLoading(false);
    }
};
    // --- بداية الجزء المصحح ---
    if (selectedRecord) {
        const dayName = format(new Date(selectedRecord.exam_date), "EEEE", { locale: ar });
        const currentConfig = configs.find(c => c.id === selectedRecord.config_id);
    const isShooting = currentConfig?.subject === "shooting";
    const totalShots = currentConfig?.total_shots || 0;

    // دالة التصنيف العسكري للرماية
    const getShootingClass = (score: number) => {
        if (score === null || score === undefined) return "";
        if (score >= 90) return "هداف";
        if (score >= 80) return "أولى";
        if (score >= 70) return "ثانية";
        if (score >= 60) return "ثالثة";
        return "راسب";
    };
   
        return (
<ProtectedRoute allowedRoles={["owner","manager","admin","military_officer","military_supervisor"]}>
            <div className="min-h-screen bg-white p-2 md:p-8 flex flex-col space-y-6 pb-10 md:pb-32 overflow-x-hidden relative" dir="rtl">
               <style jsx global>{`
    @media print {
        @page { size: A4 portrait; margin: 5mm; }
        body { zoom: 0.85; -webkit-print-color-adjust: exact; }
        .no-print { display: none !important; }
        table { width: 100% !important; border-collapse: collapse !important; }
        th { background-color: #c5b391 !important; color: black !important; }
        td, th { border: 1px solid black !important; padding: 4px !important; font-size: 11px !important; }
        
        /* 🔑 تعديل التوقيعات عند الطباعة */
        .signature-box { 
            background-color: transparent !important; 
            background: none !important; 
            border: none !important; 
            box-shadow: none !important;
            /* التحكم في ارتفاع المنطقة */
            height: 20px !important; 
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        }

        /* 🖋️ التحكم في ارتفاع صورة التوقيع نفسها */
        .signature-box img {
            height: 45px !important; /* غير هذا الرقم لزيادة أو تنقيص حجم التوقيع */
            width: auto !important;  /* للحفاظ على تناسق أبعاد التوقيع وعدم تمطيطه */
            max-width: 120px !important; /* لمنع التوقيع من الخروج عن حدود الخلية */
            object-fit: contain !important;
        }

        .force-print { display: table-row !important; }
    }
`}</style>

               {/* 🟢 شريط التحكم الموحد - مطابق تماماً لتخطيط صفحة الرياضة */}
<div className="flex flex-col gap-4 no-print bg-slate-50 p-3 md:p-4 rounded-xl shadow-sm border">
    
    {/* السطر العلوي: العودة + تبديل الوضع */}
    <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => {setSelectedRecord(null); setViewMode("field"); setTempNotes({}); setInnerCurrentPage(1);}} className="font-bold text-slate-600 h-9">
            <ArrowRight className="w-5 h-5 ml-2" /> العودة
        </Button>
        <div className="flex bg-white rounded-lg border p-1 shadow-inner">
            <Button variant={viewMode === "field" ? "default" : "ghost"} size="sm" onClick={()=>setViewMode("field")} className="text-[10px] h-7 font-bold">الرصد</Button>
            <Button variant={viewMode === "official" ? "default" : "ghost"} size="sm" onClick={()=>setViewMode("official")} className="text-[10px] h-7 font-bold gap-1">
                <ListFilter className="w-3 h-3"/> الكشف الرسمي
            </Button>
        </div>
    </div>
    
    {/* السطر السفلي: الفلاتر + (أزرار الأكشن) */}
    <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2">
        {/* فلتر السرية */}
        <div className="flex items-center gap-2 bg-white px-2 rounded-lg border h-10 shadow-sm">
            <Label className="text-[10px] font-bold whitespace-nowrap">السرية:</Label>
            <Select value={innerCompany} onValueChange={(v)=>{setInnerCompany(v); setInnerCurrentPage(1);}}>
                <SelectTrigger className="w-full md:w-24 h-7 border-none text-xs font-bold focus:ring-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {Array.from(new Set(selectedRecord?.students_data?.map((s:any)=>s.company))).filter(Boolean).map(c=><SelectItem key={c as string} value={c as string}>{c as string}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>

        {/* فلتر الفصيل */}
        <div className="flex items-center gap-2 bg-white px-2 rounded-lg border h-10 shadow-sm">
            <Label className="text-[10px] font-bold whitespace-nowrap">الفصيل:</Label>
            <Select value={innerPlatoon} onValueChange={(v)=>{setInnerPlatoon(v); setInnerCurrentPage(1);}}>
                <SelectTrigger className="w-full md:w-24 h-7 border-none text-xs font-bold focus:ring-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {Array.from(new Set(selectedRecord?.students_data?.map((s:any)=>s.platoon))).filter(Boolean).map(p=><SelectItem key={p as string} value={p as string}>{p as string}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>

        {/* 📱 مجموعة أزرار (حفظ، طباعة، Excel) - تظهر تحت الفلاتر في الهاتف ومحاذية لليسار في الحاسوب */}
        <div className="grid grid-cols-2 md:flex md:flex-wrap items-center gap-2 w-full md:w-auto">
            <Button 
        variant="outline"
        onClick={() => setShowTrainerScore(!showTrainerScore)}
        className={`h-10 px-3 text-[10px] font-bold border-2 transition-all ${showTrainerScore ? 'border-orange-500 text-orange-600 bg-orange-50' : 'border-slate-200'}`}
    >
        {showTrainerScore ? "إلغاء درجة المدرب" : "إضافة درجة المدرب"}
    </Button>

    {/* 🟢 زر استيراد الإكسل (يظهر فقط عند تفعيل وضع درجة المدرب) */}
    {showTrainerScore && (
        <div className="relative">
            <input
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                id="trainer-excel-upload"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                            const bstr = evt.target?.result;
                            const wb = XLSX.read(bstr, { type: 'binary' });
                            const wsname = wb.SheetNames[0];
                            const ws = wb.Sheets[wsname];
                            const data = XLSX.utils.sheet_to_json(ws);
                            
                            // تحويل البيانات لخريطة (Map) ليسهل البحث بالرقم العسكري
                            const scoresMap: Record<string, number> = {};
                            data.forEach((row: any) => {
                                const milId = String(row["الرقم العسكري"] || row["military_id"]);
                                const score = parseFloat(row["درجة المدرب"] || row["trainer_score"]);
                                if (milId && !isNaN(score)) scoresMap[milId] = score;
                            });
                            setTrainerScores(scoresMap);
                            toast.success(`تم استيراد درجات ${Object.keys(scoresMap).length} طالب`);
                        };
                        reader.readAsBinaryString(file);
                    }
                }}
            />
            <Button 
            asChild
            className="bg-orange-600 hover:bg-orange-700 h-10 px-3 text-[10px] font-bold text-white shadow-md cursor-pointer w-full"
        >
            <label htmlFor="trainer-excel-upload" className="flex items-center justify-center gap-1">
                <Download className="w-4 h-4" /> استيراد
            </label>
        </Button>

        {Object.keys(trainerScores).length > 0 && (
            <Button 
                onClick={saveTrainerScoresToDB} 
                disabled={loading}
                className="bg-blue-700 hover:bg-blue-800 h-10 px-3 text-[10px] gap-1 font-bold animate-pulse w-full"
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                حفظ 
            </Button>
        )}

    </div>
)}
            {/* زر حفظ التعديلات */}
            {viewMode === "official" && Object.keys(tempNotes).length > 0 && (
                <Button 
                    onClick={saveAbsenteeNotes} 
                    className="bg-blue-600 hover:bg-blue-700 h-10 px-2 text-[10px] gap-1 font-bold animate-pulse shadow-md flex-1 md:flex-none"
                >
                    <Save className="w-3.5 h-3.5" /> حفظ
                </Button>
            )}

            {/* زر الطباعة */}
            <Button 
                onClick={() => {
                    const originalTitle = document.title;
                    document.title = `اختبار_عملي_${selectedRecord.title.split(" - ")[0]}_${selectedRecord.course}_${selectedRecord.batch}_${selectedRecord.exam_date}`;
                    window.print();
                    document.title = originalTitle;
                }} 
                className="bg-slate-900 h-10 px-3 text-[10px] md:text-xs gap-1 font-bold shadow-md text-white flex-1 md:flex-none"
            >
                <Printer className="w-4 h-4" /> طباعة
            </Button>

            {/* زر Excel */}
            <Button 
                variant="outline" 
                onClick={exportToExcel} 
                className="text-green-700 border-green-600 h-10 px-3 text-[10px] md:text-xs bg-white font-bold shadow-sm flex-1 md:flex-none gap-1"
            >
                <Download className="w-4 h-4" /> Excel
            </Button>
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
                            <p className="text-xs underline font-bold">فرع التدريب العسكري</p>
                        </div>
                        <div className="text-left font-bold text-[10px] md:text-xs w-1/3 mt-1">
                            <p>اليوم: {dayName}</p>
                            <p>تاريخ الاختبار: {selectedRecord.exam_date}</p>
                        </div>
                    </div>
                    <h1 className="text-lg md:text-xl font-black py-4 underline underline-offset-8 uppercase leading-relaxed">
                        اختبار عملي: {selectedRecord.title.split(" - ")[0]} - دورة: {selectedRecord.course} / : {selectedRecord.batch}
                    </h1>
                </div>

                {/* الجدول */}
                <div className="border-2 border-transparent rounded-lg overflow-x-auto shadow-sm">
    <Table className="w-full">
                     <TableHeader className="bg-[#c5b391]">
    <TableRow className="border-b-2 border-black text-black">
        <TableHead className="text-center border-l border-black font-bold w-10">#</TableHead>
        <TableHead className="text-center border-l border-black font-bold w-24">الرتبة</TableHead>
        <TableHead className="text-center border-l border-black font-bold w-32">الرقم العسكري</TableHead>
        <TableHead className="text-right border-l border-black font-bold px-4">الاسم</TableHead>
        <TableHead className="text-center border-l border-black font-bold">السرية / الفصيل</TableHead>

        {/* 1️⃣ أولاً: استخراج ورسم أعمدة الأهداف ديناميكياً (تظهر فقط في الرماية) */}
        {isShooting && (() => {
            const targets = new Set<string>();
            selectedRecord.students_data.forEach((student: any) => {
                if (student.scores) Object.keys(student.scores).forEach(key => targets.add(key));
            });
            return Array.from(targets).sort().map(targetName => (
                <TableHead key={targetName} className="text-center border-l border-black font-bold bg-[#bfa87e] w-20">
                    {targetName}
                </TableHead>
            ));
        })()}

        {/* 🟢 أعمدة اللجنة: تظهر فقط إذا كان هناك أكثر من سجل واحد مرتبط (تعدد رصد) */}
        {availableRecords.length > 1 && (
            <>
                <TableHead className="text-center border-l border-black font-bold bg-[#bfa87e] w-20 px-1">عضو 1</TableHead>
                <TableHead className="text-center border-l border-black font-bold bg-[#bfa87e] w-20 px-1">عضو 2</TableHead>
                <TableHead className="text-center border-l border-black font-bold bg-[#bfa87e] w-20 px-1">رئيس اللجنة</TableHead>
            </>
        )}

        {/* 2️⃣ ثانياً: عمود النتيجة النهائية (يتبدل مسماه بين المتوسط والمجموع تلقائياً) */}
        <TableHead className="text-center border-l border-black font-black bg-[#b4a280] w-24">
            {availableRecords.length > 1 
                ? "المتوسط" 
                : (isShooting ? "النتيجة" : (showTrainerScore ? "المجموع (90%)" : "المجموع"))
            }
        </TableHead>

        {/* 3️⃣ ثالثاً: بقية أعمدة الرماية الثابتة (التصنيف ونسبة الإصابة) */}
        {isShooting && (
            <>
                <TableHead className="text-center border-l border-black font-bold w-24 bg-[#bfa87e]">التصنيف</TableHead>
                <TableHead className="text-center border-l border-black font-bold w-28 bg-[#bfa87e]">نسبة إصابة الهدف</TableHead>
            </>
        )}

        {/* عمود درجة المدرب - يظهر فقط عند الضغط على الزر */}
        {showTrainerScore && (
            <TableHead className="text-center border-l border-black font-black bg-[#d4c3a1] w-24 animate-in slide-in-from-right-2">
                درجة المدرب (10%)
            </TableHead>
        )}

        {/* إخفاء عمود التقدير في حال كان الاختبار رماية */}
        {!isShooting && (
            <TableHead className="text-center border-l border-black font-bold w-24">التقدير</TableHead>
        )}

        <TableHead className="text-right font-bold px-4">ملاحظات</TableHead>
    </TableRow>
</TableHeader>
                      <TableBody>
    {finalReportData.map((s: any, idx: number) => {
        const g = getGradeInfo(s.total, s.notes);
        const isAbsent = s.isAbsent; 
        const isVisibleOnScreen = idx >= (innerCurrentPage - 1) * innerItemsPerPage && idx < innerCurrentPage * innerItemsPerPage;
        
        return (
            <TableRow 
                key={`${s.military_id}-${viewMode}`} 
                className={`border-b border-black font-bold text-center h-10 hover:bg-slate-50 transition-colors 
                ${isVisibleOnScreen ? 'table-row' : 'hidden print:table-row force-print'}`}
            >
                <TableCell className="border-l border-black">{idx + 1}</TableCell>
                <TableCell className="border-l border-black">{s.rank}</TableCell>
                <TableCell className="border-l border-black font-mono">{s.military_id}</TableCell>
                <TableCell className="text-right border-l border-black px-4 whitespace-nowrap">{s.name}</TableCell>
                <TableCell className="border-l border-black text-[10px] font-bold">{s.company} / {s.platoon}</TableCell>

                {/* 1️⃣ أولاً: عرض درجات الأهداف (تظهر فقط في الرماية) */}
                {isShooting && (() => {
                    const targets = new Set<string>();
                    selectedRecord.students_data.forEach((student: any) => {
                        if (student.scores) Object.keys(student.scores).forEach(key => targets.add(key));
                    });
                    return Array.from(targets).sort().map(targetName => (
                        <TableCell key={targetName} className="border-l border-black bg-white/50 text-center">
                            {isAbsent ? "-" : (s.scores?.[targetName] || 0)}
                        </TableCell>
                    ));
                })()}

                {/* 🟢 خلايا درجات اللجنة: تظهر فقط إذا كان هناك أكثر من سجل واحد مرتبط */}
                {availableRecords.length > 1 && (
                    <>
                        <TableCell className="border-l border-black bg-slate-50/30 text-center text-blue-700">
                            {s.member1_score ?? "-"}
                        </TableCell>
                        <TableCell className="border-l border-black bg-slate-50/30 text-center text-blue-700">
                            {s.member2_score ?? "-"}
                        </TableCell>
                        <TableCell className="border-l border-black bg-red-50/20 text-center text-red-700">
                            {s.head_score ?? "-"}
                        </TableCell>
                    </>
                )}

                {/* 2️⃣ ثانياً: خلية النتيجة النهائية (المتوسط أو المجموع) */}
                <TableCell className="border-l border-black font-black text-lg bg-slate-100">
                    {isAbsent ? "-" : s.total}
                </TableCell>

                {/* 3️⃣ ثالثاً: بقية خلايا الرماية (التصنيف ونسبة الإصابة) */}
                {isShooting && (
                    <>
                        <TableCell className="border-l border-black text-blue-800 font-black bg-white">
                            {isAbsent ? "" : getShootingClass(s.total)}
                        </TableCell>

                        <TableCell className="border-l border-black font-mono font-bold text-orange-700 bg-white text-center">
                            {isAbsent ? "" : (() => {
                                const totalHits = Object.values(s.scores || {}).reduce((sum: number, val: any) => {
                                    return sum + (Number(val) || 0);
                                }, 0);
                                const accuracyPercentage = totalShots > 0 ? (totalHits / totalShots) * 100 : 0;
                                return `${accuracyPercentage.toFixed(0)}%`;
                            })()}
                        </TableCell>
                    </>
                )}

                {/* خلية درجة المدرب */}
                {showTrainerScore && (
                    <TableCell className="border-l border-black font-black text-lg text-blue-700 bg-orange-50/30">
                        {isAbsent ? "-" : (
                            trainerScores[String(s.military_id)] !== undefined 
                                ? trainerScores[String(s.military_id)] 
                                : (s.trainer_score || 0)
                        )}
                    </TableCell>
                )}

                {!isShooting && (
                    <TableCell className="border-l border-black">
                        {isAbsent ? "-" : g.result}
                    </TableCell>
                )}

                <TableCell className="text-right border-l border-black px-2 no-print min-w-[150px]">
                    {renderNoteCell(s)}
                </TableCell>

                <TableCell className="text-right px-2 hidden print:table-cell text-[10px]">
                    {tempNotes[s.military_id] || s.notes || (isAbsent ? "" : "-")}
                </TableCell>
            </TableRow>
        );
    })}
</TableBody>
                    </Table>
                </div>

                {/* شريط الترقيم الداخلي */}
                <div className="no-print flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border">
                    <div className="flex items-center gap-2">
                        <Label className="text-xs font-bold text-slate-500">عرض:</Label>
                        <Select value={String(innerItemsPerPage)} onValueChange={(v) => {setInnerItemsPerPage(Number(v)); setInnerCurrentPage(1);}}>
                            <SelectTrigger className="w-24 h-8 text-xs bg-white font-bold shadow-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10">10 طلاب</SelectItem>
                                <SelectItem value="20">20 طالب</SelectItem>
                                <SelectItem value="50">50 طالب</SelectItem>
                                <SelectItem value="100">100 طالب</SelectItem>
                                <SelectItem value="5000">الكل</SelectItem>
                            </SelectContent>
                        </Select>
                        <span className="text-[10px] text-slate-400 font-bold mr-2">إجمالي: {finalReportData.length}</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" disabled={innerCurrentPage === 1} onClick={() => setInnerCurrentPage(p => p - 1)} className="font-bold h-8 px-4 bg-white">
                            <ChevronRight className="w-4 h-4 ml-1" /> السابق
                        </Button>
                        <div className="text-xs font-black bg-white px-4 py-1 rounded-lg border shadow-inner text-blue-700">
                             صفحة {innerCurrentPage} من {Math.max(1, Math.ceil(finalReportData.length / innerItemsPerPage))}
                        </div>
                        <Button variant="outline" size="sm" disabled={innerCurrentPage >= Math.ceil(finalReportData.length / innerItemsPerPage)} onClick={() => setInnerCurrentPage(p => p + 1)} className="font-bold h-8 px-4 bg-white">
                            التالي <ChevronLeft className="w-4 h-4 mr-1" />
                        </Button>
                    </div>
                </div>

                {/* التوقيعات */}
                <div className="grid grid-cols-3 gap-8 pt-12 text-center border-t border-dashed mt-8">
                    {[
                        { label: "مشرف التدريب العسكري", key: "supervisor", role: "military_supervisor" },
                        { label: "ضابط التدريب العسكري", key: "officer", role: "military_officer" },
                        { label: "رئيس قسم التدريب العسكري والرياضي", key: "head", role: "manager" }
                    ].map((item) => {
                        const approval = selectedRecord.approvals?.[item.key];
                        return (
                            <div key={item.key} className="signature-box flex flex-col items-center gap-1 relative p-2 border rounded-xl border-transparent">
    {/* تم إزالة الحدود واللون لجعلها شفافة تماماً كما طلبت */}
    <span className="font-bold underline text-xs mb-2 text-slate-700">{item.label}</span>
                                {approval?.approved ? (
                                    <div className="space-y-1 w-full animate-in fade-in duration-500">
                                        <p className="font-black text-[14px] text-blue-900">{approval.rank} / {approval.name}</p>
                                        <div className="h-10 flex items-center justify-center mt-1">
                                            <img 
    src={`https://cynkoossuwenqxksbdhi.supabase.co/storage/v1/object/public/Signatures/${approval.mil_id}.png`} 
    className="h-full print:max-h-14 object-contain mix-blend-multiply" 
    onError={(e) => {
        const target = e.target as HTMLImageElement;
        if (target.src.includes('.png')) {
            target.src = target.src.replace('.png', '.jpg');
        } else if (target.src.includes('.jpg')) {
             target.src = target.src.replace('.jpg', '.jpeg');
        } else {
            target.style.display = 'none';
        }
    }} 
/>
                                        </div>
                                        {["owner", "admin", item.role].includes(userRole) && (
                                            <Button variant="ghost" size="sm" className="no-print text-red-500 absolute -top-1 -left-1" onClick={()=>handleApprove(selectedRecord.id, item.key)}><RotateCcw className="w-3 h-3"/></Button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 py-4">
                                        <div className="text-slate-300 italic text-[9px]">بانتظار الاعتماد...</div>
                                        {["owner", "admin", item.role].includes(userRole) && (
                                            <Button size="sm" variant="outline" className="no-print text-[10px] h-7 border-blue-500 font-bold hover:bg-blue-50" onClick={()=>handleApprove(selectedRecord.id, item.key)}>اعتماد السجل</Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
            </ProtectedRoute>
        );
    }

    // واجهة الأرشيف الرئيسية
    return (
<ProtectedRoute allowedRoles={["owner","manager","admin","military_officer","military_supervisor"]}>
        <div className="space-y-6 pb-10 md:pb-32 " dir="rtl">
             <div className="flex flex-col gap-4 px-2">
                <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                    <TableIcon className="w-6 h-6 text-[#c5b391]" /> أرشيف الاختبارات العملي
                </h1>
              {/* 🟢 شريط الفلاتر المجمع والمنظم في 3 سطور */}
<div className="flex flex-col gap-4 bg-slate-100 p-4 rounded-xl border no-print shadow-sm w-full mb-6" dir="rtl">
    
    {/* 1️⃣ السطر الأول: البحث + التاريخ + زر التحديث (3 أعمدة) */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* البحث بالعنوان */}
        <div className="relative">
            <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
            <Input 
                placeholder="بحث بالعنوان..." 
                className="h-10 pr-10 bg-white w-full shadow-sm font-bold" 
                value={searchQuery} 
                onChange={(e)=>setSearchQuery(e.target.value)} 
            />
        </div>

        {/* فلتر التاريخ */}
        <div className="relative"> 
            <Calendar className="absolute right-3 top-3 w-4 h-4 text-slate-400 z-10" />
            <Input 
                type="date" 
                className="h-10 pr-10 bg-white font-bold w-full shadow-sm appearance-none" 
                value={dateSearch} 
                onChange={(e)=>setDateSearch(e.target.value)} 
            />
        </div>

        {/* زر التحديث والمزامنة */}
        <Button 
            onClick={fetchRecords} 
            disabled={loading} 
            className="h-10 bg-blue-600 hover:bg-blue-700 text-white gap-2 font-bold shadow-md transition-all active:scale-95"
        >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> 
            تحديث البيانات
        </Button>
    </div>

    {/* 2️⃣ السطر الثاني: الدورة + الدفعة (عمودين) */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* فلتر الدورة */}
     <div className="space-y-1">
    <Select value={courseFilter} onValueChange={(v) => {setCourseFilter(v); setBatchFilter("all"); setCurrentPage(1);}}>
        <SelectTrigger className="h-10 bg-white font-bold border-slate-200">
            {/* 🟢 placeholder ذكي: إذا كان أونر والقائمة فارغة، يقول "لا توجد بيانات" وليس "لا تملك صلاحية" */}
            <SelectValue placeholder={
                loading ? "جاري التحميل..." : 
                (coursesList.length === 0 ? (userRole === 'owner' ? "لا توجد سجلات" : "لا تملك صلاحيات") : "-- اختر الدورة --")
            } />
        </SelectTrigger>
        <SelectContent dir="rtl">
            {coursesList.length > 0 ? (
                <>
                    <SelectItem value="all">كل الدورات</SelectItem>
                    {coursesList.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </>
            ) : (
                // 🟢 رسالة التنبيه داخل القائمة
                <SelectItem value="none" disabled className="text-slate-500 font-bold">
                    {userRole === 'owner' ? "لا توجد سجلات اختبارات حالياً" : "عفواً، لا تملك صلاحية عرض هذا النطاق"}
                </SelectItem>
            )}
        </SelectContent>
    </Select>
</div>

        {/* فلتر الدفعة */}
      <div className="space-y-1">
    <Select value={batchFilter} onValueChange={(v) => {setBatchFilter(v); setCurrentPage(1);}}>
        <SelectTrigger className="h-10 bg-white font-bold border-slate-200">
            <SelectValue placeholder={
                loading ? "جاري التحميل..." : 
                (batchesList.length === 0 ? (userRole === 'owner' ? "لا توجد دفعات" : "لا تملك صلاحيات") : "-- اختر الدفعة --")
            } />
        </SelectTrigger>
        <SelectContent dir="rtl">
            {batchesList.length > 0 ? (
                <>
                    <SelectItem value="all">كل الدفعات</SelectItem>
                    {batchesList.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </>
            ) : (
                <SelectItem value="none" disabled className="text-slate-500 font-bold">
                    {userRole === 'owner' ? "لا توجد دفعات مسجلة" : "نطاق الدفعات غير مسموح"}
                </SelectItem>
            )}
        </SelectContent>
    </Select>
</div>
    </div>

    {/* 3️⃣ السطر الثالث: القسم + النوع (عمودين - مخصص للعسكري) */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* فلتر القسم الرئيسي */}
        <Select value={selectedSection} onValueChange={(v) => {setSelectedSection(v); setSelectedExamType("all"); setCurrentPage(1);}}>
            <SelectTrigger className="h-10 bg-white border-blue-200 text-blue-800 font-bold shadow-sm">
                <SelectValue placeholder="القسم التدريبي" />
            </SelectTrigger>
            <SelectContent dir="rtl">
                <SelectItem value="all">كل الإختبارات العسكرية</SelectItem>
                {militarySections.map(s => <SelectItem key={s.id} value={s.key}>{s.name}</SelectItem>)}
            </SelectContent>
        </Select>

        {/* فلتر نوع الاختبار التفصيلي */}
        <Select value={selectedExamType} onValueChange={(v) => {setSelectedExamType(v); setCurrentPage(1);}} disabled={selectedSection === "all"}>
            <SelectTrigger className="h-10 bg-white border-blue-200 text-blue-800 font-bold shadow-sm">
                <SelectValue placeholder="نوع الاختبار" />
            </SelectTrigger>
            <SelectContent dir="rtl">
    <SelectItem value="all">كل الأنواع</SelectItem>
    {/* 🟢 عرض الأنواع الرسمية من جدول الـ Configs بناءً على القسم المختار */}
    {configs
        .filter(c => c.subject === selectedSection) // فلترة حسب القسم (رماية، أسلحة..)
        .map(c => (
            <SelectItem key={c.id} value={c.exam_type}>
                {c.exam_type}
            </SelectItem>
        ))
    }
</SelectContent>
        </Select>
    </div>
</div>
            </div>
<div className="mt-8">
    {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin w-10 h-10 text-[#c5b391]" /></div>
    ) : (
        <>
           {/* 1️⃣ حالة عرض المجموعات (الدورات) */}
{!activeGroup && (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in zoom-in-95">
        {courseBatchGroups.map((group: any) => (
            <Card 
                key={`${group.course}-${group.batch}`} 
                className="group cursor-pointer border-none hover:shadow-2xl transition-all duration-500 bg-white relative overflow-hidden h-[220px] flex flex-col shadow-md rounded-[2rem]"
                onClick={() => setActiveGroup(group)}
            >
                {/* 🎨 الخلفية الديكورية */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 group-hover:bg-blue-100 transition-colors duration-500" />
                
                <CardHeader className="relative z-10 pb-0">
                    <div className="flex justify-between items-start">
                        <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform duration-500">
                            <GraduationCap className="w-6 h-6" />
                        </div>

                        {/* 🟢 الإضافة المطلوبة: الجملة تحت أرشيف رسمي مباشرة */}
                        <div className="flex flex-col items-end gap-1">
                            <Badge variant="secondary" className="bg-slate-100 text-slate-500 font-bold border-none px-3 py-1 rounded-full text-[10px]">
                                أرشيف رسمي
                            </Badge>
                            {/* 👈 هنا يظهر الرقم الحقيقي (1) للاختبار المكون من لجنة */}
                            <span className="text-[10px] font-black text-blue-600 px-1">
                                عدد الاختبارات المسجلة ({group.examCount})
                            </span>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="relative z-10 flex-1 flex flex-col justify-center pt-4">
                    <h3 className="text-xl font-black text-slate-800 group-hover:text-blue-700 transition-colors line-clamp-1">
                        {group.course}
                    </h3>
                    <div className="flex items-center gap-2 mt-2 text-slate-500">
                        <Layers className="w-4 h-4 opacity-50" />
                        <span className="text-sm font-bold tracking-wide">{group.batch}</span>
                    </div>
                </CardContent>

                {/* 📊 تذييل البطاقة */}
                <div className="mt-auto bg-gradient-to-l from-blue-600 to-blue-500 p-4 flex justify-between items-center text-white">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold opacity-80 uppercase tracking-tighter">السجلات المحفوظة</span>
                        <div className="flex items-center gap-2">
                            <FileCheck className="w-4 h-4" />
                            <span className="text-lg font-black">{group.examCount} إختبار</span>
                        </div>
                    </div>
                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md group-hover:bg-white/40 transition-all">
                        <ArrowRight className="w-5 h-5 text-white" />
                    </div>
                </div>
            </Card>
        ))}
    </div>
)}

            {/* 2️⃣ حالة عرض الاختبارات داخل المجموعة المختارة */}
            {activeGroup && (
                <div className="space-y-6">
                    {/* زر العودة للمجموعات */}
                    <Button 
                        variant="outline" 
                        onClick={() => setActiveGroup(null)}
                        className="mb-4 gap-2 font-bold text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100"
                    >
                        <ChevronRight className="w-4 h-4" /> العودة لكافة الدورات
                    </Button>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-left-4">
                        {paginatedRecords.map((record: any) => (
                            <Card key={`${record.exam_date}-${record.config_id}`} className="cursor-pointer border-r-8 border-[#c5b391] hover:shadow-2xl transition-all group" onClick={() => handleCardClick(record)}>
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start flex-row-reverse mb-2">
                                        <Badge className={record.status === 'approved' ? "bg-green-600 text-white" : "bg-orange-50 text-orange-600 border border-orange-200"}>
                                            {record.status === 'approved' ? "مُعتمد" : "قيد المراجعة"}
                                        </Badge>
                                        <span className="text-[10px] font-black text-slate-400 bg-white px-2 py-1 rounded border shadow-sm">{record.exam_date}</span>
                                    </div>
                                    <CardTitle className="text-md font-bold leading-relaxed">اختبار: {record.title.split(" - ")[0]}</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4 border-t flex justify-between items-center flex-row-reverse bg-slate-50/30">
    <div className="flex items-center gap-3">
        {/* 🟢 هنا يظل إجمالي الطلاب ظاهراً لأنه خاص بهذا الاختبار تحديداً */}
        <span className="text-xs font-black text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            {record.total_count} طالب
        </span>
        <Eye className="w-4 h-4 text-slate-300 group-hover:text-blue-600" />
    </div>

    {/* زر الحذف يظهر للمسؤولين فقط */}
    {["owner", "admin", "manager"].includes(userRole) && (
        <Button 
            variant="ghost" 
            size="icon" 
            className="text-red-300 hover:text-red-600 transition-colors" 
            onClick={(e) => {
                e.stopPropagation(); 
                setDeleteTarget({id: record.id, title: record.title, all_ids: record.all_ids})
            }}
        >
            <Trash2 className="w-4 h-4" />
        </Button>
    )}
</CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </>
    )}
</div>
            {!loading && groupedRecords.length > 0 && (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-white border rounded-xl mt-8 shadow-sm no-print">
        {/* اختيار عدد العناصر في الصفحة */}
        <div className="flex items-center gap-2">
            <Label className="text-xs font-bold text-slate-500">عرض:</Label>
            <Select value={String(itemsPerPage)} onValueChange={(v) => {setItemsPerPage(Number(v)); setCurrentPage(1);}}>
                <SelectTrigger className="w-24 h-8 text-xs bg-white font-bold shadow-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="12">12 بطاقات</SelectItem>
                    <SelectItem value="24">24 بطاقة</SelectItem>
                    <SelectItem value="50">50 بطاقة</SelectItem>
                </SelectContent>
            </Select>
            <span className="text-[10px] text-slate-400 font-bold mr-2">إجمالي الاختبارات: {groupedRecords.length}</span>
        </div>

        {/* أزرار التنقل */}
        <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="font-bold h-8 px-4 bg-white shadow-sm">
                <ChevronRight className="w-4 h-4 ml-1" /> السابق
            </Button>
            <div className="text-xs font-black bg-slate-50 px-4 py-1 rounded-lg border text-blue-700">
                صفحة {currentPage} من {Math.max(1, Math.ceil(groupedRecords.length / itemsPerPage))}
            </div>
            <Button variant="outline" size="sm" disabled={currentPage >= Math.ceil(groupedRecords.length / itemsPerPage)} onClick={() => setCurrentPage(p => p + 1)} className="font-bold h-8 px-4 bg-white shadow-sm">
                التالي <ChevronLeft className="w-4 h-4 mr-1" />
            </Button>
        </div>
    </div>
)}

            <AlertDialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
                <AlertDialogContent dir="rtl" className="max-w-[400px] rounded-2xl border-2 border-slate-100 shadow-2xl">
                    <AlertDialogHeader className="items-center text-center space-y-4">
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-600 animate-pulse border border-red-100"><AlertTriangle className="w-8 h-8" /></div>
                        <AlertDialogTitle className="text-xl font-black text-slate-900">حذف نهائي</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-500 font-bold px-2 text-center leading-relaxed">
                            هل أنت متأكد من حذف سجل اختبار <span className="text-red-600 font-black">"{deleteTarget?.title}"</span>؟
                            <br/> سيتم مسح كافة البيانات المرتبطة بهذا الاختبار نهائياً.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row-reverse gap-3 mt-6">
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 text-white font-bold flex-1 h-11 rounded-xl shadow-lg hover:bg-red-700">حذف نهائياً</AlertDialogAction>
                        <AlertDialogCancel className="font-bold flex-1 h-11 rounded-xl border-slate-200 hover:bg-slate-50">إلغاء</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
       {/* 🟢 نافذة حل تعارض البيانات المكررة المحدثة بأيقونات الحذف */}
{/* 🟢 نافذة حل تضارب الأدوار للفصائل - نسخة منضبطة برمجياً */}
        <AlertDialog open={committeeDialog} onOpenChange={setCommitteeDialog}>
            <AlertDialogContent dir="rtl" className="max-w-xl rounded-2xl border-2 border-slate-100 shadow-2xl">
                <AlertDialogHeader className="items-center text-center">
                    <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center text-orange-600 mb-2 border border-orange-100">
                        <ShieldCheck className="w-8 h-8" />
                    </div>
                    <AlertDialogTitle className="text-xl font-black text-slate-900">إدارة تضارب أدوار اللجنة</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-500 font-bold px-2 text-center">
                        تم رصد تضارب في توزيع الأدوار لبعض الفصائل. يرجى تحديد (عضو 1 و 2) لكل فصيل أدناه.
                    </AlertDialogDescription>
                </AlertDialogHeader>

              <div className="max-h-[50vh] overflow-y-auto px-1 space-y-6 py-4">
    {pendingGroup?.conflictedGroups && Object.entries(pendingGroup.conflictedGroups).map(([pKey, recs]: [string, any]) => (
        <div key={pKey} className="p-4 border-2 border-orange-100 rounded-xl bg-orange-50/30 space-y-3">
            <h3 className="font-black text-orange-700 flex items-center gap-2 border-b border-orange-200 pb-2 text-sm">
                <div className="w-2 h-2 bg-orange-500 rounded-full" />
                السرية / الفصيل: {pKey}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. عضو لجنة (1) */}
                <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-500">عضو لجنة (1)</Label>
                    <Select value={committeeMapping[`${pKey}_member1`] || ""} onValueChange={(v) => setCommitteeMapping(prev => ({...prev, [`${pKey}_member1`]: v}))}>
                        <SelectTrigger className="h-9 bg-white font-bold text-[11px] border-blue-100"><SelectValue placeholder="اختر..." /></SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="none">--- تخطي ---</SelectItem>
                            {recs.map((r: any) => (
                                <SelectItem 
                                    key={r.id} 
                                    value={String(r.id)}
                                    // 🔒 يعطل إذا كان مختاراً كعضو 2 أو رئيس لنفس الفصيل
                                    disabled={committeeMapping[`${pKey}_member2`] === String(r.id) || committeeMapping[`${pKey}_head`] === String(r.id)}
                                >
                                    {r.creator_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* 2. عضو لجنة (2) */}
                <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-500">عضو لجنة (2)</Label>
                    <Select value={committeeMapping[`${pKey}_member2`] || ""} onValueChange={(v) => setCommitteeMapping(prev => ({...prev, [`${pKey}_member2`]: v}))}>
                        <SelectTrigger className="h-9 bg-white font-bold text-[11px] border-blue-100"><SelectValue placeholder="اختر..." /></SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="none">--- تخطي ---</SelectItem>
                            {recs.map((r: any) => (
                                <SelectItem 
                                    key={r.id} 
                                    value={String(r.id)}
                                    // 🔒 يعطل إذا كان مختاراً كعضو 1 أو رئيس لنفس الفصيل
                                    disabled={committeeMapping[`${pKey}_member1`] === String(r.id) || committeeMapping[`${pKey}_head`] === String(r.id)}
                                >
                                    {r.creator_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* 3. رئيس اللجنة */}
                <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-red-500">رئيس اللجنة</Label>
                    <Select value={committeeMapping[`${pKey}_head`] || ""} onValueChange={(v) => setCommitteeMapping(prev => ({...prev, [`${pKey}_head`]: v}))}>
                        <SelectTrigger className="h-9 bg-red-50/50 font-bold text-[11px] border-red-100 text-red-700"><SelectValue placeholder="اختر..." /></SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="none">--- تخطي ---</SelectItem>
                            {recs.map((r: any) => (
                                <SelectItem 
                                    key={r.id} 
                                    value={String(r.id)}
                                    // 🔒 يعطل إذا كان مختاراً كعضو 1 أو عضو 2 لنفس الفصيل
                                    disabled={committeeMapping[`${pKey}_member1`] === String(r.id) || committeeMapping[`${pKey}_member2`] === String(r.id)}
                                >
                                    {r.creator_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    ))}
</div>

                <AlertDialogFooter className="flex-row-reverse gap-3 p-4 bg-slate-50 rounded-b-2xl">
                    <Button 
                        className="bg-blue-600 text-white font-bold flex-1 h-11 shadow-lg hover:bg-blue-700 gap-2"
                        disabled={loading}
                       onClick={async () => {
    setLoading(true);
    try {
        // 1. تحديث قاعدة البيانات (الباك إند)
        for (const [key, recordId] of Object.entries(committeeMapping)) {
            if (recordId === "none") continue;
            const role = key.split('_')[1]; // استخراج الدور (member1, member2, head)
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/records/${recordId}/update-role?role=${role}`, {
                method: "PATCH",
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
            });
        }

        // 🟢 2. الابتكار الجديد: تحديث "ذاكرة المتصفح" لحظياً ليدعم تعدد الفصائل
        const updatedLocalRecords = availableRecords.map(rec => {
            const rid = String(rec.id);
            // نبحث في القاموس: هل هذا السجل تم تعيين دور جديد له؟
            // نحن نبحث عن القيمة (ID) داخل قاموس committeeMapping
            const foundEntry = Object.entries(committeeMapping).find(([mapKey, mapVal]) => mapVal === rid);
            
            if (foundEntry) {
                const newRole = foundEntry[0].split('_')[1]; // استخراج الدور الجديد
                return { ...rec, examiner_role: newRole };
            }
            return rec;
        });

        // 3. حقن البيانات المحدثة في الحالة (State) فوراً
        setAvailableRecords(updatedLocalRecords); 
        
        // 4. مزامنة الأرشيف العام في الخلفية (اختياري لضمان الدقة)
        await fetchRecords(); 
        
        // 5. فتح الجدول وإغلاق النافذة
        setSelectedRecord(pendingGroup);
        setCommitteeDialog(false);
        setCommitteeMapping({}); // تصفير الاختيارات
        
        toast.success("تم تحديث كافة الفصائل وظهور النتائج فوراً ✅");

    } catch (e) {
        console.error("Batch update error:", e);
        toast.error("حدث خطأ أثناء التحديث الجماعي");
    } finally {
        setLoading(false);
    }
}}
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "إعتماد وتصحيح الكل"}
                    </Button>
                    <AlertDialogCancel className="font-bold flex-1 h-11 rounded-xl" onClick={() => setCommitteeDialog(false)}>
                        إلغاء
                    </AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
</ProtectedRoute>
    );
}