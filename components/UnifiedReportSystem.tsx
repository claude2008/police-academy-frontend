"use client"

import { useState, useEffect, useMemo, useRef } from "react" // 🔑 إضافة useMemo
import { safePrint } from "@/lib/safePrint"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Printer, Save, FileText, Trash2, Calendar, FileType, RefreshCcw, Search, Edit, ChevronRight, ChevronLeft, Link as LinkIcon, Loader2, ShieldCheck, Unlock, Eye, Filter } from "lucide-react"
import { toast } from "sonner"
import { format, isValid } from "date-fns"
import { ar } from "date-fns/locale"
import { useRouter, useSearchParams } from "next/navigation" // 🟢 إضافة useSearchParams
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface UnifiedReportSystemProps {
    branch: "sports" | "military"
    category: "trainers" | "courses"
    pageTitle: string
}

// 🔑 تحديث نموذج البيانات ليعكس حقول الاعتماد الجديدة
type ReportAPI = {
    id: number
    report_type: string
    date: string
    recipient: string
    subject: string
    content: string
    target_name: string
    target_rank: string
    rec1_name: string
    rec1_rank: string
    rec2_name: string
    rec2_rank: string
    created_at: string
    military_id?: string
    
    // حقول الاعتماد المزدوجة
    officer_approved: boolean
    officer_approver_name: string | null
    officer_approver_rank: string | null
    officer_approver_mil_id: string | null 
    officer_approved_at: string | null
    manager_approved: boolean
    manager_approver_name: string | null
    manager_approver_rank: string | null
    manager_approver_mil_id: string | null
    manager_approved_at: string | null
}

// 🔑 الأدوار التي لها صلاحية الاعتماد والتحكم
const OFFICER_ROLES = ["owner", "manager", "admin", "military_officer", "military_supervisor", "sports_officer"]; 
const MANAGER_ROLES = ["owner", "manager", "admin", "responsible", "military_officer"]; 
const OWNER_ROLES = ["owner", "manager", "admin"]; // للتعديل والحذف بعد الاعتماد (التحكم الكامل)
// 🔑 الأدوار التي تعتبر "مدرب" ويجب منع الملء التلقائي لها
const TRAINER_ROLES = ["military_trainer", "sports_trainer", "trainer"]; 


export default function UnifiedReportSystem({ branch, category, pageTitle }: UnifiedReportSystemProps) {
    const [activeTab, setActiveTab] = useState("new")
    const [loading, setLoading] = useState(false)
    // 🟢 متغيرات نظام المجلدات الجديد
const [viewMode, setViewMode] = useState<'folders' | 'list'>(category === 'courses' ? 'folders' : 'list');
const [reportGroups, setReportGroups] = useState<{ course: string, batch: string, count: number }[]>([]);
const [selectedGroup, setSelectedGroup] = useState<{ course: string, batch: string } | null>(null);
    // متغيرات التعديل والتصفح
    const [editingId, setEditingId] = useState<number | null>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [totalItems, setTotalItems] = useState(0)
    const [folderFilterCourse, setFolderFilterCourse] = useState("all");
const [folderFilterBatch, setFolderFilterBatch] = useState("all");
    // 🔑 متغيرات الصلاحيات والتحكم الجديدة
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userId, setUserId] = useState<number | null>(null);
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
    const [selectedReport, setSelectedReport] = useState<ReportAPI | null>(null);
const searchParams = useSearchParams();
const targetReportId = searchParams.get('report_id'); // 👈 استخراج معرف التقرير من الرابط
    // بيانات النموذج
    const [reportType, setReportType] = useState("إفـــــــــادة")
    const [date, setDate] = useState(format(new Date(), "yyyy/MM/dd"))
    const [deleteId, setDeleteId] = useState<number | null>(null)
    
    const defaultRecipient = branch === "sports" 
        ? "السيد / ضابط فرع التدريب الرياضي" 
        : "السيد / ضابط فرع التدريب العسكري";

    const [customTitles, setCustomTitles] = useState({
    author: "معد التقرير",
    officer: "ضابط فرع التدريب",
    manager: "رئيس قسم التدريب العسكري والرياضي"
});    
    const [recipient, setRecipient] = useState(defaultRecipient)
    const [subject, setSubject] = useState("")
    const [content, setContent] = useState("أفيدكم علماً بأنني ")
    
    const [targetData, setTargetData] = useState({ rank: "", name: "" })
    const [militaryIdInput, setMilitaryIdInput] = useState("") // الرقم العسكري (للمدرب - كاتب التقرير)

    // متغيرات نافذة ربط المجند (الخاصة بقسم الدورات)
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false)
    const [soldierLinkID, setSoldierLinkID] = useState("")
const [isPreviewOnly, setIsPreviewOnly] = useState(false)
    // التوصيات
    const [rec1, setRec1] = useState({ name: "", rank: "", signature: "" })
    const [rec2, setRec2] = useState({ name: "", rank: "", signature: "" })

    const [showRecommendations, setShowRecommendations] = useState(true)
    const [showClosingLine, setShowClosingLine] = useState(true)
    const [savedReports, setSavedReports] = useState<ReportAPI[]>([])

    const [searchQuery, setSearchQuery] = useState("")
    const [signatureUrl, setSignatureUrl] = useState<string | null>(null)

    // نافذة الهاتف
    const [editConfig, setEditConfig] = useState<{ label: string, value: string, onSave: (val: string) => void } | null>(null)
    
    // 🔑 الدالة التي تفتح نافذة الاعتماد
    const openApprovalModal = (report: ReportAPI) => {
        setSelectedReport(report);
        setIsApprovalModalOpen(true);
    };
  const fetchGroupsSummary = async () => {
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/groups-summary?branch=${branch}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
            let data = await res.json();

            // 🔑 جلب صلاحيات المستخدم
            const user = JSON.parse(localStorage.getItem("user") || "{}");
            const scope = user?.extra_permissions?.scope;

            // 🛡️ إذا كان المستخدم مقيداً، نفلتر المجلدات (البطاقات) فوراً
            if (user.role !== 'owner' && scope?.is_restricted) {
                const allowedCourses = scope.courses || [];
                data = data.filter((group: any) => {
                    // صنع المفتاح: "اسم الدورة||الدفعة" للمطابقة مع Scope
                    const groupKey = `${group.course}||${group.batch}`;
                    return allowedCourses.includes(groupKey);
                });
            }

            setReportGroups(data);
        }
    } catch (e) {
        console.error("Error fetching groups", e);
    }
};

