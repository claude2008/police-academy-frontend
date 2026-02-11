"use client"

import { useState, useEffect, useMemo } from "react"
// 🟢 تأكدنا من استيراد addDays للتعامل مع التواريخ
import { format, addDays } from "date-fns"
import { ar } from "date-fns/locale"
import { 
  CalendarDays, Search, Clock, AlertTriangle, 
  Loader2, ChevronRight, ChevronLeft, Stethoscope, Tent, 
  FileText, UserMinus, HelpCircle, PlusCircle, Trash2, CheckCircle2, User,
  Camera, Paperclip, X, Info, FileCheck, Check ,Lock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription // 👈 أضف هذه الكلمة هنا
} from "@/components/ui/dialog"
import { toast } from "sonner"
import ProtectedRoute from "@/components/ProtectedRoute"
import imageCompression from 'browser-image-compression';

const STATUS_OPTIONS = [
  { id: "absent", label: "غياب", color: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle, propagate: false },
  { id: "exempt", label: "إعفاء", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: AlertTriangle, needsDuration: true, propagate: true },
  { id: "rest", label: "استراحة", color: "bg-slate-100 text-slate-700 border-slate-200", icon: HelpCircle, needsDuration: true, propagate: true },
  { id: "leave", label: "إجازة", color: "bg-green-100 text-green-700 border-green-200", icon: Tent, needsDuration: true, propagate: true },
  { id: "medical", label: "طبية", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Stethoscope, needsDuration: true, propagate: true },
  { id: "admin_leave", label: "إجازة إدارية", color: "bg-green-100 text-green-700 border-green-200", icon: FileText, needsDuration: true, propagate: true },
  { id: "death_leave", label: "إجازة وفاة", color: "bg-gray-100 text-gray-700 border-gray-200", icon: UserMinus, needsDuration: true, propagate: true },
  { id: "clinic", label: "عيادة", color: "bg-cyan-100 text-cyan-700 border-cyan-200", icon: Stethoscope, propagate: false },
  // 🟢 إضافة needsTime هنا
  { id: "late_parade", label: "تأخير تكميل", color: "bg-orange-100 text-orange-700 border-orange-200", icon: Clock, needsTime: true, propagate: false },
  { id: "late_class", label: "تأخير حصة", color: "bg-orange-100 text-orange-700 border-orange-200", icon: Clock, needsTime: true, propagate: false },
  { id: "hospital", label: "مستشفى", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Stethoscope, needsDuration: true, propagate: true },
  // 🟢 إضافة needsNote و needsDuration هنا
  { id: "other", label: "أخرى", color: "bg-gray-200 text-gray-800 border-gray-300", icon: HelpCircle, needsNote: true, needsDuration: true, propagate: true },
]

const SUBJECT_MAP: any = { sports: "لياقة بدنية", military: "تدريب عسكري", combat: "اشتباك", lecture: "محاضرة", other: "أخرى" };

export default function DailySchedulePage() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [loading, setLoading] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState("")
  const [selectedBatch, setSelectedBatch] = useState("all")
  const [selectedCompany, setSelectedCompany] = useState("all")
  const [selectedPlatoon, setSelectedPlatoon] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [filterOptions, setFilterOptions] = useState<any>({ courses: [], batches: [] })
  const [templates, setTemplates] = useState<any[]>([])
  const [soldiers, setSoldiers] = useState<any[]>([])
  const [attendanceData, setAttendanceData] = useState<Record<string, any>>({});
  const [modalOpen, setModalOpen] = useState(false)
  const [activeEntry, setActiveEntry] = useState<any>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);
  const [attachmentStudent, setAttachmentStudent] = useState<any>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
const [lockedSessions, setLockedSessions] = useState<string[]>([]);
// أضف هذا السطر في بداية المكون (قبل الـ useEffect)
const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("user") || "{}") : {};
const scope = user?.extra_permissions?.scope;
const allowedBatchesForSelectedCourse = useMemo(() => {
    // المصفوفة هنا ستكون نظيفة أصلاً وتحتوي فقط على ما يخص الدورة المختارة
    const batches = filterOptions.batches || [];
    return batches;
}, [filterOptions.batches]);
useEffect(() => {
    const fetchOptions = async () => {
        try {
            const token = localStorage.getItem("token");
            
            // 🟢 إرسال الدورة المختارة للسيرفر لفلترة الدفعات من المصدر
            const courseParam = selectedCourse && selectedCourse !== "all" ? selectedCourse : "";
            
            // 1. جلب الخيارات (مع فلترة الدورة) + القوالب
            const [fRes, tRes] = await Promise.all([
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/filters-options?course=${encodeURIComponent(courseParam)}`),
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/training/templates`, {
                    headers: { "Authorization": `Bearer ${token}` }
                })
            ]);

            // 2. معالجة خيارات الفلترة
            if (fRes.ok) {
                let filterData = await fRes.json();
                
                // 🧼 توحيد مسميات الدفعات فوراً
                // إذا كانت الدورة عامة، السيرفر سيعيد [null]، وهنا نحوله لـ ["لا يوجد"]
                filterData.batches = (filterData.batches || []).map((b: string) => 
                    (!b || b === "None" || b === "none" || b === "null" || b === "") ? "لا يوجد" : b
                );
                
                // إزالة التكرار
                filterData.batches = Array.from(new Set(filterData.batches));

                // 🛡️ تطبيق حارس النطاق للمستخدم المقيد
                if (user.role !== 'owner' && scope?.is_restricted) {
                    const userCourses = scope?.courses || [];
                    
                    // تصفية الدورات (لتظهر فقط المسموحة)
                    // (هذا الجزء ثابت ولا يعتمد على selectedCourse)
                    if (!selectedCourse || selectedCourse === "all") {
                         const allowedCoursesBaseNames = userCourses.map((key: string) => key.split('||')[0]);
                         filterData.courses = (filterData.courses || []).filter((c: string) => 
                             allowedCoursesBaseNames.includes(c)
                         );
                    }

                    // تصفية الدفعات (بناءً على الصلاحية + الدورة المختارة)
                    if (selectedCourse && selectedCourse !== "all") {
                        filterData.batches = filterData.batches.filter((bName: string) => {
                            const specificKey = `${selectedCourse}||${bName}`;
                            return userCourses.includes(selectedCourse) || userCourses.includes(specificKey);
                        });
                    }
                }
                
                setFilterOptions((prev: any) => ({
    ...prev,
    // نحدث الدورات فقط في البداية، والدفعات تتحدث مع كل تغيير للدورة
    courses: (selectedCourse && selectedCourse !== "all") ? prev.courses : filterData.courses,
    batches: filterData.batches
}));
            }

            // 3. معالجة القوالب (نفس كودك السابق)
            if (tRes.ok) {
                const rawTemplateData = await tRes.json();
                let processedTemplates = rawTemplateData.map((t: any) => {
                    const cKey = t.course_key || t.courseId || t.course_name;
                    const rawBKey = t.batch_key || t.batchId || t.batch_name;
                    const bKeyClean = (rawBKey === "all" || rawBKey === "None" || !rawBKey || rawBKey === "null" || rawBKey === "none") ? "لا يوجد" : rawBKey;
                    
                    return { ...t, course_key: cKey, batch_key: bKeyClean, is_active: t.is_active !== undefined ? t.is_active : t.isActive };
                });
                
                // تطبيق قيود النطاق على القوالب
                if (user.role !== 'owner' && scope?.is_restricted) {
                     const userCourses = scope?.courses || [];
                     processedTemplates = processedTemplates.filter((t: any) => {
                        const hasGeneralAccess = userCourses.includes(t.course_key);
                        const hasSpecificAccess = userCourses.includes(`${t.course_key}||${t.batch_key}`);
                        return hasGeneralAccess || hasSpecificAccess;
                     });
                }
                setTemplates(processedTemplates);
            }

        } catch (e) {
            console.error("Error fetching data:", e);
            toast.error("فشل تحميل البيانات");
        }
    };

    fetchOptions();
    
    // ⚠️ إضافة selectedCourse هنا هي الحل السحري لتحديث قائمة الدفعات تلقائياً
}, [date, selectedCourse]);

