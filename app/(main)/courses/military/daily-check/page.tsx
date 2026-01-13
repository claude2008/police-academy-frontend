"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Plus, Trash2, Save, Printer, FileSpreadsheet, Loader2, AlertTriangle, User, UserPlus, CheckCircle2, HelpCircle, Clock, Stethoscope, Tent, FileText, UserMinus, PenTool, FileCheck, ArrowRight, UserCheck, Calendar, ShieldCheck, Hourglass,Unlock, XCircle } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import * as XLSX from 'xlsx'
import ProtectedRoute from "@/components/ProtectedRoute"
const STATUS_OPTIONS = [
  { id: "absent", label: "غياب", color: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle },
  { id: "exempt", label: "إعفاء", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: AlertTriangle },
  { id: "clinic", label: "عيادة", color: "bg-cyan-100 text-cyan-700 border-cyan-200", icon: Stethoscope },
  { id: "medical", label: "طبية", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Stethoscope },
  { id: "leave", label: "إجازة", color: "bg-green-100 text-green-700 border-green-200", icon: Tent },
  { id: "admin_leave", label: "إجازة إدارية", color: "bg-green-100 text-green-700 border-green-200", icon: FileText },
  { id: "death_leave", label: "إجازة وفاة", color: "bg-gray-100 text-gray-700 border-gray-200", icon: UserMinus },
  { id: "late_parade", label: "تأخير عن التكميل", color: "bg-orange-100 text-orange-700 border-orange-200", icon: Clock },
  { id: "late_class", label: "تأخير عن الحصة", color: "bg-orange-100 text-orange-700 border-orange-200", icon: Clock },
  { id: "rest", label: "استراحة", color: "bg-slate-100 text-slate-700 border-slate-200", icon: HelpCircle },
  { id: "other", label: "أخرى", color: "bg-gray-200 text-gray-800 border-gray-300", icon: HelpCircle },
]
const findStatusObj = (val: string) => {
    // نحاول البحث عن تطابق في العنوان
    const found = STATUS_OPTIONS.find(opt => val.includes(opt.label));
    return found || null;
};
export default function MilitaryDailyCheckPage() {
    const [currentDate, setCurrentDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [reviewDate, setReviewDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [shift, setShift] = useState("morning")
    const [filterCourse, setFilterCourse] = useState("all")
    const [filterBatch, setFilterBatch] = useState("all")
    const [filterOptions, setFilterOptions] = useState<any>({ courses: [], batches: [] })
    const [totalCourseStrength, setTotalCourseStrength] = useState(0)
    const [reviewTotalStrength, setReviewTotalStrength] = useState(0)
    const [rows, setRows] = useState<any[]>([])
    const [writerMilId, setWriterMilId] = useState("")
    const [writerRank, setWriterRank] = useState("")
    const [writerName, setWriterName] = useState("")
    const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
    const [savedRecords, setSavedRecords] = useState<any[]>([])
    const [loadingSaved, setLoadingSaved] = useState(false)
    const [selectedSession, setSelectedSession] = useState<any>(null)
    const [approverRank, setApproverRank] = useState("")
    const [approverName, setApproverName] = useState("")
    const [isApproving, setIsApproving] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [statusModal, setStatusModal] = useState<{ isOpen: boolean, rowIndex: number | null }>({ isOpen: false, rowIndex: null })
    const [notesModal, setNotesModal] = useState<{ isOpen: boolean, rowIndex: number | null, text: string }>({ isOpen: false, rowIndex: null, text: "" })
    const [mobileAddOpen, setMobileAddOpen] = useState(false)
    const [mobileMilId, setMobileMilId] = useState("")
    const [officerModal, setOfficerModal] = useState<{ isOpen: boolean, field: string, value: string, setter: any }>({ isOpen: false, field: "", value: "", setter: null })
    const [officerInputValue, setOfficerInputValue] = useState("")
    const [selectedStatusObj, setSelectedStatusObj] = useState<any>(null)
    const [modalDuration, setModalDuration] = useState("1")
    const [modalStartDate, setModalStartDate] = useState(currentDate)
    const [modalLateMinutes, setModalLateMinutes] = useState("")
    const [modalCustomNote, setModalCustomNote] = useState("")
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [isSessionLocked, setIsSessionLocked] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [rowToDelete, setRowToDelete] = useState<any>(null);
    const [unapproveConfirmOpen, setUnapproveConfirmOpen] = useState(false)
    const [isDirty, setIsDirty] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null)
    const UNAPPROVE_ROLES = ["owner", "manager", "admin", "military_officer"];
    const REVIEW_ADMIN_ROLES = ["owner", "manager", "admin", "military_officer", "military_supervisor"];
    const APPROVE_ROLES = ["owner", "manager", "responsible", "military_officer"];
    const ENTRY_ROLES = ["owner", "manager", "admin", "military_officer", "military_supervisor", "military_trainer"];
    const normalizeInput = (val: string) => val ? val.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString()) : "";
    const isAddDisabled = useMemo(() => {
        return isSessionLocked || filterCourse === 'all' || filterBatch === 'all';
    }, [isSessionLocked, filterCourse, filterBatch]);
    // 🔑 الدالة الجديدة: تستخدم الرقم العسكري للتحقق من التوقيع الشخصي
const checkSavedSignature = async (milId: string | null) => {
    if (!milId) return;
    try {
        // المسار الجديد: static/signatures/الرقم_العسكري.png
        const url = `${process.env.NEXT_PUBLIC_API_URL}/static/signatures/${milId}.png?t=${new Date().getTime()}`;
        const res = await fetch(url)
        if (res.ok) {
            setSignatureUrl(url)
        } else {
            setSignatureUrl(null)
        }
    } catch (e) {
        setSignatureUrl(null)
    }
}
    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const params = new URLSearchParams()
                if (filterCourse !== 'all') params.append('course', filterCourse)
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/filters-options?${params.toString()}`)
                if (res.ok) {
                    const data = await res.json()
                    setFilterOptions((prev: any) => ({ ...prev, batches: data.batches, courses: prev.courses.length ? prev.courses : data.courses }))
                }
            } catch (e) { }
        }
        fetchFilters()
    }, [filterCourse])

   useEffect(() => {
    // 1. تصفير حالة التعديلات فور الدخول للصفحة لضمان عدم ظهور الرسالة بالخطأ
    setIsDirty(false);

    let militaryId = ""; 
    try {
        const userStr = localStorage.getItem("user");
        if (userStr) {
            const user = JSON.parse(userStr);
            militaryId = user.military_id || "";
            setWriterMilId(militaryId);
            setWriterRank(user.rank || "");
            setWriterName(user.name || "");
            setUserRole(user.role || "");
            setApproverRank(user.rank || "");
            setApproverName(user.name || "");
        }
    } catch (e) { }

    if (militaryId) {
        checkSavedSignature(militaryId); 
    }

    // 2. 🚀 دالة التنظيف: يتم تنفيذها بمجرد خروج المستخدم من هذه الصفحة
    return () => {
        setIsDirty(false);
    };
}, []);

useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = "لديك تعديلات غير محفوظة، هل أنت متأكد من المغادرة؟";
    }
  };

  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, [isDirty]);

    useEffect(() => {
        if (filterCourse === 'all' || filterBatch === 'all') { setTotalCourseStrength(0); return; }
        const fetchStrength = async () => {
            try {
                const params = new URLSearchParams({ limit: "1", course: filterCourse, batch: filterBatch });
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/?${params.toString()}`)
                const data = await res.json()
                setTotalCourseStrength(data.total || 0)
            } catch (e) { }
        }
        fetchStrength();
    }, [filterCourse, filterBatch])

    useEffect(() => {
        if (!selectedSession) { setReviewTotalStrength(0); return; }
        const fetchReviewStrength = async () => {
            try {
                const params = new URLSearchParams({ limit: "1", course: selectedSession.course_name, batch: selectedSession.batch_name });
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/?${params.toString()}`)
                const data = await res.json()
                setReviewTotalStrength(data.total || 0)
            } catch (e) { }
        }
        fetchReviewStrength();
    }, [selectedSession])
   useEffect(() => {
    let militaryId = "";
    
    // 🚀 الملء التلقائي وبيانات المستخدم
    try {
        const userStr = localStorage.getItem("user");
        if (userStr) {
            const user = JSON.parse(userStr);
            militaryId = user.military_id || ""; // 🔑 استخراج الرقم العسكري

            // 🔑 إعادة تعيين البيانات
            setWriterMilId(militaryId); 
            setWriterRank(user.rank || "");
            setWriterName(user.name || "");
            setApproverRank(user.rank || "");
            setApproverName(user.name || "");
            
            // 🔑 تفقد التوقيع الشخصي
            checkSavedSignature(militaryId); 
        }
    } catch (e) { /* تجاهل أخطاء localStorage */ }

}, []); // هذا الـ useEffect يعمل مرة واحدة عند التحميل.

    const loadExistingData = async () => {
    // 1. تصفير الحالات المبدئية
    setRows([]); 
    
    // التحقق من الفلاتر الأساسية
    if (filterCourse === 'all' || filterBatch === 'all') {
        setIsSessionLocked(false);
        return;
    }

    try {
        const params = new URLSearchParams({
            start_date: currentDate,
            end_date: currentDate,
            class_type: "military",
            shift: shift,
            course_name: filterCourse,
            batch_name: filterBatch,
            entry_type: "status",
            limit: "500" 
        });

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance/?${params.toString()}`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });

        if (res.ok) {
            const data = await res.json();
            
            if (data.length > 0) {
                // 🔑 التعديل الجوهري: فحص حالة الاعتماد من أول سجل في القائمة
                const isApproved = data[0].is_approved;
                setIsSessionLocked(isApproved);

                // تحويل البيانات القادمة من الباك إند إلى هيكل الجدول
                const mappedRows = data.map((rec: any) => {
                    let note = "";
                    const statusObj = findStatusObj(rec.value);
                    
                    if (rec.is_custom) {
                        note = rec.value;
                    } else if (rec.value.includes('(')) {
                        const match = rec.value.match(/\(([^)]+)\)/);
                        if (match) note = match[1];
                    }

                    return {
                        id: rec.id, 
                        soldierDbId: rec.soldier.id,
                        militaryId: rec.soldier.military_id,
                        name: rec.soldier.name,
                        rank: rec.soldier.rank,
                        company: rec.soldier.company,
                        platoon: rec.soldier.platoon,
                        status: statusObj || (rec.is_custom ? STATUS_OPTIONS.find(o => o.id === 'other') : null),
                        duration: "1", 
                        startDate: rec.date,
                        note: note,
                        isNew: false
                    };
                });

                setRows(mappedRows);

                // إظهار تنبيه إذا كان الكشف مقفلاً
                if (isApproved) {
                    toast.info("تنبيه: هذا الكشف معتمد حالياً ولا يمكن التعديل عليه");
                }
            } else {
                // إذا لم توجد بيانات، الكشف بالتأكيد غير معتمد (مفتوح)
                setIsSessionLocked(false);
                setRows([]); 
            }
        } else {
            // في حال فشل الاستجابة من السيرفر
            setIsSessionLocked(false);
        }
    } catch (e) {
        console.error("Failed to load existing attendance", e);
        setIsSessionLocked(false);
    }
};
    // ✅ (جديد) استرجاع البيانات المحفوظة عند تغيير الفلاتر لتمكين التعديل
    useEffect(() => {
        // لا نقوم بالجلب إذا لم يتم اختيار الدورة والدفعة
        if (filterCourse === 'all' || filterBatch === 'all') {
            setRows([]); // تصفير الجدول
            return;
        }
        loadExistingData();

    }, [currentDate, shift, filterCourse, filterBatch]); // يعمل عند تغيير أي من هذه القيم
    // في ملف MilitaryDailyCheckPage.tsx

