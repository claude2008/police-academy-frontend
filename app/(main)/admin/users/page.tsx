"use client"

import { useState, useEffect, useMemo } from "react" 
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from "@/components/ui/dialog"
import { 
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
    UserPlus, Search, Trash2, Edit, ShieldAlert, Key, Loader2, UserCog, Ban, ChevronLeft, ChevronRight, Filter,User
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
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
import ProtectedRoute from "@/components/ProtectedRoute"

const ROLES = [
    { value: "owner", label: "👑 المالك (Owner)", color: "bg-purple-100 text-purple-700 font-bold" },
    { value: "manager", label: "مدير", color: "bg-slate-800 text-white" },
    { value: "admin", label: "رئيس قسم", color: "bg-slate-800 text-white" },
    
    { value: "sports_officer", label: "👮‍♂️ ضابط فرع التدريب الرياضي", color: "bg-blue-100 text-blue-700" },
    { value: "military_officer", label: "👮‍♂️ ضابط فرع التدريب العسكري", color: "bg-green-100 text-green-700" },
    { value: "assistant_admin", label: "مشرف", color: "bg-slate-600 text-white" },
    { value: "sports_supervisor", label: "👁️ مشرف التدريب الرياضي", color: "bg-blue-50 text-blue-600" },
    { value: "military_supervisor", label: "👁️ مشرف التدريب العسكري", color: "bg-green-50 text-green-600" },
    { value: "sports_trainer", label: "👟 مدرب التدريب الرياضي", color: "bg-slate-100 text-slate-700" },
    { value: "military_trainer", label: "🪖 مدرب التدريب العسكري", color: "bg-slate-100 text-slate-700" }
];

const RANKS = ["شرطي", "وكيل عريف", "عريف", "وكيل ضابط", "وكيل ضابط أول", "ملازم", "ملازم أول", "نقيب", "رائد","رائد ركن", "مقدم", "عقيد", "عميد", "لواء", "مدني"];

const initialFormData = {
    id: 0,
    military_id: "",
    name: "",
    rank: "شرطي",
    email: "",
    password: "",
    role: "sports_trainer",
    branch: "تدريب رياضي", 
    specialization: "عام",
    job_title: "مدرب"
}

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 30, 50, 100];
const SETTINGS_TABS_KEYS = [
    { id: "fitness_standards", label: "معايير اللياقة البدنية" },
    { id: "combat_standards", label: "معايير الاشتباك" },
    { id: "training_program", label: "البرنامج التدريبي" },
    { id: "disciplinary_regulations", label: "لائحة الجزاءات" },
    { id: "military_standards", label: "معايير  التدريب العسكري" },
];
export default function UsersManagementPage() {
    const router = useRouter()
    
    // --- 1. تعريف المتغيرات (States) ---
    const [mounted, setMounted] = useState(false)
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    
    // 🟢 تعديلات الأمان (الحراس)
    const [userRole, setUserRole] = useState<string | null>(null)
    const [isLoadingAuth, setIsLoadingAuth] = useState(true)
    const [isAuthorized, setIsAuthorized] = useState(false) // 🆕 البوابة الحديدية (المتغير الجديد)

    const [branchFilter, setBranchFilter] = useState("all")
    const [userToDelete, setUserToDelete] = useState<any | null>(null);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    
    // متغيرات الصلاحيات
    const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
    const [selectedUserForPerms, setSelectedUserForPerms] = useState<any>(null);
    const [tempPermissions, setTempPermissions] = useState<string[]>([]);
    
    // متغيرات التصفح (Pagination)
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE_OPTIONS[0]);
    
    // متغيرات النوافذ (Modals)
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [formData, setFormData] = useState(initialFormData)
    
    // متغيرات الصور
    const [isPhotoDeleteOpen, setIsPhotoDeleteOpen] = useState(false);
    const [photoTargetId, setPhotoTargetId] = useState<number | null>(null);

    // --- 2. دالة التحقق الذكي (The Smart Check) ---
    useEffect(() => {
        setMounted(true);
        let isCancelled = false;

        const checkAuth = async () => {
            // 1. تأخير إجباري (100ms) للسماح للذاكرة بالاستقرار بعد الانتقال من الإعدادات
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (isCancelled) return;

            const userStr = localStorage.getItem("user");
            
            // إذا لم يجد بيانات، يوجه للدخول بهدوء دون رسالة خطأ
            if (!userStr) {
                router.push("/login");
                return;
            }

            try {
                const user = JSON.parse(userStr);
                const role = user.role; 

                // إذا كانت الرتبة غير موجودة بعد (خطأ في البيانات)، ننتظر ولا نعطي خطأ
                if (!role) {
                    router.push("/dashboard");
                    return;
                }

                setUserRole(role);

                // 2. فحص الصلاحية الآن بعد التأكد من وجود البيانات
                if (["owner", "manager", "admin"].includes(role)) {
                    setIsAuthorized(true); // ✅ فتح البوابة
                    await fetchUsers();    // جلب البيانات
                } else {
                    // ❌ هنا فقط نظهر رسالة الخطأ لأننا متأكدون أن لديه رتبة لكنها غير مسموحة
                    toast.error("ليس لديك صلاحية الوصول لهذه الصفحة.");
                    router.push("/dashboard");
                    return;
                }

            } catch (e) {
                console.error("Auth check failed", e);
                router.push("/dashboard");
            } finally {
                if (!isCancelled) setIsLoadingAuth(false); // إيقاف التحميل
            }
        };

        checkAuth();

        return () => { isCancelled = true; };
    }, []);
