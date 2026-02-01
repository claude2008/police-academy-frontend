"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Search, Plus, FileSpreadsheet, User, Edit, Trash2, Shield, Dumbbell, Swords, AlertTriangle, Loader2, Save, RefreshCcw } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import ProtectedRoute from "@/components/ProtectedRoute"
// 🔥 1. التعديل هنا: الكاش أصبح "قاموساً" (Dictionary/Map) بدلاً من مصفوفة واحدة
// المفتاح سيكون: "branch-specialization"
const trainersCache: Record<string, any[]> = {};

interface TrainersListProps {
    branch: string;
    specialization: string;
    title: string;
}

export default function TrainersList({ branch, specialization, title }: TrainersListProps) {
    const router = useRouter()
    const [trainers, setTrainers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [search, setSearch] = useState("")
    const [isPhotoDeleteConfirmOpen, setIsPhotoDeleteConfirmOpen] = useState(false);
    // مفتاح الكاش الفريد لهذه الصفحة
    const cacheKey = `${branch}-${specialization}`;
const dobRef = useRef<HTMLInputElement>(null);
    const appointmentRef = useRef<HTMLInputElement>(null);
    // النوافذ
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false)
    const [deleteId, setDeleteId] = useState<number | null>(null)
    const [editingId, setEditingId] = useState<number | null>(null)
const [currentUser, setCurrentUser] = useState<any>(null);
useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    setCurrentUser(user);
}, []);

