"use client"

import { useEffect, useState, useRef } from "react"
import { useTheme } from "next-themes"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter,
} from "@/components/ui/card"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { 
  Moon, Sun, Save, Settings2, Sliders, Palette, Lock, 
  PenTool, Eraser, Upload, Trash2, Loader2, ShieldCheck, 
  Plus, Target, Footprints, X, AlertTriangle, CalendarDays, 
  Clock, Copy, Scale, Edit // 👈 أضفنا Edit هنا في النهاية
} from "lucide-react"

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
import { toast } from "sonner"
import SignatureCanvas from 'react-signature-canvas'
import ProtectedRoute from "@/components/ProtectedRoute"
import { Badge } from "@/components/ui/badge"

// تعريف أنواع البيانات
type Criterion = { id: string; name: string; max: number };
type MilitaryTest = { id: string; name: string; criteria: Criterion[] };
type MilitaryBranch = { id: 'shooting' | 'infantry'; name: string; tests: MilitaryTest[] };
// 🆕 أنواع بيانات الاشتباك
type EngagementCriterion = { 
  id: string; 
  name: string; 
  max: number; 
  stations: string[] // 👈 تأكد أنها مصفوفة هنا
};
type EngagementAxis = { 
  id: string; 
  name: string; 
  is_active: boolean; // 👈 الإضافة الجديدة
  criteria: EngagementCriterion[] 
};
type EngagementTab = { id: 'technical' | 'scenario'; name: string; axes: EngagementAxis[] };
type TrainingSession = {
  id: string;
  name: string;
  // 🟢 أضفنا 'combat' هنا ليختفي الخطأ
  type: 'sports' | 'military' | 'combat' | 'lecture' | 'other'; 
  startTime: string;
  endTime: string;
};

type DaySchedule = {
  dayName: string;   // "الأحد"، "الاثنين"...
  sessions: TrainingSession[]; // قائمة حصص هذا اليوم
};

type TrainingTemplate = {
  id: string;
  name: string;          // "الجدول الشتوي - مستجدين"
  courseId: string;      // الدورة المرتبطة (اختياري)
  batchId: string;       // الدفعة المرتبطة (اختياري)
  isActive: boolean;     // هل هو الجدول الفعال؟
  schedule: DaySchedule[]; // مصفوفة الـ 7 أيام
};
// ⚖️ أنواع بيانات لائحة المخالفات
type Violation = { id: string; name: string; penalty: string; deduction: number };
type ViolationDegree = { id: string; name: string; items: Violation[] };
type DisciplinaryRegulation = { id: string; name: string; degrees: ViolationDegree[] };
// دالة لتحويل الأرقام من العربية الشرقية إلى الإنجليزية
const toEnglishDigits = (str: string) => {
  return str.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
};
const MILITARY_SECTIONS = [
  { id: 'shooting', name: 'الرماية' },
  { id: 'infantry', name: 'المشاة' },
  { id: 'student_teacher', name: 'تلميذ بدور معلم' },
  { id: 'weapons', name: 'الأسلحة' },
  { id: 'specialized_courses', name: 'دورات تخصيصية' }
];
export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const sigPad = useRef<any>({})
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
const [testToDelete, setTestToDelete] = useState<{branchId: string, testId: string} | null>(null);
const [filterOptions, setFilterOptions] = useState<{ courses: string[], batches: string[] }>({ courses: [], batches: [] });
  // حالات كلمة المرور
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [trainingTemplates, setTrainingTemplates] = useState<TrainingTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false); // وضع التعديل
  // 🟢 متغيرات التاب الجديد (الديناميكي)
  const [allExamConfigs, setAllExamConfigs] = useState<any[]>([]); // قائمة بكل الاختبارات (قديم وجديد)
  const [militarySections, setMilitarySections] = useState<any[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null); // الاختبار المختار حالياً للتعديل
  const [newTestName, setNewTestName] = useState(""); // لإنشاء اختبار جديد
  // أيام الأسبوع الثابتة للجدول
  const weekDays = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
  const [templateToDeleteId, setTemplateToDeleteId] = useState<string | null>(null);
const [isTemplateConfirmOpen, setIsTemplateConfirmOpen] = useState(false);
  // حالات التوقيع
  const [savedSignature, setSavedSignature] = useState<string | null>(null)
  const [userMilId, setUserMilId] = useState<string | null>(null)
  const [editingAxis, setEditingAxis] = useState<{tabId: string, axisId: string, name: string} | null>(null);
