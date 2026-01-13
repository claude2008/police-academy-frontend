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
import { Plus, Trash2, Save, Printer, FileSpreadsheet, Loader2, AlertTriangle, User, UserPlus, CheckCircle2, HelpCircle, Clock, Stethoscope, FileText, UserMinus, PenTool, FileCheck, ArrowRight, Calendar, ShieldCheck, Hourglass, Unlock, ShieldAlert, Swords, Shirt, Footprints, XCircle } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import * as XLSX from 'xlsx'
import ProtectedRoute from "@/components/ProtectedRoute"

// =========================================================
// 1. الثوابت والأدوار الجديدة لصفحة المخالفات
// =========================================================

// 🔑 الأدوار التي لها صلاحية الإدخال والمراجعة (تم تصحيح الأدور لكي تتطابق مع Backend)
const ENTRY_ROLES = ["owner", "manager", "admin", "military_officer", "military_supervisor", "military_trainer"];
// 🔑 الأدوار التي ترى كل السجلات في المراجعة
const REVIEW_ADMIN_ROLES = ["owner", "manager", "admin", "military_officer", "military_supervisor"]; 
const APPROVE_ROLES = ["owner", "manager", "admin", "military_officer"];
const VIOLATION_OPTIONS = [
    { id: "property_damage", label: "إتلاف عهدة", color: "bg-red-100 text-red-700 border-red-200", icon: Trash2 },
    { id: "uniform_violation", label: "قيافة وهندام", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Shirt },
    { id: "dress_code", label: "مخالفة اللبس", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Shirt },
    { id: "insubordination", label: "تمرد", color: "bg-red-100 text-red-700 border-red-200", icon: ShieldAlert },
    { id: "disobedience", label: "عصيان أوامر", color: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle },
    { id: "argument", label: "مجادلة أو تعطيل سير الحصة", color: "bg-orange-100 text-orange-700 border-orange-200", icon: Swords },
    { id: "fleeing", label: "الهروب من الحصة", color: "bg-red-100 text-red-700 border-red-200", icon: Footprints },
    { id: "incomplete_session", label: "عدم إكمال الحصة", color: "bg-orange-100 text-orange-700 border-orange-200", icon: UserMinus },
    { id: "laughing", label: "ضحك", color: "bg-blue-100 text-blue-700 border-blue-200", icon: UserMinus }, 
    { id: "feigning_illness", label: "تمارض", color: "bg-cyan-100 text-cyan-700 border-cyan-200", icon: Stethoscope },
    { id: "laziness", label: "تكاسل", color: "bg-gray-200 text-gray-800 border-gray-300", icon: Clock },
    { id: "other", label: "أخرى", color: "bg-gray-200 text-gray-800 border-gray-300", icon: HelpCircle },
];

const findViolationObj = (val: string) => {
    // نبحث عن تطابق في العنوان
    const found = VIOLATION_OPTIONS.find(opt => val.includes(opt.label));
    return found || null;
};

