"use client"

import "./globals.css"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { 
    LayoutDashboard, FileInput, Table, BarChart3, ArrowLeftRight, 
    Users, ClipboardCheck, Settings, LogOut, Menu, ChevronDown, ChevronLeft,
    Dumbbell, Shield, UserCircle, Activity, Swords, Target, Footprints,
    UserCog, FileText, Scale, GraduationCap, Shirt, FolderKanban, ShieldAlert, User,
    Loader2, ShieldCheck, Badge, Bell,
    CalendarDays, ClipboardList  // ✅ الإضافة هنا
} from "lucide-react"
import { FEATURES_CONFIG, loadFeaturesFromAPI } from "@/lib/features-config"  // ✅ التصحيح
// 1. استيراد مكتبة الرسائل (لحل خطأ toast)
import { toast } from "sonner"
import NotificationsMenu from "@/components/NotificationsMenu"
// 2. استيراد مكونات النافذة (لحل أخطاء Dialog و DialogContent و DialogTitle)
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription, // 👈 أضف هذه الكلمة هنا
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
	Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle
} from "@/components/ui/sheet"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { setupFetchInterceptor } from "@/lib/api";

// =========================================================
// 🔑 1. تعريف الأدوار والصلاحيات (الإضافات الوحيدة في هذا القسم)
// =========================================================
const OWNER_ROLE = ["owner"];
const ADMIN_ROLES = ["owner", "manager", "admin"];
const ASSISTANT_ADMIN_ROLES = ["owner", "manager", "admin", "assistant_admin"];

// 🔑 مجموعات التدريب العسكري
const MILITARY_ROLES = [...ADMIN_ROLES, "military_officer", "military_supervisor", "military_trainer"];
// 🔑 المجموعة الإدارية العسكرية (لصفحة ملف المجند)
const MILITARY_ADMINS = [...ADMIN_ROLES, "military_officer", "military_trainer"];

// 🔑 مجموعات التدريب الرياضي (افتراضاً كما في خطتك الشاملة)
const SPORTS_ROLES = [...ASSISTANT_ADMIN_ROLES, "sports_officer", "sports_supervisor", "sports_trainer"];
// 🔑 المجموعة الإدارية الرياضية (افتراضاً لملف المجند الرياضي)
const SPORTS_SOLDIER_ADMINS = [...ASSISTANT_ADMIN_ROLES, "sports_officer", "sports_supervisor", "sports_trainer"];
// =========================================================
// نهاية تعريف الأدوار
// =========================================================


// تعريف هيكل القائمة
type NavItem = {
	id: string;
	name: string;
	href?: string;
	icon: any;
	children?: NavItem[];
}