const [isAxisModalOpen, setIsAxisModalOpen] = useState(false);
const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);
const [newSectionData, setNewSectionData] = useState({ name: "", key: "" });
const [showOnlyActive, setShowOnlyActive] = useState(false); // حالة فلترة القوالب
const [hideInactiveLoaded, setHideInactiveLoaded] = useState(false);
  // إعدادات اللياقة والتفضيلات
  const [calcSettings, setCalcSettings] = useState({
    distance: "3200", pass_rate: 60, base_score: 100, mercy_mode: false, rows_per_page: "10"
  })
  const saveDisciplinaryData = async () => {
    setLoading(true);

    // 1. تحويل البيانات المتداخلة إلى قائمة مسطحة تناسب قاعدة البيانات
    const flattenedRegulations: any[] = [];

    disciplinaryData.forEach(reg => {
        reg.degrees.forEach(degree => {
            // استخراج رقم الدرجة من المعرف (مثلاً d1 تصبح 1)
            const degreeNumber = parseInt(degree.id.replace(/[^\d]/g, '')) || 1;
            
            degree.items.forEach(item => {
                flattenedRegulations.push({
                    regulation_type: reg.id, // 'recruits' أو 'specialized'
                    degree: degreeNumber,
                    violation_name: item.name,
                    penalty_label: item.penalty,
                    deduction_points: item.deduction,
                    is_active: true
                });
            });
        });
    });

    // 2. إرسال البيانات للباك إند
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/disciplinary/bulk`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify({ regulations: flattenedRegulations })
        });

        if (res.ok) {
            toast.success("تم اعتماد وحفظ كافة اللوائح بنجاح ✅");
        } else {
            const err = await res.json();
            throw new Error(err.detail || "فشل الحفظ");
        }
    } catch (e: any) {
        toast.error(`خطأ: ${e.message}`);
    } finally {
        setLoading(false);
    }
};
// حالة للتحكم في نافذة عرض/تعديل نص المخالفة الطويل
const [editingViolationText, setEditingViolationText] = useState<{regId: string, degId: string, itemIdx: number, value: string} | null>(null);
  // 🛡️ معايير العسكري (رماية ومشاة)
  const [militaryData, setMilitaryData] = useState<MilitaryBranch[]>([
    { id: 'shooting', name: 'اختبارات الرماية', tests: [] },
    { id: 'infantry', name: 'اختبارات المشاة', tests: [] }
  ]);
// 🆕 بيانات الاشتباك (فني وسيناريو)
const [engagementData, setEngagementData] = useState<EngagementTab[]>([
  { 
    id: 'technical', 
    name: 'الاختبار الفني', 
    axes: [
      {
        id: 'initial-axis',
        name: 'محور جديد',
        is_active: true, // 🟢 أضف هذا السطر هنا
        criteria: [
          { id: 'initial-crit', name: 'معيار 1', max: 0, stations: [] }
        ]
      }
    ] 
  },
  { id: 'scenario', name: 'اختبار السيناريو', axes: [] }
]);
// حالة للتبديل بين المبيت والثابت في لائحة المستجدين
const [recruitSystem, setRecruitSystem] = useState<'sleeping' | 'fixed'>('sleeping');
const [activeEngTab, setActiveEngTab] = useState("technical");
  const [activeMilTab, setActiveMilTab] = useState("shooting");
  const [loading, setLoading] = useState(false)
// ⚖️ حالة لائحة المخالفات
const [disciplinaryData, setDisciplinaryData] = useState<DisciplinaryRegulation[]>([
  {
    id: 'recruits',
    name: 'لائحة المستجدين والطلبة',
    degrees: [
      {
        id: 'd1',
        name: 'مخالفات الدرجة الأولى (نظام المبيت)',
        items: [
          { id: 'r1-1', name: 'الغش في الامتحان ، أو محاولة الغش ، أو مساعدة طالب آخر على الغش', penalty: 'يحال إلى لجنة التحقيق', deduction: 6 },
          { id: 'r1-2', name: 'الحصول على اسئلة الامتحانات بطريقة غير رسمية ، او نشرها ، او توزيعها او المساعدة في ذلك او الاحتفاظ بورقة الإجابة بعد انتهاء موعد الامتحان', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
          { id: 'r1-3', name: 'القيام بإعداد بحوث او أوراق عمل عن طالب اخر', penalty: 'يحال إلى لجنة التحقيق', deduction: 6 },
          { id: 'r1-4', name: 'تقديم بحوث او أوراق عمل الأستاذ المقرر ليست من مجهود الطالب ذاته', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
          { id: 'r1-5', name: 'الإخلال بالنظام والتعليمات داخل قاعة الامتحان', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
          { id: 'r1-6', name: 'رفض الأوامر او التعليمات او التحريض على ذلك او منع الزملاء من تنفيذها بأي وسيلة', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
          { id: 'r1-7', name: 'الاشتراك في شجار جماعي او التحريض عليه داخل المعهد او خارجه', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
          { id: 'r1-8', name: 'الاعتداء بالفعل او بالقول او بالكتابة او باي وسيلة من وسائل التعبير الأخرى على أي من العاملين في المعهد', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
          { id: 'r1-9', name: 'الفرار من المعهد او الهروب من الحجز', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
          { id: 'r1-10', name: 'تعاطي او حيازة العقاقير الممنوعة او المشروبات الكحولية', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
          { id: 'r1-11', name: 'الأفعال التي تشكل احدى الجرائم المنصوص عليها في القوانين الجنائية', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
          { id: 'r1-12', name: 'تحريض الزملاء او منعهم من الجلوس لأداء الامتحانات او حضور المحاضرات', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
          { id: 'r1-13', name: 'مشاهدة الأفلام او الصور الإباحية وغيرها عبر الوسائط الإلكترونية او حيازتها', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
          { id: 'r1-14', name: 'تقديم شكوى الى الجهات العليا او رفع شكوى جماعية او التهديد بذلك', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
          { id: 'r1-15', name: 'استغلال الرتبة القيادية لتحريض الزملاء على رفض الأوامر', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
          { id: 'r1-16', name: 'الاجتماع من اجل مناقشة أي أمور غير مشروعة تتعلق بالمجندين او المعهد وغيرها', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
          { id: 'r1-17', name: 'الاتلاف العمدي لأي من الأشياء التي يملكها المعهد او يستعملها', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
          { id: 'r1-18', name: 'ضبط ذخيرة او سلاح بحوزة الطالب بعد نهاية التمارين او الرماية بعد تسليم السلاح للمستودع', penalty: 'يحال إلى لجنة التحقيق', deduction: 6 },
          { id: 'r1-19', name: 'العيب في الذات الإلهية او سب الدين', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
          { id: 'r1-20', name: 'إتيان سلوك شائن يسئ إلى سمعة المعهد او شخصية المجند', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
          { id: 'r1-21', name: 'نشر صور بالزي العسكري', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
          { id: 'r1-22', name: 'إتيان أي فعل من المحظورات المنصوص عليها في هذه اللائحة', penalty: 'حجز أسبوعين', deduction: 6 },
          { id: 'r1-23', name: 'الاعتداء بالفعل او بالقول او الكتابة او باي وسيلة من وسائل التعبير الأخرى على زميل داخل المعهد او خارجه او التحريض على ذلك', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
          { id: 'r1-24', name: 'الغياب عن أداء الامتحانات او الاختبارات بدون عذر', penalty: 'أسبوع', deduction: 3 },
          { id: 'r1-25', name: 'الشروع في الهروب من المعهد او الحجز', penalty: 'أسبوعين', deduction: 6 },
          { id: 'r1-26', name: 'السفر الى خارج الدولة اثناء الاجازات بدون اذن من المعهد', penalty: 'أسبوع', deduction: 3 },
          { id: 'r1-27', name: 'عدم الإبلاغ عن الأمراض الوبائية', penalty: 'يحال إلى لجنة التحقيق', deduction: 6 },
          { id: 'r1-28', name: 'الخروج او الدخول من والى المعهد من غير المكان المخصص لذلك', penalty: 'أسبوع', deduction: 3 },
          { id: 'r1-29', name: 'عدم الالتزام بتعليمات امان السلاح او الرماية', penalty: 'أسبوعين', deduction: 6 },
          { id: 'r1-30', name: 'قيادة المركبات داخل المعهد', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
          { id: 'r1-31', name: 'حيازة كتب او مطبوعات تتضمن مفاهيم او ميول سياسيه او عقائدية تتعارض مع الدين والقيم والعادات القطرية', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
        ]
      },
      {
        id: 'd2',
        name: 'مخالفات الدرجة الثانية (نظام المبيت)',
        items: [
          { id: 'r2-1', name: 'تجاوز الاجازة بدون عذر مقبول لمدة تزيد على (48) ساعة', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
          { id: 'r2-2', name: 'تجاوز الاجازة بدون عذر مقبول لمدة تزيد على (24) ساعة ولا تتجاوز (48)', penalty: 'أسبوعين', deduction: 6 },
          { id: 'r2-3', name: 'تجاوز الاجازة بدون عذر مقبول لمدة تزيد على (60 دقيقة) ولا تتجاوز (24) ساعة', penalty: 'أسبوع', deduction: 3 },
          { id: 'r2-4', name: 'تجاوز الاجازة بدون عذر مقبول لمدة لا تتجاوز (60) دقيقة', penalty: 'يوم', deduction: 1.5 },
          { id: 'r2-5', name: 'التغيب عن الصلاة دون عذر مقبول او أي فعل يمثل انتهاكاً لحرمة شهر رمضان', penalty: 'أسبوع', deduction: 3 },
          { id: 'r2-6', name: 'التدخين او استخدام المكيفات المماثلة او ادواتها داخل المعهد او اثناء الزيارات والتمارين الخارجية', penalty: 'أسبوعين', deduction: 6 },
          { id: 'r2-7', name: 'لعب الورق داخل المعهد', penalty: 'أسبوعين', deduction: 6 },
          { id: 'r2-8', name: 'الاستخدام غير اللائق لشبكة الاتصالات ( الانترنت )', penalty: 'أسبوع', deduction: 3 },
          { id: 'r2-9', name: 'حيازة جهاز او اكثر من أجهزة الهاتف الجوال', penalty: 'أسبوعين', deduction: 6 },
          { id: 'r2-10', name: 'التغيب عن المحاضرات النظرية او البرامج التدريبية او أي من الواجبات الرسمية الأخرى بدون عذر مقبول', penalty: 'أسبوع', deduction: 3 },
          { id: 'r2-11', name: 'التسبب في الاضرار بالنفس بغرض الانقطاع عن العمل اليومي', penalty: 'أسبوعين', deduction: 6 },
          { id: 'r2-12', name: 'فقد او اتلاف أي بطاقة او شارة عسكرية رسمية او أي مهمات عسكرية أخرى في حيازته', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
          { id: 'r2-13', name: 'ادخال أشياء غير مصرح بها إلى المعهد', penalty: 'يوم', deduction: 1.5 },
          { id: 'r2-14', name: 'حيازة أدوات حادة يمكن ان تستخدم في إيذاء الآخرين', penalty: 'أسبوع', deduction: 3 },
          { id: 'r2-15', name: 'الكذب او الخداع او التحايل او التمارض للتهرب من مسؤولياته كطالب او من برنامج العمل اليومي', penalty: 'أسبوع', deduction: 3 },
          { id: 'r2-16', name: 'الذهاب الى المدينة اثناء مراجعة المستشفى في مركبة الإسعاف', penalty: 'أسبوع', deduction: 3 },
          { id: 'r2-17', name: 'مجازاة مجند اقدم لا يحمل رتبة قيادية لمجند احدث منه', penalty: 'أسبوع', deduction: 3 },
          { id: 'r2-18', name: 'التستر على أفعال او اقوال مخالفة الأوامر والتعليمات الخاصة بالمعهد', penalty: 'أسبوع', deduction: 3 },
          { id: 'r2-19', name: 'إتيان أي فعل مخالف للنظام او السلوك او الضبط والربط العسكري', penalty: 'أسبوع', deduction: 3 },
          { id: 'r2-20', name: 'عدم التقيد بالتسلسل العسكري', penalty: 'أسبوع', deduction: 3 },
          { id: 'r2-21', name: 'عدم ابلاغ المجند عن الحوادث التي تقع منه او عليه', penalty: '6 ساعات', deduction: 1 },
          { id: 'r2-22', name: 'سوء استخدام الصلاحيات من الرتب القيادية', penalty: '6 ساعات', deduction: 1 },
          { id: 'r2-23', name: 'حيازة أي من متعلقات الهاتف الجوال', penalty: 'أسبوع', deduction: 3 },
          { id: 'r2-24', name: 'حيازة أي من الآت اللهو', penalty: 'أسبوع', deduction: 3 },
          { id: 'r2-25', name: 'مجادلة المسؤولين او المدربين او أعضاء هيئة التدريس بهدف الاثارة او تعطيل سير البرامج او الدراسة', penalty: 'أسبوع', deduction: 3 },
          { id: 'r2-26', name: 'مجادلة الرتب القيادية بهدف الاثارة او تعطيل سير البرامج او الدراسة', penalty: 'يوم', deduction: 1.5 },
          { id: 'r2-27', name: 'التواجد في أماكن غير مصرح التواجد فيها او في غير الأوقات المقررة', penalty: '6 ساعات', deduction: 1 },
          { id: 'r2-28', name: 'ادخال او ارتداء مهمات او ملابس غير مقرر ارتدائها داخل المعهد', penalty: '6 ساعات', deduction: 1 },
          { id: 'r2-29', name: 'ارتداء الملابس العسكرية في الاماكن العامة والأسواق', penalty: 'أسبوع', deduction: 3 },
          { id: 'r2-30', name: 'طلب العيادة بعد انتهاء التكميل الصباحي او التخلف عن مقابلة الطبيب', penalty: '6 ساعات', deduction: 1 },
          { id: 'r2-31', name: 'التأخير في تقديم أوراق رسمية مطلوبة', penalty: 'حجز يوم (عند التسليم)', deduction: 1.5 },
          { id: 'r2-32', name: 'عدم وضع المجند سلاحه او مهماته التدريبية بنفسه في المكان المخصص', penalty: 'يوم', deduction: 1.5 },
          { id: 'r2-33', name: 'عدم نظافة السلاح او حملة بطريقة غير صحيحه', penalty: 'يوم', deduction: 1.5 },
          { id: 'r2-34', name: 'الهروب من الحصص او التدريب', penalty: 'أسبوع', deduction: 3 },
          { id: 'r2-35', name: 'عدم الإبلاغ عن المتغيبين من قبل الرتب القيادية', penalty: 'يوم', deduction: 1.5 },
          { id: 'r2-36', name: 'عدم ابلاغ المجند عن هويته عند وقوعه في المخالفة', penalty: 'أسبوع', deduction: 3 },
          { id: 'r2-37', name: 'الاتصال بضباط المعهد اثناء العطلات والاجازات فيما يخص العمل دون الرجوع الى الضابط المناوب', penalty: 'أسبوع', deduction: 3 },
        ]
      },
      {
        id: 'd3',
        name: 'مخالفات الدرجة الثالثة (نظام المبيت)',
        items: [
          { id: 'r3-1', name: 'عدم أداء التحية العسكرية او الإهمال في أدائها', penalty: 'أسبوع', deduction: 3 },
          { id: 'r3-2', name: 'عدم الاعتناء بالمظهر او الهندام', penalty: 'حصة تدريب', deduction: 0.5 },
          { id: 'r3-3', name: 'عدم ارتداء الرتب والشارات وغطاء الراس', penalty: '6 ساعات', deduction: 1 },
          { id: 'r3-4', name: 'مخالفة أنظمة وتعليمات اللباس المقرر', penalty: '6 ساعات', deduction: 1 },
          { id: 'r3-5', name: 'التجمع في السكن داخل الغرف او الممرات للمزاح او الضحك', penalty: '6 ساعات', deduction: 1 },
          { id: 'r3-6', name: 'ترك أي مهمات عسكرية أو شخصية في قاعات الدرس أو ميادين التدريب', penalty: '6 ساعات', deduction: 1 },
          { id: 'r3-7', name: 'حيازة أدوية وعقاقير غير مصروفة من الطبيب المختص بدون اذن', penalty: 'حصة تدريب', deduction: 0.5 },
          { id: 'r3-8', name: 'مغادرة المستشفى او العيادة دون اذن', penalty: 'يوم', deduction: 1.5 },
          { id: 'r3-9', name: 'عدم تلبية النداء او عدم تنفيذ نوبة النوم في الوقت محدد', penalty: 'حصة تدريب', deduction: 0.5 },
          { id: 'r3-10', name: 'عدم المبالاة', penalty: 'حصتين تدريب', deduction: 1 },
          { id: 'r3-11', name: 'وضع الايدي في الجيوب او تشابكها اثناء المسير او التواجد في الميادين وقاعات الدارسة والمكاتب والممرات', penalty: 'يوم', deduction: 1.5 },
          { id: 'r3-12', name: 'احداث الضوضاء او الإزعاج', penalty: '6 ساعات', deduction: 1 },
          { id: 'r3-13', name: 'النوم اثناء المحاضرات او أوقات المذاكرة او البرامج التدريبية', penalty: 'يوم', deduction: 1.5 },
          { id: 'r3-14', name: 'التكاسل اثناء المحاضرات او أوقات المذاكرة او البرامج التدريبية', penalty: 'حصتين تدريب', deduction: 1 },
          { id: 'r3-15', name: 'الاختلاط بمرتب المعهد او زواره بدون إذن', penalty: 'يوم', deduction: 1.5 },
          { id: 'r3-16', name: 'حيازة مبالغ مالية أكثر من المصرح بها', penalty: '6 ساعات', deduction: 1 },
          { id: 'r3-17', name: 'إخراج الأطعمة والمشروبات من الميز الى الثكنة بدون إذن', penalty: '6 ساعات', deduction: 1 },
          { id: 'r3-18', name: 'الإهمال في النظافة وترتيب الثكنة او الملابس', penalty: 'حصتين تدريب', deduction: 1 },
          { id: 'r3-19', name: 'عدم التزام المجند بالتعليمات الصادرة إليه', penalty: 'يوم', deduction: 1.5 },
          { id: 'r3-20', name: 'مزاولة الألعاب الرياضية في غير الزمان والمكان المحددين', penalty: '6 ساعات', deduction: 1 },
          { id: 'r3-21', name: 'الاستهتار بحرمة المسجد ومناسك الصلاة والعبادة', penalty: 'أسبوع', deduction: 3 },
          { id: 'r3-22', name: 'عدم السيطرة من الرتب القيادية على من هم في إمرتهم', penalty: '6 ساعات', deduction: 1 },
          { id: 'r3-23', name: 'أي سلوك غير لائق أثناء البرنامج اليومي بالمعهد او الزيارات الميدانية والمراجعات الطبية او في أي مكان يتواجد فيه المجند بصفة رسمية', penalty: 'يوم', deduction: 1.5 },
        ]
      }
    ]
  },
  // 2. 🆕 لائحة المستجدين والطلبة - نظام الثابت صبح (كاملة دون نقص)
{
  id: 'recruits_fixed',
  name: 'لائحة المستجدين (نظام الثابت صبح)',
  degrees: [
    {
      id: 'f1',
      name: 'مخالفات الدرجة الأولى (ثابت صبح)',
      items: [
        { id: 'f1-1', name: 'الغش في الامتحان ، أو محاولة الغش ، أو مساعدة طالب آخر على الغش', penalty: 'يحال إلى لجنة التحقيق', deduction: 6 },
        { id: 'f1-2', name: 'الحصول على اسئلة الامتحانات بطريقة غير رسمية ، او نشرها ، او توزيعها او المساعدة في ذلك او الاحتفاظ بورقة الإجابة بعد انتهاء موعد الامتحان', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
        { id: 'f1-3', name: 'القيام بإعداد بحوث او أوراق عمل عن طالب اخر', penalty: 'يحال إلى لجنة التحقيق', deduction: 6 },
        { id: 'f1-4', name: 'تقديم بحوث او أوراق عمل لأستاذ المقرر ليست من مجهود الطالب ذاته', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
        { id: 'f1-5', name: 'الإخلال بالنظام والتعليمات داخل قاعة الامتحان', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
        { id: 'f1-6', name: 'رفض الأوامر او التعليمات او التحريض على ذلك او منع الزملاء من تنفيذها بأي وسيلة', penalty: 'يحال إلى لجنة التحقيق', deduction: 6 },
        { id: 'f1-7', name: 'الاشتراك في شجار جماعي او التحريض عليه داخل المعهد او خارجه', penalty: 'يحال إلى لجنة التحقيق', deduction: 6 },
        { id: 'f1-8', name: 'الاعتداء بالفعل او بالقول او بالكتابة او باي وسيلة من وسائل التعبير الأخرى على أي من العاملين في المعهد', penalty: 'يحال إلى لجنة التحقيق', deduction: 6 },
        { id: 'f1-9', name: 'الفرار من المعهد او الهروب من الحجز', penalty: 'يحال إلى لجنة التحقيق', deduction: 6 },
        { id: 'f1-10', name: 'تعاطي او حيازة العقاقير الممنوعة او المشروبات الكحولية', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
        { id: 'f1-11', name: 'الأفعال التي تشكل احدى الجرائم المنصوص عليها في القوانين الجنائية', penalty: 'يحال إلى لجنة التحقيق', deduction: 6 },
        { id: 'f1-12', name: 'تحريض الزملاء او منعهم من الجلوس لأداء الامتحانات او حضور المحاضرات', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
        { id: 'f1-13', name: 'مشاهدة الأفلام او الصور الإباحية وغيرها عبر الوسائط الإلكترونية او حيازتها', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
        { id: 'f1-14', name: 'تقديم شكوى الى الجهات العليا او رفع شكوى جماعية او التهديد بذلك', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
        { id: 'f1-15', name: 'استغلال الرتبة القيادية لتحريض الزملاء على رفض الأوامر', penalty: 'يحال إلى لجنة التحقيق', deduction: 6 },
        { id: 'f1-16', name: 'الاجتماع من اجل مناقشة أي أمور غير مشروعة تتعلق بالمجندين او المعهد وغيرها', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
        { id: 'f1-17', name: 'الاتلاف العمدي لأي من الأشياء التي يملكها المعهد او يستعملها', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
        { id: 'f1-18', name: 'ضبط ذخيرة او سلاح بحوزة الطالب بعد نهاية التمارين او الرماية بعد تسليم السلاح للمستودع', penalty: 'يحال إلى لجنة التحقيق', deduction: 6 },
        { id: 'f1-19', name: 'العيب في الذات الإلهية او سب الدين', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
        { id: 'f1-20', name: 'إتيان سلوك شائن يسئ إلى سمعة المعهد او شخصية المجند', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
        { id: 'f1-21', name: 'نشر صور بالزي العسكري', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
        { id: 'f1-22', name: 'إتيان أي فعل من المحظورات المنصوص عليها في هذه اللائحة', penalty: '4 ايام', deduction: 6 },
        { id: 'f1-23', name: 'الاعتداء بالفعل او بالقول او الكتابة او باي وسيلة من وسائل التعبير الأخرى على زميل داخل المعهد او خارجه او التحريض على ذلك', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
        { id: 'f1-24', name: 'الغياب عن أداء الامتحانات او الاختبارات بدون عذر', penalty: 'يومين', deduction: 3 },
        { id: 'f1-25', name: 'الشروع في الهروب من المعهد او الحجز', penalty: '4 ايام', deduction: 6 },
        { id: 'f1-26', name: 'السفر الى خارج الدولة اثناء الاجازات بدون اذن من المعهد', penalty: 'يومين', deduction: 3 },
        { id: 'f1-27', name: 'عدم الإبلاغ عن الأمراض الوبائية', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
        { id: 'f1-28', name: 'الخروج او الدخول من والى المعهد من غير المكان المخصص لذلك', penalty: 'يومين', deduction: 3 },
        { id: 'f1-29', name: 'عدم الالتزام بتعليمات امان السلاح او الرماية', penalty: '4 ايام', deduction: 6 },
        { id: 'f1-30', name: 'قيادة المركبات داخل المعهد', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
        { id: 'f1-31', name: 'حيازة كتب او مطبوعات تتضمن مفاهيم او ميول سياسيه او عقائدية تتعارض مع الدين والقيم والعادات القطرية', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
      ]
    },
    {
      id: 'f2',
      name: 'مخالفات الدرجة الثانية (ثابت صبح)',
      items: [
        { id: 'f2-10', name: 'التغيب عن المحاضرات النظرية او البرامج التدريبية او أي من الواجبات الرسمية الأخرى بدون عذر مقبول', penalty: 'يومين', deduction: 3 },
        { id: 'f2-11', name: 'التسبب في الاضرار بالنفس بغرض الانقطاع عن العمل اليومي', penalty: 'يومين', deduction: 3 },
        { id: 'f2-12', name: 'فقد او اتلاف أي بطاقة او شارة عسكرية رسمية او أي مهمات عسكرية أخرى في حيازته', penalty: 'يحال الى لجنة التحقيق', deduction: 6 },
        { id: 'f2-13', name: 'ادخال أشياء غير مصرح بها الى المعهد', penalty: '6 ساعات', deduction: 1 },
        { id: 'f2-14', name: 'حيازة أدوات حادة يمكن ان تستخدم في إيذاء الآخرين', penalty: 'يومين', deduction: 3 },
        { id: 'f2-15', name: 'الكذب او الخداع او التحايل او التمارض للتهرب من مسؤولياته كطالب او من برنامج العمل اليومي', penalty: 'يومين', deduction: 3 },
        { id: 'f2-16', name: 'الذهاب الى المدينة اثناء مراجعة المستشفى في مركبة الإسعاف', penalty: 'يومين', deduction: 3 },
        { id: 'f2-17', name: 'مجازاة مجند اقدم لا يحمل رتبة قيادية لمجند احدث منه', penalty: 'يومين', deduction: 3 },
        { id: 'f2-18', name: 'التستر على أفعال او اقوال مخالفة الأوامر والتعليمات الخاصة بالمعهد', penalty: 'يومين', deduction: 3 },
        { id: 'f2-19', name: 'إتيان أي فعل مخالف للنظام او السلوك او الضبط والربط العسكري', penalty: 'يومين', deduction: 3 },
        { id: 'f2-20', name: 'عدم التقيد بالتسلسل العسكري', penalty: 'يومين', deduction: 3 },
        { id: 'f2-21', name: 'عدم ابلاغ المجند عن الحوادث التي تقع منه او عليه', penalty: '6 ساعات', deduction: 1 },
        { id: 'f2-22', name: 'سوء استخدام الصلاحيات من الرتب القيادية', penalty: '6 ساعات', deduction: 1 },
        { id: 'f2-23', name: 'حيازة أي من متعلقات الهاتف الجوال', penalty: 'اسبوع', deduction: 6 },
        { id: 'f2-24', name: 'حيازة أي من الآت اللهو', penalty: 'يومين', deduction: 3 },
        { id: 'f2-25', name: 'مجادلة المسؤولين او المدربين او أعضاء هيئة التدريس بهدف الاثارة او تعطيل سير البرامج او الدراسة', penalty: 'اسبوع', deduction: 6 },
        { id: 'f2-26', name: 'مجادلة الرتب القيادية بهدف الاثارة او تعطيل سير البرامج او الدراسة', penalty: 'يوم', deduction: 1.5 },
        { id: 'f2-27', name: 'التواجد في أماكن غير مصرح التواجد فيها او في غير الأوقات المقررة', penalty: '6 ساعات', deduction: 1 },
        { id: 'f2-28', name: 'ادخال او ارتداء مهمات او ملابس غير مقرر ارتدائها داخل المعهد', penalty: '6 ساعات', deduction: 1 },
        { id: 'f2-29', name: 'ارتداء الملابس العسكرية في الاماكن العامة والأسواق', penalty: 'يوم', deduction: 1.5 },
        { id: 'f2-30', name: 'طلب العيادة بعد انتهاء التكميل الصباحي او التخلف عن مقابلة الطبيب', penalty: '6 ساعات', deduction: 1 },
        { id: 'f2-31', name: 'التأخير في تقديم أوراق رسمية مطلوبة', penalty: '6 ساعات (عند التسليم)', deduction: 1 },
        { id: 'f2-32', name: 'عدم وضع المجند سلاحه او مهماته التدريبية بنفسه في المكان المخصص', penalty: '6 ساعات', deduction: 1 },
        { id: 'f2-33', name: 'عدم نظافة السلاح او حملة بطريقة غير صحيحه', penalty: '6 ساعات', deduction: 1 },
        { id: 'f2-34', name: 'الهروب من الحصص او التدريب', penalty: 'يومين', deduction: 3 },
        { id: 'f2-35', name: 'عدم الإبلاغ عن المتغيبين من قبل الرتب القيادية', penalty: '6 ساعات', deduction: 1 },
        { id: 'f2-36', name: 'عدم ابلاغ المجند عن هويته عند وقوعه في المخالفة', penalty: 'يومين', deduction: 3 },
        { id: 'f2-37', name: 'الاتصال بضباط المعهد اثناء العطلات والاجازات فيما يخص العمل دون الرجوع الى الضابط المناوب', penalty: 'يومين', deduction: 3 },
      ]
    },
    {
      id: 'f3',
      name: 'مخالفات الدرجة الثالثة (ثابت صبح)',
      items: [
        { id: 'f3-1', name: 'عدم أداء التحية العسكرية او الإهمال في أدائها', penalty: 'يومين', deduction: 3 },
        { id: 'f3-2', name: 'عدم الاعتناء بالمظهر او الهندام', penalty: 'حصة تدريب', deduction: 0.5 },
        { id: 'f3-3', name: 'عدم ارتداء الرتب والشارات وغطاء الراس', penalty: '6 ساعات', deduction: 1 },
        { id: 'f3-4', name: 'مخالفة أنظمة وتعليمات اللباس المقرر', penalty: '6 ساعات', deduction: 1 },
        { id: 'f3-5', name: 'التجمع في السكن داخل الغرف او الممرات للمزاح او الضحك', penalty: '6 ساعات', deduction: 1 },
        { id: 'f3-6', name: 'ترك أي مهمات عسكرية أو شخصية في قاعات الدرس أو ميادين التدريب', penalty: '6 ساعات', deduction: 1 },
        { id: 'f3-7', name: 'حيازة أدوية وعقاقير غير مصروفة من الطبيب المختص بدون اذن', penalty: 'حصة تدريب', deduction: 0.5 },
        { id: 'f3-8', name: 'مغادرة المستشفى او العيادة دون اذن', penalty: 'يوم', deduction: 1.5 },
        { id: 'f3-9', name: 'عدم تلبية النداء او عدم تنفيذ نوبة النوم في الوقت محدد', penalty: 'حصة تدريب', deduction: 0.5 },
        { id: 'f3-10', name: 'عدم المبالاة', penalty: 'حصتين تدريب', deduction: 1 },
        { id: 'f3-11', name: 'وضع الايدي في الجيوب او تشابكها اثناء المسير او التواجد في الميادين وقاعات الدارسة والمكاتب والممرات', penalty: 'يوم', deduction: 1.5 },
        { id: 'f3-12', name: 'احداث الضوضاء او الإزعاج', penalty: '6 ساعات', deduction: 1 },
        { id: 'f3-13', name: 'النوم اثناء المحاضرات او أوقات المذاكرة او البرامج التدريبية', penalty: 'يوم', deduction: 1.5 },
        { id: 'f3-14', name: 'التكاسل اثناء المحاضرات او أوقات المذاكرة او البرامج التدريبية', penalty: 'حصتين تدريب', deduction: 1 },
        { id: 'f3-15', name: 'الاختلاط بمرتب المعهد او زوارہ بدون إذن', penalty: 'يوم', deduction: 1.5 },
        { id: 'f3-16', name: 'حيازة مبالغ مالية أكثر من المصرح بها', penalty: '6 ساعات', deduction: 1 },
        { id: 'f3-17', name: 'إخراج الأطعمة والمشروبات من الميز الى الثكنة بدون إذن', penalty: '6 ساعات', deduction: 1 },
        { id: 'f3-18', name: 'الإهمال في النظافة وترتيب الثكنة او الملابس', penalty: 'حصتين تدريب', deduction: 1 },
        { id: 'f3-19', name: 'عدم التزام المجند بالتعليمات الصادرة إليه', penalty: 'يوم', deduction: 1.5 },
        { id: 'f3-20', name: 'مزاولة الألعاب الرياضية في غير الزمان والمكان المحددين', penalty: '6 ساعات', deduction: 1 },
        { id: 'f3-21', name: 'الاستهتار بحرمة المسجد ومناسك الصلاة والعبادة', penalty: 'يومين', deduction: 3 },
        { id: 'f3-22', name: 'عدم السيطرة من الرتب القيادية على من هم في إمرتهم', penalty: '6 ساعات', deduction: 1 },
        { id: 'f3-23', name: 'أي سلوك غير لائق أثناء البرنامج اليومي بالمعهد او الزيارات الميدانية والمراجعات الطبية او في أي مكان يتواجد فيه المجند بصفة رسمية', penalty: 'يوم', deduction: 1.5 },
      ]
    }
  ]
},
  {
    id: 'specialized',
    name: 'الدورات الحتمية والتخصصية',
    degrees: [
      {
        id: 's1',
        name: 'مخالفات الدرجة الأولى',
        items: [
          { id: 's1-1', name: 'عدم الإبلاغ عن الأمراض الوبائية', penalty: 'فصل من الدورة', deduction: 2 },
          { id: 's1-2', name: 'حيازة كتب أو مطبوعات تتضمن مفاهيم أو ميول سياسية أو عقائدية تتعارض مع الدين والقيم والعادات والتقاليد القطرية', penalty: 'فصل من الدورة', deduction: 2 },
          { id: 's1-3', name: 'إذا تضمِنت ورقة الإجابة أمراً ما يعد قذفاً أو أمراً مخالفاً للآداب العامة', penalty: 'فصل من الدورة', deduction: 2 },
          { id: 's1-4', name: 'مس الذات الإلهية أو سب الدين', penalty: 'فصل من الدورة', deduction: 2 },
          { id: 's1-5', name: 'تعاطي أو حيازة العقاقير الممنوعة أو المشروبات الكحولية', penalty: 'فصل من الدورة', deduction: 2 },
          { id: 's1-6', name: 'الاعتداء بالفعل أو باي وسيلة من وسائل التعبير الأخرى على أي من العاملين بالمعهد', penalty: 'فصل من الدورة', deduction: 2 },
          { id: 's1-7', name: 'الفرار من جهة التدريب او الدخول اليها بدون تصريح أو الهروب من الحجز', penalty: 'فصل من الدورة', deduction: 2 },
          { id: 's1-8', name: 'رفض الأوامر أو التعليمات أو منع الزملاء من تنفيذها باي وسيلة أو التحريض على ذلك', penalty: 'فصل من الدورة', deduction: 2 },
          { id: 's1-9', name: 'الاشتراك في تشاجر جماعي أو التحريض عليه داخل المعهد', penalty: 'الإحالة للتحقيق', deduction: 2 },
          { id: 's1-10', name: 'إتيان سلوك مشين يسئ الى سمعة الوزارة أو شخصية المتدرب', penalty: 'الإحالة للتحقيق', deduction: 2 },
          { id: 's1-11', name: 'الإتلاف العمدي لأي من الأشياء التي يملكها المعهد أو يستعملها المتدرب', penalty: 'الإحالة للتحقيق', deduction: 2 },
          { id: 's1-12', name: 'الإخلال بالنظام والتعليمات داخل قاعة الامتحان', penalty: 'الإحالة للتحقيق', deduction: 2 },
          { id: 's1-13', name: 'الحصول غير الرسمي على أوراق أسئلة الامتحانات أو نشرها أو توزيعها أو المساعدة في ذلك أو الاحتفاظ بورقة الإجابة بعد انتهاء موعد الامتحان', penalty: 'الإحالة للتحقيق', deduction: 2 },
          { id: 's1-14', name: 'ضبط أي ذخيره أو سلاح بحوزة المتدرب بعد نهاية التمارين أو الرماية بعد تسليم السلاح للمستودع', penalty: 'الإحالة للتحقيق', deduction: 2 },
          { id: 's1-15', name: 'التحريض من قبل الرتب القيادية أو المتدربين للزملاء على رفض الأوامر', penalty: 'الإحالة للتحقيق', deduction: 2 },
          { id: 's1-16', name: 'الإهمال في المحافظة على المهمات والعهدة والبطاقة والشارة العسكرية أو إخراجها من الأماكن المخصصة', penalty: 'حجز يوم داخلي', deduction: 2 },
          { id: 's1-17', name: 'الاستهتار بحرمة المسجد، ومناسك الصلاة والعبادة', penalty: 'حجز يوم داخلي', deduction: 2 },
          { id: 's1-18', name: 'تقديم شكوى الى الجهات العليا أو رفع شكوى جماعية أو التهديد بذلك', penalty: 'حجز يوم داخلي', deduction: 2 },
          { id: 's1-19', name: 'قيادة المركبة بسرعة تتجاوز السرعة المحددة داخل المعهد', penalty: 'حجز يوم داخلي', deduction: 2 },
          { id: 's1-20', name: 'مخالفة التعليمات المتعلقة باستخدام السلاح والذخيرة', penalty: 'حجز يوم داخلي', deduction: 2 },
          { id: 's1-21', name: 'حيازة أي من آلات اللهو', penalty: 'حجز يوم داخلي', deduction: 2 },
          { id: 's1-22', name: 'حيازة أدوات حاده يمكن أن تستخدم في إيذاء الآخرين', penalty: 'حجز يوم داخلي', deduction: 2 },
          { id: 's1-23', name: 'عدم الالتزام بتعليمات وشروط الأمن والسلامة المقررة للتدريب', penalty: 'حجز يوم داخلي', deduction: 2 },
          { id: 's1-24', name: 'الكذب أو الخداع أو التحايل أو التمارض للتهرب من مسؤولياته كمتدرب أو من برنامج العمل اليومي', penalty: 'حجز يوم داخلي', deduction: 2 },
          { id: 's1-25', name: 'التدخين او استخدام المكيفات المماثلة أو ادواتها داخل المعهد أو اثناء الزيارات والتمارين الخارجية', penalty: 'حجز يوم داخلي', deduction: 2 },
          { id: 's1-26', name: 'مجادلة المسؤولين أو المدربين أو أعضاء هيئة التدريس بهدف الإثارة أو تعطيل سير البرنامج', penalty: 'حجز يوم داخلي', deduction: 2 },
          { id: 's1-27', name: 'التسبب بالإضرار بالنفس بغرض الانقطاع عن برنامج العمل اليومي', penalty: 'حجز يوم داخلي', deduction: 2 },
          { id: 's1-28', name: 'إتيان أي فعل مخالف للنظام أو السلوك أو الضبط والربط العسكري', penalty: 'حجز يوم داخلي', deduction: 2 },
          { id: 's1-29', name: 'الإدلاء بمعلومات غير صحيحة لأي ممن له صفة رسمية في تدريبه أو إعاشته', penalty: 'حجز يوم داخلي', deduction: 2 },
          { id: 's1-30', name: 'تصوير المهمات أو العهدة العسكرية أو مرافق المعهد والميادين الخارجية أو صور بالزي العسكري', penalty: 'حجز يوم داخلي', deduction: 2 },
        ]
      },
      {
        id: 's2',
        name: 'مخالفات الدرجة الثانية',
        items: [
          { id: 's2-1', name: 'إدخال أشياء غير مصرح بها إلى المعهد', penalty: 'حجز (6) ساعات', deduction: 1 },
          { id: 's2-2', name: 'الذهاب إلى المدينة أثناء مراجعة المستشفى في مركبة الإسعاف أو أي وسيلة نقل أخرى', penalty: 'حجز (6) ساعات', deduction: 1 },
          { id: 's2-3', name: 'عدم أداء التحية أو الحركة العسكرية، أو الإهمال في أدائها', penalty: 'حجز (6) ساعات', deduction: 1 },
          { id: 's2-4', name: 'الخروج أو الدخول من والى المعهد من غير المكان المخصص لذلك', penalty: 'حجز (6) ساعات', deduction: 1 },
          { id: 's2-5', name: 'الهروب من البرامج التدريبية', penalty: 'حجز (6) ساعات', deduction: 1 },
          { id: 's2-6', name: 'عدم الإبلاغ عن الحوادث التي تقع منه أو عليه', penalty: 'حجز (6) ساعات', deduction: 1 },
          { id: 's2-7', name: 'الاختلاط بمرتب المعهد أو زواره بدون إذن', penalty: 'حجز (6) ساعات', deduction: 1 },
          { id: 's2-8', name: 'عدم التقيد بالتسلسل العسكري', penalty: 'حجز (6) ساعات', deduction: 1 },
          { id: 's2-9', name: 'مزاولة الألعاب الرياضية في غير الزمان والمكان المحددين', penalty: 'حجز (6) ساعات', deduction: 1 },
          { id: 's2-10', name: 'مغادرة المستشفى أو العيادة الداخلية/الخارجية دون إذن', penalty: 'حجز (6) ساعات', deduction: 1 },
          { id: 's2-11', name: 'النوم أثناء المحاضرات، أو أوقات المذاكرة أو البرامج التدريبية', penalty: 'حجز (6) ساعات', deduction: 1 },
          { id: 's2-12', name: 'عدم التقيد بإجراءات الوقاية والسلامة', penalty: 'حجز (6) ساعات', deduction: 1 },
          { id: 's2-13', name: 'عدم الوقوف بالمواقف المخصصة للدورة', penalty: 'حجز (6) ساعات', deduction: 1 },
          { id: 's2-14', name: 'تجاوز الطوابير العسكرية', penalty: 'حجز (6) ساعات', deduction: 1 },
          { id: 's2-15', name: 'استخدام الهاتف أو الأجهزة الالكترونية في الأوقات غير المصرح بها', penalty: 'حجز (6) ساعات', deduction: 1 },
          { id: 's2-16', name: 'عدم الالتزام بالأوامر والتعليمات', penalty: 'حجز (6) ساعات', deduction: 1 },
        ]
      },
      {
        id: 's3',
        name: 'مخالفات الدرجة الثالثة',
        items: [
          { id: 's3-1', name: 'عدم ارتداء الرتب أو الشارات وغطاء الرأس', penalty: 'حجز (3) ساعات', deduction: 0.5 },
          { id: 's3-2', name: 'مخالفة أنظمة وتعليمات اللباس المقرر', penalty: 'حجز (3) ساعات', deduction: 0.5 },
          { id: 's3-3', name: 'التمازح مع الزملاء', penalty: 'حجز (3) ساعات', deduction: 0.5 },
          { id: 's3-4', name: 'إحداث الضوضاء والإزعاج', penalty: 'حجز (3) ساعات', deduction: 0.5 },
          { id: 's3-5', name: 'إخراج الأطعمة والمشروبات من مطعم المتدربين إلى الثكنة والأماكن غير المخصصة للأكل بدون إذن', penalty: 'حجز (3) ساعات', deduction: 0.5 },
          { id: 's3-6', name: 'سوء استخدام الصلاحيات من الرتب القيادية من المتدربين', penalty: 'حجز (3) ساعات', deduction: 0.5 },
          { id: 's3-7', name: 'ترك أي مهمات عسكرية أو شخصية في قاعات الدراسة أو ميادين التدريب', penalty: 'حجز (3) ساعات', deduction: 0.5 },
          { id: 's3-8', name: 'عدم المبالاة، ووضع الايدي في الجيوب أو تشابكها أثناء المسير أو اثناء التواجد في الميادين والقاعات الدراسية والمكاتب والممرات', penalty: 'حجز (3) ساعات', deduction: 0.5 },
          { id: 's3-9', name: 'عدم السيطرة من الرتب القيادية على من هم في إمرته', penalty: 'حجز (3) ساعات', deduction: 0.5 },
          { id: 's3-10', name: 'مجادلة الرتب القيادية من زملائه', penalty: 'حجز (3) ساعات', deduction: 0.5 },
          { id: 's3-11', name: 'عدم الإبلاغ عن المتغيبين من قبل الرتب القيادية من زملائه', penalty: 'حجز (3) ساعات', deduction: 0.5 },
          { id: 's3-12', name: 'التواجد في أماكن غير مصرح بالتواجد فيها أو في غير الأوقات المقررة', penalty: 'حجز (3) ساعات', deduction: 0.5 },
          { id: 's3-13', name: 'إدخال او ارتداء مهمات أو ملابس غير مقرر ارتدائها داخل المعهد', penalty: 'حجز (3) ساعات', deduction: 0.5 },
          { id: 's3-14', name: 'عدم تنفيذ نوبة النوم بالوقت المحدد', penalty: 'حجز (3) ساعات', deduction: 0.5 },
          { id: 's3-15', name: 'الإهمال في النظافة وترتيب الثكنة أو الملابس', penalty: 'حجز (3) ساعات', deduction: 0.5 },
          { id: 's3-16', name: 'التكاسل في الطابور', penalty: 'حجز (3) ساعات', deduction: 0.5 },
          { id: 's3-17', name: 'الحركة أو عدم الانتظام في الطابور', penalty: 'حجز (3) ساعات', deduction: 0.5 },
          { id: 's3-18', name: 'التأخير في تقديم أوراق رسمية مطلوبة', penalty: 'حجز (3) ساعات', deduction: 0.5 },
          { id: 's3-19', name: 'عدم تثبيت الهوية المستلمة في الأوقات المحددة', penalty: 'حجز (3) ساعات', deduction: 0.5 },
          { id: 's3-20', name: 'عدم إبراز الهوية الشخصية عند الطلب', penalty: 'حجز (3) ساعات', deduction: 0.5 },
          { id: 's3-21', name: 'إغلاق أبواب الثكنة عند النوم', penalty: 'حجز (3) ساعات', deduction: 0.5 },
          { id: 's3-22', name: 'التأخير عن موعد بدء الطابور التدريبي', penalty: 'حجز (3) ساعات', deduction: 0.5 },
          { id: 's3-23', name: 'عدم الاعتناء بالمظهر او الهندام', penalty: 'حجز (3) ساعات', deduction: 0.5 },
          { id: 's3-24', name: 'طلب العيادة في الأوقات الغير محددة لها', penalty: 'حجز (3) ساعات', deduction: 0.5 },
        ]
      },
      {
        id: 'absent-lateness',
        name: 'مخالفات التأخير والغياب',
        items: [
          { id: 'al-1', name: 'تأخير: من دقيقة - أقل من نصف ساعة', penalty: 'حجز 1 ساعة', deduction: 0.25 },
          { id: 'al-2', name: 'تأخير: من نصف ساعة - أقل من ساعة', penalty: 'حجز 2 ساعة', deduction: 0.5 },
          { id: 'al-3', name: 'تأخير: من ساعة - أقل من ساعة ونصف', penalty: 'حجز 3 ساعات', deduction: 0.75 },
          { id: 'al-4', name: 'تأخير: من ساعة ونصف - أقل ساعتين', penalty: 'حجز 4 ساعات', deduction: 1 },
          { id: 'al-5', name: 'تأخير: من ساعتين - أقل من ساعتين ونصف', penalty: 'حجز 5 ساعات', deduction: 1.25 },
          { id: 'al-6', name: 'تأخير: من ساعتين ونصف - أقل من 3 ساعات', penalty: 'حجز 6 ساعات', deduction: 1.5 },
          { id: 'al-7', name: 'تأخير: من 3 ساعات فأعلى', penalty: 'حجز 7 ساعات', deduction: 2 },
          { id: 'al-8', name: 'غياب يوم بدون عذر', penalty: 'حجز 9 ساعات', deduction: 2 },
        ]
      }
    ]
  }
]);
  // الصلاحيات
  const MILITARY_STANDARDS_ROLES = ["owner", "manager", "admin"];
  const STANDARDS_ACCESS_ROLES = ["owner", "manager", "admin", "assistant_admin", "sports_officer"];
const fetchDisciplinaryRegulations = async () => {
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/disciplinary`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        if (res.ok) {
            const data = await res.json();
            // ملاحظة: هنا نحتاج لإعادة بناء الهيكل المتداخل إذا كانت قاعدة البيانات تعيدها مسطحة
            // لكن للتبسيط الآن، يمكنك الاعتماد على البيانات الافتراضية لحين برمجة "إعادة الهيكلة"
        }
    } catch (e) { console.error("Error fetching regulations"); }
};
useEffect(() => {
  if (showOnlyActive) {
    const currentTemp = trainingTemplates.find(t => t.id === activeTemplateId);
    if (currentTemp && !currentTemp.isActive) {
      // إذا كان القالب الحالي غير نشط، انتقل لأول قالب نشط متاح
      const firstActive = trainingTemplates.find(t => t.isActive);
      if (firstActive) setActiveTemplateId(firstActive.id);
    }
  }
}, [showOnlyActive]);
useEffect(() => {
    setMounted(true);

    // 1. جلب إعدادات النظام العامة
    fetchSettings();
    fetchMilitaryConfigs();
    fetchEngagementConfigs();
    fetchTrainingTemplates();
    fetchHideInactiveSetting();
    fetchDisciplinaryRegulations();
    fetchAllConfigs(); // 👈 أضفنا هذه الدالة هنا لجلب الاختبارات الشاملة (الجديدة)
    fetchMilitarySections();


    // 2. معالجة بيانات المستخدم وتحديثها
    try {
        const userStr = localStorage.getItem("user");
        const token = localStorage.getItem("token");

        if (userStr && token) {
            const localUser = JSON.parse(userStr);
            
            // أ. عرض البيانات المخزنة فوراً (للسرعة)
            setCurrentUser(localUser);
            setUserRole(localUser.role || null);
            setUserMilId(localUser.military_id);
            checkSavedSignature(localUser.military_id);

            // ب. الاتصال بالسيرفر لجلب أحدث الصلاحيات في الخلفية
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${localUser.id}`, {
                headers: { "Authorization": `Bearer ${token}` }
            })
            .then(res => {
                if (res.ok) return res.json();
                throw new Error("فشل تحديث البيانات");
            })
            .then(freshUser => {
                // تحديث الحالة في الصفحة فوراً
                setCurrentUser(freshUser);
                // تحديث الذاكرة المحلية للمرات القادمة
                localStorage.setItem("user", JSON.stringify(freshUser));
            })
            .catch(err => console.error("⚠️ لم يتم تحديث بيانات المستخدم تلقائياً:", err));
        }
    } catch (e) { 
        console.error(e);
    }
}, []);
useEffect(() => {
    const fetchFilters = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/filters-options`);
            if (res.ok) setFilterOptions(await res.json());
        } catch (e) { console.error("Error fetching filters") }
    }
    fetchFilters();
  }, []);
  const canManageMilitaryStandards = MILITARY_STANDARDS_ROLES.includes(userRole || "");
  const canAccessStandards = STANDARDS_ACCESS_ROLES.includes(userRole || "");
  const isDark = theme === 'dark';
