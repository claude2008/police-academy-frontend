"use client"

import { useState, useMemo, useEffect, Fragment } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { 
  Printer, Download, Save, Plus, Trash2, Search, Scale, Dumbbell, Swords, User, AlertTriangle, 
  ChevronLeft, ChevronRight, Eye, EyeOff, Loader2
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import * as XLSX from 'xlsx'
import ProtectedRoute from "@/components/ProtectedRoute"
// --- أنواع البيانات ---
type WeightSession = {
  id: string 
  date: string
  weights: Record<number, string> 
  imc: Record<number, number> 
  status: Record<number, string> 
  isHidden?: boolean 
}

const DRAFT_KEY = "weights_draft_sessions";

export default function WeightsPage() {
  const [soldiers, setSoldiers] = useState<any[]>([])
  const [sessions, setSessions] = useState<WeightSession[]>([])
  const [classType, setClassType] = useState("fitness")
  
  const [search, setSearch] = useState("")
  const [filterCourse, setFilterCourse] = useState("all")
  const [filterBatch, setFilterBatch] = useState("all")
  const [filterCompany, setFilterCompany] = useState("all")
  const [filterPlatoon, setFilterPlatoon] = useState("all")
  const [filterOptions, setFilterOptions] = useState<any>({ courses: [], batches: [], companies: [], platoons: [] })
  
  const [hasSearched, setHasSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null)
  
  // 🔒 قفل الأمان: لن نحفظ أي شيء في الذاكرة حتى نتأكد أننا قرأنا منها أولاً
  const [isLoadedFromStorage, setIsLoadedFromStorage] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10) 

  // 1. عند فتح الصفحة: استرجاع المسودة فوراً (قبل أي شيء)
  useEffect(() => {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
          try {
              const draftSessions = JSON.parse(savedDraft);
              if (Array.isArray(draftSessions) && draftSessions.length > 0) {
                  setSessions(draftSessions);
                  toast.info("تم استعادة جلسة سابقة غير محفوظة 💾");
              }
          } catch (e) {
              console.error("خطأ في قراءة المسودة");
          }
      }
      // نفتح القفل لنسمح بالحفظ المستقبلي
      setIsLoadedFromStorage(true);
  }, []);

  // 2. مفعول الحفظ التلقائي (محمي بالقفل)
  useEffect(() => {
      // ⛔ إذا لم ننتهي من التحميل الأولي، لا تفعل شيئاً (حماية من المسح)
      if (!isLoadedFromStorage) return;

      const unsavedSessions = sessions.filter(s => s.id.toString().startsWith("temp-"));
      
      if (unsavedSessions.length > 0) {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(unsavedSessions));
      } else {
          // نمسح الذاكرة فقط إذا كانت المصفوفة فارغة وكنا قد حملنا البيانات سابقاً
          // هذا يمنع المسح الخطأ عند التحديث
          if (sessions.length > 0 || hasSearched) {
             // يمكننا هنا ترك المسودة أو مسحها حسب الرغبة، الأفضل تركها للحفظ اليدوي
          }
      }
  }, [sessions, isLoadedFromStorage, hasSearched]);

  // 3. جلب خيارات الفلترة
  useEffect(() => {
        const fetchFilters = async () => {
            try {
                const params = new URLSearchParams()
                if (filterCourse !== 'all') params.append('course', filterCourse)
                if (filterBatch !== 'all') params.append('batch', filterBatch)
                if (filterCompany !== 'all') params.append('company', filterCompany)
                
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/filters-options?${params.toString()}`)
                
                if (res.ok) {
                    let data = await res.json();

                    // 🟢 [تطبيق قيود النطاق الذكية]
                    const userStr = localStorage.getItem("user");
                    if (userStr) {
                        const user = JSON.parse(userStr);
                        const scope = user?.extra_permissions?.scope;

                        if (user.role !== 'owner' && scope?.is_restricted) {
                            const allowedCourses = scope.courses || [];
                            const allowedCompanies = scope.companies || [];
                            const allowedPlatoons = scope.platoons || [];

                            // 1. فلترة الدورات
                            data.courses = data.courses.filter((courseName: string) => {
                                return allowedCourses.some((ac: any) => ac.startsWith(courseName));
                            });

                            // 2. فلترة السرايا والفصائل بناءً على الدورة والدفعة المختارة
                            if (filterCourse !== "all" && filterBatch !== "all") {
                                const currentKeyPrefix = `${filterCourse}||${filterBatch}->`;
                                
                                data.companies = data.companies.filter((companyName: string) => {
                                    return allowedCompanies.includes(`${currentKeyPrefix}${companyName}`);
                                });

                                data.platoons = data.platoons.filter((platoonName: string) => {
                                    return allowedPlatoons.includes(`${currentKeyPrefix}${platoonName}`);
                                });
                            } else {
                                // إفراغ السرايا والفصائل إذا لم يتم اختيار المسار الأساسي
                                data.companies = [];
                                data.platoons = [];
                            }
                        }
                    }
                    setFilterOptions(data)
                }
            } catch (e) { console.error("Filter error") }
        }
        fetchFilters()
    }, [filterCourse, filterBatch, filterCompany])
  const isPathComplete = useMemo(() => {
    // 1. الدورة أساسية دائماً
    if (filterCourse === "all" || !filterCourse) return false;

    // 2. فحص الدفعة: إذا كان هناك خيارات للدفعة ولم يختر المستخدم واحدة
    if (filterOptions.batches?.length > 0 && filterBatch === "all") return false;

    // 3. فحص السرية: إذا كان هناك خيارات للسرية ولم يختر المستخدم واحدة
    if (filterOptions.companies?.length > 0 && filterCompany === "all") return false;

    // 4. فحص الفصيل: إذا كان هناك خيارات للفصيل ولم يختر المستخدم واحدة
    if (filterOptions.platoons?.length > 0 && filterPlatoon === "all") return false;

    // إذا تجاوز كل الفحوصات، فالمسار مكتمل
    return true;
  }, [filterCourse, filterBatch, filterCompany, filterPlatoon, filterOptions]);
useEffect(() => {
      setSoldiers([]);
      setHasSearched(false);

      // ⚡ إذا اكتمل المسار تماماً، اطلب البيانات فوراً تلقائياً
      if (isPathComplete) {
          fetchData();
          setHasSearched(true);
      }
  }, [filterCourse, filterBatch, filterCompany, filterPlatoon, isPathComplete]);
  // 4. دالة جلب البيانات من السيرفر
 const fetchData = async () => {
      setLoading(true)
      // 🔑 جلب التوكن وبيانات المستخدم الحالي لتطبيق القيود
      const token = localStorage.getItem("token");
      const userStr = localStorage.getItem("user");
      const user = JSON.parse(userStr || "{}");
      const scope = user?.extra_permissions?.scope;

      const headers = { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
      };

      try {
          // أ) جلب الجنود بناءً على الفلتر الحالي (مع إرسال التوكن)
          const params = new URLSearchParams({ limit: "1000" })
          if (filterCourse !== 'all') params.append('course', filterCourse)
          if (filterBatch !== 'all') params.append('batch', filterBatch)
          if (filterCompany !== 'all') params.append('company', filterCompany)
          if (filterPlatoon !== 'all') params.append('platoon', filterPlatoon)
          
          const soldiersRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/?${params.toString()}`, {
              headers: { 'Authorization': `Bearer ${token}` } // 🛡️ التوكن الموحد
          });
          const soldiersJson = await soldiersRes.json()
          
          // 🟢 [تطبيق قيود النطاق الذكية على قائمة الجنود المستلمة]
          let rawSoldiers = soldiersJson.data || [];
          if (user.role !== 'owner' && scope?.is_restricted) {
              const allowedCourses = scope.courses || [];
              rawSoldiers = rawSoldiers.filter((s: any) => {
                  const key = `${s.course}${s.batch ? `||${s.batch}` : ''}`;
                  return allowedCourses.includes(key);
              });
          }

          // تجهيز قائمة الجنود النهائية للعرض
          const mappedSoldiers = rawSoldiers.map((s: any) => ({
              id: s.id,
              militaryId: s.military_id,
              name: s.name,
              image_url: s.image_url, // 🟢 الحفاظ على رابط الصورة السحابي
              course: s.course,
              batch: s.batch,
              company: s.company,
              platoon: s.platoon,
              height: s.height,
              initialWeight: s.initial_weight
          }));

          // ب) جلب كل الأوزان (مع إرسال التوكن للأمان)
          const weightsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/weights/`, {
              headers: { 'Authorization': `Bearer ${token}` } // 🛡️ التوكن الموحد
          });
          const weightsJson = await weightsRes.json()

          // ج) تجميع الجلسات (بناءً على الجنود الظاهرين فقط!) 🛡️
          const groupedSessions: Record<string, WeightSession> = {};
          const visibleSoldierIds = new Set(mappedSoldiers.map((s: any) => s.id));

          if (Array.isArray(weightsJson)) {
              weightsJson.forEach((rec: any) => {
                  if (visibleSoldierIds.has(rec.soldier_id)) {
                      if (!groupedSessions[rec.date]) {
                          groupedSessions[rec.date] = {
                              id: rec.date,
                              date: rec.date,
                              weights: {},
                              imc: {},
                              status: {},
                              isHidden: false
                          };
                      }
                      groupedSessions[rec.date].weights[rec.soldier_id] = rec.weight;
                      groupedSessions[rec.date].imc[rec.soldier_id] = rec.imc;
                      groupedSessions[rec.date].status[rec.soldier_id] = rec.status;
                  }
              });
          }
          
          let serverSessions = Object.values(groupedSessions);

          // د) دمج المسودات (Drafts) من المتصفح
          const savedDraft = localStorage.getItem(DRAFT_KEY);
          if (savedDraft) {
              try {
                  const draftSessions = JSON.parse(savedDraft);
                  serverSessions = [...serverSessions, ...draftSessions];
                  toast.info("تم استعادة بيانات غير محفوظة 💾");
              } catch (e) { console.error("Draft Error"); }
          }

          // هـ) الترتيب والتخلص من التكرار
          const uniqueSessions = Array.from(new Map(serverSessions.map(item => [item.id, item])).values());
          uniqueSessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          setSoldiers(mappedSoldiers)
          setSessions(uniqueSessions)

      } catch (e) { 
          console.error(e)
          toast.error("حدث خطأ أثناء جلب البيانات")
          setSoldiers([]) 
      }
      finally { setLoading(false) }
  }

  useEffect(() => {
      setCurrentPage(1);
  }, [search, filterCourse, filterBatch, filterCompany, filterPlatoon])

  const filteredData = useMemo(() => {
    return soldiers.filter(item => {
      const matchSearch = item.name.includes(search) || item.militaryId.includes(search)
      return matchSearch
    })
  }, [soldiers, search])

  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)

  const handleAddSession = () => {
    const newSession: WeightSession = {
        id: `temp-${Math.random().toString(36).substr(2, 9)}`,
        date: format(new Date(), "yyyy-MM-dd"),
        weights: {},
        imc: {},
        status: {},
        isHidden: false
    }
    setSessions(prev => [...prev, newSession])
    toast.success("تم إضافة عمود قياس جديد")
  }

  const handleShowList = () => {
      setHasSearched(true);
      fetchData(); 
  }

  const handleDeleteSession = async () => {
    if (deleteSessionId) {
        // حذف من السيرفر (للسجلات المحفوظة)
        if (!deleteSessionId.startsWith('temp-')) {
            try {
                const dateToDelete = sessions.find(s => s.id === deleteSessionId)?.date;
                
                // 🛡️ نجمع معرفات الجنود الحاليين (المفلترين) فقط
                const visibleIds = soldiers.map(s => s.id);

                if(dateToDelete && visibleIds.length > 0) {
                    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/weights/delete-specific`, { 
    method: "POST",
    headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem('token')}` // 🛡️ قفل الحماية
    },
    body: JSON.stringify({
        date: dateToDelete,
        soldier_ids: visibleIds
    })
});
                }
            } catch(e) { console.error("Failed to delete from server"); }
        }

        // تحديث الواجهة (حذف العمود محلياً)
        const updatedSessions = sessions.filter(s => s.id !== deleteSessionId);
        setSessions(updatedSessions);
        
        // تحديث المسودة
        const remainingDrafts = updatedSessions.filter(s => s.id.toString().startsWith("temp-"));
        if (remainingDrafts.length > 0) {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(remainingDrafts));
        } else {
            localStorage.removeItem(DRAFT_KEY);
        }

        setDeleteSessionId(null)
        toast.success("تم حذف الأعمدة المحددة للجنود الظاهرين")
    }
  }

  const toggleSessionVisibility = (sessionId: string) => {
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, isHidden: !s.isHidden } : s))
  }

  const handleDateChange = (sessionId: string, newDate: string) => {
    setSessions(sessions.map(s => s.id === sessionId ? { ...s, date: newDate } : s))
  }

  const calculateIMC = (weight: number, heightCm: number) => {
    if (!weight || !heightCm) return 0;
    const heightM = heightCm / 100;
    return weight / (heightM * heightM);
  }

  const getIMCStatus = (imc: number) => {
    if (imc === 0) return { text: "-", color: "text-slate-400" };
    if (imc < 18.5) return { text: "نحيف", color: "text-yellow-600 bg-yellow-100" };
    if (imc >= 18.5 && imc <= 24.9) return { text: "مثالي", color: "text-green-700 bg-green-100" };
    if (imc >= 25 && imc <= 29.9) return { text: "وزن زائد", color: "text-orange-600 bg-orange-100" };
    return { text: "سمنة", color: "text-red-600 bg-red-100" };
  }

  // ✅ دالة تحديث الوزن (معدلة لتقبل الأرقام العربية وتحولها لإنجليزية)
  const handleWeightChange = (sessionId: string, soldierId: number, rawInput: string) => {
    
    // سحر التحويل: استبدال الأرقام العربية بالإنجليزية فوراً
    const weightStr = rawInput.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());

    setSessions(sessions.map(s => {
        if (s.id === sessionId) {
            const weight = parseFloat(weightStr);
            const soldier = soldiers.find(so => so.id === soldierId);
            const imc = calculateIMC(weight, soldier?.height || 0);
            const status = getIMCStatus(imc).text;

            return {
                ...s,
                weights: { ...s.weights, [soldierId]: weightStr },
                imc: { ...s.imc, [soldierId]: imc },
                status: { ...s.status, [soldierId]: status }
            }
        }
        return s
    }))
  }

 const handleSave = async () => {
    setIsSaving(true);
    const token = localStorage.getItem("token");
    try {
        const recordsToSave: any[] = [];
        sessions.forEach(session => {
            Object.keys(session.weights).forEach(soldierIdStr => {
                const soldierId = parseInt(soldierIdStr);
                // تنظيف نهائي لأي مسافات أو أرقام غريبة
                const rawWeight = String(session.weights[soldierId]).trim();
                const weight = parseFloat(rawWeight);
                
                if (weight > 0) { 
                    recordsToSave.push({
                        soldier_id: soldierId,
                        date: session.date,
                        weight: weight,
                        imc: session.imc[soldierId] || 0,
                        status: session.status[soldierId] || "-"
                    });
                }
            });
        });

        if (recordsToSave.length === 0) {
            toast.info("لا توجد بيانات جديدة للحفظ");
            setIsSaving(false);
            return;
        }

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/weights/bulk`, {
    method: "POST",
    headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}` // 🛡️ تفعيل الحماية
    },
    body: JSON.stringify(recordsToSave)
});

        if (res.ok) {
            toast.success("تم الحفظ في قاعدة البيانات بنجاح ✅");
            localStorage.removeItem(DRAFT_KEY); // مسح المسودة فقط عند النجاح
            fetchData(); 
        } else {
            const err = await res.json();
            toast.error(err.detail || "فشل الحفظ");
        }
    } catch (e) {
        toast.error("خطأ في الاتصال بالسيرفر");
    } finally {
        setIsSaving(false);
    }
}

  const handleExportExcel = () => {
    const exportData = filteredData.map((s, index) => {
        const row: any = {
            "م": index + 1,
            "الدورة": s.course,
            "الدفعة": s.batch,
            "السرية": s.company,
            "الفصيل": s.platoon,
            "الرقم العسكري": s.militaryId,
            "الاسم": s.name,
            "الطول (سم)": s.height,
            "الوزن الأولي": s.initialWeight,
        }
        sessions.forEach((session, idx) => {
            const weight = session.weights[s.id];
            const imc = session.imc[s.id];
            const status = session.status[s.id];
            
            row[`تاريخ القياس ${idx + 1} (${session.date})`] = weight || "-";
            row[`IMC ${idx + 1}`] = imc ? imc.toFixed(2) : "-";
            row[`ملاحظة ${idx + 1}`] = status || "-";
        })
        return row;
    })

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "سجل الأوزان");
    XLSX.writeFile(workbook, `سجل_الأوزان_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("تم تصدير الملف بنجاح");
  }

  const filterText = [
    filterCourse !== 'all' ? filterCourse : 'جميع الدورات',
    filterBatch !== 'all' ? filterBatch : '',
    filterCompany !== 'all' ? `السرية ${filterCompany}` : '',
    filterPlatoon !== 'all' ? filterPlatoon : '',
  ].filter(Boolean).join(' / ');
// 🛡️ فحص اكتمال المسار المعتمد
  
  return (
    <ProtectedRoute allowedRoles={["owner","manager","admin","assistant_admin","sports_officer","sports_supervisor", "sports_trainer"]}>
    <div className="space-y-6 pb-20 md:pb-32 " dir="rtl">
      
      <style jsx global>{`
        @media print {
          @page { size: landscape; margin: 10mm; }
          nav, aside, header, .print\\:hidden { display: none !important; }
          [data-sonner-toaster], .toaster, .sonner-toast { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; zoom: 0.75; }
          body, .report-container * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          input { border: none !important; background: transparent !important; box-shadow: none !important; }
          .bg-\[\#d6c5a5\] { background-color: #d6c5a5 !important; border-color: black !important; }
          .print-header { display: block !important; margin-bottom: 20px; }
          .print-table { display: table !important; width: 100%; }
          table, th, td, input { font-size: 12px !important; color: black !important; font-weight: bold !important; }
          button, .lucide { display: none !important; }
          thead { display: table-header-group; }
          tbody { display: table-row-group; }
          tr { page-break-inside: avoid; }
        }
          tr { height: 35px !important; }
          td, th { padding: 4px !important; vertical-align: middle; }
          .add-session-col { display: none !important; }
      `}</style>

      {/* الرأس */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Scale className="w-8 h-8 text-blue-600" />
            متابعة الأوزان والمؤشرات الحيوية (IMC)
          </h1>
          <p className="text-slate-500 mt-1">سجل دوري لمتابعة التطور البدني للمجندين</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" disabled={!isPathComplete} onClick={() => { document.title = `متابعة الأوزان - ${filterText}`; window.print(); }} className="gap-2"><Printer className="w-4 h-4" /> طباعة</Button>
            <Button variant="outline" disabled={!isPathComplete} onClick={handleExportExcel} className="gap-2 border-green-600 text-green-700 hover:bg-green-50"><Download className="w-4 h-4" /> Excel</Button>
            <Button onClick={handleSave} disabled={isSaving || !isPathComplete} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ السجل
            </Button>
        </div>
      </div>

      {/* الفلاتر */}
      <Card className="print:hidden">
        <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
                
                <div className="hidden">
                    <Select value={classType} onValueChange={setClassType}>
                        <SelectTrigger className={`w-[200px] h-10 font-bold border-2 border-slate-400 ${classType === 'fitness' ? 'bg-blue-100 text-blue-900' : 'bg-red-100 text-red-900'}`}>
                            <div className="flex items-center gap-2">
                                {classType === 'fitness' ? <Dumbbell className="w-4 h-4" /> : <Swords className="w-4 h-4" />}
                                <SelectValue />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="fitness">لياقة بدنية</SelectItem>
                            <SelectItem value="combat">اشتباك ودفاع عن النفس</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid grid-cols-2 gap-1 w-full md:flex md:w-auto md:gap-2">
                    <Select value={filterCourse} onValueChange={(val) => {
                        setFilterCourse(val);
                        setFilterBatch("all");
                        setFilterCompany("all");
                        setFilterPlatoon("all");
                    }}>
                        <SelectTrigger className="w-full md:w-[140px] px-1 text-[14px] md:text-sm h-9">
                            <SelectValue placeholder="الدورة" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">الدورة</SelectItem>
                            {filterOptions.courses?.map((c:any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Select value={filterBatch} onValueChange={(val) => {
                        setFilterBatch(val);
                        setFilterCompany("all");
                        setFilterPlatoon("all");
                    }}>
                        <SelectTrigger className="w-full md:w-[140px] px-1 text-[14px] md:text-sm h-9">
                            <SelectValue placeholder="الدفعة" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">الدفعة</SelectItem>
                            {filterOptions.batches?.map((b:any) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Select value={filterCompany} onValueChange={(val) => {
                        setFilterCompany(val);
                        setFilterPlatoon("all");
                    }}>
                        <SelectTrigger className="w-full md:w-[140px] px-1 text-[14px] md:text-sm h-9">
                            <SelectValue placeholder="السرية" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">السرية</SelectItem>
                            {filterOptions.companies?.map((c:any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Select value={filterPlatoon} onValueChange={setFilterPlatoon}>
                        <SelectTrigger className="w-full md:w-[140px] px-1 text-[14px] md:text-sm h-9">
                            <SelectValue placeholder="الفصيل" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">الفصيل</SelectItem>
                            {filterOptions.platoons?.map((p:any) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t">
                <Search className="w-5 h-5 text-slate-400" />
                <Input placeholder="بحث بالاسم أو الرقم العسكري..." className="max-w-md" value={search} onChange={(e) => setSearch(e.target.value)} />
                <Button onClick={handleAddSession} size="icon" className="md:hidden bg-green-600 text-white hover:bg-green-700 shrink-0"><Plus className="w-5 h-5" /></Button>
                <div className="flex-1"></div>
                <Button 
    onClick={handleShowList} 
    disabled={loading || !isPathComplete} 
    className={`${!isPathComplete ? 'opacity-50 cursor-not-allowed' : ''} bg-slate-900 text-white w-32`}
>
    {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : "عرض القائمة"}
</Button>
            </div>
        </CardContent>
      </Card>

      {/* المحتوى (شاشة + طباعة) */}
      {hasSearched && (
        <>
        <div className="border rounded-lg bg-white shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 print:hidden">
            <div className="overflow-x-auto">
                <Table className="border-collapse w-max min-w-full">
                    <TableHeader>
                        <TableRow className="bg-[#c5b391] border-b border-black">
                            <TableHead rowSpan={2} className="w-[40px] text-center border border-black text-black font-bold static md:sticky md:right-0 z-20 bg-[#c5b391]">#</TableHead>
                            <TableHead rowSpan={2} className="w-[60px] text-center border border-black text-black font-bold print:hidden hidden md:table-cell">الصورة</TableHead>
                            <TableHead rowSpan={2} className="w-[80px] text-center border border-black text-black font-bold hidden md:table-cell">الرقم العسكري</TableHead>
                            <TableHead rowSpan={2} className="max-w-[160px] w-[160px] md:max-w-none md:w-[200px] text-center border border-black text-black font-bold sticky center-0 md:center-[70px] z-30 bg-[#c5b391] shadow-[-2px_0px_5px_rgba(0,0,0,0.2)]">الاسم</TableHead>
                            <TableHead rowSpan={2} className="w-[50px] text-center border border-black text-black font-bold text-[10px] md:text-xs">الطول</TableHead>
                            {sessions.map((session) => {
                                if (session.isHidden) {
                                    return (
                                        <TableHead key={session.id} rowSpan={2} className="text-center border border-black p-0 w-[40px] bg-gray-200 align-middle">
                                            <div className="flex flex-col items-center justify-center h-full gap-2 py-2">
                                                <Button size="icon" variant="ghost" onClick={() => toggleSessionVisibility(session.id)} className="h-6 w-6 text-blue-700 hover:bg-blue-100"><Eye className="w-4 h-4" /></Button>
                                                <span className="text-[9px] font-bold [writing-mode:vertical-rl] rotate-180 whitespace-nowrap text-slate-500">{session.date}</span>
                                            </div>
                                        </TableHead>
                                    )
                                }
                                return (
                                    <TableHead key={session.id} colSpan={3} className="text-center border border-black p-1 min-w-[220px] bg-[#d6c5a5]">
                                        <div className="flex items-center justify-center gap-1">
                                            <span className="text-black font-bold text-[10px]">تاريخ:</span>
                                            <Input type="date" value={session.date} onChange={(e) => handleDateChange(session.id, e.target.value)} className="h-6 w-[95px] bg-white/50 border-none text-[10px] font-bold text-center p-0" />
                                            <div className="flex gap-0">
                                                <Button size="icon" variant="ghost" onClick={() => toggleSessionVisibility(session.id)} className="h-6 w-6 text-slate-700 hover:bg-slate-200"><EyeOff className="w-3 h-3" /></Button>
                                                <button onClick={() => setDeleteSessionId(session.id)} className="text-red-600 hover:text-red-800 px-1"><Trash2 className="w-3 h-3" /></button>
                                            </div>
                                        </div>
                                    </TableHead>
                                )
                            })}
                            <TableHead rowSpan={2} className="text-center border border-black w-[50px] bg-slate-100 cursor-pointer hover:bg-slate-200 transition-colors hidden md:table-cell" onClick={handleAddSession}>
                                <div className="flex flex-col items-center justify-center h-full gap-1"><Plus className="w-6 h-6 text-blue-600" /><span className="text-[10px] font-bold text-blue-700">جديد</span></div>
                            </TableHead>
                        </TableRow>
                        <TableRow className="bg-[#e0d4bc] border-b border-black">
                            {sessions.map((session) => {
                                if (session.isHidden) return null;
                                return (
                                    <Fragment key={session.id}>
                                        <TableHead className="text-center border border-black text-black font-bold text-[10px] w-[60px]">الوزن</TableHead>
                                        <TableHead className="text-center border border-black text-black font-bold text-[10px] w-[60px]">IMC</TableHead>
                                        <TableHead className="text-center border border-black text-black font-bold text-[10px] w-[80px]">الملاحظة</TableHead>
                                    </Fragment>
                                )
                            })}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredData.length === 0 ? (
                             <TableRow><TableCell colSpan={10} className="h-24 text-center">لا توجد بيانات</TableCell></TableRow>
                        ) : (
                            paginatedData.map((soldier, index) => (
                                <TableRow key={soldier.id} className="hover:bg-slate-50">
                                    <TableCell className="text-center border border-slate-300 font-mono text-xs static md:sticky md:right-0 z-10 md:bg-white border-l-0">{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
                                    <TableCell className="text-center border border-slate-300 hidden md:table-cell">
    <div className="w-9 h-9 bg-slate-100 rounded-full mx-auto flex items-center justify-center overflow-hidden border-2 border-slate-200 relative group shadow-sm">
        <img 
            // 🟢 استخدام الرابط السحابي المباشر مع التايم ستامب لتجنب الكاش
            src={soldier.image_url ? `${soldier.image_url}?t=${new Date().getTime()}` : "/placeholder-user.png"} 
            alt={soldier.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            onError={(e) => { 
                // في حال فشل التحميل، نعرض الصورة الافتراضية
                (e.target as HTMLImageElement).src = "/placeholder-user.png";
            }} 
        />
        {/* أيقونة احتياطية تظهر في الخلفية فقط */}
        <User className="w-4 h-4 text-slate-300 absolute z-[-1]" />
    </div>
</TableCell>
                                    <TableCell className="text-right border border-slate-300 font-bold text-xs hidden md:table-cell">{soldier.militaryId}</TableCell>
                                    <TableCell className="text-right border border-slate-300 font-medium text-xs sticky right-0 md:right-[40px] z-20 bg-slate-50 dark:bg-slate-950 shadow-[-2px_0px_5px_rgba(0,0,0,0.15)] max-w-[160px] md:max-w-none truncate">{soldier.name}</TableCell>
                                    <TableCell className="text-center border border-slate-300 font-mono text-xs bg-slate-50">{soldier.height}</TableCell>
                                    {sessions.map((session) => {
                                        if (session.isHidden) return <TableCell key={session.id} className="border border-slate-300 bg-gray-100 min-w-[40px] p-0"></TableCell>
                                        const weight = session.weights[soldier.id] || "";
                                        const imc = calculateIMC(parseFloat(weight), soldier.height);
                                        const status = getIMCStatus(imc);
                                        return (
                                            <Fragment key={session.id}>
                                                <TableCell className="p-1 border border-slate-300"><Input 
    type="text"             // 👈 التغيير هنا: جعلناه نصاً ليقبل الكتابة العربية
    inputMode="decimal"     // 👈 إضافة مهمة: تظهر لوحة الأرقام في الموبايل
    value={weight} 
    onChange={(e) => handleWeightChange(session.id, soldier.id, e.target.value)} 
    className="h-8 w-full text-center font-bold bg-white border-transparent hover:border-slate-300 focus:border-blue-500 text-xs px-0"  
    placeholder="0" 
/></TableCell>
                                                <TableCell className="text-center border border-slate-300 font-mono text-xs font-bold bg-slate-50">{imc > 0 ? imc.toFixed(1) : "-"}</TableCell>
                                                <TableCell className="text-center border border-slate-300 p-1">{imc > 0 && (<span className={`text-[9px] font-bold px-1 py-0.5 rounded-full block w-full ${status.color} border whitespace-nowrap overflow-hidden text-ellipsis`}>{status.text}</span>)}</TableCell>
                                            </Fragment>
                                        )
                                    })}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-between bg-white dark:bg-slate-900 p-4 border-t gap-4 print:hidden">
                <div className="flex items-center gap-4 text-sm text-slate-500">
                    <span>صفحة <b>{currentPage}</b> من <b>{totalPages || 1}</b></span>
                    <div className="flex items-center gap-2 mr-4 border-r pr-4">
                        <span className="text-xs font-bold">عرض:</span>
                        <Select value={String(itemsPerPage)} onValueChange={(val) => { setItemsPerPage(Number(val)); setCurrentPage(1); }}>
                            <SelectTrigger className="w-[70px] h-8 text-xs bg-slate-50">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="20">20</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
                        <ChevronLeft className="w-4 h-4 ml-1" /> السابق
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage >= totalPages}>
                        التالي <ChevronRight className="w-4 h-4 mr-1" />
                    </Button>
                </div>
            </div>
        </div>

        {/* 2. جدول الطباعة */}
        <div className="hidden print:block">
             <div className="print-header w-full border-b-2 border-black pb-4 mb-4 text-black">
                <div className="flex justify-between items-center w-full">
                    <div className="w-32 h-32">
                        <img src="/logo.jpg" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <div className="text-center">
                        <h2 className="text-xl font-bold">مـعهد الشرطـة - فـرع التدريب الرياضـي</h2>
                        <h1 className="text-2xl font-bold underline mt-2">سجل متابعة الأوزان وقياسات IMC</h1>
                        <p className="text-sm font-bold mt-2 px-4 py-1 border border-black rounded inline-block">{filterText}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2"><div className="min-w-[80px] text-center border-b border-dotted border-black pb-1 font-bold">{format(new Date(), "EEEE", { locale: ar })}</div><span className="font-bold">:اليوم</span></div>
                        <div className="flex items-center gap-2"><div className="min-w-[80px] text-center border-b border-dotted border-black pb-1 font-bold">{format(new Date(), "yyyy-MM-dd")}</div><span className="font-bold">:التاريخ</span></div>
                    </div>
                </div>
             </div>

             <table className="w-full border-collapse print-table">
                <thead>
                    <tr className="bg-[#c5b391]">
                        <th className="border border-black p-1 text-[10px] font-bold text-black w-[30px]">#</th>
                        <th className="border border-black p-1 text-[10px] font-bold text-black w-[80px]">الرقم العسكري</th>
                        <th className="border border-black p-1 text-[10px] font-bold text-black w-[170px]">الاسم</th>
                        <th className="border border-black p-1 text-[10px] font-bold text-black w-[50px]">الطول</th>
                        {sessions.map(session => {
                            if (session.isHidden) return null;
                            return (
                                <th key={session.id} colSpan={3} className="border border-black p-1 bg-[#d6c5a5]">
                                    <div className="text-[10px] font-bold text-black">قياس: {session.date}</div>
                                </th>
                            )
                        })}
                    </tr>
                    <tr className="bg-[#e0d4bc]">
                         <th colSpan={4} className="border border-black"></th>
                         {sessions.map(session => {
                            if (session.isHidden) return null;
                            return (
                                <Fragment key={session.id}>
                                    <th className="border border-black text-[9px] font-bold text-black">الوزن</th>
                                    <th className="border border-black text-[9px] font-bold text-black">IMC</th>
                                    <th className="border border-black text-[9px] font-bold text-black">ملاحظة</th>
                                </Fragment>
                            )
                        })}
                    </tr>
                </thead>
                <tbody>
                    {filteredData.map((soldier, index) => (
                        <tr key={soldier.id}>
                            <td className="border border-black text-center text-[10px] font-mono">{index + 1}</td>
                            <td className="border border-black text-center text-[10px] font-bold">{soldier.militaryId}</td>
                            <td className="border border-black text-center text-[10px] font-medium px-1 whitespace-nowrap">{soldier.name}</td>
                            <td className="border border-black text-center text-[10px] font-mono">{soldier.height}</td>
                            {sessions.map(session => {
                                if (session.isHidden) return null;
                                const weight = session.weights[soldier.id] || "";
                                const imc = calculateIMC(parseFloat(weight), soldier.height);
                                const status = getIMCStatus(imc);
                                return (
                                    <Fragment key={session.id}>
                                        <td className="border border-black text-center text-[10px] font-bold">{weight || "-"}</td>
                                        <td className="border border-black text-center text-[10px] font-mono">{imc > 0 ? imc.toFixed(1) : "-"}</td>
                                        <td className="border border-black text-center text-[9px]">{status.text !== "-" ? status.text : ""}</td>
                                    </Fragment>
                                )
                            })}
                        </tr>
                    ))}
                </tbody>
             </table>
        </div>
        </>
      )}
      
      <AlertDialog open={!!deleteSessionId} onOpenChange={() => setDeleteSessionId(null)}>
        <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="w-5 h-5" />
                    حذف قياس
                </AlertDialogTitle>
                <AlertDialogDescription>
                    هل أنت متأكد من حذف هذا العمود (القياس)؟ سيتم فقدان جميع البيانات المدخلة فيه.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteSession} className="bg-red-600 hover:bg-red-700">تأكيد الحذف</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
    </ProtectedRoute>
  )
}