// هيكل القائمة الجديد
// هيكل القائمة المحدث ليشمل المسودات القديمة
const getNavigationStructure = (config: Record<string, boolean>): NavItem[] => {
  const baseItems: NavItem[] = [
    { id: "home", name: "الرئيسية", href: "/dashboard", icon: LayoutDashboard },
    
    // 1. إدارة الاختبارات
    {
        id: "exams-mgmt",
        name: "إدارة الاختبارات",
        icon: ClipboardCheck,
        children: [
            { id: "data-entry", name: "إدخال البيانات", href: "/data-entry", icon: FileInput },
            { id: "results", name: "سجل النتائج", href: "/results", icon: Table },
            { id: "stats", name: "الإحصائيات", href: "/statistics", icon: BarChart3 },
            { id: "compare", name: "المقارنات", href: "/comparisons", icon: ArrowLeftRight },
        ]
    },
  ];

  // 2. الاختبارات الرقمية (شرطي) ✅
  if (config.digitalExams) {
    baseItems.push({
        id: "digital-exams",
        name: "الاختبارات الرقمية",
        icon: Users,
        children: [
            { 
                id: "dig-sports",
                name: "التدريب الرياضي", 
                icon: Dumbbell,
                children: [
                    { 
                        id: "dig-sports-fit", 
                        name: "اختبار اللياقة", 
                        icon: Activity,
                        children: [
                            { id: "dig-sports-fit-entry", name: "رصد النتائج", href: "/exams/sports/fitness/merge", icon: ClipboardCheck },
                            { id: "cs-sp-sha", name: "إدخال الشباحات", href: "/exams/sports/fitness/shabaha-entry", icon: Shirt }, 
                            { id: "dig-sports-fit-download", name: "تنزيل الاختبارات", href: "/exams/sports/fitness/download", icon: FileText },
                        ]
                    },
                    { id: "dig-sports-com", name: "اختبار الاشتباك", href: "/exams/sports/engagement", icon: Swords },
                    { id: "dig-sports-results", name: "سجل النتائج ", href: "/exams/sports/fitness-records", icon: Table },
                ]
            },
            { 
                id: "dig-military",
                name: "التدريب العسكري", 
                icon: Shield,
                children: [
                    { id: "dig-mil-unified", name: "الاختبارات العسكرية", href: "/exams/military/MilitaryExams", icon: ShieldCheck },
                    { id: "dig-mil-results", name: "سجل النتائج", href: "/exams/military/results", icon: Table },
                ]
            },
        ]
    });
  }

  // 3. بقية الأقسام الثابتة
  baseItems.push(
    {
        id: "trainers-mgmt",
        name: "إدارة المدربين",
        icon: UserCog,
        children: [
            {
                id: "trainers-sports",
                name: "فرع التدريب الرياضي",
                icon: Dumbbell,
                children: [
                    { id: "tr-sp-fit", name: "ملف مدربين اللياقة", href: "/trainers/sports/fitness", icon: User },
                    { id: "tr-sp-com", name: "ملف مدربين الاشتباك", href: "/trainers/sports/combat", icon: Swords },
                    { id: "tr-sp-rep", name: "تقرير شخصي ", href: "/trainers/sports/reports", icon: FileText },
                    { id: "tr-sp-adm", name: "الملف الإداري", href: "/trainers/admin-file?branch=sports", icon: Activity },
                    { id: "tr-sp-forms", name: "النماذج الإدارية", href: "/trainers/sports/admin-forms", icon: FileText },
                ]
            },
            {
                id: "trainers-military",
                name: "فرع التدريب العسكري",
                icon: Shield,
                children: [
                    { id: "tr-mil-list", name: "ملف المدربين  ", href: "/trainers/military/list", icon: User },
                    { id: "tr-mil-rep", name: "تقرير شخصي ", href: "/trainers/military/reports", icon: FileText },
                    { id: "tr-mil-adm", name: "الملف الإداري", href: "/trainers/admin-file?branch=military", icon: Activity },
                ]
            }
        ]
    },
    {
        id: "courses-mgmt",
        name: "إدارة الدورات",
        icon: FolderKanban,
        children: [
            {
                id: "courses-sports",
                name: "فرع التدريب الرياضي",
                icon: Dumbbell,
                children: [
                    { id: "cs-sp-sol", name: "بيانات المجندين", href: "/courses/sports/soldiers-data", icon: User },
                    { id: "cs-sp-day-new", name: "تسجيل الحالات", href: "/daily-schedule?branch=sports", icon: ClipboardCheck },
                    { id: "cs-sp-daily-audit-new", name: " تدقيق التكميل", href: "/courses/audit", icon: ShieldCheck },
                    { id: "cs-sp-audit", name: "عرض التكميل المعتمد ", href: "/daily-audit?branch=sports", icon: ShieldCheck },
                    { id: "cs-sp-vio-new", name: "تسجيل المخالفات", href: "/violations", icon: ShieldAlert },
                    { id: "cs-sp-vio-history", name: "عرض المخالفات المعتمدة ", href: "/violations/history", icon: FileText },
                    { id: "cs-sp-rep", name: "تقرير عن مجند  ", href: "/courses/sports/reports", icon: FileText },
                    { id: "cs-sp-grad", name: "الدرجات الأسبوعية", href: "/courses/sports/weekly-grades", icon: Table },
                    { id: "cs-sp-wgt", name: "متابعة الأوزان", href: "/courses/sports/weights", icon: Scale },
                    { id: "cs-sp-soldiers", name: "ملف المجند", href: "/courses/sports/soldiers", icon: Users },
                ]
            },
            {
                id: "courses-military",
                name: "فرع التدريب العسكري",
                icon: Shield,
                children: [
                    { id: "cs-mil-day-new", name: "تسجيل الحالات", href: "/daily-schedule?branch=military", icon: ClipboardCheck },
                    { id: "cs-sp-daily-audit-new", name: "تدقيق التكميل", href: "/courses/audit", icon: ShieldCheck },
                    { id: "cs-mil-audit", name: " عرض التكميل المعتمد", href: "/daily-audit?branch=military", icon: ShieldCheck },
                    { id: "cs-mil-vio-new", name: "تسجيل المخالفات ", href: "/violations", icon: ShieldAlert },
                    { id: "cs-mil-vio-history", name: "عرض المخالفات المعتمدة ", href: "/violations/history", icon: FileText },
                    { id: "cs-mil-rep", name: "تقرير عن مجند ", href: "/courses/military/reports", icon: FileText }, 
                    { id: "cs-mil-soldiers", name: "ملف المجند", href: "/courses/military/soldiers", icon: Users },
                ]
            }
        ]
    },
    { id: "users-mgmt", name: "إدارة المستخدمين", href: "/admin/users", icon: ShieldAlert },
    { id: "scope-mgmt", name: "إدارة نطاق العمل", href: "/scope-management", icon: ShieldCheck },
    { id: "features-control", name: "لوحة تحكم المميزات", href: "/admin/features", icon: Settings },
    { id: "settings", name: "الإعدادات", href: "/settings", icon: Settings },
  );

  return baseItems;
};