const activeSchedule = useMemo(() => {
    // 🔍 البحث عن القالب المناسب بناءً على الفلاتر المنظفة
    const template = templates.find(t => {
        // 1️⃣ توحيد بيانات القالب (Template Data)
        const tCourse = t.course_key || t.courseId || t.course_name;
        
        // 🧼 تنظيف مسمى الدفعة في القالب (تحويل الفراغ أو None إلى "لا يوجد")
        const tBatchClean = (t.batch_key === "all" || t.batch_key === "None" || !t.batch_key || t.batch_key === "null" || t.batch_key === "none") 
            ? "لا يوجد" 
            : t.batch_key;

        // 2️⃣ توحيد بيانات الاختيار من الواجهة (UI Selection)
        const selectedCourseClean = selectedCourse;
        
        // 🧼 تنظيف مسمى الدفعة المختار (تحويل الفراغ أو all إلى "لا يوجد" للمطابقة)
        const selectedBatchClean = (selectedBatch === "all" || selectedBatch === "" || selectedBatch === "none" || !selectedBatch) 
            ? "لا يوجد" 
            : selectedBatch;

        // 3️⃣ عملية المطابقة (Matching)
        const courseMatch = tCourse === selectedCourseClean;
        
        // مطابقة الدفعة: نعتمد على المسميات المنظفة لضمان نجاح دمج (null مع None)
        const batchMatch = (tBatchClean === selectedBatchClean);

        const activeFlag = t.is_active !== undefined ? t.is_active : t.isActive;

        return courseMatch && batchMatch && activeFlag === true;
    });

    // 🛑 إذا لم نجد قالباً يطابق الاختيارات، نرجع مصفوفة فارغة
    if (!template) return [];

    // 4️⃣ استخراج بيانات الجدول (تحويل النص إلى كائن JSON إذا لزم الأمر)
    let scheduleData = [];
    try {
        const rawData = template.schedule_data || template.schedule;
        scheduleData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    } catch (e) { 
        console.error("خطأ في معالجة بيانات الجدول:", e);
        return []; 
    }

    if (!Array.isArray(scheduleData)) return [];

    // 5️⃣ تحديد يوم الأسبوع (مطابقة الاسم العربي لليوم)
    const rawDayName = format(new Date(date), "EEEE", { locale: ar });
    const dayEntry = scheduleData.find((d: any) => d.dayName === rawDayName || d.day === rawDayName);
    
    // إرجاع الحصص لهذا اليوم أو مصفوفة فارغة
    return dayEntry?.sessions || [];

}, [date, selectedCourse, selectedBatch, templates]);

  // ✅ الكود الجديد: يطلب الدورة كشرط أساسي، والدفعة اختيارية
useEffect(() => { 
    if (selectedCourse) { 
        setLockedSessions([]); // 👈 أضف هذا السطر فقط (لتنظيف الأقفال القديمة فوراً)
        fetchSoldiers(); 
    } 
}, [selectedCourse, selectedBatch, selectedCompany, date]);