// في ملف MilitaryDailyCheckPage.tsx

const fetchSavedRecords = async () => {
    setLoadingSaved(true)
    setSelectedSession(null)
    const token = localStorage.getItem("token"); // 🔑 جلب التوكن

    try {
        const params = new URLSearchParams({ 
            start_date: reviewDate, 
            end_date: reviewDate, 
            class_type: "military", 
            entry_type: "status",
            limit: "2000"
        });

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance/?${params.toString()}`, {
            headers: { "Authorization": `Bearer ${token}` } // 🛡️ حماية كشف التكميل
        });
        
        if (res.ok) {
            const data = await res.json();
            setSavedRecords(data);
        } else { toast.error("فشل جلب السجلات"); }
    } catch (e) { console.error(e); } finally { setLoadingSaved(false); }
}

 // في ملف MilitaryDailyCheckPage.tsx - استبدل دالة groupedSessions بالكامل

const groupedSessions = useMemo(() => {
    const sessions: any = {};
    const currentUserMilId = writerMilId;
    const currentUserRole = userRole;
    
    // 🔑 تحديد ما إذا كان يجب رؤية كل السجلات (للمدراء)
    const viewAll = REVIEW_ADMIN_ROLES.includes(currentUserRole || ''); // 🔑 هنا يتم تحديد صلاحية الرؤية الكاملة

    savedRecords.forEach(rec => {
        // 1. تصفية نوع السجل
        if (rec.type !== 'status') return; 
        
        // 2. 🔑 التصفية حسب المدرب (إذا لم يكن لديه صلاحية الرؤية الكاملة)
        // إذا كان المستخدم مدرباً (لا يملك صلاحية viewAll) ورقمة العسكري لا يطابق رقم كاتب السجل، يتم تجاهل السجل.
        if (!viewAll && rec.writer_mil_id !== currentUserMilId) {
            return; 
        }

        const key = `${rec.course_name}-${rec.batch_name}-${rec.shift}-${rec.writer_mil_id}`;
        if (!sessions[key]) {
            sessions[key] = {
                id: key,
                course_name: rec.course_name || 'غير محدد',
                batch_name: rec.batch_name || 'غير محدد',
                shift: rec.shift,
                writer_name: rec.writer_name || 'مجهول',
                writer_rank: rec.writer_rank || '',
                writer_mil_id: rec.writer_mil_id || '',
                is_approved: rec.is_approved,
                count: 0,
                records: [],
                record_ids: [],
                date: rec.date // إضافة التاريخ
            };
        }
        sessions[key].records.push(rec);
        sessions[key].record_ids.push(rec.id);
        sessions[key].count++;
    });
    return Object.values(sessions);
}, [savedRecords, userRole, writerMilId]);
   const addNewRow = () => { 
    // 🛑 التحقق من شروط الإضافة قبل التنفيذ
    if (filterCourse === 'all' || filterBatch === 'all') {
        toast.warning("يرجى اختيار الدورة والدفعة أولاً لإضافة صف جديد.");
        return;
    }

    setRows([...rows, { 
        id: Date.now(), militaryId: "", name: "", rank: "", company: "", platoon: "", status: null, duration: "1", startDate: currentDate, note: "", isNew: true 
    }]);

    // 🚀 أضفها هنا
    setIsDirty(true); 
}
    const handleMilitaryIdInput = (index: number, val: string) => { 
        const newRows = [...rows]; 
        const cleanVal = normalizeInput(val); 
        newRows[index].militaryId = cleanVal; 
        
        if (cleanVal === "") { 
            newRows[index].soldierDbId = null; 
            newRows[index].name = ""; 
            newRows[index].rank = ""; 
            newRows[index].company = ""; 
            newRows[index].platoon = ""; 
            newRows[index].isNew = true; 
        } 
        setRows(newRows); 
        setIsDirty(true);
    }
    const lookupSoldierData = async (index: number) => { const row = rows[index]; if (!row.militaryId || row.militaryId.length < 3) return; try { const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/?search=${row.militaryId}&limit=1`); const data = await res.json(); const newRows = [...rows]; if (data.data && data.data.length > 0) { const s = data.data[0]; newRows[index] = { ...newRows[index], soldierDbId: s.id, militaryId: s.military_id, name: s.name, rank: s.rank, company: s.company, platoon: s.platoon, isNew: false }; toast.success("تم جلب البيانات"); } else { toast.error("الرقم غير موجود"); newRows[index].name = "غير موجود"; newRows[index].rank = ""; } setRows(newRows); } catch (e) { } }
    const handleKeyDown = (e: React.KeyboardEvent, index: number) => { if (e.key === 'Enter') lookupSoldierData(index); }
    
    const stats = useMemo(() => { const s = { medical: 0, clinic: 0, leave: 0, late: 0, absent: 0, exempt: 0, rest: 0, other: 0, totalCases: 0 }; rows.forEach(r => { if (!r.status) return; const id = r.status.id; s.totalCases++; if (id.includes("medical")) s.medical++; else if (id.includes("clinic")) s.clinic++; else if (id.includes("leave")) s.leave++; else if (id.includes("late")) s.late++; else if (id.includes("absent")) s.absent++; else if (id.includes("exempt")) s.exempt++; else if (id.includes("rest")) s.rest++; else s.other++; }); return s; }, [rows]);
    
    const reviewStats = useMemo(() => {
        const s = { medical: 0, clinic: 0, leave: 0, late: 0, absent: 0, exempt: 0, rest: 0, other: 0, totalCases: 0 };
        if (!selectedSession) return s;
        selectedSession.records.forEach((r: any) => {
            const val = r.value || "";
            s.totalCases++;
            if (val.includes("طبية")) s.medical++;
            else if (val.includes("عيادة")) s.clinic++;
            else if (val.includes("إجازة")) s.leave++;
            else if (val.includes("تأخير")) s.late++;
            else if (val.includes("غياب")) s.absent++;
            else if (val.includes("إعفاء")) s.exempt++;
            else if (val.includes("استراحة")) s.rest++;
            else s.other++;
        });
        return s;
    }, [selectedSession]);

    const saveStatusFromModal = () => { if (statusModal.rowIndex === null || !selectedStatusObj) return; const newRows = [...rows]; const row = newRows[statusModal.rowIndex]; row.status = selectedStatusObj; if (selectedStatusObj.id.includes('late')) { row.duration = ""; row.startDate = currentDate; row.note = `تأخير: ${modalLateMinutes} دقيقة`; } else { row.duration = modalDuration; row.startDate = modalStartDate; if (selectedStatusObj.id === 'other') row.note = modalCustomNote; } setRows(newRows); setStatusModal({ isOpen: false, rowIndex: null }); setSelectedStatusObj(null); setModalDuration("1"); setModalStartDate(currentDate); setModalLateMinutes(""); setModalCustomNote(""); setIsDirty(true); }
    const saveNotesFromModal = () => { if (notesModal.rowIndex === null) return; const newRows = [...rows]; newRows[notesModal.rowIndex].note = notesModal.text; setRows(newRows); setNotesModal({ isOpen: false, rowIndex: null, text: "" }); setIsDirty(true);}
    // في ملف MilitaryDailyCheckPage.tsx

   const handleSave = async () => { 
    if (rows.length === 0) { toast.error("لا توجد بيانات"); return; } 
    const token = localStorage.getItem("token");

    setIsSaving(true); 
    try { 
        const payload = rows.filter(r => r.soldierDbId && r.status).map(r => ({ 
            soldier_id: r.soldierDbId, 
            date: r.startDate || currentDate, 
            type: 'status', 
            value: r.status.id === 'other' ? r.note : (r.status.id.includes('late') ? `${r.status.label} (${r.note})` : r.status.label), 
            class_type: "military", 
            is_custom: r.status.id === 'other', 
            shift: shift, 
            course_name: filterCourse, 
            batch_name: filterBatch, 
            writer_rank: writerRank, 
            writer_name: writerName, 
            writer_mil_id: writerMilId 
        })); 

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance/bulk`, { 
            method: "POST", 
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` // 🛡️ تأمين عملية الحفظ
            }, 
            body: JSON.stringify(payload) 
        }); 
        
        if (res.ok) { 
            toast.success("تم الحفظ بنجاح"); 
            
            // 🚀 الخطوة الهامة الجديدة:
            // 1. تصفير حالة التنبيه لأن البيانات أصبحت محفوظة الآن
            setIsDirty(false); 
            
            // 2. تحديث قائمة السجلات والبطاقات في التاب الآخر
            fetchSavedRecords(); 

            // 3. إعادة جلب البيانات الحالية للتأكد من حالة القفل
            await loadExistingData();

        } else { 
            toast.error("حدث خطأ في الصلاحيات أو البيانات"); 
        } 
    } catch (e) { 
        toast.error("خطأ اتصال"); 
    } finally { 
        setIsSaving(false); 
    } 
}

