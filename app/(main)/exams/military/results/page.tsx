"use client"

import { useState, useEffect, useMemo } from "react"
import { 
    Table as TableIcon, Search, Printer, Download, 
    Eye, ShieldCheck, CheckCircle2, X, Loader2, RotateCcw, 
    ArrowRight, Calendar, Trash2, ChevronRight, ChevronLeft, AlertTriangle, ListFilter, Save
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
  // 🟢 متغيرات لحل تنازع البيانات المكررة
const [conflictDialog, setConflictDialog] = useState(false);
const [conflicts, setConflicts] = useState<any[]>([]); // قائمة الطلاب المكررين
const [pendingRecord, setPendingRecord] = useState<any>(null); // السجل المؤقت قبل الاعتماد
const [resolvedStudents, setResolvedStudents] = useState<Map<string, any>>(new Map()); // الطلاب الذين تم دمجهم بنجاح
    const [deleteTarget, setDeleteTarget] = useState<{id: number, title: string, all_ids: number[]} | null>(null);

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

    const fetchRecords = async () => {
    setLoading(true); // 1. البدء في إظهار علامة التحميل
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/records`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        
        if (res.ok) {
            const rawData = await res.json();
            const processed = rawData.map((r: any) => ({
                ...r,
                students_data: typeof r.students_data === 'string' ? JSON.parse(r.students_data) : r.students_data,
                approvals: typeof r.approvals === 'string' ? JSON.parse(r.approvals) : r.approvals
            }));

            setRecords(processed);
            toast.success("تم تحديث البيانات  بنجاح"); // 2. تنبيه المستخدم بالنجاح

            // تحديث البيانات داخل السجل المفتوح (إن وجد) لضمان المزامنة
            if (selectedRecord) {
                const currentKey = `${selectedRecord.exam_date}-${selectedRecord.title}-${selectedRecord.course}-${selectedRecord.batch}`;
                const groups: Record<string, any> = {};
                
                processed.forEach((r: any) => {
                    const key = `${r.exam_date}-${r.title}-${r.course}-${r.batch}`;
                    if (!groups[key]) {
                        groups[key] = { ...r, all_ids: [r.id] };
                        groups[key].students_data = groups[key].students_data.map((s:any) => ({
                            ...s, 
                            recorded_by: s.recorded_by || r.creator_name || "النظام"
                        }));
                    } else {
                        const existingIds = groups[key].students_data.map((s: any) => String(s.military_id));
                        const newStudents = r.students_data
                            .filter((s: any) => !existingIds.includes(String(s.military_id)))
                            .map((s:any) => ({
                                ...s, 
                                recorded_by: s.recorded_by || r.creator_name || "النظام"
                            }));
                        groups[key].students_data = [...groups[key].students_data, ...newStudents];
                        groups[key].all_ids.push(r.id);
                    }
                });
                if (groups[currentKey]) setSelectedRecord(groups[currentKey]);
            }
        } else {
            toast.error("حدث خطأ أثناء جلب البيانات من السيرفر");
        }
    } catch (e) {
        console.error(e);
        toast.error("فشل الاتصال بالسيرفر، تحقق من الإنترنت");
    } finally {
        setLoading(false); // 3. 🔑 أهم خطوة: إيقاف الدوران وعلامة التحميل مهما كانت النتيجة
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
     // 🟢 دالة فتح البطاقة ودمج البيانات وكشف التكرار
  const handleCardClick = (group: any) => {
        const relatedRecords = records.filter(r => group.all_ids.includes(r.id));
        const mergedMap = new Map<string, any>();
        const foundConflicts: any[] = [];

        relatedRecords.forEach((record) => {
            const creatorName = record.creator_name || "غير معروف";
            const studentsList = Array.isArray(record.students_data) ? record.students_data : [];

            studentsList.forEach((student: any) => {
                const milId = String(student.military_id);
                const studentData = { 
                    ...student, 
                    recorded_by: student.recorded_by || creatorName, 
                    source_record_id: record.id 
                };

                if (mergedMap.has(milId)) {
                    const existing = mergedMap.get(milId);
                    // إذا كانت الدرجات مختلفة، نعتبره تضارب
                    if (String(existing.total) !== String(studentData.total)) {
                        foundConflicts.push({
                            student_name: student.name,
                            military_id: milId,
                            version_A: existing,
                            version_B: studentData
                        });
                    }
                } else {
                    mergedMap.set(milId, studentData);
                }
            });
        });

        if (foundConflicts.length > 0) {
            setResolvedStudents(mergedMap);
            setConflicts(foundConflicts);
            setPendingRecord(group);
            setConflictDialog(true);
        } else {
            setSelectedRecord({ ...group, students_data: Array.from(mergedMap.values()) });
        }
    };

 const resolveConflict = async (conflictIndex: number, selectedVersion: 'A' | 'B') => {
        const conflict = conflicts[conflictIndex];
        // النسخة التي ضغط المستخدم على زر حذفها (Destructive) هي الخاسرة
        const winner = selectedVersion === 'A' ? conflict.version_A : conflict.version_B;
        const loser = selectedVersion === 'A' ? conflict.version_B : conflict.version_A;

        // 1. تحديث الذاكرة المحلية فوراً لفتح الجدول للمستخدم دون تأخير
        const updatedMap = new Map(resolvedStudents);
        updatedMap.set(String(conflict.military_id), winner);
        setResolvedStudents(updatedMap);

        const nextConflicts = conflicts.filter((_, i) => i !== conflictIndex);
        setConflicts(nextConflicts);

        if (nextConflicts.length === 0) {
            setConflictDialog(false);
            setSelectedRecord({ ...pendingRecord, students_data: Array.from(updatedMap.values()) });
        }

        // 2. 🗑️ الحذف الفعلي من سوبابيز عبر الباك إند
        const loserRecordOrig = records.find(r => r.id === loser.source_record_id);
        
        if (loserRecordOrig) {
            try {
                // جلب القائمة الحالية والتأكد من أنها مصفوفة
                const currentList = Array.isArray(loserRecordOrig.students_data) 
                    ? loserRecordOrig.students_data 
                    : JSON.parse(loserRecordOrig.students_data || "[]");

                // 🟢 تعريف المتغير هنا يحل مشكلة الخطأ الذي ظهر لك
                const filteredList = currentList.filter(
                    (s: any) => String(s.military_id) !== String(conflict.military_id)
                );

                // إرسال التحديث للسيرفر
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/records/${loser.source_record_id}`, {
                    method: "PUT",
                    headers: { 
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${localStorage.getItem("token")}` 
                    },
                    body: JSON.stringify({ students_data: filteredList })
                });

                if (res.ok) {
                    // تحديث الحالة الكلية لضمان عدم ظهور التكرار مجدداً عند إعادة فتح البطاقة
                    setRecords(prev => prev.map(r => 
                        r.id === loser.source_record_id ? { ...r, students_data: filteredList } : r
                    ));
                    toast.success(`تم حذف نسخة ${loser.recorded_by} من قاعدة البيانات ✅`);
                } else {
                    console.error("Failed to delete from DB");
                }
            } catch (e) {
                console.error("Conflict Resolution Error:", e);
                toast.error("حدث خطأ أثناء محاولة تحديث قاعدة البيانات");
            }
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
        if (!selectedRecord) return [];
        const fieldData = selectedRecord.students_data;

        if (viewMode === "field") {
            return fieldData.filter((s: any) => {
                const matchCo = innerCompany === "all" || s.company === innerCompany;
                const matchPl = innerPlatoon === "all" || s.platoon === innerPlatoon;
                return matchCo && matchPl;
            });
        }

        const testedPlatoonKeys = Array.from(new Set(fieldData.map((s: any) => `${s.company}-${s.platoon}`)));

        return allSoldiersInBatch.filter((s: any) => 
            testedPlatoonKeys.includes(`${s.company}-${s.platoon}`)
        ).map((soldier: any) => {
            const match = fieldData.find((r: any) => String(r.military_id) === String(soldier.military_id));
            if (match) return match;
            return {
                ...soldier, total: null,
                notes: tempNotes[soldier.military_id] || soldier.notes || "",
                isAbsent: true
            };
        }).filter((s: any) => {
            const matchCo = innerCompany === "all" || s.company === innerCompany;
            const matchPl = innerPlatoon === "all" || s.platoon === innerPlatoon;
            return matchCo && matchPl;
        });
    }, [selectedRecord, viewMode, allSoldiersInBatch, innerCompany, innerPlatoon, tempNotes]);

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
    if (!selectedRecord || !finalReportData.length) return;

    try {
        const wb = XLSX.utils.book_new();
        
        // استخراج جميع أسماء المعايير المحتملة من جميع الطلاب لضمان شمولية الأعمدة
        // (لأن بعض الطلاب قد يكون لديهم معايير مختلفة أو ناقصة)
        const allPossibleCriteria = new Set<string>();
        finalReportData.forEach((s: any) => {
            if (s.scores && typeof s.scores === 'object') {
                Object.keys(s.scores).forEach(key => allPossibleCriteria.add(key));
            }
        });
        const sortedCriteria = Array.from(allPossibleCriteria).sort();

        // بناء البيانات
        const dataForExcel = finalReportData.map((s: any, i: number) => {
            // 1. البيانات الأساسية
            const row: any = {
                "م": i + 1,
                "الرتبة": s.rank || "-",
                "الرقم العسكري": s.military_id,
                "الاسم": s.name,
                "السرية": s.company,
                "الفصيل": s.platoon
            };

            // 2. الأعمدة الديناميكية (المعايير)
            // نمر على كل المعايير المكتشفة ونضع درجة الطالب أو صفر/-
            sortedCriteria.forEach(critName => {
                let scoreVal = "-";
                if (s.scores && s.scores[critName] !== undefined) {
                    scoreVal = s.scores[critName];
                }
                row[critName] = scoreVal;
            });

            // 3. النتائج النهائية
            const isAbsent = s.total === null || s.total === undefined;
            row["المجموع"] = isAbsent ? "-" : s.total;
            row["التقدير"] = isAbsent ? "-" : getGradeInfo(s.total, s.notes).result;
            row["الملاحظات"] = s.notes || "";

            // 4. مدخل البيانات (في وضع الرصد فقط)
            row["مدخل البيانات"] = s.recorded_by || "";

            return row;
        });

        // إنشاء الشيت والحفظ
        const ws = XLSX.utils.json_to_sheet(dataForExcel);
        XLSX.utils.book_append_sheet(wb, ws, "النتائج");

        const safeTitle = selectedRecord.title.split(" - ")[0].replace(/[\\/:*?"<>|]/g, "_");
        const fileName = `اختبار_عملي_${safeTitle}_${selectedRecord.course}_${selectedRecord.batch}_${selectedRecord.exam_date}.xlsx`;
        
        XLSX.writeFile(wb, fileName);
        toast.success("تم التصدير بنجاح");
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
   // 1. ابحث عن هذا المتغير
const groupedRecords = useMemo(() => {
    const filtered = records.filter(r => {
        // 🎯 البحث عن "هوية" الاختبار في جدول المعايير المرجعي
        const config = configs.find(c => c.id === r.config_id);
        
        // إذا لم نجد الإعداد (ربما حُذف)، نحاول التكهن بالعنوان كخيار احتياطي أخير جداً
        const realSubject = config ? config.subject : (r.subject || "infantry");
        const realExamType = config ? config.exam_type : r.title.split(" - ")[0];

        // 🛡️ شرط الحماية: استبعاد اللياقة والاشتباك (المصنفة في السيستم كـ engagement)
        if (realSubject.includes("engagement") || realSubject === "fitness") return false;

        // 1. المطابقة مع القسم المختار (shooting, infantry, weapons, student_teacher)
        const matchesSection = selectedSection === "all" || realSubject === selectedSection;
        
        // 2. المطابقة مع نوع الاختبار (الاسم الرسمي المبرمج في الـ Config)
        const matchesExamType = selectedExamType === "all" || realExamType === selectedExamType;

        // 3. بقية الفلاتر العادية
        const matchesSearch = r.title.includes(searchQuery);
        const matchesDate = !dateSearch || r.exam_date === dateSearch;
        const matchesCourse = courseFilter === "all" || r.course === courseFilter;
        const matchesBatch = batchFilter === "all" || r.batch === batchFilter;

        return matchesSection && matchesExamType && matchesSearch && matchesDate && matchesCourse && matchesBatch;
    });

    // منطق التجميع (Groups) مع حساب العدد الحقيقي للطلاب
    const groups: Record<string, any> = {};
    filtered.forEach(r => {
        const key = `${r.exam_date}-${r.title}-${r.course}-${r.batch}`;
        
        // جلب أرقام الطلاب في السجل الحالي
        const currentStudentIds = Array.isArray(r.students_data) 
            ? r.students_data.map((s: any) => String(s.military_id)) 
            : [];

        if (!groups[key]) {
            groups[key] = { 
                ...r, 
                all_ids: [r.id],
                // 🟢 ننشئ Set لتخزين الأرقام العسكرية الفريدة لضمان عدم التكرار
                unique_students: new Set(currentStudentIds) 
            };
        } else {
            groups[key].all_ids.push(r.id);
            if (r.status === 'approved') groups[key].status = 'approved';
            
            // 🟢 إضافة طلاب السجل المدمج للـ Set
           currentStudentIds.forEach((id: any) => groups[key].unique_students.add(id));
        }
    });

    // تحويل الكائن إلى مصفوفة وإضافة حقل total_count النهائي
    return Object.values(groups).map((group: any) => ({
        ...group,
        total_count: group.unique_students.size // ✅ هذا هو الرقم الذي ستستخدمه في البطاقة
    }));
}, [records, configs, selectedSection, selectedExamType, searchQuery, dateSearch, courseFilter, batchFilter]);

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
                    {Array.from(new Set(selectedRecord.students_data.map((s:any)=>s.company))).filter(Boolean).map(c=><SelectItem key={c as string} value={c as string}>{c as string}</SelectItem>)}
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
                    {Array.from(new Set(selectedRecord.students_data.map((s:any)=>s.platoon))).filter(Boolean).map(p=><SelectItem key={p as string} value={p as string}>{p as string}</SelectItem>)}
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
                        اختبار عملي: {selectedRecord.title.split(" - ")[0]} - دورة: {selectedRecord.course} / دفعة: {selectedRecord.batch}
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

        {/* 2️⃣ ثانياً: عمود النتيجة/المجموع - تم نقله ليصبح بعد الأهداف مباشرة */}
        <TableHead className="text-center border-l border-black font-black bg-[#b4a280] w-24">
            {isShooting ? "النتيجة" : (showTrainerScore ? "المجموع (90%)" : "المجموع")}
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
                                const isAbsent = isStudentAbsent(s);
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

    {/* 1️⃣ أولاً: عرض درجات الأهداف بشكل ديناميكي (تظهر فقط في الرماية) */}
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

    {/* 2️⃣ ثانياً: خلية النتيجة (المجموع) - تم نقلها لتصبح بعد الأهداف مباشرة */}
    <TableCell className="border-l border-black font-black text-lg bg-slate-50">
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

    {/* خلية درجة المدرب - تجلب القيمة من ملف الإكسل المستورد */}
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
                    <SelectValue placeholder="-- اختر الدورة --" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                    <SelectItem value="all">كل الدورات</SelectItem>
                    {coursesList.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>

        {/* فلتر الدفعة */}
        <div className="space-y-1">
            <Select value={batchFilter} onValueChange={(v) => {setBatchFilter(v); setCurrentPage(1);}}>
                <SelectTrigger className="h-10 bg-white font-bold border-slate-200">
                    <SelectValue placeholder="-- اختر الدفعة --" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                    <SelectItem value="all">كل الدفعات</SelectItem>
                    {batchesList.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
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
                    {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin w-10 h-10 text-[#c5b391]" /></div> : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" dir="rtl">
                            {paginatedRecords.map((record: any) => (
                                <Card key={`${record.exam_date}-${record.title}-${record.course}-${record.batch}`} className="cursor-pointer border-r-8 border-[#c5b391] hover:shadow-2xl transition-all group relative overflow-hidden" onClick={() => handleCardClick(record)}>
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start flex-row-reverse mb-2">
                                            <Badge className={record.status === 'approved' ? "bg-green-600 text-white shadow-sm" : "bg-orange-50 text-orange-600 border border-orange-200"}>
                                                {record.status === 'approved' ? "مُعتمد" : "قيد المراجعة"}
                                            </Badge>
                                            <span className="text-[10px] font-black text-slate-400 bg-white px-2 py-1 rounded border shadow-sm">{record.exam_date}</span>
                                        </div>
                                        <CardTitle className="text-md font-bold leading-relaxed">اختبار: {record.title.split(" - ")[0]}</CardTitle>
                                        <p className="text-[10px] text-slate-500 font-bold mt-1">{record.course} - {record.batch}</p>
                                    </CardHeader>
                                    <CardContent className="pt-4 border-t flex justify-between items-center flex-row-reverse bg-slate-50/30">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-black text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">{record.total_count} طالب</span>
                                            <Eye className="w-4 h-4 text-slate-300 group-hover:text-blue-600" />
                                        </div>
                                        {["owner", "admin", "manager"].includes(userRole) && (
                                            <Button variant="ghost" size="icon" className="text-red-300 hover:text-red-600 h-8 w-8 hover:bg-red-50 transition-colors" onClick={(e)=>{e.stopPropagation(); setDeleteTarget({id: record.id, title: record.title, all_ids: record.all_ids})}}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
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
<AlertDialog open={conflictDialog}>
    <AlertDialogContent dir="rtl" className="max-w-2xl">
        <AlertDialogHeader className="border-b pb-4">
            <AlertDialogTitle className="text-red-600 flex items-center gap-2 text-xl font-black">
                <AlertTriangle className="w-6 h-6" /> تنبيه: تكرار في رصد الدرجات
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 font-bold">
                يوجد درجتان مختلفتان لنفس الطالب. اختر النسخة التي تريد **حذفها نهائياً** من قاعدة البيانات.
            </AlertDialogDescription>
        </AlertDialogHeader>

        {conflicts.length > 0 && (
            <div className="space-y-6 mt-6">
                <div className="text-center bg-slate-100 p-3 rounded-lg border border-dashed border-slate-300">
                    <p className="text-lg font-black text-slate-800">{conflicts[0].student_name}</p>
                    <p className="text-sm font-mono text-blue-600 font-bold">{conflicts[0].military_id}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* النسخة A */}
                    <div className="group relative border-2 border-slate-200 p-5 rounded-2xl bg-white hover:border-red-400 transition-all shadow-sm">
                        <Badge className="absolute -top-3 right-4 bg-blue-600">الرصد الأول</Badge>
                        <p className="text-xs text-slate-400 mb-1">الراصد: {conflicts[0].version_A.recorded_by}</p>
                        <div className="text-4xl font-black text-slate-700 my-2">{conflicts[0].version_A.total}</div>
                        
                        <Button 
                            variant="destructive" 
                            className="w-full mt-4 gap-2 font-bold shadow-md active:scale-95 transition-transform"
                            onClick={() => resolveConflict(0, 'B')} // يعني سنعتمد B ونحذف A
                        >
                            <Trash2 className="w-4 h-4" /> حذف هذه النسخة
                        </Button>
                    </div>

                    {/* النسخة B */}
                    <div className="group relative border-2 border-slate-200 p-5 rounded-2xl bg-white hover:border-red-400 transition-all shadow-sm">
                        <Badge className="absolute -top-3 right-4 bg-orange-600">الرصد الثاني</Badge>
                        <p className="text-xs text-slate-400 mb-1">الراصد: {conflicts[0].version_B.recorded_by}</p>
                        <div className="text-4xl font-black text-slate-700 my-2">{conflicts[0].version_B.total}</div>

                        <Button 
                            variant="destructive" 
                            className="w-full mt-4 gap-2 font-bold shadow-md active:scale-95 transition-transform"
                            onClick={() => resolveConflict(0, 'A')} // يعني سنعتمد A ونحذف B
                        >
                            <Trash2 className="w-4 h-4" /> حذف هذه النسخة
                        </Button>
                    </div>
                </div>
                
                <p className="text-center text-[10px] text-slate-400 italic">
                    * المتبقي للمعالجة: {conflicts.length} طالب
                </p>
            </div>
        )}
    </AlertDialogContent>
</AlertDialog>
        </div>

       </ProtectedRoute> 
    );
}