const fetchSoldiers = async () => {
    setLoading(true);
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const scope = user?.extra_permissions?.scope;

    try {
        // 🟢 1. توحيد مسمى الدفعة للطلبات (API Normalization)
        // إذا كان المختار "الكل" أو "لا يوجد"، نرسل نصاً فارغاً ليفهم الباك إند أنه (NULL)
        const cleanBatchForApi = (selectedBatch === "all" || selectedBatch === "None" || selectedBatch === "none" || selectedBatch === "لا يوجد") ? "" : selectedBatch;

        const params = new URLSearchParams({ 
            course: selectedCourse, 
            batch: cleanBatchForApi, 
            limit: "1000" 
        });

        // 2. إرسال الطلبات بالقيم "المطهرة"
        const [sRes, dRes] = await Promise.all([
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/?${params.toString()}`),
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/day-data?date=${date}&course=${selectedCourse}&batch=${cleanBatchForApi}`, { 
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` } 
            })
        ]);

if (sRes.ok) {
    let soldiersData = (await sRes.json()).data || [];
    
    if (user.role !== 'owner' && scope?.is_restricted) {
        const allowedCoursesKeys = scope.courses || [];
        
        soldiersData = soldiersData.filter((s: any) => {
            const courseName = s.course;
            
            // 🟢 توحيد مسمى الدفعة للمطابقة (Normalization)
            // أي قيمة فارغة في قاعدة البيانات نحولها لـ "لا يوجد" لكي تطابق الصلاحية
            const soldierBatchLabel = (!s.batch || s.batch === "None" || s.batch === "none" || s.batch === "") 
                ? "لا يوجد" 
                : s.batch;

            const hasGeneralAccess = allowedCoursesKeys.includes(courseName);
            const hasSpecificAccess = allowedCoursesKeys.includes(`${courseName}||${soldierBatchLabel}`);

            return hasGeneralAccess || hasSpecificAccess;
        });
    }
    setSoldiers(soldiersData);
}

        // 🟢 4. معالجة الأقفال (كما هي، منطقك فيها ممتاز)
        if (dRes.ok) {
            const responseData = await dRes.json();
            setAttendanceData(responseData.data || responseData); 

            const allLocked = Array.from(new Set([
                ...(responseData.approved_sessions || []), 
                ...(responseData.supervisor_approved_sessions || []), 
                ...(responseData.officer_approved_sessions || [])
            ]));
            
            setLockedSessions(allLocked.map(String)); 
            console.log("🔒 الحصص المقفلة المحدثة:", allLocked);
        }

    } catch (e) { 
        toast.error("فشل تحديث البيانات"); 
        console.error(e);
    } finally { 
        setLoading(false); 
    }
};

// 1. استخراج الدفعات (كما هي مع إضافة حماية من القيم النصية "null")
const availableBatches = useMemo(() => {
    const batches = new Set(soldiers.map(s => {
        // توحيد كل أشكال الفراغ إلى مسمى واحد
        if (!s.batch || s.batch === "None" || s.batch === "none" || s.batch === "null" || s.batch === "") return "لا يوجد";
        return s.batch;
    }));
    return Array.from(batches).sort((a: any, b: any) => a.localeCompare(b, 'ar'));
}, [soldiers]);

// 2. 🟢 التعديل الذكي: السرايا (تعتمد على الدفعة المختارة)
const availableCompanies = useMemo(() => {
    // نفلتر الجنود أولاً بناءً على الدفعة المختارة قبل استخراج السرايا
    const filteredByBatch = soldiers.filter(s => {
        const batchLabel = (!s.batch || s.batch === "None" || s.batch === "none" || s.batch === "") ? "لا يوجد" : s.batch;
        return selectedBatch === "all" || batchLabel === selectedBatch;
    });

    const companies = new Set(filteredByBatch.map(s => {
        if (!s.company || s.company === "None" || s.company === "none" || s.company === "") return "لا يوجد";
        return s.company;
    }));
    
    return Array.from(companies).sort((a: any, b: any) => a.localeCompare(b, 'ar'));
}, [soldiers, selectedBatch]); // 👈 أضفنا selectedBatch هنا لجعل القائمة تفاعلية

// 3. 🟢 التعديل الذكي: الفصائل (تعتمد على الدفعة والسرية المختارة)
const platoonsList = useMemo(() => {
    const filteredByComp = soldiers.filter(s => {
        // فحص الدفعة
        const batchLabel = (!s.batch || s.batch === "None" || s.batch === "none" || s.batch === "") ? "لا يوجد" : s.batch;
        const matchBatch = selectedBatch === "all" || batchLabel === selectedBatch;
        
        // فحص السرية
        const compLabel = (!s.company || s.company === "None" || s.company === "") ? "لا يوجد" : s.company;
        const matchComp = selectedCompany === "all" || compLabel === selectedCompany;

        return matchBatch && matchComp;
    });

    const platoons = new Set(filteredByComp.map(s => s.platoon || "لا يوجد"));
    return Array.from(platoons).sort((a: any, b: any) => a.localeCompare(b, 'ar'));
}, [soldiers, selectedBatch, selectedCompany]); // 👈 أضفنا التبعيات هنا
const filteredSoldiers = useMemo(() => {
    return soldiers.filter(s => {
        const matchSearch = (s.name || "").includes(searchTerm) || (s.military_id || "").includes(searchTerm);
        const matchPlatoon = selectedPlatoon === "all" || s.platoon === selectedPlatoon;
        
        // 🟢 أضفنا شرط السرية هنا
        const matchCompany = selectedCompany === "all" || s.company === selectedCompany;

        return matchSearch && matchPlatoon && matchCompany;
    });
}, [soldiers, searchTerm, selectedPlatoon, selectedCompany]); // 👈 لا تنس إضافة selectedCompany هنا

// 🟢 2. تقسيم الصفحات بناءً على الفرز الفعلي
const paginatedSoldiers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSoldiers.slice(start, start + itemsPerPage);
}, [filteredSoldiers, currentPage, itemsPerPage]);

const saveStatus = async () => { 
    if (!activeEntry.status) return toast.error("يرجى اختيار الحالة أولاً");
    
    setLoading(true);
    const token = localStorage.getItem("token");

    try {
        // --- 1. المرحلة الأمنية الأولى: محاولة تنظيف القديم ---
        if (activeEntry.group_id) {
            console.log("🧹 محاولة تنظيف السلسلة...");
            const delRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/delete-group/${activeEntry.group_id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!delRes.ok && delRes.status === 403) {
                console.warn("⚠️ السلسلة مقفلة جزئياً، سنقوم بتحديث الحصص المتاحة فقط.");
            } else if (!delRes.ok) {
                const errorData = await delRes.json();
                setLoading(false);
                return toast.error(errorData.detail || "حدث خطأ أثناء تحديث البيانات");
            }
        }

        // --- 2. تجهيز المتغيرات الأساسية ---
        const durationCount = parseInt(activeEntry.duration) || 1;
        const statusInfo = STATUS_OPTIONS.find(o => o.id === activeEntry.status);
        const isSingleSession = activeEntry.isSingleSession === true;
        
        const newGroupId = isSingleSession ? null : (activeEntry.group_id || `GRP-${Date.now()}-${activeEntry.soldier.id}`);
        const loopDuration = isSingleSession ? 1 : durationCount;
        const baseStartDate = activeEntry.start_date || date; 

        let skippedAdditionsCount = 0;
        let successCount = 0;

        console.log(`🚀 بدء الحفظ التسلسلي لـ ${loopDuration} أيام...`);

        // --- 3. المرحلة التنفيذية: الإرسال التسلسلي ---
        for (let i = 0; i < loopDuration; i++) {
            const targetDate = format(addDays(new Date(baseStartDate), i), "yyyy-MM-dd");
            
            for (const [idx, session] of activeSchedule.entries()) {
                const sIdxStr = String(idx); // هذا هو المعرف الصحيح للحصة
                const isCurrentSession = sIdxStr === activeEntry.sessionId;

                // أ. فحص الحماية من الكتابة فوق المعتمد
                const hasExistingRecord = attendanceData[`${activeEntry.soldier.id}-${sIdxStr}`] || 
                                          attendanceData[`${activeEntry.soldier.id}-slot-${sIdxStr}`];

                if (lockedSessions.includes(sIdxStr) && !hasExistingRecord) {
                    skippedAdditionsCount++;
                    continue; 
                }

                // ب. تحديد هل يجب حفظ هذه الحصة؟
                let shouldSave = false;
                if (isSingleSession) {
                    if (isCurrentSession && i === 0) shouldSave = true;
                } else {
                    if (statusInfo?.propagate || i > 0 || isCurrentSession) shouldSave = true;
                }

                // ج. تنفيذ طلب الحفظ
                if (shouldSave) {
                    try {
                        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/attendance/save`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                            body: JSON.stringify({
                                soldier_id: activeEntry.soldier.id,
                                date: targetDate, 
                                session_id: sIdxStr,
                                status: activeEntry.status,
                                duration: isSingleSession ? 1 : durationCount, 
                                start_date: baseStartDate, 
                                note: activeEntry.note || "",
                                group_id: newGroupId
                            })
                        });

                        // 🔴 فحص إذا كانت الحصة معتمدة (مقفولة) من الباك إند
                        if (res.status === 400) {
                            const errorData = await res.json();
                            if (errorData.detail?.includes("approved")) {
                                toast.error(`الحصة ${sIdxStr} مقفولة نهائياً. فك الاعتماد أولاً.`);
                                continue; // نتخطى هذه الحصة ونكمل الباقي
                            }
                        }

                       if (res.ok) {
    successCount++;
    // 🟢 أضفنا (: any) هنا لإيقاف اعتراض TypeScript
    setAttendanceData((prev: any) => ({
        ...prev,
        [`${activeEntry.soldier.id}-${sIdxStr}`]: { 
            status: activeEntry.status, 
            note: activeEntry.note 
        }
    }));

                        } else {
                            console.error(`❌ خطأ في حصة ${sIdxStr} يوم ${targetDate}`);
                        }
                    } catch (fetchErr) {
                        console.error(`📡 عطل في الشبكة أثناء حفظ حصة ${sIdxStr}:`, fetchErr);
                    }
                }
            }
        }

        // --- 4. إنهاء العملية وإظهار النتائج ---
        if (successCount > 0) {
            toast.success(`تم حفظ ${successCount} سجلات بنجاح ✅`);
        }
        
        if (skippedAdditionsCount > 0) {
            toast.info(`تم حماية ${skippedAdditionsCount} حصص معتمدة من التعديل`);
        }

        fetchSoldiers(); 
        setModalOpen(false); 

    } catch (e) { 
        console.error("🚨 خطأ جسيم في دالة saveStatus:", e);
        toast.error("حدث خطأ تقني غير متوقع"); 
    } finally { 
        setLoading(false); 
    }
};

 const handleOpenAttachment = (path: string) => {
    if (!path) return;

    try {
        // 🟢 بناء الرابط الذكي:
        let fullUrl = path;

        if (path.startsWith('http')) {
            // أولاً: إذا كان رابطاً كاملاً (Supabase) نستخدمه كما هو
            fullUrl = path;
        } else if (path.startsWith('/static')) {
            // ثانياً: إذا كان مساراً محلياً نضيف له عنوان السيرفر
            fullUrl = `${process.env.NEXT_PUBLIC_API_URL}${path}`;
        }
        // ثالثاً: إذا كان Base64 (يبدأ بـ data:) سيظل كما هو في متغير fullUrl

        // التحقق من نوع الملف (PDF أم صورة)
        const isPDF = fullUrl.toLowerCase().includes(".pdf") || fullUrl.includes("application/pdf");

        if (isPDF) {
            // للملفات الـ PDF: نفتحها في تبويب جديد
            window.open(fullUrl, '_blank', 'noopener,noreferrer');
        } else {
            // للصور: نعرضها في نافذة المعاينة (Modal)
            setPreviewImage(fullUrl);
        }
    } catch (e) {
        console.error("خطأ في فتح المرفق:", e);
        toast.error("عفواً، تعذر فتح هذا المرفق حالياً");
    }
};
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsCompressing(true);
    try {
        let fileData: string = "";
        if (file.type.startsWith('image/')) {
            const options = { maxSizeMB: 0.1, maxWidthOrHeight: 1024, useWebWorker: true };
            const compressedFile = await imageCompression(file, options);
            fileData = await new Promise((res) => { const r = new FileReader(); r.readAsDataURL(compressedFile); r.onloadend = () => res(r.result as string); });
        } else {
            fileData = await new Promise((res) => { const r = new FileReader(); r.readAsDataURL(file); r.onloadend = () => res(r.result as string); });
        }

        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/attendance/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify({ soldier_id: attachmentStudent.id, date: date, session_id: `ATTACH_${Date.now()}`, status: "present", attachment: fileData, note: file.name })
        });
        toast.success("تم الرفع");
        fetchSoldiers();
    } catch (e) { toast.error("فشل الرفع") } finally { setIsCompressing(false) }
  };

 // 🟢 وظيفة الحذف الفعلي (يتم استدعاؤها بعد التأكيد الداخلي)
