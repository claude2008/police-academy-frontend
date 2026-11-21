"use client"

import { useState, useEffect, useMemo } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch" 
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle 
} from "@/components/ui/alert-dialog"
import { 
  ClipboardCheck, Calendar, Trash2, FileSpreadsheet, Send, RefreshCw, 
  Printer, ArrowRight, FileText, PenTool, CheckCircle, 
  Upload, Timer, Filter, ShieldAlert, Edit2, X, Check, Loader2, ArrowRightLeft,
  ChevronLeft, ChevronRight, AlertTriangle // ✅ تأكد من إضافة هؤلاء هنا
} from "lucide-react"
import { toast } from "sonner"
import * as XLSX from 'xlsx'
import ProtectedRoute from "@/components/ProtectedRoute"
// --- تعريف الأنواع ---
interface DraftItem {
  id: number
  title: string
  course: string
  batch: string
  company: string
  exam_date: string
  status: string
  created_at: string
  students_data: any[]
}

const COLOR_MAP: Record<string, string> = {
  "red": "أحمر", "yellow": "أصفر", "blue": "أزرق", "green": "أخضر",
  "purple": "بنفسجي", "orange": "برتقالي", "gray": "رمادي", "pink": "وردي"
};

export default function MergeAndProcessingPage() {
  // --- States ---
  const [pageMode, setPageMode] = useState<'list' | 'raw' | 'merged' | 'official'>('list')
  const [activeTab, setActiveTab] = useState("daily-logs")
  const [dailySummaries, setDailySummaries] = useState<any[]>([])
  const [draftsList, setDraftsList] = useState<DraftItem[]>([]) 
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchDates, setSearchDates] = useState({ start: "", end: "" })
  const [filterOptions, setFilterOptions] = useState<any>({ courses: [], batches: [], companies: [], platoons: [] })
  const [isDraftsRefreshing, setIsDraftsRefreshing] = useState(false)

  // --- Details View States ---
  const [selectedDate, setSelectedDate] = useState("")
  const [tableData, setTableData] = useState<any[]>([])
  const [rawDataCache, setRawDataCache] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [dialogCourse, setDialogCourse] = useState("")
  const [dialogBatch, setDialogBatch] = useState("")
  const [selectedDraft, setSelectedDraft] = useState<DraftItem | null>(null)
  const [highlightedUnlinked, setHighlightedUnlinked] = useState<string[]>([])
  // --- Delete States (للنوافذ المنبثقة) ---
  const [draftToDelete, setDraftToDelete] = useState<number | null>(null)
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null)
  const [dayToDelete, setDayToDelete] = useState<string | null>(null)
// في السطر 70 تقريباً، تأكد أن هذا هو السطر الوحيد المتبقي بهذا الاسم:
const [cardsPerPage, setCardsPerPage] = useState(10);
  // --- Draft & Save States ---
  const [isSaveDraftOpen, setIsSaveDraftOpen] = useState(false)
  const [draftConfig, setDraftConfig] = useState({ title: "", course: "", batch: "", company: "", platoon: "عام" })

  // --- Conflicts & Committee States ---
  const [editingRowId, setEditingRowId] = useState<number | null>(null)
  const [editFormData, setEditFormData] = useState<any>({})
  const [isCommitteeMode, setIsCommitteeMode] = useState(false) 
  const [showMapperDialog, setShowMapperDialog] = useState(false) 
  const [enterersMap, setEnterersMap] = useState<Record<string, 'trainer' | 'officer'>>({}) 
  const [uniqueEnterers, setUniqueEnterers] = useState<string[]>([]) 
  const [saveMethod, setSaveMethod] = useState<'trainer' | 'officer' | 'average'>('average')
  const [canEditScores, setCanEditScores] = useState(false)
  const [canEditEverything, setCanEditEverything] = useState(false);
  const [showWarningsDialog, setShowWarningsDialog] = useState(false)
const [pendingMergeData, setPendingMergeData] = useState<any[]>([])
const [mergeWarnings, setMergeWarnings] = useState({ missing_scores: [], unlinked_results: [] })
// ترقيم سجل الإدخالات اليومي
const [dailyPage, setDailyPage] = useState(1);
// ترقيم المسودات
const [draftsPage, setDraftsPage] = useState(1);
// --- Import Run States ---
const [showRunImportDialog, setShowRunImportDialog] = useState(false)
const [runImportPreview, setRunImportPreview] = useState<{military_id: string, run_time: string, found: boolean}[]>([])
const [runColumnOptions, setRunColumnOptions] = useState<string[]>([])
const [selectedRunCol, setSelectedRunCol] = useState("")
const [selectedIdCol, setSelectedIdCol] = useState("")
const [rawImportData, setRawImportData] = useState<any[]>([])
const [isImportReady, setIsImportReady] = useState(false)
const [pendingPreviewData, setPendingPreviewData] = useState<{data: any[], idCol: string, runCol: string} | null>(null)
  // --- Effects ---
  useEffect(() => {
      const userStr = localStorage.getItem('user');
      if (userStr) {
          const user = JSON.parse(userStr);
          const fullAccess = ["owner", "manager", "admin", "assistant_admin", "sports_officer"];
          setCanEditEverything(fullAccess.includes(user.role));
          setCanEditScores(fullAccess.includes(user.role));
      }
      fetchDailySummaries(); 
      fetchFilterOptions();
      
  }, [])

  useEffect(() => {
      if (activeTab === 'merge') fetchDrafts();
  }, [activeTab])
// ✅ يُشغّل المعاينة بعد فتح النافذة مباشرة
useEffect(() => {
    if (showRunImportDialog && pendingPreviewData) {
        buildRunPreviewDirect(
            pendingPreviewData.data,
            pendingPreviewData.idCol,
            pendingPreviewData.runCol
        );
        setPendingPreviewData(null);
    }
}, [showRunImportDialog, pendingPreviewData]);
        // 🟢 فحص ذكي: هل يوجد أي بيانات حقيقية في عمود السرية؟
const showCompanyCol = useMemo(() => {
    return tableData.some(row => 
        row.company && 
        !["None", "-", "", "عام", "null", "undefined"].includes(String(row.company).trim())
    );
}, [tableData]);