export default function MilitaryViolationsPage() {
    const [currentDate, setCurrentDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [reviewDate, setReviewDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [shift, setShift] = useState("morning")
    const [filterCourse, setFilterCourse] = useState("all")
    const [filterBatch, setFilterBatch] = useState("all")
    const [filterOptions, setFilterOptions] = useState<any>({ courses: [], batches: [] })
    
    const [rows, setRows] = useState<any[]>([])
   const [isDirty, setIsDirty] = useState(false);
   console.log("🔍 مراقب الحالة -> isDirty:", isDirty);
    const [userRole, setUserRole] = useState<string | null>(null) // 🔑 حالة دور المستخدم

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
    
    const [violationModal, setViolationModal] = useState<{ isOpen: boolean, rowIndex: number | null }>({ isOpen: false, rowIndex: null })
    const [notesModal, setNotesModal] = useState<{ isOpen: boolean, rowIndex: number | null, text: string }>({ isOpen: false, rowIndex: null, text: "" })
    const [mobileAddOpen, setMobileAddOpen] = useState(false)
    const [mobileMilId, setMobileMilId] = useState("")
    const [officerModal, setOfficerModal] = useState<{ isOpen: boolean, field: string, value: string, setter: any }>({ isOpen: false, field: "", value: "", setter: null })
    const [officerInputValue, setOfficerInputValue] = useState("")

    const [selectedViolationObj, setSelectedViolationObj] = useState<any>(null) 
    
    const [modalCustomNote, setModalCustomNote] = useState("")
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [isSessionLocked, setIsSessionLocked] = useState(false);
    const [unapproveConfirmOpen, setUnapproveConfirmOpen] = useState(false)
    const UNAPPROVE_ROLES = ["owner", "manager", "admin", "military_officer"];
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [rowToDelete, setRowToDelete] = useState<any>(null);

    const normalizeInput = (val: string) => val ? val.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString()) : "";

    // 🔑 المتغيرات المحسوبة
    const isAddDisabled = useMemo(() => {
        return isSessionLocked || filterCourse === 'all' || filterBatch === 'all';
    }, [isSessionLocked, filterCourse, filterBatch]);
    
    const paginatedRows = useMemo(() => {
        return rows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    }, [rows, currentPage, itemsPerPage]);

    // =========================================================
    // 2. الدوال الرئيسية (Core Functions)
    // =========================================================
    const getAuthHeaders = () => ({
    "Authorization": `Bearer ${localStorage.getItem("token")}`,
    "Content-Type": "application/json"
});
  const loadExistingData = async () => {
    // 1. منع التنفيذ إذا كانت الفلاتر ناقصة
    if (filterCourse === 'all' || filterBatch === 'all') {
        setRows([]);
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
            entry_type: "violation",
            limit: "500" 
        });

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance/?${params.toString()}`, {
            headers: {
                "Authorization": `Bearer ${localStorage.getItem("token")}`,
                "Content-Type": "application/json"
            }
        });

        if (res.ok) {
            const data = await res.json();
            
            if (data.length > 0) {
                // فحص حالة الاعتماد من أول سجل موجود في قاعدة البيانات
                const isApproved = data[0].is_approved;
                setIsSessionLocked(isApproved);

                const mappedRows = data.map((rec: any) => {
                    let finalStatus = findViolationObj(rec.value);
                    
                    if (rec.is_custom) {
                        finalStatus = { 
                            id: 'other_custom', 
                            label: rec.value, 
                            color: VIOLATION_OPTIONS.find(o => o.id === 'other')?.color || 'bg-gray-200', 
                            icon: HelpCircle 
                        };
                    } 

                    return {
                        id: rec.id, 
                        soldierDbId: rec.soldier.id,
                        militaryId: rec.soldier.military_id,
                        name: rec.soldier.name,
                        rank: rec.soldier.rank,
                        company: rec.soldier.company,
                        platoon: rec.soldier.platoon,
                        status: finalStatus, 
                        note: rec.note, 
                        isNew: false // هذه البيانات قادمة من السيرفر وليست جديدة
                    };
                });

                setRows(mappedRows);
                
                // 🚀 بما أننا جلبنا بيانات رسمية من السيرفر، نعتبر الحالة "نظيفة" الآن
                setIsDirty(false);

                if (isApproved) {
                    toast.info("هذا الكشف معتمد حالياً ولا يمكن التعديل عليه");
                }
            } else {
                // إذا لم توجد بيانات في السيرفر
                setIsSessionLocked(false);
                setRows([]);
                setIsDirty(false); // لا توجد تعديلات غير محفوظة لأن الجدول فارغ
            }
        } else {
            // في حالة خطأ الاستجابة من السيرفر
            const errorText = await res.text();
            console.error("Error fetching data:", errorText);
            // لا نقوم بتصفير الصفوف هنا لترك فرصة للمستخدم لرؤية ما لديه
        }
    } catch (e) {
        console.error("Failed to load existing violations", e);
        toast.error("خطأ في الاتصال بالخادم أثناء جلب البيانات");
    }
};
    
    const fetchSavedRecords = async () => {
        setLoadingSaved(true)
        setSelectedSession(null)
        
        const currentTrainerMilId = writerMilId;
        const currentUserRole = userRole; 
        
        let reviewScope = "all";
        // 🔑 منطق تصفية المدربين: المدرب يرى سجلاته فقط
        if (currentUserRole === "military_trainer") {
            reviewScope = "my_records";
        }
        
        try {
            const params = new URLSearchParams({ 
                start_date: reviewDate, 
                end_date: reviewDate, 
                class_type: "military", 
                entry_type: "violation", 
                limit: "2000",
                
                review_scope: reviewScope, 
                trainer_mil_id: currentTrainerMilId || ""
            })
            
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance/?${params.toString()}`)
            if (res.ok) {
                const data = await res.json()
                setSavedRecords(data)
            } else { toast.error("فشل جلب السجلات") }
        } catch (e) { console.error(e) } finally { setLoadingSaved(false) }
    }
    
   const handleSave = async () => { 
    if (rows.length === 0) { toast.error("لا توجد بيانات"); return; } 
    if (filterCourse === 'all' || filterBatch === 'all') { toast.error("يرجى اختيار الدورة والدفعة"); return; } 
    if (!writerName || !writerRank || !writerMilId) { toast.error("بيانات المدرب غير مكتملة"); return; } 
    
    setIsSaving(true); 
    try { 
        const payload = rows.filter((r: any) => r.soldierDbId && r.status).map((r: any) => ({ 
            soldier_id: r.soldierDbId, 
            date: currentDate,
            type: 'violation', 
            value: r.status.label, 
            class_type: "military", 
            is_custom: r.status.id === 'other' || r.status.id === 'other_custom', 
            shift: shift, 
            course_name: filterCourse, 
            batch_name: filterBatch, 
            writer_rank: writerRank, 
            writer_name: writerName, 
            writer_mil_id: writerMilId 
        })); 
        
        // 🛡️ تنفيذ الحفظ مع التوكن
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance/bulk`, { 
            method: "POST", 
            headers: { 
                "Authorization": `Bearer ${localStorage.getItem("token")}`,
                "Content-Type": "application/json" 
            }, 
            body: JSON.stringify(payload) 
        }); 
        
        if (res.ok) { 
            toast.success("تم حفظ المخالفات بنجاح"); 
            
            // 🚀 تصفير تنبيه "تعديلات غير محفوظة"
            setIsDirty(false); 
            
            // 🔄 تحديث البيانات وحالة القفل
            await loadExistingData(); 
            if (typeof fetchSavedRecords === 'function') fetchSavedRecords();
        } else { 
            toast.error("حدث خطأ أثناء الحفظ. تأكد من الصلاحيات وأن الكشف غير معتمد."); 
        } 
    } catch (e) { 
        toast.error("خطأ في الاتصال بالخادم"); 
    } finally { 
        setIsSaving(false); 
    } 
}; 

    // 🔑 دالة حذف صف (تفتح النافذة)
    const handleDeleteRow = (rowIndex: number) => {
        const row = rows[rowIndex];
        
        if(isSessionLocked) {
             toast.error("لا يمكن الحذف أو التعديل لأن هذا الكشف معتمد.");
             return;
        }

        if (row.id && !row.isNew) { 
            setRowToDelete(row);
            setDeleteConfirmOpen(true);
        } else {
            const newRows = rows.filter((_, idx) => idx !== rowIndex);
            setRows(newRows);
            setIsDirty(true);
            toast.success("تم حذف الصف بنجاح");
        }
    };
    
    // 🔑 دالة تنفيذ الحذف من DB
    const executeDelete = async () => {
        if (!rowToDelete) return;
        
        const tempId = rowToDelete.id;
        
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance/${tempId}`, { method: "DELETE" });

            if (!res.ok) { toast.error("فشل حذف السجل من قاعدة البيانات"); return; }
            
            const newRows = rows.filter((r: any) => r.id !== tempId);
            setRows(newRows);
            toast.success("تم حذف الصف بنجاح");
            
        } catch (e) { toast.error("خطأ اتصال أثناء الحذف"); } 
        finally { setDeleteConfirmOpen(false); setRowToDelete(null); }
    };

    const handleApproveSession = async () => {
    // 🔑 الرقم العسكري للمعتمد هو الرقم العسكري للمستخدم الحالي
    const approverMilId = writerMilId; 

    if (!approverName || !approverRank || !approverMilId) { 
        toast.error("يرجى إدخال بيانات المسؤول (أو إعادة تسجيل الدخول)."); 
        return; 
    } 
    if (!selectedSession || selectedSession.record_ids.length === 0) return; 

    setIsApproving(true);
    try { 
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance/approve`, { 
            method: "PUT", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ 
                ids: selectedSession.record_ids, 
                approver_rank: approverRank, 
                approver_name: approverName,
                approver_mil_id: approverMilId, // 🔑 الإضافة الحاسمة هنا 
            }) 
        }); 
        
        if (res.ok) { 
            toast.success("تم الاعتماد بنجاح"); 
            setSelectedSession(null); 
            fetchSavedRecords(); 
        } else { 
            const errorData = await res.json();
            toast.error(errorData.detail || "فشل الاعتماد"); 
        } 
    } catch (e) { 
        toast.error("خطأ اتصال"); 
    } finally { 
        setIsApproving(false); 
    } 
}
    
    const requestUnapprove = () => { setUnapproveConfirmOpen(true); }
    const executeUnapprove = async () => {
    if (!selectedSession || selectedSession.record_ids.length === 0) return;
    
    setIsApproving(true);
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance/unapprove`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ids: selectedSession.record_ids,
                // 🔑 إضافة الحقول المطلوبة للتصفير:
                approver_rank: "", 
                approver_name: "",
                approver_mil_id: "" // 🔑 إضافة الرقم العسكري للمعتمد (فارغ للتصفير)
            })
        });
        
        if (res.ok) {
            toast.success("تم فك الاعتماد بنجاح");
            setUnapproveConfirmOpen(false);
            setSelectedSession(null);
            fetchSavedRecords();
        } else {
            const errorData = await res.json();
            toast.error(errorData.detail || "فشل العملية");
        }
    } catch (e) {
        toast.error("خطأ اتصال");
    } finally {
        setIsApproving(false);
    }
}

    // =========================================================
    // 3. الدوال المساعدة (Helper Functions)
    // =========================================================
    
   const groupedSessions = useMemo(() => { 
        const sessions: any = {};
        savedRecords.forEach(rec => {
            if (rec.type !== 'violation') return; // تصفية لضمان المخالفات فقط

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
                    date: format(new Date(rec.date), "yyyy-MM-dd") 
                };
            }
            sessions[key].records.push(rec);
            sessions[key].record_ids.push(rec.id);
            sessions[key].count++;
        });
        return Object.values(sessions);
    }, [savedRecords]);

    const handleExportExcel = (dataToExport: any[], fileName: string) => { 
        if (!dataToExport || dataToExport.length === 0) { toast.warning("لا توجد بيانات"); return; } 
        
        const data = dataToExport.map((r, i) => ({ 
            "م": i + 1, 
            "الرتبة": r.rank || r.soldier?.rank, 
            "الرقم العسكري": r.militaryId || r.soldier?.military_id, 
            "الاسم": r.name || r.soldier?.name, 
            "السرية": r.company || r.soldier?.company, 
            "الفصيل": r.platoon || r.soldier?.platoon, 
            "المخالفة": r.status ? r.status.label : (r.value || "-"),
            "ملاحظات": r.note
        })); 
        
        const ws = XLSX.utils.json_to_sheet(data); 
        const wb = XLSX.utils.book_new(); 
        XLSX.utils.book_append_sheet(wb, ws, "المخالفات"); 
        XLSX.writeFile(wb, `${fileName}.xlsx`); 
    }
    
    const handlePrintWithTitle = (isReview = false) => {
        const originalTitle = document.title; 
        let customTitle = "";
        
        if (isReview && selectedSession) {
            const sText = selectedSession.shift === 'morning' ? 'صباحي' : selectedSession.shift === 'afternoon' ? 'عصر' : 'ليلي';
            const sessionDate = selectedSession.date || reviewDate;
            customTitle = `كشف_المخالفات_فرع_التدريب_العسكري_${selectedSession.course_name}_${selectedSession.batch_name}_${sText}_${sessionDate}`;
        } else {
            const sText = shift === 'morning' ? 'صباحي' : shift === 'afternoon' ? 'عصر' : 'ليلي';
            const courseName = filterCourse === 'all' ? 'دورة_عامة' : filterCourse;
            const batchName = filterBatch === 'all' ? 'دفعة_عامة' : filterBatch;
            customTitle = `كشف_المخالفات_فرع_التدريب_العسكري_${courseName}_${batchName}_${sText}_${currentDate}`;
        }

        document.title = customTitle;
        window.print();
        setTimeout(() => { document.title = originalTitle }, 1000);
    }
    
 const addNewRow = () => {
    if (filterCourse === 'all' || filterBatch === 'all') {
        toast.warning("يرجى اختيار الدورة والدفعة أولاً.");
        return;
    }
    
    // نحدث الحالة أولاً ثم نضيف الصف
    setIsDirty(true); 
    setRows(prev => [...prev, { 
        id: Date.now(), militaryId: "", name: "", rank: "", company: "", platoon: "", 
        status: null, note: "", isNew: true 
    }]);
};
    
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
    
    const lookupSoldierData = async (index: number) => { 
        const row = rows[index]; 
        if (!row.militaryId || row.militaryId.length < 3) return; 
        try { 
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/?search=${row.militaryId}&limit=1`); 
            const data = await res.json(); 
            const newRows = [...rows]; 
            if (data.data && data.data.length > 0) { 
                const s = data.data[0]; 
                newRows[index] = { ...newRows[index], soldierDbId: s.id, militaryId: s.military_id, name: s.name, rank: s.rank, company: s.company, platoon: s.platoon, isNew: false }; 
                toast.success("تم جلب البيانات"); 
            } else { 
                toast.error("الرقم غير موجود"); 
                newRows[index].name = "غير موجود"; 
                newRows[index].rank = ""; 
            } 
            setRows(newRows); 
            setIsDirty(true);
        } catch (e) { } 
    }
    
    const handleKeyDown = (e: React.KeyboardEvent, index: number) => { if (e.key === 'Enter') lookupSoldierData(index); }
    
  const saveViolationFromModal = () => { 
    if (violationModal.rowIndex === null || !selectedViolationObj) return; 
    const newRows = [...rows]; 
    const row = newRows[violationModal.rowIndex]; 

    row.status = selectedViolationObj; 
    
    if (selectedViolationObj.id === 'other') {
        row.status = { ...selectedViolationObj, label: modalCustomNote };
    }

    setRows(newRows); 
    setViolationModal({ isOpen: false, rowIndex: null }); 
    setSelectedViolationObj(null); 
    setModalCustomNote(""); 
    
    // إظهار تنبيه التعديلات الجديدة
    setIsDirty(true); 
};
    
   const saveNotesFromModal = () => { 
    if (notesModal.rowIndex === null) return; 
    
    const newRows = [...rows]; 
    newRows[notesModal.rowIndex].note = notesModal.text; 
    
    setRows(newRows); 
    setNotesModal({ isOpen: false, rowIndex: null, text: "" }); 
    
    // إظهار تنبيه التعديلات الجديدة
    setIsDirty(true); 
};

    const openOfficerModalHelper = (title: string, value: string, setter: any) => { setOfficerModal({ isOpen: true, field: title, value, setter }); setOfficerInputValue(value); }
    const saveOfficerData = () => { officerModal.setter(officerInputValue); setOfficerModal({ ...officerModal, isOpen: false }); }
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
    // ... (بقية الـ UseEffects) ...

    // =========================================================
    // 4. الـ UseEffects
    // =========================================================
   // هذا المراقب يضمن أنه بمجرد حدوث أي تغيير في عدد الصفوف أو محتواها، تظهر الرسالة
useEffect(() => {
    if (rows.length > 0) {
        // إذا كان هناك صف واحد على الأقل هو صف "جديد" (isNew)
        // أو إذا تم تعديل صف موجود (بناءً على منطقك)
        const hasNewChanges = rows.some(row => row.isNew || row.id === Date.now()); 
        if (hasNewChanges) {
            setIsDirty(true);
        }
    }
}, [rows]); // يراقب مصفوفة الصفوف مباشرة 
   useEffect(() => {
    let militaryId = ""; // 🔑 متغير مؤقت لحفظ الرقم العسكري

    // 🚀 A. الملء التلقائي وبيانات المستخدم (تشتغل فقط عند أول تحميل للمكون)
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

            if (militaryId) {
                checkSavedSignature(militaryId);
            }
        }
    } catch (e) { /* تجاهل أخطاء localStorage */ }

    // 🚀 B. جلب خيارات الفلتر
    const fetchFilters = async () => {
        try {
            const params = new URLSearchParams();
            if (filterCourse !== 'all') params.append('course', filterCourse);
            
            // 🛡️ إضافة التوكن لضمان أمان جلب الفلاتر
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/filters-options?${params.toString()}`, {
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                }
            });

            if (res.ok) {
                const data = await res.json();
                setFilterOptions((prev: any) => ({
                    ...prev,
                    batches: data.batches,
                    courses: prev.courses.length ? prev.courses : data.courses
                }));
            }
        } catch (e) { }
    };

    fetchFilters();

    // 🛑 ملاحظة حاسمة: تم حذف سطر setIsDirty(false) من هنا 
    // لكي لا يتم تصفير التنبيه تلقائياً عند تحديث الفلاتر أو إعادة الرسم (Re-render)
    
}, [filterCourse]); // يعتمد فقط على تغيير الدورة لتحديث القوائم المنسدلة
// منع مغادرة الصفحة عند وجود تعديلات
useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (isDirty) {
            e.preventDefault();
            e.returnValue = "لديك تعديلات غير محفوظة";
        }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
        window.removeEventListener("beforeunload", handleBeforeUnload);
        setIsDirty(false); // تصفير عند الخروج من الصفحة
    };
}, [isDirty]);
    // 🛑 تشغيل دالة loadExistingData عند تغيير الفلاتر
   useEffect(() => {
    // 1. لا تفعل شيئاً إذا كانت الاختيارات ناقصة
    if (filterCourse === 'all' || filterBatch === 'all') return;

    // 2. 🛡️ الحاجز الأمني: إذا قام المستخدم بإضافة صف (isDirty: true)
    // نوقف فوراً أي محاولة لجلب بيانات من الخادم لمنع مسح الصف الجديد
    if (isDirty) {
        console.log("🛑 تم إيقاف جلب البيانات لأن هناك تعديلات غير محفوظة");
        return;
    }

    // 3. جلب البيانات فقط في حالة الحالة "نظيفة"
    console.log("🔄 جلب البيانات الرسمية من قاعدة البيانات...");
    loadExistingData();

    // نراقب الفلاتر فقط، ولا نراقب isDirty كـ Dependency لإطلاق الدالة
    // بل نستخدمها فقط كشرط (Condition)
}, [currentDate, shift, filterCourse, filterBatch]);
    