const executeDelete = async (attId: number) => {
    setIsDeleting(attId);
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/session/delete/attendance/${attId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        if (res.ok) {
            toast.success("تم الحذف");
            fetchSoldiers();
            setConfirmDeleteId(null); // إغلاق وضع التأكيد
        }
    } catch (e) {
        toast.error("خطأ في الحذف");
    } finally {
        setIsDeleting(null);
    }
};
const deleteStatus = async () => {
    if (!activeEntry?.id) return; // التأكد من وجود ID للحالة

    setConfirmDeleteId(activeEntry.id); // استخدام نفس منطق التأكيد الداخلي للمرفقات
};

// دالة التنفيذ النهائي للحذف (استبدل القديمة أو أضفها)
const executeDeleteStatus = async (mode: 'single' | 'group_full' | 'group_from_today') => {
    // 1. التحقق الأساسي من وجود معرف السجل
    if (!activeEntry?.id) return;
    setLoading(true);

    try {
        const token = localStorage.getItem("token");
        
        // 2. تحديد الرابط (Endpoint) بناءً على نمط الحذف المختار
        let url = `${process.env.NEXT_PUBLIC_API_URL}/session/delete/attendance/${activeEntry.id}`;
        
        if (mode === 'group_full' && activeEntry.group_id) {
            url = `${process.env.NEXT_PUBLIC_API_URL}/session/delete-group/${activeEntry.group_id}`;
        } 
        else if (mode === 'group_from_today' && activeEntry.group_id) {
            url = `${process.env.NEXT_PUBLIC_API_URL}/session/terminate-group/${activeEntry.group_id}?from_date=${date}`;
        }

        // 3. إرسال طلب الحذف للسيرفر
        const res = await fetch(url, { 
            method: "DELETE", 
            headers: { "Authorization": `Bearer ${token}` } 
        });

        const responseData = await res.json();

        // 4. معالجة الرد الناجح
        if (res.ok) {
            // نأخذ نص النجاح من الباك إند (مثلاً: "تم حذف سلسلة الحالات بالكامل...")
            toast.success(responseData.message || "تم تنفيذ الإجراء بنجاح ✅");
            
            // تحديث الجدول فوراً ليعكس الحذف
            fetchSoldiers();
            
            // إغلاق النافذة المنبثقة
            setModalOpen(false); 
        } 
        // 5. معالجة الرفض (الاعتمادات الموجودة)
        else {
            // هنا يظهر "المنطق الصارم": سيعرض السيرفر رسالة مثل:
            // "عفواً، لا يمكن حذف السلسلة بالكامل لوجود حصص معتمدة... يمكنك تقصير المدة بدلاً من ذلك"
            toast.error(responseData.detail || "عفواً، لا يمكن إتمام الحذف لوجود قيود اعتماد 🔒");
            
            // نغلق النافذة لنجعل المستخدم يقرر خياره التالي بناءً على الرسالة
            setModalOpen(false); 
        }
    } catch (e) {
        // خطأ تقني في الشبكة أو السيرفر
        toast.error("حدث خطأ في الاتصال بالسيرفر، يرجى المحاولة لاحقاً 🌐");
    } finally {
        // تنظيف حالات التحميل والتأكيد في كل الظروف
        setLoading(false);
        setConfirmDeleteId(null);
    }
};
  return (
    <ProtectedRoute allowedRoles={["owner","manager","admin","assistant_admin","sports_officer","sports_supervisor", "sports_trainer","military_officer","military_supervisor", "military_trainer"]}>
      <div className="p-2 md:p-4 pb-10 md:pb-32 space-y-4 max-w-[1800px] mx-auto bg-slate-50/50 min-h-screen" dir="rtl">
        
        <Card className="border-t-4 border-[#c5b391] shadow-sm">
            <CardHeader className="py-3 flex flex-row justify-between items-center bg-white rounded-t-lg">
                <CardTitle className="text-lg md:text-xl font-bold flex items-center gap-2"><CalendarDays className="w-5 h-5 text-[#c5b391]" /> تحضير الحصص</CardTitle>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { const d = new Date(date); d.setDate(d.getDate()-1); setDate(format(d,"yyyy-MM-dd")) }}><ChevronRight/></Button>
                    <Input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="border-none bg-transparent font-bold w-32 text-xs text-center h-8" />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { const d = new Date(date); d.setDate(d.getDate()+1); setDate(format(d,"yyyy-MM-dd")) }}><ChevronLeft/></Button>
                </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-6 gap-2 p-3">
               <Select value={selectedCourse} onValueChange={(v)=>{setSelectedCourse(v); setSelectedBatch("all");}}>
  <SelectTrigger className="h-9 text-xs font-bold bg-white">
    <SelectValue placeholder={filterOptions.courses.length === 0 ? "لا توجد صلاحيات" : "اختر الدورة"} />
  </SelectTrigger>
  <SelectContent>
    {/* 🟢 لا تسمح للمتصفح بعرض أي خيار إذا كانت القائمة فارغة برمجياً */}
    {filterOptions.courses && filterOptions.courses.length > 0 ? (
      filterOptions.courses.map((c: any) => (
        <SelectItem key={c} value={c}>{c}</SelectItem>
      ))
    ) : (
      <SelectItem value="none" disabled className="text-center text-red-500 italic">
        ليس لديك صلاحية على أي دورة
      </SelectItem>
    )}
  </SelectContent>