// تحديث الـ useEffect ليقرأ المجلدات عند فتح التبويب
// 🟢 تحديث الـ useEffect ليراقب الـ branch أيضاً
useEffect(() => {
    if (activeTab === "records" && category === "courses") {
        fetchGroupsSummary(); 
        
        // إذا تغير الفرع (رياضي/عسكري) نعود لوضع المجلدات ونلغي المجلد المختار سابقاً
        if (viewMode === 'list') {
            setViewMode('folders');
            setSelectedGroup(null);
        }
    }
}, [activeTab, category, branch]); // 👈 إضافة branch هنا هي مفتاح الحل

    const handleMobileClick = (e: React.MouseEvent, label: string, value: string, onSave: (val: string) => void) => {
        if (typeof window !== 'undefined' && window.innerWidth < 768) { 
            e.preventDefault(); 
            (e.target as HTMLInputElement).blur(); 
            setEditConfig({ label, value, onSave });
        }
    }

    // 🧠 دالة تنظيف الأرقام العربية
    const normalizeInput = (val: string) => {
        if (!val) return "";
        return val.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
    }
   const preparedPrintTitle = useRef("تقرير")
   const [printReady, setPrintReady] = useState(false)
   const quickPrint = (report: ReportAPI) => {
    // 1. شحن كافة البيانات في النموذج
    setIsPreviewOnly(true);
    setEditingId(report.id);
    setSelectedReport(report);
    setReportType(report.report_type);
    setDate(report.date);
    setRecipient(report.recipient);
    setSubject(report.subject);
    setContent(report.content);
    setTargetData({ name: report.target_name, rank: report.target_rank });
    setMilitaryIdInput(report.military_id || "");
    setRec1({ name: report.rec1_name, rank: report.rec1_rank, signature: report.rec1_name });
    setRec2({ name: report.rec2_name, rank: report.rec2_rank, signature: report.rec2_name });

    // 2. الانتقال لتبويب المحرر لكي يظهر المحتوى للمتصفح
    preparedPrintTitle.current = report.subject || "تقرير"
    setActiveTab("new");
    setPrintReady(true);
};
    // 🔑 منطق قفل التقرير للتعديل
    const isReportLocked = useMemo(() => {
        if (!editingId || !selectedReport) return false;
        
        // إذا كان معتمداً من أي مرحلة
        const isApproved = selectedReport.officer_approved || selectedReport.manager_approved;
        
        // إذا كان معتمداً والمستخدم ليس من الأدوار العليا، يتم القفل
        return isApproved && !OWNER_ROLES.includes(userRole || '');
        
    }, [editingId, selectedReport, userRole]); 

    // 🔑 جلب بيانات المستخدم وتفقد التوقيع ومنع الملء التلقائي للمدرب
    useEffect(() => {
        let militaryId = "";
        let userRank = "";
        let userName = "";

        try {
            const userStr = localStorage.getItem("user");
            if (userStr) {
                const user = JSON.parse(userStr);
                setUserRole(user.role || "");
                setUserId(user.id || null);
                militaryId = user.military_id || "";
                userRank = user.rank || "";
                userName = user.name || "";
                
                // 🔑 التعديل 2: منع الملء التلقائي إذا كان الدور مدرباً
                if (user) {
    setMilitaryIdInput(user.military_id || "");
    setTargetData({ 
        rank: user.rank || "", 
        name: user.name || "" 
    });
}
                
                // جلب التوقيع الشخصي عند التحميل الأولي
                const checkSignature = async (milId: string) => {
                    try {
                        const url = `${process.env.NEXT_PUBLIC_API_URL}/static/signatures/${milId}.png?t=${new Date().getTime()}`;
                        const res = await fetch(url)
                        if (res.ok) setSignatureUrl(url)
                    } catch (e) { setSignatureUrl(null) }
                }
                if (militaryId) checkSignature(militaryId);
            }
        } catch (e) { /* تجاهل */ }
        
        fetchReports();
    }, [branch, category]) 

    useEffect(() => {
    fetchReports()
}, [currentPage, searchQuery, userId, userRole, itemsPerPage, selectedGroup]);

    useEffect(() => {
        if (rec1.name && !rec1.signature) setRec1(prev => ({ ...prev, signature: rec1.name }))
    }, [rec1.name])

    useEffect(() => {
        if (rec2.name && !rec2.signature) setRec2(prev => ({ ...prev, signature: rec2.name }))
    }, [rec2.name])

  // 🔔 موظف استقبال التقارير الذكي
