"use client"

import { useState, useEffect, useMemo } from "react"
import { 
    Table as TableIcon, Search, Printer, Download, 
    Eye, ShieldCheck, CheckCircle2, X, Loader2, RotateCcw, 
    ArrowRight, Calendar, Trash2, ChevronRight, ChevronLeft, 
    AlertTriangle, ListFilter, Save, Swords, Activity, UserCheck, FileWarning
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

export default function FitnessRecordsPage() {
    const [activeTab, setActiveTab] = useState("engagement")
    const [selectedGroup, setSelectedGroup] = useState<any>(null)
    const [userRole, setUserRole] = useState<string>("")
    const [records, setRecords] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [dateSearch, setDateSearch] = useState("")
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [mainPage, setMainPage] = useState(1)
    const [mainItemsPerPage, setMainItemsPerPage] = useState(10)
    const [filterCourse, setFilterCourse] = useState("all")
    const [filterBatch, setFilterBatch] = useState("all")
    const [viewMode, setViewMode] = useState<"field" | "official">("field");
    const [allSoldiersInBatch, setAllSoldiersInBatch] = useState<any[]>([]);
    const [tempNotes, setTempNotes] = useState<Record<string, string>>({});

    const [innerCurrentPage, setInnerCurrentPage] = useState(1);
    const [innerItemsPerPage, setInnerItemsPerPage] = useState(20);
    const [showTrainerColumn, setShowTrainerColumn] = useState(true);
    const [innerCompany, setInnerCompany] = useState("all")
    const [innerPlatoon, setInnerPlatoon] = useState("all")
    const [customExamType, setCustomExamType] = useState("") 
    const [deleteTarget, setDeleteTarget] = useState<{id: number, title: string, all_ids: number[]} | null>(null);
    const [trainerScores, setTrainerScores] = useState<Record<string, number>>({});
    const [printDestination, setPrintDestination] = useState<"sports" | "control">("sports");

   useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}")
    setUserRole(user.role || "")
    
    // جلب البيانات عند التحميل الأول
    fetchRecords();

    // 🟢 إضافة مستمع لحدث "التركيز" على الصفحة
    const handleFocus = () => {
        console.log("تمت العودة للصفحة، جاري تحديث البيانات...");
        fetchRecords();
    };

    window.addEventListener('focus', handleFocus);

    // تنظيف المستمع عند الخروج من الصفحة لضمان الأداء
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
                const processed = rawData.map((r: any) => ({
                    ...r,
                    students_data: typeof r.students_data === 'string' ? JSON.parse(r.students_data) : r.students_data,
                    approvals: typeof r.approvals === 'string' ? JSON.parse(r.approvals) : r.approvals
                }));
                setRecords(processed);
                
            }
        } catch (e) { toast.error("فشل الاتصال"); } finally { setLoading(false); }
    };