</Select>

                {/* 🟢 التعديل الثاني: قائمة الدفعات تظهر فقط ما يخص الدورة المختارة */}
         <Select value={selectedBatch} onValueChange={setSelectedBatch} disabled={!selectedCourse}>
    <SelectTrigger className="h-9 text-xs font-bold bg-white">
        <SelectValue placeholder="الدفعة" />
    </SelectTrigger>
    <SelectContent>
        {/* إظهار خيار "كل الدفعات" فقط إذا كان هناك أكثر من دفعة واحدة متاحة، أو للمدير */}
        {(allowedBatchesForSelectedCourse.length > 1 || user.role === 'owner') && (
            <SelectItem value="all">كل الدفعات</SelectItem>
        )}
        
        {allowedBatchesForSelectedCourse.map((b: string) => (
            <SelectItem key={b} value={b}>{b}</SelectItem>
        ))}
    </SelectContent>
</Select>

<Select 
    value={selectedCompany} 
    onValueChange={(v) => { 
        setSelectedCompany(v); 
        setSelectedPlatoon("all"); 
    }}
>
    <SelectTrigger className="h-9 text-xs">
        <SelectValue placeholder="السرية" />
    </SelectTrigger>
    <SelectContent>
        <SelectItem value="all">كل السرايا</SelectItem>
        {availableCompanies.map((c: any) => (
            <SelectItem key={c} value={c}>
                {c}
            </SelectItem>
        ))}
    </SelectContent>