// 🟢 فحص ذكي: هل يوجد أي بيانات حقيقية في عمود الفصيل؟
const showPlatoonCol = useMemo(() => {
    return tableData.some(row => 
        row.platoon && 
        !["None", "-", "", "عام", "null", "undefined"].includes(String(row.platoon).trim())
    );
}, [tableData]);
  // --- API Functions ---
  const fetchFilterOptions = async () => {
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/filters-options`)
        if (res.ok) setFilterOptions(await res.json())
    } catch (e) { console.error("Error loading filters", e) }
  }

 const fetchDailySummaries = async () => {
    setIsRefreshing(true)
    try {
      const query = new URLSearchParams();
      if (searchDates.start) query.append("start_date", searchDates.start);
      if (searchDates.end) query.append("end_date", searchDates.end);
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/processing/daily-summary?${query.toString()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })

      if (res.ok) {
          let data = await res.json();
          
          // 🛡️ تطبيق حماية النطاق (Scope) في الواجهة
          const user = JSON.parse(localStorage.getItem("user") || "{}");
          const scope = user?.extra_permissions?.scope;
          if (user.role !== 'owner' && scope?.is_restricted) {
              const allowedCourses = scope.courses || [];
              // هنا في الإجماليات، لا نستطيع الفلترة بدقة 100% لأن السيرفر يرسل "تاريخ" فقط
              // لذا سنعتمد على الباك إند في فلترة العدد (Count) وسنترك الواجهة تعرض التاريخ
              setDailySummaries(data);
          } else {
              setDailySummaries(data);
          }
          setDailyPage(1);
      }
    } catch (e) { toast.error("خطأ في الاتصال") }
    finally { setIsRefreshing(false) }
  }

  const fetchDrafts = async () => {
      setIsDraftsRefreshing(true);
      try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/drafts`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          })
          
          if (res.ok) {
              let data = await res.json();
              
              // 🛡️ تطبيق حماية النطاق (Scope) للمسودات
              const user = JSON.parse(localStorage.getItem("user") || "{}");
              const scope = user?.extra_permissions?.scope;
              if (user.role !== 'owner' && scope?.is_restricted) {
                  const allowedCourses = scope.courses || [];
                  data = data.filter((d: any) => {
                      const dBatch = (d.batch && d.batch.trim() !== "") ? d.batch : "لا يوجد";
                      const key = `${d.course}||${dBatch}`;
                      return allowedCourses.includes(key) || allowedCourses.includes(d.course);
                  });
              }
              setDraftsList(data);
              setDraftsPage(1);
          }
      } catch (e) { toast.error("فشل جلب المسودات") }
      finally { setIsDraftsRefreshing(false); }
  }

  const openDayDetails = async (dateStr: string) => {
    setSelectedDate(dateStr)
    setDialogCourse("") 
    setDialogBatch("")
    setIsProcessing(true)
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/processing/daily-details/${dateStr}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      if (res.ok) {
        const data = await res.json()
        setTableData(data)
        setRawDataCache(data)
        setPageMode('raw') 
      } else {
        toast.error("فشل في تحميل البيانات")
      }
    } catch (e) { 
        console.error(e)
        toast.error("فشل جلب التفاصيل") 
    } finally { 
        setIsProcessing(false) 
    }
  }

  const handleOpenDraft = (draft: DraftItem) => {
      setSelectedDraft(draft);
      setTableData(draft.students_data);
      setSelectedDate(draft.exam_date);
      setDialogCourse(draft.course);
      setDialogBatch(draft.batch);
      setDraftConfig({
          title: draft.title,
          course: draft.course,
          batch: draft.batch,
          company: draft.company,
          platoon: "عام"
      });
      setPageMode('official');
      toast.success("تم فتح المسودة بنجاح");
  };

  // --- Logic & Helpers ---
  const getDuplicateIds = (data: any[]) => {
      const counts: Record<string, number> = {};
      const duplicates = new Set<number>();
      data.forEach(row => {
          const key = `${row.shabaha_number}-${row.shabaha_color}`;
          counts[key] = (counts[key] || 0) + 1;
      });
      data.forEach(row => {
          const key = `${row.shabaha_number}-${row.shabaha_color}`;
          if (counts[key] > 1) duplicates.add(row.id);
      });
      return duplicates;
  }

  const duplicateIds = pageMode === 'raw' ? getDuplicateIds(tableData) : new Set();

  const startEdit = (row: any) => { setEditingRowId(row.id); setEditFormData({ ...row }) }
  const cancelEdit = () => { setEditingRowId(null); setEditFormData({}) }
  const handleNoteChange = (index: number, newNote: string) => {
    setTableData(prev => {
        const newData = [...prev];
        newData[index] = { ...newData[index], notes: newNote };
        return newData;
    });
};
  const saveEdit = async () => {
      try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/processing/entry/${editingRowId}`, {
              method: "PUT",
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
              body: JSON.stringify(editFormData)
          });
          if (res.ok) {
              toast.success("تم التعديل بنجاح");
              setTableData(prev => prev.map(item => item.id === editingRowId ? editFormData : item));
              setRawDataCache(prev => prev.map(item => item.id === editingRowId ? editFormData : item));
              setEditingRowId(null);
          } else { toast.error("فشل الحفظ"); }
      } catch (e) { toast.error("خطأ في الاتصال"); }
  }

  // --- دوال الحذف الثلاثة (المصححة والمنظمة) ---

  // 1. حذف سجل واحد (Entry)
  const executeDeleteEntry = async () => {
      if (!entryToDelete) return;
      
      const toastId = toast.loading("جاري حذف السجل...");
      try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/processing/entry/${entryToDelete}`, {
              method: "DELETE",
              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          if (res.ok) {
              toast.success("تم الحذف بنجاح", { id: toastId });
              setTableData(prev => prev.filter(item => item.id !== entryToDelete));
              setRawDataCache(prev => prev.filter(item => item.id !== entryToDelete));
              setEntryToDelete(null);
          } else { toast.error("فشل الحذف", { id: toastId }); }
      } catch (e) { toast.error("خطأ اتصال", { id: toastId }); }
  }

  // 2. حذف مسودة (Draft)
  const executeDeleteDraft = async () => {
    if (!draftToDelete) return;

    const toastId = toast.loading("جاري حذف المسودة...");
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/drafts/${draftToDelete}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (res.ok) {
            setDraftsList(prev => prev.filter(d => d.id !== draftToDelete));
            toast.success("تم حذف المسودة بنجاح", { id: toastId });
            setDraftToDelete(null);
        } else {
            const errorData = await res.json().catch(() => ({}));
            if (res.status === 405) {
                toast.error("عفواً، الحذف غير مسموح به حالياً من السيرفر (405)", { id: toastId });
            } else {
                toast.error("فشل الحذف، حاول مرة أخرى", { id: toastId });
            }
        }
    } catch (e) { 
        toast.error("خطأ في الاتصال بالسيرفر", { id: toastId });
    }
  };

  // 3. حذف يوم كامل (Daily Log)
  const executeDeleteDay = async () => {
      if (!dayToDelete) return;

      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!["owner", "manager", "admin", "assistant_admin"].includes(user.role)) {
          toast.error("عفواً، هذه الصلاحية للمدير فقط");
          setDayToDelete(null);
          return;
      }

      const toastId = toast.loading("جاري حذف سجلات اليوم...");
      try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/processing/daily-delete/${dayToDelete}`, {
              method: "DELETE",
              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });

          if (res.ok) {
              toast.success("تم حذف سجلات اليوم بنجاح", { id: toastId });
              fetchDailySummaries(); 
              setDayToDelete(null); 
          } else {
              toast.error("فشل الحذف", { id: toastId });
          }
      } catch (e) {
          toast.error("خطأ في الاتصال", { id: toastId });
      }
  };

const handleMerge = async () => {
    setHighlightedUnlinked([]);
    
    if (!dialogCourse) {
        toast.error("عفواً، يجب اختيار اسم الدورة أولاً");
        return;
    }

    const cleanBatch = dialogBatch?.trim() === "" ? "" : dialogBatch;
    setIsProcessing(true);
    const toastId = toast.loading("جاري المطابقة ومعالجة البيانات...");

    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/processing/merge-preview`, {
            method: "POST",
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${localStorage.getItem('token')}` 
            },
            body: JSON.stringify({ 
                target_date: selectedDate, 
                course: dialogCourse, 
                batch: cleanBatch,
                mode: "tested_only", 
                company: "all", 
                platoon: "all" 
            })
        });

        const result = await res.json();
        const isConflict = res.status === 409;

        if (res.ok || isConflict) {
            const warnings = result.warnings || { missing_scores: [], unlinked_results: [] };
            const missingScores = warnings.missing_scores || [];
            const unlinkedResults = warnings.unlinked_results || [];
            const mainData = isConflict ? (result.conflicts || []) : (result.data || result);

            // تمييز النتائج التائهة بالأصفر في الجدول الخام
            const unlinkedKeys = unlinkedResults.map((r: any) => 
                `${r.shabaha}_${String(r.color).toLowerCase()}`
            );
            setHighlightedUnlinked(unlinkedKeys);

            // 🟢 1. فحص التحذيرات أولاً (حارس البوابة)
            if (missingScores.length > 0 || unlinkedResults.length > 0) {
                setPendingMergeData(mainData);
                setMergeWarnings({ missing_scores: missingScores, unlinked_results: unlinkedResults });
                setShowWarningsDialog(true);
                toast.dismiss(toastId);
                return; 
            } 

            // ⚪ 2. إذا كانت البيانات نظيفة، نطبق منطق اللجان أو الدمج العادي
            if (isConflict) {
                if (isCommitteeMode) {
                    prepareCommitteeData(result.conflicts);
                } else {
                    toast.error("فشل الدمج: يوجد تكرار في أرقام الشباحات. يرجى التصحيح في الجدول.");
                    setPageMode('raw');
                }
            } else {
                if (mainData.length === 0) {
                    toast.warning("لا توجد نتائج مطابقة لهذه الدورة");
                } else {
                    if (isCommitteeMode) prepareCommitteeDataFromNormal(mainData);
                    else { setTableData(mainData); setPageMode('merged'); }
                    toast.success(`تم جلب ${mainData.length} سجل بنجاح`);
                }
            }
            toast.dismiss(toastId);
        } else {
            toast.error(result.detail || "حدث خطأ في السيرفر");
            toast.dismiss(toastId);
        }
    } catch (e) { 
        toast.error("خطأ في الاتصال بالسيرفر");
        toast.dismiss(toastId);
    } finally { 
        setIsProcessing(false); 
    }
};

  const prepareCommitteeData = (conflicts: any[]) => {
      const allEntries: any[] = [];
      conflicts.forEach((c: any) => {
          c.entries.forEach((e: any) => {
              allEntries.push({ ...e, shabaha_number: c.shabaha, shabaha_color: c.color, soldier_id: c.soldier_id, military_id: c.military_id, name: c.name, rank: c.rank, company: c.company, platoon: c.platoon });
          });
      });
      setRawDataCache(allEntries); 
      initiateCommitteeMerge(allEntries); 
  }

  const prepareCommitteeDataFromNormal = (data: any[]) => {
      setRawDataCache(data);
      initiateCommitteeMerge(data);
  }

  const initiateCommitteeMerge = (sourceData: any[]) => {
      if (!sourceData || sourceData.length === 0) return;
      const names = Array.from(new Set(sourceData.map(row => row.entered_by || "غير معروف"))).filter(n => n !== "غير معروف");
      setUniqueEnterers(names);
      const initialMap: any = {};
      names.forEach(name => initialMap[name] = 'trainer');
      setEnterersMap(initialMap);
      setShowMapperDialog(true);
  };

  const applyCommitteeMerge = () => {
      const sourceData = isCommitteeMode ? rawDataCache : (pageMode === 'raw' ? tableData : rawDataCache);
      const soldierMap: Record<string, any> = {};

     sourceData.forEach(row => {
          const key = (row.military_id ? String(row.military_id) : String(row.shabaha_number)).trim();
          
          if (!soldierMap[key]) {
              soldierMap[key] = { 
                  ...row, 
                  notes: "", // 🟢 نبدأ بمسودة فارغة تماماً لمنع تسرب ملاحظات المدربين للصندوق
                  trainer_push: null, 
                  trainer_sit: null, 
                  trainer_notes: "", 
                  officer_push: null, 
                  officer_sit: null, 
                  officer_notes: "" 
              };
          }

          const valPush = row.push !== undefined ? row.push : row.push_count;
          const valSit = row.sit !== undefined ? row.sit : row.sit_count;
          const role = enterersMap[row.entered_by];

          // 1. إذا كان السجل يخص مدرب -> نضع ملاحظته في مخزن المدرب فقط
          if (role === 'trainer') {
              soldierMap[key].trainer_push = valPush; 
              soldierMap[key].trainer_sit = valSit;
              soldierMap[key].trainer_notes = row.notes || "";
          } 
          // 2. إذا كان السجل يخص ضابط -> نضع ملاحظته في مخزن الضابط فقط
          else if (role === 'officer') {
              soldierMap[key].officer_push = valPush; 
              soldierMap[key].officer_sit = valSit;
              soldierMap[key].officer_notes = row.notes || "";
          } 
          
          // 3. 🟢 الجزء الأهم: ملاحظة الشباحة (الإدارية)
          // إذا وجدنا ملاحظة في سجل ليس له "مدخل بيانات" (أو مدخله هو النظام)، فهذه هي ملاحظة الشباحة
          if (row.notes && (!row.entered_by || row.entered_by === "" || row.entered_by === "نظام")) {
              soldierMap[key].notes = row.notes;
          }
      });

      setTableData(Object.values(soldierMap));
      setPageMode('merged'); 
      setShowMapperDialog(false); 
      toast.success("تم فصل اللجان وعرض النتائج");
  };

  const handleOfficialList = async () => {
    // 1. التأكد من وجود بيانات مدمجة أولاً
    if (pageMode === 'raw') { 
        toast.warning("يرجى ضغط 'دمج الرصد' أولاً"); 
        return; 
    }

    setIsProcessing(true);
    const toastId = toast.loading("جاري استدعاء الكشف الرسمي والمطابقة...");

    // 🟢 2. بناء "مفاتيح الفرز" بشكل ذكي
    // نقوم بتحويل القيم الفارغة إلى "None" لضمان مطابقة منطق الباك إند (IS NULL)
    const activePlatoons = Array.from(new Set(
        tableData.map(item => {
            const comp = (item.company && item.company !== "عام") ? item.company : "None";
            const plat = (item.platoon && item.platoon !== "عام") ? item.platoon : "None";
            return `${comp}||${plat}`;
        })
    ));

    try {
        // 3. تجهيز الحمولة (Payload) مع تنظيف الدفعة
        const payload = { 
            active_platoons: activePlatoons, 
            tested_entries: tableData, 
            target_date: selectedDate,
            course: dialogCourse,
            // إذا كانت الدفعة فارغة نرسل "None"
            batch: (dialogBatch && dialogBatch.trim() !== "") ? dialogBatch : "None"
        };

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/processing/full-official-list`, {
            method: "POST",
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${localStorage.getItem('token')}` 
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const data = await res.json();
            
            // 4. تحديث الجدول بالبيانات الكاملة (المختبرين + الغائبين)
            setTableData(data);
            setPageMode('official');
            toast.success("تم استدعاء الكشف الرسمي بنجاح ✅", { id: toastId });
        } else {
            const errData = await res.json();
            toast.error(errData.detail || "فشل استجابة السيرفر", { id: toastId });
        }
    } catch (e) { 
        console.error("Official List Error:", e);
        toast.error("حدث خطأ في الاتصال بالخادم", { id: toastId }); 
    } finally { 
        setIsProcessing(false); 
    }
};

const handleRunImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const jsonData: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

            if (jsonData.length === 0) {
                toast.error("الملف فارغ!");
                return;
            }

            const cols = Object.keys(jsonData[0]).map(k => k.trim());
            setRunColumnOptions(cols);
            setRawImportData(jsonData);

            const guessId = cols.find(c =>
                c.includes("الرقم العسكري") || c.includes("Military") || c.includes("military")
            ) || cols[0];
            const guessRun = cols.find(c =>
                c.includes("الجري") || c.includes("توقيت") || c.includes("Time") || c.includes("Run")
            ) || cols[1];

            setSelectedIdCol(guessId);
            setSelectedRunCol(guessRun);
            setShowRunImportDialog(true);

            // ✅ معاينة تلقائية فورية
            setPendingPreviewData({ data: jsonData, idCol: guessId, runCol: guessRun });

        } catch {
            toast.error("فشل قراءة الملف");
        }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
};

// دالة المعاينة — تُستدعى عند تغيير العمود المختار
// ✅ دالة جديدة: تعمل على البيانات المُمررة مباشرة
const buildRunPreviewDirect = (data: any[], idCol: string, runCol: string) => {
    if (!idCol || !runCol || data.length === 0) return;

    const existingIds = new Set(tableData.map(s => String(s.military_id || "").trim()));

    const preview = data
        .map(row => {
            const milId = String(row[idCol] || "").trim();
            let runVal = row[runCol];
            let runStr = "";
            if (runVal !== "" && runVal !== null && runVal !== undefined) {
                runStr = String(runVal).trim();
            }
            return {
                military_id: milId,
                run_time: runStr,
                found: existingIds.has(milId)
            };
        })
        .filter(r => r.military_id && r.run_time);

    const notFound = preview.filter(r => !r.found);
    setIsImportReady(notFound.length === 0);
    setRunImportPreview(preview);
};

// ✅ عدّل buildRunPreview لتستخدم الدالة الجديدة
const buildRunPreview = (idCol: string, runCol: string) => {
    buildRunPreviewDirect(rawImportData, idCol, runCol);
};

// دالة تأكيد الحفظ
const confirmRunImport = () => {
    const runMap: Record<string, string> = {};
    runImportPreview.forEach(r => {
        if (r.found) runMap[r.military_id] = r.run_time;
    });

    const applyMerge = (arr: any[]) => arr.map(s => {
        const id = String(s.military_id || "").trim();
        return runMap[id] ? { ...s, run_time: runMap[id] } : s;
    });

    setTableData(prev => applyMerge(prev));
    setRawDataCache(prev => applyMerge(prev));

    if (selectedDraft) {
        setSelectedDraft(prev => prev ? {
            ...prev,
            students_data: applyMerge(prev.students_data)
        } : prev);
    }

    toast.success(`✅ تم دمج ${Object.keys(runMap).length} توقيت جري بنجاح`);
    setShowRunImportDialog(false);
    setRunImportPreview([]);
    setRawImportData([]);
};
const handleSaveDraftRunTime = async () => {
    if (!selectedDraft) return;

    const toastId = toast.loading("جاري حفظ بيانات الجري...");
    try {
        const updatedStudents = tableData.map(s => ({
            soldier_id: s.soldier_id || 0,
            military_id: s.military_id,
            name: s.name || "جندي",
            rank: s.rank || "-",
            company: s.company,
            platoon: s.platoon,
            dob: s.dob,
            push_count: s.push_count || 0,
            sit_count: s.sit_count || 0,
            notes: s.notes || "",
            status: s.status || "present",
            run_time: s.run_time || ""
        }));

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/drafts/save`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                title: selectedDraft.title,
                course: selectedDraft.course,
                batch: selectedDraft.batch || "",
                company: selectedDraft.company || "",
                platoon: "عام",
                exam_date: selectedDraft.exam_date,
                students: updatedStudents
            })
        });

        if (res.ok) {
            toast.success("تم حفظ بيانات الجري في المسودة ✅", { id: toastId });
            // تحديث المسودة محلياً أيضاً
            setSelectedDraft(prev => prev ? {
                ...prev,
                students_data: updatedStudents
            } : prev);
        } else {
            const err = await res.json();
            toast.error(err.detail || "فشل الحفظ", { id: toastId });
        }
    } catch (e) {
        toast.error("خطأ في الاتصال بالسيرفر", { id: toastId });
    }
};
 const exportToExcel = () => {
    if (!tableData || tableData.length === 0) return;

    // 1️⃣ دوال مساعدة للتنظيف والتنسيق داخل الملف
    const formatScore = (val: any) => (val === 0 || val === "0" || val === null || val === undefined) ? "" : val;
    
    const cleanVal = (val: any) => {
        const s = String(val || "").trim();
        // إذا كانت القيمة "None" أو فارغة نحولها لشرطة لجمالية الملف
        if (s.toLowerCase() === "none" || s === "" || s.toLowerCase() === "null") return "-";
        return s;
    };

    let dataToExport = [];

    // 2️⃣ بناء المصفوفة بناءً على وضع الصفحة الحالي
    if (isCommitteeMode && (pageMode === 'merged' || pageMode === 'official')) {
        // --- [ وضع اللجان: مدمج أو رسمي ] ---
        dataToExport = tableData.map((row, idx) => ({
            "م": idx + 1,
            "الرقم العسكري": row.military_id,
            "الإسم": row.name,
            "تاريخ الميلاد": row.dob || "-",
            "السرية": cleanVal(row.company),
            "الفصيل": cleanVal(row.platoon),
            "الضغط (مدرب)": formatScore(row.trainer_push),
            "البطن (مدرب)": formatScore(row.trainer_sit),
            "ملاحظات المدرب": row.trainer_notes || "",
            "الضغط (ضابط)": formatScore(row.officer_push),
            "البطن (ضابط)": formatScore(row.officer_sit),
            "ملاحظات الضابط": row.officer_notes || "",
            "الجري": row.run_time || "",
            "الملاحظات النهائية": row.notes || ""
        }));
    } else if (pageMode === 'official' || pageMode === 'merged') {
        // --- [ الوضع العادي: رسمي أو مدمج ] ---
        dataToExport = tableData.map((row, idx) => ({
            "م": idx + 1,
            "الرقم العسكري": row.military_id,
            "الإسم": row.name,
            "تاريخ الميلاد": row.dob || "-",
            "السرية": cleanVal(row.company),
            "الفصيل": cleanVal(row.platoon),
            "الضغط": formatScore(row.push_count),
            "البطن": formatScore(row.sit_count),
            "الجري": row.run_time || "",
            "الملاحظات": row.notes || ""
        }));
    } else {
        // --- [ وضع البيانات الخام: Raw Mode ] ---
        dataToExport = tableData.map((row, idx) => ({
            "م": idx + 1,
            "رقم الشباحة": row.shabaha_number,
            "اللون": COLOR_MAP[row.shabaha_color] || row.shabaha_color,
            "الضغط": formatScore(row.push_count),
            "البطن": formatScore(row.sit_count),
            "المدخل": row.entered_by,
            "الوقت": row.entry_time, // 🟢 يظهر هنا بتوقيت قطر (UTC+3) المعتمد من الباك إند
            "ملاحظات": row.notes || ""
        }));
    }

    // 3️⃣ تحويل البيانات إلى ورقة عمل (Worksheet)
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "النتائج");

    // 4️⃣ ضبط اتجاه الملف من اليمين لليسار (RTL) ليتناسب مع اللغة العربية
    if (!wb.Workbook) wb.Workbook = {};
    if (!wb.Workbook.Views) wb.Workbook.Views = [];
    if (wb.Workbook.Views.length === 0) wb.Workbook.Views.push({});
    wb.Workbook.Views[0].RTL = true;

    // 5️⃣ تسمية الملف وتصديره
    const pathName = pageMode === 'raw' ? 'بيانات_خام' : (isCommitteeMode ? 'نتائج_لجان' : 'كشف_رسمي');
    const fileName = `${pathName}_${dialogCourse}_${dialogBatch || 'عام'}_${selectedDate}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
    toast.success("تم تصدير ملف الإكسل بنجاح شامل الوقت وتاريخ الميلاد ✅");
};

 const confirmSaveDraft = async () => {
    // 1. التحقق الأساسي (الدورة والعنوان فقط هما الإجباريان دائماً)
    if (!draftConfig.title || !draftConfig.course) { 
        toast.error("بيانات ناقصة: يرجى كتابة عنوان الاختبار واختيار الدورة"); 
        return; 
    }

    // 🟢 تم إزالة شرط (if hasBatches) لأنه كان يسبب التعارض مع دورة الصاعقة.
    // الآن سنعتمد على ذكاء السيرفر الذي برمجناه سابقاً لاتخاذ القرار.

    setIsProcessing(true);
    
    // ... باقي عملية تحويل بيانات الطلاب (processedStudents) تبقى كما هي تماماً ...
    const processedStudents = tableData.map(s => {
        // (نفس الكود الموجود عندك دون تغيير)
        let finalPush = 0, finalSit = 0, finalNotes = "";
        if (isCommitteeMode) {
            if (saveMethod === 'trainer') { finalPush = s.trainer_push || 0; finalSit = s.trainer_sit || 0; }
            else if (saveMethod === 'officer') { finalPush = s.officer_push || 0; finalSit = s.officer_sit || 0; }
            else { finalPush = Math.round(((s.trainer_push||0) + (s.officer_push||0)) / 2); finalSit = Math.round(((s.trainer_sit||0) + (s.officer_sit||0)) / 2); }
        } else { finalPush = s.push_count; finalSit = s.sit_count; }

        return { 
            soldier_id: s.soldier_id || 0, 
            military_id: s.military_id || s.shabaha_number, 
            name: s.name || "جندي", 
            rank: s.rank || "-",
            company: s.company,   
            platoon: s.platoon,
            dob: s.dob, 
            push_count: finalPush, 
            sit_count: finalSit, 
            notes: s.notes || "", 
            status: 'present', 
            run_time: s.run_time 
        };
    });

    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/exams/drafts/save`, {
            method: "POST", 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ 
                ...draftConfig, 
                // 🟢 نضمن إرسال الدفعة كـ "عام" أو نص فارغ إذا لم يتم اختيارها
                batch: draftConfig.batch || "", 
                exam_date: selectedDate, 
                students: processedStudents 
            })
        })
        
        if (res.ok) { 
            toast.success("تم الترحيل وحفظ المسودة بنجاح ✅"); 
            setIsSaveDraftOpen(false); 
            setPageMode('list'); 
            fetchDrafts(); 
        } else { 
            const errData = await res.json();
            // إذا كان السيرفر هو من يرفض، ستظهر الرسالة هنا
            toast.error(errData.detail || "فشل الحفظ"); 
        }
    } catch (e) { 
        toast.error("خطأ في الاتصال بالسيرفر"); 
    } finally { 
        setIsProcessing(false) 
    }
}
// 🟢 معالجة بيانات سجل الإدخالات (ترتيب + ترقيم)
const paginatedDaily = useMemo(() => {
    // الترتيب: الأحدث تاريخاً أولاً
    const sorted = [...dailySummaries].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    // التقسيم: أخذ 10 فقط حسب الصفحة
    const start = (dailyPage - 1) * cardsPerPage;
    return sorted.slice(start, start + cardsPerPage);
}, [dailySummaries, dailyPage]);