const uniqueCourses = useMemo(() => [...new Set(records.map(r => r.course))].filter(Boolean), [records]);
    const uniqueBatches = useMemo(() => [...new Set(records.map(r => r.batch))].filter(Boolean), [records]);

    // 🟢 3. تعديل تصفية البطاقات (تعديل groupedRecords)
    const filteredGroupedRecords = useMemo(() => {
        const filtered = records.filter(r => {
            const titleLower = r.title.toLowerCase();
            const subject = r.subject || "";
            const isEngagement = titleLower.includes("اشتباك") || subject.startsWith("engagement_");
            const isMilitary = ["اشتباك", "رماية", "مسدس", "بندقية", "مشاة", "تلميذ"].some(k => titleLower.includes(k)) || subject.startsWith("engagement_");
            const isFitness = !isMilitary; 

            let matchesTab = activeTab === "fitness" ? isFitness : isEngagement;
            
            // إضافة شروط الفرز الجديدة
            const matchesCourse = filterCourse === "all" || r.course === filterCourse;
            const matchesBatch = filterBatch === "all" || r.batch === filterBatch;
            const matchesSearch = !searchQuery || r.title.includes(searchQuery);
            const matchesDate = !dateSearch || r.exam_date === dateSearch;

            return matchesTab && matchesCourse && matchesBatch && matchesSearch && matchesDate;
        });

        const groups: Record<string, any> = {};
        filtered.forEach(r => {
            const sData = Array.isArray(r.students_data) ? r.students_data : [];
            const axesFingerprint = sData[0]?.axes_fingerprint || `legacy-${r.config_id}`;
            const groupKey = activeTab === "fitness" 
                ? `${r.exam_date}-${r.course}-${r.batch}-${r.title}`
                : `${r.exam_date}-${r.course}-${r.batch}-${axesFingerprint}`;

            if (!groups[groupKey]) {
                groups[groupKey] = { 
                    key: groupKey, title: activeTab === "fitness" ? r.title : "اختبار اشتباك", 
                    exam_date: r.exam_date, course: r.course, batch: r.batch, 
                    sub_records: [r], status: r.status, type: activeTab 
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
    }, [records, searchQuery, dateSearch, activeTab, filterCourse, filterBatch]);

    // 🟢 4. منطق الترقيم للبطاقات (Pagination for Cards)
    const paginatedCards = useMemo(() => {
        const start = (mainPage - 1) * mainItemsPerPage;
        return filteredGroupedRecords.slice(start, start + mainItemsPerPage);
    }, [filteredGroupedRecords, mainPage, mainItemsPerPage]);

    const totalMainPages = Math.ceil(filteredGroupedRecords.length / mainItemsPerPage);
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

    const groupedRecords = useMemo(() => {
        const filtered = records.filter(r => {
            const titleLower = r.title.toLowerCase();
            const subject = r.subject || "";
            const isEngagement = titleLower.includes("اشتباك") || subject.startsWith("engagement_");
            const militaryKeywords = ["اشتباك", "رماية", "مسدس", "بندقية", "مشاة", "تلميذ"];
            const isMilitary = militaryKeywords.some(k => titleLower.includes(k)) || subject.startsWith("engagement_");
            const isFitness = !isMilitary; 

            let matchesTab = false;
            if (activeTab === "fitness") {
                matchesTab = isFitness;
            } else {
                matchesTab = isEngagement;
            }

            return matchesTab && (!searchQuery || r.title.includes(searchQuery)) && (!dateSearch || r.exam_date === dateSearch);
        });

        const groups: Record<string, any> = {};
        filtered.forEach(r => {
            const sData = Array.isArray(r.students_data) ? r.students_data : [];
            const axesFingerprint = sData[0]?.axes_fingerprint || `legacy-${r.config_id}`;
            const groupKey = activeTab === "fitness" 
                ? `${r.exam_date}-${r.course}-${r.batch}-${r.title}`
                : `${r.exam_date}-${r.course}-${r.batch}-${axesFingerprint}`;

            if (!groups[groupKey]) {
                groups[groupKey] = { 
                    key: groupKey, title: activeTab === "fitness" ? r.title : "اختبار اشتباك", 
                    exam_date: r.exam_date, course: r.course, batch: r.batch, 
                    sub_records: [r], status: r.status, type: activeTab 
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
    }, [records, searchQuery, dateSearch, activeTab]);

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
                const id = s.military_id;
                
                // تهيئة سجل الطالب في الذاكرة المؤقتة
                if (!allStudentsMap[id]) {
                    allStudentsMap[id] = { 
                        ...s, // نسخ كل بيانات الطالب الأصلية
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

    if (selectedGroup.type === "fitness") {
        const rawData = selectedGroup.sub_records[0]?.students_data || [];
        const dataArray = Array.isArray(rawData) ? rawData : [];
        return dataArray.filter((s: any) => {
            const sCo = s["السرية"] || s.company || "";
            const sPl = s["الفصيل"] || s.platoon || "";
            const matchCo = innerCompany === "all" || sCo === innerCompany;
            const matchPl = innerPlatoon === "all" || sPl === innerPlatoon;
            return matchCo && matchPl;
        });
    }

    const fieldData = processedGroupData.students; 
    if (viewMode === "field") {
        return fieldData.filter((s: any) => {
            const matchCo = innerCompany === "all" || s.company === innerCompany;
            const matchPl = innerPlatoon === "all" || s.platoon === innerPlatoon;
            return matchCo && matchPl;
        });
    }

    const targetGroups = new Set(fieldData.map((s: any) => `${s.company}-${s.platoon}`));
    return allSoldiersInBatch
        .filter((soldier: any) => {
            const soldierGroupKey = `${soldier.company}-${soldier.platoon}`;
            return targetGroups.has(soldierGroupKey);
        })
        .map((soldier: any) => {
            const match = fieldData.find((r: any) => String(r.military_id) === String(soldier.military_id));
            if (match) return match;
            return { ...soldier, total_final: null, is_absent: true, notes: tempNotes[soldier.military_id] || "" };
        })
        .filter((s: any) => {
            const matchCo = innerCompany === "all" || s.company === innerCompany;
            const matchPl = innerPlatoon === "all" || s.platoon === innerPlatoon;
            return matchCo && matchPl;
        });
    }, [selectedGroup, viewMode, allSoldiersInBatch, innerCompany, innerPlatoon, tempNotes, processedGroupData.students]);

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
                            "المقيم": evaluator.by || `مقيم ${idx + 1}`
                        };

                        let snap = evaluator.exam_snapshot || evaluator.snapshot;
                        if (typeof snap === 'string') { try { snap = JSON.parse(snap); } catch { snap = null; } }

                        let configsList = [];
                        if (Array.isArray(snap)) configsList = snap;
                        else if (snap && typeof snap === 'object') configsList = [snap];

                        configsList.forEach((config: any) => {
                            if (config.axes && Array.isArray(config.axes)) {
                                config.axes.forEach((axis: any) => {
                                    if (axis.criteria && Array.isArray(axis.criteria)) {
                                        axis.criteria.forEach((crit: any) => {
                                            const colName = `${axis.title || axis.name} - ${crit.name}`;
                                            const val = crit.score;
                                            if (val !== undefined && val !== null) detailRow[colName] = val;
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

    return (
        <ProtectedRoute allowedRoles={["owner","manager","admin","assistant_admin","sports_officer","sports_supervisor"]}>
            <div className="space-y-6" dir="rtl">
                {/* 🟢 الستايل الديناميكي للطباعة */}
                <style jsx global>{`
                    @media print {
                        @page { 
                            size: A4 ${selectedGroup?.type === 'fitness' ? 'landscape' : 'portrait'}; 
                            margin: 5mm; 
                        }
                        body { zoom: 0.85; -webkit-print-color-adjust: exact; }
                        .no-print { display: none !important; }
                        .archive-view { display: none !important; } 
                        .print-no-result { display: none !important; }
                        table { width: 100% !important; border-collapse: collapse !important; }
                        th { background-color: #c5b391 !important; color: black !important; border: 1px solid black !important; }
                        td { border: 1px solid black !important; padding: 4px !important; font-size: 11px !important; }
                        .signature-print-force { height: 40px !important; width: auto !important; display: block !important; margin: 0 auto !important; }
                        .force-print { display: table-row !important; }
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
                                        <SelectContent><SelectItem value="all">الكل</SelectItem>{Array.from(new Set(processedGroupData.students.map((s:any)=>s.company || s["السرية"]))).filter(Boolean).map(c=><SelectItem key={c as string} value={c as string}>{c as string}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center gap-2 bg-white px-2 rounded-lg border h-10 shadow-sm">
                                    <Label className="text-[10px] font-bold whitespace-nowrap">الفصيل:</Label>
                                    <Select value={innerPlatoon} onValueChange={(v)=>{setInnerPlatoon(v); setInnerCurrentPage(1);}}>
                                        <SelectTrigger className="w-full md:w-24 h-7 border-none text-xs font-bold"><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="all">الكل</SelectItem>{Array.from(new Set(processedGroupData.students.map((s:any)=>s.platoon || s["الفصيل"]))).filter(Boolean).map(p=><SelectItem key={p as string} value={p as string}>{p as string}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                               <div className="flex flex-wrap items-center gap-2 w-full md:justify-end no-print" >
                                
                                    {selectedGroup.type === "engagement" && (
                        <div className="flex bg-white rounded-lg border h-10 px-2 items-center gap-2 shadow-sm flex-1 md:flex-none min-w-[180px]">
                            <Label className="text-[9px] font-bold text-slate-500 whitespace-nowrap">جهة الطباعة:</Label>
                            <Select value={printDestination} onValueChange={(v:any)=>setPrintDestination(v)}>
                                <SelectTrigger className="w-full border-none text-[10px] font-bold focus:ring-0 h-7">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="sports">المكتب الرياضي</SelectItem>
                                    <SelectItem value="control">مكتب الكنترول</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row items-center gap-2 w-full md:justify-end no-print">
    
    {/* 🟢 حاوية الأزرار: شبكة (Grid) من عمودين للهاتف وسطر واحد للكمبيوتر */}
    <div className="grid grid-cols-2 md:flex md:flex-wrap items-center gap-2 w-full md:w-auto">
        
        {/* زر جلب درجة المدرب - يظهر فقط عند تفعيل العمود */}
        {viewMode === "official" && showTrainerColumn && (
            <Button 
                onClick={handleFetchTrainerScores} 
                disabled={loading} 
                className="bg-orange-600 hover:bg-orange-700 h-10 px-2 text-[10px] gap-1 font-bold shadow-md text-white w-full md:w-auto"
            >
                {loading ? <Loader2 className="animate-spin w-3 h-3"/> : <UserCheck className="w-3 h-3" />}
                جلب الدرجات
            </Button>
        )}

        {/* زر إخفاء/إظهار درجة المدرب - يظهر فقط في الاشتباك */}
        {selectedGroup.type === "engagement" && (
            <Button 
                onClick={() => setShowTrainerColumn(!showTrainerColumn)} 
                variant="outline"
                className={`h-10 px-2 text-[10px] font-bold border-2 transition-all w-full md:w-auto ${
                    !showTrainerColumn ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-slate-300 text-slate-600'
                }`}
            >
                {showTrainerColumn ? "إخفاء الدرجة" : "إظهار (100%)"}
            </Button>
        )}

        {/* زر الطباعة */}
        <Button 
    onClick={() => {
        // 1. حفظ العنوان الأصلي للصفحة
        const originalTitle = document.title;
        
        // 2. تجهيز البيانات لاسم الملف
        const examType = selectedGroup.type === "fitness" ? "اختبار_لياقة_بدنية" : "اختبار_اشتباك";
        const courseName = selectedGroup.course.replace(/\s+/g, '_'); // استبدال المسافات بشرطة سفلية
        const batchName = selectedGroup.batch.replace(/\s+/g, '_');
        const examDate = selectedGroup.exam_date;

        // 3. صياغة اسم الملف الكامل بالعربي
        // التنسيق: نوع الاختبار-دورة-دفعة-تاريخ
        const fileName = `${examType}_${courseName}_دفعة_${batchName}_تاريخ_${examDate}`;

        // 4. تغيير عنوان المتصفح مؤقتاً (هذا ما يقرأه الـ PDF كاسم للملف)
        document.title = fileName;

        // 5. تنفيذ أمر الطباعة
        window.print();

        // 6. إعادة العنوان الأصلي بعد إغلاق نافذة الطباعة
        setTimeout(() => {
            document.title = originalTitle;
        }, 500);
    }} 
    className="bg-slate-900 h-10 px-3 text-[10px] md:text-xs gap-1 font-bold shadow-md text-white flex-1 md:flex-none"
>
    <Printer className="w-4 h-4" /> طباعة
</Button>

        {/* زر الإكسل */}
        <Button 
            variant="outline" 
            onClick={exportToExcel} 
            className="text-green-700 border-green-600 h-10 px-2 text-[10px] bg-white font-bold shadow-sm w-full md:w-auto gap-1"
        >
            <Download className="w-4 h-4" /> Excel
        </Button>

    </div>
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
                                {selectedGroup.type === "fitness" ? "اختبار اللياقة البدنية" : "اختبار اشتباك"} {customExamType && `(${customExamType})`} - دورة: {selectedGroup.course} / دفعة: {selectedGroup.batch}
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
                                        <TableHead className="text-center border-l border-black font-bold">السرية / الفصيل</TableHead>

                                        {selectedGroup.type === "fitness" ? (
                                            <>
                                                {/* الجري */}
                                                <TableHead className="text-center border-l border-black font-bold w-16 bg-slate-50">الجري</TableHead>
                                                <TableHead className="text-center border-l border-black font-bold w-12 text-[10px] bg-slate-50">د.جري</TableHead>
                                                <TableHead className="text-center border-l border-black font-bold w-14 text-[10px] bg-slate-50">تق.جري</TableHead>
                                                {/* الضغط */}
                                                <TableHead className="text-center border-l border-black font-bold w-12">الضغط</TableHead>
                                                <TableHead className="text-center border-l border-black font-bold w-12 text-[10px]">د.ضغط</TableHead>
                                                <TableHead className="text-center border-l border-black font-bold w-14 text-[10px]">تق.ضغط</TableHead>
                                                {/* البطن */}
                                                <TableHead className="text-center border-l border-black font-bold w-12 bg-slate-50">البطن</TableHead>
                                                <TableHead className="text-center border-l border-black font-bold w-12 text-[10px] bg-slate-50">د.بطن</TableHead>
                                                <TableHead className="text-center border-l border-black font-bold w-14 text-[10px] bg-slate-50">تق.بطن</TableHead>
                                                {/* النهائية */}
                                                <TableHead className="text-center border-l border-black font-black bg-[#b4a280] w-16">النهائية</TableHead>
                                            </>
                                        ) : (
                                            <>
                                                <TableHead className="text-center border-l border-black font-black bg-[#b4a280] w-24 transition-colors">
    {/* 🟢 المسمى يتغير ديناميكياً */}
    {showTrainerColumn ? "المعدل (90%)" : "المعدل (100%)"}
</TableHead>

{/* عمود درجة المدرب يظهر فقط برغبة المستخدم */}
{viewMode === "official" && showTrainerColumn && (
    <TableHead className="text-center border-l border-black font-black bg-[#a39170] w-24 animate-in fade-in">
        درجة المدرب
    </TableHead>
)}
                                            </>
                                        )}

                                        <TableHead className={`text-center border-l border-black font-bold w-20 ${printDestination === 'control' ? 'print:hidden' : ''}`}>
                                            التقدير
                                        </TableHead>
                                        <TableHead className={`text-center border-l border-black font-bold w-16 ${
    selectedGroup.type === "engagement" && printDestination === "control" ? "print:hidden" : ""
}`}>
    النتيجة
</TableHead>
                                        
                                        {/* 🟢 عمود درجة المدرب يظهر فقط في اللياقة وإذا كان موجوداً */}
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
                                                <TableCell className="border-l border-black">{idx + 1}</TableCell>
                                                <TableCell className="border-l border-black">{s["الرتبة"] || s.rank || "-"}</TableCell>
                                                <TableCell className="border-l border-black font-mono">{s["الرقم العسكري"] || s.military_id}</TableCell>
                                                <TableCell className="text-right border-l border-black px-4 whitespace-nowrap">{s["الإسم"] || s.name}</TableCell>
                                                <TableCell className="border-l border-black text-[10px]">
                                                    {(s["السرية"] || s.company)} / {(s["الفصيل"] || s.platoon)}
                                                </TableCell>

                                                {selectedGroup.type === "fitness" ? (
                                                    <>
                                                        <TableCell className="border-l border-black bg-slate-50/50">{s["الجري"] || s.run_time || "-"}</TableCell>
                                                        <TableCell className="border-l border-black text-[10px] bg-slate-50/50">{s["درجة الجري"] || s.run_score || "-"}</TableCell>
                                                        <TableCell className="border-l border-black text-[10px] bg-slate-50/50">{s["تقدير الجري"] || s.run_grade || "-"}</TableCell>

                                                        <TableCell className="border-l border-black">{s["الضغط"] || s.pushups || "-"}</TableCell>
                                                        <TableCell className="border-l border-black text-[10px]">{s["درجة الضغط"] ?? s.push_score ?? "-"}</TableCell>
                                                        <TableCell className="border-l border-black text-[10px]">{s["تقدير الضغط"] || s.push_grade || "-"}</TableCell>

                                                        <TableCell className="border-l border-black bg-slate-50/50">{s["البطن"] || s.situps || "-"}</TableCell>
                                                        <TableCell className="border-l border-black text-[10px] bg-slate-50/50">{s["درجة البطن"] ?? s.sit_score ?? "-"}</TableCell>
                                                        <TableCell className="border-l border-black text-[10px] bg-slate-50/50">{s["تقدير البطن"] || s.sit_grade || "-"}</TableCell>

                                                        <TableCell className="border-l border-black font-black text-lg">
                                                            {s["الدرجة النهائية"] ?? s.average ?? "-"}
                                                        </TableCell>
                                                    </>
                                                ) : (
                                                    <>
                                                        <TableCell className="border-l border-black font-black text-lg">
    {isAbsent ? "-" : s.total_final}
</TableCell>

{/* إخفاء خلية درجة المدرب برمجياً */}
{viewMode === "official" && showTrainerColumn && (
    <TableCell className="border-l border-black font-black text-lg">
        {isAbsent ? "-" : (trainerScores[s.military_id] || "-")}
    </TableCell>
)}
                                                    </>
                                                )}

                                                <TableCell className={`border-l border-black ${printDestination === 'control' ? 'print:hidden' : ''}`}>
                                                    {selectedGroup.type === "fitness" 
                                                        ? (s["التقدير العام"] || s.grade || "-") 
                                                        : (isAbsent ? "-" : gradeInfo.result)}
                                                </TableCell>

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

                                                {/* 🟢 مكان درجة المدرب الجديد (قبل الملاحظات) */}
                                                {selectedGroup.type === "fitness" && hasTrainerScore && (
                                                    <TableCell className="border-l border-black font-bold text-blue-800">
                                                        {s["درجة المدرب"] || s.trainer_score || "-"}
                                                    </TableCell>
                                                )}

                                                {/* الملاحظات الذكية: تظهر على الشاشة وتختفي عند الطباعة (لأن لدينا خلية مخصصة للطباعة بعدها) */}
<TableCell className="text-right border-l border-black px-2 no-print min-w-[150px]">
    {/* 🟢 التعديل: قراءة الملاحظة من كل المصادر الممكنة */}
    {renderNoteCell(s) || s["ملاحظات"] || s["الملاحظات"] || s.notes || "-"}
</TableCell>

{/* الخلية المخصصة للطباعة فقط */}
<TableCell className="text-right px-2 hidden print:table-cell text-[10px]">
    {/* 🟢 التعديل: ضمان ظهور الملاحظة المخزنة في قاعدة البيانات عند الطباعة */}
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
            
            <div className="relative">
                <Calendar className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 z-10" />
                <Input type="date" className="h-9 pr-9 bg-white font-bold" value={dateSearch} onChange={(e)=>{setDateSearch(e.target.value); setMainPage(1);}} />
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

    <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setTrainerScores({}); setMainPage(1); }}>
        <TabsList className="bg-slate-200 p-1 rounded-xl w-full max-w-md mx-auto mb-8 flex h-10 shadow-md">
            <TabsTrigger value="engagement" className="flex-1 font-bold h-8 data-[state=active]:bg-orange-600 data-[state=active]:text-white">نتائج الاشتباك</TabsTrigger>
            <TabsTrigger value="fitness" className="flex-1 font-bold h-8 data-[state=active]:bg-green-600 data-[state=active]:text-white">نتائج اللياقة</TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab}>
            {loading ? <div className="flex justify-center py-20" ><Loader2 className="animate-spin w-10 h-10 text-orange-500" /></div> : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" dir="rtl">
                        {paginatedCards.length === 0 ? (
                            <div className="col-span-full text-center py-20 bg-slate-50 rounded-2xl border-dashed border-2">
                                <FileWarning className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                <p className="text-slate-500 font-bold">لا توجد سجلات تطابق البحث حالياً</p>
                            </div>
                        ) : (
                            // 🟢 نستخدم paginatedCards هنا بدلاً من filteredGroupedRecords
                            paginatedCards.map((group: any) => (
                                <Card 
                                    key={group.key} 
                                    className={`cursor-pointer border-r-8 hover:shadow-2xl transition-all group relative overflow-hidden  ${
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
                                                        <p className="text-[10px] text-slate-500 font-bold mt-1">{group.course} - {group.batch}</p>
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
                                            ))
                                        )}
                                    </div>
                                    {filteredGroupedRecords.length > 0 && (
                        <div className="no-print flex flex-col md:flex-row items-center justify-between gap-4 mt-10 p-4 bg-white rounded-xl border shadow-sm">
                            <div className="flex items-center gap-2">
                                <Label className="text-xs font-bold text-slate-500">عرض بطاقات:</Label>
                                <Select value={String(mainItemsPerPage)} onValueChange={(v) => {setMainItemsPerPage(Number(v)); setMainPage(1);}}>
                                    <SelectTrigger className="w-24 h-8 text-xs font-bold"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10 بطاقات</SelectItem>
                                        <SelectItem value="20">20 بطاقة</SelectItem>
                                        <SelectItem value="50">50 بطاقة</SelectItem>
                                    </SelectContent>
                                </Select>
                                <span className="text-[10px] text-slate-400 font-bold mr-2">إجمالي الاختبارات: {filteredGroupedRecords.length}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button variant="outline" size="sm" disabled={mainPage === 1} onClick={() => setMainPage(p => p - 1)} className="font-bold h-8 px-4">السابق</Button>
                                <div className="text-xs font-black bg-slate-50 px-4 py-1 rounded-lg border text-slate-700">صفحة {mainPage} من {totalMainPages}</div>
                                <Button variant="outline" size="sm" disabled={mainPage >= totalMainPages} onClick={() => setMainPage(p => p + 1)} className="font-bold h-8 px-4">التالي</Button>
                            </div>
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