useEffect(() => {
    const handleDeepLink = async () => {
        if (targetReportId) {
            console.log("🎯 رصد رابط عميق لتقرير، جاري المعالجة...");
            
            try {
                const token = localStorage.getItem("token");
                // 1. جلب بيانات هذا التقرير تحديداً من الباك إند
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/single/${targetReportId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.ok) {
                    const report = await res.json();

                    // 2. التوجه لتبويب السجلات
                    setActiveTab("records");

                    // 3. إذا كان تقرير دورة، يجب فتح المجلد الصحيح أولاً
                    if (category === "courses") {
                        setSelectedGroup({ course: report.course || "عام", batch: report.batch || "عام" });
                        setViewMode('list');
                    }

                    // 4. فتح التقرير للمعاينة فوراً
                    loadReportForEdit(report, true);

                    // 5. تنظيف الرابط لمنع التكرار
                    const newUrl = window.location.pathname;
                    window.history.replaceState({}, '', newUrl);

                    toast.success(`تم فتح المستند: ${report.subject}`);
                }
            } catch (e) {
                console.error("Deep link error", e);
            }
        }
    };

    handleDeepLink();
}, [targetReportId, category]); // 🔄 يراقب المعرف ونوع القسم
   const fetchReports = async () => {
    setLoading(true);
    try {
        const skip = (currentPage - 1) * itemsPerPage;
        const params = new URLSearchParams({
            category: category,
            branch: branch,
            skip: skip.toString(),
            limit: itemsPerPage.toString(),
            search: searchQuery,
            course: selectedGroup?.course || 'all',
            batch: selectedGroup?.batch || 'all',
        });

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (res.ok) {
            const json = await res.json();
            let reportsList = json.data || [];

            const user = JSON.parse(localStorage.getItem("user") || "{}");

            // 🛡️ حماية المدرب: يرى ما كتبه بيده فقط
            if (TRAINER_ROLES.includes(user.role)) {
                reportsList = reportsList.filter((r: any) => r.writer_id === user.id);
            }

            setSavedReports(reportsList);
            setTotalItems(json.total || reportsList.length);
        }
    } catch (e) {
        toast.error("فشل جلب البيانات");
    } finally {
        setLoading(false);
    }
};

    // --- 1. زر الحفظ الرئيسي (يقوم بالتوجيه) ---
    const handleSaveClick = () => {
        // تحقق من البيانات الأساسية للتقرير
        if (!subject || !targetData.name) {
            toast.error("بيانات ناقصة", { description: "يرجى تعبئة الموضوع واسم مقدم الطلب." });
            return;
        }

        // تحقق من أن المدرب كتب رقمه العسكري في خانة التوقيع (لأنه هو الكاتب دائماً)
        if (!militaryIdInput) {
            toast.error("مطلوب", { description: "يرجى كتابة رقمك العسكري في خانة التوقيع بالأسفل." });
            return;
        }

        // أ) إذا كنا نعدل تقريراً قديماً -> نحفظ مباشرة (بالرقم القديم أو المعدل)
        if (editingId) {
            executeSave(null); // لا نغير ربط المجند عند التعديل البسيط حالياً
            return;
        }

        // ب) قسم الدورات (نفتح النافذة)
        if (category === "courses") {
            setSoldierLinkID(""); 
            setIsLinkModalOpen(true);
        } 
        // ج) قسم المدربين
        else {
            executeSave(null); // لا يوجد مجند لربطه
        }
    }

    // --- دالة تنفيذ الحفظ الفعلي (API) ---
    const executeSave = async (soldierMilID: string | null) => {
    setLoading(true);
    try {
        const payload = {
            category, branch,
            military_id: normalizeInput(militaryIdInput),
            soldier_military_id: soldierMilID ? normalizeInput(soldierMilID) : null,
            report_type: reportType,
            date: date,
            recipient: recipient,
            subject: subject,
            content: content,
            target_name: targetData.name,
            target_rank: targetData.rank,
            rec1_name: rec1.name,
            rec1_rank: rec1.rank,
            rec2_name: rec2.name,
            rec2_rank: rec2.rank,
        };

        const method = editingId ? "PUT" : "POST";
        const url = editingId 
            ? `${process.env.NEXT_PUBLIC_API_URL}/reports/${editingId}`
            : `${process.env.NEXT_PUBLIC_API_URL}/reports/`;

        // 🚀 لا نضع Headers هنا، المفتش سيضيف التوكن ونوع البيانات تلقائياً
        const res = await fetch(url, {
    method: method,
    headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}` 
    },
    body: JSON.stringify(payload)
});

        if (res.ok) {
            toast.success(editingId ? "تم التعديل" : "تم الحفظ");
            resetForm();
            setIsLinkModalOpen(false);
            fetchReports();
            setActiveTab("records");
        } else {
            const err = await res.json();
            toast.error(err.detail || "فشل الحفظ");
        }
    } catch (err) {
        toast.error("خطأ في الاتصال بالسيرفر");
    } finally {
        setLoading(false);
    }
}

    const confirmDelete = async () => {
        if (!deleteId) return;
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/${deleteId}`, { 
    method: "DELETE",
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
})
            if (res.ok) {
                toast.success("تم حذف المستند بنجاح")
                fetchReports()
                setDeleteId(null)
            } else {
                const err = await res.json()
                toast.error("فشل الحذف: " + (err.detail || "قد يكون التقرير معتمداً"))
            }
        } catch (e) {
            toast.error("فشل الحذف")
        }
    }

    // 🔑 دالة فتح التقرير للتعديل/المراجعة
    const loadReportForEdit = (r: ReportAPI, previewMode: boolean = false) => {
    setIsPreviewOnly(previewMode); // 👈 تحديد هل هو عرض فقط أم لا
    setEditingId(r.id);
    setSelectedReport(r);
    
    // شحن البيانات
    setReportType(r.report_type);
    setDate(r.date);
    setRecipient(r.recipient);
    setSubject(r.subject);
    setContent(r.content);
    setTargetData({ name: r.target_name, rank: r.target_rank });
    setMilitaryIdInput(r.military_id || "");
    setRec1({ name: r.rec1_name, rank: r.rec1_rank, signature: r.rec1_name });
    setRec2({ name: r.rec2_name, rank: r.rec2_rank, signature: r.rec2_name });
    
    setActiveTab("new");
    setPrintReady(false);
    if (!previewMode) toast.info("وضع التعديل مفعل");
}

    // 🔑 دالة تنفيذ الاعتماد (تفتح من زر في شاشة السجلات)
   const executeApprove = async (level: "officer" | "manager") => {
    if (!selectedReport) return;

    const userStr = localStorage.getItem("user");
    if (!userStr) {
        toast.error("يرجى تسجيل الدخول مجدداً");
        return;
    }
    const user = JSON.parse(userStr);

    if (!user.name || !user.military_id || !user.rank) {
        toast.error("بيانات المسؤول غير مكتملة");
        return;
    }
    
    const endpoint = level === "officer" 
        ? `/reports/approve/officer/${selectedReport.id}` 
        : `/reports/approve/manager/${selectedReport.id}`;

    setLoading(true);
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
    method: "PUT",
    headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}` 
    },
    body: JSON.stringify({
        approver_name: user.name,
        approver_rank: user.rank,
        approver_mil_id: user.military_id,
    })
});

        if (res.ok) {
            toast.success(`تم الاعتماد بنجاح`);

            // 🟢 التحديث الذكي: نقوم بتحديث التقرير المختار حالياً لكي يظهر التوقيع فوراً
            const updatedData = {
                ...selectedReport,
                [level === "officer" ? "officer_approved" : "manager_approved"]: true,
                [level === "officer" ? "officer_approver_name" : "manager_approver_name"]: user.name,
                [level === "officer" ? "officer_approver_rank" : "manager_approver_rank"]: user.rank,
                [level === "officer" ? "officer_approver_mil_id" : "manager_approver_mil_id"]: user.military_id,
            };
            
            setSelectedReport(updatedData); // سيظهر التوقيع في التقرير فوراً
            fetchReports(); // تحديث القائمة في الخلفية
            
        } else {
            const errorData = await res.json();
            toast.error(errorData.detail || "فشل الاعتماد");
        }
    } catch (e) {
        toast.error("خطأ في الاتصال بالسيرفر");
    } finally {
        setLoading(false);
    }
};

    // 🔑 دالة فك الاعتماد (مخصصة للمالكين)
   // 🟢 تحديث الدالة لتستقبل المستوى (officer أو manager)
const executeUnapprove = async (reportId: number, level: "officer" | "manager") => {
    setLoading(true);
    try {
        // نرسل الـ level في الرابط كما جهزناه في الباك إند
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/unapprove/${level}/${reportId}`, {
    method: "PUT",
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
});
        
        if (res.ok) {
            toast.success(`تم فك اعتماد ${level === "manager" ? "رئيس القسم" : "الضابط"} بنجاح`);

            if (selectedReport && selectedReport.id === reportId) {
                // نحدث البيانات محلياً بناءً على المستوى الذي تم فكه فقط
                const updatedData = { ...selectedReport };

                if (level === "manager") {
                    updatedData.manager_approved = false;
                    updatedData.manager_approver_name = null;
                    updatedData.manager_approver_rank = null;
                    updatedData.manager_approver_mil_id = null;
                    updatedData.manager_approved_at = null;
                } else {
                    updatedData.officer_approved = false;
                    updatedData.officer_approver_name = null;
                    updatedData.officer_approver_rank = null;
                    updatedData.officer_approver_mil_id = null;
                    updatedData.officer_approved_at = null;
                }
                
                setSelectedReport(updatedData); 
            }

            fetchReports(); // تحديث القائمة في الخلفية
        } else {
            const err = await res.json();
            toast.error(err.detail || "فشل فك الاعتماد");
        }
    } catch (e) {
        toast.error("خطأ اتصال بالسيرفر");
    } finally {
        setLoading(false);
    }
};

    const resetForm = () => {
        setEditingId(null)
        setSelectedReport(null); // 🔑 تصفير التقرير المختار عند الإلغاء
        setReportType("إفـــــــــادة")
        setDate(format(new Date(), "yyyy/MM/dd"))
        setSubject("")
        setContent("أفيدكم علماً بأنني ")
        setTargetData({ rank: "", name: "" })
        
        // 🔑 التعديل 2: عدم مسح الرقم العسكري للمدرب إذا كان من الأدوار العليا
        if (TRAINER_ROLES.includes(userRole || '')) {
             setMilitaryIdInput("");
        }
        
        toast.success("تم الإلغاء")
        setPrintReady(false)
    }

    const handlePrint = () => {
        document.title = reportType;
        safePrint();
    }

    const handlePrintNow = () => {
        document.title = preparedPrintTitle.current || reportType
        safePrint()
    }

    const getDayName = (dateStr: string) => {
        const d = new Date(dateStr);
        return isValid(d) ? format(d, "EEEE", { locale: ar }) : "---";
    }

    return (
        <div className="space-y-6 pb-10 md:pb-24 " dir="rtl">
            
            <style jsx global>{`
                @media print {
                    @page { size: A4 portrait; margin: 5mm; }
                    nav, aside, header, .print\\:hidden, .no-print, [role="tablist"], .card-footer { display: none !important; }
                    body * { visibility: hidden; }
                    .report-container, .report-container * { visibility: visible; }
                    .report-container { position: absolute; left: 15; top: 5; width: 97%; margin: 0; padding: 0 !important; border: none !important; box-shadow: none !important; background: white !important; display: block !important; }
                    thead { display: table-header-group; }
                    tbody { display: table-row-group; }
                    tr { page-break-inside: avoid; }
                    .content-div { display: block !important; white-space: pre-wrap !important; overflow: visible !important; }
                    input, textarea, .select-trigger { border: none !important; background: transparent !important; padding: 0 !important; resize: none; box-shadow: none !important; }
                    .input-dotted { border-bottom: 1px dotted #000 !important; border-radius: 0 !important; }
                    .lucide, svg { display: none !important; }
                    * { color: black !important; -webkit-print-color-adjust: exact; }
                    .signature-input-container { display: none !important; }
                    .signature-image-container { display: block !important; }
                    .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
                    .sig-h-16 { height: 64px !important; }
                    input, .underline, .underline-offset-8 { 
        text-decoration: none !important; 
        border-bottom: none !important; 
    }
                    /* 🔑 تعديل عرض توقيعات الضابط والمدير */
                    .approver-grid { grid-template-columns: 1fr 1fr 1fr !important; } /* 3 أعمدة فقط */
                }
            `}</style>

            <div className="flex justify-between items-center print:hidden">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className={`w-8 h-8 ${branch === 'sports' ? 'text-blue-600' : 'text-red-600'}`} />
                    {pageTitle}
                </h1>
            </div>

         <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
    
    {/* 🟢 التعديل: إخفاء التابات العلوية إذا كنا داخل مجلد دورة (selectedGroup موجود) */}
    {!selectedGroup && (
        <div className="flex justify-center mb-10 print:hidden w-full px-4 animate-in slide-in-from-top-2">
            <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-6 tabs-list print:hidden ml-auto mr-0">
    <TabsTrigger value="records">
        عرض التقارير المسجلة 
        {/* 🟢 تم إزالة الرقم من هنا نهائياً بناءً على طلبك */}
    </TabsTrigger>
    <TabsTrigger value="new">
        {editingId ? (isPreviewOnly ? "معاينة المستند" : "تعديل المستند") : "تحرير مستند جديد"}
    </TabsTrigger>
</TabsList>
        </div>
    )}
                <TabsContent value="new">
                    <Card className={`max-w-[210mm] mx-auto min-h-[297mm] bg-white text-black report-container relative shadow-lg print:shadow-none ${editingId ? 'border-2 border-yellow-400' : ''}`}>
                        <CardContent className="p-12 space-y-4 print:p-0 h-full flex flex-col">
                            {editingId && (
    <div className={`absolute top-0 right-0 px-4 py-1 text-xs font-bold rounded-bl-lg print:hidden ${isPreviewOnly ? 'bg-emerald-500 text-white' : 'bg-yellow-400 text-black'}`}>
        {isPreviewOnly ? 'وضع المعاينة فقط' : 'وضع التعديل'}
    </div>
)}

                            <table className="w-full border-collapse">
                                <thead className="print:table-header-group">
                                    <tr>
                                        <td>
                                            <div className="hidden print:flex justify-between items-center w-full border-b-2 border-black pb-2 h-[120px] mb-6 align-top">
                                                <div className="flex flex-col items-start gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className="min-w-[80px] text-center border-b border-dotted border-black pb-1 font-bold">{getDayName(date)}</div>
                                                        <span className="font-bold">:اليوم</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="min-w-[80px] text-center border-b border-dotted border-black pb-1 font-bold">{date}</div>
                                                        <span className="font-bold">:التاريخ</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-center">
                                                    <h3 className="font-bold text-xl">قسم التدريب العسكري والرياضي</h3>
                                                    <h3 className="font-bold text-lg mt-1">
                                                        {branch === 'sports' ? 'فرع التدريب الرياضي' : 'فرع التدريب العسكري'}
                                                    </h3>
                                                </div>
                                                <div className="w-20"><img src="/logo.jpg" alt="Logo" className="w-full object-contain" /></div>
                                            </div>
                                        </td>
                                    </tr>
                                </thead>

                                <tbody>
                                    <tr>
                                        <td>
                                            <div className="w-full">
                                                <div className="flex flex-col gap-2 mt-4 px-4 print:px-0">
                                                    <div className="flex justify-between items-end">
                                                        <span className="font-bold text-lg">المحترم</span>
                                                        <div className="flex-grow max-w-[400px] pl-8">
                                                            <Input 
                                                                value={recipient} 
                                                                onChange={(e) => setRecipient(e.target.value)} 
                                                                onClick={(e) => handleMobileClick(e, "الموجه إليه", recipient, setRecipient)} 
                                                                className="font-bold text-lg text-right border-0 rounded-none h-8 w-full bg-transparent p-0 focus:ring-0" 
                                                                readOnly={isReportLocked} 
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="font-bold text-lg text-right pl-8 mt-2">السلام عليكم ورحمة الله وبركاته ... وبعد</div>
                                                </div>

                                                <div className="flex justify-center mt-6 mb-4">
                                                    <Select value={reportType} onValueChange={setReportType}>
                                                        <SelectTrigger className="w-[200px] text-3xl font-extrabold text-center border-none shadow-none focus:ring-0 justify-center h-12 p-0 underline underline-offset-8 decoration-2 bg-transparent" disabled={isReportLocked}>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="إفـــــــــادة">إفـــــــــادة</SelectItem>
                                                            <SelectItem value="تــقــريــر">تــقــريــر</SelectItem>
                                                            <SelectItem value="مــذكــرة">مــذكــرة</SelectItem>
                                                            <SelectItem value="طـلـب شـخصـي">طـلـب شـخصـي</SelectItem>
                                                            <SelectItem value="طـلـب إجـازة">طـلـب إجـازة</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-4 print:space-y-0">
                                                    <div className="flex items-center justify-center gap-2 mt-4 px-8 print:px-0">
                                                        <Input 
                                                            value={subject} 
                                                            onChange={(e) => setSubject(e.target.value)} 
                                                            placeholder="..................................." 
                                                            className="font-bold text-lg text-right border-0 border-b border-dotted border-black rounded-none focus:ring-0 w-full max-w-[400px] h-8 bg-transparent p-0 order-1 input-dotted" 
                                                            readOnly={isReportLocked} 
                                                        />
                                                        <span className="font-extrabold text-lg underline underline-offset-4 flex-shrink-0 order-2">:الموضوع</span>
                                                    </div>
                                                    <div className="print:hidden flex justify-center items-center gap-2 text-sm text-slate-500">
                                                        <span>تاريخ المستند:</span>
                                                        <Input 
                                                            value={date} 
                                                            onChange={(e) => setDate(e.target.value)} 
                                                            className="w-[150px] h-8 text-center bg-slate-50" 
                                                            placeholder="2024/01/01" 
                                                            readOnly={isReportLocked} 
                                                        />
                                                    </div>
                                                </div>

                                                <div className="mt-6 px-4 print:px-0 text-right">
                                                    <Textarea 
                                                        value={content} 
                                                        onChange={(e) => setContent(e.target.value)} 
                                                        className="min-h-[200px] w-full text-xl leading-loose border-none resize-none text-right font-medium shadow-none focus-visible:ring-0 p-0 bg-transparent print:hidden" 
                                                        dir="rtl" 
                                                        style={{ height: 'auto' }} 
                                                        onInput={(e) => { const target = e.target as HTMLTextAreaElement; target.style.height = "auto"; target.style.height = `${target.scrollHeight}px`; }} 
                                                        readOnly={isReportLocked} 
                                                    />
                                                    <div className="hidden print:block text-xl leading-loose text-right font-medium content-div" dir="rtl">{content}</div>
                                                    {showClosingLine && (
                                                        <div className="text-center mt-8 mb-4 relative group break-inside-avoid">
                                                            <p className="font-bold text-lg">وهذا ما لزم التنويه عنه ... ولكم ما ترونه مناسباً</p>
                                                            <div className="delete-btn-container absolute top-1/2 -translate-y-1/2 left-4 print:hidden">
                                                                <Button variant="ghost" size="icon" onClick={() => setShowClosingLine(false)} className="h-8 w-8 text-red-500 hover:bg-red-100" disabled={isReportLocked}><Trash2 className="w-4 h-4" /></Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {!showClosingLine && (
                                                        <div className="text-center mt-2 mb-2 print:hidden">
                                                            <Button variant="outline" size="sm" onClick={() => setShowClosingLine(true)} className="text-xs text-slate-400 border-dashed h-7" disabled={isReportLocked}><RefreshCcw className="w-3 h-3 gap-1" /> استعادة الختام</Button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* 🟢 استبدل كل قسم التوقيعات القديم (من مقدم الطلب وحتى نهاية التوصيات) بهذا الكود الموحد */}
{/* 🟢 قسم التوقيعات الإلكترونية التفاعلي والمباشر */}
<div className="grid grid-cols-3 gap-6 pt-10 text-center border-t-2 border-dashed border-black mt-12 print:mt-8 print:pt-4 break-inside-avoid">
    
    {/* 1. رئيس القسم (يسار) */}
    <div className="flex flex-col items-center gap-1 relative group w-full max-w-[180px]">
    {/* 🟢 استخدام textarea بدلاً من input للسماح بالسطرين في الشاشة */}
    <textarea 
        value={customTitles.manager}
        disabled={selectedReport?.manager_approved}
        rows={2}
        className="no-print text-center font-black text-[12px] md:text-sm leading-tight bg-transparent border-none focus:ring-0 w-full resize-none overflow-hidden print:hidden"
        style={{ height: 'auto', minHeight: '40px' }}
        onChange={(e) => setCustomTitles(prev => ({...prev, manager: e.target.value}))}
    />

    {/* 🟢 نسخة الطباعة: بدون خطوط وتدعم الالتفاف لسطرين */}
    <p className="hidden print:block font-black text-[11px] leading-tight text-center no-underline whitespace-pre-wrap">
        {customTitles.manager}
    </p>
        
        {selectedReport?.manager_approved ? (
            <div className="flex flex-col items-center relative">
                {/* 🔴 زر فك الاعتماد: يظهر عند التحويم (للمدراء فقط) */}
                {MANAGER_ROLES.includes(userRole || '') && (
                    <Button 
                        variant="ghost" size="icon" 
                        className="no-print absolute -top-4 -left-8 text-red-500 opacity-0 group-hover:opacity-100 h-6 w-6 transition-opacity"
                        onClick={() => executeUnapprove(selectedReport.id, "manager")}
                    >
                        <Trash2 className="w-3 h-3" />
                    </Button>
                )}
                <p className="font-black text-[11px] text-blue-900">{selectedReport.manager_approver_rank} / {selectedReport.manager_approver_name}</p>
                {/* توقيع رئيس القسم - سحابة سوبابيز */}
<div className="h-14 mt-1 flex justify-center items-center overflow-hidden"> 
    <img 
        src={`https://cynkoossuwenqxksbdhi.supabase.co/storage/v1/object/public/Signatures/${selectedReport.manager_approver_mil_id}.png`} 
        className="h-full w-auto object-contain mix-blend-multiply print:max-h-10" 
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
            </div>
        ) : (
            <div className="no-print h-20 flex items-center justify-center">
                {/* 🟢 زر اعتماد فوري للمدير (يظهر بعد اعتماد الضابط) */}
                {(MANAGER_ROLES.includes(userRole || '') && selectedReport?.officer_approved) ? (
                    <Button 
                        size="sm" variant="outline" 
                        className="border-green-600 text-green-600 hover:bg-green-600 hover:text-white font-black text-[10px] h-7 px-4 shadow-sm"
                        onClick={() => executeApprove("manager")}
                    >
                        اعتماد رئيس القسم
                    </Button>
                ) : (
                    <span className="text-slate-300 text-[9px] border border-dashed border-slate-200 px-3 py-1 rounded-lg italic">بانتظار الاعتماد</span>
                )}
            </div>
        )}
    </div>

    {/* 2. الضابط المباشر (وسط) */}
    <div className="flex flex-col items-center gap-1 border-x border-slate-100 print:border-none px-2 relative group">
        <input 
            type="text"
            value={customTitles.officer}
            disabled={selectedReport?.officer_approved}
            className="no-print text-center font-black text-sm underline underline-offset-8 mb-3 bg-transparent border-none focus:ring-0 w-full"
            onChange={(e) => setCustomTitles(prev => ({...prev, officer: e.target.value}))}
        />
        <p className="hidden print:block font-black text-xs underline underline-offset-8 mb-4">{customTitles.officer}</p>

        {selectedReport?.officer_approved ? (
            <div className="flex flex-col items-center relative">
                {/* 🔴 زر فك الاعتماد: يظهر عند التحويم (للضباط أو المدراء) */}
                {(OFFICER_ROLES.includes(userRole || '')) && !selectedReport.manager_approved && (
                    <Button 
                        variant="ghost" size="icon" 
                        className="no-print absolute -top-4 -left-8 text-red-500 opacity-0 group-hover:opacity-100 h-6 w-6 transition-opacity"
                        onClick={() => executeUnapprove(selectedReport.id, "officer")}
                    >
                        <Trash2 className="w-3 h-3" />
                    </Button>
                )}
                <p className="font-black text-[11px] text-blue-900">{selectedReport.officer_approver_rank} / {selectedReport.officer_approver_name}</p>
                {/* توقيع الضابط - سحابة سوبابيز */}
<div className="h-14 mt-1 flex justify-center items-center overflow-hidden"> 
    <img 
        src={`https://cynkoossuwenqxksbdhi.supabase.co/storage/v1/object/public/Signatures/${selectedReport.officer_approver_mil_id}.png`} 
        className="h-full w-auto object-contain mix-blend-multiply print:max-h-10" 
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
            </div>
        ) : (
            <div className="no-print h-20 flex items-center justify-center">
                {/* 🟢 زر اعتماد فوري للضابط */}
                {OFFICER_ROLES.includes(userRole || '') ? (
                    <Button 
                        size="sm" variant="outline" 
                        className="border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white font-black text-[10px] h-7 px-4 shadow-sm"
                        onClick={() => executeApprove("officer")}
                    >
                        اعتماد الضابط
                    </Button>
                ) : (
                    <span className="text-slate-300 text-[9px] border border-dashed border-slate-200 px-3 py-1 rounded-lg italic">بانتظار الاعتماد</span>
                )}
            </div>
        )}
    </div>

    {/* 3. معد التقرير (يمين) */}
    <div className="flex flex-col items-center gap-1">
        <input 
            type="text"
            value={customTitles.author}
            disabled={!!editingId}
            className="no-print text-center font-black text-sm underline underline-offset-8 mb-3 bg-transparent border-none focus:ring-0 w-full"
            onChange={(e) => setCustomTitles(prev => ({...prev, author: e.target.value}))}
        />
        <p className="hidden print:block font-black text-xs underline underline-offset-8 mb-4">{customTitles.author}</p>
        
        <div className="flex flex-col items-center">
            <p className="font-black text-[11px] text-slate-900">{targetData.rank} / {targetData.name}</p>
            {/* توقيع معد التقرير - سحابة سوبابيز */}
{militaryIdInput && (
    <div className="h-14 mt-1 flex justify-center items-center overflow-hidden"> 
        <img 
            src={`https://cynkoossuwenqxksbdhi.supabase.co/storage/v1/object/public/Signatures/${militaryIdInput}.png`} 
            className="h-full w-auto object-contain mix-blend-multiply print:max-h-10" 
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
)}
        </div>
    </div>
</div>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </CardContent>

                        <CardFooter className="flex flex-wrap justify-between bg-slate-50 border-t p-6 print:hidden gap-4 card-footer">
    <div className="flex items-center gap-2">
        {/* زر الإغلاق/الإلغاء: يتغير نصه ولونه حسب الوضع */}
        <Button 
            variant="outline" 
            onClick={resetForm} 
            className={isPreviewOnly ? "border-slate-400 bg-white" : "border-red-200 text-red-600 hover:bg-red-50"}
        >
            {isPreviewOnly ? "إغلاق المعاينة" : (editingId ? "إلغاء التعديل" : "مسح المحتوى")}
        </Button>

        {/* زر التوصيات: يختفي في وضع المعاينة المقفل تماماً */}
        {!isReportLocked && (
            <Button variant="ghost" onClick={() => setShowRecommendations(!showRecommendations)} className="text-xs text-slate-500">
                {showRecommendations ? "إخفاء التوصيات" : "إظهار التوصيات"}
            </Button>
        )}
    </div>

    <div className="flex gap-3">
        {printReady ? (
            <Button onClick={handlePrintNow} variant="outline" className="gap-2 border-slate-900 bg-slate-900 text-white hover:bg-slate-800">
                <Printer className="w-4 h-4" /> اطبع الآن
            </Button>
        ) : (
            <Button onClick={handlePrint} variant="outline" className="gap-2 border-slate-400">
                <Printer className="w-4 h-4" /> طباعة
            </Button>
        )}

        {/* زر الحفظ: لا يظهر أبداً إذا كنا في وضع المعاينة (العين) */}
        {!isPreviewOnly && (
            <Button 
                onClick={handleSaveClick} 
                disabled={loading || isReportLocked} 
                className={`gap-2 text-white min-w-[120px] ${editingId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
                {loading ? (
                    <> <Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ... </>
                ) : (
                    <> <Save className="w-4 h-4" /> {editingId ? "حفظ التعديلات" : "حفظ في السجلات"} </>
                )}
            </Button>
        )}

        {/* زر إضافي يظهر فقط في المعاينة للرجوع للسجل بسرعة */}
        {isPreviewOnly && (
            <Button onClick={() => setActiveTab("records")} className="bg-slate-800 text-white hover:bg-slate-900 gap-2">
                <ChevronLeft className="w-4 h-4" /> العودة للسجلات
            </Button>
        )}
    </div>
</CardFooter>
                    </Card>
                </TabsContent>

                <TabsContent value="records">
    {category === 'courses' && viewMode === 'folders' ? (
        <div className="space-y-6 animate-in fade-in duration-500">
            
            {/* 🟢 شريط الفرز المصغر والأنيق (بيج هادئ) */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-[#c5b391]/5 rounded-xl border border-[#c5b391]/20" dir="rtl">
                <div className="flex items-center gap-2 text-[#8b7355] font-black text-xs ml-2">
                    <Filter className="w-4 h-4" /> فرز الأرشيف:
                </div>

                {/* قائمة الدورة */}
<Select value={folderFilterCourse} onValueChange={setFolderFilterCourse}>
    <SelectTrigger className="w-[160px] h-8 text-xs bg-white border-[#c5b391]/30 font-bold">
        <SelectValue placeholder="اختيار الدورة" />
    </SelectTrigger>
    <SelectContent>
        <SelectItem value="all">كل الدورات</SelectItem>
        {/* 🟢 نعتمد على reportGroups المفلترة سابقاً */}
        {Array.from(new Set(reportGroups.map(g => g.course))).map(c => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
        ))}
    </SelectContent>
</Select>

{/* قائمة الدفعة */}
<Select value={folderFilterBatch} onValueChange={setFolderFilterBatch}>
    <SelectTrigger className="w-[140px] h-8 text-xs bg-white border-[#c5b391]/30 font-bold">
        <SelectValue placeholder="اختيار الدفعة" />
    </SelectTrigger>
    <SelectContent>
        <SelectItem value="all">كل الدفعات</SelectItem>
        {Array.from(new Set(reportGroups.map(g => g.batch))).map(b => (
            <SelectItem key={b} value={b}>{b}</SelectItem>
        ))}
    </SelectContent>
</Select>

                {/* زر تصفير سريع يظهر عند الحاجة */}
                {(folderFilterCourse !== 'all' || folderFilterBatch !== 'all') && (
                    <Button 
                        variant="ghost" 
                        onClick={() => { setFolderFilterCourse('all'); setFolderFilterBatch('all'); }}
                        className="h-7 text-[10px] text-red-500 hover:text-red-600 font-bold"
                    >
                        إلغاء الفرز
                    </Button>
                )}
            </div>

            {/* 🟢 عرض المجلدات (تصميم أرشيف ملكي) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-right" dir="rtl">
                {reportGroups.length === 0 ? (
                    <div className="col-span-full text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed">
                        <p className="text-slate-400 font-bold">لا توجد سجلات مؤرشفة لهذا الفرع</p>
                    </div>
                ) : (
                    reportGroups
                    .filter(g => (folderFilterCourse === 'all' || g.course === folderFilterCourse))
                    .filter(g => (folderFilterBatch === 'all' || g.batch === folderFilterBatch))
                    .map((group, idx) => (
                        <Card 
                            key={idx} 
                            className="cursor-pointer hover:shadow-lg transition-all border-none bg-white rounded-2xl group relative overflow-hidden ring-1 ring-slate-200 hover:ring-[#c5b391]"
                            onClick={() => {
        // 1. 🟢 تفريغ القائمة القديمة فوراً لمنع ظهور بيانات سابقة بالخطأ
        setSavedReports([]); 
        setTotalItems(0);

        // 2. تعيين المجموعة المختارة وبدء التحميل
        setSelectedGroup({ course: group.course, batch: group.batch });
        setViewMode('list');
        setCurrentPage(1);
                            }}
                        >
                            <CardHeader className="pb-3 pt-4">
                                <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                                    <div className="w-8 h-8 bg-[#c5b391]/10 rounded-lg flex items-center justify-center">
                                        <FileType className="w-4 h-4 text-[#c5b391]" />
                                    </div>
                                    <span className="truncate">{group.course}</span>
                                </CardTitle>
                                <p className="text-xs font-bold text-slate-500 mt-1 mr-10 italic">الدفعة: {group.batch}</p>
                            </CardHeader>
                            <CardContent className="pb-4">
                                <div className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-xl group-hover:bg-[#c5b391]/5 transition-colors">
                                    <span className="text-[10px] font-black text-[#8b7355]">{group.count} مستند مؤرشف</span>
                                    <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-[#c5b391] transition-transform group-hover:-translate-x-1" />
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    ) : (
        /* 🟢 عرض قائمة التقارير (الكود الأصلي الخاص بك) */
        <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-400" dir="rtl" >
            {/* زر العودة الصغير */}
            {category === 'courses' && selectedGroup && (
                <Button 
                    variant="ghost" 
                    onClick={() => { setViewMode('folders'); setSelectedGroup(null); }}
                    className="text- hover:bg-[#c5b391]/10 font-black h-8 text-xs rounded-lg"
                >
                    <ChevronRight className="w-4 h-4 ml-1" /> العودة للأرشيف
                </Button>
            )}

            {/* شريط البحث المعتاد في القائمة */}
            <div className="relative">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input 
                    placeholder="بحث في هذا المجلد..." 
                    className="pr-9 h-9 rounded-xl border-slate-200 focus:border-[#c5b391]" 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                />
            </div>

                {loading ? (
    <div className="flex flex-col items-center justify-center py-20 animate-in fade-in">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-500 font-bold">جاري جلب التقارير...</p>
    </div>
) : savedReports.length === 0 ? (
    <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed">
        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">لا توجد مستندات للعرض.</p>
    </div>
) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-right" dir="rtl">
                        {savedReports.map((report) => (
                            <Card 
                                key={report.id} 
                                onClick={() => loadReportForEdit(report, true)}
                                className={`
                                    relative cursor-pointer transition-all duration-300 group
                                    hover:shadow-xl hover:-translate-y-1 border-r-4 border-l-0 rounded-2xl
                                    ${report.id === editingId ? 'border-r-yellow-500 bg-yellow-50' : 'border-r-[#c5b391]'}
                                `}
                            >
                                <CardHeader className="pb-3 pt-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                                            <Calendar className="w-3 h-3 text-[#c5b391]" /> {report.date}
                                        </div>
                                        <div className="bg-[#c5b391]/10 text-[#8b7355] px-2 py-0.5 rounded-lg text-[10px] font-bold border border-[#c5b391]/20">
                                            {report.report_type}
                                        </div>
                                    </div>
                                    <CardTitle className="text-lg font-bold leading-tight line-clamp-1" title={report.subject}>
                                        {report.subject}
                                    </CardTitle>
                                    <div className="flex items-center gap-1 text-xs text-slate-600 mt-2 font-medium">
                                        <FileType className="w-3 h-3 text-[#c5b391]" />
                                        <span>{report.target_rank} / {report.target_name}</span>
                                    </div>
                                    <div className="flex justify-start gap-2 mt-2">
                                        {report.manager_approved ? (
                                            <span className="text-[10px] bg-green-600 text-white px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-sm"><ShieldCheck className="w-3 h-3"/> معتمد: رئيس القسم</span>
                                        ) : report.officer_approved ? (
                                            <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-sm"><ShieldCheck className="w-3 h-3"/> معتمد: الضابط</span>
                                        ) : (
                                            <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-bold border border-yellow-200">قيد المراجعة</span>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardFooter 
                                    className="pt-2 border-t border-slate-50 flex justify-between bg-slate-50/50 h-auto py-3 px-4 items-center flex-wrap gap-2 rounded-b-2xl"
                                    onClick={(e) => e.stopPropagation()} 
                                >
                                    <div className="flex gap-2 items-center">
                                        {(!report.officer_approved || OWNER_ROLES.includes(userRole || '')) && (
                                            <>
                                                <Button 
                                                    variant="ghost" size="sm" 
                                                    className="text-red-500 hover:bg-red-100 p-2 h-9 w-9 rounded-full transition-colors"
                                                    onClick={(e) => { e.stopPropagation(); setDeleteId(report.id); }}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                                <Button 
                                                    variant="ghost" size="sm" 
                                                    className="text-blue-600 hover:bg-blue-100 p-2 h-9 w-9 rounded-full transition-colors"
                                                    onClick={(e) => { e.stopPropagation(); loadReportForEdit(report, false); }}
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={(e) => { e.stopPropagation(); quickPrint(report); }}
                                        className="text-slate-600 border-slate-200 hover:bg-white h-8 gap-2 text-[10px] font-bold rounded-lg shadow-sm"
                                    >
                                        طباعة <Printer className="w-3 h-3 text-[#c5b391]" />
                                    </Button>
                                </CardFooter>
                                <div className="absolute inset-0 bg-[#c5b391]/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none rounded-2xl">
                                    <span className="bg-[#c5b391] text-white text-[10px] px-3 py-1 rounded-full font-bold shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform">
                                       فتح المستند
                                    </span>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

                {/* شريط الصفحات المطور */}
                {totalItems > 0 && (
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-8 py-4 border-t border-slate-100 bg-slate-50/50 px-4 rounded-2xl">
                        <div className="text-xs text-slate-500 font-bold">
                            عرض {((currentPage - 1) * itemsPerPage) + 1} إلى {Math.min(currentPage * itemsPerPage, totalItems)} من أصل {totalItems} مستند
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-600">عرض في الصفحة:</span>
                            <Select 
                                value={String(itemsPerPage)} 
                                onValueChange={(val) => {
                                    setItemsPerPage(Number(val));
                                    setCurrentPage(1);
                                }}
                            >
                                <SelectTrigger className="w-[80px] h-9 text-xs bg-white rounded-xl border-slate-200 focus:ring-[#c5b391]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="20">20</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="100">100</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                            <Button 
                                variant="outline" size="sm" 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                                disabled={currentPage === 1}
                                className="gap-1 h-8 px-3 bg-white hover:bg-slate-50 border-none font-bold"
                            >
                                <ChevronRight className="w-4 h-4 text-[#c5b391]" /> السابق
                            </Button>
                            <div className="flex items-center justify-center min-w-[32px] h-8 font-black text-sm bg-[#c5b391] text-white rounded-lg shadow-inner">
                                {currentPage}
                            </div>
                            <Button 
                                variant="outline" size="sm" 
                                onClick={() => setCurrentPage(p => p + 1)} 
                                disabled={currentPage >= Math.ceil(totalItems / itemsPerPage)}
                                className="gap-1 h-8 px-3 bg-white hover:bg-slate-50 border-none font-bold"
                            >
                                التالي <ChevronLeft className="w-4 h-4 text-[#c5b391]" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        )}
    </TabsContent>
</Tabs>
            
            {/* نوافذ الهاتف والرسائل الأخرى */}
            <Dialog open={!!editConfig} onOpenChange={(open) => !open && setEditConfig(null)}>
                <DialogContent className="w-[90%] rounded-lg top-[30%]" dir="rtl">
                    <DialogHeader><DialogTitle>إدخال {editConfig?.label}</DialogTitle></DialogHeader>
                    <div className="py-4"><Input autoFocus className="text-lg font-bold h-12 text-center bg-slate-50" value={editConfig?.value || ""} onChange={(e) => setEditConfig(prev => prev ? ({ ...prev, value: e.target.value }) : null)} onKeyDown={(e) => { if (e.key === 'Enter') { if(editConfig) editConfig.onSave(editConfig.value); setEditConfig(null); } }} /></div>
                    <DialogFooter><Button onClick={() => { if(editConfig) editConfig.onSave(editConfig.value); setEditConfig(null); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white">موافق</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* نافذة ربط المجند الجديدة (للدورات) */}
            <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
                <DialogContent className="max-w-sm" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><LinkIcon className="w-5 h-5 text-blue-600" /> ربط المستند بالمجند</DialogTitle>
                        <DialogDescription>لإكمال الحفظ، يرجى إدخال الرقم العسكري للمجند.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-2">
                        <label className="text-sm font-bold">الرقم العسكري للمجند:</label>
                        <Input 
                            value={soldierLinkID} 
                            onChange={(e) => setSoldierLinkID(normalizeInput(e.target.value))} 
                            placeholder="202..." 
                            className="text-center font-bold text-lg bg-slate-50 border-blue-200"
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsLinkModalOpen(false)}>إلغاء</Button>
                        <Button onClick={() => { 
                            if(!soldierLinkID) { toast.error("يرجى إدخال الرقم"); return; } 
                            executeSave(soldierLinkID); 
                        }} disabled={loading} className="bg-blue-600 text-white gap-2">
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            تأكيد وحفظ
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            

            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                            <Trash2 className="w-5 h-5" /> تأكيد الحذف
                        </AlertDialogTitle>
                        <AlertDialogDescription>هل أنت متأكد أنك تريد حذف هذا المستند نهائياً؟<br />لا يمكن التراجع عن هذا الإجراء بعد تنفيذه.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">نعم، احذف المستند</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}