// أضف هذا الـ useEffect داخل المكونUsersManagementPage
useEffect(() => {
    // إذا كانت الصلاحية مدير أو مسؤول رئيس قسم -> الإدارة العامة
    if (formData.role === "manager" || formData.role === "admin") {
        setFormData(prev => ({ ...prev, branch: "الإدارة العامة" }));
    } 
    // إذا كانت الصلاحية "مساعد مسؤول" -> فرع التدريب الرياضي
    else if (formData.role === "assistant_admin") {
        setFormData(prev => ({ ...prev, branch: "تدريب رياضي" }));
    }
}, [formData.role]);

 const fetchUsers = async () => {
    setLoading(true);
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/`);
        if (res.ok) {
            const data = await res.json();

            // 🟢 منطق الترتيب الهرمي المعدل (استبعاد مساعد المسؤول من الصدارة)
            const sortedStaff = data.sort((a: any, b: any) => {
                // 1. تعريف القيادة العليا فقط (بدون مساعد المسؤول)
                const topManagement = ['manager', 'admin'];
                const aIsTop = topManagement.includes(a.role);
                const bIsTop = topManagement.includes(b.role);

                // 2. تعريف السادة الضباط
                const officerRoles = ['sports_officer', 'military_officer'];
                const aIsOfficer = officerRoles.includes(a.role);
                const bIsOfficer = officerRoles.includes(b.role);

                // --- تنفيذ الترتيب ---

                // أولاً: المدير ورئيس القسم في المقدمة
                if (aIsTop && !bIsTop) return -1;
                if (!aIsTop && bIsTop) return 1;

                // ثانياً: السادة الضباط يلونهم مباشرة
                if (aIsOfficer && !bIsOfficer) return -1;
                if (!aIsOfficer && bIsOfficer) return 1;

                // ثالثاً: البقية (بمن فيهم مساعد المسؤول/المشرف) يترتبون حسب الأقدمية
                const numA = parseInt(a.military_id) || 0;
                const numB = parseInt(b.military_id) || 0;
                return numA - numB;
            });

            setUsers(sortedStaff);
            setCurrentPage(1);
        } else {
            toast.error("فشل جلب قائمة المستخدمين");
        }
    } catch (e) {
        toast.error("فشل الاتصال بالخادم");
    } finally {
        setLoading(false);
    }
};
// 1. دالة لفتح نافذة التأكيد فقط
const openDeleteConfirm = (user: any) => {
    setUserToDelete(user);
    setIsDeleteAlertOpen(true);
};

// 2. الدالة الفعلية التي تتصل بالسيرفر (يتم استدعاؤها عند الضغط على "تأكيد الحذف")
const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${userToDelete.id}`, {
    method: "DELETE",
    headers: { 
        "Authorization": `Bearer ${localStorage.getItem("token")}` // 🛡️ أضف هذا السطر
    }
});
        if (res.ok) {
            toast.success(`تم حذف المستخدم "${userToDelete.name}" بنجاح`);
            fetchUsers();
        } else {
            toast.error("فشل الحذف من جهة السيرفر");
        }
    } catch (e) {
        toast.error("خطأ في الاتصال بالسيرفر");
    } finally {
        setIsDeleteAlertOpen(false);
        setUserToDelete(null);
    }
};
    const handleCreateUser = async () => {
        if (!formData.military_id || !formData.name || !formData.email || !formData.password) {
            toast.error("يرجى تعبئة جميع الحقول المطلوبة");
            return;
        }
        setIsSubmitting(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/`, {
    method: "POST",
    headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}` // 🛡️ أضف هذا السطر
    },
    body: JSON.stringify(formData)
});
            if (res.ok) {
                toast.success("تم إنشاء الحساب بنجاح");
                setIsAddOpen(false);
                fetchUsers();
                setFormData(initialFormData);
            } else {
                const err = await res.json();
                toast.error(err.detail || "بيانات غير صالحة");
            }
        } catch (e) { toast.error("فشل الاتصال"); } finally { setIsSubmitting(false); }
    };

    const handleUpdateUser = async () => {
        setIsSubmitting(true)
        try {
            const updateData: any = { 
                name: formData.name, 
                rank: formData.rank,
                role: formData.role,
                email: formData.email,
                branch: formData.branch,
                specialization: formData.specialization,
                job_title: formData.job_title
            }
            if (formData.password && formData.password.trim() !== "") {
                updateData.password = formData.password
            }
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${formData.id}`, {
    method: "PUT",
    headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}` // 🛡️ أضف هذا السطر
    },
    body: JSON.stringify(updateData)
});
            if (res.ok) {
                toast.success("تم تحديث البيانات بنجاح")
                setIsEditOpen(false)
                fetchUsers()
            } else {
                const err = await res.json()
                toast.error(err.detail || "فشل التحديث")
            }
        } catch (e) { toast.error("فشل الاتصال"); } finally { setIsSubmitting(false); }
    }