export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [featuresConfig, setFeaturesConfig] = useState<Record<string, boolean>>(FEATURES_CONFIG)  // ✅ أضفنا النوع
  const [navigationStructure, setNavigationStructure] = useState<NavItem[]>(getNavigationStructure(FEATURES_CONFIG))

  // جلب الإعدادات عند تحميل الصفحة
  useEffect(() => {
    async function loadConfig() {
      const config = await loadFeaturesFromAPI()
      setFeaturesConfig(config)
      setNavigationStructure(getNavigationStructure(config))
    }
    loadConfig()
  }, [])
	const pathname = usePathname()
	const [isMounted, setIsMounted] = useState(false)
	const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({})
	// 🟢 هذا السطر سيأخذ أول كلمتين فقط (مثلاً: محمد فخري)
const userData = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("user") || "{}") : null;
const displayName = userData?.name ? userData.name.split(' ').slice(0, 2).join(' ') : "";
	// 1. 👇 الحالة المصححة: تقبل null كقيمة أولية
	const [userRole, setUserRole] = useState<string | null>(null);
    const [userBranch, setUserBranch] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
const [isAboutOpen, setIsAboutOpen] = useState(false);
const handleLogout = async () => {
    try {
        // إبلاغ السيرفر بالخروج (لتسجيل النشاط)
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/logout`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
    } catch (e) {
        console.log("Logout log failed");
    }

    // ثم باقي خطوات المسح والتوجيه...
    localStorage.clear();
    window.location.replace("/");
};
	useEffect(() => {
        setIsMounted(true); // لضمان عمل الواجهة
        setupFetchInterceptor();
        const verifySession = async () => {
            const token = localStorage.getItem("token");

            if (!token) {
                setUserRole(null);
                setUserBranch(null);
                setIsLoading(false);
                return;
            }

            try {
                // 🛡️ طلب التأكيد اللحظي من السيرفر
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/me`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (res.ok) {
                    const userData = await res.json();
                    setUserRole(userData.role || "");
                    setUserBranch(userData.branch || ""); // حفظ الفرع الحقيقي
                    localStorage.setItem("user", JSON.stringify(userData));
                } else {
                    // إذا فشل السيرفر في التعرف على التوكن
                    localStorage.removeItem("token");
                    localStorage.removeItem("user");
                    setUserRole(null);
                    setUserBranch(null);
                }
            } catch (error) {
                console.error("خطأ اتصال:", error);
                setUserRole(null);
            } finally {
                setIsLoading(false); // انتهاء التحميل
            }
        };

        verifySession();
    }, [pathname]); // ⬅️ هذا هو السر: إعادة التحقق عند كل تغيير في الرابط