</Select>
                <Select value={selectedPlatoon} onValueChange={setSelectedPlatoon}><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="الفصيل" /></SelectTrigger><SelectContent><SelectItem value="all">كل الفصائل</SelectItem>{platoonsList.map(p=><SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
                <div className="relative col-span-2 md:col-span-2">
                    <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                    <Input placeholder="بحث بالاسم أو الرقم..." className="pr-9 h-9 text-xs font-bold" value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} />
                </div>
            </CardContent>
        </Card>

        <div className="bg-white border rounded-xl shadow-md overflow-hidden min-h-[400px]">
            <div className="overflow-x-auto">
                <Table className="text-center border-collapse">
                    <TableHeader>
                        <TableRow className="bg-[#b09f7e] divide-x divide-white/20">
                            <TableHead colSpan={4} className="border-b-0"></TableHead>
                            {activeSchedule.map((s:any, i:number)=>(
                                <TableHead key={i} className="text-black text-center font-black border-x border-white/20 py-1 min-w-[130px]">
                                    <div className="flex flex-col leading-tight"><span className="text-[14px] opacity-70">الحصة {i+1}</span><span className="text-sm">{SUBJECT_MAP[s.type] || "مادة عامة"}</span></div>
                                </TableHead>
                            ))}
                        </TableRow>
                        <TableRow className="bg-[#c5b391] divide-x divide-white/20">
                            <TableHead className="text-black font-bold border w-10 text-[10px]">#</TableHead>
                            <TableHead className="text-black font-bold border w-12 text-center text-[10px]">المرفق</TableHead>
                            <TableHead className="text-black font-bold border w-24 text-[10px]">الرقم</TableHead>
                            <TableHead className="text-black font-bold border min-w-[180px] text-right px-4 text-[10px]">الاسم والبيانات</TableHead>
                            {activeSchedule.map((s:any, i:number)=>(
                                <TableHead key={i} className="text-black text-center border-x border-white/10 p-1 font-bold">
                                    <div className="flex flex-col leading-none"><span className="text-[14px] truncate w-28 mx-auto">{s.name || "بدون مسمى"}</span><span className="text-[9px] opacity-60 mt-0.5">{s.startTime}-{s.endTime}</span></div>
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
    {loading ? (
        <TableRow>
            <TableCell colSpan={activeSchedule.length + 4} className="h-40 text-center">
                <Loader2 className="animate-spin mx-auto w-8 h-8 text-[#c5b391]"/>
            </TableCell>
        </TableRow>
    ) : (!selectedCourse) ? (
      <TableRow>
          <TableCell colSpan={activeSchedule.length + 4} className="h-40 text-center font-bold text-slate-400">
              يرجى اختيار الدورة أولاً
          </TableCell>
      </TableRow>
    // 🟢 التعديل الثالث: إخفاء البيانات إذا كان هناك دفعات ولم يتم اختيار واحدة
    ) : (availableBatches.length > 0 && selectedBatch === "all") ? (
      <TableRow>
          <TableCell colSpan={activeSchedule.length + 4} className="h-40 text-center">
              <div className="flex flex-col items-center gap-2">
                <Info className="w-8 h-8 text-blue-500 opacity-50" />
                <p className="font-bold text-slate-500">هذه الدورة تحتوي على دفعات، يرجى تحديد الدفعة لعرض الطلاب</p>
              </div>
          </TableCell>
      </TableRow>
    ) : paginatedSoldiers.map((soldier, idx) => (
        <TableRow key={soldier.id} className="hover:bg-slate-50 h-12">
            <TableCell className="border text-[10px] text-slate-400 font-mono">
                {(currentPage - 1) * itemsPerPage + idx + 1}
            </TableCell>
            
            <TableCell className="border p-1">
                <Button 
                    variant="ghost" size="sm" 
                    className="h-7 w-7 rounded-full hover:bg-blue-50 relative" 
                    onClick={() => { setAttachmentStudent(soldier); setAttachmentModalOpen(true); }}
                >
                    <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                    {Object.keys(attendanceData).some(k => k.startsWith(`${soldier.id}-ATTACH`) && attendanceData[k]?.attendance?.attachment) && (
                        <span className="absolute top-0 right-0 w-2 h-2 bg-blue-600 rounded-full border border-white"></span>
                    )}
                </Button>
            </TableCell>

            <TableCell className="border font-bold text-slate-600 text-[11px]">{soldier.military_id}</TableCell>
            
            <TableCell className="border text-right px-3">
                <div className="flex flex-col">
                    <span className="font-bold text-xs text-slate-800">{soldier.name}</span>
                    <span className="text-[9px] text-slate-500 font-medium">{soldier.rank} - : {soldier.platoon}</span>
                </div>
            </TableCell>

            {/* 🟢 الجزء الأهم: عرض الحصص بناءً على المفتاح الذكي */}
          {activeSchedule.map((session: any, sIdx: number) => {
    const sessionId = session.id || String(sIdx);
    const key = `${soldier.id}-${sessionId}`;
    const slotKey = `${soldier.id}-slot-${sIdx}`;
    
    const record = attendanceData[key]?.attendance || attendanceData[slotKey]?.attendance;
    const status = STATUS_OPTIONS.find(o => o.id === record?.status);

    // 🟢 إضافة فحص القفل هنا
    const isLocked = lockedSessions.includes(String(sIdx));

    return (
        <TableCell 
            key={sIdx} 
            // 🟢 تغيير الخلفية إذا كانت مغلقة
            className={`border p-1 cursor-pointer transition-colors ${isLocked ? 'bg-slate-50/50' : 'hover:bg-slate-100'}`}
            onClick={() => { 
        setActiveEntry({ 
            soldier, 
            session, 
            sessionId: String(sIdx), 
            ...record,
            // 🛡️ تأمين التاريخ لمنع الانهيار
            start_date: record?.start_date || date || format(new Date(), "yyyy-MM-dd"),
            isLocked: isLocked 
        }); 
        setModalOpen(true); 
    }}
        >
            <div className="relative flex items-center justify-center">
                {status ? (
                    <div className={`${status.color} rounded px-1 py-0.5 text-[9px] font-black border border-current/20 shadow-sm text-center truncate max-w-[100px] mx-auto flex items-center gap-1`}>
                        {/* 🟢 إظهار أيقونة قفل صغيرة إذا كانت معتمدة */}
                        {isLocked && <Lock className="w-2 h-2 text-current opacity-60" />}
                       <div className={`${status.color} rounded px-1 py-0.5 text-[9px] font-black border border-current/20 shadow-sm text-center truncate max-w-[100px] mx-auto flex items-center gap-1`}>
    {isLocked && <Lock className="w-2 h-2 text-current opacity-60" />}
    
    {(() => {
        // 1. تحديد النص الأساسي (الملاحظة لحالة أخرى، أو التسمية العادية)
        const mainLabel = record.status === "other" && record.note ? record.note : status.label;
        
        // 2. تحديد الحصانة (الحالات التي لا نريد إظهار "1ي" لها)
        const excludedFromOneDay = ["absent", "clinic", "late_parade", "late_class"];
        
        // 3. منطق عرض المدة:
        // نظهر الرقم إذا كانت (المدة أكبر من 1) 
        // أو إذا كانت (المدة تساوي 1 والحالة ليست من ضمن المستثنين)
        let showDuration = false;
        const durationValue = parseInt(record.duration) || 1;

        if (durationValue > 1) {
            showDuration = true;
        } else if (durationValue === 1 && !excludedFromOneDay.includes(record.status)) {
            showDuration = true;
        }

        return (
            <span>
                {mainLabel}
                {showDuration && <span className="mr-0.5 text-[8px] opacity-80">({durationValue}ي)</span>}
            </span>
        );
    })()}
</div>
                    </div>
                ) : (
                    // 🟢 إذا كانت الحصة معتمدة وهي فارغة، نظهر القفل بدل علامة +
                    isLocked ? <Lock className="w-3 h-3 text-slate-300 opacity-40" /> : <PlusCircle className="w-3.5 h-3.5 text-slate-300 opacity-70" />
                )}
            </div>
        </TableCell>
    );
})}
        </TableRow>
    ))}
</TableBody>
                </Table>
            </div>
            
            <div className="p-3 flex items-center justify-between border-t bg-slate-50/80">
                <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-slate-500">عرض:</span>
        <Select value={itemsPerPage.toString()} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
            <SelectTrigger className="w-20 h-9 font-bold"><SelectValue /></SelectTrigger>
            <SelectContent>
                {[10, 20, 50, 100].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}
            </SelectContent>
        </Select>
        <div className="h-6 w-[1px] bg-slate-200 mx-1"></div>
        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
             العدد : {filteredSoldiers.length}
        </span>
    </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-[10px]" onClick={()=>setCurrentPage(p=>p-1)} disabled={currentPage===1}>السابق</Button>
                    <Button variant="outline" size="sm" className="h-8 text-[10px]" onClick={()=>setCurrentPage(p=>p+1)} disabled={currentPage>=Math.ceil(soldiers.length/itemsPerPage)}>التالي</Button>
                </div>
            </div>
        </div>

       <Dialog open={modalOpen} onOpenChange={setModalOpen}>
    {/* أضفنا mb-20 لرفع النافذة عن الأيقونات السفلية على الهاتف، و sm:mb-0 لإلغائها على الحاسوب */}
<DialogContent 
  // 🛡️ هذا السطر يمنع إغلاق النافذة عند الضغط بالخارج أو بالخطأ أثناء المعالجة
  onPointerDownOutside={(e) => { if (loading) e.preventDefault(); }}
  onEscapeKeyDown={(e) => { if (loading) e.preventDefault(); }}
  className="max-w-md border-2 border-[#c5b391] flex flex-col max-h-[70vh] sm:max-h-[85vh] p-0 overflow-hidden mb-40 sm:mb-0 shadow-2xl rounded-t-2xl sm:rounded-xl" dir="rtl">

        {/* الرأس ثابت - تم إضافة padding لتعويض p-0 في الأب */}
        <DialogHeader className="p-6 border-b pb-2">
            <DialogTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-[#c5b391]"/> {activeEntry?.soldier?.name}
            </DialogTitle>
        </DialogHeader>

        {/* أضفنا pb-20 (Padding Bottom) لضمان إمكانية رفع المحتوى للأعلى عند التمرير */}
<div className="flex-1 overflow-y-auto p-6 pb-20 space-y-4 custom-scrollbar touch-pan-y overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>

            <div className="grid grid-cols-2 gap-2 py-2">
                {STATUS_OPTIONS.map(opt => (
                    <Button 
                        key={opt.id} variant={activeEntry?.status === opt.id ? "default" : "outline"}
                        className={`justify-start gap-2 h-10 text-xs ${activeEntry?.status === opt.id ? 'bg-slate-900 text-white' : ''}`}
                        onClick={()=>setActiveEntry({...activeEntry, status: opt.id})}
                    >
                        <opt.icon className="w-4 h-4" /> {opt.label}
                        {opt.propagate && <span className="mr-auto" title="تعمم تلقائياً"><Check className="w-3 h-3 text-green-500" /></span>}
                    </Button>
                ))}
            </div>

            {/* 1. حقل الدقائق (للتأخير فقط) */}
            {STATUS_OPTIONS.find(o => o.id === activeEntry?.status)?.needsTime && (
                <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 mt-2">
                    <label className="text-[11px] font-bold text-orange-700 block mb-1">الزمن (بالدقائق):</label>
                    <Input 
                        type="number" 
                        placeholder="مثال: 30" 
                        value={activeEntry?.minutes || ""} 
                        onChange={(e) => setActiveEntry({...activeEntry, minutes: e.target.value})} 
                        className="h-9 font-bold border-orange-200" 
                    />
                </div>
            )}

            {/* 2. حقل الملاحظة (لحالة "أخرى" فقط) */}
            {STATUS_OPTIONS.find(o => o.id === activeEntry?.status)?.needsNote && (
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mt-2">
                    <label className="text-[11px] font-bold text-gray-700 block mb-1">وصف الحالة:</label>
                    <Input 
                        placeholder="اكتب نوع الحالة هنا..." 
                        value={activeEntry?.note || ""} 
                        onChange={(e) => setActiveEntry({...activeEntry, note: e.target.value})} 
                        className="h-9 font-bold" 
                    />
                </div>
            )}

            {/* 3. حقل المدة (للحالات الطويلة و "أخرى") */}
            {STATUS_OPTIONS.find(o => o.id === activeEntry?.status)?.needsDuration && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mt-2">
                    <label className="text-[11px] font-bold text-blue-700 block mb-1">المدة (أيام):</label>
                    <Input 
                        type="number" 
                        min="1" 
                        value={activeEntry?.duration || "1"} 
                        onChange={(e) => setActiveEntry({...activeEntry, duration: e.target.value})} 
                        className="h-9 font-bold border-blue-200" 
                    />
                </div>
            )}

            {/* 🟢 حقل تاريخ البداية وحساب تاريخ النهاية */}
            {STATUS_OPTIONS.find(o => o.id === activeEntry?.status)?.needsDuration && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-purple-50 p-2 rounded-lg border border-purple-100">
                        <label className="text-[10px] font-bold text-purple-700 block mb-1">تاريخ البداية:</label>
                        <Input 
                            type="date" 
                            value={activeEntry?.start_date || date} 
                            onChange={(e) => setActiveEntry({...activeEntry, start_date: e.target.value})} 
                            className="h-8 text-xs font-bold" 
                        />
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 opacity-80">
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">تاريخ النهاية (آلي):</label>
                        <div className="h-8 flex items-center px-3 text-xs font-black text-slate-700">
                            {activeEntry?.start_date && activeEntry?.duration ? 
                                format(addDays(new Date(activeEntry.start_date), parseInt(activeEntry.duration) - 1), "yyyy-MM-dd") 
                                : "--"
                            }
                        </div>
                    </div>
                </div>
            )}

            {/* 🟢 خيارات التحكم في التعميم (تظهر للحالات التي تقبل التعميم مثل الإعفاء) */}
            {STATUS_OPTIONS.find(o => o.id === activeEntry?.status)?.propagate && (
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 mt-2">
                    <label className="text-[11px] font-bold text-yellow-800 block mb-2">نطاق الحالة:</label>
                    <div className="flex gap-2">
                        <Button 
                            variant={activeEntry?.isSingleSession ? "default" : "outline"}
                            className={`flex-1 h-8 text-xs ${activeEntry?.isSingleSession ? "bg-yellow-600 hover:bg-yellow-700 text-white" : "border-yellow-300 text-yellow-700"}`}
                            onClick={() => setActiveEntry({ ...activeEntry, isSingleSession: true, duration: "1" })}
                        >
                            هذه الحصة فقط
                        </Button>
                        <Button 
                            variant={!activeEntry?.isSingleSession ? "default" : "outline"}
                            className={`flex-1 h-8 text-xs ${!activeEntry?.isSingleSession ? "bg-yellow-600 hover:bg-yellow-700 text-white" : "border-yellow-300 text-yellow-700"}`}
                            onClick={() => setActiveEntry({ ...activeEntry, isSingleSession: false })}
                        >
                            تعميم (كامل اليوم/المدة)
                        </Button>
                    </div>
                    {!activeEntry?.isSingleSession && (
                        <p className="text-[10px] text-yellow-600 mt-2 font-bold text-center">
                            سيتم تطبيق الحالة على جميع حصص اليوم {activeEntry?.duration > 1 ? `ولمدة ${activeEntry?.duration} أيام` : ""}
                        </p>
                    )}
                </div>
            )}
        </div>
        {/* 🟢 نهاية المنطقة القابلة للتمرير */}

        {/* أضفنا pb-10 للهاتف لرفع زر الحفظ من داخل منطقة الفوتر نفسها */}
<DialogFooter className="p-4 pb-10 sm:pb-4 border-t bg-slate-50 mt-0 flex flex-row gap-2 z-10 sm:p-6">
            {activeEntry?.id && (
                <Button 
                    variant="destructive" 
                    className="flex-1 h-11 font-bold gap-2"
                    onClick={() => {
  // إذا كانت الحصة مقفلة، لا تفتح النافذة وأظهر تنبيه
  if (activeEntry?.isLocked) {
      toast.error("عفواً، لا يمكن حذف سجل معتمد");
  } else {
      setConfirmDeleteId(activeEntry.id); // هذا يفتح نافذة خيارات الحذف عندك
  }
}}
                    disabled={loading}
                >
                    <Trash2 className="w-4 h-4" /> حذف الحالة
                </Button>
            )}
            
            {/* إذا كانت الحصة معتمدة والطالب ليس له سجل سابق (إضافة جديدة) -> عطل الزر */}
{activeEntry?.isLocked && !activeEntry?.id ? (
    <div className="flex-[2] flex items-center justify-center bg-slate-100 text-slate-400 rounded-lg font-bold text-xs h-11 border border-dashed">
        الإضافة غير متاحة (معتمد)
    </div>
) : (
    /* في حالة التعديل أو الحصص غير المعتمدة يظهر الزر العادي */
    <Button 
        onClick={saveStatus} 
        className={`flex-[2] font-bold h-11 ${activeEntry?.isLocked ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-[#c5b391] text-black'}`}
        disabled={loading}
    >
        {loading ? <Loader2 className="animate-spin w-5 h-5"/> : activeEntry?.isLocked ? "حفظ التعديل" : "حفظ وتعميم"}
    </Button>
)}

           {/* 🔴 نافذة تأكيد حذف الحالة (تصميمك الأصلي مع إضافة مؤشرات التحميل) */}
{confirmDeleteId === activeEntry?.id && (
    <div className="absolute inset-0 bg-white z-[100] flex flex-col items-center justify-center p-6 rounded-lg border-2 border-red-500 shadow-2xl animate-in fade-in zoom-in-95">
        <AlertTriangle className="w-10 h-10 text-red-500 mb-2" />
        <h3 className="font-black text-lg mb-1">إدارة الحالات المترابطة</h3>
        <DialogDescription className="text-xs text-slate-500 mb-4 text-center">
            هذه الحصة جزء من سلسلة إجازة/طبية. حدد الإجراء المطلوب:
        </DialogDescription>
        
        <div className="flex flex-col gap-2 w-full max-w-xs">
            {/* 1. حذف الحصة الحالية */}
            <Button 
                variant="outline" 
                className="h-10 text-xs border-slate-200 gap-2" 
                onClick={() => executeDeleteStatus('single')}
                disabled={loading} // 🟢 يمنع الضغط أثناء التحميل
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "حذف هذه الحصة فقط"}
            </Button>

            {/* 2. إنهاء من اليوم فصاعداً */}
            <Button 
                variant="outline" 
                className="h-10 text-xs border-orange-200 text-orange-700 hover:bg-orange-50 gap-2" 
                onClick={() => executeDeleteStatus('group_from_today')}
                disabled={loading}
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "إنهاء من اليوم (حذف المتبقي)"}
            </Button>

            {/* 3. حذف السلسلة كاملة */}
            <Button 
                variant="destructive" 
                className="h-10 text-xs font-bold gap-2 bg-red-600 hover:bg-red-700" 
                onClick={() => executeDeleteStatus('group_full')}
                disabled={loading}
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "إلغاء السلسلة كاملة"}
            </Button>

            {/* زر تراجع */}
            {!loading && (
                <Button 
                    variant="ghost" 
                    className="h-8 text-slate-400 mt-1" 
                    onClick={() => setConfirmDeleteId(null)}
                >
                    تراجع
                </Button>
            )}
        </div>
    </div>
)}
        </DialogFooter>
    </DialogContent>
