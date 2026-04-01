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
  ChevronLeft, ChevronRight, Eye, EyeOff, Loader2, X, Zap, Users, CheckCircle2
} from "lucide-react"
import { Label } from "@/components/ui/label"
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
  const [allCourseSoldiers, setAllCourseSoldiers] = useState<any[]>([]) // 🆕 لحفظ كل طلاب الدورة
  const [sessions, setSessions] = useState<WeightSession[]>([])
  const [classType, setClassType] = useState("fitness")
  
  const [search, setSearch] = useState("")
  const [filterCourse, setFilterCourse] = useState("all")
  const [filterBatch, setFilterBatch] = useState("all")
  const [filterCompany, setFilterCompany] = useState("all")
  const [filterPlatoon, setFilterPlatoon] = useState("all")
  const [filterOptions, setFilterOptions] = useState<any>({ courses: [], batches: [], companies: [], platoons: [] })
  
  // 🟢 حالات وضع الترحيل السريع
  const [isQuickMode, setIsQuickMode] = useState(false);
  const [quickSearchId, setQuickSearchId] = useState("");
  const [quickList, setQuickList] = useState<any[]>([]);
  const [quickDate, setQuickDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [hasSearched, setHasSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null)
  
  // 🆕 حالة وضع عرض الموزونين فقط
  const [showWeighedOnly, setShowWeighedOnly] = useState(false);
  
  // 🔒 قفل الأمان
  const [isLoadedFromStorage, setIsLoadedFromStorage] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50) 

  // 1. استرجاع المسودة عند فتح الصفحة
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
      setIsLoadedFromStorage(true);
  }, []);

  // 2. الحفظ التلقائي للمسودات
  useEffect(() => {
      if (!isLoadedFromStorage) return;

      const unsavedSessions = sessions.filter(s => s.id.toString().startsWith("temp-"));
      
      if (unsavedSessions.length > 0) {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(unsavedSessions));
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

                    const userStr = localStorage.getItem("user");
                    if (userStr) {
                        const user = JSON.parse(userStr);
                        const scope = user?.extra_permissions?.scope;

                        if (user.role !== 'owner' && scope?.is_restricted) {
                            const allowedCourses = scope.courses || [];
                            const allowedCompanies = scope.companies || [];
                            const allowedPlatoons = scope.platoons || [];

                            data.courses = data.courses.filter((courseName: string) => {
                                return allowedCourses.some((ac: any) => ac.startsWith(courseName));
                            });

                            if (filterCourse !== "all" && filterBatch !== "all") {
                                const currentKeyPrefix = `${filterCourse}||${filterBatch}->`;
                                
                                data.companies = data.companies.filter((companyName: string) => {
                                    return allowedCompanies.includes(`${currentKeyPrefix}${companyName}`);
                                });

                                data.platoons = data.platoons.filter((platoonName: string) => {
                                    return allowedPlatoons.includes(`${currentKeyPrefix}${platoonName}`);
                                });
                            } else {
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
    if (filterCourse === "all" || !filterCourse) return false;
    if (filterOptions.batches?.length > 0 && filterBatch === "all") return false;
    if (filterOptions.companies?.length > 0 && filterCompany === "all") return false;
    if (filterOptions.platoons?.length > 0 && filterPlatoon === "all") return false;
    return true;
  }, [filterCourse, filterBatch, filterCompany, filterPlatoon, filterOptions]);

  useEffect(() => {
      setSoldiers([]);
      setHasSearched(false);

      if (isPathComplete) {
          fetchData();
          setHasSearched(true);
      }
  }, [filterCourse, filterBatch, filterCompany, filterPlatoon, isPathComplete]);

  // 4. دالة جلب البيانات من السيرفر
  const fetchData = async () => {
      setLoading(true)
      const token = localStorage.getItem("token");
      const userStr = localStorage.getItem("user");
      const user = JSON.parse(userStr || "{}");
      const scope = user?.extra_permissions?.scope;

      const headers = { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
      };

      try {
          const params = new URLSearchParams({ limit: "1000" })
          if (filterCourse !== 'all') params.append('course', filterCourse)
          if (filterBatch !== 'all') params.append('batch', filterBatch)
          if (filterCompany !== 'all') params.append('company', filterCompany)
          if (filterPlatoon !== 'all') params.append('platoon', filterPlatoon)
          
          const soldiersRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/?${params.toString()}`, {
              headers: { 'Authorization': `Bearer ${token}` }
          });
          const soldiersJson = await soldiersRes.json()
          
          let rawSoldiers = soldiersJson.data || [];
          if (user.role !== 'owner' && scope?.is_restricted) {
              const allowedCourses = scope.courses || [];
              rawSoldiers = rawSoldiers.filter((s: any) => {
                  const key = `${s.course}${s.batch ? `||${s.batch}` : ''}`;
                  return allowedCourses.includes(key);
              });
          }

          const mappedSoldiers = rawSoldiers.map((s: any) => ({
              id: s.id,
              militaryId: s.military_id,
              name: s.name,
              image_url: s.image_url,
              course: s.course,
              batch: s.batch,
              company: s.company,
              platoon: s.platoon,
              height: s.height,
              initialWeight: s.initial_weight
          }));

          const weightsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/weights/`, {
              headers: { 'Authorization': `Bearer ${token}` }
          });
          const weightsJson = await weightsRes.json()

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

          const savedDraft = localStorage.getItem(DRAFT_KEY);
          if (savedDraft) {
              try {
                  const draftSessions = JSON.parse(savedDraft);
                  serverSessions = [...serverSessions, ...draftSessions];
                  toast.info("تم استعادة بيانات غير محفوظة 💾");
              } catch (e) { console.error("Draft Error"); }
          }

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

  // 🆕 دالة جلب كل طلاب الدورة/الدفعة (للوضع الجديد)
  const fetchAllCourseSoldiers = async () => {
      setLoading(true);
      const token = localStorage.getItem("token");
      const userStr = localStorage.getItem("user");
      const user = JSON.parse(userStr || "{}");
      const scope = user?.extra_permissions?.scope;

      try {
          // 🔹 طلب API بدون قيود السرية والفصيل
          const params = new URLSearchParams({ limit: "1000" });
          if (filterCourse !== 'all') params.append('course', filterCourse);
          if (filterBatch !== 'all') params.append('batch', filterBatch);
          // ❌ لا نرسل company أو platoon

          const soldiersRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/?${params.toString()}`, {
              headers: { 'Authorization': `Bearer ${token}` }
          });
          const soldiersJson = await soldiersRes.json();

          let rawSoldiers = soldiersJson.data || [];
          if (user.role !== 'owner' && scope?.is_restricted) {
              const allowedCourses = scope.courses || [];
              rawSoldiers = rawSoldiers.filter((s: any) => {
                  const key = `${s.course}${s.batch ? `||${s.batch}` : ''}`;
                  return allowedCourses.includes(key);
              });
          }

          const mappedSoldiers = rawSoldiers.map((s: any) => ({
              id: s.id,
              militaryId: s.military_id,
              name: s.name,
              image_url: s.image_url,
              course: s.course,
              batch: s.batch,
              company: s.company,
              platoon: s.platoon,
              height: s.height,
              initialWeight: s.initial_weight
          }));

          // 🔹 جلب الأوزان لكل الطلاب
          const weightsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/weights/`, {
              headers: { 'Authorization': `Bearer ${token}` }
          });
          const weightsJson = await weightsRes.json();

          const groupedSessions: Record<string, WeightSession> = {};
          const allSoldierIds = new Set(mappedSoldiers.map((s: any) => s.id));

          if (Array.isArray(weightsJson)) {
              weightsJson.forEach((rec: any) => {
                  if (allSoldierIds.has(rec.soldier_id)) {
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
          const uniqueSessions = Array.from(new Map(serverSessions.map(item => [item.id, item])).values());
          uniqueSessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          setAllCourseSoldiers(mappedSoldiers);
          setSessions(uniqueSessions);

      } catch (e) {
          console.error(e);
          toast.error("حدث خطأ أثناء جلب بيانات الدورة");
      } finally {
          setLoading(false);
      }
  }

  // 🆕 دالة التبديل بين الوضعين
  const handleToggleWeighedOnly = async () => {
      if (!showWeighedOnly) {
          // تفعيل وضع الموزونين - نحتاج بيانات الدورة الكاملة
          await fetchAllCourseSoldiers();
          setShowWeighedOnly(true);
          setCurrentPage(1);
          toast.success("تم عرض الطلاب الموزونين من الدورة كاملة ✅");
      } else {
          // العودة للوضع العادي
          setShowWeighedOnly(false);
          setAllCourseSoldiers([]);
          setCurrentPage(1);
          toast.info("تم العودة للعرض العادي");
      }
  }

  // 🔍 دالة البحث السريع
  const handleQuickSearch = async () => {
    if (!quickSearchId.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/search-by-id?military_id=${quickSearchId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) {
        const soldier = await res.json();
        if (!quickList.find(s => s.id === soldier.id)) {
          setQuickList([{ ...soldier, weight: "", imc: 0, status: "-" }, ...quickList]);
          setQuickSearchId("");
        } else {
          toast.warning("هذا الجندي مضاف بالفعل");
        }
      } else {
        toast.error("الرقم العسكري غير موجود");
      }
    } finally {
      setLoading(false);
    }
  };

  // 🚀 دالة الترحيل السريع
  const handleQuickTransfer = async () => {
    const recordsToSave = quickList
      .filter(s => parseFloat(s.weight) > 0)
      .map(s => ({
        soldier_id: s.id,
        date: quickDate,
        weight: parseFloat(s.weight),
        imc: s.imc,
        status: s.status
      }));

    if (recordsToSave.length === 0) return toast.error("يرجى إدخال الأوزان أولاً");

    setIsSaving(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/weights/bulk`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}` 
        },
        body: JSON.stringify(recordsToSave)
      });

      if (res.ok) {
        toast.success(`تم ترحيل ${recordsToSave.length} وزن بنجاح ✅`);
        setQuickList([]);
        if (isPathComplete) fetchData();
      }
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
      setCurrentPage(1);
  }, [search, filterCourse, filterBatch, filterCompany, filterPlatoon])

  // 🆕 تحديد البيانات المعروضة بناءً على الوضع
  const baseData = showWeighedOnly ? allCourseSoldiers : soldiers;

  const filteredData = useMemo(() => {
    let data = baseData.filter(item => {
      const matchSearch = item.name.includes(search) || item.militaryId.includes(search);
      return matchSearch;
    });

    // 🆕 إذا كنا في وضع الموزونين فقط، نفلتر فقط من لديهم أوزان
    if (showWeighedOnly) {
        data = data.filter(soldier => {
            return sessions.some(session => 
                session.weights[soldier.id] && 
                parseFloat(session.weights[soldier.id]) > 0
            );
        });
    }

    return data;
  }, [baseData, search, showWeighedOnly, sessions])

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
        if (!deleteSessionId.startsWith('temp-')) {
            try {
                const dateToDelete = sessions.find(s => s.id === deleteSessionId)?.date;
                const visibleIds = baseData.map(s => s.id);

                if(dateToDelete && visibleIds.length > 0) {
                    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/weights/delete-specific`, { 
                        method: "POST",
                        headers: { 
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify({
                            date: dateToDelete,
                            soldier_ids: visibleIds
                        })
                    });
                }
            } catch(e) { console.error("Failed to delete from server"); }
        }

        const updatedSessions = sessions.filter(s => s.id !== deleteSessionId);
        setSessions(updatedSessions);
        
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

  const handleWeightChange = (sessionId: string, soldierId: number, rawInput: string) => {
    const weightStr = rawInput.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());

    setSessions(sessions.map(s => {
        if (s.id === sessionId) {
            const weight = parseFloat(weightStr);
            const soldier = baseData.find(so => so.id === soldierId);
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
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify(recordsToSave)
        });

        if (res.ok) {
            toast.success("تم الحفظ في قاعدة البيانات بنجاح ✅");
            localStorage.removeItem(DRAFT_KEY);
            if (showWeighedOnly) {
                await fetchAllCourseSoldiers();
            } else {
                fetchData();
            }
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
        }
        
        // 🆕 إضافة السرية والفصيل في وضع الموزونين فقط
        if (showWeighedOnly) {
            row["السرية"] = s.company;
            row["الفصيل"] = s.platoon;
        }
        
        row["الرقم العسكري"] = s.militaryId;
        row["الاسم"] = s.name;
        row["الطول (سم)"] = s.height;
        row["الوزن الأولي"] = s.initialWeight;
        
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
    const filename = showWeighedOnly 
        ? `الطلاب_الموزونين_${format(new Date(), "yyyy-MM-dd")}.xlsx`
        : `سجل_الأوزان_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    XLSX.writeFile(workbook, filename);
    toast.success("تم تصدير الملف بنجاح");
  }

  const filterText = [
    filterCourse !== 'all' ? filterCourse : 'جميع الدورات',
    filterBatch !== 'all' ? filterBatch : '',
    !showWeighedOnly && filterCompany !== 'all' ? `السرية ${filterCompany}` : '',
    !showWeighedOnly && filterPlatoon !== 'all' ? filterPlatoon : '',
  ].filter(Boolean).join(' / ');

  const reportTitle = showWeighedOnly 
    ? "سجل الطلاب الموزونين - الدورة كاملة"
    : "سجل متابعة الأوزان وقياسات IMC";
  
  return (
    <ProtectedRoute allowedRoles={["owner","manager","admin","assistant_admin","sports_officer","sports_supervisor", "sports_trainer"]}>
    <div className="space-y-6 pb-20 md:pb-32" dir="rtl">
      
      <style jsx global>{`
        @media print {
          @page { size: landscape; margin: 10mm; }
          nav, aside, header, .print\\:hidden { display: none !important; }
          [data-sonner-toaster], .toaster, .sonner-toast { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; zoom: 0.75; }
          body, .report-container * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          input { border: none !important; background: transparent !important; box-shadow: none !important; }
          .bg-\\[\\#d6c5a5\\] { background-color: #d6c5a5 !important; border-color: black !important; }
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
            {/* 🆕 زر التبديل للموزونين فقط */}
            <Button 
              variant={showWeighedOnly ? "default" : "outline"}
              onClick={handleToggleWeighedOnly}
              disabled={filterCourse === 'all' || loading}
              className={`gap-2 font-bold shadow-md transition-all ${
                showWeighedOnly 
                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                  : 'border-green-600 text-green-700 hover:bg-green-50'
              }`}
            >
              {showWeighedOnly ? (
                <>
                  <X className="w-4 h-4" />
                  إلغاء
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  الموزونون
                </>
              )}
            </Button>
            
            <Button variant="outline" disabled={!isPathComplete && !showWeighedOnly} onClick={() => { document.title = `${reportTitle} - ${filterText}`; window.print(); }} className="gap-2">
              <Printer className="w-4 h-4" /> طباعة
            </Button>
            <Button variant="outline" disabled={!isPathComplete && !showWeighedOnly} onClick={handleExportExcel} className="gap-2 border-green-600 text-green-700 hover:bg-green-50">
              <Download className="w-4 h-4" /> Excel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || (!isPathComplete && !showWeighedOnly)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ
            </Button>
        </div>
      </div>

      {/* 🆕 إشعار وضع الموزونين */}
      {showWeighedOnly && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-r-4 border-green-600 p-4 rounded-lg shadow-md animate-in slide-in-from-top print:hidden">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-green-800 text-lg">
                وضع الموزونين النشط - عرض الدورة كاملة
              </p>
              <p className="text-sm text-green-700 mt-1">
                يتم عرض <span className="font-black text-green-900">{filteredData.length}</span> طالب موزون من 
                <span className="font-bold"> {filterCourse}</span>
                {filterBatch !== 'all' && <span className="font-bold"> / {filterBatch}</span>}
                <span className="text-xs mr-2">(كل السرايا والفصائل)</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* زر الترحيل السريع */}
      <div className="flex justify-end mb-2 print:hidden">
        <Button 
          variant={isQuickMode ? "destructive" : "default"}
          onClick={() => setIsQuickMode(!isQuickMode)}
          className="gap-2 font-bold shadow-lg"
        >
          {isQuickMode ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {isQuickMode ? "إغلاق الترحيل السريع" : "وضع الترحيل السريع "}
        </Button>
      </div>

      {/* واجهة الترحيل السريع */}
      {isQuickMode && (
        <Card className="bg-blue-50 border-blue-200 border-2 shadow-xl animate-in zoom-in-95 print:hidden mb-6">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-blue-100 pb-2">
               <h3 className="font-black text-blue-800 flex items-center gap-2 text-lg">
                 <Zap className="w-6 h-6 animate-pulse text-amber-500" /> الإدخال السريع للأوزان
               </h3>
               <div className="flex items-center gap-2">
                  <Label className="font-bold text-blue-700">تاريخ الترحيل:</Label>
                  <Input type="date" value={quickDate} onChange={(e)=>setQuickDate(e.target.value)} className="w-40 h-9 bg-white font-bold" />
               </div>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-3 w-5 h-5 text-slate-400" />
                <Input 
                  placeholder="ابحث بالرقم العسكري واضغط Enter..." 
                  className="h-11 pr-10 text-lg font-bold border-2 border-blue-200"
                  value={quickSearchId}
                  onChange={(e) => setQuickSearchId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickSearch()}
                />
              </div>
              <Button onClick={handleQuickSearch} disabled={loading} className="h-11 px-8 bg-blue-600 hover:bg-blue-700">
                {loading ? <Loader2 className="animate-spin" /> : "إضافة"}
              </Button>
            </div>

            {quickList.length > 0 && (
              <div className="border-2 border-blue-100 rounded-2xl bg-white overflow-hidden shadow-inner">
                <Table>
                  <TableHeader className="bg-blue-600">
                    <TableRow>
                      <TableHead className="text-white font-bold text-center w-[70px]">الصورة</TableHead>
                      <TableHead className="text-white font-bold text-center">الاسم</TableHead>
                      <TableHead className="text-white font-bold text-center">السرية/الفصيل</TableHead>
                      <TableHead className="text-white font-bold text-center w-32">الوزن الحالي</TableHead>
                      <TableHead className="text-white font-bold text-center">الحالة (IMC)</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quickList.map((s, index) => (
                      <TableRow key={s.id} className="border-b border-blue-50 hover:bg-blue-50/30 transition-colors">
                        <TableCell className="text-center">
                            <div className="w-10 h-10 rounded-full border-2 border-blue-100 overflow-hidden mx-auto shadow-sm bg-slate-100">
                                <img 
                                    src={s.image_url ? `${s.image_url}?t=${new Date().getTime()}` : "/placeholder-user.png"} 
                                    alt="" 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {(e.target as HTMLImageElement).src = "/placeholder-user.png"}}
                                />
                            </div>
                        </TableCell>

                        <TableCell className="font-black text-slate-800 text-center text-sm">
                            {s.name}
                        </TableCell>

                        <TableCell className="text-center text-[10px] font-bold text-slate-500">
                            {s.company} / {s.platoon}
                        </TableCell>

                        <TableCell>
                          <Input 
                            type="text"
                            inputMode="decimal"
                            className="h-9 text-center font-black border-2 border-amber-200 focus:border-amber-500 bg-amber-50/30"
                            placeholder="00.0"
                            value={s.weight}
                            onChange={(e) => {
                              const rawInput = e.target.value;
                              const weightStr = rawInput.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
                              const newList = [...quickList];
                              const w = parseFloat(weightStr);
                              newList[index].weight = weightStr;
                              newList[index].imc = calculateIMC(w, s.height);
                              newList[index].status = getIMCStatus(newList[index].imc).text;
                              setQuickList(newList);
                            }}
                          />
                        </TableCell>

                        <TableCell className="text-center">
                           <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${getIMCStatus(s.imc).color}`}>
                             {s.status}
                           </span>
                        </TableCell>

                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => setQuickList(quickList.filter(i => i.id !== s.id))} className="hover:bg-red-50 text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                <div className="p-4 bg-slate-50 flex justify-end border-t">
                  <Button 
                    className="bg-green-600 hover:bg-green-700 text-white font-black px-10 h-11 gap-2 shadow-lg active:scale-95 transition-all"
                    onClick={handleQuickTransfer}
                    disabled={isSaving}
                  >
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5" />}
                    ترحيل كافة الأوزان 
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* الفلاتر */}
      {!showWeighedOnly && (
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
      )}

      {/* الجدول - الشاشة */}
      {(hasSearched || showWeighedOnly) && (
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
                            
                            {/* 🆕 عمودي السرية والفصيل في وضع الموزونين فقط */}
                            {showWeighedOnly && (
                                <>
                                    <TableHead rowSpan={2} className="w-[80px] text-center border border-black text-black font-bold text-[10px] md:text-xs bg-amber-100">السرية</TableHead>
                                    <TableHead rowSpan={2} className="w-[80px] text-center border border-black text-black font-bold text-[10px] md:text-xs bg-amber-100">الفصيل</TableHead>
                                </>
                            )}
                            
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
                             <TableRow><TableCell colSpan={15} className="h-24 text-center">لا توجد بيانات</TableCell></TableRow>
                        ) : (
                            paginatedData.map((soldier, index) => (
                                <TableRow key={soldier.id} className="hover:bg-slate-50">
                                    <TableCell className="text-center border border-slate-300 font-mono text-xs static md:sticky md:right-0 z-10 md:bg-white border-l-0">{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
                                    <TableCell className="text-center border border-slate-300 hidden md:table-cell">
                                        <div className="w-9 h-9 bg-slate-100 rounded-full mx-auto flex items-center justify-center overflow-hidden border-2 border-slate-200 relative group shadow-sm">
                                            <img 
                                                src={soldier.image_url ? `${soldier.image_url}?t=${new Date().getTime()}` : "/placeholder-user.png"} 
                                                alt={soldier.name}
                                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                                onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-user.png"; }} 
                                            />
                                            <User className="w-4 h-4 text-slate-300 absolute z-[-1]" />
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right border border-slate-300 font-bold text-xs hidden md:table-cell">{soldier.militaryId}</TableCell>
                                    <TableCell className="text-right border border-slate-300 font-medium text-xs sticky right-0 md:right-[40px] z-20 bg-slate-50 dark:bg-slate-950 shadow-[-2px_0px_5px_rgba(0,0,0,0.15)] max-w-[160px] md:max-w-none truncate">{soldier.name}</TableCell>
                                    
                                    {/* 🆕 عرض السرية والفصيل في وضع الموزونين */}
                                    {showWeighedOnly && (
                                        <>
                                            <TableCell className="text-center border border-slate-300 font-bold text-xs bg-amber-50">{soldier.company}</TableCell>
                                            <TableCell className="text-center border border-slate-300 font-bold text-xs bg-amber-50">{soldier.platoon}</TableCell>
                                        </>
                                    )}
                                    
                                    <TableCell className="text-center border border-slate-300 font-mono text-xs bg-slate-50">{soldier.height}</TableCell>
                                    {sessions.map((session) => {
                                        if (session.isHidden) return <TableCell key={session.id} className="border border-slate-300 bg-gray-100 min-w-[40px] p-0"></TableCell>
                                        const weight = session.weights[soldier.id] || "";
                                        const imc = calculateIMC(parseFloat(weight), soldier.height);
                                        const status = getIMCStatus(imc);
                                        return (
                                            <Fragment key={session.id}>
                                                <TableCell className="p-1 border border-slate-300">
                                                    <Input 
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={weight} 
                                                        onChange={(e) => handleWeightChange(session.id, soldier.id, e.target.value)} 
                                                        className="h-8 w-full text-center font-bold bg-white border-transparent hover:border-slate-300 focus:border-blue-500 text-xs px-0"  
                                                        placeholder="0" 
                                                    />
                                                </TableCell>
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

        {/* جدول الطباعة */}
        <div className="hidden print:block">
             <div className="print-header w-full border-b-2 border-black pb-4 mb-4 text-black">
                <div className="flex justify-between items-center w-full">
                    <div className="w-32 h-32">
                        <img src="/logo.jpg" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <div className="text-center">
                        <h2 className="text-xl font-bold">مـعهد الشرطـة - فـرع التدريب الرياضـي</h2>
                        <h1 className="text-2xl font-bold underline mt-2">{reportTitle}</h1>
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
                        {showWeighedOnly && (
                            <>
                                <th className="border border-black p-1 text-[10px] font-bold text-black w-[60px]">السرية</th>
                                <th className="border border-black p-1 text-[10px] font-bold text-black w-[60px]">الفصيل</th>
                            </>
                        )}
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
                         <th colSpan={showWeighedOnly ? 6 : 4} className="border border-black"></th>
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
                            {showWeighedOnly && (
                                <>
                                    <td className="border border-black text-center text-[10px] font-bold">{soldier.company}</td>
                                    <td className="border border-black text-center text-[10px] font-bold">{soldier.platoon}</td>
                                </>
                            )}
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