// مصفوفة الأدوار المسموح لها بإدارة الصور
const canManagePhotos = ["owner", "manager", "admin", "assistant_admin"].includes(currentUser?.role);
    const [formData, setFormData] = useState({
        name: "", military_id: "", rank: "", phone: "", email: "",
        courses: "", dob: "", degree: "", appointment_date: "", sport_specialty: "", job_title: ""
    })

    // 🔥 2. دالة الجلب الذكية (تستخدم المفتاح cacheKey)
    const fetchTrainers = async (forceRefresh = false) => {
        setLoading(true)
        
        // أ) التحقق من وجود بيانات في "الدرج الخاص" بهذه الصفحة
        if (!forceRefresh && trainersCache[cacheKey]) {
            // console.log(`🚀 Loaded from cache: ${cacheKey}`)
            setTrainers(trainersCache[cacheKey])
            setLoading(false)
            return
        }

        // ب) الجلب من السيرفر إذا كان الدرج فارغاً
        try {
            const params = new URLSearchParams()
            if (branch !== "all") params.append("branch", branch)
            if (specialization !== "all") params.append("specialization", specialization)
            const token = localStorage.getItem("token"); // جلب المفتاح من ذاكرة المتصفح
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/?${params.toString()}`,{
            headers: {
        'Authorization': `Bearer ${token}`, // ✅ تقديم بطاقة التعريف للسيرفر
        'Content-Type': 'application/json'
    }
});
            if (res.ok) {
                const data = await res.json()
                setTrainers(data)
                // حفظ البيانات في الدرج المخصص
                trainersCache[cacheKey] = data 
            }
        } catch (e) { 
            toast.error("فشل الاتصال") 
        } finally { 
            setLoading(false) 
        }
    }

    // إعادة الجلب عند تغيير الصفحة (تغيير الـ Key)
    useEffect(() => { fetchTrainers() }, [branch, specialization])

   // 🟢 التعديل النهائي: تحديد قائمة الأدوار المسموح بظهورها فقط
    const filteredTrainers = useMemo(() => {
        // 1. تحديد القائمة البيضاء للأدوار
        const allowedRoles = [
            "military_trainer", 
            "military_supervisor", 
            "sports_trainer", 
            "sports_supervisor", 
            "owner", 
            "assistant_admin",
            "trainer"
        ];

        return trainers.filter(t => {
            // أ. التحقق من نص البحث (الاسم أو الرقم العسكري)
            const matchesSearch = (t.name || "").includes(search) || (t.military_id || "").includes(search);
            
            // ب. التحقق من أن دور المستخدم موجود في القائمة البيضاء
            const isAllowedRole = allowedRoles.includes(t.role);

            return matchesSearch && isAllowedRole;
        })
    }, [trainers, search])

   const openAddModal = () => {
    setEditingId(null)

    // 🧠 منطق ذكي: نحدد المسمى بناءً على الفرع الحالي للصفحة
    let defaultJobTitle = "";
    
    if (branch === "تدريب عسكري") {
        defaultJobTitle = "مدرب عسكري";
    } else if (branch === "تدريب رياضي") {
        defaultJobTitle = "مدرب رياضي";
    }

    setFormData({ 
        name: "", 
        military_id: "", 
        rank: "", 
        phone: "", 
        email: "", 
        courses: "", 
        dob: "", 
        degree: "", 
        appointment_date: "", 
        sport_specialty: "", 
        // 🟢 هنا التغيير: نضع القيمة الافتراضية بدلاً من الفراغ
        job_title: defaultJobTitle 
    })
    
    setIsModalOpen(true)
}

    const openEditModal = (trainer: any) => {
        console.log("البيانات المستلمة في المودال:", trainer);
    // 🛡️ دالة تنظيف التاريخ لضمان القبول في متصفحات الجوال والكمبيوتر
    const formatDateForInput = (dateValue: any) => {
        if (!dateValue || dateValue === "") return "";
        // نضمن أخذ أول 10 محارف فقط (YYYY-MM-DD) ونستبعد أي وقت أو مسافات زائدة
        return String(dateValue).split('T')[0].split(' ')[0].trim();
    };

    // 1. تحديد المعرف الخاص بالمدرب الجاري تعديله
    setEditingId(trainer.id);

    // 2. ملء النموذج بكافة البيانات القادمة من "trainer"
    setFormData({
        // البيانات الشخصية والعسكرية
        name: trainer.name || "",
        military_id: trainer.military_id || "",
        rank: trainer.rank || "",
        
        // بيانات التواصل (تأكد من مطابقة مسمى phone في الداتابيز)
        phone: trainer.phone || "",
        email: trainer.email || "",
        
        // البيانات المهنية (التي كانت تظهر فارغة أحياناً)
        job_title: trainer.job_title || "",
        sport_specialty: trainer.sport_specialty || "",
        degree: trainer.degree || "", // المؤهل الجامعي
        courses: trainer.courses || "", // الدورات
        
        // 🟢 معالجة التواريخ بدقة متناهية
        dob: formatDateForInput(trainer.dob), 
        appointment_date: formatDateForInput(trainer.appointment_date)
    });

    // 3. فتح النافذة المنبثقة
    setIsModalOpen(true);
};

   const handleSave = async () => {
    if (!formData.name || !formData.military_id) {
        toast.error("يرجى إدخال الاسم والرقم العسكري");
        return;
    }

    setIsSaving(true);
    const token = localStorage.getItem("token");

    // 🟢 1. الخطوة السحرية: قراءة التاريخ مباشرة من عنصر الإدخال (تجاوز الـ State المتأخر في iOS)
    // نستخدم "?.value" للتأكد، وإذا لم نجد الـ Ref نعود للـ formData كاحتياط
    const rawDob = dobRef.current?.value || formData.dob;
    const rawAppointment = appointmentRef.current?.value || formData.appointment_date;

    try {
        const payload = {
            military_id: formData.military_id.trim(),
            name: formData.name.trim(),
            rank: formData.rank,
            job_title: formData.job_title,
            sport_specialty: formData.sport_specialty,
            courses: formData.courses,
            degree: formData.degree,
            
            // 🟢 2. استخدام القيم المباشرة (rawDob / rawAppointment) بدلاً من formData
            // إذا كانت القيمة موجودة نرسلها، وإلا نرسل null
            dob: rawDob && rawDob !== "" ? rawDob : null,
            appointment_date: rawAppointment && rawAppointment !== "" ? rawAppointment : null,
            
            phone: formData.phone,
            email: formData.email,
            branch: branch,
            // إذا كان التخصص 'all' يفضل إرساله فارغاً لكي يظهر في الفلاتر العامة
            specialization: specialization === "all" ? "" : specialization,
            
            // الإعدادات عند الإضافة فقط
            ...(!editingId && { 
                password: "123", 
                role: "trainer", 
                is_active: true 
            })
        };

        const url = editingId
            ? `${process.env.NEXT_PUBLIC_API_URL}/users/${editingId}`
            : `${process.env.NEXT_PUBLIC_API_URL}/users/`;

        const res = await fetch(url, {
            method: editingId ? "PUT" : "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const result = await res.json();

        if (res.ok) {
            toast.success(editingId ? "تم التحديث بنجاح ✅" : "تمت الإضافة بنجاح ✅");
            setIsModalOpen(false);
            
            // 🔄 التعديل الجوهري: تحديث القائمة فوراً
            await fetchTrainers(true); 
        } else {
            toast.error(result.detail || "فشل حفظ البيانات");
        }
    } catch (e) {
        toast.error("خطأ في الاتصال بالخادم");
    } finally {
        setIsSaving(false);
    }
};

    const handleDeleteUser = async () => {
    if (!deleteId) return;
    
    // 🟢 1. بداية التحميل: نقوم بتفعيل المتغير ليظهر الدوران ويقفل الزر
    setIsDeleting(true);
    
    const token = localStorage.getItem("token");

    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${deleteId}`, { 
            method: "DELETE",
            headers: { 
                "Authorization": `Bearer ${token}` 
            }
        });

        if (res.ok) { 
            // ✅ نجاح العملية
            toast.success("تم حذف المدرب بنجاح 🗑️"); 
            setDeleteId(null);
            
            // تحديث الكاش والواجهة (نفس كودك الأصلي)
            if (trainersCache[cacheKey]) {
                trainersCache[cacheKey] = trainersCache[cacheKey].filter(t => t.id !== deleteId);
                setTrainers([...trainersCache[cacheKey]]);
            } else {
                fetchTrainers(true);
            }
        } else {
            // 🔴 في حال الفشل (مثل 403): نقرأ الرسالة من السيرفر لنعرضها
            const errorData = await res.json();
            toast.error(errorData.detail || "فشل الحذف لسبب غير معروف");
        }
    } catch (e) { 
        toast.error("فشل الاتصال بالسيرفر"); 
    } finally {
        // 🟢 2. نهاية التحميل: نوقف الدوران سواء نجحت العملية أم فشلت
        setIsDeleting(false);
    }
}

   const handleDeleteAll = async () => {
    setIsDeleting(true);
    const token = localStorage.getItem("token"); // 🔑 جلب التوكن
    const params = new URLSearchParams({ branch, specialization });
    
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/bulk-delete?${params.toString()}`, { 
            method: "DELETE",
            headers: { 
                "Authorization": `Bearer ${token}` // ✅ إضافة التوكن
            }
        });

        if (res.ok) {
            toast.success("تم مسح القائمة");
            setIsDeleteAllOpen(false);
            trainersCache[cacheKey] = []; 
            setTrainers([]);
        } else { toast.error("فشل المسح"); }
    } catch (e) { toast.error("فشل الاتصال"); }
    finally { setIsDeleting(false) }
}

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const token = localStorage.getItem("token"); // 🔑 جلب التوكن
    const formData = new FormData(); 
    formData.append("file", e.target.files[0]);
    
    const t = toast.loading("جاري الاستيراد...");
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/upload/excel`, { 
            method: "POST", 
            headers: { 
                "Authorization": `Bearer ${token}` // ✅ إضافة التوكن (لا تضع Content-Type هنا يدوياً للـ FormData)
            },
            body: formData 
        });

        if (res.ok) { 
            toast.dismiss(t); 
            toast.success("تم بنجاح"); 
            fetchTrainers(true); 
        } else { 
            toast.dismiss(t); 
            toast.error("فشل الاستيراد"); 
        }
    } catch (e) { 
        toast.dismiss(t); 
        toast.error("خطأ في الاتصال"); 
    }
    e.target.value = "";
}
// 🟢 دالة رفع الصورة
const handlePhotoUpload = async (trainerId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64String = reader.result as string;
        const t = toast.loading("جاري رفع الصورة للسحابة...");

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${trainerId}/photo`, {
                method: "PUT",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify({ image_base64: base64String })
            });

            if (res.ok) {
                const data = await res.json();
                const newPhotoUrl = data.image_url;

                // 🟢 التعديل السحري: تحديث البيانات في الحالة (State) والكاش فوراً
                setTrainers(prev => prev.map(t => t.id === trainerId ? { ...t, image_url: newPhotoUrl } : t));
                if (trainersCache[cacheKey]) {
                    trainersCache[cacheKey] = trainersCache[cacheKey].map(t => t.id === trainerId ? { ...t, image_url: newPhotoUrl } : t);
                }

                toast.success("تم تحديث الصورة بنجاح ✅", { id: t });
            } else {
                toast.error("فشل الرفع", { id: t });
            }
        } catch (error) {
            toast.error("خطأ في الاتصال", { id: t });
        }
    };
    reader.readAsDataURL(file);
};

// 🔴 دالة حذف الصورة
// 1. فتح النافذة فقط
const confirmPhotoDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPhotoDeleteConfirmOpen(true);
};

// 2. التنفيذ الفعلي للحذف (استدعيها من زر "نعم" في النافذة)
const handlePhotoDeleteExec = async () => {
    if (!editingId) return;
    const t = toast.loading("جاري حذف الصورة من السحابة...");
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${editingId}/photo`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });

        if (res.ok) {
            toast.success("تم حذف الصورة بنجاح 🗑️", { id: t });
            setIsPhotoDeleteConfirmOpen(false);
            fetchTrainers(true); // تحديث القائمة
        } else {
            toast.error("فشل حذف الصورة", { id: t });
        }
    } catch (error) {
        toast.error("خطأ في الاتصال", { id: t });
    }
};
    return (
        <ProtectedRoute allowedRoles={["owner","manager","admin","assistant_admin","sports_officer", "military_officer"]}>
        <div className="space-y-6 pb-10 md:pb-24 " dir="rtl">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        {title.includes("عسكري") ? <Shield className="w-8 h-8 text-red-600" /> : 
                         title.includes("اشتباك") ? <Swords className="w-8 h-8 text-orange-600" /> : 
                         <Dumbbell className="w-8 h-8 text-blue-600" />}
                        {title}
                    </h1>
                    <p className="text-slate-500 mt-1">العدد الكلي: {filteredTrainers.length}</p>
                </div>

                <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                    <Button variant="ghost" size="sm" onClick={() => fetchTrainers(true)} className="text-slate-500 hover:bg-slate-100">
                        <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>

                    <div className="relative flex-grow lg:flex-none min-w-[120px]">
                        <Input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                        <Button variant="outline" className="gap-1 w-full text-xs font-bold"><FileSpreadsheet className="w-4 h-4 text-green-600" /> استيراد </Button>
                    </div>
                    
                    <Button variant="outline" onClick={() => setIsDeleteAllOpen(true)} className="gap-1 flex-grow lg:flex-none min-w-[120px] text-red-600 text-xs font-bold">
                        <Trash2 className="w-4 h-4" /> مسح الكل
                    </Button>

                    <Button onClick={openAddModal} className="bg-slate-900 text-white gap-1 flex-grow lg:flex-none min-w-[120px] text-xs font-bold">
                        <Plus className="w-4 h-4" /> إضافة مدرب
                    </Button>
                </div>
            </div>

            <div className="relative">
                <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                <Input className="pr-10 h-10 bg-white dark:bg-slate-900" placeholder="بحث بالاسم أو الرقم العسكري..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-4">
                {loading && !trainersCache[cacheKey] ? (
                    Array.from({ length: 12 }).map((_, i) => (
                        <Card key={i} className="animate-pulse border-none shadow-none bg-slate-100 dark:bg-slate-800/50">
                            <CardContent className="p-4 flex flex-col items-center gap-2 h-[180px] justify-center">
                                <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                                <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded"></div>
                                <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-700 rounded mt-2"></div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    filteredTrainers.map((trainer) => (
                        <Card key={trainer.id} onClick={() => router.push(`/trainers/profile/${trainer.id}`)} className="hover:shadow-md transition-all border-t-4 border-t-transparent hover:border-t-blue-500 group relative overflow-hidden cursor-pointer bg-white dark:bg-slate-900">
                            <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 rounded-md p-1 backdrop-blur-sm shadow-sm">
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600 hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); openEditModal(trainer); }}>
                                    <Edit className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); setDeleteId(trainer.id); }}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                            </div>

                            <CardContent className="p-2 md:p-4 flex flex-col items-center text-center h-full justify-center pt-6">
                                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2 shadow-inner border border-slate-200 overflow-hidden relative">
    {/* 🛡️ التحقق قبل الرسم لمنع خطأ الـ Empty String */}
    {trainer.image_url ? (
        <img 
            src={`${trainer.image_url}?t=${new Date().getTime()}`} 
            alt={trainer.name} 
            className="w-full h-full object-cover"
            onError={(e) => {
                // في حال وجود رابط ولكنه معطل (مثلاً حذف يدوياً من الاستورج)
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }} 
        />
    ) : null}

    {/* أيقونة المستخدم الافتراضية تظهر إذا كان image_url غير موجود أو حدث خطأ */}
    <div className={`${trainer.image_url ? 'hidden' : 'flex'} w-full h-full items-center justify-center text-slate-400 bg-slate-100 dark:bg-slate-800 absolute inset-0`}>
        <User className="w-6 h-6 md:w-8 md:h-8" />
    </div>