// 🟢 معالجة بيانات المسودات (ترتيب + ترقيم)
const paginatedDrafts = useMemo(() => {
    // الترتيب: الأحدث إنشاءً أولاً (باستخدام معرف id أو تاريخ created_at)
    const sorted = [...draftsList].sort((a, b) => b.id - a.id);
    // التقسيم
    const start = (draftsPage - 1) * cardsPerPage;
    return sorted.slice(start, start + cardsPerPage);
}, [draftsList, draftsPage]);
  // --- Main Render ---
  if (pageMode !== 'list') {
      const dayName = new Date(selectedDate).toLocaleDateString('ar-EG', { weekday: 'long' });


      return (
        <ProtectedRoute allowedRoles={["owner","assistant_admin"]}>
        <div className="min-h-screen bg-white p-2 md:p-8 flex flex-col space-y-6 pb-10 overflow-x-hidden relative" dir="rtl">
            <style jsx global>{`
                @media print {
                    @page { size: A4 portrait; margin: 5mm; }
                    body { zoom: 0.85; -webkit-print-color-adjust: exact; background: white; }
                    .no-print { display: none !important; }
                    table { width: 100% !important; border-collapse: collapse !important; }
                    th { background-color: #c5b391 !important; color: black !important; }
                    td, th { border: 1px solid black !important; padding: 4px !important; font-size: 11px !important; }
                    .force-print { display: table-row !important; }
                }
            `}</style>

            <div className="flex flex-col gap-4 no-print bg-slate-50 p-3 md:p-4 rounded-xl shadow-sm border">
                <div className="flex items-center justify-between gap-3">
                    <Button variant="ghost" onClick={() => {
                        setPageMode('list'); 
                        setTableData([]); 
                        setSelectedDraft(null); 
                    }} className="font-bold text-slate-600 h-9">
                        <ArrowRight className="w-5 h-5 ml-2" /> العودة
                    </Button>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-sm bg-white">{selectedDate}</Badge>
                        <Badge variant={pageMode === 'raw' ? "secondary" : "outline"}>{pageMode === 'raw' ? 'بيانات خام' : pageMode === 'merged' ? 'معاينة الدمج' : 'الكشف الرسمي'}</Badge>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                    
                    {!selectedDraft && pageMode === 'raw' && (
                        <div className="flex gap-2">
                            <Select 
  value={dialogCourse} 
  onValueChange={(val) => {
    setDialogCourse(val);
    setDialogBatch(""); // 🟢 بمجرد تغيير الدورة، نقوم بمسح الدفعة المختارة سابقاً
  }}
>
  <SelectTrigger className="w-32 h-9 bg-white">
    <SelectValue placeholder="الدورة" />
  </SelectTrigger>
  <SelectContent>
    {filterOptions.courses?.map((c: any) => (
      <SelectItem key={c} value={c}>{c}</SelectItem>
    ))}
  </SelectContent>
</Select>
                          <Select value={dialogBatch} onValueChange={setDialogBatch}>
  <SelectTrigger className="w-24 h-9 bg-white">
    <SelectValue placeholder="الدفعة" />
  </SelectTrigger>
  <SelectContent>
    {/* 🟢 خيار إضافي يسمح لك بإلغاء اختيار الدفعة فوراً */}
    <SelectItem value=" ">بدون دفعة (دورة عامة)</SelectItem>
    
    {filterOptions.batches?.map((b: any) => (
      <SelectItem key={b} value={b}>{b}</SelectItem>
    ))}
  </SelectContent>
</Select>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2 mr-auto">
                        
                        {!selectedDraft && (
                            <>
                                <div className="flex items-center gap-2 bg-blue-50 px-2 py-1 rounded-full border border-blue-100">
                                    <Switch checked={isCommitteeMode} onCheckedChange={setIsCommitteeMode} id="committee-mode" className="scale-75" />
                                    <Label htmlFor="committee-mode" className="text-xs text-blue-900 font-bold cursor-pointer">نظام اللجان</Label>
                                </div>

                                {pageMode !== 'raw' && (
                                    <Button variant="ghost" size="sm" onClick={() => {setTableData(rawDataCache); setPageMode('raw')}} className="text-slate-500 h-9"><ArrowRightLeft className="w-4 h-4 ml-1"/> الخام</Button>
                                )}

                               {(pageMode !== 'raw' || selectedDraft) && (
    <div className="relative">
        <input type="file" accept=".xlsx, .xls, .csv" onChange={handleRunImport} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
        <Button variant="outline" size="sm" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 h-9 bg-white font-bold gap-1">
            <Timer className="w-4 h-4"/> الجري
        </Button>
    </div>
)}

                                <Button onClick={handleMerge} disabled={isProcessing} size="sm" variant={pageMode === 'merged' ? "secondary" : "outline"} className="border-blue-200 text-blue-700 h-9">
                                    <RefreshCw className={`w-4 h-4 ml-1 ${isProcessing ? "animate-spin" : ""}`}/> دمج
                                </Button>

                                <Button onClick={handleOfficialList} disabled={isProcessing || pageMode === 'raw'} size="sm" variant={pageMode === 'official' ? "secondary" : "outline"} className="border-purple-200 text-purple-700 h-9">
                                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 ml-1" />} الرسمي
                                </Button>
                            </>
                        )}

                        <Button onClick={() => { document.title = `كشف_${selectedDate}`; window.print(); }} className="bg-slate-900 h-9 px-3 text-white gap-1 font-bold shadow-md">
                            <Printer className="w-4 h-4" /> طباعة
                        </Button>

                        <Button variant="outline" onClick={exportToExcel} className="text-green-700 border-green-600 h-9 bg-white font-bold gap-1">
                            <FileSpreadsheet className="w-4 h-4" /> Excel
                        </Button>
{selectedDraft && (
    <div className="flex gap-2 flex-wrap">

        {/* زر الاستيراد */}
        <div className="relative">
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleRunImport} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <Button variant="outline" size="sm" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 h-9 bg-white font-bold gap-1">
                <Timer className="w-4 h-4"/> استيراد الجري
            </Button>
        </div>

        {/* زر المسح — يظهر فقط إذا يوجد بيانات جري */}
        {tableData.some(s => s.run_time) && (
            <Button
                variant="outline"
                size="sm"
                className="border-red-200 text-red-600 hover:bg-red-50 h-9 bg-white font-bold gap-1"
                onClick={() => {
                    setTableData(prev => prev.map(s => ({ ...s, run_time: "" })));
                    setRawDataCache(prev => prev.map(s => ({ ...s, run_time: "" })));
                    toast.success("تم مسح بيانات الجري ✅");
                }}
            >
                <X className="w-4 h-4"/> مسح الجري
            </Button>
        )}

        {/* زر الحفظ — يظهر فقط إذا يوجد بيانات جري */}
        {tableData.some(s => s.run_time) && (
            <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 font-bold gap-1"
                onClick={handleSaveDraftRunTime}
            >
                <Check className="w-4 h-4"/> حفظ الجري
            </Button>
        )}

    </div>
)}
                        {!selectedDraft && pageMode !== 'raw' && (
                            <Button onClick={() => {setDraftConfig({...draftConfig, course: dialogCourse, batch: dialogBatch}); setIsSaveDraftOpen(true)}} size="sm" className="bg-green-600 hover:bg-green-700 text-white shadow-md h-9">
                                <Send className="w-4 h-4 ml-1"/> ترحيل
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className="hidden print:block text-center space-y-2 mb-4">
                <div className="flex justify-between items-start border-b-2 border-black pb-3">
                    <div className="w-1/3 flex justify-start"><img src="/logo.jpg" alt="Logo" className="w-28 h-28 mx-auto object-contain" /></div>
                    <div className="text-center font-black w-1/3 space-y-1">
                        <p className="text-lg">معهد الشرطة</p>
                        <p className="text-md">قسم التدريب العسكري والرياضي</p>
                        <p className="text-xs underline font-bold">فرع التدريب الرياضي</p>
                    </div>
                    <div className="text-left font-bold text-[10px] w-1/3 mt-1">
                        <p>اليوم: {dayName}</p>
                        <p>تاريخ الاختبار: {selectedDate}</p>
                    </div>
                </div>
                <h2 className="text-lg font-black py-2 underline underline-offset-8">
                    {pageMode === 'raw' ? 'تقرير بيانات الرصد الخام' : pageMode === 'merged' ? 'مسودة مطابقة نتائج اللياقة' : 'الكشف الرسمي لاختبار اللياقة'}
                </h2>
                {/* في جزء المعلومات العلوية قبل الجدول */}
<div className="flex justify-center gap-8 text-sm font-bold border border-black p-1 rounded bg-slate-50">
    <span>الدورة: {dialogCourse || "-"}</span>
    <span>الدفعة: {dialogBatch || "-"}</span>
    {/* 🟢 إظهار السرية والفصيل هنا فقط إذا كان لهما بيانات */}
    {showCompanyCol && <span>السرية: {tableData[0]?.company}</span>}
    {showPlatoonCol && <span>الفصيل: {tableData[0]?.platoon}</span>}
</div>
            </div>

            <div className="overflow-x-auto">
                <Table className="w-full border-collapse border border-slate-300 text-sm">
                   <TableHeader>
  {/* 🟢 الحالة الأولى: وضع اللجان (isCommitteeMode) - يدعم صفين من الرؤوس */}
  {(isCommitteeMode && !selectedDraft) && (pageMode === 'merged' || pageMode === 'official') ? (
    <>
      <TableRow className="bg-[#c5b391]">
        <TableHead rowSpan={2} className="border border-black text-center text-black font-bold w-10">#</TableHead>
        <TableHead rowSpan={2} className="border border-black text-center text-black font-bold w-20">الرتبة</TableHead>
        <TableHead rowSpan={2} className="border border-black text-center text-black font-bold">الرقم العسكري</TableHead>
        <TableHead rowSpan={2} className="border border-black text-right text-black font-bold">الاسم</TableHead>
        
        {/* الربط الذكي للسرية في وضع اللجان */}
        {showCompanyCol && (
          <TableHead rowSpan={2} className="border border-black text-center text-black font-bold">
            السرية
          </TableHead>
        )}

        {/* الربط الذكي للفصيل في وضع اللجان */}
        {showPlatoonCol && (
          <TableHead rowSpan={2} className="border border-black text-center text-black font-bold">
            الفصيل
          </TableHead>
        )}

        <TableHead colSpan={2} className="border border-black text-center text-black font-bold bg-blue-100">لجنة المدربين</TableHead>
        <TableHead colSpan={2} className="border border-black text-center text-black font-bold bg-green-100">لجنة الضباط</TableHead>
        <TableHead rowSpan={2} className="border border-black text-center text-black font-bold bg-purple-100">الجري</TableHead>
        <TableHead rowSpan={2} className="border border-black text-right text-black font-bold">الملاحظات</TableHead>
      </TableRow>
      
      {/* السطر الثاني الخاص بالضغط والبطن تحت مسميات اللجان */}
      <TableRow className="bg-[#e6dccf]">
        <TableHead className="border border-black text-center font-bold text-[10px]">ضغط</TableHead>
        <TableHead className="border border-black text-center font-bold text-[10px]">بطن</TableHead>
        <TableHead className="border border-black text-center font-bold text-[10px]">ضغط</TableHead>
        <TableHead className="border border-black text-center font-bold text-[10px]">بطن</TableHead>
      </TableRow>
    </>
  ) : (
    /* 🔵 الحالة الثانية: الوضع العادي (رسمي، مدمج، أو بيانات خام) */
    <TableRow className="bg-[#c5b391]">
      <TableHead className="text-center text-black font-bold border border-black w-10">#</TableHead>
      
      {pageMode === 'raw' ? (
        /* وضع البيانات الخام (Raw Mode) */
        <>
          <TableHead className="text-center text-black font-bold border border-black">رقم الشباحة</TableHead>
          <TableHead className="text-center text-black font-bold border border-black">اللون</TableHead>
          <TableHead className="text-center text-black font-bold border border-black">الضغط</TableHead>
          <TableHead className="text-center text-black font-bold border border-black">البطن</TableHead>
          <TableHead className="text-center text-black font-bold border border-black">المدخل</TableHead>
          <TableHead className="text-center text-black font-bold border border-black">الوقت</TableHead>
          <TableHead className="text-right text-black font-bold border border-black">ملاحظات</TableHead>
          <TableHead className="text-center text-black font-bold border border-black w-20 no-print">إجراء</TableHead>
        </>
      ) : (
        /* وضع الكشف الرسمي أو المدمج العادي */
        <>
          <TableHead className="text-center text-black font-bold border border-black w-20">الرتبة</TableHead>
          <TableHead className="text-center text-black font-bold border border-black">الرقم العسكري</TableHead>
          <TableHead className="text-right text-black font-bold border border-black">الاسم</TableHead>
          
          {/* الربط الذكي للسرية في الوضع العادي */}
          {showCompanyCol && (
            <TableHead className="text-center text-black font-bold border border-black">
              السرية
            </TableHead>
          )}

          {/* الربط الذكي للفصيل في الوضع العادي */}
          {showPlatoonCol && (
            <TableHead className="text-center text-black font-bold border border-black">
              الفصيل
            </TableHead>
          )}

          <TableHead className="text-center text-black font-bold border border-black">تاريخ الميلاد</TableHead>
          <TableHead className="text-center text-black font-bold border border-black bg-blue-100">الضغط</TableHead>
          <TableHead className="text-center text-black font-bold border border-black bg-yellow-100">البطن</TableHead>
          <TableHead className="text-center text-black font-bold border border-black bg-purple-100">الجري</TableHead>
          <TableHead className="text-right text-black font-bold border border-black">ملاحظات</TableHead>
        </>
      )}
    </TableRow>
  )}
</TableHeader>
                    <TableBody>
    {tableData.map((row, idx) => {
        const isDuplicate = duplicateIds.has(row.id);
        const isEditing = editingRowId === row.id;
        
        // 🔵 جديد: التحقق هل هذا الصف من "النتائج التائهة"؟
        const rowKey = `${row.shabaha_number}_${String(row.shabaha_color).toLowerCase()}`;
        const isUnlinked = highlightedUnlinked.includes(rowKey);

        return (
            <TableRow 
                key={idx} 
                className={`border-b border-black hover:bg-slate-50 
                    ${isDuplicate && pageMode === 'raw' ? "bg-red-100 print:bg-white" : ""}
                    ${isUnlinked && pageMode === 'raw' ? "bg-yellow-100 border-yellow-400" : ""} 
                `}
            >
                                    <TableCell className="text-center border border-black font-mono">{idx + 1}</TableCell>
                                    
                                    {/* 🟢 التعديل: لا تعرض بيانات اللجان إذا كنا داخل مسودة محفوظة */}
{(isCommitteeMode && !selectedDraft) && (pageMode === 'merged' || pageMode === 'official') ? (
                                        <>
                                            <TableCell className="text-center border border-black font-bold">{row.rank || "-"}</TableCell>
                                            <TableCell className="text-center border border-black font-bold">{row.military_id}</TableCell>
                                            <TableCell className="text-right border border-black px-2">{row.name}</TableCell>
                                            {showCompanyCol && (
    <TableCell className="text-center border border-black">
        {row.company && row.company !== "None" ? row.company : "-"}
    </TableCell>
)}

{showPlatoonCol && (
    <TableCell className="text-center border border-black">
        {row.platoon && row.platoon !== "None" ? row.platoon : "-"}
    </TableCell>
)}
                                            <TableCell className="text-center border border-black bg-blue-50 font-bold">{row.trainer_push ?? "-"}</TableCell>
                                            <TableCell className="text-center border border-black bg-blue-50 font-bold">{row.trainer_sit ?? "-"}</TableCell>
                                            <TableCell className="text-center border border-black bg-green-50 font-bold">{row.officer_push ?? "-"}</TableCell>
                                            <TableCell className="text-center border border-black bg-green-50 font-bold">{row.officer_sit ?? "-"}</TableCell>
                                            <TableCell className="text-center border border-black bg-purple-50 font-bold">{row.run_time || "--:--"}</TableCell>
                                            <TableCell className="p-0 border border-black min-w-[200px]">
    <div className="flex flex-col gap-0.5">
        {/* عرض الملاحظات الفنية كمرجع سريع (اختياري) */}
        {(row.trainer_notes || row.officer_notes) && (
            <div className="flex flex-wrap gap-1 px-2 pt-1 border-b border-slate-100 bg-slate-50/50">
                {row.trainer_notes && <span className="text-[9px] text-blue-600 font-bold">م: {row.trainer_notes}</span>}
                {row.officer_notes && <span className="text-[9px] text-green-600 font-bold">ض: {row.officer_notes}</span>}
            </div>
        )}
        
        {/* صندوق الملاحظة النهائي القابل للتعديل */}
        <Input 
            value={row.notes || ""} 
            onChange={(e) => handleNoteChange(idx, e.target.value)}
            placeholder="الملاحظة النهائية..."
            className="h-9 w-full border-none bg-transparent focus:bg-yellow-50 text-[10px] px-2 text-right shadow-none rounded-none"
        />
    </div>
</TableCell>
                                        </>
                                    ) : (
                                        pageMode === 'raw' ? (
                                            isEditing ? (
                                                <>
                                                    <TableCell className="p-1 border border-black">
                                                        <Input 
                                                            value={editFormData.shabaha_number} 
                                                            onChange={(e) => setEditFormData({...editFormData, shabaha_number: e.target.value})} 
                                                            className="h-8 text-center font-bold bg-yellow-50 focus:bg-white"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="p-1 border border-black">
                                                        <Select value={editFormData.shabaha_color} onValueChange={(val) => setEditFormData({...editFormData, shabaha_color: val})}>
                                                            <SelectTrigger className="h-8 bg-yellow-50 focus:bg-white"><SelectValue /></SelectTrigger>
                                                            <SelectContent>{Object.keys(COLOR_MAP).map(c => <SelectItem key={c} value={c}>{COLOR_MAP[c]}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell className="p-1 border border-black">
                                                        <Input 
                                                            type="number" 
                                                            disabled={!canEditEverything} 
                                                            value={editFormData.push_count} 
                                                            onChange={(e) => setEditFormData({...editFormData, push_count: Number(e.target.value)})} 
                                                            className={`h-8 text-center ${!canEditEverything ? "bg-slate-100 text-slate-400" : "bg-white font-bold"}`}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="p-1 border border-black">
                                                        <Input 
                                                            type="number" 
                                                            disabled={!canEditEverything} 
                                                            value={editFormData.sit_count} 
                                                            onChange={(e) => setEditFormData({...editFormData, sit_count: Number(e.target.value)})} 
                                                            className={`h-8 text-center ${!canEditEverything ? "bg-slate-100 text-slate-400" : "bg-white font-bold"}`}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-center border border-black text-xs bg-slate-50">{row.entered_by}</TableCell>
                                                    <TableCell className="text-center border border-black text-xs font-mono bg-slate-50">{row.entry_time}</TableCell>
                                                    <TableCell className="p-1 border border-black">
                                                        <Input 
                                                            value={editFormData.notes || ""} 
                                                            onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})} 
                                                            className="h-8 text-xs"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="border border-black text-center">
                                                        <div className="flex gap-1 justify-center">
                                                            <Button size="sm" onClick={saveEdit} className="h-7 w-7 p-0 bg-green-600 hover:bg-green-700 text-white"><Check className="w-4 h-4"/></Button>
                                                            <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-7 w-7 p-0 text-red-500"><X className="w-4 h-4"/></Button>
                                                        </div>
                                                    </TableCell>
                                                </>
                                            ) : (
                                                <>
                                                    <TableCell className="text-center border border-black font-bold">{row.shabaha_number}</TableCell>
                                                    <TableCell className="text-center border border-black">{COLOR_MAP[row.shabaha_color] || row.shabaha_color}</TableCell>
                                                    <TableCell className="text-center border border-black font-bold">{row.push_count}</TableCell>
                                                    <TableCell className="text-center border border-black font-bold">{row.sit_count}</TableCell>
                                                    <TableCell className="text-center border border-black text-xs">{row.entered_by}</TableCell>
                                                    <TableCell className="text-center border border-black text-xs font-mono">{row.entry_time}</TableCell>
                                                    <TableCell className="text-right border border-black text-xs px-2">{row.notes}</TableCell>
                                                    <TableCell className="border border-black text-center no-print">
                                                        <Button variant="ghost" size="sm" onClick={() => startEdit(row)} className="h-6 w-6 p-0 text-blue-600"><Edit2 className="w-3 h-3"/></Button>
                                                        <Button variant="ghost" size="sm" onClick={() => setEntryToDelete(row.id)} className="h-6 w-6 p-0 text-red-500"><Trash2 className="w-3 h-3"/></Button>
                                                    </TableCell>
                                                </>
                                            )
                                        ) : (
                                            <>
                                                <TableCell className="text-center border border-black font-bold">{row.rank || "-"}</TableCell>
                                                <TableCell className="text-center border border-black font-bold">{row.military_id}</TableCell>
                                                <TableCell className="text-right border border-black px-2">{row.name}</TableCell>
                                                {showCompanyCol && (
            <TableCell className="text-center border border-black">{row.company || "-"}</TableCell>
        )}
        {showPlatoonCol && (
            <TableCell className="text-center border border-black">{row.platoon || "-"}</TableCell>
        )}
                                                <TableCell className="text-center border border-black">{row.dob || "-"}</TableCell>
                                                <TableCell className="text-center border border-black font-bold">{row.push_count || "-"}</TableCell>
                                                <TableCell className="text-center border border-black font-bold">{row.sit_count || "-"}</TableCell>
                                                <TableCell className="text-center border border-black font-bold">{row.run_time || "--:--"}</TableCell>
                                                <TableCell className="p-0 border border-black min-w-[150px]">
    <Input 
        value={row.notes || ""} 
        onChange={(e) => handleNoteChange(idx, e.target.value)}
        placeholder="أضف ملاحظة..."
        className="h-8 w-full border-none bg-transparent focus:bg-yellow-50 text-[10px] px-2 text-right shadow-none rounded-none placeholder:text-slate-300"
    />
</TableCell>
                                            </>
                                        )
                                    )}
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={showMapperDialog} onOpenChange={setShowMapperDialog}>
                <DialogContent className="max-w-lg no-print" dir="rtl">
                    <DialogHeader><DialogTitle>تصنيف لجان التقييم</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                        {uniqueEnterers.map((name) => (
                            <div key={name} className="flex items-center justify-between bg-slate-50 p-3 rounded border">
                                <span className="font-bold text-slate-700">{name}</span>
                                <RadioGroup value={enterersMap[name]} onValueChange={(val: any) => setEnterersMap({...enterersMap, [name]: val})} className="flex gap-4">
                                    <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="trainer" id={`t-${name}`} /><Label htmlFor={`t-${name}`}>مدرب</Label></div>
                                    <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="officer" id={`o-${name}`} /><Label htmlFor={`o-${name}`}>ضابط</Label></div>
                                </RadioGroup>
                            </div>
                        ))}
                    </div>
                    <DialogFooter><Button onClick={applyCommitteeMerge} className="w-full bg-blue-600">اعتماد</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isSaveDraftOpen} onOpenChange={setIsSaveDraftOpen}>
                <DialogContent className="max-w-md no-print" dir="rtl">
                    <DialogHeader><DialogTitle>حفظ المسودة</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <Input value={draftConfig.title} onChange={(e) => setDraftConfig({...draftConfig, title: e.target.value})} placeholder="عنوان الاختبار" />
                        {isCommitteeMode && (
                            <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                                <Label className="block mb-2">طريقة الدمج:</Label>
                                <RadioGroup value={saveMethod} onValueChange={(v: any) => setSaveMethod(v)} dir="rtl">
                                    <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="average" id="r-avg" /><Label htmlFor="r-avg">المتوسط</Label></div>
                                    <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="trainer" id="r-tr" /><Label htmlFor="r-tr">المدربين فقط</Label></div>
                                    <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="officer" id="r-of" /><Label htmlFor="r-of">الضباط فقط</Label></div>
                                </RadioGroup>
                            </div>
                        )}
                    </div>
                    <DialogFooter><Button onClick={confirmSaveDraft} disabled={isProcessing}>تأكيد الحفظ</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* نوافذ الحذف */}
            <AlertDialog open={entryToDelete !== null} onOpenChange={() => setEntryToDelete(null)}>
                <AlertDialogContent dir="rtl" className="max-w-[400px] rounded-2xl bg-white">
                    <AlertDialogHeader className="items-center text-center space-y-4">
                        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-500 border border-red-100"><Trash2 className="w-6 h-6" /></div>
                        <AlertDialogTitle>حذف السجل</AlertDialogTitle>
                        <AlertDialogDescription className="text-center font-bold text-slate-600">هل أنت متأكد من حذف هذا السجل (الشباحة)؟</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row-reverse gap-2 sm:justify-center">
                        <AlertDialogAction onClick={executeDeleteEntry} className="bg-red-600 hover:bg-red-700 flex-1 font-bold">نعم، حذف</AlertDialogAction>
                        <AlertDialogCancel className="flex-1 font-bold mt-0">إلغاء</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={dayToDelete !== null} onOpenChange={() => setDayToDelete(null)}>
                <AlertDialogContent dir="rtl" className="max-w-[400px] bg-white rounded-2xl border-2 border-slate-100 shadow-2xl">
                    <AlertDialogHeader className="items-center text-center space-y-4">
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center border border-red-100 mb-2"><Trash2 className="w-8 h-8 text-red-600" /></div>
                        <AlertDialogTitle className="text-xl font-black text-slate-900">حذف سجلات اليوم</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-500 font-bold px-4 text-center leading-relaxed">
                            هل أنت متأكد من حذف جميع سجلات وتفاصيل يوم: <br/>
                            <span className="text-red-600 font-black text-lg bg-red-50 px-2 rounded mt-1 inline-block">{dayToDelete}</span><br/>
                            <span className="text-xs text-red-400 mt-2 block">سيتم حذف كل البيانات المرتبطة بهذا التاريخ نهائياً.</span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row-reverse gap-2 mt-6 sm:justify-center">
                        <AlertDialogAction onClick={executeDeleteDay} className="bg-red-600 text-white font-bold flex-1 h-11 rounded-xl shadow-md hover:bg-red-700 transition-colors">نعم، حذف الكل</AlertDialogAction>
                        <AlertDialogCancel className="font-bold flex-1 h-11 rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 mt-0">تراجع</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={draftToDelete !== null} onOpenChange={() => setDraftToDelete(null)}>
                <AlertDialogContent dir="rtl" className="max-w-[400px] rounded-2xl border-2 border-slate-100 shadow-2xl bg-white">
                    <AlertDialogHeader className="items-center text-center space-y-4">
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-600 animate-pulse border border-red-100"><AlertTriangle className="w-8 h-8" /></div>
                        <AlertDialogTitle className="text-xl font-black text-slate-900">حذف المسودة</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-500 font-bold px-2 text-center leading-relaxed">هل أنت متأكد من حذف هذه المسودة نهائياً؟ <br/><span className="text-xs text-red-400">لا يمكن التراجع عن هذا الإجراء.</span></AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row-reverse gap-2 mt-6 sm:justify-center">
                        <AlertDialogAction onClick={executeDeleteDraft} className="bg-red-600 text-white font-bold flex-1 h-10 rounded-xl shadow-lg hover:bg-red-700">نعم، احذفها</AlertDialogAction>
                        <AlertDialogCancel className="font-bold flex-1 h-10 rounded-xl border-slate-200 hover:bg-slate-50 mt-0">تراجع</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {/* 🟢 نافذة التنبيهات الذكية (تظهر عند وجود نقص أو نتائج تائهة) */}
<AlertDialog open={showWarningsDialog} onOpenChange={setShowWarningsDialog}>
    <AlertDialogContent dir="rtl" className="max-w-2xl bg-white rounded-2xl border-2 shadow-2xl">
        <AlertDialogHeader className="items-start text-right">
    <div className="flex items-center gap-2 text-amber-600 mb-2">
        <ShieldAlert className="w-6 h-6" />
        <AlertDialogTitle className="text-xl font-black">مراجعة دقة البيانات قبل الدمج</AlertDialogTitle>
    </div>
    {/* تأكد من وجود هذا السطر وبداخله نص */}
    <AlertDialogDescription className="text-slate-600 font-bold">
        اكتشف النظام بعض الملاحظات الهامة التي يجب مراجعتها قبل اعتماد الكشف الرسمي:
    </AlertDialogDescription>
</AlertDialogHeader>

        <div className="space-y-4 max-h-[40vh] overflow-y-auto my-4 p-2 bg-slate-50 rounded-lg border">
            {/* السيناريو 1: طلاب بلا درجات */}
            {mergeWarnings.missing_scores.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-sm font-black text-red-700 flex items-center gap-1">⚠️طلاب لديهم شباحات مسجلة ولم تظهر نتائجهم في الرصد:</h4>
                    <div className="grid grid-cols-1 gap-1">
                        {mergeWarnings.missing_scores.map((s:any, i:number) => (
                            <div key={i} className="text-[11px] bg-red-50 p-2 rounded border border-red-100 flex justify-between">
                                <span>{s.name} ({s.military_id})</span>
                                <Badge variant="outline" className="bg-white">شباحة: {s.shabaha} {COLOR_MAP[s.color] || s.color}</Badge>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* السيناريو 2: درجات بلا طلاب */}
            {mergeWarnings.unlinked_results.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                    <h4 className="text-sm font-black text-blue-700 flex items-center gap-1">🔍 نتائج مرصودة لشباحات غير مسجلة لطلاب (تائهة):</h4>
                    <div className="grid grid-cols-2 gap-2">
                        {mergeWarnings.unlinked_results.map((r:any, i:number) => (
                            <div key={i} className="text-[10px] bg-blue-50 p-2 rounded border border-blue-100 flex flex-col">
                                <span className="font-bold">شباحة: {r.shabaha} {COLOR_MAP[r.color] || r.color}</span>
                                <span className="opacity-70">الدرجة: ضغط {r.push} - بطن {r.sit}</span>
                                <span className="text-blue-800 font-black">المدخل: {r.entered_by}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        <AlertDialogFooter className="flex-row-reverse gap-2 sm:justify-center border-t pt-4">
          <AlertDialogAction 
    onClick={() => {
        // 1. هل البيانات التي ننتظر دمجها هي بيانات "تعارض" (تكرار)؟
        const isConflictData = pendingMergeData.length > 0 && pendingMergeData[0].entries;

        if (isConflictData) {
            // 🚨 حالة وجود تكرار
            if (isCommitteeMode) {
                // ✅ إذا المشرف مفعّل نظام اللجان -> نفتح نافذة الضابط/المدرب
                prepareCommitteeData(pendingMergeData);
            } else {
                // ❌ إذا المشرف غير مفعّل نظام اللجان -> نرفض الدمج ونعطيه رسالة خطأ كما كان سابقاً
                toast.error("فشل الدمج: يوجد تكرار في أرقام الشباحات. يرجى التصحيح في الجدول.");
                setPageMode('raw');
            }
        } else {
            // ✅ حالة الدمج الطبيعي (لا يوجد تكرار)
            if (isCommitteeMode) {
                prepareCommitteeDataFromNormal(pendingMergeData);
            } else {
                setTableData(pendingMergeData);
                setPageMode('merged');
            }
        }
        setShowWarningsDialog(false);
    }}
    className="bg-green-600 hover:bg-green-700 text-white font-bold flex-1"
>
    استكمال العملية (تجاهل)
</AlertDialogAction>
            <AlertDialogCancel 
                onClick={() => setShowWarningsDialog(false)}
                className="font-bold flex-1 border-slate-200"
            >
                تراجع لتصحيح البيانات
            </AlertDialogCancel>
        </AlertDialogFooter>
    </AlertDialogContent>
</AlertDialog>
 {/* --- Dialog استيراد الجري مع اختيار الأعمدة والمعاينة --- */}
<Dialog open={showRunImportDialog} onOpenChange={setShowRunImportDialog}>
    <DialogContent dir="rtl" className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-700">
                <Timer className="w-5 h-5"/> استيراد بيانات الجري
            </DialogTitle>
        </DialogHeader>

        {/* اختيار الأعمدة */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border">
            <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">عمود الرقم العسكري</label>
                <Select value={selectedIdCol} onValueChange={(v) => {
                    setSelectedIdCol(v);
                    buildRunPreview(v, selectedRunCol);
                }}>
                    <SelectTrigger><SelectValue placeholder="اختر العمود"/></SelectTrigger>
                    <SelectContent>
                        {runColumnOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">عمود وقت الجري</label>
                <Select value={selectedRunCol} onValueChange={(v) => {
                    setSelectedRunCol(v);
                    buildRunPreview(selectedIdCol, v);
                }}>
                    <SelectTrigger><SelectValue placeholder="اختر العمود"/></SelectTrigger>
                    <SelectContent>
                        {runColumnOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </div>

        {/* زر المعاينة */}
        <Button variant="outline" onClick={() => buildRunPreview(selectedIdCol, selectedRunCol)}
            className="w-full border-indigo-300 text-indigo-700">
            🔍 معاينة النتائج
        </Button>

        {/* جدول المعاينة */}
        {runImportPreview.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 text-sm font-bold flex justify-between">
                    <span>إجمالي الصفوف: {runImportPreview.length}</span>
                    <span className={isImportReady ? "text-green-600" : "text-red-600"}>
                        {isImportReady ? "✅ كل الأرقام متطابقة" : `❌ ${runImportPreview.filter(r => !r.found).length} رقم غير موجود`}
                    </span>
                </div>
                <div className="max-h-60 overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50">
                                <TableHead className="text-center font-bold">الرقم العسكري</TableHead>
                                <TableHead className="text-center font-bold">وقت الجري</TableHead>
                                <TableHead className="text-center font-bold">الحالة</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {runImportPreview.map((r, i) => (
                                <TableRow key={i} className={r.found ? "" : "bg-red-50"}>
                                    <TableCell className="text-center font-mono">{r.military_id}</TableCell>
                                    <TableCell className="text-center font-bold text-indigo-700">{r.run_time}</TableCell>
                                    <TableCell className="text-center">
                                        {r.found 
                                            ? <Badge className="bg-green-100 text-green-700">✓ موجود</Badge>
                                            : <Badge className="bg-red-100 text-red-700">✗ غير موجود</Badge>
                                        }
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        )}

        <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRunImportDialog(false)}>إلغاء</Button>
            <Button 
                onClick={confirmRunImport}
                disabled={!isImportReady || runImportPreview.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            >
                <Check className="w-4 h-4"/> تأكيد الدمج ({runImportPreview.filter(r=>r.found).length} سجل)
            </Button>
        </DialogFooter>
    </DialogContent>
</Dialog>
        </div>
        </ProtectedRoute>
      );
  }

  // --- List View (Default) ---
  return (
<ProtectedRoute allowedRoles={["owner","assistant_admin"]}>
    <div className="p-4  space-y-6 pb-10 md:pb-32" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardCheck className="w-8 h-8 text-blue-600" /> إدارة نتائج اللياقة
        </h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" dir="rtl">
        <TabsList className="grid w-full md:w-[400px] grid-cols-2 bg-slate-100 p-1" >
          <TabsTrigger value="daily-logs">سجل الإدخالات اليومي</TabsTrigger>
          <TabsTrigger value="merge">دمج الاختبار (المسودات)</TabsTrigger>
        </TabsList>

        <TabsContent value="daily-logs" className="space-y-6" dir="rtl">
           <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border shadow-sm mt-4">
             <div className="flex items-center gap-3 flex-1">
                <Calendar className="w-5 h-5 text-slate-400" />
                <Input type="date" value={searchDates.start} onChange={(e)=>setSearchDates({...searchDates, start: e.target.value})} className="h-9 w-40" />
                <Input type="date" value={searchDates.end} onChange={(e)=>setSearchDates({...searchDates, end: e.target.value})} className="h-9 w-40" />
                <Button variant="default" size="sm" onClick={fetchDailySummaries} className="bg-blue-600 h-9 px-6">بحث</Button>
             </div>
             <Button variant="outline" onClick={fetchDailySummaries} disabled={isRefreshing}><RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} /> تحديث</Button>
           </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    {/* 🟢 نستخدم paginatedDaily التي تفرز الأحدث وتأخذ 10 فقط */}
    {paginatedDaily.map((day: any) => (
        <Card 
            key={day.date} 
            className="hover:shadow-lg transition-all border-t-4 border-t-blue-600 cursor-pointer group relative overflow-hidden bg-white" 
            onClick={() => openDayDetails(day.date)}
        >
            <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-2 left-2 z-10 text-slate-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                onClick={(e) => {
                    e.stopPropagation(); 
                    setDayToDelete(day.date); 
                }}
            >
                <Trash2 className="w-5 h-5" />
            </Button>

            <CardHeader className="pb-2">
                <CardTitle className="text-xl flex justify-between items-center group-hover:text-blue-700 transition-colors">
                    {day.date}
                    <Badge variant="secondary" className="bg-slate-100 text-slate-800">{day.total_entries} سجل</Badge>
                </CardTitle>
                <CardDescription>اضغط للفتح ومعالجة البيانات</CardDescription>
            </CardHeader>
        </Card>
    ))}
</div>

{/* 🟢 أزرار التنقل لسجل الإدخالات المطور */}
{dailySummaries.length > 0 && (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-8 no-print border-t pt-4 bg-slate-50/50 p-4 rounded-xl">
        {/* اختيار عدد العناصر */}
        <div className="flex items-center gap-2">
            <Label className="text-xs font-bold text-slate-500">عرض:</Label>
            <Select value={String(cardsPerPage)} onValueChange={(v) => {setCardsPerPage(Number(v)); setDailyPage(1);}}>
                <SelectTrigger className="w-24 h-8 text-xs bg-white font-bold shadow-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="10">10 أيام</SelectItem>
                    <SelectItem value="20">20 يوم</SelectItem>
                    <SelectItem value="50">50 يوم</SelectItem>
                </SelectContent>
            </Select>
            <span className="text-[10px] text-slate-400 font-bold mr-2">إجمالي الأيام: {dailySummaries.length}</span>
        </div>

        {/* أزرار السابق والتالي */}
        <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" disabled={dailyPage === 1} onClick={() => setDailyPage(p => p - 1)} className="font-bold h-8 px-4 bg-white shadow-sm">
                <ChevronRight className="w-4 h-4 ml-1" /> السابق
            </Button>
            <div className="text-xs font-black bg-white px-4 py-1 rounded-lg border shadow-inner text-blue-700">
                صفحة {dailyPage} من {Math.max(1, Math.ceil(dailySummaries.length / cardsPerPage))}
            </div>
            <Button variant="outline" size="sm" disabled={dailyPage >= Math.ceil(dailySummaries.length / cardsPerPage)} onClick={() => setDailyPage(p => p + 1)} className="font-bold h-8 px-4 bg-white shadow-sm">
                التالي <ChevronLeft className="w-4 h-4 mr-1" />
            </Button>
        </div>
    </div>
)}
        </TabsContent>

        <TabsContent value="merge" className="space-y-6" dir="rtl">
            <div className="flex justify-between items-center bg-white p-3 rounded-xl border shadow-sm">
                <div className="flex items-center gap-2">
                    <PenTool className="w-5 h-5 text-orange-500"/>
                    <h3 className="font-bold text-slate-700">المسودات المحفوظة</h3>
                </div>
                <Button onClick={fetchDrafts} variant="outline" size="sm" disabled={isDraftsRefreshing} className="gap-2">
                    <RefreshCw className={`w-4 h-4 ${isDraftsRefreshing ? "animate-spin text-blue-600" : ""}`}/> 
                    {isDraftsRefreshing ? "جاري التحديث..." : "تحديث القائمة"}
                </Button>
            </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {draftsList.length === 0 ? (
        <div className="col-span-full py-20 text-center text-slate-400 border-2 border-dashed rounded-xl bg-slate-50">
            <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>لا توجد مسودات محفوظة حالياً.</p>
        </div>
    ) : (
        /* 🟢 نستخدم paginatedDrafts لعرض أحدث 10 مسودات */
        paginatedDrafts.map((draft: any) => (
            <Card 
                key={draft.id} 
                onClick={() => handleOpenDraft(draft)}
                className="hover:shadow-lg transition-all cursor-pointer border-t-4 border-t-blue-500 relative group bg-white overflow-hidden"
            >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-400"></div>

                <CardHeader className="pb-3 pt-5">
                    <div className="flex justify-between items-start">
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200 gap-1 shadow-none">
                            <CheckCircle className="w-3 h-3"/> مكتملة
                        </Badge>
                        
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 -mt-1 -ml-2 transition-colors z-10"
                            onClick={(e) => {
                                e.stopPropagation(); 
                                setDraftToDelete(draft.id); 
                            }}
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                    
                    <CardTitle className="text-lg mt-2 text-slate-800 line-clamp-1">{draft.title}</CardTitle>
                    
                    <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs font-normal bg-slate-100 text-slate-600">
                            {draft.course}
                        </Badge>
                        <Badge variant="secondary" className="text-xs font-normal bg-slate-100 text-slate-600">
                            الدفعة {draft.batch}
                        </Badge>
                    </div>
                </CardHeader>
                
                <CardFooter className="pt-0 pb-4 text-xs text-slate-400 flex justify-between items-center border-t border-slate-50 mt-2 p-4">
    <span className="flex items-center gap-1">
        <Calendar className="w-3 h-3"/> {new Date(draft.exam_date).toISOString().split('T')[0]}
    </span>
    <span className="flex items-center gap-1 font-mono">
        {draft.students_data?.length || 0} طالب
    </span>
</CardFooter>
            </Card>
        ))
    )}
</div>

{/* 🟢 أزرار التنقل للمسودات المطور */}
{draftsList.length > 0 && (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-8 no-print border-t pt-4 bg-slate-50/50 p-4 rounded-xl">
        {/* اختيار عدد العناصر */}
        <div className="flex items-center gap-2">
            <Label className="text-xs font-bold text-slate-500">عرض:</Label>
            <Select value={String(cardsPerPage)} onValueChange={(v) => {setCardsPerPage(Number(v)); setDraftsPage(1);}}>
                <SelectTrigger className="w-24 h-8 text-xs bg-white font-bold shadow-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="10">10 مسودات</SelectItem>
                    <SelectItem value="20">20 مسودة</SelectItem>
                    <SelectItem value="50">50 مسودة</SelectItem>
                </SelectContent>
            </Select>
            <span className="text-[10px] text-slate-400 font-bold mr-2">إجمالي المسودات: {draftsList.length}</span>
        </div>

        {/* أزرار السابق والتالي */}
        <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" disabled={draftsPage === 1} onClick={() => setDraftsPage(p => p - 1)} className="font-bold h-8 px-4 bg-white shadow-sm">
                <ChevronRight className="w-4 h-4 ml-1" /> السابق
            </Button>
            <div className="text-xs font-black bg-white px-4 py-1 rounded-lg border shadow-inner text-blue-700">
                صفحة {draftsPage} من {Math.max(1, Math.ceil(draftsList.length / cardsPerPage))}
            </div>
            <Button variant="outline" size="sm" disabled={draftsPage >= Math.ceil(draftsList.length / cardsPerPage)} onClick={() => setDraftsPage(p => p + 1)} className="font-bold h-8 px-4 bg-white shadow-sm">
                التالي <ChevronLeft className="w-4 h-4 mr-1" />
            </Button>
        </div>
    </div>
)}
        </TabsContent>
      </Tabs>

      {/* نوافذ الحذف الموحدة */}
      <AlertDialog open={dayToDelete !== null} onOpenChange={() => setDayToDelete(null)}>
        <AlertDialogContent dir="rtl" className="max-w-[400px] bg-white rounded-2xl border-2 border-slate-100 shadow-2xl">
            <AlertDialogHeader className="items-center text-center space-y-4">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center border border-red-100 mb-2"><Trash2 className="w-8 h-8 text-red-600" /></div>
                <AlertDialogTitle className="text-xl font-black text-slate-900">حذف سجلات اليوم</AlertDialogTitle>
                <AlertDialogDescription className="text-slate-500 font-bold px-4 text-center leading-relaxed">
                    هل أنت متأكد من حذف جميع سجلات وتفاصيل يوم: <br/>
                    <span className="text-red-600 font-black text-lg bg-red-50 px-2 rounded mt-1 inline-block">{dayToDelete}</span><br/>
                    <span className="text-xs text-red-400 mt-2 block">سيتم حذف كل البيانات المرتبطة بهذا التاريخ نهائياً.</span>
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-2 mt-6 sm:justify-center">
                <AlertDialogAction onClick={executeDeleteDay} className="bg-red-600 text-white font-bold flex-1 h-11 rounded-xl shadow-md hover:bg-red-700 transition-colors">نعم، حذف الكل</AlertDialogAction>
                <AlertDialogCancel className="font-bold flex-1 h-11 rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 mt-0">تراجع</AlertDialogCancel>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={draftToDelete !== null} onOpenChange={() => setDraftToDelete(null)}>
        <AlertDialogContent dir="rtl" className="max-w-[400px] rounded-2xl border-2 border-slate-100 shadow-2xl bg-white">
            <AlertDialogHeader className="items-center text-center space-y-4">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-600 animate-pulse border border-red-100"><AlertTriangle className="w-8 h-8" /></div>
                <AlertDialogTitle className="text-xl font-black text-slate-900">حذف المسودة</AlertDialogTitle>
                <AlertDialogDescription className="text-slate-500 font-bold px-2 text-center leading-relaxed">هل أنت متأكد من حذف هذه المسودة نهائياً؟ <br/><span className="text-xs text-red-400">لا يمكن التراجع عن هذا الإجراء.</span></AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-2 mt-6 sm:justify-center">
                <AlertDialogAction onClick={executeDeleteDraft} className="bg-red-600 text-white font-bold flex-1 h-10 rounded-xl shadow-lg hover:bg-red-700">نعم، احذفها</AlertDialogAction>
                <AlertDialogCancel className="font-bold flex-1 h-10 rounded-xl border-slate-200 hover:bg-slate-50 mt-0">تراجع</AlertDialogCancel>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
     
    </div>
    </ProtectedRoute>
  )
}