const fetchHideInactiveSetting = async () => {
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings/features`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        if (res.ok) {
            const data = await res.json();
            const setting = data.find((s: any) => s.key === 'hide_inactive_templates');
            if (setting) setShowOnlyActive(setting.value === 'true' || setting.value === true);
        }
    } catch (e) {}
    setHideInactiveLoaded(true);
};
const fetchTrainingTemplates = async () => {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/training/templates`, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    });
    if (res.ok) {
      const data = await res.json();
      setTrainingTemplates(data);
      if (data.length > 0 && !activeTemplateId) {
        setActiveTemplateId(data[0].id);
      }
    }
  } catch (e) {
    console.error("Error fetching templates");
  }
};
  // --- 📡 الربط مع الباك إند: المعايير العسكرية ---

  const fetchMilitaryConfigs = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/configs`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) {
        const configs = await res.json();
        setMilitaryData(prev => prev.map(branch => ({
          ...branch,
          tests: configs
            .filter((c: any) => c.subject === branch.id)
            .map((c: any) => ({ id: c.id.toString(), name: c.exam_type, criteria: c.criteria }))
        })));
      }
    } catch (e) { console.error("Error fetching configs"); }
  };
const fetchAllConfigs = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/configs`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllExamConfigs(data);
      }
    } catch (e) { console.error("Error fetching all configs"); }
  };