const canApprove = APPROVE_ROLES.includes(userRole || '');
    return (
<ProtectedRoute allowedRoles={["owner"]}>
        <div className="space-y-6 p-2 md:p-6 pb-20 md:pb-32 " dir="rtl">
            <style jsx global>{`
                @media print {
                    @page { size: portrait; margin: 5mm; } 
                    nav, aside, header, button, .print\\:hidden, [role="tablist"] { display: none !important; }
                    body { background: white; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .print-header-show { display: flex !important; }
                    .col-image { display: none !important; }
                    th { background-color: #c5b391 !important; color: black !important; border: 1px solid black !important; font-size: 10px; }
                    td { border: 1px solid black !important; font-size: 10px; height: 30px; }
                    input { border: none !important; background: transparent !important; }
                    .h-16 { height: 40px !important; } /* 🔑 تعديل الارتفاع للطباعة */
                    
                    .signature-section-inner { display: flex !important; flex-direction: row !important; justify-content: space-between !important; align-items: flex-end !important; gap: 2rem !important; }
                    .signature-block { width: 48% !important; margin: 0 !important; border: none !important; }
                    .signature-block-left { order: 1 !important; border-left: 2px dashed #ccc !important; padding-left: 1rem !important; } 
                    .signature-block-right { order: 2 !important; } 
                    
                    .signature-section { break-inside: avoid; page-break-inside: avoid; margin-top: 10px !important; }
                    .status-btn { display: none !important; }
                    .status-text { display: block !important; }
                }
                .print-header-show { display: none; }
                .status-text { display: none; }
            `}</style>

            {/* ✅ عنوان الطباعة */}
            <div className="print-header-show w-full flex-row justify-between items-start mb-4 border-b-2 border-black pb-2">
                <div className="text-right w-1/3"><img src="/logo.jpg" alt="Logo" className="h-20 object-contain" /></div>
                <div className="text-center w-1/3 pt-2">
                    <h2 className="text-lg font-bold">معهد الشرطة</h2>
                    <h3 className="font-bold">قسم التدريب العسكري والرياضي</h3>
                    <h3 className="font-bold underline mt-1">كشف المخالفات اليومي</h3>
                    <div className="mt-1 text-xs border border-black p-1 inline-block px-4 font-bold">{selectedSession ? `${selectedSession.course_name} / ${selectedSession.batch_name}` : `${filterCourse === 'all' ? 'كل الدورات' : filterCourse} / ${filterBatch === 'all' ? 'كل الدفعات' : filterBatch}`}</div>
                </div>
                <div className="text-left w-1/3 flex flex-col items-end gap-1 pt-4 pl-4 font-bold text-xs">
                    <div>{selectedSession ? selectedSession.date : currentDate}</div>
                    <div>{selectedSession ? (selectedSession.shift === 'morning' ? 'صباحي' : selectedSession.shift === 'afternoon' ? 'عصر' : 'ليلي') : (shift === 'morning' ? 'صباحي' : shift === 'afternoon' ? 'عصر' : 'ليلي')}</div>
                </div>
            </div>

            <Tabs defaultValue="entry" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px] mx-auto mb-6 print:hidden">
    <TabsTrigger value="entry" onClick={() => loadExistingData()}>إدخال المخالفات</TabsTrigger>
    <TabsTrigger value="review" onClick={fetchSavedRecords}>سجل المراجعة والاعتماد</TabsTrigger>