// 🟢 دالة رفع صورة المستخدم (أدمن/مدير/مدرب)
const handleUserPhotoUpload = async (userId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64String = reader.result as string;
        
        // 1. نبدأ التوست ونخزن المعرف في t
        const t = toast.loading("جاري رفع الصورة للسحابة...");

        // 🟢 الكود المحدث والمؤمن
        const token = localStorage.getItem("token");

        // 🛡️ خطوة أمنية: لا ترسل الطلب أصلاً إذا لم يكن هناك توكن
        if (!token) {
            // ✅ تم إضافة { id: t } لاستبدال التحميل بالخطأ
            toast.error("انتهت جلسة العمل، يرجى تسجيل الدخول مرة أخرى", { id: t });
            return;
        }

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/photo`, {
                method: "PUT",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}` // ✅ التوكن هنا هو الحارس
                },
                body: JSON.stringify({ image_base64: base64String })
            });

            if (res.status === 403) {
                // ✅ تم إضافة { id: t }
                toast.error("ليس لديك صلاحية لتعديل صور المستخدمين", { id: t });
                return;
            }

            if (res.ok) {
                const data = await res.json();
                // ✅ تم إضافة { id: t } لإغلاق التحميل بنجاح
                toast.success("تم تحديث الصورة بنجاح ✅", { id: t });
                fetchUsers();
                // هنا يمكنك تحديث الحالة (State) في الصفحة
            } else {
                const errorData = await res.json();
                // ✅ تم إضافة { id: t }
                toast.error(errorData.detail || "فشل رفع الصورة", { id: t });
            }
        } catch (error) {
            // ✅ تم إضافة { id: t } في حالة انقطاع الاتصال
            toast.error("حدث خطأ في الاتصال بالسيرفر", { id: t });
        }
    };
    reader.readAsDataURL(file);
};

// 1. دالة تفتح نافذة التأكيد فقط
const openPhotoDeleteConfirm = (userId: number) => {
    setPhotoTargetId(userId);
    setIsPhotoDeleteOpen(true);
};