const fetchMilitarySections = async () => {
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/military-sections`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        if (res.ok) {
            const data = await res.json();
            setMilitarySections(data);
        }
    } catch (e) { console.error("Error fetching military sections"); }
};

const handleCreateMilitarySection = async (name: string, key: string) => {
    setLoading(true);
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/military-sections`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify({ name, key, is_active: true })
        });
        if (res.ok) {
            toast.success("تم إضافة القسم بنجاح ✅");
            fetchMilitarySections(); // تحديث القائمة فوراً لتظهر في التابات
        } else {
            const err = await res.json();
            toast.error(err.detail || "فشل إضافة القسم");
        }
    } catch (e) {
        toast.error("خطأ في الاتصال بالسيرفر");
    } finally {
        setLoading(false);
    }
};
  const saveMilitaryConfigs = async () => {
    setLoading(true);
    try {
      const allConfigs: any[] = [];
      militaryData.forEach(branch => {
        branch.tests.forEach(test => {
          allConfigs.push({
            subject: branch.id,
            exam_type: test.name,
            criteria: test.criteria,
            is_active: true
          });
        });
      });

      for (const config of allConfigs) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/configs`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("token")}` 
          },
          body: JSON.stringify(config),
        });
      }
      toast.success("تم حفظ معايير التدريب العسكري بنجاح");
    } catch (e) { toast.error("فشل حفظ المعايير العسكرية"); } 
    finally { setLoading(false); }
  };
// 🚀 دالة حفظ معايير الاشتباك الجديدة
const saveEngagementConfigs = async () => {
  setLoading(true);
  try {
    // نقوم بإرسال البيانات كما هي موجودة في الـ State
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/engagement-configs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify(engagementData) 
    });

    if (res.ok) {
      toast.success("تم حفظ معايير الاشتباك بنجاح");
      await fetchEngagementConfigs(); // تحديث الواجهة مجدداً
    } else {
      toast.error("حدث خطأ أثناء حفظ المعايير");
    }
  } catch (e) {
    toast.error("فشل الاتصال بالسيرفر");
  } finally {
    setLoading(false);
  }
};
  // --- دوال التحكم في الواجهة (المعايير) ---

  const addMilitaryTest = (branchId: string) => {
    const newTest: MilitaryTest = {
      id: `test-${Date.now()}`,
      name: 'اختبار جديد',
      criteria: [{ id: `crit-${Date.now()}`, name: 'معيار 1', max: 10 }]
    };
    setMilitaryData(prev => prev.map(b => b.id === branchId ? { ...b, tests: [...b.tests, newTest] } : b));
  };

  const deleteMilitaryTest = (branchId: string, testId: string) => {
  // إذا كان الاختبار محفوظاً في قاعدة البيانات (ID رقمي)
  if (!testId.startsWith('test-') && !testId.startsWith('temp-')) {
    setTestToDelete({ branchId, testId });
    setIsDeleteDialogOpen(true); // نفتح نافذة التأكيد الجميلة
  } else {
    // إذا كان اختباراً جديداً لم يُحفظ بعد، نحذفه فوراً من الواجهة
    setMilitaryData(prev => prev.map(b => 
      b.id === branchId ? { ...b, tests: b.tests.filter(t => t.id !== testId) } : b
    ));
  }
};

const confirmPermanentDelete = async () => {
  if (!testToDelete) return;
  
  setLoading(true);
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/configs/${testToDelete.testId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    });

    const data = await res.json(); // 👈 سحب البيانات القادمة من السيرفر

    if (res.ok) {
      setAllExamConfigs(prev => prev.filter(conf => conf.id.toString() !== testToDelete.testId));
      toast.success("تم حذف الاختبار بنجاح ✅");
      setIsDeleteDialogOpen(false);
    } else {
      // 🟢 هنا التعديل: إظهار الرسالة التفصيلية التي أرسلها الباك إند
      toast.error(data.detail || "تعذر الحذف لوجود ارتباطات");
      // ملاحظة: لا نغلق النافذة هنا لكي يقرأ المستخدم الرسالة
    }
  } catch (e) {
    toast.error("حدث خطأ في الاتصال بالسيرفر");
  } finally {
    setLoading(false);
    // إغلاق النافذة فقط في حال عدم وجود خطأ أو بعد القراءة
  }
};
  const updateTestName = (branchId: string, testId: string, newName: string) => {
    setMilitaryData(prev => prev.map(b => b.id === branchId ? { ...b, tests: b.tests.map(t => t.id === testId ? { ...t, name: newName } : t) } : b));
  };

  const addCriterion = (branchId: string, testId: string) => {
    setMilitaryData(prev => prev.map(b => b.id === branchId ? { ...b, tests: b.tests.map(t => t.id === testId ? { ...t, criteria: [...t.criteria, { id: `c-${Date.now()}`, name: '', max: 0 }] } : t) } : b));
  };

  const updateCriterion = (branchId: string, testId: string, critId: string, field: 'name' | 'max', value: any) => {
    setMilitaryData(prev => prev.map(b => b.id === branchId ? { ...b, tests: b.tests.map(t => t.id === testId ? { ...t, criteria: t.criteria.map(c => c.id === critId ? { ...c, [field]: field === 'max' ? Number(value) : value } : c) } : t) } : b));
  };

  const deleteCriterion = (branchId: string, testId: string, critId: string) => {
    setMilitaryData(prev => prev.map(b => b.id === branchId ? { ...b, tests: b.tests.map(t => t.id === testId ? { ...t, criteria: t.criteria.filter(c => c.id !== critId) } : t) } : b));
  };