// ... (بقية الكود) ...
    const handleExportExcel = (dataToExport: any[], fileName: string) => {
    if (!dataToExport || dataToExport.length === 0) {
        toast.warning("لا توجد بيانات لتصديرها");
        return;
    }

    const data = dataToExport.map((r, i) => {
        // تنظيف القيم لتبدو رسمية في الإكسل
        const cleanCompany = (r.company || r.soldier?.company) === 'all' ? 'عام' : (r.company || r.soldier?.company);
        const cleanBatch = (r.batch || r.soldier?.batch) === 'all' ? '-' : (r.batch || r.soldier?.batch);

        return {
            "م": i + 1,
            "الرتبة": r.rank || r.soldier?.rank || "مستجد",
            "الرقم العسكري": r.militaryId || r.soldier?.military_id,
            "الاسم": r.name || r.soldier?.name,
            "السرية": cleanCompany,
            "الفصيل": r.platoon || r.soldier?.platoon || "عام",
            "الحالة": r.status ? r.status.label : (r.value || "-"),
            "التاريخ": r.startDate || r.date,
            "ملاحظات": r.note || ""
        };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "التكميل اليومي");
    
    // ضبط عرض الأعمدة تلقائياً ليظهر الملف بشكل احترافي
    ws['!cols'] = [{ wch: 5 }, { wch: 10 }, { wch: 15 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 40 }];

    XLSX.writeFile(wb, `${fileName}.xlsx`);
};
    
   const handleApproveSession = async () => {
    const token = localStorage.getItem("token");
    const approverMilId = writerMilId; 

    if (!approverName || !approverRank || !approverMilId) { 
        toast.error("بيانات المسؤول غير مكتملة"); 
        return; 
    } 

    setIsApproving(true);
    try { 
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance/approve`, { 
            method: "PUT", 
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` // 🛡️ التوقيع يتطلب توكن صالح
            }, 
            body: JSON.stringify({ 
                ids: selectedSession.record_ids, 
                approver_rank: approverRank, 
                approver_name: approverName,
                approver_mil_id: approverMilId, 
            }) 
        }); 
        
        if (res.ok) { 
            toast.success("تم الاعتماد الرسمي بنجاح ✅"); 
            setSelectedSession(null); 
            fetchSavedRecords(); 
            await loadExistingData();
        } else { toast.error("غير مصرح لك بالاعتماد"); } 
    } catch (e) { toast.error("خطأ اتصال"); } finally { setIsApproving(false); } 
}
    // 1. دالة تفتح النافذة فقط (نربطها بالزر الأحمر)
    const requestUnapprove = () => {
        setUnapproveConfirmOpen(true);
    }

    // 2. الدالة الفعلية التي تنفذ الأمر (نربطها بزر التأكيد داخل النافذة)
   const executeUnapprove = async () => {
    if (!selectedSession || selectedSession.record_ids.length === 0) return;
    
    const token = localStorage.getItem("token"); // 🔑 جلب التوكن للأمان
    setIsApproving(true);
    
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance/unapprove`, {
            method: "PUT",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` // 🛡️ حماية العملية من المتطفلين
            },
            body: JSON.stringify({
                ids: selectedSession.record_ids,
                approver_rank: "", 
                approver_name: "",
                approver_mil_id: "" 
            })
        });
        
        if (res.ok) {
            toast.success("تم فك الاعتماد بنجاح، الكشف متاح للتعديل الآن 🔓");
            setUnapproveConfirmOpen(false);
            setSelectedSession(null);
            fetchSavedRecords();
            await loadExistingData();
        } else {
            const errorData = await res.json();
            toast.error(errorData.detail || "ليس لديك صلاحية فك الاعتماد");
        }
    } catch (e) {
        toast.error("خطأ في الاتصال بالخادم");
    } finally {
        setIsApproving(false);
    }
}
    const openOfficerModalHelper = (title: string, value: string, setter: any) => { setOfficerModal({ isOpen: true, field: title, value, setter }); setOfficerInputValue(value); }
    const saveOfficerData = () => { officerModal.setter(officerInputValue); setOfficerModal({ ...officerModal, isOpen: false }); }
    const paginatedRows = rows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
// ✅ دالة طباعة مخصصة لتغيير اسم الملف
    const handlePrintWithTitle = (isReview = false) => {
        const originalTitle = document.title; // حفظ العنوان الأصلي
        let customTitle = "";

        if (isReview && selectedSession) {
            // حالة الطباعة من سجل المراجعة
            const sText = selectedSession.shift === 'morning' ? 'صباحي' : selectedSession.shift === 'afternoon' ? 'عصر' : 'ليلي';
            customTitle = `التكميل_اليومي_فرع_التدريب_العسكري_${selectedSession.course_name}_${selectedSession.batch_name}_${sText}_${selectedSession.date}`;
        } else {
            // حالة الطباعة من صفحة الإدخال
            const sText = shift === 'morning' ? 'صباحي' : shift === 'afternoon' ? 'عصر' : 'ليلي';
            const courseName = filterCourse === 'all' ? 'دورة_عامة' : filterCourse;
            const batchName = filterBatch === 'all' ? 'دفعة_عامة' : filterBatch;
            customTitle = `التكميل_اليومي_فرع_التدريب_العسكري_${courseName}_${batchName}_${sText}_${currentDate}`;
        }

        document.title = customTitle; // تغيير العنوان
        window.print(); // أمر الطباعة
        
        // إعادة العنوان الأصلي بعد ثانية واحدة
        setTimeout(() => { document.title = originalTitle }, 1000);
    }
    // 🔑 الدوال الجديدة:
// 1. الدالة التي تفتح نافذة التأكيد أو تحذف محلياً
const handleDeleteRow = (rowIndex: number) => {
    const row = rows[rowIndex];
    
    // منع الحذف إذا كان الكشف معتمداً
    if(isSessionLocked) {
         toast.error("لا يمكن الحذف أو التعديل لأن هذا الكشف معتمد.");
         return;
    }

    if (row.id && !row.isNew) { 
        // فتح نافذة التأكيد لحذف من DB
        setRowToDelete(row);
        setDeleteConfirmOpen(true);
    } else {
        // حذف الصف غير المحفوظ مباشرة من الـ state
        const newRows = rows.filter((_, idx) => idx !== rowIndex);
        setRows(newRows);
        toast.success("تم حذف الصف بنجاح");
    }
};