// 🟢 أضفنا خاصية isHome
const NavIcon = ({ active, color, icon, isHome = false }: any) => (
    <motion.div
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="relative"
    >
        {active && (
            <>
                <motion.div
                    animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className={cn("absolute inset-0 rounded-full bg-gradient-to-br", color)}
                />
                <div className={cn("absolute inset-0 rounded-full blur-md scale-150 opacity-40", color.replace('from-', 'bg-'))} />
            </>
        )}

        <div className={cn(
            "relative w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-500",
            "border-2 border-white dark:border-slate-800",
            // 🔵 إذا كانت رئيسية وغير نشطة، نعطيها خلفية رمادية فاتحة جداً بدون تأثير الـ Grayscale
            active ? `bg-gradient-to-br ${color} shadow-blue-500/40` : 
            (isHome ? "bg-slate-100 dark:bg-slate-800 shadow-sm" : "bg-slate-200 dark:bg-slate-800 grayscale")
        )}>
            {/* 🔵 هنا التحكم بلون الأيقونة: إذا كانت رئيسية وغير نشطة تأخذ اللون الأزرق صراحة */}
            <div className={cn(
                "relative z-10 transition-colors duration-500",
                active ? "text-white" : (isHome ? "text-blue-600" : "text-slate-500")
            )}>
                {/* استنساخ الأيقونة مع إزالة أي ألوان ثابتة منها */}
                {React.cloneElement(icon, { className: "w-5 h-5" })}
            </div>
            
            {active && (
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0.5 rounded-full bg-gradient-to-tr from-white/20 to-transparent"
                />
            )}
        </div>
    </motion.div>
);

	const toggleMenu = (id: string) => {
		setOpenMenus(prev => ({ ...prev, [id]: !prev[id] }))
	}

	const renderMenuItem = (item: NavItem, depth = 0) => {
        
    // ----------------------------------------------------------------
    // 1. إدارة الاختبارات (للمالك ومساعد المسؤول فقط) - كما طلبت
    // ----------------------------------------------------------------
    if (item.id === "exams-mgmt") {
        const allowedUsers = ["owner", "assistant_admin"];
        if (isLoading || !allowedUsers.includes(userRole || "")) {
            return null;
        }
    }

    // ----------------------------------------------------------------
    // 2. إدارة المدربين (المنطق الموجود سابقاً)
    // ----------------------------------------------------------------
    if (item.id === "trainers-sports") {
        const isHighAdmin = ["owner", "manager", "admin"].includes(userRole || "");
        const isSportsTeam = ["assistant_admin", "sports_officer", "sports_supervisor", "sports_trainer"].includes(userRole || "");
        const isSportsBranch = userBranch === "تدريب رياضي";
        const isMilitaryStaff = ["military_officer", "military_supervisor", "military_trainer"].includes(userRole || "");
        
        if (isMilitaryStaff && !isHighAdmin) return null;
        if (!isHighAdmin && !isSportsTeam && !isSportsBranch) return null;
    }

    if (item.id === "trainers-military") {
        const isHighAdmin = ["owner", "manager", "admin"].includes(userRole || "");
        const isMilitaryTeam = ["military_officer", "military_supervisor", "military_trainer"].includes(userRole || "");
        const isMilitaryBranch = userBranch === "تدريب عسكري";
        const isSportsTeam = ["assistant_admin", "sports_officer", "sports_supervisor", "sports_trainer"].includes(userRole || "");
        
        if (isSportsTeam && !isHighAdmin) return null;
        if (!isHighAdmin && !isMilitaryTeam && !isMilitaryBranch) return null;
    }

    // ----------------------------------------------------------------
    // 3. تفاصيل المدربين والملفات الإدارية (كما هي)
    // ----------------------------------------------------------------
    if (item.id === "tr-sp-fit" || item.id === "tr-sp-com") {
        const allowed = ["owner", "manager", "admin", "assistant_admin", "sports_officer"];
        if (isLoading || !allowed.includes(userRole || "")) return null;
    }

    if (item.id === "tr-sp-adm") {
    const allowed = ["owner", "manager", "admin" ,"assistant_admin"]; 
    if (isLoading || !allowed.includes(userRole || "")) return null;
}

   if (item.id === "tr-sp-forms") {
        // التعديل: أضفنا sports_supervisor
        const allowed = ["owner", "manager", "admin", "assistant_admin", "sports_officer"];
        if (isLoading || !allowed.includes(userRole || "")) return null;
    }

    if (item.id === "tr-mil-list") {
        const allowed = ["owner", "manager", "admin", "military_officer"];
        if (isLoading || !allowed.includes(userRole || "")) return null;
    }

    if (item.id === "tr-mil-adm") {
    const allowed = ["owner", "manager", "admin"]; 
    if (isLoading || !allowed.includes(userRole || "")) return null;
}

// 🛡️ حماية رابط "المقارنات" - يظهر للمالك (Owner) فقط
if (item.id === "compare") {
    if (isLoading || userRole !== "owner") {
        return null; // سيختفي الرابط تماماً من القائمة لأي رتبة أخرى
    }
}
// ابحث عن هذا السطر تقريباً في منتصف الكود
if (item.id === "cs-sp-audit" || item.id === "cs-mil-audit" || item.id === "cs-sp-daily-audit-new") {
    const allowed = ["owner", "manager", "admin", "assistant_admin", "military_officer", "sports_officer", "military_supervisor", "sports_supervisor"];
    if (isLoading || !allowed.includes(userRole || "")) return null;
}
// =========================================================
    // 🛡️ حماية خاصة: إخفاء صفحات الإدخال والتدقيق عن المدير والمسؤول
    // =========================================================
    const restrictedIdsForAdmins = [
        "cs-sp-day-new",           // تسجيل حالات - رياضي
        "cs-sp-vio-new",           // تسجيل مخالفات - رياضي
        "cs-mil-day-new",          // تسجيل حالات - عسكري
        "cs-mil-vio-new",          // تسجيل مخالفات - عسكري
        "cs-sp-daily-audit-new"    // تدقيق التكميل (الطلب الجديد)
    ];

    if (restrictedIdsForAdmins.includes(item.id)) {
        // إذا كان المستخدم مدير أو مسؤول، نحجب هذه الروابط تماماً
        if (["manager", "admin"].includes(userRole || "")) {
            return null;
        }
    }
    // =========================================================
    // ----------------------------------------------------------------
    // 4. الاختبارات الرقمية (التعديلات الجديدة المطلوبة)
    // ----------------------------------------------------------------

    // أ. التدريب العسكري (يخفى عن الرياضيين ومساعد المسؤول)
    if (item.id === "dig-military") {
        const allowed = ["owner", "manager", "admin", "military_officer", "military_supervisor", "military_trainer"];
        if (isLoading || !allowed.includes(userRole || "")) return null;
    }

    // ب. التدريب الرياضي (يخفى عن العسكريين)
    if (item.id === "dig-sports") {
        const allowed = ["owner", "manager", "admin", "assistant_admin", "sports_officer", "sports_supervisor", "sports_trainer"];
        if (isLoading || !allowed.includes(userRole || "")) return null;
    }

    // ج. سجل النتائج الرياضي (للكل ما عدا المدرب)
    if (item.id === "dig-sports-results") {
        const allowed = ["owner", "manager", "admin", "assistant_admin", "sports_officer", "sports_supervisor","sports_trainer"];
        if (isLoading || !allowed.includes(userRole || "")) return null;
    }

    // د. رصد الدرجات (للكل ما عدا المشرف والمدرب)
    // ⚠️ هذا الشرط الجديد الخاص برصد الدرجات فقط
    if (item.id === "dig-sports-fit-entry") {
        const allowed = ["owner",  "assistant_admin"];
        if (isLoading || !allowed.includes(userRole || "")) return null;
    }

    // هـ. الشباحات وتنزيل الاختبارات (للكل)
    // ⚠️ قمنا بفصل "dig-sports-fit-entry" من هنا لأنه أصبح له شرط خاص أعلاه
    if (item.id === "cs-sp-sha" || item.id === "dig-sports-fit-download") {
        const allowed = ["owner", "manager", "admin", "assistant_admin", "sports_officer", "sports_supervisor", "sports_trainer"];
        if (isLoading || !allowed.includes(userRole || "")) return null;
    }

    // سجل النتائج العسكري (منطق قديم حافظنا عليه)
    if (item.id === "dig-mil-results") {
        const allowed = ["owner", "manager", "admin", "military_officer", "military_supervisor"];
        if (isLoading || !allowed.includes(userRole || "")) return null;
    }

    // ----------------------------------------------------------------
    // 5. إدارة المستخدمين وبقية الأقسام
    // ----------------------------------------------------------------
    if (item.id === "users-mgmt") {
        if (isLoading) return null; 
        const allowedToSeeUsers = ["owner", "manager", "admin"].includes(userRole || "");
        if (!allowedToSeeUsers) return null; 
    }
    // 🔒 حماية لوحة تحكم المميزات - Owner فقط
if (item.id === "features-control") {
    if (isLoading || userRole !== "owner") {
        return null;
    }
}
    // ----------------------------------------------------------------
    // 6. إدارة نطاق العمل (تظهر للقيادات والضباط والمشرف العسكري فقط)
    // ----------------------------------------------------------------
    if (item.id === "scope-mgmt") {
        const allowed = ["owner", "assistant_admin", "military_supervisor"];
        if (isLoading || !allowed.includes(userRole || "")) {
            return null;
        }
    }
    // إدارة الدورات - عسكري
    if (item.id === "courses-military") {
        if (isLoading || !userRole || !MILITARY_ROLES.includes(userRole)) return null;
    }

    // إدارة الدورات - رياضي
    if (item.id === "courses-sports") {
        if (isLoading || !userRole || !SPORTS_ROLES.includes(userRole)) return null;
    }

    // ملف المجند - عسكري
    if (item.id === "cs-mil-soldiers") {
        if (isLoading || !userRole || !MILITARY_ROLES.includes(userRole)) return null;
    }
    
    // ملف المجند - رياضي
    if (item.id === "cs-sp-soldiers") {
        if (isLoading || !userRole || !SPORTS_SOLDIER_ADMINS.includes(userRole)) return null;
    }
    if (item.id === "cs-sp-audit" || item.id === "cs-mil-audit") {
        const allowed = ["owner", "manager", "admin", "assistant_admin", "military_officer", "sports_officer", "military_supervisor", "sports_supervisor"];
        if (isLoading || !allowed.includes(userRole || "")) return null;
    }
    if (item.id === "cs-sp-vio-history" || item.id === "cs-mil-vio-history") {
        const allowed = ["owner", "manager", "admin", "assistant_admin", "military_officer", "sports_officer", "military_supervisor", "sports_supervisor"];
        if (isLoading || !allowed.includes(userRole || "")) return null;
    }
// 🛡️ حماية صفحة "بيانات المجندين" (حصرياً للقيادات والضابط)
if (item.id === "cs-sp-sol") {
    const allowed = ["owner", "manager", "admin", "assistant_admin", "sports_officer","sports_supervisor", "sports_trainer"];
    if (isLoading || !allowed.includes(userRole || "")) return null;
}
    // =========================================================
    // 🚀🚀 المنطقة الجديدة: منطق التسطيح الذكي (Smart Flattening) 🚀🚀
    // =========================================================
    
    // 1. تحديد من هو المستخدم؟
    const isHighAdmin = ["owner", "manager", "admin"].includes(userRole || "");
    const isUserSports = userBranch === "تدريب رياضي" || (userRole && userRole.startsWith("sports_"));
    const isUserMilitary = userBranch === "تدريب عسكري" || (userRole && userRole.startsWith("military_"));

    // 2. تحديد المجلدات التي نريد فتحها تلقائياً
    const isSportsFolder = ["dig-sports", "trainers-sports", "courses-sports"].includes(item.id);
    const isMilitaryFolder = ["dig-military", "trainers-military", "courses-military"].includes(item.id);

    // 3. التنفيذ: إذا لم يكن مديراً عاماً، وكان المجلد يخص فرع المستخدم، نعرض الأبناء فوراً
    if (!isHighAdmin && item.children) {
        if ((isUserSports && isSportsFolder) || (isUserMilitary && isMilitaryFolder)) {
            return (
                <div key={item.id + "-flat"} className="flex flex-col">
                    {/* نعيد رسم الأبناء بنفس مستوى العمق الحالي (depth) ليبدو كأنهم في المستوى الرئيسي */}
                    {item.children.map(child => renderMenuItem(child, depth))}
                </div>
            );
        }
    }

    // =========================================================
    // نهاية الشروط - رسم العنصر (UI Rendering)
    // =========================================================

    const hasChildren = item.children && item.children.length > 0
    const isOpen = openMenus[item.id]
    const isActive = item.href ? pathname === item.href : false
    // استخراج الاسم الأول فقط للترحيب بشكل مختصر وجميل

    const paddingStyle = { paddingRight: `${(depth * 0.8) + 0.75}rem` } 

    const getTextColor = () => {
        if (isActive) return "text-white"; 
        if (depth === 0) return "text-white font-bold";
        if (depth === 1) return "text-sky-400 font-medium";
        if (depth === 2) return "text-slate-400 text-xs";
        return "text-slate-500"; 
    }

    return (
        <div key={item.id} className="flex flex-col mb-1">
            {hasChildren ? (
                <button
                    onClick={() => toggleMenu(item.id)}
                    className={cn(
                        "flex flex-row items-center justify-between w-full p-3 text-sm transition-colors rounded-lg hover:bg-slate-800",
                        getTextColor(),
                        isOpen && "bg-slate-800/30"
                    )}
                    style={paddingStyle}
                >
                    <div className="flex flex-row items-center gap-3 overflow-hidden">
                        <item.icon className={cn("w-5 h-5 flex-shrink-0", depth === 0 ? "text-white" : "opacity-70")} />
                        <span className="whitespace-nowrap truncate">{item.name}</span>
                    </div>
                    {isOpen ? <ChevronDown className="w-4 h-4 flex-shrink-0 opacity-70" /> : <ChevronLeft className="w-4 h-4 flex-shrink-0 opacity-70" />}
                </button>
            ) : (
                <Link href={item.href!} className="w-full block">
                    <span
                        className={cn(
                            "flex flex-row items-center gap-3 p-3 rounded-lg transition-colors text-sm font-medium w-full",
                            isActive 
                                ? "bg-green-700 text-white shadow-md" 
                                : `hover:bg-slate-800 ${getTextColor()}`
                        )}
                        style={paddingStyle}
                    >
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        <span className="whitespace-nowrap truncate">{item.name}</span>
                    </span>
                </Link>
            )}

            {hasChildren && isOpen && (
                <div className="mt-1 space-y-0.5 animate-in slide-in-from-top-2 duration-200 border-r border-slate-700 mr-4">
                    {item.children!.map(child => renderMenuItem(child, depth + 1))}
                </div>
            )}
        </div>
    )
}

	const isLoginPage = pathname === "/" || pathname === "/login";

	// 8. 👇 منطق التحميل (يجب أن يكون داخل <body>)
	const renderAppContent = () => {
			// إذا كنا في صفحة غير الدخول وما زلنا نحمل الصلاحية، نعرض شاشة تحميل.
			if (!isLoginPage && isLoading) {
				return (
					<div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 w-full">
						<Loader2 className="w-8 h-8 animate-spin text-blue-600" />
					</div>
				);
			}
			
			// إذا كنا في صفحة الدخول، نعرض محتوى صفحة الدخول فقط.
			if (isLoginPage) {
				return (
					<main className="min-h-screen w-full flex flex-col justify-center bg-slate-50 dark:bg-slate-950 p-4">
						<div className="w-full max-w-md mx-auto">
							{children}
						</div>
					</main>
				);
			}
			
			// محتوى التطبيق الرئيسي (القائمة + المحتوى)
			return (
				<div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
						
						{/* القائمة الجانبية (Desktop) */}
						{/* 🟢 القائمة الجانبية (Desktop Sidebar) - زر الخروج المحدث */}
<aside className="hidden lg:flex w-64 flex-col bg-[#0f172a] text-white h-screen sticky top-0 shadow-xl border-l border-slate-800 flex-shrink-0 overflow-hidden">
    {/* ... هيدر القائمة و الـ Nav ... */}
    <div className="p-6 border-b border-slate-800 flex items-center justify-center bg-[#0f172a]">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <GraduationCap className="w-6 h-6" /> معهد الشرطة
        </h2>
    </div>
    
    <nav className="flex-1 p-2 space-y-1 overflow-y-auto custom-scrollbar">
        {navigationStructure.map(item => renderMenuItem(item))}
    </nav>
    
    {/* 👇 التعديل الجوهري هنا 👇 */}
    <div className="p-4 border-t border-slate-800 bg-[#1e293b]">
        <Button 
            variant="destructive" 
            // 🟢 التغيير: نفتح نافذة التأكيد بدلاً من استدعاء handleLogout مباشرة
            onClick={() => setIsLogoutDialogOpen(true)} 
            className="w-full flex gap-2 font-bold shadow-lg"
        >
            <LogOut className="w-4 h-4" /> خروج
        </Button>
    </div>
</aside>

						{/* المحتوى */}
						<div className="flex-1 flex flex-col h-full w-full overflow-hidden">
								
								{/* شريط الموبايل */}
								<header className="lg:hidden sticky top-0 bg-white dark:bg-slate-900 border-b p-2 md:p-3 flex justify-between items-center shadow-sm z-[110] flex-shrink-0">
    <div className="flex items-center gap-3">
        {isMounted && (
            <Sheet>
            {/* 🔑 تم تصغير حجم الزر قليلاً ليناسب الهواتف */}
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9"><Menu className="w-5 h-5" /></Button>
            </SheetTrigger>
														<SheetContent side="right" className="bg-[#0f172a] text-white border-l-slate-800 p-0 flex flex-col h-full w-[280px]">
    <SheetHeader className="p-4 border-b border-slate-800 shrink-0">
        <SheetTitle className="text-white">القائمة</SheetTitle>
    </SheetHeader>
    
    {/* 🟢 زدنا الـ pb إلى 40 لرفع آخر عنصر في القائمة للأعلى */}
    <nav className="p-4 flex-1 overflow-y-auto pb-32 custom-scrollbar">
        {navigationStructure.map(item => renderMenuItem(item))}
    </nav>
    
    {/* 🟢 رفعنا حاوية زر الخروج بـ mb-20 لضمان ابتعادها عن أزرار الموبايل الثابتة */}
    <div className="p-4 border-t border-slate-800 bg-[#1e293b] mb-20 shrink-0">
    <Button 
        variant="destructive" 
        // 🟢 التغيير هنا: نفتح النافذة بدلاً من تسجيل الخروج مباشرة
        onClick={() => setIsLogoutDialogOpen(true)} 
        className="w-full flex gap-2 h-8 font-bold shadow-lg"
    >
        <LogOut className="w-4 h-4" /> خروج  
    </Button>
</div>
</SheetContent>
												</Sheet>
										)}
                                       {/* الحاوية التي تجمع الترحيب والجرس */}
{!isLoading && displayName && (
    <div className="flex items-center gap-4 animate-in fade-in slide-in-from-right-2 duration-500">
        
       <div className="relative z-[120]"> 
            <NotificationsMenu />
        </div>

        {/* نصوص الترحيب */}
        <div className="flex flex-col -space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">مرحباً بك</span>
            <span className="text-xs font-black text-slate-700 dark:text-white truncate max-w-[120px]">
                {displayName}
            </span>
        </div>
    </div>
)}
    </div>

										<h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
												<GraduationCap className="w-5 h-5" />
												معهد الشرطة
										</h2>

								</header>

								<main className="flex-1 h-full overflow-y-auto p-4 md:p-8 w-full max-w-7xl mx-auto scroll-smooth pb-28 lg:pb-8 custom-scrollbar">
    {children}
</main>

								{/* الشريط السفلي للموبايل */}
								
{/* 📱 الشريط السفلي الاحترافي */}
<nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-700/50 px-6 flex justify-between items-center shadow-[0_-10px_40px_rgba(0,0,0,0.1)] h-16 pb-safe z-[999]">
    
    {/* 🏠 1. الرئيسية */}
    <Link href="/dashboard" className="relative flex-1 flex flex-col items-center justify-center group">
        <div className="relative -mt-8">
            <NavIcon 
                active={pathname === "/dashboard"} 
                isHome={true} // 👈 تم التفعيل
                color="from-blue-500 to-cyan-400" 
                icon={<LayoutDashboard />} // 👈 أزلنا text-white من هنا
            />
        </div>
        <span className={cn(
            "text-[9px] font-black mt-1 transition-colors duration-300",
            pathname === "/dashboard" ? "text-blue-600" : "text-blue-600/70" // 👈 جعلنا النص أيضاً ملوناً باهت قليلاً
        )}>الرئيسية</span>
    </Link>

    {/* ⚙️ 2. الإعدادات */}
    <Link href="/settings" className="relative flex-1 flex flex-col items-center justify-center group">
        <div className="relative -mt-8">
            <NavIcon 
                active={pathname === "/settings"} 
                color="from-indigo-500 to-purple-400" 
                icon={<Settings />} // 👈 أزلنا text-white
            />
        </div>
        <span className={cn(
            "text-[9px] font-black mt-1 transition-colors duration-300",
            pathname === "/settings" ? "text-indigo-600" : "text-slate-400"
        )}>الإعدادات</span>
    </Link>

    {/* 🚪 3. خروج */}
    <button onClick={() => setIsLogoutDialogOpen(true)} className="relative flex-1 flex flex-col items-center justify-center group">
        <div className="relative -mt-8">
            <NavIcon 
                active={false} 
                color="from-red-500 to-rose-400" 
                icon={<LogOut />} // 👈 أزلنا text-white
            />
        </div>
        <span className="text-[9px] font-black mt-1 text-slate-400">خروج</span>
    </button>
</nav>

						</div>

				</div>
			);
	};


	return (
		<>
				<ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
					
					{/* 9. 👇 عرض المحتوى المصحح لضمان وجود <html> و <body> */}
					<Toaster position="top-center" richColors />
					{renderAppContent()}
{/* 🚪 نافذة تأكيد تسجيل الخروج */}
<Dialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
    <DialogContent className="max-w-[350px] rounded-2xl p-6 gap-6" dir="rtl">
        <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center animate-pulse">
                <LogOut className="w-8 h-8 text-red-500" />
            </div>
            <div className="space-y-2">
                <DialogTitle className="text-xl font-black text-slate-900">تسجيل الخروج؟</DialogTitle>
                <p className="text-sm text-slate-500 font-medium">هل أنت متأكد أنك تريد مغادرة النظام الآن؟</p>
            </div>
        </div>
        <div className="flex gap-3 mt-2">
            <Button 
                variant="outline" 
                onClick={() => setIsLogoutDialogOpen(false)}
                className="flex-1 rounded-xl h-12 font-bold border-slate-200"
            >
                إلغاء
            </Button>
            <Button 
                onClick={handleLogout}
                className="flex-1 rounded-xl h-12 font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200"
            >
                خروج
            </Button>
        </div>
    </DialogContent>
</Dialog>
{/* 🎖️ نافذة بطاقة الهوية والنظام - النسخة الكاملة والمصححة */}
<Dialog open={isAboutOpen} onOpenChange={setIsAboutOpen}>
    <DialogContent className="max-w-[350px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl" dir="rtl">
        
        {/* 🛡️ جزء حل مشكلة Accessibility: عناوين مخصصة لمحركات قراءة الشاشة فقط */}
        <div className="sr-only">
            <DialogTitle>بطاقة تعريف المستخدم</DialogTitle>
            <DialogDescription>تعرض هذه النافذة تفاصيل الحساب الحالي والجهة التابع لها المستخدم داخل نظام معهد الشرطة.</DialogDescription>
        </div>

        {/* 🔵 القسم العلوي: الهوية البصرية للمعهد */}
        <div className="bg-[#0f172a] p-8 text-center space-y-4">
            <div className="w-24 h-24 bg-white rounded-2xl mx-auto p-2 shadow-2xl flex items-center justify-center">
                <img 
                    src="/logo.jpg" 
                    alt="Logo" 
                    className="w-full h-full object-contain" 
                />
            </div>
            <div className="text-white">
                <h2 className="text-xl font-black tracking-wide">معهد الشرطة</h2>
                <p className="text-[11px] text-slate-400 font-medium opacity-80 uppercase tracking-widest">
                    نظام إدارة التدريب العسكري والرياضي
                </p>
            </div>
        </div>

        {/* ⚪ القسم السفلي: بيانات الموظف والفرع */}
        <div className="p-6 bg-white space-y-5">
            <div className="space-y-4">
                
                {/* الاسم الكامل */}
                <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                    <span className="text-slate-500 text-xs font-bold">اسم المستخدم:</span>
                    <span className="font-bold text-slate-900 text-sm">
                        {typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("user") || "{}")?.name || "غير معروف" : "جاري التحميل..."}
                    </span>
                </div>

                {/* الرتبة / نوع الصلاحية */}
                <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                    <span className="text-slate-500 text-xs font-bold">نوع الصلاحية:</span>
                    <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-none px-3 py-0.5 text-[10px] font-black">
                        {userRole === "owner" ? "المالك العام" : userRole || "زائر"}
                    </Badge>
                </div>

                {/* الفرع الإداري */}
                <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                    <span className="text-slate-500 text-xs font-bold">الفرع التابع:</span>
                    <span className="font-black text-slate-700 text-[11px]">
                        {userBranch || "الإدارة العامة للمعهد"}
                    </span>
                </div>

                {/* تاريخ اليوم اللحظي */}
                <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-400 text-[10px] font-bold">تاريخ الدخول:</span>
                    <span className="text-slate-400 text-[10px] font-mono font-bold tracking-tighter">
                        {new Date().toLocaleDateString('ar-QA', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                </div>
            </div>

            {/* زر الإغلاق بتصميم متناسق */}
            <Button 
                onClick={() => setIsAboutOpen(false)}
                className="w-full rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black h-12 shadow-lg transition-all active:scale-95 mt-2"
            >
                إغلاق البطاقة
            </Button>
        </div>
    </DialogContent>
</Dialog>
				</ThemeProvider>
			</>
	)
}