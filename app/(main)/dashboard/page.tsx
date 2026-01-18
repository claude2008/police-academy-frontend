"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { 
  CalendarDays, ClipboardList, ShieldAlert, 
  BarChart3, Users, Settings, Target, 
  Dumbbell, FileText, Zap, Database, Search, 
  Layers, ArrowLeft, ShieldCheck, Award, Star,
  Shirt, Download, MoreHorizontal, UserCog,
  Table, Scale,Swords // ✅ تم إضافة الأيقونات الناقصة هنا
} from "lucide-react"
import { motion, Variants } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card" 
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import ProtectedRoute from "@/components/ProtectedRoute"
import { toast } from "sonner"

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)
  
  const [selectionState, setSelectionState] = useState<{
    isOpen: boolean;
    step: 'branch_select' | 'action_select' | 'exam_select' | 'report_select';
    feature: 'attendance' | 'violations' | 'exams' | 'reports' | 'soldiers' | 'others' | null;
    selectedBranch: 'military' | 'sports' | null;
    selectedExamType: string | null;
  }>({
    isOpen: false,
    step: 'branch_select',
    feature: null,
    selectedBranch: null,
    selectedExamType: null
  });

  const [currentSlide, setCurrentSlide] = useState(0); 

 useEffect(() => {
    // دالة داخلية لتحديث البيانات
    const refreshUser = () => {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setIsLoadingAuth(false);
    };

    // تنفيذ التحديث عند فتح الصفحة لأول مرة
    refreshUser();

    // 🟢 السر هنا: تحديث البيانات فوراً عند العودة للصفحة (مثلاً من الإعدادات)
    window.addEventListener('focus', refreshUser);

    return () => window.removeEventListener('focus', refreshUser);
}, []);

  const containerVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.1, duration: 0.6 } }
  };

  const itemVariants: Variants = {
    hidden: { scale: 0.8, opacity: 0 },
    visible: { scale: 1, opacity: 1, transition: { type: "spring", stiffness: 200, damping: 15 } }
  };

  const menuItems = [
    { 
      id: "attendance", label: "التكميل اليومي", icon: <CalendarDays className="w-9 h-9 text-white drop-shadow-md" />, 
      color: "bg-gradient-to-br from-blue-500 to-blue-700 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.3)]", shadow: "shadow-blue-300/50", notification: 0
    },
    { 
      id: "violations", label: " المخالفات", icon: <ShieldAlert className="w-9 h-9 text-white drop-shadow-md" />, 
      color: "bg-gradient-to-br from-red-500 to-red-700 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.3)]", shadow: "shadow-red-300/50", notification: 5 
    },
    { 
      id: "exams", label: "الاختبارات", icon: <ClipboardList className="w-9 h-9 text-white drop-shadow-md" />, 
      color: "bg-gradient-to-br from-purple-500 to-purple-700 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.3)]", shadow: "shadow-purple-300/50", notification: 0
    },
    
    { 
      id: "reports", label: "التقارير", icon: <BarChart3 className="w-9 h-9 text-white drop-shadow-md" />, 
      color: "bg-gradient-to-br from-amber-500 to-amber-700 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.3)]", shadow: "shadow-amber-300/50", notification: 3 
    },
    { 
        id: "soldiers", label: "الملف الشخصي", icon: <Users className="w-9 h-9 text-white drop-shadow-md" />, 
        color: "bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.3)]", shadow: "shadow-emerald-300/50", notification: 0
    },
    { 
        id: "others", label: "أخرى", icon: <MoreHorizontal className="w-9 h-9 text-white drop-shadow-md" />, 
        color: "bg-gradient-to-br from-slate-500 to-slate-700 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.3)]", shadow: "shadow-slate-300/50", notification: 0
    },
  ];

  const slides = [
    {
        id: 1,
        content: (
            <div className="w-full h-auto min-h-[280px] md:min-h-[220px] bg-gradient-to-r from-slate-900 to-blue-950 rounded-[2.5rem] relative overflow-hidden flex items-center p-6 md:p-12 shadow-xl border border-slate-800">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay"></div>
                <ShieldCheck className="absolute -left-10 -bottom-10 w-48 md:w-56 h-48 md:h-56 text-blue-500/10 rotate-12" />
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-8 w-full text-center md:text-right">
                    <div className="bg-blue-500/20 p-4 md:p-5 rounded-[2rem] backdrop-blur-md border border-blue-400/30 shadow-lg shrink-0">
                        <ShieldCheck className="w-10 h-10 md:w-12 md:h-12 text-blue-400" />
                    </div>
                    <div className="flex-1 space-y-3 md:space-y-2">
                        <div className="flex justify-center md:justify-start">
                            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">الحالة الأمنية</Badge>
                        </div>
                        <h3 className="text-xl md:text-3xl font-black text-white">دقة بيانات 100%</h3>
                        <p className="text-slate-300 text-xs md:text-base leading-relaxed font-medium">
                            نظام أرشفة مركزي مشفر يضمن حماية السجلات من التلف أو الفقدان، ويدعم اتخاذ القرار.
                        </p>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 2,
        content: (
            <div className="w-full h-auto min-h-[280px] md:min-h-[220px] bg-gradient-to-r from-red-950 to-rose-900 rounded-[2.5rem] relative overflow-hidden flex items-center p-6 md:p-12 shadow-xl border border-red-900">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay"></div>
                <FileText className="absolute -right-10 -top-10 w-64 h-64 text-white/5 -rotate-12" />
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-8 w-full text-center md:text-right">
                    <div className="bg-red-500/20 p-4 md:p-5 rounded-[2rem] backdrop-blur-md border border-red-400/30 shrink-0">
                        <FileText className="w-10 h-10 md:w-12 md:h-12 text-red-400" />
                    </div>
                    <div className="flex-1 space-y-3 md:space-y-2">
                        <div className="flex justify-center md:justify-start">
                            <Badge className="bg-red-500/20 text-red-300 border-red-500/30">بيئة خضراء</Badge>
                        </div>
                        <h3 className="text-xl md:text-3xl font-black text-white">الاستغناء عن الأوراق</h3>
                        <p className="text-red-100/80 text-xs md:text-base leading-relaxed font-medium">
                            تحول كامل نحو بيئة عمل رقمية، والتخلص نهائياً من عبء الملفات الورقية وفقدان البيانات الميدانية.
                        </p>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 3,
        content: (
            <div className="w-full h-auto min-h-[280px] md:min-h-[220px] bg-gradient-to-r from-amber-950 to-yellow-900 rounded-[2.5rem] relative overflow-hidden flex items-center p-6 md:p-12 shadow-xl border border-amber-900">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay"></div>
                <Zap className="absolute -left-10 -bottom-10 w-64 h-64 text-amber-500/10 rotate-12" />
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-8 w-full text-center md:text-right">
                    <div className="bg-amber-500/20 p-4 md:p-5 rounded-[2rem] backdrop-blur-md border border-amber-400/30 shrink-0">
                        <Zap className="w-10 h-10 md:w-12 md:h-12 text-amber-400" />
                    </div>
                    <div className="flex-1 space-y-3 md:space-y-2">
                        <div className="flex justify-center md:justify-start">
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">سرعة وكفاءة</Badge>
                        </div>
                        <h3 className="text-xl md:text-3xl font-black text-white">رقمنة الاختبارات</h3>
                        <p className="text-amber-100/80 text-xs md:text-base leading-relaxed font-medium">
                            رصد فوري للدرجات من الميدان مع حسابات دقيقة وتلقائية للنتائج.
                        </p>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 4,
        content: (
            <div className="w-full h-auto min-h-[280px] md:min-h-[220px] bg-gradient-to-r from-indigo-950 to-violet-900 rounded-[2.5rem] relative overflow-hidden flex items-center p-6 md:p-12 shadow-xl border border-indigo-900">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay"></div>
                <Database className="absolute -right-5 -bottom-5 w-56 h-56 text-violet-500/10 rotate-6" />
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-8 w-full text-center md:text-right">
                    <div className="bg-violet-500/20 p-4 md:p-5 rounded-[2rem] backdrop-blur-md border border-violet-400/30 shrink-0">
                        <Database className="w-10 h-10 md:w-12 md:h-12 text-violet-400" />
                    </div>
                    <div className="flex-1 space-y-3 md:space-y-2">
                        <div className="flex justify-center md:justify-start">
                            <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30">قاعدة موحدة</Badge>
                        </div>
                        <h3 className="text-xl md:text-3xl font-black text-white">مركزية البيانات</h3>
                        <p className="text-indigo-100/80 text-xs md:text-base leading-relaxed font-medium">
                            قاعدة بيانات موحدة تجمع كافة سجلات المجندين (لياقة، مشاة، رماية، تكميل، مخالفات، وزن ...) في مكان واحد لدعم القرار.
                        </p>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 5,
        content: (
            <div className="w-full h-auto min-h-[280px] md:min-h-[220px] bg-gradient-to-r from-emerald-950 to-green-900 rounded-[2.5rem] relative overflow-hidden flex items-center p-6 md:p-12 shadow-xl border border-emerald-900">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay"></div>
                <Search className="absolute -left-5 -top-5 w-56 h-56 text-emerald-500/10 -rotate-6" />
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-8 w-full text-center md:text-right">
                    <div className="bg-emerald-500/20 p-4 md:p-5 rounded-[2rem] backdrop-blur-md border border-emerald-400/30 shrink-0">
                        <Search className="w-10 h-10 md:w-12 md:h-12 text-emerald-400" />
                    </div>
                    <div className="flex-1 space-y-3 md:space-y-2">
                        <div className="flex justify-center md:justify-start">
                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">بحث متقدم</Badge>
                        </div>
                        <h3 className="text-xl md:text-3xl font-black text-white">سهولة الوصول</h3>
                        <p className="text-emerald-100/80 text-xs md:text-base leading-relaxed font-medium">
                            إمكانية استرجاع بيانات أي مجند أو دورة سابقة في ثوانٍ معدودة بفضل نظام البحث المتقدم والفلترة الذكية.
                        </p>
                    </div>
                </div>
            </div>
        )
    }
  ];

  useEffect(() => {
    const autoPlayTimer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 10000);
    return () => clearInterval(autoPlayTimer);
  }, [currentSlide, slides.length]);

  // =========================================================
  // 🚀 المحرك الذكي (The Smart Engine)
  // =========================================================
 const handleFeatureClick = (featureId: any) => {
    // 1. القراءة المباشرة من الذاكرة (لحل مشكلة البيانات القديمة)
    const storedUser = localStorage.getItem("user");
    
    if (!storedUser) {
        toast.error("يرجى تسجيل الدخول أولاً");
        router.push("/login");
        return;
    }

    const currentUser = JSON.parse(storedUser);
    
    // تحديث الحالة في الواجهة لتبقى متناسقة
    if (!user) setUser(currentUser);

    // 🟢 استخدام البيانات الطازجة (currentUser) بدلاً من القديمة
    const role = currentUser.role || "";
    
    const isTrainer = ["military_trainer", "sports_trainer"].includes(role);
    const isSupervisorOrOfficer = ["military_supervisor", "sports_supervisor", "military_officer", "sports_officer", "assistant_admin"].includes(role);
    const isSuperAdmin = ["owner", "manager", "admin"].includes(role);

    // 🟢 معالجة زر "أخرى"
    if (featureId === 'others') {
        
        // ❌ المنع الجديد: ضابط ومشرف العسكري
        if (["military_supervisor", "military_officer"].includes(role)) {
            return; 
        }

        // 1. الموظفين (رياضي + مساعد مسؤول)
        if (["sports_trainer", "sports_supervisor", "sports_officer", "assistant_admin"].includes(role)) {
            setSelectionState({
                isOpen: true,
                step: 'action_select',
                feature: 'others',
                selectedBranch: 'sports',
                selectedExamType: null
            });
            return;
        }

        // 2. الإدارة العليا
        if (isSuperAdmin) {
            setSelectionState({
                isOpen: true,
                step: 'branch_select',
                feature: 'others',
                selectedBranch: null,
                selectedExamType: null
            });
            return;
        }
        
        return; 
    }

    // تحديد الفرع تلقائياً بناءً على البيانات الجديدة
    let autoBranch: 'military' | 'sports' | null = null;
    if (role.includes("military")) autoBranch = 'military';
    if (role.includes("sports")) autoBranch = 'sports';
    if (role === 'assistant_admin') autoBranch = 'sports';

    // ---------------------------------------------------------
    // 🛑 السيناريو الأول: الموظفين (مدرب، مشرف، ضابط، مساعد)
    // ---------------------------------------------------------
    if (isTrainer || isSupervisorOrOfficer) {
        const myBranch = autoBranch || 'military'; 

        // أ. زر التقارير
        if (featureId === 'reports') {
            setSelectionState({
                isOpen: true,
                step: 'action_select', 
                feature: 'reports',
                selectedBranch: myBranch,
                selectedExamType: null
            });
            return;
        }

        // ب. المدرب
        if (isTrainer) {
            if (featureId === 'attendance') router.push(`/daily-schedule?branch=${myBranch}`);
            if (featureId === 'violations') router.push(`/violations?branch=${myBranch}`);
            if (featureId === 'soldiers') router.push(`/courses/${autoBranch}/soldiers`);
            if (featureId === 'exams') {
                setSelectionState({ isOpen: true, step: 'exam_select', feature: 'exams', selectedBranch: myBranch, selectedExamType: null });
            }
            return;
        }

        // ج. المشرف/الضابط
        if (isSupervisorOrOfficer) {
            
            // 🟢 التعديل للمشرف (Supervisor) فقط
            if (featureId === 'soldiers' && role.includes("_supervisor")) {
                router.push(`/courses/${autoBranch || 'military'}/soldiers`);
                return;
            }

            // الضابط ومساعد المسؤول
            if (featureId === 'soldiers') {
                setSelectionState({ isOpen: true, step: 'action_select', feature: featureId, selectedBranch: autoBranch || 'military', selectedExamType: null });
                return;
            }

            // باقي الأزرار
            setSelectionState({
                isOpen: true,
                step: featureId === 'exams' ? 'exam_select' : 'action_select',
                feature: featureId,
                selectedBranch: autoBranch || 'military',
                selectedExamType: null
            });
            return;
        }
    }

    // ---------------------------------------------------------
    // 🛑 السيناريو الثاني: الإدارة العليا (Owner, Manager, Admin)
    // ---------------------------------------------------------
    if (isSuperAdmin) {
        setSelectionState({
            isOpen: true,
            step: 'branch_select',
            feature: featureId,
            selectedBranch: null,
            selectedExamType: null
        });
    }
  };

  const handleBranchSelect = (branch: 'military' | 'sports') => {
      // إذا كان الزر هو الملف الشخصي أو أخرى، ننتقل للإجراء
      if (selectionState.feature === 'soldiers' || selectionState.feature === 'others') {
          setSelectionState(prev => ({ ...prev, selectedBranch: branch, step: 'action_select' })); 
          return;
      }

      setSelectionState(prev => ({
          ...prev,
          selectedBranch: branch,
          step: prev.feature === 'exams' ? 'exam_select' : 'action_select'
      }));
  };

  const executeAction = (actionType: string) => {
      const { feature, selectedBranch } = selectionState;
      if (!selectedBranch) return;

      // 📅 التكميل
      if (feature === 'attendance') {
          if (actionType === 'new') router.push(`/daily-schedule?branch=${selectedBranch}`);
          if (actionType === 'audit') router.push(`/daily-audit?branch=${selectedBranch}`);
      }

      // 🛑 المخالفات
      if (feature === 'violations') {
          if (actionType === 'new') router.push(`/violations`);
          if (actionType === 'history') router.push(`/violations/history`);
      }

      // 📊 التقارير
      if (feature === 'reports') {
          if (actionType === 'personal') router.push(`/trainers/${selectedBranch}/reports`);
          if (actionType === 'soldier') router.push(`/courses/${selectedBranch}/reports`);
      }

      // 👥 الملف الشخصي
      if (feature === 'soldiers') {
          if (actionType === 'fitness_trainers') router.push(`/trainers/sports/fitness`);
          if (actionType === 'combat_trainers') router.push(`/trainers/sports/combat`);
          if (actionType === 'military_trainers') router.push(`/trainers/military/list`);
          if (actionType === 'soldiers_file') router.push(`/courses/${selectedBranch}/soldiers`);
      }

      // 🛠️ أخرى
if (feature === 'others') {
    // 🟢 إضافة التوجيه لصفحة البيانات
    if (actionType === 'soldiers_data') router.push(`/courses/sports/soldiers-data`);
    
    if (actionType === 'weekly_grades') router.push(`/courses/sports/weekly-grades`);
    if (actionType === 'weights') router.push(`/courses/sports/weights`);
    if (actionType === 'admin_file') router.push(`/trainers/admin-file?branch=${selectedBranch}`);
}

      setSelectionState(prev => ({ ...prev, isOpen: false }));
  };

  const handleExamTypeSelect = (type: string) => {
      const { selectedBranch } = selectionState;
      
      if (selectedBranch === 'military') {
          if (type === 'shooting') router.push('/exams/military/shooting');
          if (type === 'infantry') router.push('/exams/military/infantry');
          if (type === 'results') router.push('/exams/military/results');
          setSelectionState(prev => ({ ...prev, isOpen: false }));
      } 
      else {
          if (type === 'fitness') {
              setSelectionState(prev => ({ ...prev, step: 'action_select', selectedExamType: 'fitness' }));
          } else if (type === 'combat') {
              router.push('/exams/sports/engagement');
              setSelectionState(prev => ({ ...prev, isOpen: false }));
          } else if (type === 'results') {
              router.push('/exams/sports/fitness-records');
              setSelectionState(prev => ({ ...prev, isOpen: false }));
          }
      }
  };

  const handleFitnessAction = (action: string) => {
      if (action === 'shabaha') router.push('/exams/sports/fitness/shabaha-entry');
      if (action === 'download') router.push('/exams/sports/fitness/download');
      if (action === 'entry') router.push('/exams/sports/fitness/merge');
      setSelectionState(prev => ({ ...prev, isOpen: false }));
  };


  return (
    <ProtectedRoute allowedRoles={["owner","manager","admin","assistant_admin","sports_officer","sports_supervisor", "sports_trainer","military_officer","military_supervisor", "military_trainer"]}>
      <motion.div initial="hidden" animate="visible" variants={containerVariants} className="min-h-screen bg-slate-50/50 p-4 md:p-12 pb-6 space-y-8" dir="rtl">
        
        <motion.div variants={itemVariants} className="relative overflow-hidden bg-slate-900 rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl border border-slate-800">
          <div className="absolute inset-0 z-0">
            <img src="https://www.qatarradio.qa/Assets/News/637901058566682633.jpg" className="w-full h-full object-cover opacity-20 mix-blend-overlay grayscale" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-slate-900/20" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="space-y-4 max-w-2xl">
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                    <Badge className="bg-green-500/10 text-green-400 border-green-500/20 px-3 py-1 text-[10px] tracking-wider backdrop-blur-sm">نظام الإدارة الرقمية </Badge>
                </motion.div>
                <h1 className="text-3xl md:text-5xl font-black leading-tight">مرحباً بك في <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">تطبيق معهد الشرطة</span></h1>
                <p className="text-slate-400 text-sm md:text-lg font-medium leading-relaxed max-w-lg">منصة مركزية لإدارة العمليات الميدانية، التدريب، والتقييم بدقة رقمية متناهية.</p>
            </div>
            <div className="hidden md:block opacity-20"><Layers className="w-32 h-32 text-white/50" /></div>
          </div>
        </motion.div>

        <div className="relative">
            <div className="flex items-center gap-2 mb-6 px-2">
                <div className="p-2 bg-amber-100 rounded-lg"><Zap className="w-5 h-5 text-amber-600" /></div>
                <h2 className="text-xl font-black text-slate-800">التطبيقات والخدمات</h2>
            </div>
            <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-[2.5rem] p-8 md:p-10 shadow-sm">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-y-10 gap-x-6 justify-items-center">
                    {menuItems.map((item) => (
                        <motion.div 
                            key={item.id} variants={itemVariants} whileHover={{ scale: 1.1, y: -5 }} whileTap={{ scale: 0.95 }}
                            className="flex flex-col items-center gap-4 cursor-pointer group relative w-full max-w-[120px]"
                            onClick={() => handleFeatureClick(item.id)}
                        >
                            <div className={`w-20 h-20 md:w-24 md:h-24 rounded-[28px] md:rounded-[32px] ${item.color} flex items-center justify-center shadow-lg ${item.shadow} group-hover:shadow-2xl transition-all duration-300 relative overflow-hidden ring-4 ring-white`}>
                                <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                                <div className="relative z-10 transform group-hover:scale-110 transition-transform duration-300">{item.icon}</div>
                                {item.notification > 0 && (
                                    <div className="absolute top-3 right-3 z-20">
                                        <span className="relative flex h-4 w-4">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 border border-white"></span>
                                        </span>
                                    </div>
                                )}
                            </div>
                            <span className="font-bold text-slate-700 text-sm md:text-[15px] group-hover:text-blue-600 transition-colors text-center whitespace-nowrap">{item.label}</span>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>

        <motion.div variants={itemVariants} className="pt-4 pb-12 relative">
          <div className="text-center mb-6 space-y-1">
            <h2 className="text-lg font-bold text-slate-400">مميزات النظام والحالة التشغيلية</h2>
          </div>
          <div className="relative w-full overflow-hidden rounded-[2.5rem]" style={{ direction: "ltr" }}>
            <motion.div
              className="flex"
              animate={{ x: `-${currentSlide * 100}%` }}
              transition={{ type: "spring", stiffness: 150, damping: 20 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                const threshold = 50; 
                if (info.offset.x < -threshold && currentSlide < slides.length - 1) {
                  setCurrentSlide(currentSlide + 1);
                } else if (info.offset.x > threshold && currentSlide > 0) {
                  setCurrentSlide(currentSlide - 1);
                }
              }}
              style={{ width: "100%", cursor: "grab" }}
            >
              {slides.map((slide) => (
                <div key={slide.id} className="w-full shrink-0 p-1 select-none">
                  <div className="pointer-events-none w-full">{slide.content}</div>
                </div>
              ))}
            </motion.div>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2 rounded-full transition-all duration-300 shadow-md ${currentSlide === index ? "w-8 bg-slate-800" : "w-2 bg-slate-300 hover:bg-slate-400"}`}
                />
              ))}
            </div>
          </div>
        </motion.div>

        <Dialog open={selectionState.isOpen} onOpenChange={(val) => setSelectionState(prev => ({...prev, isOpen: val}))}>
            <DialogContent className="max-w-md border-0 bg-transparent shadow-none p-0 focus:outline-none" dir="rtl">
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 overflow-hidden relative">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-10 -mt-10 blur-2xl z-0" />
                   <div className="relative z-10">
                       <DialogHeader className="mb-8 text-left items-start space-y-2">
    <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-2">
        <Settings className="w-6 h-6 text-slate-600 animate-spin-slow" />
    </div>
    <DialogTitle className="text-2xl font-black text-slate-800">
        {selectionState.step === 'branch_select' ? 'تحديد المسار' : 'اختر الإجراء'}
    </DialogTitle>
    <p className="text-sm text-slate-500 font-medium">
        {selectionState.step === 'branch_select' ? 'يرجى اختيار الفرع للمتابعة:' : 'ماذا تريد أن تفعل الآن؟'}
    </p>
</DialogHeader>


                       <div className="grid grid-cols-1 gap-4">
                           
                           {/* 1. اختيار الفرع */}
                           {selectionState.step === 'branch_select' && (
                               <div className="grid grid-cols-2 gap-4">
                                   <button onClick={() => handleBranchSelect('military')} className="group flex flex-col items-center gap-3 p-6 rounded-3xl border-2 border-slate-100 hover:border-green-500 hover:bg-green-50 transition-all duration-300">
                                       <div className="w-14 h-14 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm"><Target className="w-7 h-7" /></div>
                                       <span className="font-bold text-slate-700 group-hover:text-green-700 text-sm">التدريب العسكري</span>
                                   </button>
                                   <button onClick={() => handleBranchSelect('sports')} className="group flex flex-col items-center gap-3 p-6 rounded-3xl border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition-all duration-300">
                                       <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm"><Dumbbell className="w-7 h-7" /></div>
                                       <span className="font-bold text-slate-700 group-hover:text-blue-700 text-sm">التدريب الرياضي</span>
                                   </button>
                               </div>
                           )}

                           {/* 2. اختيار الإجراء - التكميل */}
                           {selectionState.step === 'action_select' && selectionState.feature === 'attendance' && (
                               <>
                                   <button onClick={() => executeAction('new')} className="w-full p-4 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-2xl flex items-center gap-3 transition-all"><ClipboardList className="w-5 h-5"/> تسجيل حالات جديدة</button>
                                   <button onClick={() => executeAction('audit')} className="w-full p-4 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-2xl flex items-center gap-3 transition-all"><ShieldCheck className="w-5 h-5"/> عرض التكميل والتدقيق</button>
                               </>
                           )}

                           {/* المخالفات */}
                           {selectionState.step === 'action_select' && selectionState.feature === 'violations' && (
                               <>
                                   <button onClick={() => executeAction('new')} className="w-full p-4 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-2xl flex items-center gap-3 transition-all"><ShieldAlert className="w-5 h-5"/> تسجيل مخالفة جديدة</button>
                                   <button onClick={() => executeAction('history')} className="w-full p-4 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-2xl flex items-center gap-3 transition-all"><FileText className="w-5 h-5"/> أرشيف المخالفات</button>
                               </>
                           )}

                           {/* التقارير */}
                           {selectionState.step === 'action_select' && selectionState.feature === 'reports' && (
                               <>
                                   <button onClick={() => executeAction('personal')} className="w-full p-4 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold rounded-2xl flex items-center gap-3 transition-all"><Users className="w-5 h-5"/> تقرير شخصي (مدرب)</button>
                                   <button onClick={() => executeAction('soldier')} className="w-full p-4 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-2xl flex items-center gap-3 transition-all"><FileText className="w-5 h-5"/> تقرير عن مجند</button>
                               </>
                           )}

                           {/* الملف الشخصي (دليل المجندين) */}
                           {selectionState.step === 'action_select' && selectionState.feature === 'soldiers' && (
                               <div className="space-y-3">
                                   {selectionState.selectedBranch === 'military' ? (
                                       <button onClick={() => executeAction('military_trainers')} className="w-full p-4 bg-green-50 hover:bg-green-100 text-green-700 font-bold rounded-2xl flex items-center gap-3 transition-all"><UserCog className="w-5 h-5"/> قائمة مدربين العسكري</button>
                                   ) : (
                                       <>
                                           <button onClick={() => executeAction('fitness_trainers')} className="w-full p-4 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-2xl flex items-center gap-3 transition-all"><Dumbbell className="w-5 h-5"/> قائمة مدربين اللياقة</button>
                                           <button onClick={() => executeAction('combat_trainers')} className="w-full p-4 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-2xl flex items-center gap-3 transition-all"><Swords className="w-5 h-5"/> قائمة مدربين الاشتباك</button>
                                       </>
                                   )}
                                   <button onClick={() => executeAction('soldiers_file')} className="w-full p-4 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-2xl flex items-center gap-3 transition-all"><Users className="w-5 h-5"/> ملفات المجندين</button>
                               </div>
                           )}

                           {/* 🟢 زر أخرى (خيارات حسب الفرع) */}
                          {/* 🟢 زر أخرى (خيارات حسب الفرع) */}
{selectionState.step === 'action_select' && selectionState.feature === 'others' && (
    <div className="grid grid-cols-1 gap-3">
        
        {/* أ. خيارات التدريب الرياضي */}
        {selectionState.selectedBranch === 'sports' && (
            <>
                {/* 🟢 الزر الجديد المضاف هنا في قسم أخرى */}
                <button onClick={() => executeAction('soldiers_data')} className="w-full p-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-2xl flex items-center gap-3 transition-all border-2 border-emerald-100 shadow-sm">
                    <Table className="w-5 h-5"/> بيانات المجندين
                </button>

                <button onClick={() => executeAction('weekly_grades')} className="w-full p-4 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold rounded-2xl flex items-center gap-3 transition-all">
                    <Table className="w-5 h-5"/> الدرجات الأسبوعية
                </button>

                <button onClick={() => executeAction('weights')} className="w-full p-4 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-2xl flex items-center gap-3 transition-all">
                    <Scale className="w-5 h-5"/> متابعة الأوزان
                </button>
                
                {/* الملف الإداري يظهر فقط للإدارة العليا */}
                {["owner", "manager", "admin"].includes(user?.role) && (
                    <button onClick={() => executeAction('admin_file')} className="w-full p-4 bg-slate-800 text-white font-bold rounded-2xl flex items-center gap-3 transition-all hover:bg-slate-700">
                        <FileText className="w-5 h-5"/> الملف الإداري (خاص بالإدارة)
                    </button>
                )}
            </>
        )}

        {/* ب. خيارات التدريب العسكري */}
        {selectionState.selectedBranch === 'military' && (
            <button onClick={() => executeAction('admin_file')} className="w-full p-4 bg-slate-800 text-white font-bold rounded-2xl flex items-center gap-3 transition-all hover:bg-slate-700">
                <FileText className="w-5 h-5"/> الملف الإداري (خاص بالإدارة)
            </button>
        )}
    </div>
)}
                           {/* 3. اختيار الاختبار */}
                           {selectionState.step === 'exam_select' && (
                               <div className="grid grid-cols-1 gap-3">
                                   {selectionState.selectedBranch === 'military' ? (
                                       <>
                                           <button onClick={() => handleExamTypeSelect('shooting')} className="w-full p-4 bg-slate-50 hover:bg-green-50 text-slate-700 hover:text-green-700 font-bold rounded-2xl transition-all border border-slate-100">🎯 اختبار الرماية</button>
                                           <button onClick={() => handleExamTypeSelect('infantry')} className="w-full p-4 bg-slate-50 hover:bg-green-50 text-slate-700 hover:text-green-700 font-bold rounded-2xl transition-all border border-slate-100">🦶 اختبار المشاة</button>
                                           {!["military_trainer"].includes(user?.role) && (
                                               <button onClick={() => handleExamTypeSelect('results')} className="w-full p-4 bg-slate-800 text-white font-bold rounded-2xl transition-all">📊 سجل النتائج</button>
                                           )}
                                       </>
                                   ) : (
                                       <>
                                           <button onClick={() => handleExamTypeSelect('fitness')} className="w-full p-4 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold rounded-2xl transition-all border border-slate-100">🏃 اختبار اللياقة</button>
                                           <button onClick={() => handleExamTypeSelect('combat')} className="w-full p-4 bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-700 font-bold rounded-2xl transition-all border border-slate-100">🤼 اختبار الاشتباك</button>
                                           {!["sports_trainer"].includes(user?.role) && (
                                               <button onClick={() => handleExamTypeSelect('results')} className="w-full p-4 bg-slate-800 text-white font-bold rounded-2xl transition-all">📊 سجل النتائج</button>
                                           )}
                                       </>
                                   )}
                               </div>
                           )}

                           {/* 4. خيارات اللياقة */}
                           {selectionState.step === 'action_select' && selectionState.selectedExamType === 'fitness' && (
                               <div className="grid grid-cols-1 gap-3">
                                   <button onClick={() => handleFitnessAction('shabaha')} className="w-full p-4 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-2xl flex items-center gap-3"><Shirt className="w-5 h-5"/> إدخال الشباحات</button>
                                   <button onClick={() => handleFitnessAction('download')} className="w-full p-4 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-2xl flex items-center gap-3"><Download className="w-5 h-5"/> تنزيل الإختبار </button>
                                   {["owner", "assistant_admin"].includes(user?.role) && (
            <button onClick={() => handleFitnessAction('entry')} className="w-full p-4 bg-green-50 hover:bg-green-100 text-green-700 font-bold rounded-2xl flex items-center gap-3 border-2 border-green-200 shadow-sm">
                <ClipboardList className="w-5 h-5"/> متابعة سير الإختبار  
            </button>
        )}
    </div>
)}
                       </div>
                   </div>
               </motion.div>
            </DialogContent>
        </Dialog>

      </motion.div>
    </ProtectedRoute>
  );
}