// 2. دالة تنفيذ الحذف (بعد التأكيد)
const executeDelete = async () => {
    if (!rowToDelete) return;
    const token = localStorage.getItem("token");
    
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance/${rowToDelete.id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` } // 🛡️ أضفنا التوكن
        });

        if (res.ok) {
            toast.success("تم الحذف من قاعدة البيانات بنجاح");
            // 🔄 الخطوة الأهم: إعادة جلب البيانات من السيرفر فوراً
            loadExistingData(); 
            fetchSavedRecords(); // تحديث البطاقات أيضاً
        } else {
            toast.error("فشل الحذف: تأكد من فك الاعتماد أولاً");
        }
    } catch (e) {
        toast.error("خطأ في الاتصال");
    } finally {
        setDeleteConfirmOpen(false);
        setRowToDelete(null);
    }
};
const canApprove = APPROVE_ROLES.includes(userRole || '');
    return (
        <ProtectedRoute allowedRoles={["owner"]}>
        <div className="space-y-6 p-2 md:p-6 pb-20 md:pb-32 " dir="rtl">
            <style jsx global>{`
                @media print {
                    @page { size: portrait; margin: 10mm; }
                    nav, aside, header, button, .print\\:hidden, [role="tablist"] { display: none !important; }
                    body { background: white; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .print-header-show { display: flex !important; }
                    .col-image { display: none !important; }
                    th { background-color: #c5b391 !important; color: black !important; border: 1px solid black !important; font-size: 10px; }
                    td { border: 1px solid black !important; font-size: 10px; height: 30px; }
                    input { border: none !important; background: transparent !important; }
                    .h-16 {
            height: 40px !important; /* تغيير الارتفاع إلى 30 بكسل فقط عند الطباعة */
        }
                    /* عكس التواقيع في الطباعة: المسؤول يمين، المدرب يسار */
                    .signature-section-inner { display: flex !important; flex-direction: row !important; justify-content: space-between !important; align-items: flex-end !important; gap: 2rem !important; }
                    .signature-block { width: 48% !important; margin: 0 !important; border: none !important; }
                    .signature-block-left { order: 1 !important; border-left: 2px dashed #ccc !important; padding-left: 1rem !important; } /* المدرب (يسار) */
                    .signature-block-right { order: 2 !important; } /* المسؤول (يمين) */
                    
                    .signature-section { break-inside: avoid; page-break-inside: avoid; margin-top: 10px !important; }
                    .status-btn { display: none !important; }
                    .status-text { display: block !important; }
                }
                .print-header-show { display: none; }
                .status-text { display: none; }
            `}</style>

            <div className="print-header-show w-full flex-row justify-between items-start mb-4 border-b-2 border-black pb-2">
                <div className="text-right w-1/3"><img src="/logo.jpg" alt="Logo" className="h-20 object-contain" /></div>
                <div className="text-center w-1/3 pt-2">
                    <h2 className="text-lg font-bold">معهد الشرطة</h2>
                    <h3 className="font-bold">قسم التدريب العسكري والرياضي</h3>
                    <h3 className="font-bold underline mt-1">كشف التكميل اليومي</h3>
                    <div className="mt-1 text-xs border border-black p-1 inline-block px-4 font-bold">{selectedSession ? `${selectedSession.course_name} / ${selectedSession.batch_name}` : `${filterCourse === 'all' ? 'كل الدورات' : filterCourse} / ${filterBatch === 'all' ? 'كل الدفعات' : filterBatch}`}</div>
                </div>
                <div className="text-left w-1/3 flex flex-col items-end gap-1 pt-4 pl-4 font-bold text-xs">
                    <div>{selectedSession ? reviewDate : currentDate}</div>
                    <div>{selectedSession ? (selectedSession.shift === 'morning' ? 'صباحي' : selectedSession.shift === 'afternoon' ? 'عصر' : 'ليلي') : (shift === 'morning' ? 'صباحي' : shift === 'afternoon' ? 'عصر' : 'ليلي')}</div>
                </div>
            </div>

            <Tabs defaultValue="entry" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px] mx-auto mb-6 print:hidden">
    {/* 🚀 عند الضغط على "إدخال" نقوم بتحديث البيانات فوراً للتأكد من حالة القفل */}
    <TabsTrigger value="entry" onClick={() => loadExistingData()}>
        إدخال التكميل
    </TabsTrigger>
    
    <TabsTrigger value="review" onClick={fetchSavedRecords}>
        سجل المراجعة والاعتماد
    </TabsTrigger>
</TabsList>

                <TabsContent value="entry" className="space-y-6">
                   <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
    
    {/* 1. المجموعة الأولى في الكود = تظهر يمين الشاشة (الأزرار) */}
    <div className="flex gap-2">
        <Button 
    variant="outline" 
    onClick={() => {
        // توليد الاسم المفصل
        const sText = shift === 'morning' ? 'صباحي' : shift === 'afternoon' ? 'عصر' : 'ليلي';
        const fCourse = filterCourse === 'all' ? 'عام' : filterCourse;
        const fBatch = filterBatch === 'all' ? '' : filterBatch;
        const fileName = `التكميل_اليومي_فرع_التدريب_العسكري_${fCourse}_${fBatch}_${sText}_${currentDate}`;
        
        // استدعاء دالة التصدير بالاسم الجديد
        handleExportExcel(rows, fileName);
    }} 
    className="gap-2 text-green-700 border-green-200 hover:bg-green-50"
>
    <FileSpreadsheet className="w-4 h-4"/> تصدير
</Button>
        <Button variant="outline" onClick={() => handlePrintWithTitle(false)} className="gap-2">
            <Printer className="w-4 h-4"/> طباعة
        </Button>
        <Button onClick={handleSave} disabled={isSaving || isSessionLocked} className="gap-2 bg-slate-900 text-white">
            {isSaving ? <Loader2 className="animate-spin"/> : <Save className="w-4 h-4"/>} حفظ
        </Button>
    </div>

    {/* 2. المجموعة الثانية في الكود = تظهر يسار الشاشة (العنوان) */}
    <div className="flex items-center gap-2">
        <div className="p-2 bg-green-100 rounded-lg">
            <CheckCircle2 className="w-6 h-6 text-green-700"/>
        </div>
        <div>
            <h1 className="text-2xl font-bold">التكميل اليومي</h1>
            <p className="text-xs text-slate-500">فرع التدريب العسكري</p>
        </div>
    </div>

</div>

                    <Card className="bg-slate-50 border-slate-200 print:hidden">
    <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* 1. الدورة */}
        <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">الدورة</label>
            <Select 
                value={filterCourse} 
                onValueChange={(v) => { 
                    setFilterCourse(v); 
                    setFilterBatch("all"); 
                    setIsDirty(false); // 👈 تصفير الحالة
                }}
            >
                <SelectTrigger className="bg-white"><SelectValue placeholder="اختر الدورة" /></SelectTrigger>
                <SelectContent>{filterOptions.courses?.map((c:any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
        </div>

        {/* 2. الدفعة */}
        <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">الدفعة</label>
            <Select 
                value={filterBatch} 
                onValueChange={(v) => {
                    setFilterBatch(v);
                    setIsDirty(false); // 👈 تصفير الحالة
                }} 
                disabled={filterCourse === "all"}
            >
                <SelectTrigger className="bg-white"><SelectValue placeholder="اختر الدفعة" /></SelectTrigger>
                <SelectContent>{filterOptions.batches?.map((b:any) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
        </div>

        {/* 3. الشيفت */}
        <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">الشيفت</label>
            <Select 
                value={shift} 
                onValueChange={(v) => {
                    setShift(v);
                    setIsDirty(false); // 👈 تصفير الحالة لضمان نظافة الجدول الجديد
                }}
            >
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="morning">☀️ صباحي</SelectItem>
                    <SelectItem value="afternoon">🌤️ عصر</SelectItem>
                    <SelectItem value="night">🌙 ليلي</SelectItem>
                </SelectContent>
            </Select>
        </div>

        {/* 4. التاريخ */}
        <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">التاريخ</label>
            <Input 
                type="date" 
                value={currentDate} 
                onChange={(e) => {
                    setCurrentDate(e.target.value);
                    setIsDirty(false); // 👈 تصفير الحالة عند تغيير التاريخ
                }} 
                className="bg-white" 
            />
        </div>
    </CardContent>

    {/* 🚀 قسم التنبيهات الذكي */}
    <div className="px-4 pb-4 space-y-2">
        {/* 1. تنبيه الاعتماد (أحمر) */}
        {isSessionLocked && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-center gap-2 animate-in slide-in-from-top-2">
                <ShieldCheck className="w-5 h-5" />
                <span className="font-bold text-sm">تنبيه: هذا الكشف تم اعتماده من قبل المسؤول ولا يمكن التعديل عليه.</span>
            </div>
        )}

        {/* 2. تنبيه الحفظ (برتقالي) - يظهر فقط عند وجود تغييرات والكشف غير مقفل */}
        {!isSessionLocked && isDirty && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-md flex items-center justify-between animate-in fade-in zoom-in-95">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 animate-bounce" />
                    <span className="font-bold text-sm">
                        تنبيه: لديك تعديلات جديدة. يرجى الضغط على زر "حفظ" لتسجيلها في السجل الرسمي، وإلا ستفقدها عند مغادرة الصفحة.
                    </span>
                </div>
            </div>
        )}
    </div>
</Card>
                    
                    {/* ✅ 1. شريط القوة المعكوس (الموجود في اليمين -> العدد  في اليسار) */}
                    <div className="flex border-2 border-[#c5b391] text-xs md:text-sm text-center font-bold overflow-hidden rounded-md shadow-sm bg-white break-inside-avoid">
                        <div className="flex-1 flex flex-col"><div className="bg-[#c5b391] py-1 text-black">الموجود</div><div className="py-2 text-green-700">{totalCourseStrength > 0 ? totalCourseStrength - stats.totalCases : "-"}</div></div>
                        <div className="flex-1 flex flex-col border-r border-[#c5b391]"><div className="bg-[#c5b391] py-1 text-black">الحالات</div><div className="py-2 text-red-600">{stats.totalCases}</div></div>
                        <div className="flex-1 flex flex-col border-r border-[#c5b391]"><div className="bg-[#c5b391] py-1 text-black">أخرى</div><div className="py-2">{stats.other}</div></div>
                        <div className="flex-1 flex flex-col border-r border-[#c5b391]"><div className="bg-[#c5b391] py-1 text-black">استراحة</div><div className="py-2">{stats.rest}</div></div>
                        <div className="flex-1 flex flex-col border-r border-[#c5b391]"><div className="bg-[#c5b391] py-1 text-black">إعفاء</div><div className="py-2">{stats.exempt}</div></div>
                        <div className="flex-1 flex flex-col border-r border-[#c5b391]"><div className="bg-[#c5b391] py-1 text-black">غياب</div><div className="py-2">{stats.absent}</div></div>
                        <div className="flex-1 flex flex-col border-r border-[#c5b391]"><div className="bg-[#c5b391] py-1 text-black">تأخير</div><div className="py-2">{stats.late}</div></div>
                        <div className="flex-1 flex flex-col border-r border-[#c5b391]"><div className="bg-[#c5b391] py-1 text-black">إجازة</div><div className="py-2">{stats.leave}</div></div>
                        <div className="flex-1 flex flex-col border-r border-[#c5b391]"><div className="bg-[#c5b391] py-1 text-black">عيادة</div><div className="py-2">{stats.clinic}</div></div>
                        <div className="flex-1 flex flex-col border-r border-[#c5b391]"><div className="bg-[#c5b391] py-1 text-black">طبية</div><div className="py-2">{stats.medical}</div></div>
                        <div className="flex-1 flex flex-col border-r border-[#c5b391]"><div className="bg-[#c5b391] py-1 text-black">العدد</div><div className="py-2">{totalCourseStrength > 0 ? totalCourseStrength : "-"}</div></div>
                    </div>

                    <div className="bg-white border rounded-lg shadow-sm overflow-hidden min-h-[400px]">
                        {/* ✅ 2. الجدول المعكوس (ملاحظات يمين -> # يسار) */}
                        <Table><TableHeader className="bg-slate-100"><TableRow>
                            <TableHead className="w-[40px] text-center bg-[#c5b391] text-black border font-bold print:hidden"></TableHead>
                            <TableHead className="text-center bg-[#c5b391] text-black border font-bold">ملاحظات</TableHead>
                            <TableHead className="w-[110px] text-center bg-[#c5b391] text-black border font-bold">بداية من</TableHead>
                            <TableHead className="w-[60px] text-center bg-[#c5b391] text-black border font-bold">المدة</TableHead>
                            <TableHead className="w-[140px] text-center bg-[#c5b391] text-black border font-bold">الحالة</TableHead>
                            <TableHead className="w-[80px] text-center bg-[#c5b391] text-black border font-bold">الفصيل</TableHead>
                            <TableHead className="w-[80px] text-center bg-[#c5b391] text-black border font-bold">السرية</TableHead>
                            <TableHead className="text-center bg-[#c5b391] text-black border font-bold">الاسم</TableHead>
                            <TableHead className="w-[120px] text-center bg-[#c5b391] text-black border font-bold">الرقم العسكري</TableHead>
                            <TableHead className="w-[80px] text-center bg-[#c5b391] text-black border font-bold">الرتبة</TableHead>
                            <TableHead className="w-[50px] text-center bg-[#c5b391] text-black border font-bold col-image">الصورة</TableHead>
                            <TableHead className="w-[40px] text-center bg-[#c5b391] text-black border font-bold">#</TableHead>
                        </TableRow></TableHeader><TableBody>{rows.length === 0 ? (<TableRow><TableCell colSpan={12} className="h-40 text-center text-slate-400"><div className="flex flex-col items-center gap-2"><UserPlus className="w-10 h-10 opacity-30" /><span>ابدأ بإضافة مجندين</span><Button onClick={addNewRow} variant="outline" className="mt-2">إضافة صف جديد</Button></div></TableCell></TableRow>) : (paginatedRows.map((row, i) => { const realIndex = (currentPage - 1) * itemsPerPage + i; return (
                            <TableRow key={row.id}>
                                <TableCell className="text-center border p-1 print:hidden">
    {/* 🔑 تم تعديل onclick لربطه بـ handleDeleteRow */}
    <Button variant="ghost" size="icon" onClick={() => handleDeleteRow(realIndex)} className="h-8 w-8 text-red-500">
        <Trash2 className="w-4 h-4" />
    </Button>
</TableCell>
                                <TableCell className="p-1 border text-center">{row.note ? <Button variant="ghost" size="sm" onClick={() => setNotesModal({ isOpen: true, rowIndex: realIndex, text: row.note })} className="h-8 text-xs truncate max-w-[100px] block">{row.note}</Button> : <Button variant="ghost" size="icon" onClick={() => setNotesModal({ isOpen: true, rowIndex: realIndex, text: "" })} className="h-8 w-8 text-slate-300 hover:text-slate-500"><PenTool className="w-3 h-3" /></Button>}</TableCell>
                                <TableCell className="text-center border text-xs" dir="ltr">{row.startDate || "-"}</TableCell>
                                <TableCell className="text-center border text-xs">{row.duration || "-"}</TableCell>
                                <TableCell className="p-1 border text-center"><div className="status-btn"><Button variant="outline" size="sm" onClick={() => { setStatusModal({ isOpen: true, rowIndex: realIndex }); setSelectedStatusObj(null); }} className={`w-full h-8 text-xs ${row.status ? row.status.color : 'text-slate-400'}`}>{row.status ? <span className="flex items-center gap-1"><row.status.icon className="w-3 h-3"/> {row.status.label}</span> : "اختر الحالة"}</Button></div><div className="status-text font-bold text-black text-xs text-center pt-1">{row.status ? row.status.label : ""}</div></TableCell>
                                <TableCell className="text-center border text-xs">{row.platoon || "-"}</TableCell>
                                <TableCell className="text-center border text-xs">{row.company || "-"}</TableCell>
                                <TableCell className="text-center border font-medium text-xs">{row.name || ""}</TableCell>
                                <TableCell className="p-1 border"><Input value={row.militaryId} onChange={(e) => handleMilitaryIdInput(realIndex, e.target.value)} onBlur={() => lookupSoldierData(realIndex)} onKeyDown={(e) => handleKeyDown(e, realIndex)} className="h-8 text-center font-bold border-blue-200 focus:border-blue-500 bg-white" placeholder="رقم" /></TableCell>
                                <TableCell className="text-center border text-xs">{row.rank || "-"}</TableCell>
                                <TableCell className="text-center border p-1 col-image">{row.soldierDbId ? (<div className="w-8 h-8 rounded-full overflow-hidden mx-auto border bg-slate-200 relative flex items-center justify-center"><img src={`${process.env.NEXT_PUBLIC_API_URL}/static/images/${row.militaryId}.jpg`} className="w-full h-full object-cover relative z-10" onError={(e:any) => e.target.style.display='none'} alt="img" /><User className="w-4 h-4 text-slate-400 absolute" /></div>) : <div className="w-8 h-8 rounded-full bg-slate-100 mx-auto border border-dashed flex items-center justify-center"><User className="w-4 h-4 text-slate-300"/></div>}</TableCell>
                                <TableCell className="text-center font-mono border">{realIndex + 1}</TableCell>
                            </TableRow>
                        ) }))}</TableBody></Table>
                    </div>

                    <div className="flex justify-between items-center print:hidden"><Button 
    onClick={addNewRow} 
    disabled={isAddDisabled} // 🛑 استخدام المتغير الجديد
    className="bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 gap-2"
    // 💡 إضافة خاصية title (tooltip) لتوضيح سبب التعطيل
    title={filterCourse === 'all' || filterBatch === 'all' ? 'الرجاء اختيار الدورة والدفعة أولاً' : ''}
>
    <Plus className="w-4 h-4" /> إضافة صف
</Button><div className="flex items-center gap-2"><span className="text-xs text-slate-500">عرض:</span><Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}><SelectTrigger className="w-[70px] h-8 text-xs"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem></SelectContent></Select></div></div>

{/* ✅ تعديل جذري: الترتيب الجديد (التوقيع يمين - الرقم العسكري يسار) */}
<div className="signature-section mt-4 border-t-2 border-dashed border-slate-300 pt-4">
    <div className="bg-white border-2 border-black p-3 rounded-none max-w-4xl mx-auto shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <h3 className="font-bold text-center text-base mb-2 underline">المدرب المناوب</h3>
        
        {/* بما أن الصفحة RTL، العنصر الأول هنا سيظهر في اليمين */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-4 items-end">
            
            {/* 1. (اليمين) التوقيع */}
            <div className="text-center mt-2 md:mt-0 order-last md:order-first">
                <div className="h-16 border-b border-black mb-1 flex items-end justify-center pb-1 relative">
                    {signatureUrl && writerName ? (
                        <img src={signatureUrl} alt="Signature" className="h-full w-auto object-contain max-w-[120px]" />
                    ) : (
                        <span className="text-slate-300 text-[10px] italic print:hidden">التوقيع تلقائي</span>
                    )}
                </div>
                <span className="font-bold text-xs">التوقيع</span>
            </div>

            {/* 2. (الوسط) الرتبة والاسم */}
            <div className="space-y-2">
                <div className="flex items-center gap-2 flex-row-reverse">
                    <span className="font-bold w-12 text-xs">:الرتبة</span>
                    <div onClick={() => openOfficerModalHelper('الرتبة', writerRank, setWriterRank)} className="flex-1 border-b border-black h-6 text-sm font-bold text-center flex items-center justify-center px-2 cursor-pointer hover:bg-slate-50">{writerRank || "............"}</div>
                </div>
                <div className="flex items-center gap-2 flex-row-reverse">
                    <span className="font-bold w-12 text-xs">:الاسم</span>
                    <div onClick={() => openOfficerModalHelper('الاسم', writerName, setWriterName)} className="flex-1 border-b border-black h-6 text-sm font-bold flex items-center justify-center px-2 cursor-pointer hover:bg-slate-50">{writerName || "............"}</div>
                </div>
            </div>

            {/* 3. (اليسار) الرقم العسكري */}
            <div className="space-y-1 order-first md:order-last">
                <div className="flex items-center gap-2 flex-row-reverse">
                    <span className="font-bold w-16 text-xs whitespace-nowrap">:الرقم العسكري</span>
                    <div onClick={() => openOfficerModalHelper('الرقم العسكري', writerMilId, setWriterMilId)} className="flex-1 border-b border-black h-6 text-sm font-bold text-center flex items-center justify-center cursor-pointer hover:bg-slate-50">{writerMilId || "............"}</div>
                </div>
            </div>

        </div>
    </div>
</div>
                </TabsContent>

                <TabsContent value="review" className="space-y-6 animate-in slide-in-from-left-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50 p-4 rounded-lg border print:hidden">
    
    {/* 1. المجموعة الأولى في الكود = تظهر يمين الشاشة (اختيار التاريخ) */}
    <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-slate-500">اختر التاريخ:</span>
        <div className="relative">
            <Input 
                type="date" 
                value={reviewDate} 
                onChange={(e) => { setReviewDate(e.target.value); setSelectedSession(null); }} 
                className="pl-10 bg-white w-40" 
            />
            <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        </div>
        <Button onClick={fetchSavedRecords} disabled={loadingSaved} className="gap-2 w-24">
            {loadingSaved ? <Loader2 className="w-4 h-4 animate-spin"/> : "عرض"}
        </Button>
    </div>

    {/* 2. المجموعة الثانية في الكود = تظهر يسار الشاشة (العنوان) */}
    <h2 className="text-xl font-bold flex items-center gap-2">
        <ShieldCheck className="w-6 h-6 text-blue-600"/> سجل المراجعة والاعتماد
    </h2>

</div>

                    {!selectedSession ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                            {groupedSessions.length === 0 ? (<div className="col-span-full text-center py-12 text-slate-400 bg-white rounded-lg border border-dashed"><FileCheck className="w-12 h-12 mx-auto mb-2 opacity-20"/><p>لا توجد جلسات محفوظة لهذا اليوم</p></div>) : (groupedSessions.map((session: any) => (
                                <Card key={session.id} className={`cursor-pointer transition-all hover:shadow-md group border-2 ${session.is_approved ? 'border-green-500 bg-green-50' : 'hover:border-blue-500'}`} onClick={() => setSelectedSession(session)}>
                                    <CardHeader className="pb-2 p-3">
                                        <CardTitle className="text-base md:text-lg flex justify-between items-start">
                                            <div className="flex flex-col"><span>{session.writer_name}</span><span className="text-xs font-normal text-slate-500">{session.writer_rank}</span></div>
                                            {session.is_approved ? (<span className="text-[10px] bg-green-100 text-green-800 px-2 py-1 rounded-full flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> معتمد</span>) : (<span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full flex items-center gap-1"><Hourglass className="w-3 h-3"/> قيد الانتظار</span>)}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 p-3 pt-0">
                                        <div className="text-xs md:text-sm font-bold">{session.course_name} / {session.batch_name}</div>
                                        <div className="flex justify-between items-center text-xs md:text-sm text-slate-500"><div className="flex items-center gap-1"><Clock className="w-3 h-3"/> {session.shift === 'morning' ? 'صباحي' : session.shift === 'afternoon' ? 'عصر' : 'ليلي'}</div><div className="flex items-center gap-1"><FileText className="w-3 h-3"/> {session.count} سجل</div></div>
                                        <Button className={`w-full mt-2 border h-8 text-xs ${session.is_approved ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-600 group-hover:border-blue-200'}`}>مراجعة وتفاصيل <ArrowRight className="w-3 h-3 mr-2" /></Button>
                                    </CardContent>
                                </Card>
                            )))}
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in slide-in-from-bottom-4">
                            {/* داخل TabsContent value="review" */}

<div className="flex items-center justify-between print:hidden">
    
    {/* 1. المجموعة الأولى في الكود = تظهر يمين الشاشة (في RTL) */}
    <div className="flex gap-2">
        {selectedSession.is_approved && UNAPPROVE_ROLES.includes(userRole || '') && (
    <Button 
        variant="destructive" 
        onClick={requestUnapprove} 
        disabled={isApproving} 
        className="gap-2 bg-red-600 hover:bg-red-700 text-white"
    >
        {isApproving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Unlock className="w-4 h-4"/>} فك الاعتماد
    </Button>
)}

        <Button 
    variant="outline" 
    onClick={() => {
        // توليد الاسم المفصل
        const sText = shift === 'morning' ? 'صباحي' : shift === 'afternoon' ? 'عصر' : 'ليلي';
        const fCourse = filterCourse === 'all' ? 'عام' : filterCourse;
        const fBatch = filterBatch === 'all' ? '' : filterBatch;
        const fileName = `التكميل_اليومي_فرع_التدريب_العسكري_${fCourse}_${fBatch}_${sText}_${currentDate}`;
        
        // استدعاء دالة التصدير بالاسم الجديد
        handleExportExcel(rows, fileName);
    }} 
    className="gap-2 text-green-700 border-green-200 hover:bg-green-50"
>
    <FileSpreadsheet className="w-4 h-4"/> تصدير
</Button>
        <Button variant="outline" onClick={() => handlePrintWithTitle(false)} className="gap-2">
            <Printer className="w-4 h-4"/> طباعة
        </Button>
    </div>

    {/* 2. العنصر الثاني في الكود = يظهر يسار الشاشة (في RTL) */}
    <Button variant="ghost" onClick={() => setSelectedSession(null)} className="gap-2">
        {/* وضعنا النص أولاً، ثم الأيقونة ليظهر السهم يسار الكتابة */}
        عودة للقائمة 
        <ArrowRight className="w-4 h-4 "/> 
    </Button>

</div>

                            {/* ✅ شريط القوة المعكوس في المراجعة */}
                            <div className="flex border-2 border-[#c5b391] text-xs md:text-sm text-center font-bold overflow-hidden rounded-md shadow-sm bg-white break-inside-avoid">
                                <div className="flex-1 flex flex-col"><div className="bg-[#c5b391] py-1 text-black">الموجود</div><div className="py-2 text-green-700">{reviewTotalStrength > 0 ? reviewTotalStrength - reviewStats.totalCases : "-"}</div></div>
                                <div className="flex-1 flex flex-col border-r border-[#c5b391]"><div className="bg-[#c5b391] py-1 text-black">الحالات</div><div className="py-2 text-red-600">{reviewStats.totalCases}</div></div>
                                <div className="flex-1 flex flex-col border-r border-[#c5b391]"><div className="bg-[#c5b391] py-1 text-black">أخرى</div><div className="py-2">{reviewStats.other}</div></div>
                                <div className="flex-1 flex flex-col border-r border-[#c5b391]"><div className="bg-[#c5b391] py-1 text-black">استراحة</div><div className="py-2">{reviewStats.rest}</div></div>
                                <div className="flex-1 flex flex-col border-r border-[#c5b391]"><div className="bg-[#c5b391] py-1 text-black">إعفاء</div><div className="py-2">{reviewStats.exempt}</div></div>
                                <div className="flex-1 flex flex-col border-r border-[#c5b391]"><div className="bg-[#c5b391] py-1 text-black">غياب</div><div className="py-2">{reviewStats.absent}</div></div>
                                <div className="flex-1 flex flex-col border-r border-[#c5b391]"><div className="bg-[#c5b391] py-1 text-black">تأخير</div><div className="py-2">{reviewStats.late}</div></div>
                                <div className="flex-1 flex flex-col border-r border-[#c5b391]"><div className="bg-[#c5b391] py-1 text-black">إجازة</div><div className="py-2">{reviewStats.leave}</div></div>
                                <div className="flex-1 flex flex-col border-r border-[#c5b391]"><div className="bg-[#c5b391] py-1 text-black">عيادة</div><div className="py-2">{reviewStats.clinic}</div></div>
                                <div className="flex-1 flex flex-col border-r border-[#c5b391]"><div className="bg-[#c5b391] py-1 text-black">طبية</div><div className="py-2">{reviewStats.medical}</div></div>
                                <div className="flex-1 flex flex-col border-r border-[#c5b391]"><div className="bg-[#c5b391] py-1 text-black">العدد</div><div className="py-2">{reviewTotalStrength > 0 ? reviewTotalStrength : "-"}</div></div>
                            </div>

                            {/* ✅ تم إزالة الصندوق المكرر هنا بناءً على طلبك */}

                            <div className="bg-white border rounded-lg shadow-sm overflow-hidden min-h-[400px]">
                                {/* ✅ الجدول المعكوس في المراجعة */}
                                <Table><TableHeader className="bg-slate-100"><TableRow>
                                    <TableHead className="text-center bg-[#c5b391] text-black border font-bold">ملاحظات</TableHead>
                                    <TableHead className="w-[110px] text-center bg-[#c5b391] text-black border font-bold">بداية من</TableHead>
                                    <TableHead className="w-[60px] text-center bg-[#c5b391] text-black border font-bold">المدة</TableHead>
                                    <TableHead className="w-[140px] text-center bg-[#c5b391] text-black border font-bold">الحالة</TableHead>
                                    <TableHead className="w-[80px] text-center bg-[#c5b391] text-black border font-bold">الفصيل</TableHead>
                                    <TableHead className="w-[80px] text-center bg-[#c5b391] text-black border font-bold">السرية</TableHead>
                                    <TableHead className="text-center bg-[#c5b391] text-black border font-bold">الاسم</TableHead>
                                    <TableHead className="w-[120px] text-center bg-[#c5b391] text-black border font-bold">الرقم العسكري</TableHead>
                                    <TableHead className="w-[80px] text-center bg-[#c5b391] text-black border font-bold">الرتبة</TableHead>
                                    <TableHead className="w-[50px] text-center bg-[#c5b391] text-black border font-bold col-image">الصورة</TableHead>
                                    <TableHead className="w-[40px] text-center bg-[#c5b391] text-black border font-bold">#</TableHead>
                                </TableRow></TableHeader><TableBody>{selectedSession.records.map((rec: any, idx: number) => (
                                    <TableRow key={idx}>
                                        <TableCell className="p-1 border text-center text-xs">{rec.is_custom ? rec.value : ""}</TableCell>
                                        <TableCell className="text-center border text-xs" dir="ltr">{rec.date}</TableCell>
                                        <TableCell className="text-center border text-xs">{rec.is_custom ? "-" : "1"}</TableCell>
                                        <TableCell className="p-1 border text-center"><div className="font-bold text-black text-xs text-center">{rec.value}</div></TableCell>
                                        <TableCell className="text-center border text-xs">{rec.soldier?.platoon || "-"}</TableCell>
                                        <TableCell className="text-center border text-xs">{rec.soldier?.company || "-"}</TableCell>
                                        <TableCell className="text-center border font-medium text-xs">{rec.soldier?.name || "-"}</TableCell>
                                        <TableCell className="text-center border font-bold">{rec.soldier?.military_id || "-"}</TableCell>
                                        <TableCell className="text-center border text-xs">{rec.soldier?.rank || "-"}</TableCell>
                                        <TableCell className="text-center border p-1 col-image">{rec.soldier ? (<div className="w-8 h-8 rounded-full overflow-hidden mx-auto border bg-slate-200 relative flex items-center justify-center"><img src={`${process.env.NEXT_PUBLIC_API_URL}/static/images/${rec.soldier.military_id}.jpg`} className="w-full h-full object-cover relative z-10" onError={(e:any) => e.target.style.display='none'} alt="img" /><User className="w-4 h-4 text-slate-400 absolute" /></div>) : <div className="w-8 h-8 rounded-full bg-slate-100 mx-auto border border-dashed flex items-center justify-center"><User className="w-4 h-4 text-slate-300"/></div>}</TableCell>
                                        <TableCell className="text-center font-mono border">{idx + 1}</TableCell>
                                    </TableRow>
                                ))}</TableBody></Table>
                            </div>

                            <div className="signature-section mt-4 border-t-2 border-dashed border-slate-300 pt-4">
                                <div className="bg-white border-2 border-black p-2 rounded-none max-w-4xl mx-auto shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                    {/* ✅ 4. التواقيع المعكوسة في المراجعة أيضاً */}
                                    <div className="signature-section-inner flex flex-row gap-2 justify-between items-end">
                                        <div className="flex-1 signature-block signature-block-right text-right">
                                            <h3 className="font-bold text-center text-sm mb-2 underline flex items-center justify-center gap-2"><ShieldCheck className="w-3 h-3"/> اعتماد المسؤول</h3>
                                            <div className="space-y-1 px-2">
                                                {selectedSession.is_approved ? (
    <>
        {/* 1. بيانات المسؤول (عمودي) - خلفية خضراء فاتحة */}
        <div className="space-y-1">
            <div className="flex items-center gap-2 flex-row-reverse">
                <span className="font-bold w-12 text-[10px]">:الرتبة</span>
                <div className="flex-1 border-b border-black h-5 text-xs font-bold text-center bg-green-50 print:bg-transparent print:text-black">{selectedSession.records[0]?.approver_rank}</div>
            </div>
            <div className="flex items-center gap-2 flex-row-reverse">
                <span className="font-bold w-12 text-[10px]">:الاسم</span>
                <div className="flex-1 border-b border-black h-5 text-xs font-bold text-center bg-green-50 print:bg-transparent print:text-black">{selectedSession.records[0]?.approver_name}</div>
            </div>
        </div>

        {/* 2. التوقيع الإلكتروني (في الأسفل) */}
        {(() => {
            const approverMilId = selectedSession.records[0]?.approver_mil_id; 
            const approverSignaturePath = approverMilId 
                ? `${process.env.NEXT_PUBLIC_API_URL}/static/signatures/${approverMilId}.png`
                : null;

            return (
                <div className="text-center mt-2">
                    <div className="h-16 border-b border-black mb-1 flex items-end justify-center pb-1 relative print:border-b-0">
                        {approverSignaturePath ? (
                            <img 
                                src={approverSignaturePath} 
                                className="h-full w-auto object-contain max-w-[120px]" 
                                alt="Approver Signature"
                                onError={(e) => (e.target as HTMLImageElement).style.display='none'}
                            />
                        ) : (
                            // إذا لم يكن هناك توقيع محفوظ، نعرض فقط النص "معتمد" (مخفي في الطباعة)
                            <span className="text-green-600 text-[10px] font-bold border-2 border-green-600 px-2 rounded -rotate-12 print:hidden">معتمد</span>
                        )}
                        {/* 🔑 عرض كلمة "معتمد" كبديل ثابت لضمان شكل الطباعة إذا لم تظهر الصورة */}
                        <span className="hidden print:block text-green-600 text-[10px] font-bold border-2 border-green-600 px-2 rounded -rotate-12 absolute bottom-0 right-1/2 translate-x-1/2">معتمد</span>
                    </div>
                    <span className="font-bold text-[10px]">التوقيع</span>
                </div>
            );
        })()}
    </>
) : (
    <>
        <div className="print:hidden space-y-2">
            {/* 🔑 التحكم في حقول المُعتمد: جعلها للقراءة فقط للمدربين */}
            <div className="space-y-1">
    <label className="text-[10px] font-bold block">رتبة المسؤول</label>
    <Input 
        // التعديل هنا: إذا كان لديه صلاحية الاعتماد (canApprove) اعرض القيمة، وإلا فاجعلها فارغة.
        value={canApprove ? approverRank : ''} 
        onChange={(e) => setApproverRank(e.target.value)} 
        readOnly={!canApprove} 
        className={`bg-white border-black h-6 text-center font-bold text-xs ${!canApprove ? "bg-slate-50" : ""}`} 
        placeholder="الرتبة..." 
    />
</div>

{/* 🔑 تعديل حقل اسم المسؤول */}
<div className="space-y-1">
    <label className="text-[10px] font-bold block">اسم المسؤول</label>
    <Input 
        // التعديل هنا: إذا كان لديه صلاحية الاعتماد (canApprove) اعرض القيمة، وإلا فاجعلها فارغة.
        value={canApprove ? approverName : ''} 
        onChange={(e) => setApproverName(e.target.value)} 
        readOnly={!canApprove} 
        className={`bg-white border-black h-6 text-center font-bold text-xs ${!canApprove ? "bg-slate-50" : ""}`} 
        placeholder="الاسم..." 
    />
</div>

{/* 🔑 زر الاعتماد: يظهر فقط للأدوار المصرح لها */}
{canApprove && (
    <Button onClick={handleApproveSession} disabled={isApproving} className="w-full mt-2 bg-black hover:bg-slate-800 text-white h-7 text-[10px]">{isApproving ? <Loader2 className="animate-spin w-3 h-3"/> : "توقيع واعتماد"}</Button>
)}
        </div>
        <div className="hidden print:block text-center pt-8 text-xs italic text-gray-400">لم يتم الاعتماد بعد</div>
    </>
)}
                                            </div>
                                        </div>

                                        <div className="flex-1 signature-block signature-block-left border-l-0 md:border-r-2 md:border-l-0 border-dashed border-slate-200 pr-4">
                                            <h3 className="font-bold text-center text-sm mb-2 underline">المدرب المناوب</h3><div className="space-y-1 px-2"><div className="flex items-center gap-2 flex-row-reverse"><span className="font-bold w-16 text-[10px] whitespace-nowrap">:الرقم العسكري</span><div className="flex-1 border-b border-black h-5 text-xs font-bold text-center bg-slate-50">{selectedSession.writer_mil_id}</div></div><div className="flex items-center gap-2 flex-row-reverse"><span className="font-bold w-12 text-[10px]">:الرتبة</span><div className="flex-1 border-b border-black h-5 text-xs font-bold text-center bg-slate-50">{selectedSession.writer_rank}</div></div><div className="flex items-center gap-2 flex-row-reverse"><span className="font-bold w-12 text-[10px]">:الاسم</span><div className="flex-1 border-b border-black h-5 text-xs font-bold text-center bg-slate-50">{selectedSession.writer_name}</div></div> <div className="text-center mt-1">{(() => {const trainerMilId = selectedSession?.writer_mil_id;const trainerSignaturePath = trainerMilId ? `${process.env.NEXT_PUBLIC_API_URL}/static/signatures/${trainerMilId}.png`: null;return (<div className="h-16 flex items-end justify-center pb-1 relative">{trainerSignaturePath ? (<img  src={trainerSignaturePath} className="h-10 object-contain absolute bottom-0"  alt="signature"onError={(e) => (e.target as HTMLImageElement).style.display='none'}/>) : (<span className="text-slate-400 text-[8px] italic">لم يتم توفير توقيع</span>)} </div> ) })()}<span className="font-bold text-[10px]">التوقيع</span></div></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            <Dialog open={officerModal.isOpen} onOpenChange={(open) => !open && setOfficerModal({ ...officerModal, isOpen: false })}><DialogContent dir="rtl"><DialogHeader><DialogTitle>إدخال البيانات</DialogTitle></DialogHeader><div className="py-4"><Input value={officerInputValue} onChange={(e) => setOfficerInputValue(officerModal.field.includes('الرقم') ? normalizeInput(e.target.value) : e.target.value)} className="text-center text-lg font-bold" autoFocus /></div><Button onClick={saveOfficerData} className="w-full">حفظ</Button></DialogContent></Dialog>
            <Dialog open={statusModal.isOpen} onOpenChange={(open) => !open && setStatusModal({ ...statusModal, isOpen: false })}><DialogContent className="max-w-xl" dir="rtl"><DialogHeader><DialogTitle>تحديد الحالة</DialogTitle></DialogHeader>{!selectedStatusObj ? (<div className="grid grid-cols-3 gap-3 py-4">{STATUS_OPTIONS.map((opt) => (<button key={opt.id} onClick={() => setSelectedStatusObj(opt)} className={`flex flex-col items-center justify-center gap-2 p-3 rounded-lg border-2 hover:bg-slate-50 transition-all ${opt.color}`}><opt.icon className="w-6 h-6 mb-1" /><span className="font-bold text-sm">{opt.label}</span></button>))}</div>) : (<div className="space-y-6 py-4 animate-in slide-in-from-right-4"><div className={`flex items-center gap-2 p-3 rounded-lg border ${selectedStatusObj.color}`}><selectedStatusObj.icon className="w-5 h-5"/><span className="font-bold text-lg">{selectedStatusObj.label}</span><Button variant="ghost" size="sm" onClick={() => setSelectedStatusObj(null)} className="mr-auto text-xs underline">تغيير</Button></div>{selectedStatusObj.id.includes('late') ? (<div className="space-y-2"><label className="font-bold block">مدة التأخير (بالدقائق)</label><div className="flex items-center gap-2"><Input type="number" value={modalLateMinutes} onChange={(e) => setModalLateMinutes(e.target.value)} className="text-center text-xl font-bold h-12" placeholder="0" autoFocus /><span className="font-bold">دقيقة</span></div></div>) : (<div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="font-bold block">المدة (أيام)</label><Input type="number" value={modalDuration} onChange={(e) => setModalDuration(e.target.value)} className="text-center font-bold" /></div><div className="space-y-2"><label className="font-bold block">بداية من تاريخ</label><Input type="date" value={modalStartDate} onChange={(e) => setModalStartDate(e.target.value)} /></div></div>)}{selectedStatusObj.id === 'other' && (<div className="space-y-2"><label className="font-bold block">توضيح الحالة</label><Input value={modalCustomNote} onChange={(e) => setModalCustomNote(e.target.value)} placeholder="اكتب هنا..." /></div>)}<Button onClick={saveStatusFromModal} className="w-full bg-slate-900 text-white h-12 text-lg">تأكيد وإضافة</Button></div>)}</DialogContent></Dialog>
            <Dialog open={notesModal.isOpen} onOpenChange={(open) => !open && setNotesModal({ ...notesModal, isOpen: false })}><DialogContent dir="rtl"><DialogHeader><DialogTitle>إضافة ملاحظة</DialogTitle></DialogHeader><Textarea value={notesModal.text} onChange={(e) => setNotesModal({ ...notesModal, text: e.target.value })} className="min-h-[150px] text-base" placeholder="اكتب الملاحظات هنا..." /><DialogFooter><Button onClick={saveNotesFromModal}>حفظ الملاحظة</Button></DialogFooter></DialogContent></Dialog>
            <Dialog open={mobileAddOpen} onOpenChange={setMobileAddOpen}><DialogContent><DialogHeader><DialogTitle>إضافة مجند</DialogTitle></DialogHeader><div className="py-4"><label className="block mb-2 font-bold">الرقم العسكري:</label><Input value={mobileMilId} onChange={(e) => setMobileMilId(normalizeInput(e.target.value))} className="text-center text-xl" autoFocus /></div><Button onClick={() => { addNewRow(); handleMilitaryIdInput(rows.length, mobileMilId); lookupSoldierData(rows.length); setMobileAddOpen(false); setMobileMilId(""); }} className="w-full">إضافة</Button></DialogContent></Dialog>
            {/* نافذة تأكيد فك الاعتماد الجميلة */}
            <Dialog open={unapproveConfirmOpen} onOpenChange={setUnapproveConfirmOpen}>
                <DialogContent dir="rtl" className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="w-6 h-6" />
                            تنبيه
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="py-4 space-y-3">
                        <p className="font-bold text-lg text-center">
                            هل أنت متأكد من رغبتك في فك الاعتماد؟
                        </p>
                        <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-red-800 text-sm text-center">
                            ⚠️ تحذير: سيتمكن المدرب المناوب من تعديل البيانات وحذفها مرة أخرى.
                        </div>
                    </div>

                    <DialogFooter className="flex gap-2 sm:justify-start">
                        <Button variant="ghost" onClick={() => setUnapproveConfirmOpen(false)}>
                            إلغاء الأمر
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={executeUnapprove} 
                            className="bg-red-600 hover:bg-red-700 gap-2"
                        >
                            <Unlock className="w-4 h-4" />
                            نعم، فك الاعتماد
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogContent dir="rtl" className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <XCircle className="w-6 h-6" />
                            تأكيد حذف حالة
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="py-4 space-y-3">
                        <p className="font-bold text-lg text-center">
                            هل أنت متأكد من حذف سجل الحالة للمجند رقم {rowToDelete?.militaryId}?
                        </p>
                        <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-red-800 text-sm text-center">
                            ⚠️ ملاحظة: سيتم حذف السجل نهائياً من قاعدة البيانات.
                        </div>
                    </div>

                    <DialogFooter className="flex gap-2 sm:justify-start">
                        <Button variant="ghost" onClick={() => setDeleteConfirmOpen(false)}>
                            إلغاء الأمر
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={executeDelete} // 🔑 ربط بزر تنفيذ الحذف
                            className="bg-red-600 hover:bg-red-700 gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            نعم، احذف السجل
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
        </ProtectedRoute>
    )
}