</div>
                                
                                <h3 className="font-bold text-[10px] md:text-sm text-slate-900 dark:text-white mb-1 line-clamp-2 leading-tight h-8 flex items-center">
                                    {trainer.name}
                                </h3>
                                
                                <div className="flex flex-col gap-1 items-center w-full">
                                    <span className="text-[9px] md:text-xs text-slate-500 font-mono bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border">
                                        {trainer.military_id}
                                    </span>
                                    {trainer.job_title && (
                                         <span className="text-[9px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-100 font-bold truncate w-full max-w-[100px]">
                                            {trainer.job_title}
                                        </span>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                {/* أضفنا pb-24 لرفع المحتوى فوق الأزرار الثابتة في الهاتف، و p-6 للكمبيوتر */}
<DialogContent className="w-[95vw] md:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 pb-24 md:p-6" dir="rtl">
    <DialogHeader>
        <DialogTitle>{editingId ? "تعديل بيانات المدرب" : "إضافة مدرب جديد"}</DialogTitle>
        <DialogDescription>أدخل البيانات المطلوبة بدقة.</DialogDescription>
    </DialogHeader>

   {/* 📸 القسم المطور داخل نافذة التعديل */}
{editingId && (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 mb-6">
        <div className="relative group w-28 h-28">
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white dark:border-slate-800 shadow-xl bg-slate-200">
                {/* 🛡️ تم حل الخطأ هنا باستخدام الشرط */}
                {trainers.find(t => t.id === editingId)?.image_url ? (
                    <img 
                        src={`${trainers.find(t => t.id === editingId)?.image_url}?t=${new Date().getTime()}`} 
                        className="w-full h-full object-cover"
                        alt="Trainer"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <User className="w-12 h-12" />
                    </div>
                )}
            </div>
            
            <div className="absolute -bottom-1 -right-1 flex gap-2">
                <label className="bg-blue-600 p-2 rounded-full text-white cursor-pointer shadow-lg hover:bg-blue-700 transition-all hover:scale-110">
                    <Plus className="w-4 h-4" />
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handlePhotoUpload(editingId, e)} />
                </label>
                {/* 🟢 زر الحذف يفتح الآن نافذتنا الجميلة */}
                {trainers.find(t => t.id === editingId)?.image_url && (
                    <button 
                        onClick={confirmPhotoDelete}
                        className="bg-red-500 p-2 rounded-full text-white shadow-lg hover:bg-red-600 transition-all hover:scale-110"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
        <p className="text-[10px] text-slate-500 mt-3 font-black">إدارة صورة الملف الشخصي</p>
    </div>
)}

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>الرقم العسكري</Label><Input value={formData.military_id} onChange={e => setFormData({...formData, military_id: e.target.value})} /></div>
                            <div className="space-y-2"><Label>الرتبة</Label><Input value={formData.rank} onChange={e => setFormData({...formData, rank: e.target.value})} /></div>
                        </div>
                        <div className="space-y-2"><Label>الاسم الكامل</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                        <div className="space-y-2"><Label>المسمى الوظيفي</Label><Input value={formData.job_title} onChange={e => setFormData({...formData, job_title: e.target.value})} /></div>
{/* 📅 تاريخ الميلاد - التصميم المثالي + الأمان العالي */}
<div className="space-y-2">
    <Label>تاريخ الميلاد</Label>
    <input 
        // 1️⃣ ربطنا الـ Ref للأمان القصوى (لقراءة القيمة مباشرة عند الحفظ)
        ref={dobRef}
        
        type="date"
        required
        // 2️⃣ تصميم صديقك الممتاز (ليشبه باقي الحقول)
        className="flex h-10 w-full rounded-md border border-slate-200 bg-white dark:bg-slate-950 px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-right"
        
        // 3️⃣ الحماية من القيم الفارغة
        value={formData.dob || ""}
        
        // 4️⃣ تحديث الـ State للعرض الفوري (للكمبيوتر وغيره)
        onChange={(e) => setFormData(prev => ({...prev, dob: e.target.value}))}
        onInput={(e: any) => setFormData(prev => ({...prev, dob: e.target.value}))}
    />
</div>

{/* 📅 تاريخ التعيين */}
<div className="space-y-2">
    <Label>تاريخ التعيين</Label>
    <input 
        ref={appointmentRef} // 👈 لا تنس الـ Ref هنا أيضاً
        type="date"
        required
        className="flex h-10 w-full rounded-md border border-slate-200 bg-white dark:bg-slate-950 px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-right"
        value={formData.appointment_date || ""}
        onChange={(e) => setFormData(prev => ({...prev, appointment_date: e.target.value}))}
        onInput={(e: any) => setFormData(prev => ({...prev, appointment_date: e.target.value}))}
    />
</div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
    <Label>الهاتف</Label>
    <Input 
        value={formData.phone} 
        onChange={e => setFormData({...formData, phone: e.target.value})} 
    />
</div>
                            <div className="space-y-2"><Label>الإيميل</Label><Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
                        </div>
                        <div className="space-y-2">
    <Label>الدورات الحاصل عليها</Label>
    <Textarea 
        value={formData.courses} 
        onChange={e => setFormData({...formData, courses: e.target.value})} 
    />
</div>
                    </div>
                    <DialogFooter className="mt-6">
    <Button 
        onClick={handleSave} 
        disabled={isSaving} 
        className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white gap-2 h-12 shadow-lg"
    >
        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {editingId ? "حفظ التعديلات" : "إضافة المدرب"}
    </Button>
</DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <DialogContent className="max-w-sm text-center" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-red-600">حذف المدرب</DialogTitle>
                        <DialogDescription>هل أنت متأكد من حذف هذا المدرب؟</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex justify-center gap-2">
                        <Button variant="outline" onClick={() => setDeleteId(null)}>إلغاء</Button>
                        <Button 
                variant="destructive" 
                onClick={handleDeleteUser} 
                disabled={isDeleting} // قفل الزر
                className="gap-2"
            >
                {isDeleting ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" /> {/* أيقونة تدور */}
                        جاري الحذف...
                    </>
                ) : (
                    "نعم، حذف"
                )}
            </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDeleteAllOpen} onOpenChange={setIsDeleteAllOpen}>
                <DialogContent className="max-w-sm text-center" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 flex flex-col items-center gap-2">
                            <AlertTriangle className="w-10 h-10" />
                            مسح جميع المدربين
                        </DialogTitle>
                        <DialogDescription className="py-4 font-bold text-slate-700">
                            هل أنت متأكد؟ سيتم مسح جميع المدربين في قائمة ({title}) فقط.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex justify-center gap-2">
                        <Button variant="outline" onClick={() => setIsDeleteAllOpen(false)}>إلغاء</Button>
                        <Button variant="destructive" onClick={handleDeleteAll} disabled={isDeleting}>
                            {isDeleting ? "جاري المسح..." : "تأكيد المسح"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
           {/* 🗑️ نافذة تأكيد حذف الصورة المصممة (المصلحة) */}
<Dialog open={isPhotoDeleteConfirmOpen} onOpenChange={setIsPhotoDeleteConfirmOpen}>
    <DialogContent className="max-w-[350px] rounded-[2rem] p-0 overflow-hidden border-none" dir="rtl">
        {/* 🛡️ إضافة Header و Title لحل مشكلة الـ Accessibility */}
        <DialogHeader className="hidden">
            <DialogTitle>تأكيد حذف الصورة</DialogTitle>
        </DialogHeader>

        <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
                <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-800">حذف الصورة؟</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
                هل أنت متأكد من حذف هذه الصورة نهائياً من السحابة؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex flex-col gap-2 pt-4">
                <Button 
                    variant="destructive" 
                    onClick={handlePhotoDeleteExec}
                    className="w-full h-11 rounded-xl font-bold shadow-lg shadow-red-200"
                >
                    نعم، احذف الآن
                </Button>
                <Button 
                    variant="ghost" 
                    onClick={() => setIsPhotoDeleteConfirmOpen(false)}
                    className="w-full h-11 rounded-xl font-bold text-slate-400 hover:text-slate-600"
                >
                    تراجع
                </Button>
            </div>
        </div>
    </DialogContent>
</Dialog>
        </div>
        </ProtectedRoute>
    )
}