// 🆕 دوال الاشتباك
const fetchEngagementConfigs = async () => {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/engagement-configs`, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data) && data.length > 0) {
        // 🟢 التعديل: ترتيب التبويبات يدوياً لضمان بقاء "الفني" كأول عنصر
        const fixedOrder = data.sort((a: any, b: any) => {
          if (a.key === 'technical') return -1;
          if (b.key === 'technical') return 1;
          return 0;
        });

        const formattedData = fixedOrder.map((item: any) => ({
          ...item,
          id: item.key 
        }));
        setEngagementData(formattedData);
      }
    }
  } catch (e) { 
    console.error("Error fetching engagement configs", e); 
  }
};
const addEngagementAxis = (tabId: string) => {
  const newAxis: EngagementAxis = {
    id: `axis-${Date.now()}`,
    name: 'محور جديد',
    is_active: true, // الحالة النشطة افتراضياً
    criteria: [{ id: `crit-${Date.now()}`, name: 'معيار 1', max: 0, stations: [] }] 
  };
  
  // نحدث البيانات مع الحفاظ على ترتيب التبويبات الحالي
  setEngagementData(prev => prev.map(t => 
    t.id === tabId ? { ...t, axes: [...t.axes, newAxis] } : t
  ));
};

const updateAxisName = (tabId: string, axisId: string, newName: string) => {
  setEngagementData(prev => prev.map(t => t.id === tabId ? { ...t, axes: t.axes.map(a => a.id === axisId ? { ...a, name: newName } : a) } : t));
};

const addEngCriterion = (tabId: string, axisId: string) => {
  setEngagementData(prev => prev.map(t => t.id === tabId ? { 
    ...t, 
    axes: t.axes.map(a => a.id === axisId ? { 
      ...a, 
      // 🛠️ تأكد أن stations هنا مصفوفة []
      criteria: [...a.criteria, { id: `ec-${Date.now()}`, name: '', max: 0, stations: [] }] 
    } : a) 
  } : t));
};

const updateEngCriterion = (tabId: string, axisId: string, critId: string, field: keyof EngagementCriterion, value: any) => {
  setEngagementData(prev => prev.map(t => t.id === tabId ? { ...t, axes: t.axes.map(a => a.id === axisId ? { ...a, criteria: a.criteria.map(c => c.id === critId ? { ...c, [field]: field === 'max' ? Number(value) : value } : c) } : a) } : t));
};

const deleteEngAxis = (tabId: string, axisId: string) => {
  setEngagementData(prev => prev.map(t => t.id === tabId ? { ...t, axes: t.axes.filter(a => a.id !== axisId) } : t));
};

// 🆕 إضافة محطة جديدة فارغة لمعيار محدد
const addStationToCriterion = (tabId: string, axisId: string, critId: string) => {
  setEngagementData(prev => prev.map(t => t.id === tabId ? {
    ...t, axes: t.axes.map(a => a.id === axisId ? {
      ...a, criteria: a.criteria.map(c => c.id === critId ? {
        ...c, stations: [...c.stations, ""] // إضافة عنصر فارغ للمصفوفة
      } : c)
    } : a)
  } : t));
};

// 🆕 تحديث نص محطة معينة
const updateStationText = (tabId: string, axisId: string, critId: string, sIdx: number, value: string) => {
  setEngagementData(prev => prev.map(t => t.id === tabId ? {
    ...t, axes: t.axes.map(a => a.id === axisId ? {
      ...a, criteria: a.criteria.map(c => c.id === critId ? {
        ...c, stations: c.stations.map((s, i) => i === sIdx ? value : s)
      } : c)
    } : a)
  } : t));
};

// 🆕 حذف محطة معينة
const deleteStation = (tabId: string, axisId: string, critId: string, sIdx: number) => {
  setEngagementData(prev => prev.map(t => t.id === tabId ? {
    ...t, axes: t.axes.map(a => a.id === axisId ? {
      ...a, criteria: a.criteria.map(c => c.id === critId ? {
        ...c, stations: c.stations.filter((_, i) => i !== sIdx)
      } : c)
    } : a)
  } : t));
};
  // --- 🔒 الربط مع الباك إند: الأمان والتوقيع ---

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) return toast.error("يرجى ملء كافة الحقول");
    if (newPassword !== confirmPassword) return toast.error("كلمة المرور الجديدة غير متطابقة");
    
    setIsUpdatingPassword(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/change-password`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json", 
            "Authorization": `Bearer ${localStorage.getItem("token")}` 
        },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.success("تم تحديث كلمة المرور بنجاح");
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      } else {
        toast.error(data.detail || "حدث خطأ أثناء التحديث");
      }
    } catch (e) { toast.error("فشل الاتصال بالخادم"); } 
    finally { setIsUpdatingPassword(false); }
  };

  const saveSettings = async () => {
    setLoading(true)
    try {
      const payload = { 
          ...calcSettings, 
          distance: parseInt(calcSettings.distance), 
          pass_rate: Number(calcSettings.pass_rate), 
          base_score: Number(calcSettings.base_score), 
          rows_per_page: parseInt(calcSettings.rows_per_page) 
      }
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings`, { 
          method: "POST", 
          headers: { 
              "Content-Type": "application/json",
              // 🛡️ إضافة الحماية لضمان عدم تلاعب أي مستخدم بمعايير النجاح والرسوب
              "Authorization": `Bearer ${localStorage.getItem("token")}`
          }, 
          body: JSON.stringify(payload) 
      })
      if (res.ok) toast.success("تم حفظ التفضيلات والرياضي بنجاح")
      else toast.error("فشل حفظ الإعدادات، ربما لا تملك الصلاحية الكافية")
    } catch (e) {
      toast.error("خطأ في الاتصال بالسيرفر")
    } finally { setLoading(false) }
}
const saveDynamicConfig = async (config: any) => {
    setLoading(true);
    try {
       const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/configs`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("token")}` 
          },
          body: JSON.stringify(config),
       });
       if(res.ok) {
           toast.success("تم الحفظ بنجاح");
           fetchAllConfigs(); // تحديث القائمة
       }
    } catch(e) { toast.error("فشل الحفظ"); }
    finally { setLoading(false); }
  };
  const saveSignature = async () => {
    // 1. التحقق من أن اللوحة ليست فارغة
    if (sigPad.current.isEmpty()) return toast.warning("ارسم التوقيع أولاً");
    
    setLoading(true);
    
    const canvas = sigPad.current.getCanvas();
    
    // 2. تحويل الرسم إلى ملف صورة
    canvas.toBlob(async (blob: any) => {
        const formData = new FormData();
        formData.append('file', blob, 'signature.png');
        formData.append('military_id', userMilId!); 
        
        try {
            // 3. الإرسال إلى الباك إند
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/upload-signature`, { 
                method: "POST", 
                // 🛡️ إضافة الحماية هنا لربط عملية الرفع بهويتك الحقيقية
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                },
                body: formData 
            });

            if (res.ok) { 
                toast.success("تم حفظ التوقيع بنجاح"); 
                // 🟢 4. تحديث رابط الصورة فوراً لإظهار التوقيع الجديد
                checkSavedSignature(userMilId!); 
            } else {
                const err = await res.json();
                toast.error(err.detail || "فشل حفظ التوقيع");
            }
        } catch (e) {
            toast.error("خطأ في الاتصال بالخادم");
        } finally {
            setLoading(false);
        }
    });
}

 const checkSavedSignature = (milId: string | null) => {
    if (!milId) return;
    // رابط المشروع الخاص بك
    const supabaseUrl = "https://cynkoossuwenqxksbdhi.supabase.co";
    // رابط الصورة الافتراضي (PNG)
    const url = `${supabaseUrl}/storage/v1/object/public/Signatures/${milId}.png`;
    
    // نضيف وقت عشوائي للرابط لإجبار المتصفح على تحديث الصورة فوراً بعد الحفظ
    setSavedSignature(`${url}?t=${new Date().getTime()}`);
  }

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings`)
      if (res.ok) {
        const data = await res.json()
        setCalcSettings({ ...data, distance: data.distance.toString(), rows_per_page: (data.rows_per_page || 10).toString() })
      }
    } catch (error) { }
  }

 const deleteSignature = async () => {
    if(!userMilId) return;
    
    setLoading(true);
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/delete-signature/${userMilId}`, { 
            method: "DELETE",
            // 🛡️ إضافة الحماية هنا لضمان أن صاحب التوقيع أو المدير فقط هو من يحذف
            headers: {
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            }
        });
        
        if (res.ok) {
            setSavedSignature(null); 
            sigPad.current.clear(); 
            toast.success("تم حذف التوقيع"); 
        } else {
            toast.error("فشل الحذف");
        }
    } catch (e) {
        toast.error("خطأ في الاتصال");
    } finally {
        setLoading(false);
    }
}
const createNewTemplate = () => {
    const newTemplate: TrainingTemplate = {
      id: `temp-${Date.now()}`,
      name: 'جدول تدريبي جديد',
      courseId: '',
      batchId: '',
      isActive: false,
      schedule: weekDays.map(day => ({
        dayName: day,
        sessions: Array.from({ length: 5 }).map((_, i) => ({ // افتراضياً 5 حصص
          id: `sess-${day}-${i}-${Date.now()}`,
          name: '',
          type: 'other',
          startTime: '00:00',
          endTime: '00:00'
        }))
      }))
    };
    setTrainingTemplates([...trainingTemplates, newTemplate]);
    setActiveTemplateId(newTemplate.id);
    setIsEditingTemplate(true);
  };

  // 🆕 تحديث بيانات حصة معينة
  const updateSession = (templateId: string, dayName: string, sessIdx: number, field: keyof TrainingSession, value: string) => {
    setTrainingTemplates(prev => prev.map(t => {
      if (t.id !== templateId) return t;
      return {
        ...t,
        schedule: t.schedule.map(d => {
          if (d.dayName !== dayName) return d;
          const newSessions = [...d.sessions];
          newSessions[sessIdx] = { ...newSessions[sessIdx], [field]: value };
          return { ...d, sessions: newSessions };
        })
      };
    }));
  };

  // 🆕 حفظ القوالب (محاكاة اتصال بالباك إند)
  
  // 🆕 دالة إضافة عمود حصة جديد لكل الأيام
  const addSessionColumn = (templateId: string) => {
    setTrainingTemplates(prev => prev.map(t => {
      if (t.id !== templateId) return t;
      
      // نحدد رقم الحصة الجديدة بناءً على عدد الحصص في أول يوم
      const newSessionIndex = t.schedule[0].sessions.length;

      return {
        ...t,
        schedule: t.schedule.map(day => ({
          ...day,
          // نضيف حصة جديدة لنهاية مصفوفة الحصص لهذا اليوم
          sessions: [...day.sessions, {
            id: `sess-${day.dayName}-${newSessionIndex}-${Date.now()}`,
            name: '',
            type: 'other',
            startTime: '00:00',
            endTime: '00:00'
          }]
        }))
      };
    }));
  };

  // 🆕 دالة إضافة يوم جديد (الجمعة/السبت)
  const addDayRow = (templateId: string) => {
    setTrainingTemplates(prev => prev.map(t => {
      if (t.id !== templateId) return t;

      const currentDays = t.schedule.map(d => d.dayName);
      let nextDay = "";
      
      // تحديد اليوم التالي تلقائياً
      if (!currentDays.includes("الجمعة")) nextDay = "الجمعة";
      else if (!currentDays.includes("السبت")) nextDay = "السبت";
      else {
        toast.info("تم إضافة كافة أيام الأسبوع بالفعل");
        return t;
      }

      // عدد الحصص يجب أن يطابق الأيام الموجودة
      const sessionCount = t.schedule[0].sessions.length;

      return {
        ...t,
        schedule: [...t.schedule, {
          dayName: nextDay,
          sessions: Array.from({ length: sessionCount }).map((_, i) => ({
            id: `sess-${nextDay}-${i}-${Date.now()}`,
            name: '',
            type: 'other',
            startTime: '00:00',
            endTime: '00:00'
          }))
        }]
      };
    }));
  };

  // 🆕 دالة الحفظ مع التحقق الإلزامي
 const saveTrainingTemplates = async () => {
    const currentTemplate = trainingTemplates.find(t => t.id === activeTemplateId);
    
    if (!currentTemplate?.courseId) {
        toast.error("يرجى اختيار الدورة أولاً");
        return;
    }

    // 🟢 الحل الذكي: التحقق هل الدورة المختارة "فعلياً" تملك دفعات في قاعدة البيانات؟
    // سنقوم بتصفية قائمة الدفعات العالمية لنرى هل يوجد منها ما يخص هذه الدورة
    // ملاحظة: بما أن filterOptions.batches قائمة مسطحة، سنسمح بالحفظ إذا لم يختر المستخدم دفعة 
    // إلا إذا كانت الدورة مشهورة بوجود دفعات (مثل المستجدين والدبلوم)
    
    const isSpecificCourseWithBatches = ["شرطة مستجدين", "طلبة الدبلوم"].some(c => 
        currentTemplate.courseId.includes(c)
    );

    // إذا كانت دورة مستجدين أو دبلوم ولم يحدد الدفعة -> نمنعه
    // أما الدورات الأخرى (تخصصية/حتمية) نسمح له بالحفظ حتى لو الدفعة فارغة
    if (isSpecificCourseWithBatches && !currentTemplate.batchId) {
        toast.error("تنبيه: دورات المستجدين والدبلوم تتطلب تحديد الدفعة", {
            icon: <AlertTriangle className="text-orange-500" />
        });
        return;
    }

    setLoading(true);

    const isNew = currentTemplate.id.startsWith('temp-');
    const actionText = isNew ? "إنشاء جدول جديد" : "تحديث بيانات الجدول";
    
    // 🟢 تعديل عرض المعلومات: إذا لا توجد دفعة، لا نظهر كلمة "دفعة فارغة"
    const batchInfo = currentTemplate.batchId ? ` - دفعة ${currentTemplate.batchId}` : " (دورة بدون دفعة)";
    const courseInfo = `${currentTemplate.courseId}${batchInfo}`;

    const savePromise = fetch(`${process.env.NEXT_PUBLIC_API_URL}/training/templates/save`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(currentTemplate)
    }).then(async (res) => {
        if (!res.ok) throw new Error();
        const result = await res.json();
        await fetchTrainingTemplates(); 
        setIsEditingTemplate(false);
        return result;
    });

    toast.promise(savePromise, {
        loading: `جاري ${actionText} لـ ${courseInfo}...`,
        success: () => `تم حفظ البرنامج لـ ${courseInfo} بنجاح ✅`,
        error: () => `عذراً، تعذر حفظ التعديلات على برنامج ${currentTemplate.courseId} ❌`,
    });

    setLoading(false);
};
const handleDeleteTemplate = async (templateId: string) => {
    // 🛡️ لا نسمح بحذف "id" يبدأ بـ temp (لم يحفظ بعد) مباشرة من الواجهة
    if (templateId.startsWith('temp-')) {
        setTrainingTemplates(prev => prev.filter(t => t.id !== templateId));
        toast.success("تم إزالة المسودة");
        return;
    }

    const deletePromise = fetch(`${process.env.NEXT_PUBLIC_API_URL}/training/templates/${templateId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    }).then(async (res) => {
        if (!res.ok) throw new Error();
        await fetchTrainingTemplates();
        return res.json();
    });

    toast.promise(deletePromise, {
        loading: 'جاري حذف الجدول نهائياً...',
        success: 'تم حذف الجدول بنجاح 🗑️',
        error: 'فشل الحذف، قد يكون الجدول مرتبطاً بسجلات أخرى ❌',
    });
};
  const clearSignature = () => sigPad.current.clear()
// 🟢 حذف عمود (حصة) محدد من كافة الأيام
const removeSessionColumn = (templateId: string, sessIdx: number) => {
  setTrainingTemplates(prev => prev.map(t => {
    if (t.id !== templateId) return t;
    return {
      ...t,
      schedule: t.schedule.map(day => ({
        ...day,
        // فلترة الحصص لاستبعاد الحصة ذات الترتيب المحدد
        sessions: day.sessions.filter((_, i) => i !== sessIdx)
      }))
    };
  }));
  toast.info(`تم حذف العمود (الحصة رقم ${sessIdx + 1})`);
};

// 🟢 حذف يوم (صف) محدد من الجدول
const removeDayRow = (templateId: string, dayName: string) => {
  setTrainingTemplates(prev => prev.map(t => {
    if (t.id !== templateId) return t;
    // منع حذف كل الأيام (يجب بقاء يوم واحد على الأقل)
    if (t.schedule.length <= 1) {
      toast.error("لا يمكن حذف كافة الأيام، يجب بقاء يوم واحد على الأقل");
      return t;
    }
    return {
      ...t,
      schedule: t.schedule.filter(day => day.dayName !== dayName)
    };
  }));
};
// 🔍 تصفية القوالب: إذا كان الخيار مفعلاً، نظهر النشط فقط، وإلا نظهر الكل
const displayedTemplates = trainingTemplates.filter(t => !showOnlyActive || t.isActive);

  if (!mounted) return null


if (!mounted) return null
  return (
    <ProtectedRoute allowedRoles={["owner", "manager", "admin", "assistant_admin", "sports_officer", "sports_supervisor", "sports_trainer","military_officer", "military_supervisor", "military_trainer"]}>
      <div className="max-w-6xl mx-auto pb-10 md:pb-24" dir="rtl"> {/* زيادة العرض لـ max-w-6xl */}
        <Tabs defaultValue="security" className="w-full" dir="rtl">
          
          <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md pt-6 pb-4 border-b mb-6 px-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-slate-900 rounded-lg text-white"><Settings2 className="w-6 h-6" /></div>
            <h1 className="text-2xl font-bold">إعدادات النظام</h1>
          </div>

          <TabsList className="grid w-full h-auto grid-cols-4 md:grid-cols-8 gap-2 bg-slate-200/50 p-1 rounded-xl">
    
    {/* 1. معايير العسكري */}
    {(["owner", "manager", "admin"].includes(userRole || "") || 
      currentUser?.extra_permissions?.military_standards || // 🟢 فحص الكائن (الجديد)
      (Array.isArray(currentUser?.extra_permissions) && currentUser.extra_permissions.includes("military_standards"))) && ( // 🔵 فحص المصفوفة (للتوافق)
        <TabsTrigger value="mil-standards" className="text-[10px] md:text-xs py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            معايير العسكري
        </TabsTrigger>
    )}

    {/* 2. معايير اللياقة */}
    {(["owner", "manager", "admin"].includes(userRole || "") || 
      currentUser?.extra_permissions?.fitness_standards || 
      (Array.isArray(currentUser?.extra_permissions) && currentUser.extra_permissions.includes("fitness_standards"))) && (
        <TabsTrigger value="standards" className="text-[10px] md:text-xs py-2.5 data-[state=active]:bg-green-600 data-[state=active]:text-white">
            معايير اللياقة
        </TabsTrigger>
    )}

    {/* 3. معايير الاشتباك */}
    {(["owner", "manager", "admin"].includes(userRole || "") || 
      currentUser?.extra_permissions?.combat_standards || 
      (Array.isArray(currentUser?.extra_permissions) && currentUser.extra_permissions.includes("combat_standards"))) && (
        <TabsTrigger value="engagement" className="text-[10px] md:text-xs py-2.5 data-[state=active]:bg-orange-600 data-[state=active]:text-white">
            معايير الاشتباك
        </TabsTrigger>
    )}

    {/* 4. لائحة المخالفات */}
    {(["owner", "manager", "admin"].includes(userRole || "") || 
      currentUser?.extra_permissions?.disciplinary_regulations || 
      (Array.isArray(currentUser?.extra_permissions) && currentUser.extra_permissions.includes("disciplinary_regulations"))) && (
        <TabsTrigger value="disciplinary" className="text-[10px] md:text-xs py-2.5 data-[state=active]:bg-amber-700 data-[state=active]:text-white">
            لائحة المخالفات
        </TabsTrigger>
    )}

    {/* 5. البرنامج التدريبي */}
    {(["owner", "manager", "admin"].includes(userRole || "") || 
      currentUser?.extra_permissions?.training_program || 
      (Array.isArray(currentUser?.extra_permissions) && currentUser.extra_permissions.includes("training_program"))) && (
        <TabsTrigger value="training-schedule" className="text-[10px] md:text-xs py-2.5 data-[state=active]:bg-amber-500 data-[state=active]:text-white">
            البرنامج التدريبي
        </TabsTrigger>
    )}
    <TabsTrigger value="appearance" className="text-[10px] md:text-xs py-2.5 data-[state=active]:bg-cyan-700 data-[state=active]:text-white transition-all">
        المظهر
    </TabsTrigger>

    <TabsTrigger value="signature" className="text-[10px] md:text-xs py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all">
        التوقيع
    </TabsTrigger>

    <TabsTrigger value="security" className="text-[10px] md:text-xs py-2.5 data-[state=active]:bg-red-600 data-[state=active]:text-white transition-all">
        الأمان
    </TabsTrigger>
</TabsList>
        </div>

      
{/* 🔵 تاب معايير العسكري المطور (دعم الأقسام الديناميكية مع زر الإضافة) */}
<TabsContent value="mil-standards">
  {(["owner", "manager", "admin"].includes(userRole || "") || 
    currentUser?.extra_permissions?.military_standards || 
    (Array.isArray(currentUser?.extra_permissions) && currentUser?.extra_permissions?.includes("military_standards"))) ? (
    <Card className="border-t-4 border-t-blue-600 shadow-xl" >
      <CardHeader className="text-right flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <CardTitle className="text-blue-700 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6" /> إدارة اختبارات التدريب العسكري
          </CardTitle>
          <CardDescription>أضف أقسام الاختبارات الرئيسية، والأنواع الفرعية لكل قسم.</CardDescription>
        </div>

        {/* 🟢 زر (+) السحري لإضافة أقسام رئيسية (رماية، أسلحة...) مباشرة من الواجهة */}
        {/* 🛡️ لا يظهر الزر إلا إذا كان المستخدم هو المالك */}
{mounted && userRole === "owner" && (
  <Button 
    variant="outline" 
    size="sm" 
    onClick={() => setIsAddSectionOpen(true)}
    className="h-8 gap-1 text-[10px] font-bold border-[#c5b391] text-[#8a7a5b] hover:bg-[#c5b391]/10"
  >
    <Plus className="w-3 h-3" />
    إضافة قسم رئيسي
  </Button>
)}
      </CardHeader>
      
      <CardContent>
        {/* فحص إذا كانت الأقسام لا تزال فارغة من قاعدة البيانات */}
        {militarySections.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 bg-slate-50 rounded-2xl border-2 border-dashed">
            <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
            <p className="font-bold text-slate-500 text-center">لا توجد أقسام عسكرية مضافة حالياً في قاعدة البيانات.</p>
            <p className="text-xs text-slate-400 mt-2">استخدم زر "إضافة قسم رئيسي" بالأعلى للبدء.</p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-6 min-h-[500px]">
            {/* القائمة الجانبية الديناميكية */}
            <div className="w-full md:w-1/3 border rounded-xl bg-slate-50 flex flex-col overflow-hidden">
              <Tabs defaultValue={militarySections[0]?.key} className="w-full h-full flex flex-col">
                {/* التبويبات العلوية - توليد تلقائي بناءً على الأقسام الموجودة في الداتابيز */}
                <TabsList className="w-full grid grid-cols-2 lg:grid-cols-3 rounded-none bg-slate-200 h-auto p-1">
                  {militarySections.map(s => (
                    <TabsTrigger key={s.id} value={s.key} className="text-[10px] font-bold py-2 truncate">
                      {s.name.split(' ')[0]}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {militarySections.map((section) => (
                  <TabsContent key={section.id} value={section.key} className="p-3 space-y-3 mt-0 flex-1 overflow-y-auto">
                    {/* حقل إضافة اختبار جديد داخل القسم (رماية، أسلحة، إلخ) */}
                    <div className="flex gap-2 mb-4 bg-white p-2 rounded-lg border border-blue-100 shadow-sm" dir="rtl">
                      <Input 
                        placeholder={`إضافة نوع في ${section.name}...`} 
                        className="h-10 text-xs"
                        id={`input-${section.key}`}
                      />
                      <Button size="sm" className="bg-blue-600 h-10 w-12" onClick={() => {
                        const input = document.getElementById(`input-${section.key}`) as HTMLInputElement;
                        if(!input.value) return toast.error("اكتب اسماً للاختبار");
                        
                        const newTest = { 
                          id: `temp-${Date.now()}`, 
                          subject: section.key, 
                          exam_type: input.value, 
                          criteria: [{ id: `c-${Date.now()}`, name: "المعيار الأول", max: 10 }], 
                          is_active: true 
                        };
                        setAllExamConfigs([...allExamConfigs, newTest]);
                        setSelectedConfigId(newTest.id);
                        input.value = "";
                      }}>
                        <Plus className="w-5 h-5" />
                      </Button>
                    </div>

                    {/* عرض الاختبارات المرتبطة بهذا القسم */}
                    <div className="space-y-1 max-h-[400px] overflow-y-auto">
                      {allExamConfigs.filter(c => c.subject === section.key).map(conf => (
                        <div 
                          key={conf.id} 
                          onClick={() => setSelectedConfigId(conf.id)}
                          className={cn(
                            "p-3 rounded-lg cursor-pointer transition-all border flex justify-between items-center",
                            selectedConfigId === conf.id ? "bg-blue-600 text-white shadow-md border-blue-700" : "bg-white hover:bg-slate-100 border-slate-200"
                          )}
                        >
                          <span className="font-bold text-xs truncate">{conf.exam_type}</span>
                         <Trash2 
  className="w-3.5 h-3.5 opacity-50 hover:opacity-100 text-red-400" 
  onClick={(e) => {
    e.stopPropagation();
    
    // 🛡️ المنطق الذكي للحذف:
    const testId = conf.id.toString();

    if (testId.startsWith('temp-')) {
      // 1. إذا كان مؤقتاً: احذفه فوراً من الحالة (State) فقط
      setAllExamConfigs(allExamConfigs.filter(c => c.id !== conf.id));
      toast.info("تم إزالة المسودة قبل الحفظ");
    } else {
      // 2. إذا كان حقيقياً: افتح نافذة التأكيد للحذف من قاعدة البيانات
      setTestToDelete({ branchId: conf.subject, testId: testId });
      setIsDeleteDialogOpen(true);
    }
  }}
/>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>

            {/* منطقة المحرر (تعديل المعايير) */}
            <div className="flex-1 border rounded-xl bg-white p-4 relative border-dashed min-h-[400px]">
              {selectedConfigId ? (
                (() => {
                  const activeConf = allExamConfigs.find(c => c.id === selectedConfigId);
                  if (!activeConf) return null;
                  return (
  <div className="space-y-6">
    {/* --- رأس المحرر المحسن للموبايل والكمبيوتر --- */}
    <div className="flex flex-col gap-4 border-b pb-6 mb-6">
      
      {/* السطر الأول: الاسم + زر الحفظ (يصبحان عموديين في الموبايل) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-lg font-black text-slate-800 break-words max-w-full">
          {activeConf.exam_type}
        </h2>
        
        <Button 
          onClick={() => {
            const activeConfData = allExamConfigs.find(c => c.id === selectedConfigId);
            if (activeConfData) {
              saveDynamicConfig(activeConfData); 
            } else {
              toast.error("يرجى اختيار اختبار أولاً");
            }
          }} 
          disabled={loading}
          className="w-full sm:w-auto bg-green-700 hover:bg-green-800 text-white font-bold h-10 gap-2 shadow-md px-6 shrink-0"
        >
          {loading ? (
            <> <Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ... </>
          ) : (
            <> <Save className="w-4 h-4" /> حفظ المعايير </>
          )}
        </Button>
      </div>

      {/* السطر الثاني: مربع الطلقات (يظهر تحتهم في الموبايل) */}
      {activeConf.subject === 'shooting' && (
        <div className="flex items-center gap-2 bg-orange-50 p-2.5 rounded-xl border border-orange-200 self-start shadow-sm transition-all animate-in fade-in slide-in-from-right-2">
          <Label className="text-[11px] font-bold text-orange-700 whitespace-nowrap flex items-center gap-1">
            <Target className="w-3.5 h-3.5" /> إجمالي الطلقات المسموح بها:
          </Label>
          <Input 
            type="number" 
            value={activeConf.total_shots || 0} 
            onChange={(e) => {
              const newConfigs = [...allExamConfigs];
              const target = newConfigs.find(c => c.id === selectedConfigId);
              if(target) target.total_shots = Number(e.target.value);
              setAllExamConfigs(newConfigs);
            }}
            className="w-16 h-8 text-center font-black border-orange-300 bg-white text-orange-800 focus-visible:ring-orange-500"
          />
        </div>
      )}
    </div>
                      
                      <div className="space-y-3">
                         {activeConf.criteria?.map((crit: any, idx: number) => (
  <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border">
    <span className="text-xs font-bold text-slate-400 w-6 text-center">{idx + 1}</span>
    
    {/* اسم المعيار */}
    <Input 
      value={crit.name} 
      onChange={(e) => {
        const newConfigs = [...allExamConfigs];
        const target = newConfigs.find(c => c.id === selectedConfigId);
        if(target) target.criteria[idx].name = e.target.value;
        setAllExamConfigs(newConfigs);
      }}
      className="h-9 bg-white text-xs" 
    />

    {/* 🟢 الإخفاء الذكي لحقل الدرجة في الرماية فقط */}
    {activeConf.subject !== 'shooting' && (
      <Input 
        type="number" 
        value={crit.max} 
        onChange={(e) => {
          const newConfigs = [...allExamConfigs];
          const target = newConfigs.find(c => c.id === selectedConfigId);
          if(target) target.criteria[idx].max = Number(e.target.value);
          setAllExamConfigs(newConfigs);
        }}
        className="h-9 w-20 text-center font-bold text-blue-600 bg-white" 
      />
    )}

    {/* زر الحذف */}
    <X className="w-4 h-4 text-red-300 cursor-pointer" onClick={() => {
        const newConfigs = [...allExamConfigs];
        const target = newConfigs.find(c => c.id === selectedConfigId);
        if(target) target.criteria = target.criteria.filter((_:any, i:number) => i !== idx);
        setAllExamConfigs(newConfigs);
    }}/>
  </div>
))}
                         <Button variant="outline" className="w-full border-dashed text-blue-600 h-10 mt-4" onClick={() => {
                            const newConfigs = [...allExamConfigs];
                            const target = newConfigs.find(c => c.id === selectedConfigId);
                            if(target) {
                              if(!target.criteria) target.criteria = [];
                              target.criteria.push({ id: `c-${Date.now()}`, name: "", max: 10 });
                            }
                            setAllExamConfigs(newConfigs);
                         }}>
                           <Plus className="w-4 h-4 ml-2"/> إضافة معيار جديد
                         </Button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-300 py-20">
                    <Target className="w-16 h-16 mb-4 opacity-10"/>
                    <p className="font-bold text-sm">اختر الاختبار من القائمة الجانبية للبدء</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  ) : (
    <div className="flex flex-col items-center justify-center p-20 bg-slate-50 rounded-2xl border-2 border-dashed">
         <Lock className="w-12 h-12 text-slate-300 mb-4" />
         <p className="font-bold text-slate-500">عذراً، لا تملك صلاحية الوصول لهذا القسم.</p>
    </div>
  )}
</TabsContent>

        {/* 🟢 تاب معايير اللياقة */}
        <TabsContent value="standards">
{(["owner", "manager", "admin"].includes(userRole || "") || currentUser?.extra_permissions?.fitness_standards || (Array.isArray(currentUser?.extra_permissions) && currentUser?.extra_permissions?.includes("fitness_standards"))) ? (
          <Card className="border-t-4 border-t-green-600 shadow-md">
            <CardHeader className="text-right">
              <CardTitle>قواعد التقييم الرياضي</CardTitle>
              <CardDescription>الإعدادات الخاصة باللياقة البدنية (جري، ضغط، بطن).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 text-right">
              <div className="space-y-2">
                <Label>مسافة الجري المعتمدة</Label>
                <Select value={calcSettings.distance} onValueChange={(val) => setCalcSettings({ ...calcSettings, distance: val })} dir="ltr">
                  <SelectTrigger className="bg-slate-50 h-12 text-right flex-row-reverse"><SelectValue placeholder="اختر المسافة" /></SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="3200">3200 متر</SelectItem>
                    <SelectItem value="2400">2400 متر</SelectItem>
                    <SelectItem value="1600">1600 متر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>نسبة النجاح (%)</Label>
                  <Input type="number" value={calcSettings.pass_rate} onChange={(e) => setCalcSettings({ ...calcSettings, pass_rate: Number(e.target.value) })} className="bg-slate-50 h-12 text-center font-bold" />
                </div>
                <div className="space-y-2">
                  <Label>الدرجة القصوى</Label>
                  <Input type="number" value={calcSettings.base_score} onChange={(e) => setCalcSettings({ ...calcSettings, base_score: Number(e.target.value) })} className="bg-slate-50 h-12 text-center font-bold" />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
                <Label>نظام الرأفة (Mercy Mode)</Label>
                <Switch checked={calcSettings.mercy_mode} onCheckedChange={(val) => setCalcSettings({ ...calcSettings, mercy_mode: val })} />
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50 p-4 flex justify-end">
              <Button onClick={saveSettings} disabled={loading} className="bg-green-700 hover:bg-green-800 text-white gap-2">
                {loading ? <Loader2 className="animate-spin" /> : <Save className="w-4 h-4" />} حفظ الرياضي
              </Button>
            </CardFooter>
          </Card>
          ) : (

        // ❌ إذا لا: اظهر له هذه الرسالة بدلاً من الجدول
        <div className="flex flex-col items-center justify-center p-20 bg-slate-50 rounded-2xl border-2 border-dashed">
             <Lock className="w-12 h-12 text-slate-300 mb-4" />
             <p className="font-bold text-slate-500">عذراً، لا تملك صلاحية الوصول لهذا القسم.</p>
        </div>

    )}
        </TabsContent>

       {/* 🟠 تاب معايير الاشتباك - نسخة مطورة */}
<TabsContent value="engagement">
  {(["owner", "manager", "admin"].includes(userRole || "") || 
    currentUser?.extra_permissions?.combat_standards || 
    (Array.isArray(currentUser?.extra_permissions) && currentUser?.extra_permissions?.includes("combat_standards"))) ? (
  <Card className="border-t-4 border-t-orange-600 shadow-md">
    <CardHeader className="text-right pb-2">
      <CardTitle className="text-orange-700">إدارة معايير الاشتباك</CardTitle>
      <CardDescription>تعريف المحاور، المعايير، والمحطات التعريفية.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-6">
      <Tabs value={activeEngTab} onValueChange={setActiveEngTab} className="w-full">
        <TabsList className="w-full grid grid-cols-2 mb-4 h-12 bg-orange-50 p-1">
          <TabsTrigger value="technical" className="gap-2 font-bold h-10">الجانب الفني</TabsTrigger>
          <TabsTrigger value="scenario" className="gap-2 font-bold h-10">سيناريو </TabsTrigger>
        </TabsList>

        {engagementData.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="space-y-6">
            {tab.axes.map((axis) => (
              <div key={axis.id} className="border-2 border-orange-100 rounded-xl overflow-hidden bg-white">
                {/* رأس المحور */}
                <div className="bg-orange-50 p-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-orange-100">
  
  <div className="flex flex-col md:flex-row items-start md:items-center gap-2 flex-1 w-full">
    <span className="text-orange-600 font-black text-xs md:text-sm">المحور:</span>
    
    {/* العرض في الهواتف: يظهر كـ Div قابل للنقر */}
    <div 
      onClick={() => {
        setEditingAxis({ tabId: tab.id, axisId: axis.id, name: axis.name });
        setIsAxisModalOpen(true);
      }}
      className="md:hidden w-full p-2 bg-white border border-orange-200 rounded-lg text-sm font-bold text-slate-700 shadow-sm"
    >
      {axis.name || "اضغط لتسمية المحور..."}
    </div>

    {/* العرض في الشاشات الكبيرة: يبقى كما هو Input */}
    <Input 
      value={axis.name} 
      onChange={(e) => updateAxisName(tab.id, axis.id, e.target.value)} 
      className="hidden md:block font-bold border-orange-200 bg-white md:w-2/3 h-9" 
    />
    
    {/* مفتاح التشغيل - تأكد من بقائه في سطر منفصل أو بجانب العنوان في الهاتف */}
    <div className="flex items-center gap-2 mr-auto ml-4 bg-white px-3 py-1 rounded-full border border-orange-200 shadow-sm" dir="rtl">
    
    <Switch 
      checked={axis.is_active ?? true} 
      onCheckedChange={(checked) => {
        setEngagementData(prev => prev.map(t => t.id === tab.id ? {
          ...t, axes: t.axes.map(a => a.id === axis.id ? { ...a, is_active: checked } : a)
        } : t));
      }} 
    />
    <Badge variant="outline" className={axis.is_active !== false ? "text-green-600 border-green-200" : "text-slate-400 border-slate-200"}>
      {axis.is_active !== false ? "نشط" : "معطل"}
    </Badge>
</div>
  </div>

  <Button variant="ghost" size="icon" onClick={() => deleteEngAxis(tab.id, axis.id)} className="text-red-500 hover:bg-red-50 hidden md:flex">
    <Trash2 className="w-4 h-4" />
  </Button>
</div>

                {/* قائمة المعايير داخل المحور */}
                <div className="p-4 space-y-4">
                  {axis.criteria.map((crit, idx) => (
                    <div key={crit.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start pb-4 border-b last:border-0">
                      <div className="md:col-span-1 pt-2">
                        <Badge className="bg-slate-800 text-[10px]">{idx + 1}</Badge>
                      </div>
                      <div className="md:col-span-4 space-y-1">
                        <Label className="text-[10px] text-slate-400">اسم المعيار</Label>
                        <Input value={crit.name} placeholder="المعيار" onChange={(e) => updateEngCriterion(tab.id, axis.id, crit.id, 'name', e.target.value)} className="h-9 text-xs" />
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <Label className="text-[10px] text-slate-400">الدرجة</Label>
                        <Input type="number" value={crit.max} onChange={(e) => updateEngCriterion(tab.id, axis.id, crit.id, 'max', e.target.value)} className="h-9 text-center font-bold text-orange-700" />
                      </div>
                      <div className="md:col-span-4 space-y-2">
  <Label className="text-[10px] text-slate-400">المحطات التعريفية</Label>
  <div className="flex flex-wrap gap-2 p-2 border rounded-lg bg-slate-50 min-h-[40px]">
    {crit.stations.map((station: string, sIdx: number) => (
      <div key={sIdx} className="flex items-center gap-1 bg-white border shadow-sm rounded-md px-2 py-1 group">
        <input 
          value={station}
          onChange={(e) => updateStationText(tab.id, axis.id, crit.id, sIdx, e.target.value)}
          placeholder="اسم المحطة..."
          className="text-[11px] outline-none w-24 bg-transparent"
        />
        <button 
          onClick={() => deleteStation(tab.id, axis.id, crit.id, sIdx)}
          className="text-red-300 hover:text-red-500 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    ))}
    <Button 
      variant="outline" 
      size="sm" 
      onClick={() => addStationToCriterion(tab.id, axis.id, crit.id)}
      className="h-7 px-2 text-[10px] bg-white border-orange-200 text-orange-600 hover:bg-orange-50"
    >
      <Plus className="w-3 h-3 ml-1" /> إضافة محطة
    </Button>
  </div>
</div>
                      <div className="md:col-span-1 pt-6 text-left">
                        <Button 
  variant="ghost" 
  size="icon" 
  onClick={() => {
    const newCriteria = axis.criteria.filter(c => c.id !== crit.id);
    setEngagementData(prev => prev.map(t => t.id === tab.id ? { 
      ...t, 
      axes: t.axes.map(a => a.id === axis.id ? { ...a, criteria: newCriteria } : a) 
    } : t));
  }} 
  className="text-red-300 hover:text-red-500 h-8 w-8"
>
  <X className="w-3 h-3" />
</Button>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addEngCriterion(tab.id, axis.id)} className="w-full border-dashed text-orange-600 hover:bg-orange-50 border-orange-200">
                    <Plus className="w-3 h-3 ml-1" /> إضافة معيار للمحور
                  </Button>
                </div>
              </div>
            ))}
            
            <Button onClick={() => addEngagementAxis(tab.id)} className="w-full h-14 border-2 border-dashed border-orange-200 bg-orange-50/50 text-orange-700 hover:bg-orange-100 hover:border-orange-400 transition-all">
              <Plus className="w-5 h-5 ml-2" /> إنشاء محور تقييم جديد
            </Button>
          </TabsContent>
        ))}
      </Tabs>
    </CardContent>
    {/* 🛠️ البحث عن هذا الزر في أسفل تاب الاشتباك وتعديله */}
<CardFooter className="bg-slate-50 p-4 flex justify-end border-t">
  <Button 
    onClick={saveEngagementConfigs} // 👈 أضف هذا السطر هنا
    disabled={loading}              // 👈 وأضف هذا لتعطيل الزر أثناء التحميل
    className="bg-orange-600 hover:bg-orange-700 text-white gap-2 font-bold px-8"
  >
    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
    حفظ معايير الاشتباك
  </Button>
</CardFooter>
  </Card>
  ) : (

        // ❌ إذا لا: اظهر له هذه الرسالة بدلاً من الجدول
        <div className="flex flex-col items-center justify-center p-20 bg-slate-50 rounded-2xl border-2 border-dashed">
             <Lock className="w-12 h-12 text-slate-300 mb-4" />
             <p className="font-bold text-slate-500">عذراً، لا تملك صلاحية الوصول لهذا القسم.</p>
        </div>

    )}
</TabsContent>

<TabsContent value="disciplinary">
  {(["owner", "manager", "admin"].includes(userRole || "") || 
    currentUser?.extra_permissions?.disciplinary_regulations || 
    (Array.isArray(currentUser?.extra_permissions) && currentUser?.extra_permissions?.includes("disciplinary_regulations"))) ? (
  <Card className="border-t-4 border-t-amber-700 shadow-md">
    <CardHeader className="text-right">
      <CardTitle className="text-amber-800 flex items-center gap-2">
        <ShieldCheck className="w-6 h-6" /> إدارة لوائح المخالفات والجزاءات
      </CardTitle>
      <CardDescription>تعريف المخالفات، الجزاءات، ودرجات الخصم لكل نظام تدريبي.</CardDescription>
    </CardHeader>
    
    <CardContent className="space-y-6">
      <Tabs defaultValue="recruits" className="w-full" dir="rtl">
        {/* التبويبات الرئيسية */}
        <TabsList className="w-full grid grid-cols-2 mb-6 bg-slate-100 h-12 p-1 rounded-xl">
          <TabsTrigger value="recruits" className="font-bold text-sm md:text-base">لائحة المستجدين والطلبة</TabsTrigger>
          <TabsTrigger value="specialized" className="font-bold text-sm md:text-base">الدورات الحتمية والتخصصية</TabsTrigger>
        </TabsList>

        {/* 1. محتوى لائحة المستجدين (مع نظام الفرز الفرعي) */}
        <TabsContent value="recruits" className="space-y-8">
          {/* 🔘 أزرار التبديل بين المبيت والثابت صبح */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex p-1 bg-amber-50 border border-amber-200 rounded-2xl shadow-inner overflow-hidden">
              <Button 
                variant={recruitSystem === 'sleeping' ? 'default' : 'ghost'}
                onClick={() => setRecruitSystem('sleeping')}
                className={cn(
                  "rounded-xl px-6 md:px-10 font-black text-xs md:text-sm transition-all h-9 md:h-11",
                  recruitSystem === 'sleeping' ? "bg-amber-700 text-white shadow-lg" : "text-amber-800 hover:bg-amber-100"
                )}
              >
                🏠 نظام المبيت
              </Button>
              <Button 
                variant={recruitSystem === 'fixed' ? 'default' : 'ghost'}
                onClick={() => setRecruitSystem('fixed')}
                className={cn(
                  "rounded-xl px-6 md:px-10 font-black text-xs md:text-sm transition-all h-9 md:h-11",
                  recruitSystem === 'fixed' ? "bg-amber-700 text-white shadow-lg" : "text-amber-800 hover:bg-amber-100"
                )}
              >
                ☀️ نظام ثابت صبح
              </Button>
            </div>
          </div>

          {/* عرض جداول المستجدين بناءً على الفرز */}
          {disciplinaryData
            .filter(reg => reg.id === (recruitSystem === 'sleeping' ? 'recruits' : 'recruits_fixed'))
            .map((reg) => (
              <div key={reg.id} className="space-y-10 animate-in fade-in zoom-in-95 duration-500">
                {reg.degrees.map((degree) => (
                  <div key={degree.id} className="border-2 border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-950">
                    <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
                      <span className="font-bold flex items-center gap-2">
                        <Scale className="w-5 h-5 text-amber-400"/> {degree.name}
                      </span>
                      <Badge className="bg-amber-600 text-white border-0 px-3 py-1 text-xs">
                        {degree.items.length} مخالفة معتمدة
                      </Badge>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-right border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b-2">
  <tr>
    {/* المخالفة: 40% */}
    <th className="p-4 font-black w-[40%] border-l">مسمى المخالفة</th>
    
    {/* الجزاء: زدناه إلى 40% ليظهر جملة لجنة التحقيق كاملة */}
    <th className="p-4 font-black w-[40%] border-l text-center">الجزاء (العقوبة)</th>
    
    {/* الخصم: قلصناه إلى 10% */}
    <th className="p-4 font-black w-[10%] text-center border-l">الخصم</th>
    
    {/* الحذف: 10% */}
    <th className="p-4 w-[10%]"></th>
  </tr>
</thead>
                        <tbody className="divide-y divide-slate-100">
                          {degree.items.map((item, i) => (
                            <tr key={item.id} className="hover:bg-amber-50/30 transition-colors">
                              <td className="p-2 border-l">
                                {/* عرض للهواتف */}
                                <div 
                                  onClick={() => setEditingViolationText({ regId: reg.id, degId: degree.id, itemIdx: i, value: item.name })}
                                  className="md:hidden text-xs p-3 bg-slate-50 rounded-lg border border-dashed border-amber-200 min-h-[45px] cursor-pointer hover:bg-amber-50"
                                >
                                  {item.name || <span className="text-slate-400 italic">اضغط لكتابة نص المخالفة...</span>}
                                </div>
                                {/* عرض للكمبيوتر */}
                                <Input 
                                  value={item.name} 
                                  onChange={(e) => {
                                    const newVal = toEnglishDigits(e.target.value);
                                    const newData = [...disciplinaryData];
                                    const r = newData.find(regis => regis.id === reg.id);
                                    const d = r?.degrees.find(deg => deg.id === degree.id);
                                    if(d) d.items[i].name = newVal;
                                    setDisciplinaryData(newData);
                                  }}
                                  placeholder="أدخل نص المخالفة هنا..."
                                  className="hidden md:block border-none shadow-none focus-visible:ring-0 font-medium bg-transparent w-full text-slate-800" 
                                />
                              </td>
                              <td className="p-2 border-l">
                                <Input 
                                  value={item.penalty} 
                                  onChange={(e) => {
                                    const newVal = toEnglishDigits(e.target.value);
                                    const newData = [...disciplinaryData];
                                    const r = newData.find(regis => regis.id === reg.id);
                                    const d = r?.degrees.find(deg => deg.id === degree.id);
                                    if(d) d.items[i].penalty = newVal;
                                    setDisciplinaryData(newData);
                                  }}
                                  placeholder="مدة الحجز..."
                                  className="border-none shadow-none focus-visible:ring-0 text-red-600 bg-transparent font-bold text-[10px] md:text-xs px-1 h-8 text-right"
                                />
                              </td>
                              <td className="p-2 border-l text-center">
                                <Input 
                                  type="number" 
                                  step="0.5"
                                  value={item.deduction} 
                                  onChange={(e) => {
                                    const val = toEnglishDigits(e.target.value);
                                    const newData = [...disciplinaryData];
                                    const r = newData.find(regis => regis.id === reg.id);
                                    const d = r?.degrees.find(deg => deg.id === degree.id);
                                    if(d) d.items[i].deduction = parseFloat(val) || 0;
                                    setDisciplinaryData(newData);
                                  }}
                                  className="w-14 mx-auto text-center font-black border-amber-200 bg-amber-50 dark:bg-amber-900/20 h-9 rounded-lg text-xs"
                                />
                              </td>
                              <td className="p-2 text-center">
                                <Button 
                                    variant="ghost" size="icon" 
                                    className="text-red-300 hover:text-red-600 hover:bg-red-50 rounded-full h-8 w-8"
                                    onClick={() => {
                                        const newData = [...disciplinaryData];
                                        const r = newData.find(regis => regis.id === reg.id);
                                        const d = r?.degrees.find(deg => deg.id === degree.id);
                                        if(d) d.items = d.items.filter(v => v.id !== item.id);
                                        setDisciplinaryData(newData);
                                    }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <Button 
                        variant="ghost" 
                        className="w-full rounded-none h-12 border-t border-dashed text-slate-500 hover:text-amber-800 hover:bg-amber-50/50 transition-all font-bold"
                        onClick={() => {
                            const newData = [...disciplinaryData];
                            const r = newData.find(regis => regis.id === reg.id);
                            const d = r?.degrees.find(deg => deg.id === degree.id);
                            if(d) d.items.push({ id: `v-${Date.now()}`, name: '', penalty: '', deduction: 0 });
                            setDisciplinaryData(newData);
                        }}
                      >
                        <Plus className="w-4 h-4 ml-2" /> إضافة بند جديد للـ {degree.name}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            
        </TabsContent>

        {/* 2. محتوى الدورات التخصصية (كما كان) */}
        <TabsContent value="specialized" className="space-y-8 animate-in fade-in duration-500">
          {disciplinaryData
            .filter(reg => reg.id === 'specialized')
            .map((reg) => (
              <div key={reg.id} className="space-y-10">
                {reg.degrees.map((degree) => (
                  <div key={degree.id} className="border-2 border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-950">
                    <div className="bg-slate-700 text-white p-4 flex justify-between items-center">
                      <span className="font-bold flex items-center gap-2">
                        <Scale className="w-5 h-5 text-amber-400"/> {degree.name}
                      </span>
                      <Badge className="bg-slate-500 text-white border-0 px-3 py-1 text-xs">
                        {degree.items.length} مخالفة
                      </Badge>
                    </div>
                    {/* ... (نفس هيكل الجدول العلوي للتخصصية) ... */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-right border-collapse">
                        <thead className="bg-slate-50 border-b-2">
                          <tr>
                            <th className="p-4 font-black w-1/2 border-l">مسمى المخالفة</th>
                            <th className="p-4 font-black border-l">الجزاء</th>
                            <th className="p-4 font-black text-center border-l">الخصم</th>
                            <th className="p-4 w-[60px]"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {degree.items.map((item, i) => (
                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-2 border-l">
                                <div 
                                  onClick={() => setEditingViolationText({ regId: reg.id, degId: degree.id, itemIdx: i, value: item.name })}
                                  className="md:hidden text-xs p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 min-h-[45px] cursor-pointer"
                                >
                                  {item.name || "اضغط للكتابة..."}
                                </div>
                                <Input 
                                  value={item.name} 
                                  onChange={(e) => {
                                    const val = toEnglishDigits(e.target.value);
                                    const newData = [...disciplinaryData];
                                    const r = newData.find(regis => regis.id === reg.id);
                                    const d = r?.degrees.find(deg => deg.id === degree.id);
                                    if(d) d.items[i].name = val;
                                    setDisciplinaryData(newData);
                                  }}
                                  className="hidden md:block border-none shadow-none focus-visible:ring-0 font-medium bg-transparent w-full text-slate-800" 
                                />
                              </td>
                              <td className="p-2 border-l text-red-600 font-bold">
                                <Input 
                                  value={item.penalty} 
                                  onChange={(e) => {
                                    const val = toEnglishDigits(e.target.value);
                                    const newData = [...disciplinaryData];
                                    const r = newData.find(regis => regis.id === reg.id);
                                    const d = r?.degrees.find(deg => deg.id === degree.id);
                                    if(d) d.items[i].penalty = val;
                                    setDisciplinaryData(newData);
                                  }}
                                  className="border-none shadow-none focus-visible:ring-0 bg-transparent text-red-600 font-bold" 
                                />
                              </td>
                              <td className="p-2 border-l text-center">
                                <Input 
                                  type="number" step="0.5"
                                  value={item.deduction} 
                                  onChange={(e) => {
                                    const val = toEnglishDigits(e.target.value);
                                    const newData = [...disciplinaryData];
                                    const r = newData.find(regis => regis.id === reg.id);
                                    const d = r?.degrees.find(deg => deg.id === degree.id);
                                    if(d) d.items[i].deduction = parseFloat(val) || 0;
                                    setDisciplinaryData(newData);
                                  }}
                                  className="w-16 mx-auto text-center font-black border-slate-200 bg-slate-100 h-9 rounded-lg" 
                                />
                              </td>
                              <td className="p-2 text-center">
                                <Button 
                                    variant="ghost" size="icon" 
                                    className="text-slate-300 hover:text-red-600 h-8 w-8"
                                    onClick={() => {
                                        const newData = [...disciplinaryData];
                                        const r = newData.find(regis => regis.id === reg.id);
                                        const d = r?.degrees.find(deg => deg.id === degree.id);
                                        if(d) d.items = d.items.filter(v => v.id !== item.id);
                                        setDisciplinaryData(newData);
                                    }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <Button 
                        variant="ghost" 
                        className="w-full rounded-none h-12 border-t border-dashed text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all font-bold"
                        onClick={() => {
                            const newData = [...disciplinaryData];
                            const r = newData.find(regis => regis.id === reg.id);
                            const d = r?.degrees.find(deg => deg.id === degree.id);
                            if(d) d.items.push({ id: `v-${Date.now()}`, name: '', penalty: '', deduction: 0 });
                            setDisciplinaryData(newData);
                        }}
                      >
                        <Plus className="w-4 h-4 ml-2" /> إضافة بند جديد
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </TabsContent>
        {/* 🟢 التاب الجديد الديناميكي */}

      </Tabs>
    </CardContent>

    <CardFooter className="bg-slate-50 dark:bg-slate-900 border-t p-6 flex justify-end">
      <Button 
        onClick={saveDisciplinaryData} 
        disabled={loading} 
        className="bg-amber-700 hover:bg-amber-800 text-white gap-3 font-black px-12 py-6 text-lg rounded-xl shadow-xl transition-all active:scale-95"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
        اعتماد وحفظ كافة اللوائح المعدلة
      </Button>
    </CardFooter>
  </Card>
 ) : (

        // ❌ إذا لا: اظهر له هذه الرسالة بدلاً من الجدول
        <div className="flex flex-col items-center justify-center p-20 bg-slate-50 rounded-2xl border-2 border-dashed">
             <Lock className="w-12 h-12 text-slate-300 mb-4" />
             <p className="font-bold text-slate-500">عذراً، لا تملك صلاحية الوصول لهذا القسم.</p>
        </div>

    )}
</TabsContent>

        {/* 🎨 تاب المظهر */}
        <TabsContent value="appearance">
          <Card className="shadow-md border-t-4 border-t-blue-600">
            <CardHeader className="text-right">
              <CardTitle>تخصيص الواجهة</CardTitle>
              <CardDescription>تحكم في ألوان النظام وطريقة عرض البيانات.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
                <div className="flex items-center gap-4 text-right">
                  {isDark ? <Moon className="w-6 h-6 text-blue-500" /> : <Sun className="w-6 h-6 text-orange-500" />}
                  <div><Label>الوضع الليلي</Label></div>
                </div>
                <Switch checked={isDark} onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')} />
              </div>
              <div className="space-y-2 text-right">
                <Label>عدد الصفوف في صفحة النتائج</Label>
                <Select value={calcSettings.rows_per_page} onValueChange={(val) => setCalcSettings({...calcSettings, rows_per_page: val})} dir="ltr">
                  <SelectTrigger className="bg-slate-50 h-12 text-right flex-row-reverse"><SelectValue /></SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="10">10 صفوف</SelectItem>
                    <SelectItem value="20">20 صف</SelectItem>
                    <SelectItem value="50">50 صف</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50 p-4 flex justify-end">
              <Button onClick={saveSettings} className="bg-blue-700 text-white gap-2">حفظ التفضيلات <Save className="w-4 h-4" /></Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* ✒️ تاب التوقيع */}
        <TabsContent value="signature">
          <Card className="shadow-md border-t-4 border-t-purple-600">
            <CardHeader className="text-right"><CardTitle>التوقيع الرقمي</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-right">
                <div className="space-y-2">
                  <Label className="font-bold">لوحة الرسم:</Label>
                  <div className="border-2 border-dashed rounded-lg bg-white h-[200px]">
                    <SignatureCanvas 
    ref={sigPad} 
    penColor="black" 
    backgroundColor="white" // 🟢 هذا هو الحل: جعل الخلفية بيضاء بدلاً من شفافة
    canvasProps={{ className: 'w-full h-full' }} 
/>
                  </div>
                  <div className="flex gap-2 justify-end mt-2">
                    {savedSignature && <Button variant="destructive" onClick={deleteSignature} size="sm"><Trash2 className="w-4 h-4 ml-1" /> حذف</Button>}
                    <Button variant="outline" onClick={clearSignature} size="sm">مسح</Button>
                    <Button onClick={saveSignature} size="sm" className="bg-purple-700">حفظ</Button>
                  </div>
                </div>
                <div className="space-y-2">
  <Label className="font-bold">المعاينة:</Label>
  <div className="h-[200px] border rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden">
    {savedSignature ? (
      <img 
        // الرابط مخزن في State مع التايم ستامب
        src={savedSignature} 
        alt="Signature" 
        className="max-h-[150px] object-contain mix-blend-multiply" 
        
        // 🟢 المعالجة الذكية: إذا لم يجد PNG يحاول JPG
        onError={(e) => {
            const target = e.target as HTMLImageElement;
            // نتأكد أننا لم نقم بالمحاولة مسبقاً لتجنب التكرار
            if (target.src.includes('.png')) {
                // استبدال الامتداد وتحديث التايم ستامب لضمان المحاولة الجديدة
                target.src = target.src.replace('.png', '.jpg');
            } else if (target.src.includes('.jpg') && !target.src.includes('.jpeg')) {
                 target.src = target.src.replace('.jpg', '.jpeg');
            } else {
                // إذا فشل كل شيء، نخفي الصورة ونظهر رسالة
                target.style.display = 'none';
                setSavedSignature(null); // تحديث الحالة ليعرض "لا يوجد"
            }
        }}
      />
    ) : (
      <p className="text-slate-400 font-bold opacity-50">لا يوجد توقيع محفوظ</p>
    )}
  </div>
</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 🔒 تاب الأمان */}
        <TabsContent value="security">
          <Card className="border-t-4 border-t-red-600 shadow-md text-right">
            <CardHeader><CardTitle className="text-red-600 flex items-center gap-2 justify-end"><Lock className="w-5 h-5" /> تغيير كلمة المرور</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input type="password" placeholder="كلمة المرور الحالية" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="text-right" />
              <Input type="password" placeholder="كلمة المرور الجديدة" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="text-right" />
              <Input type="password" placeholder="تأكيد كلمة المرور" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="text-right" />
              <Button onClick={handlePasswordChange} disabled={isUpdatingPassword} className="w-full bg-red-600 hover:bg-red-700">{isUpdatingPassword ? <Loader2 className="animate-spin" /> : "تحديث"}</Button>
            </CardContent>
          </Card>
        </TabsContent>

      <TabsContent value="training-schedule">
  {(["owner", "manager", "admin"].includes(userRole || "") || 
    currentUser?.extra_permissions?.training_program || 
    (Array.isArray(currentUser?.extra_permissions) && currentUser?.extra_permissions?.includes("training_program"))) ? (
            <Card className="border-t-4 border-t-amber-500 shadow-md">
              {/* ... (Header كما هو) ... */}
              <CardHeader className="flex flex-col md:flex-row items-center justify-between pb-4 gap-4">
  <div>
    <CardTitle className="text-amber-700 flex items-center gap-2">
      <CalendarDays className="w-5 h-5"/> إدارة البرنامج اليومي
    </CardTitle>
    <CardDescription>تعريف الحصص والتوقيتات للدورات المختلفة (القوالب الأسبوعية).</CardDescription>
  </div>

  <div className="flex items-center gap-4">
    {/* 🛡️ ميزة خاصة بالـ Owner فقط لإخفاء الأرشيف */}
    {userRole === "owner" && (
      <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border shadow-sm">
        <Switch 
          id="show-active" 
          checked={showOnlyActive} 
          onCheckedChange={async (val) => {
    setShowOnlyActive(val);
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings/features/hide_inactive_templates`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ value: String(val) })
    });
}} 
        />
        <Label htmlFor="show-active" className="text-[10px] font-black text-slate-600 cursor-pointer">
          إخفاء الأرشيف (غير النشط)
        </Label>
      </div>
    )}

    <Button onClick={createNewTemplate} variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50 h-9 text-xs font-bold">
      <Plus className="w-4 h-4 ml-1"/> قالب جديد
    </Button>
  </div>