</Dialog>

        <Dialog open={attachmentModalOpen} onOpenChange={setAttachmentModalOpen}>
            <DialogContent className="max-w-2xl border-2 border-blue-600" dir="rtl">
                <DialogHeader className="border-b pb-2 flex flex-row items-center justify-between">
                    <DialogTitle className="flex items-center gap-2"><Paperclip className="w-5 h-5 text-blue-600"/> المرفقات: {attachmentStudent?.name}</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3 max-h-[350px] overflow-y-auto p-1">
                      {Object.keys(attendanceData).filter(k => k.startsWith(`${attachmentStudent?.id}-ATTACH`)).map(key => {
    const att = attendanceData[key]?.attendance;
    if(!att?.attachment) return null;

    // داخل ماب (map) المرفقات
const fullUrl = att.attachment.startsWith('http') 
    ? att.attachment 
    : att.attachment.startsWith('/static') 
        ? `${process.env.NEXT_PUBLIC_API_URL}${att.attachment}` 
        : att.attachment;

    const isPDF = fullUrl.toLowerCase().includes(".pdf") || fullUrl.includes("application/pdf");

    return (
        <div key={key} className="relative group border rounded-xl overflow-hidden shadow-sm bg-white flex flex-col items-center justify-center p-2 h-40 transition-all hover:shadow-md">
            
            {isPDF ? (
                <div className="flex flex-col items-center justify-center gap-2 w-full h-full bg-red-50/50 rounded-lg border border-red-100">
                    <div className="p-3 bg-red-100 rounded-full">
                        <FileText className="w-8 h-8 text-red-600" />
                    </div>
                    <span className="text-[10px] font-black text-red-700 px-2 text-center line-clamp-1">
                        {att.note || "مستند PDF"}
                    </span>
                </div>
            ) : (
                <img src={fullUrl} className="w-full h-full object-cover rounded-lg" alt="مرفق" />
            )}

            {/* طبقة الأزرار العادية */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity z-10">
                <Button size="sm" variant="secondary" className="h-8 w-8 rounded-full" onClick={() => handleOpenAttachment(att.attachment)}>
                    <Search className="w-4 h-4"/>
                </Button>
                <Button size="sm" variant="destructive" className="h-8 w-8 rounded-full" onClick={() => setConfirmDeleteId(att.id)}>
                    <Trash2 className="w-4 h-4"/>
                </Button>
            </div>

            {/* 🟢 طبقة تأكيد الحذف الجديدة (تظهر عند الضغط على السلة) */}
            {confirmDeleteId === att.id && (
                <div className="absolute inset-0 bg-red-600/95 z-20 flex flex-col items-center justify-center gap-2 p-2 animate-in fade-in zoom-in-95">
                    <AlertTriangle className="w-6 h-6 text-white animate-bounce" />
                    <p className="text-white text-[11px] font-black">هل تريد حذف المرفق؟</p>
                    <div className="flex gap-2">
                        <Button 
                            size="sm" 
                            variant="secondary" 
                            className="h-7 px-3 text-[10px] font-bold" 
                            onClick={() => executeDelete(att.id)}
                            disabled={isDeleting === att.id}
                        >
                            {isDeleting === att.id ? <Loader2 className="w-3 h-3 animate-spin"/> : "نعم، احذف"}
                        </Button>
                        <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 px-3 text-[10px] text-white hover:bg-white/20" 
                            onClick={() => setConfirmDeleteId(null)}
                        >
                            تراجع
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
})}
                        {Object.keys(attendanceData).filter(k => k.startsWith(`${attachmentStudent?.id}-ATTACH`)).length === 0 && (
                            <div className="col-span-full py-12 text-center border-2 border-dashed rounded-xl text-slate-300">
                                <Paperclip className="w-10 h-10 mx-auto opacity-20 mb-2"/>
                                <p className="text-xs font-bold">لا يوجد مرفقات مرفوعة حالياً</p>
                            </div>
                        )}
                    </div>
                    <div className="border-t pt-4">
                        <div className="relative group">
                            <Input type="file" accept="image/*,application/pdf" className="absolute inset-0 opacity-0 cursor-pointer z-20" onChange={(e)=>handleFileUpload(e.target.files?.[0]!)} disabled={isCompressing} />
                            <Button className="w-full gap-2 border-2 border-blue-600 text-blue-700 bg-blue-50 font-bold h-12" variant="outline" disabled={isCompressing}>
                                {isCompressing ? <Loader2 className="animate-spin w-5 h-5"/> : <><Camera className="w-5 h-5"/> اضغط لرفع (صورة أو PDF) جديد</>}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>

        {/* 🟢🟢🟢 حل خطأ الصورة (Empty Src) 🟢🟢🟢 */}
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
            <DialogContent className="max-w-4xl bg-black/95 p-1 border-none shadow-2xl">
                <DialogHeader className="sr-only"><DialogTitle>معاينة المرفق</DialogTitle></DialogHeader>
                {/* 🔴 الشرط السحري: لن يتم رسم الصورة إلا إذا كان الرابط موجوداً */}
                {previewImage && (
                    <img src={previewImage} className="w-full h-auto max-h-[90vh] object-contain mx-auto" />
                )}
            </DialogContent>
        </Dialog>
{loading && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-[200] flex flex-col items-center justify-center">
            <div className="bg-white p-6 rounded-2xl shadow-2xl border-2 border-[#c5b391] flex flex-col items-center gap-4 animate-in zoom-in-95">
              <Loader2 className="w-10 h-10 animate-spin text-[#c5b391]" />
              <div className="text-center">
                <p className="font-black text-slate-800">جاري معالجة السلسلة الزمنية...</p>
                <p className="text-[10px] text-slate-500 font-bold">يرجى عدم إغلاق المتصفح أو النافذة</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}