// 2. الدالة الفعلية التي تحذف من السيرفر (تستدعى عند الضغط على زر الحذف في النافذة)
const executePhotoDelete = async () => {
    if (!photoTargetId) return;
    
    const t = toast.loading("جاري حذف الصورة من السحابة...");
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${photoTargetId}/photo`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });

        if (res.ok) {
            toast.success("تم حذف الصورة بنجاح 🗑️", { id: t });
            fetchUsers(); // تحديث القائمة فوراً
        } else {
            toast.error("فشل حذف الصورة", { id: t });
        }
    } catch (error) {
        toast.error("خطأ في الاتصال بالسيرفر", { id: t });
    } finally {
        setIsPhotoDeleteOpen(false);
        setPhotoTargetId(null);
    }
};
    
// ✅ الدالة المحدثة والآمنة
const openPermissionsModal = (user: any) => {
    setSelectedUserForPerms(user);
    
    const rawExtra = user.extra_permissions;

    // فحص ذكي: إذا كانت البيانات مصفوفة نأخذها كما هي
    if (Array.isArray(rawExtra)) {
        setTempPermissions(rawExtra);
    } 
    // إذا كانت كائناً (بسبب تعديل الـ Scope الأخير)، نأخذ المفاتيح التي ليست 'scope'
    else if (rawExtra && typeof rawExtra === 'object') {
        // إذا كنت تخزن الصلاحيات كمفاتيح داخل الكائن
        const permissionKeys = Object.keys(rawExtra).filter(key => key !== 'scope');
        setTempPermissions(permissionKeys);
    } 
    else {
        setTempPermissions([]);
    }
    
    setIsPermissionsOpen(true);
};

    // دالة الحفظ النهائي للصلاحيات في السيرفر
    const handleSavePermissions = async () => {
    if (!selectedUserForPerms) return;
    setIsSubmitting(true);
    const t = toast.loading("جاري تحديث الصلاحيات...");

    try {
        // 1️⃣ استخراج البيانات القديمة لضمان عدم ضياع الـ scope
        // نتحقق أن extra_permissions كائن وليس مصفوفة قديمة
        const oldExtra = selectedUserForPerms.extra_permissions;
        const currentScope = (oldExtra && typeof oldExtra === 'object' && !Array.isArray(oldExtra)) 
            ? oldExtra.scope 
            : null;

        // 2️⃣ بناء كائن الصلاحيات الجديد (New Permissions Object)
        // نبدأ بكائن فارغ ونحقن فيه الـ scope القديم إذا وجد
        const newExtra: any = {};
        
        if (currentScope) {
            newExtra.scope = currentScope;
        }

        // 3️⃣ تحويل مصفوفة tempPermissions (التابات المختارة) إلى مفاتيح داخل الكائن
        // tempPermissions تكون مثل: ["fitness_standards", "combat_standards"]
        if (Array.isArray(tempPermissions)) {
            tempPermissions.forEach((permId: string) => {
                newExtra[permId] = true;
            });
        }

        // 4️⃣ الإرسال إلى السيرفر
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${selectedUserForPerms.id}`, {
            method: "PUT",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify({ extra_permissions: newExtra }) // إرسال الكائن المدمج الذكي
        });

        if (res.ok) {
            const updatedUserFromServer = await res.json(); 

            // 5️⃣ تحديث الجلسة الحالية (localStorage) إذا كان المستخدم يعدل نفسه
            const currentUserStr = localStorage.getItem("user");
            if (currentUserStr) {
                const currentUser = JSON.parse(currentUserStr);
                if (currentUser.id === selectedUserForPerms.id) {
                    // دمج البيانات الجديدة لضمان تحديث التابات فوراً
                    const updatedLocalUser = { ...currentUser, ...updatedUserFromServer };
                    localStorage.setItem("user", JSON.stringify(updatedLocalUser));
                    
                    // تحديث حالة النظام فوراً (اختياري حسب هيكلة مشروعك)
                    // window.location.reload(); // يمكنك تفعيل هذا السطر إذا أردت تحديثاً قسرياً للواجهة
                }
            }

            toast.success("تم تحديث صلاحيات الوصول بنجاح ✅", { id: t });
            fetchUsers();
            setIsPermissionsOpen(false);
        } else {
            const errData = await res.json();
            toast.error(errData.detail || "فشل تحديث الصلاحيات", { id: t });
        }
    } catch (e) {
        console.error("Save Permissions Error:", e);
        toast.error("خطأ في الاتصال بالسيرفر", { id: t });
    } finally {
        setIsSubmitting(false);
    }
};
    const openEditModal = (user: any) => {
        setFormData({
            id: user.id,
            military_id: user.military_id,
            name: user.name,
            rank: user.rank || "شرطي",
            email: user.email || "", 
            password: "",
            role: user.role,
            branch: user.branch || "تدريب رياضي",
            specialization: user.specialization || "عام",
            job_title: user.job_title || "مدرب"
        })
        setIsEditOpen(true)
    }

  const filteredUsers = useMemo(() => {
    if (!userRole) return []; 

    return users.filter(u => {
        // 1. بحث النص (الاسم، الرقم، الإيميل)
        const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || 
                             u.military_id.includes(search) || 
                             u.email?.toLowerCase().includes(search.toLowerCase());
        
        // 2. تعريف من هو "الضابط" برمجياً
        const isOfficerRole = u.role === "sports_officer" || u.role === "military_officer";

        // 3. منطق الفلترة الذكي والمستقل
        let matchesBranch = false;
        
        if (branchFilter === "all") {
            matchesBranch = true;
        } 
        else if (branchFilter === "all_officers") {
            // يعرض الضباط فقط
            matchesBranch = isOfficerRole;
        } 
        else if (branchFilter === "تدريب رياضي") {
            // يعرض الرياضي بشرط ألا يكون ضابطاً
            matchesBranch = u.branch === "تدريب رياضي" && !isOfficerRole;
        } 
        else if (branchFilter === "تدريب عسكري") {
            // يعرض العسكري بشرط ألا يكون ضابطاً
            matchesBranch = u.branch === "تدريب عسكري" && !isOfficerRole;
        } 
        else {
            // خيار "السادة المسؤولين" (الإدارة العامة) سيبقى كما هو
            matchesBranch = u.branch === branchFilter;
        }

        // 4. حماية إخفاء المالك (Owner)
        const isAuthorizedToSee = userRole === "owner" || u.role !== "owner";

        return matchesSearch && matchesBranch && isAuthorizedToSee;
    });
}, [users, search, branchFilter, userRole]);

   const availableRoles = useMemo(() => {
    // 1. إذا كان المستخدم هو المالك، يرى كل شيء
    if (userRole === "owner") return ROLES;
    
    // 2. إذا كان أي مستخدم آخر (مدير أو رئيس قسم):
    // نقوم بإخفاء: المالك + مساعد المسؤول
    return ROLES.filter(r => 
        r.value !== "owner" && 
        r.value !== "assistant_admin"
    );
}, [userRole]);

    const totalUsers = filteredUsers.length;
    const totalPages = Math.ceil(totalUsers / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentUsers = filteredUsers.slice(startIndex, endIndex);

    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(parseInt(value, 10));
        setCurrentPage(1);
    }