</CardHeader>

              <CardContent className="space-y-6">
                {trainingTemplates.length === 0 ? (
                   // ... (رسالة لا يوجد بيانات كما هي) ...
                   <div className="text-center py-10 bg-slate-50 border-2 border-dashed rounded-xl text-slate-400">
                    <CalendarDays className="w-12 h-12 mx-auto mb-2 opacity-20"/>
                    <p>لا توجد جداول تدريبية معرفة.</p>
                    <Button onClick={createNewTemplate} variant="link" className="text-amber-600">اضغط لإنشاء الجدول الأول</Button>
                  </div>
                ) : (
                  <Tabs value={activeTemplateId || ""} onValueChange={setActiveTemplateId} className="w-full">
                    {/* ... (TabsList كما هو) ... */}
                    <TabsList className="w-full justify-start overflow-x-auto bg-slate-100 p-1 mb-4">
  {displayedTemplates.map(temp => (
    <TabsTrigger key={temp.id} value={temp.id} className="min-w-[120px] relative group">
      {temp.name || "بدون عنوان"}
      {/* علامة صغيرة لتمييز القالب النشط عن غيره بالنظر */}
      <div className={cn(
        "w-1.5 h-1.5 rounded-full absolute top-1 left-1",
        temp.isActive ? "bg-green-500" : "bg-slate-300"
      )} />
    </TabsTrigger>
  ))}
</TabsList>

                    {trainingTemplates.map(template => (
                      <TabsContent key={template.id} value={template.id} className="space-y-4 animate-in fade-in slide-in-from-top-2"dir="rtl">
                        
                        {/* 🟢 منطقة الإعدادات العلوية (تم التحديث لإضافة الدورة والدفعة) */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                          
                          {/* 1. اسم الجدول */}
                          <div className="space-y-1 md:col-span-1">
                            <Label className="text-xs text-amber-800">اسم الجدول (للمرجعية)</Label>
                            <Input 
                              value={template.name} 
                              onChange={(e) => setTrainingTemplates(prev => prev.map(t => t.id === template.id ? {...t, name: e.target.value} : t))}
                              className="bg-white border-amber-200 font-bold"
                            />
                          </div>

                          {/* 2. اختيار الدورة (شرط للحفظ) */}
                          <div className="space-y-1">
                            <Label className="text-xs text-amber-800 flex items-center gap-1">الدورة <span className="text-red-500">*</span></Label>
                            <Select 
                                value={template.courseId} 
                                onValueChange={(val) => setTrainingTemplates(prev => prev.map(t => t.id === template.id ? {...t, courseId: val} : t))}
                            >
                                <SelectTrigger className="bg-white border-amber-200 h-10"><SelectValue placeholder="اختر الدورة" /></SelectTrigger>
                                <SelectContent>
                                    {filterOptions.courses.map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                          </div>

                          {/* 3. اختيار الدفعة (شرط للحفظ) */}
                          <div className="space-y-1">
                            <Label className="text-xs text-amber-800 flex items-center gap-1">الدفعة <span className="text-red-500">*</span></Label>
                             <Select 
                                value={template.batchId} 
                                onValueChange={(val) => setTrainingTemplates(prev => prev.map(t => t.id === template.id ? {...t, batchId: val} : t))}
                            >
                                <SelectTrigger className="bg-white border-amber-200 h-10"><SelectValue placeholder="اختر الدفعة" /></SelectTrigger>
                                <SelectContent>
                                    {filterOptions.batches.map((b: any) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                                </SelectContent>
                            </Select>
                          </div>

                          {/* 4. زر التفعيل والحذف */}
                          <div className="flex items-end gap-2">
                             <div className="flex items-center gap-2 bg-white px-2 py-2 rounded-lg border border-amber-200 w-full h-10">
                                <Switch 
                                  checked={template.isActive}
                                  onCheckedChange={(val) => setTrainingTemplates(prev => prev.map(t => t.id === template.id ? {...t, isActive: val} : t))}
                                />
                                <Label className="cursor-pointer text-[10px] whitespace-nowrap">تفعيل الجدول</Label>
                             </div>
                             {userRole === "owner" && (
  <Button 
    variant="destructive" 
    size="icon" 
    onClick={() => {
      setTemplateToDeleteId(template.id);
      setIsTemplateConfirmOpen(true);
    }} 
    className="h-10 w-12 shrink-0 shadow-sm hover:bg-red-700"
    title="حذف هذا القالب نهائياً"
  >
    <Trash2 className="w-4 h-4"/>
  </Button>
)}
                          </div>
                        </div>

                        {/* 🗓️ جدول الحصص (شبكة) */}
                        <div className="border rounded-xl shadow-sm bg-white overflow-hidden">
                          {/* جعل الجدول قابل للتمرير أفقياً للتعامل مع 11 حصة */}
                          <div className="overflow-x-auto">
                              <table className="w-full text-sm text-right min-w-[1000px]">
                                <thead className="bg-slate-800 text-white">
                                  <tr>
                                    <th className="p-3 w-[100px] border-b border-slate-700 sticky right-0 bg-slate-800 z-10">اليوم</th>
                                    
                                    {/* تكرار الأعمدة بناءً على عدد الحصص الموجودة في أول يوم */}
                                    {template.schedule[0].sessions.map((_, i) => (
  <th key={i} className="p-3 min-w-[160px] border-b border-slate-700 text-center bg-slate-900/50 relative group/col">
    <div className="flex items-center justify-center gap-2">
      <span>الحصة {i + 1}</span>
      {/* زر الحذف يظهر عند الحوّم (Hover) فوق الخلية فقط لجمالية التصميم */}
      <button 
        onClick={() => removeSessionColumn(template.id, i)}
        className="opacity-0 group-hover/col:opacity-100 text-red-400 hover:text-red-500 transition-opacity"
        title="حذف هذا العمود"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  </th>
))}

                                    {/* 🟢 زر إضافة حصة (عمود جديد) */}
                                    <th className="p-2 border-b border-slate-700 bg-slate-800 w-[50px] text-center align-middle">
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => addSessionColumn(template.id)}
                                            className="text-green-400 hover:text-green-300 hover:bg-slate-700"
                                            title="إضافة حصة جديدة"
                                        >
                                            <Plus className="w-5 h-5" />
                                        </Button>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y">
                                  {template.schedule.map((daySchedule) => (
                                    <tr key={daySchedule.dayName} className="hover:bg-slate-50 transition-colors">
                                      <td className="p-3 font-bold bg-slate-50 border-l sticky right-0 text-center z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group/row">
  <div className="flex flex-col items-center gap-1">
    {daySchedule.dayName}
    <button 
      onClick={() => removeDayRow(template.id, daySchedule.dayName)}
      className="opacity-0 group-hover/row:opacity-100 text-red-500 hover:bg-red-50 p-1 rounded transition-all"
      title="حذف هذا اليوم"
    >
      <X className="w-3.5 h-3.5" />
    </button>
  </div>
</td>
                                      {daySchedule.sessions.map((sess, sessIdx) => (
                                        <td key={sess.id} className="p-2 border-l relative group">
                                          <div className="space-y-1">
                                             {/* اختيار نوع الحصة (تم التحديث) */}
                                             <Select 
                                               value={sess.type} 
                                               onValueChange={(val: any) => updateSession(template.id, daySchedule.dayName, sessIdx, 'type', val)}
                                             >
                                               <SelectTrigger className="h-7 text-xs border-none bg-transparent hover:bg-slate-100 px-1 font-bold">
                                                  <SelectValue />
                                               </SelectTrigger>
                                               <SelectContent>
                                                  <SelectItem value="sports">🏅 لياقة بدنية</SelectItem>
                                                  <SelectItem value="military">🪖 تدريب عسكري</SelectItem>
                                                  <SelectItem value="combat">🤼 اشتباك ودفاع</SelectItem> {/* 🟢 الخيار الجديد */}
                                                  <SelectItem value="lecture">📚 محاضرة</SelectItem>
                                                  <SelectItem value="other">⚪ أخرى</SelectItem>
                                               </SelectContent>
                                             </Select>

                                             {/* اسم الحصة - تحديث الألوان */}
                                             <Input 
                                               placeholder="اسم الحصة..."
                                               value={sess.name}
                                               onChange={(e) => updateSession(template.id, daySchedule.dayName, sessIdx, 'name', e.target.value)}
                                               className={`h-8 text-[11px] font-bold text-center ${
                                                  sess.type === 'sports' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                  sess.type === 'military' ? 'bg-green-50 text-green-700 border-green-200' :
                                                  sess.type === 'combat' ? 'bg-red-50 text-red-700 border-red-200' : // لون الاشتباك
                                                  'bg-slate-50'
                                               }`}
                                             />

                                             {/* التوقيت */}
                                             <div className="flex items-center gap-1 justify-center opacity-60 group-hover:opacity-100 transition-opacity">
                                                <input type="time" value={sess.startTime} onChange={(e) => updateSession(template.id, daySchedule.dayName, sessIdx, 'startTime', e.target.value)} className="text-[10px] bg-transparent border-b w-10 text-center outline-none"/>
                                                <span className="text-[10px]">-</span>
                                                <input type="time" value={sess.endTime} onChange={(e) => updateSession(template.id, daySchedule.dayName, sessIdx, 'endTime', e.target.value)} className="text-[10px] bg-transparent border-b w-10 text-center outline-none"/>
                                             </div>
                                          </div>
                                        </td>
                                      ))}
                                      {/* خلية فارغة تحت زر الإضافة */}
                                      <td className="bg-slate-50 border-l"></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                          </div>

                          {/* 🟢 زر إضافة يوم جديد أسفل الجدول */}
                          <div className="p-2 border-t bg-slate-50 text-center">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => addDayRow(template.id)}
                                disabled={template.schedule.length >= 7} // تعطيل الزر إذا اكتمل الأسبوع
                                className="border-dashed w-full text-slate-500 hover:text-slate-700"
                              >
                                <Plus className="w-4 h-4 ml-2" /> إضافة يوم إضافي (الجمعة / السبت)
                              </Button>
                          </div>
                        </div>

                      </TabsContent>
                    ))}
                  </Tabs>
                )}
              </CardContent>
              <CardFooter className="bg-amber-50 p-4 flex justify-end border-t border-amber-100">
                <Button 
                  onClick={saveTrainingTemplates} 
                  disabled={loading} 
                  className="bg-amber-600 hover:bg-amber-700 text-white gap-2 font-bold px-8 shadow-lg transition-all hover:scale-105 active:scale-95"
                >
                   {loading ? (
                     <> <Loader2 className="w-4 h-4 animate-spin"/> جاري الحفظ... </>
                   ) : (
                     <> <Save className="w-4 h-4"/> اعتماد وحفظ البرنامج التدريبي </>
                   )}
                </Button>
              </CardFooter>
            </Card>
             ) : (

        // ❌ إذا لا: اظهر له هذه الرسالة بدلاً من الجدول
        <div className="flex flex-col items-center justify-center p-20 bg-slate-50 rounded-2xl border-2 border-dashed">
             <Lock className="w-12 h-12 text-slate-300 mb-4" />
             <p className="font-bold text-slate-500">عذراً، لا تملك صلاحية الوصول لهذا القسم.</p>
        </div>

    )}
          </TabsContent>
      </Tabs>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
  <AlertDialogContent dir="rtl" className="max-w-[400px] border-t-4 border-t-red-600">
    <AlertDialogHeader>
      <AlertDialogTitle className="flex items-center gap-2 text-red-600">
        <AlertTriangle className="w-5 h-5" />
        تأكيد الحذف النهائي
      </AlertDialogTitle>
      <AlertDialogDescription className="text-right pt-2 text-slate-600 leading-relaxed">
        هل أنت متأكد من حذف هذا الاختبار؟ سيؤدي هذا الإجراء إلى مسح المعايير الخاصة به من قاعدة البيانات نهائياً، ولن تظهر في صفحات رصد النتائج.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter className="flex-row-reverse gap-2 mt-4">
      <AlertDialogCancel className="flex-1">تراجع</AlertDialogCancel>
      <AlertDialogAction 
        onClick={confirmPermanentDelete} 
        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "نعم، احذف نهائياً"}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
<Dialog open={isAxisModalOpen} onOpenChange={setIsAxisModalOpen}>
  <DialogContent className="max-w-xs md:hidden" dir="rtl">
    <DialogHeader>
      <DialogTitle className="text-sm font-bold border-b pb-2">تعديل اسم المحور</DialogTitle>
    </DialogHeader>
    <div className="py-4">
      <Label className="text-xs mb-2 block">اسم المحور الحالي:</Label>
      <Input 
        value={editingAxis?.name || ""} 
        onChange={(e) => {
          if (editingAxis) {
            setEditingAxis({ ...editingAxis, name: e.target.value });
            updateAxisName(editingAxis.tabId, editingAxis.axisId, e.target.value);
          }
        }}
        className="font-bold border-orange-300 focus:ring-orange-500"
      />
    </div>
    <Button onClick={() => setIsAxisModalOpen(false)} className="w-full bg-[#0f172a] text-[#c5b391]">
      تم الحفظ
    </Button>
  </DialogContent>
</Dialog>
{/* نافذة تعديل نص المخالفة - تظهر عند الضغط على النص في الهاتف */}
<Dialog open={!!editingViolationText} onOpenChange={() => setEditingViolationText(null)}>
  <DialogContent className="max-w-[90vw] md:max-w-lg rounded-xl" dir="rtl">
    <DialogHeader className="text-right border-b pb-3">
      <DialogTitle className="text-amber-800 flex items-center gap-2">
        <PenTool className="w-5 h-5" /> تحرير نص المخالفة
      </DialogTitle>
    </DialogHeader>
    <div className="py-6 space-y-4">
      <Label className="text-xs font-bold text-slate-500">نص المخالفة الكامل:</Label>
      <textarea 
        value={editingViolationText?.value || ""}
        rows={8}
        onChange={(e) => {
          if (editingViolationText) {
            const val = toEnglishDigits(e.target.value);
            setEditingViolationText({ ...editingViolationText, value: val });
            const newData = [...disciplinaryData];
            const r = newData.find(regis => regis.id === editingViolationText.regId);
            const d = r?.degrees.find(deg => deg.id === editingViolationText.degId);
            if(d) d.items[editingViolationText.itemIdx].name = val;
            setDisciplinaryData(newData);
          }
        }}
        className="w-full p-4 text-sm bg-slate-50 border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none resize-none leading-relaxed"
        placeholder="اكتب تفاصيل المخالفة هنا..."
      />
    </div>
    <div className="flex gap-2">
      <Button onClick={() => setEditingViolationText(null)} className="flex-1 bg-amber-700 text-white font-bold">
        تم الحفظ
      </Button>
    </div>
  </DialogContent>
</Dialog>
<Dialog open={isAddSectionOpen} onOpenChange={setIsAddSectionOpen}>
  <DialogContent className="max-w-md rounded-2xl" dir="rtl">
    <DialogHeader className="text-right border-b pb-3">
      <DialogTitle className="text-blue-700 flex items-center gap-2">
        <Plus className="w-5 h-5" /> إضافة ركن تدريبي جديد
      </DialogTitle>
    </DialogHeader>
    <div className="py-6 space-y-4 text-right">
      <div className="space-y-2">
        <Label className="text-xs font-bold text-slate-500">اسم القسم (بالعربي):</Label>
        <Input 
          placeholder="مثال: الأسلحة، الرماية، المشاة..." 
          value={newSectionData.name}
          onChange={(e) => setNewSectionData({...newSectionData, name: e.target.value})}
          className="h-11 border-blue-100 focus:ring-blue-500"
        />
      </div>
      {/* رمز القسم (Key) - تحول من Input إلى Select لسهولة الاستخدام */}
<div className="space-y-2">
  <Label className="text-xs font-bold text-slate-500">نوع القسم (الربط البرمجي):</Label>
  <Select 
    value={newSectionData.key} 
    onValueChange={(val) => {
      // إذا اختار قسماً معروفاً، نأخذ اسمه ونضعه في حقل الاسم تلقائياً لتوفير الوقت
      const knownNames: any = {
        'shooting': 'الرماية',
        'infantry': 'المشاة',
        'student_teacher': 'تلميذ بدور معلم',
        'weapons': 'الأسلحة',
        'specialized_courses': 'دورات تخصيصية'
      };
      setNewSectionData({
        key: val,
        name: knownNames[val] || newSectionData.name
      });
    }}
  >
    <SelectTrigger className="h-11 border-blue-100">
      <SelectValue placeholder="اختر نوع القسم لربط البيانات" />
    </SelectTrigger>
    <SelectContent dir="rtl">
      <SelectItem value="shooting">الرماية (لربط البيانات القديمة)</SelectItem>
      <SelectItem value="infantry">المشاة (لربط البيانات القديمة)</SelectItem>
      <SelectItem value="weapons">الأسلحة</SelectItem>
      <SelectItem value="student_teacher">تلميذ بدور معلم</SelectItem>
      <SelectItem value="specialized_courses">دورات تخصيصية</SelectItem>
      <SelectItem value="custom">قسم جديد تماماً (أخرى)</SelectItem>
    </SelectContent>
  </Select>
</div>

{/* إذا اختار "قسم جديد تماماً"، نظهر له حقل لكتابة الرمز يدوياً (للمستقبل) */}
{newSectionData.key === "custom" && (
  <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
    <Label className="text-xs font-bold text-orange-500">أدخل رمزاً فريداً (بالإنجليزي):</Label>
    <Input 
      placeholder="مثال: military_law" 
      onChange={(e) => setNewSectionData({...newSectionData, key: e.target.value})}
      className="h-11 border-orange-200"
    />
  </div>
)}
    </div>
    <div className="flex gap-2">
      <Button 
        onClick={() => {
          if(newSectionData.name && newSectionData.key) {
            handleCreateMilitarySection(newSectionData.name, newSectionData.key);
            setIsAddSectionOpen(false);
            setNewSectionData({ name: "", key: "" });
          } else {
            toast.error("يرجى ملء كافة الحقول");
          }
        }} 
        className="flex-1 bg-blue-600 text-white font-bold h-11 shadow-lg"
      >
        حفظ القسم الجديد
      </Button>
      <Button variant="outline" onClick={() => setIsAddSectionOpen(false)} className="h-11">إلغاء</Button>
    </div>
  </DialogContent>
</Dialog>
<AlertDialog open={isTemplateConfirmOpen} onOpenChange={setIsTemplateConfirmOpen}>
  <AlertDialogContent dir="rtl" className="max-w-[400px] border-t-4 border-t-red-600">
    <AlertDialogHeader>
      <AlertDialogTitle className="flex items-center gap-2 text-red-600 font-black">
        <AlertTriangle className="w-5 h-5" />
        تأكيد حذف القالب التدريبي
      </AlertDialogTitle>
      <AlertDialogDescription className="text-right pt-2 text-slate-600 leading-relaxed font-bold">
        هل أنت متأكد من حذف هذا الجدول؟ <br/>
        <span className="text-red-500 text-xs mt-2 block">
          ⚠️ تنبيه: سيؤدي هذا الإجراء إلى حذف هيكل الجدول من الإعدادات، ولن يؤثر على سجلات الغياب السابقة، لكنك لن تجد هذا القالب لتعديله مستقبلاً.
        </span>
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter className="flex-row-reverse gap-2 mt-4">
      <AlertDialogCancel className="flex-1 font-bold">تراجع</AlertDialogCancel>
      <AlertDialogAction 
        onClick={() => {
          if (templateToDeleteId) {
            handleDeleteTemplate(templateToDeleteId);
            setTemplateToDeleteId(null);
          }
        }} 
        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black shadow-lg"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "نعم، احذف الجدول"}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
    </div>
    
  </ProtectedRoute>
  
  )
  
}