</TabsList>

                <TabsContent value="entry" className="space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
                        {/* 1. الأزرار (تصدير، طباعة، حفظ) */}
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => handleExportExcel(rows, `المخالفات_فرع_عسكري_${currentDate}`)} className="gap-2 text-green-700 border-green-200 hover:bg-green-50">
                                <FileSpreadsheet className="w-4 h-4"/> تصدير
                            </Button>
                            <Button variant="outline" onClick={() => handlePrintWithTitle(false)} className="gap-2">
                                <Printer className="w-4 h-4"/> طباعة
                            </Button>
                            <Button onClick={handleSave} disabled={isSaving || isSessionLocked} className="gap-2 bg-slate-900 text-white">
                                {isSaving ? <Loader2 className="animate-spin"/> : <Save className="w-4 h-4"/>} حفظ
                            </Button>
                        </div>

                        {/* 2. العنوان */}
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-red-100 rounded-lg">
                                <ShieldAlert className="w-6 h-6 text-red-700"/>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold">تسجيل المخالفات</h1>
                                <p className="text-xs text-slate-500">فرع التدريب العسكري</p>
                            </div>
                        </div>
                    </div>

                    {/* 3. فلاتر الدورة/الدفعة/الشيفت/التاريخ (كما هي) */}
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
    {/* تنبيه الاعتماد (يعمل بشكل صحيح) */}
    {isSessionLocked && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            <span className="font-bold text-sm">تنبيه: هذا الكشف معتمد ولا يمكن التعديل عليه.</span>
        </div>
    )}

    {/* 🚀 التعديل الجذري هنا: إزالة الأنميشن المعقد وتبسيط الشرط لضمان الظهور */}
   {!isSessionLocked && (isDirty || rows.some(r => r.isNew)) && (
    <div className="bg-amber-50 border-2 border-amber-500 text-amber-900 px-4 py-3 rounded-md flex items-center shadow-md relative z-50">
        <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 animate-pulse" />
            <span className="font-bold text-sm">
                تنبيه: لديك تعديلات جديدة. يرجى الضغط على زر "حفظ" لتسجيلها، وإلا ستفقدها.
            </span>
        </div>
    </div>
)}
</div>
</Card>
                    
                    {/* 4. جدول المخالفات */}
                    <div className="bg-white border rounded-lg shadow-sm overflow-hidden min-h-[400px]">
                        <Table>
                            <TableHeader className="bg-slate-100">
                                <TableRow>
                                    <TableHead className="w-[40px] text-center bg-[#c5b391] text-black border font-bold print:hidden"></TableHead>
                                    
                                    <TableHead className="text-center bg-[#c5b391] text-black border font-bold">ملاحظة</TableHead>
                                    <TableHead className="w-[140px] text-center bg-[#c5b391] text-black border font-bold">المخالفة</TableHead>
                                    <TableHead className="w-[80px] text-center bg-[#c5b391] text-black border font-bold">الفصيل</TableHead>
                                    <TableHead className="w-[80px] text-center bg-[#c5b391] text-black border font-bold">السرية</TableHead>
                                    <TableHead className="text-center bg-[#c5b391] text-black border font-bold">الاسم</TableHead>
                                    <TableHead className="w-[120px] text-center bg-[#c5b391] text-black border font-bold">الرقم العسكري</TableHead>
                                    <TableHead className="w-[80px] text-center bg-[#c5b391] text-black border font-bold">الرتبة</TableHead>
                                    <TableHead className="w-[50px] text-center bg-[#c5b391] text-black border font-bold col-image">الصورة</TableHead>
                                    <TableHead className="w-[40px] text-center bg-[#c5b391] text-black border font-bold">#</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.length === 0 ? (
                                    <TableRow><TableCell colSpan={10} className="h-40 text-center text-slate-400"><div className="flex flex-col items-center gap-2"><UserPlus className="w-10 h-10 opacity-30" /><span>ابدأ بإضافة مجندين</span><Button onClick={addNewRow} variant="outline" className="mt-2">إضافة صف جديد</Button></div></TableCell></TableRow>
                                ) : (paginatedRows.map((row: any, i: number) => { 
                                    const realIndex = (currentPage - 1) * itemsPerPage + i; 
                                    return (
                                        <TableRow key={row.id}>
                                            <TableCell className="text-center border p-1 print:hidden">
                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteRow(realIndex)} className="h-8 w-8 text-red-500">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                            
                                            <TableCell className="p-1 border text-center">
                                                {row.note ? 
                                                    <Button variant="ghost" size="sm" onClick={() => setNotesModal({ isOpen: true, rowIndex: realIndex, text: row.note })} className="h-8 text-xs truncate max-w-[100px] block">{row.note}</Button> : 
                                                    <Button variant="ghost" size="icon" onClick={() => setNotesModal({ isOpen: true, rowIndex: realIndex, text: "" })} className="h-8 w-8 text-slate-300 hover:text-slate-500"><PenTool className="w-3 h-3" /></Button>}
                                            </TableCell>
                                            
                                            <TableCell className="p-1 border text-center">
                                                <div className="status-btn">
                                                    <Button variant="outline" size="sm" onClick={() => { setViolationModal({ isOpen: true, rowIndex: realIndex }); setSelectedViolationObj(null); }} 
                                                        className={`w-full h-8 text-xs ${row.status ? row.status.color : 'text-slate-400'}`}>
                                                        {row.status ? <span className="flex items-center gap-1"><row.status.icon className="w-3 h-3"/> {row.status.label}</span> : "اختر المخالفة"}
                                                    </Button>
                                                </div>
                                                <div className="status-text font-bold text-black text-xs text-center pt-1">
                                                    {row.status ? row.status.label : ""}
                                                </div>
                                            </TableCell>
                                            
                                            <TableCell className="text-center border text-xs">{row.platoon || "-"}</TableCell>
                                            <TableCell className="text-center border text-xs">{row.company || "-"}</TableCell>
                                            <TableCell className="text-center border font-medium text-xs">{row.name || ""}</TableCell>
                                            <TableCell className="p-1 border"><Input value={row.militaryId} onChange={(e) => handleMilitaryIdInput(realIndex, e.target.value)} onBlur={() => lookupSoldierData(realIndex)} onKeyDown={(e) => handleKeyDown(e, realIndex)} className="h-8 text-center font-bold border-blue-200 focus:border-blue-500 bg-white" placeholder="رقم" /></TableCell>
                                            <TableCell className="text-center border text-xs">{row.rank || "-"}</TableCell>
                                            
                                            <TableCell className="text-center border p-1 col-image">{row.soldierDbId ? (<div className="w-8 h-8 rounded-full overflow-hidden mx-auto border bg-slate-200 relative flex items-center justify-center"><img src={`${process.env.NEXT_PUBLIC_API_URL}/static/images/${row.militaryId}.jpg`} className="w-full h-full object-cover relative z-10" onError={(e:any) => e.target.style.display='none'} alt="img" /><User className="w-4 h-4 text-slate-400 absolute" /></div>) : <div className="w-8 h-8 rounded-full bg-slate-100 mx-auto border border-dashed flex items-center justify-center"><User className="w-4 h-4 text-slate-300"/></div>}</TableCell>
                                            <TableCell className="text-center font-mono border">{realIndex + 1}</TableCell>
                                        </TableRow>
                                    ) 
                                }))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex justify-between items-center print:hidden">
    <Button 
        onClick={addNewRow} 
        disabled={isAddDisabled} 
        className="bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 gap-2"
        title={filterCourse === 'all' || filterBatch === 'all' ? 'الرجاء اختيار الدورة والدفعة أولاً' : ''}
    >
        <Plus className="w-4 h-4" /> إضافة صف
    </Button><div className="flex items-center gap-2"><span className="text-xs text-slate-500">عرض:</span><Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}><SelectTrigger className="w-[70px] h-8 text-xs"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem></SelectContent></Select></div></div>

                    {/* 5. قسم المدرب المناوب (الملء التلقائي) */}
                    <div className="signature-section mt-4 border-t-2 border-dashed border-slate-300 pt-4">
                        <div className="bg-white border-2 border-black p-3 rounded-none max-w-4xl mx-auto shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <h3 className="font-bold text-center text-base mb-2 underline">المدرب المناوب</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-4 items-end">
                                
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

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 flex-row-reverse">
                                        <span className="font-bold w-12 text-xs">:الرتبة</span>
                                        <div title="يتم تعبئة البيانات تلقائياً" className="flex-1 border-b border-black h-6 text-sm font-bold text-center flex items-center justify-center px-2 bg-slate-50/50">{writerRank || "............"}</div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-row-reverse">
                                        <span className="font-bold w-12 text-xs">:الاسم</span>
                                        <div title="يتم تعبئة البيانات تلقائياً" className="flex-1 border-b border-black h-6 text-sm font-bold flex items-center justify-center px-2 bg-slate-50/50">{writerName || "............"}</div>
                                    </div>
                                </div>

                                <div className="space-y-1 order-first md:order-last">
                                    <div className="flex items-center gap-2 flex-row-reverse">
                                        <span className="font-bold w-16 text-xs whitespace-nowrap">:الرقم العسكري</span>
                                        <div title="يتم تعبئة البيانات تلقائياً" className="flex-1 border-b border-black h-6 text-sm font-bold text-center flex items-center justify-center bg-slate-50/50">{writerMilId || "............"}</div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="review" className="space-y-6 animate-in slide-in-from-left-4">
                    
                    {/* شريط اختيار التاريخ والأزرار (كما هو) */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50 p-4 rounded-lg border print:hidden">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-500">اختر التاريخ:</span>
                            <div className="relative">
                                <Input type="date" value={reviewDate} onChange={(e) => { setReviewDate(e.target.value); setSelectedSession(null); }} className="pl-10 bg-white w-40" />
                                <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            </div>
                            <Button onClick={fetchSavedRecords} disabled={loadingSaved} className="gap-2 w-24">
                                {loadingSaved ? <Loader2 className="w-4 h-4 animate-spin"/> : "عرض"}
                            </Button>
                        </div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <ShieldCheck className="w-6 h-6 text-red-600"/> سجل مراجعة المخالفات
                        </h2>
                    </div>

                    {/* عرض الجلسات المحفوظة (الكروت) */}
                    {!selectedSession ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                            {groupedSessions.length === 0 ? (<div className="col-span-full text-center py-12 text-slate-400 bg-white rounded-lg border border-dashed"><FileCheck className="w-12 h-12 mx-auto mb-2 opacity-20"/><p>لا توجد سجلات مخالفات محفوظة لهذا اليوم</p></div>) : (groupedSessions.map((session: any) => (
                                <Card key={session.id} className={`cursor-pointer transition-all hover:shadow-md group border-2 ${session.is_approved ? 'border-green-500 bg-green-50' : 'hover:border-red-500'}`} onClick={() => setSelectedSession(session)}>
                                    <CardHeader className="pb-2 p-3">
                                        <CardTitle className="text-base md:text-lg flex justify-between items-start">
                                            <div className="flex flex-col"><span>{session.writer_name}</span><span className="text-xs font-normal text-slate-500">{session.writer_rank}</span></div>
                                            {session.is_approved ? (<span className="text-[10px] bg-green-100 text-green-800 px-2 py-1 rounded-full flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> معتمد</span>) : (<span className="text-[10px] bg-red-100 text-red-800 px-2 py-1 rounded-full flex items-center gap-1"><Hourglass className="w-3 h-3"/> قيد الانتظار</span>)}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 p-3 pt-0">
                                        <div className="text-xs md:text-sm font-bold">{session.course_name} / {session.batch_name}</div>
                                        <div className="flex justify-between items-center text-xs md:text-sm text-slate-500"><div className="flex items-center gap-1"><Clock className="w-3 h-3"/> {session.shift === 'morning' ? 'صباحي' : session.shift === 'afternoon' ? 'عصر' : 'ليلي'}</div><div className="flex items-center gap-1"><ShieldAlert className="w-3 h-3"/> {session.count} مخالفة</div></div>
                                        <Button className={`w-full mt-2 border h-8 text-xs ${session.is_approved ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-50 text-slate-700 hover:bg-red-50 hover:text-red-600 group-hover:border-red-200'}`}>مراجعة وتفاصيل <ArrowRight className="w-3 h-3 mr-2" /></Button>
                                    </CardContent>
                                </Card>
                            )))}
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in slide-in-from-bottom-4">
                            
                            <div className="flex items-center justify-between print:hidden">
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
                                    <Button variant="outline" onClick={() => handleExportExcel(selectedSession.records, `المخالفات_المعتمدة`)} className="gap-2 text-green-700 border-green-200 hover:bg-green-50">
                                        <FileSpreadsheet className="w-4 h-4"/> تصدير
                                    </Button>
                                    <Button variant="outline" onClick={() => handlePrintWithTitle(true)} className="gap-2">
                                        <Printer className="w-4 h-4"/> طباعة
                                    </Button>
                                </div>
                                <Button variant="ghost" onClick={() => setSelectedSession(null)} className="gap-2">عودة للقائمة <ArrowRight className="w-4 h-4 "/></Button>
                            </div>

                            {/* 6. جدول المراجعة */}
                            <div className="bg-white border rounded-lg shadow-sm overflow-hidden min-h-[400px]">
                                <Table>
                                    <TableHeader className="bg-slate-100">
                                        <TableRow>
                                            <TableHead className="text-center bg-[#c5b391] text-black border font-bold">ملاحظة</TableHead>
                                            <TableHead className="w-[140px] text-center bg-[#c5b391] text-black border font-bold">المخالفة</TableHead>
                                            <TableHead className="w-[80px] text-center bg-[#c5b391] text-black border font-bold">الفصيل</TableHead>
                                            <TableHead className="w-[80px] text-center bg-[#c5b391] text-black border font-bold">السرية</TableHead>
                                            <TableHead className="text-center bg-[#c5b391] text-black border font-bold">الاسم</TableHead>
                                            <TableHead className="w-[120px] text-center bg-[#c5b391] text-black border font-bold">الرقم العسكري</TableHead>
                                            <TableHead className="w-[80px] text-center bg-[#c5b391] text-black border font-bold">الرتبة</TableHead>
                                            <TableHead className="w-[50px] text-center bg-[#c5b391] text-black border font-bold col-image">الصورة</TableHead>
                                            <TableHead className="w-[40px] text-center bg-[#c5b391] text-black border font-bold">#</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedSession.records.map((rec: any, idx: number) => (
                                            <TableRow key={idx}>
                                                {/* عرض الملاحظة (القيمة إذا كانت مخصصة، وإلا فارغة) */}
                                                <TableCell className="p-1 border text-center text-xs">{rec.is_custom ? rec.value : ""}</TableCell>
                                                {/* عرض المخالفة (القيمة) */}
                                                <TableCell className="p-1 border text-center"><div className="font-bold text-black text-xs text-center">{rec.value}</div></TableCell>
                                                
                                                {/* أعمدة البيانات الأساسية */}
                                                <TableCell className="text-center border text-xs">{rec.soldier?.platoon || "-"}</TableCell>
                                                <TableCell className="text-center border text-xs">{rec.soldier?.company || "-"}</TableCell>
                                                <TableCell className="text-center border font-medium text-xs">{rec.soldier?.name || "-"}</TableCell>
                                                <TableCell className="text-center border font-bold">{rec.soldier?.military_id || "-"}</TableCell>
                                                <TableCell className="text-center border text-xs">{rec.soldier?.rank || "-"}</TableCell>
                                                
                                                {/* الصورة و # */}
                                                <TableCell className="text-center border p-1 col-image">{rec.soldier ? (<div className="w-8 h-8 rounded-full overflow-hidden mx-auto border bg-slate-200 relative flex items-center justify-center"><img src={`${process.env.NEXT_PUBLIC_API_URL}/static/images/${rec.soldier.military_id}.jpg`} className="w-full h-full object-cover relative z-10" onError={(e:any) => e.target.style.display='none'} alt="img" /><User className="w-4 h-4 text-slate-400 absolute" /></div>) : <div className="w-8 h-8 rounded-full bg-slate-100 mx-auto border border-dashed flex items-center justify-center"><User className="w-4 h-4 text-slate-300"/></div>}</TableCell>
                                                <TableCell className="text-center font-mono border">{idx + 1}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* 7. قسم التواقيع في المراجعة */}
                            <div className="signature-section mt-4 border-t-2 border-dashed border-slate-300 pt-4">
                                <div className="bg-white border-2 border-black p-2 rounded-none max-w-4xl mx-auto shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                    <div className="signature-section-inner flex flex-row gap-2 justify-between items-end">
                                        
                                        {/* المسؤول (يمين) */}
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
            
            {/* 🔑 زر الاعتماد: تم تقليل ارتفاعه قليلاً (h-6) */}
            {canApprove && (
                <Button onClick={handleApproveSession} disabled={isApproving} className="w-full mt-2 bg-black hover:bg-slate-800 text-white h-6 text-[10px]">{isApproving ? <Loader2 className="animate-spin w-3 h-3"/> : "توقيع واعتماد"}</Button>
            )}
        </div>
        <div className="hidden print:block text-center pt-8 text-xs italic text-gray-400">لم يتم الاعتماد بعد</div>
    </>
)}
                                            </div>
                                        </div>

                                        {/* المدرب المناوب (يسار) */}
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

            {/* 8. النوافذ المنبثقة (Modal) */}
            
            {/* نافذة اختيار المخالفة (تم تعديلها لتستخدم VIOLATION_OPTIONS) */}
            <Dialog open={violationModal.isOpen} onOpenChange={(open) => !open && setViolationModal({ ...violationModal, isOpen: false })}>
                <DialogContent className="max-w-xl" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>تحديد المخالفة</DialogTitle>
                    </DialogHeader>
                    
                    {!selectedViolationObj ? (
                        <div className="grid grid-cols-3 gap-3 py-4">
                            {VIOLATION_OPTIONS.map((opt) => (
                                <button key={opt.id} onClick={() => setSelectedViolationObj(opt)} className={`flex flex-col items-center justify-center gap-2 p-3 rounded-lg border-2 hover:bg-slate-50 transition-all ${opt.color}`}>
                                    <opt.icon className="w-6 h-6 mb-1" />
                                    <span className="font-bold text-sm">{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-6 py-4 animate-in slide-in-from-right-4">
                            
                            <div className={`flex items-center gap-2 p-3 rounded-lg border ${selectedViolationObj.color}`}>
                                <selectedViolationObj.icon className="w-5 h-5"/>
                                <span className="font-bold text-lg">{selectedViolationObj.label}</span>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedViolationObj(null)} className="mr-auto text-xs underline">تغيير</Button>
                            </div>
                            
                            {/* حقل 'أخرى' */}
                            {selectedViolationObj.id === 'other' && (
                                <div className="space-y-2">
                                    <label className="font-bold block">توضيح المخالفة (إلزامي)</label>
                                    <Input value={modalCustomNote} onChange={(e) => setModalCustomNote(e.target.value)} placeholder="اكتب المخالفة المحددة هنا..." />
                                </div>
                            )}
                            
                            {/* زر التأكيد */}
                            <Button onClick={saveViolationFromModal} className="w-full bg-slate-900 text-white h-12 text-lg" disabled={selectedViolationObj.id === 'other' && !modalCustomNote}>تأكيد وإضافة</Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* نافذة الملاحظات (كما هي) */}
            <Dialog open={notesModal.isOpen} onOpenChange={(open) => !open && setNotesModal({ ...notesModal, isOpen: false })}><DialogContent dir="rtl"><DialogHeader><DialogTitle>إضافة ملاحظة</DialogTitle></DialogHeader><Textarea value={notesModal.text} onChange={(e) => setNotesModal({ ...notesModal, text: e.target.value })} className="min-h-[150px] text-base" placeholder="اكتب الملاحظات هنا..." /><DialogFooter><Button onClick={saveNotesFromModal}>حفظ الملاحظة</Button></DialogFooter></DialogContent></Dialog>
            
            {/* نافذة إضافة مجند (كما هي) */}
            <Dialog open={mobileAddOpen} onOpenChange={setMobileAddOpen}><DialogContent><DialogHeader><DialogTitle>إضافة مجند</DialogTitle></DialogHeader><div className="py-4"><label className="block mb-2 font-bold">الرقم العسكري:</label><Input value={mobileMilId} onChange={(e) => setMobileMilId(normalizeInput(e.target.value))} className="text-center text-xl" autoFocus /></div><Button onClick={() => { addNewRow(); handleMilitaryIdInput(rows.length, mobileMilId); lookupSoldierData(rows.length); setMobileAddOpen(false); setMobileMilId(""); }} className="w-full">إضافة</Button></DialogContent></Dialog>
            
            {/* نافذة تأكيد الحذف الجميلة 🛑 */}
            <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogContent dir="rtl" className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <XCircle className="w-6 h-6" />
                            تأكيد حذف مخالفة
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="py-4 space-y-3">
                        <p className="font-bold text-lg text-center">
                            هل أنت متأكد من حذف سجل المخالفة للمجند رقم {rowToDelete?.militaryId}?
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
                            onClick={executeDelete}
                            className="bg-red-600 hover:bg-red-700 gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            نعم، احذف السجل
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* نافذة تأكيد فك الاعتماد (كما هي) */}
            <Dialog open={unapproveConfirmOpen} onOpenChange={setUnapproveConfirmOpen}>
                <DialogContent dir="rtl" className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="w-6 h-6" /> تنبيه
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-3">
                        <p className="font-bold text-lg text-center">هل أنت متأكد من رغبتك في فك الاعتماد؟</p>
                        <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-red-800 text-sm text-center">
                            ⚠️ تحذير: سيتمكن المدرب المناوب من تعديل البيانات وحذفها مرة أخرى.
                        </div>
                    </div>
                    <DialogFooter className="flex gap-2 sm:justify-start">
                        <Button variant="ghost" onClick={() => setUnapproveConfirmOpen(false)}>إلغاء الأمر</Button>
                        <Button variant="destructive" onClick={executeUnapprove} className="bg-red-600 hover:bg-red-700 gap-2">
                            <Unlock className="w-4 h-4" /> نعم، فك الاعتماد
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
</ProtectedRoute>
    )
}