if (isLoadingAuth) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <Loader2 className="animate-spin w-10 h-10 text-blue-600" />
                <p className="text-slate-500 mt-4 font-bold">جاري التحقق من الصلاحيات...</p>
            </div>
        );
    }

    // 2. البوابة الحديدية (تمنع أي وميض للخطأ)
    // إذا انتهى التحميل ولم نفتح البوابة (isAuthorized = false)، لا تعرض شيئاً حتى يتم التوجيه
    if (!isAuthorized) {
        return null;
    }

    // 3. شاشة انتظار البيانات (بعد أن تأكدنا أنك مسؤول، ننتظر وصول قائمة المستخدمين)
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <Loader2 className="animate-spin w-8 h-8 text-blue-600"/>
                <p className="text-slate-500 mt-3">جاري تحميل البيانات...</p>
            </div>
        );
    }

    // 4. المحتوى المحمي (يظهر فقط إذا عبرت كل الحواجز السابقة)
    return (
        <ProtectedRoute allowedRoles={["owner", "manager", "admin"]}>
            <div className="space-y-6 pb-10 md:pb-24 max-w-full overflow-x-hidden" dir="rtl">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldAlert className="w-8 h-8 text-blue-600"/> إدارة المستخدمين</h1>
                        <p className="text-slate-500">لوحة التحكم لإدارة حسابات النظام وصلاحياتها</p>
                    </div>
                    <Button onClick={() => { setFormData(initialFormData); setIsAddOpen(true) }} className="gap-2 bg-slate-900 text-white">
                        <UserPlus className="w-5 h-5" /> مستخدم جديد
                    </Button>
                </div>

                <Card>
                    <CardHeader className="pb-3 border-b bg-slate-50">
                        <div className="flex flex-col md:flex-row items-center gap-4">
                            <div className="relative flex-grow max-w-md">
                                <Search className="w-5 h-5 text-slate-400 absolute right-3 top-2.5" />
                                <Input placeholder="بحث بالاسم، الرقم العسكري..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10 bg-white" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-slate-400" />
                                <Select value={branchFilter} onValueChange={setBranchFilter}>
                                    <SelectTrigger className="w-[180px] bg-white"><SelectValue placeholder="فلترة حسب الفرع" /></SelectTrigger>
                                    <SelectContent dir="rtl">
    <SelectItem value="all" className="font-bold">جميع المستخدمين</SelectItem>
    
    {/* 👑 مجمع المسؤولين */}
    <SelectItem value="الإدارة العامة" className="text-purple-700 font-bold bg-purple-50/50">
        ⭐ السادة المسؤولين
    </SelectItem>
    
    {/* 👮‍♂️ مجمع الضباط (رياضي + عسكري) */}
    <SelectItem value="all_officers" className="text-blue-700 font-bold bg-blue-50/50">
        👮‍♂️ السادة الضباط
    </SelectItem>
    
    <SelectItem value="تدريب رياضي">فرع التدريب الرياضي</SelectItem>
    <SelectItem value="تدريب عسكري">فرع التدريب العسكري</SelectItem>
</SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-center w-[50px]">#</TableHead>
                                    <TableHead className="text-center w-[70px]">الصورة</TableHead>
                                    <TableHead className="text-right">الرقم العسكري</TableHead>
                                    <TableHead className="text-right">الرتبة / الاسم</TableHead>
                                    <TableHead className="text-center">البريد الإلكتروني</TableHead>
                                    <TableHead className="text-center">الصلاحية</TableHead>
                                    <TableHead className="text-center">الإجراءات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {currentUsers.map((user, index) => {
                                    const roleInfo = ROLES.find(r => r.value === user.role) || { label: user.role, color: "bg-gray-100" };
                                    return (
                                        <TableRow key={user.id} className="hover:bg-slate-50">
                                            <TableCell className="text-center text-sm text-slate-500">{startIndex + index + 1}</TableCell>
                                            <TableCell className="text-center">
    <div className="w-10 h-10 mx-auto rounded-full overflow-hidden bg-slate-100 border border-slate-200 relative">
        {user.image_url ? (
            <img 
                src={`${user.image_url}?t=${new Date().getTime()}`} 
                alt="" 
                className="object-cover w-full h-full" 
            />
        ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-50">
                <User className="w-5 h-5" />
            </div>
        )}
    </div>
</TableCell>
                                            <TableCell className="font-mono font-bold">{user.military_id}</TableCell>
                                           <TableCell>
    <div className="flex flex-col">
        <div className="flex items-center gap-2">
            {/* 🟢 الآن ستظهر كلمة مدني أو الرتبة العسكرية متبوعة بـ / ثم الاسم */}
            <span className="font-bold text-slate-900">
                {user.rank ? `${user.rank} / ` : ""}{user.name}
            </span>
            
            {user.role === "manager" && <UserCog className="w-3.5 h-3.5 text-slate-700" />}
            {user.role === "admin" && <ShieldAlert className="w-3.5 h-3.5 text-blue-600" />}
        </div>
        <span className="text-[10px] text-blue-600 font-medium">{user.branch}</span>
    </div>
</TableCell>
                                            <TableCell className="font-mono text-sm text-center" dir="ltr">{user.email || '-'}</TableCell>
                                            <TableCell className="text-center"><Badge variant="secondary" className={roleInfo.color}>{roleInfo.label}</Badge></TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => openEditModal(user)}><Edit className="w-4 h-4 text-blue-600"/></Button>
                                                    <Button 
        variant="ghost" 
        size="icon" 
        className="text-amber-600 hover:bg-amber-50"
        onClick={() => openPermissionsModal(user)}
    >
        <Key className="w-4 h-4" />
    </Button>
                                                    <Button 
    variant="ghost" 
    size="icon" 
    disabled={user.role === 'owner'}
    onClick={() => openDeleteConfirm(user)} // 👈 التغيير هنا
>
    <Trash2 className={cn("w-4 h-4", user.role === 'owner' ? "text-slate-300" : "text-red-600")}/>
</Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Pagination */}
                {totalUsers > 0 && (
                    <div className="flex items-center justify-between px-2 py-4 border-t bg-white rounded-md">
                        <div className="flex items-center space-x-2 space-x-reverse text-sm">
                            <p className="text-slate-600">عناصر في الصفحة:</p>
                            <Select value={String(itemsPerPage)} onValueChange={handleItemsPerPageChange}>
                                <SelectTrigger className="w-[70px]"><SelectValue /></SelectTrigger>
                                <SelectContent dir="rtl">{ITEMS_PER_PAGE_OPTIONS.map(num => (<SelectItem key={num} value={String(num)}>{num}</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                        <div className="text-sm font-medium">عرض {startIndex + 1} - {Math.min(endIndex, totalUsers)} من {totalUsers}</div>
                        <div className="flex items-center space-x-2 space-x-reverse">
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}><ChevronRight className="w-4 h-4 ml-1" /> السابق</Button>
                            <div className="px-2 text-sm font-semibold">{currentPage} / {totalPages}</div>
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>التالي <ChevronLeft className="w-4 h-4 mr-1" /></Button>
                        </div>
                    </div>
                )}

                {/* Add Dialog */}
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogContent className="w-[95vw] md:max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 pb-24 md:p-6" dir="rtl">
    
                        <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5"/> إضافة مستخدم جديد</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>الرقم العسكري</Label><Input value={formData.military_id} onChange={(e) => setFormData({...formData, military_id: e.target.value})} /></div>
                                <div className="space-y-2">
                                    <Label>الرتبة</Label>
                                    <Select value={formData.rank} onValueChange={(val) => setFormData({...formData, rank: val})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent dir="rtl">{RANKS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                            {/* 🛡️ إظهار الفرع فقط للصلاحيات الميدانية أو المالك أو مساعد المسؤول */}
{formData.role !== "manager" && formData.role !== "admin" && (
    <div className="space-y-2 animate-in fade-in duration-300">
        <Label>الفرع</Label>
        <Select 
            value={formData.branch} 
            onValueChange={(val) => setFormData({...formData, branch: val})}
        >
            <SelectTrigger className="bg-white">
                <SelectValue placeholder="اختر الفرع..." />
            </SelectTrigger>
            <SelectContent dir="rtl">
                <SelectItem value="تدريب رياضي">تدريب رياضي</SelectItem>
                <SelectItem value="تدريب عسكري">تدريب عسكري</SelectItem>
               
               
            </SelectContent>
        </Select>
    </div>
)}


                            <div className="space-y-2"><Label>الاسم الكامل</Label><Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} /></div>
                            <div className="space-y-2"><Label>البريد الإلكتروني</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} /></div>
                            <div className="space-y-2">
                                <Label>كلمة المرور</Label>
                                <div className="relative"><Input type="text" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="pr-10" /><Key className="w-4 h-4 absolute right-3 top-3 text-slate-400" /></div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-blue-600 font-bold">الصلاحية (Role)</Label>
                                <Select value={formData.role} onValueChange={(val) => setFormData({...formData, role: val})}>
                                    <SelectTrigger className="border-blue-200"><SelectValue /></SelectTrigger>
                                    <SelectContent dir="rtl">
    {availableRoles.map(role => (
        <SelectItem key={role.value} value={role.value}>
            <div className="flex items-center gap-2"> {/* 👈 أضفنا div لتنظيم الأيقونة مع النص */}
                {/* أيقونات ذكية تظهر حسب القيمة */}
                {role.value === "manager" && <UserCog className="w-4 h-4" />}
                {role.value === "admin" && <ShieldAlert className="w-4 h-4" />}
                
                <span className={cn("px-2 py-0.5 rounded text-xs", role.color)}>
                    {role.label}
                </span>
            </div>
        </SelectItem>
    ))}
</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter className="flex flex-col md:flex-row gap-2 mt-4">
        <Button 
            onClick={handleCreateUser} 
            disabled={isSubmitting} 
            className="bg-slate-900 text-white w-full h-12 font-bold shadow-lg order-1 md:order-2"
        >
            {isSubmitting ? <Loader2 className="animate-spin w-4 h-4"/> : "إنشاء الحساب"}
        </Button>
        <Button 
            variant="outline" 
            onClick={() => setIsAddOpen(false)} 
            className="w-full md:w-auto h-12 order-2 md:order-1"
        >
            إلغاء
        </Button>
    </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Edit Dialog */}
                <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                    <DialogContent className="w-[95vw] md:max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 pb-24 md:p-6" dir="rtl">
                        <DialogHeader><DialogTitle className="flex items-center gap-2"><UserCog className="w-5 h-5"/> تعديل البيانات</DialogTitle></DialogHeader>
                        {/* 📸 إدارة الصورة في نافذة التعديل */}
<div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border-2 border-dashed mb-4">
    <div className="relative w-20 h-20 group">
        <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white shadow-sm bg-slate-200">
            {formData.military_id && users.find(u => u.id === formData.id)?.image_url ? (
                <img 
                    src={`${users.find(u => u.id === formData.id)?.image_url}?t=${new Date().getTime()}`} 
                    className="w-full h-full object-cover"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <UserCog className="w-8 h-8" />
                </div>
            )}
        </div>
        {/* أزرار التحكم */}
        <div className="absolute -bottom-1 -right-1 flex gap-1">
            <label className="bg-blue-600 p-1.5 rounded-full text-white cursor-pointer hover:bg-blue-700 shadow-md">
                <UserPlus className="w-3.5 h-3.5" />
                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUserPhotoUpload(formData.id, e)} />
            </label>
            {/* زر الحذف داخل نافذة التعديل */}
{users.find(u => u.id === formData.id)?.image_url && (
    <button 
        type="button" // لضمان عدم إرسال الفورم بالخطأ
        onClick={() => openPhotoDeleteConfirm(formData.id)} 
        className="bg-red-500 p-1.5 rounded-full text-white hover:bg-red-600 shadow-md transition-transform active:scale-90"
    >
        <Trash2 className="w-3.5 h-3.5" />
    </button>
)}
        </div>
    </div>
    <span className="text-[10px] mt-2 font-bold text-slate-500">تحديث صورة المستخدم</span>
</div>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>الرقم العسكري</Label><Input value={formData.military_id} disabled className="bg-slate-100" /></div>
                                <div className="space-y-2">
                                    <Label>الرتبة</Label>
                                    <Select value={formData.rank} onValueChange={(val) => setFormData({...formData, rank: val})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent dir="rtl">{RANKS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2"><Label>الاسم الكامل</Label><Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} /></div>
                            <div className="space-y-2"><Label>البريد الإلكتروني</Label><Input value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} /></div>
                            <div className="space-y-2"><Label>كلمة المرور الجديدة</Label><Input type="text" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} placeholder="**********" /></div>
                            <div className="space-y-2">
                                <Label>الصلاحية</Label>
                                <Select value={formData.role} onValueChange={(val) => setFormData({...formData, role: val})}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent dir="rtl">
    {availableRoles.map(role => (
        <SelectItem key={role.value} value={role.value}>
            <div className="flex items-center gap-2"> {/* 👈 أضفنا div لتنظيم الأيقونة مع النص */}
                {/* أيقونات ذكية تظهر حسب القيمة */}
                {role.value === "manager" && <UserCog className="w-4 h-4" />}
                {role.value === "admin" && <ShieldAlert className="w-4 h-4" />}
                
                <span className={cn("px-2 py-0.5 rounded text-xs", role.color)}>
                    {role.label}
                </span>
            </div>
        </SelectItem>
    ))}
</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter className="flex flex-col md:flex-row gap-2 mt-4">
        <Button 
            onClick={handleUpdateUser} 
            disabled={isSubmitting} 
            className="bg-blue-600 hover:bg-blue-700 text-white w-full h-12 font-bold shadow-lg order-1 md:order-2"
        >
            {isSubmitting ? <Loader2 className="animate-spin w-4 h-4"/> : "حفظ التعديلات"}
        </Button>
        <Button 
            variant="outline" 
            onClick={() => setIsEditOpen(false)} 
            className="w-full md:w-auto h-12 order-2 md:order-1"
        >
            إلغاء التعديل
        </Button>
    </DialogFooter>
                    </DialogContent>
                </Dialog>
        <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
    <AlertDialogContent dir="rtl" className="max-w-[400px]">
        <AlertDialogHeader className="text-right">
            <div className="flex items-center gap-2 text-red-600 mb-2">
                <Trash2 className="w-5 h-5" />
                <AlertDialogTitle>تأكيد حذف المستخدم</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base text-slate-600 leading-relaxed">
                هل أنت متأكد من حذف المستخدم <span className="font-bold text-slate-900 underline underline-offset-4 decoration-red-400">"{userToDelete?.name}"</span>؟
                <br />
                <span className="text-xs text-red-500 mt-2 block font-medium">⚠️ هذا الإجراء نهائي ولا يمكن التراجع عنه.</span>
            </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row-reverse gap-3 mt-6">
            <AlertDialogCancel className="flex-1 bg-slate-100 hover:bg-slate-200 border-0">إلغاء</AlertDialogCancel>
            <AlertDialogAction 
                onClick={handleConfirmDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-100"
            >
                نعم، احذف الحساب
            </AlertDialogAction>
        </AlertDialogFooter>
    </AlertDialogContent>
</AlertDialog>
{/* 📸 نافذة تأكيد حذف الصورة المصممة بجاذبية */}
<AlertDialog open={isPhotoDeleteOpen} onOpenChange={setIsPhotoDeleteOpen}>
    <AlertDialogContent dir="rtl" className="max-w-[380px] rounded-[1.5rem] border-none shadow-2xl overflow-hidden p-0">
        <div className="bg-red-50 p-6 flex flex-col items-center">
            <div className="bg-white p-3 rounded-full shadow-sm mb-4">
                <Trash2 className="w-8 h-8 text-red-600 animate-pulse" />
            </div>
            <AlertDialogTitle className="text-xl font-black text-red-900">حذف الصورة؟</AlertDialogTitle>
        </div>
        
        <div className="p-6">
            <AlertDialogDescription className="text-center text-slate-600 font-medium leading-relaxed">
                هل أنت متأكد من حذف صورة هذا المستخدم نهائياً من السحابة؟ 
                <span className="block text-red-500 text-xs mt-2 font-bold italic">⚠️ لا يمكن استعادة الصورة بعد الحذف.</span>
            </AlertDialogDescription>
            
            <div className="flex flex-col gap-2 mt-6">
                <AlertDialogAction 
                    onClick={executePhotoDelete} 
                    className="bg-red-600 hover:bg-red-700 text-white h-12 rounded-xl font-bold transition-all active:scale-95"
                >
                    نعم، احذف الصورة
                </AlertDialogAction>
                
                <AlertDialogCancel 
                    className="border-none bg-slate-100 text-slate-500 h-12 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                    تراجع
                </AlertDialogCancel>
            </div>
        </div>
    </AlertDialogContent>
</AlertDialog>
{/* 🔑 نافذة تخصيص صلاحيات الوصول للتابات */}
    <Dialog open={isPermissionsOpen} onOpenChange={setIsPermissionsOpen}>
        <DialogContent className="max-w-md rounded-2xl" dir="rtl">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-amber-600" />
                    صلاحيات الوصول الإضافية
                </DialogTitle>
                <DialogDescription>
                    تخصيص تابات معينة في الإعدادات للمستخدم: <b>{selectedUserForPerms?.name}</b>
                </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-4">
                {SETTINGS_TABS_KEYS.map((tab) => (
                    <div 
                        key={tab.id} 
                        onClick={() => {
                            if ((Array.isArray(tempPermissions) ? tempPermissions : []).includes(tab.id)) {
                                setTempPermissions(tempPermissions.filter(id => id !== tab.id));
                            } else {
                                setTempPermissions([...tempPermissions, tab.id]);
                            }
                        }}
                        className={cn(
                            "flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all",
                            (Array.isArray(tempPermissions) ? tempPermissions : []).includes(tab.id)
                                ? "border-amber-500 bg-amber-50" 
                                : "border-slate-100 hover:border-slate-200"
                        )}
                    >
                        <span className="font-bold text-sm text-slate-700">{tab.label}</span>
                        {(Array.isArray(tempPermissions) ? tempPermissions : []).includes(tab.id) && (
                            <Badge className="bg-amber-600 text-white border-none">مسموح</Badge>
                        )}
                    </div>
                ))}
            </div>

            <DialogFooter className="gap-2">
                <Button 
                    variant="outline" 
                    onClick={() => setIsPermissionsOpen(false)}
                    className="flex-1 h-11 rounded-xl"
                >
                    إلغاء
                </Button>
                <Button 
                    onClick={handleSavePermissions}
                    disabled={isSubmitting}
                    className="flex-1 h-11 rounded-xl bg-slate-900 text-white"
                >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ الصلاحيات"}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
         </div>
        </ProtectedRoute>
    )
}