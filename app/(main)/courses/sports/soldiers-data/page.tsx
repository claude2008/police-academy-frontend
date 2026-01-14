"use client"

import React, { useState, useEffect, useMemo } from "react" 
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription
} from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge" // 🟢 تأكد من وجود هذا المكون
import { 
  Search, Plus, FileSpreadsheet, User, 
  Edit, Trash2, ChevronLeft, ChevronRight, AlertTriangle, Loader2, Save, Download, Users, Archive, RotateCcw
} from "lucide-react"
import { toast } from "sonner" 
import * as XLSX from 'xlsx'
import { format } from "date-fns"
import ProtectedRoute from "@/components/ProtectedRoute"
import { cn } from "@/lib/utils"
// دالة مساعدة لتوليد رابط الاستعلام
const buildQuery = (params: any) => {
  const q = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] && params[key] !== 'all') q.append(key, params[key]);
  });
  return q.toString();
}

export default function SoldiersDataPage() {
  // --- الحالات (States) ---
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards'); 
  const [activeStatus, setActiveStatus] = useState<string>("active");
  const [coursesList, setCoursesList] = useState<any[]>([]); 
  const [showArchived, setShowArchived] = useState(false); // 🟢 التحكم في الأرشيف

  // متغيرات البحث والترقيم للبطاقات
  const [cardSearch, setCardSearch] = useState(""); 
  const [currentCardPage, setCurrentCardPage] = useState(1); 
  const [cardsPerPage, setCardsPerPage] = useState(12);

  const [soldiers, setSoldiers] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  const [filterOptions, setFilterOptions] = useState<any>({
      courses: [], batches: [], companies: [], platoons: []
  })
  
  // حالات البحث والفلترة للجدول
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [photoToDelete, setPhotoToDelete] = useState<number | null>(null);
  const [filterCourse, setFilterCourse] = useState("all")
  const [filterBatch, setFilterBatch] = useState("all")
  const [filterCompany, setFilterCompany] = useState("all")
  const [filterPlatoon, setFilterPlatoon] = useState("all")
  const [filterNationality, setFilterNationality] = useState("all")
  const [filterMinHeight, setFilterMinHeight] = useState("")
  const [filterMaxHeight, setFilterMaxHeight] = useState("")
  
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(100)

  const [userRole, setUserRole] = useState<string | null>(null);
  const canUploadPhoto = useMemo(() => {
    return ["owner", "manager", "admin", "assistant_admin", "sports_officer", "sports_supervisor", "sports_trainer"].includes(userRole || "");
}, [userRole]);

const canDeletePhoto = useMemo(() => {
    return ["owner", "manager", "assistant_admin"].includes(userRole || "");
}, [userRole]);
  const SPORTS_RESTRICTED_ROLES = ["sports_trainer", "sports_supervisor"]; 

  // نوافذ (Modals)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)

  const [newSoldier, setNewSoldier] = useState({
    name: "", militaryId: "", rank: "", nationality: "", phone: "",
    course: "", batch: "", company: "", platoon: "", 
    dob: "", height: "", weight: ""
  })
  
  const [editingSoldier, setEditingSoldier] = useState<any>(null)

  const normalizeInput = (val: string) => {
    if (!val) return "";
    return val.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    try {
        const userStr = localStorage.getItem("user");
        if (userStr) {
            const user = JSON.parse(userStr);
            setUserRole(user.role || null); 
        }
    } catch (e) { /* ignore */ }
    
    fetchFilters();
    fetchCourses();
  }, [])

  // جلب قائمة الدورات (للبطاقات)
  const fetchCourses = async () => {
      try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/summary`, {
             headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
          });

          if (res.ok) {
              const data = await res.json();
              setCoursesList(data);
          }
      } catch (e) { console.error("Error fetching courses") }
  }

  // جلب الفلاتر (للجدول)
  const fetchFilters = async () => {
      try {
          const params = new URLSearchParams()
          if (filterCourse !== 'all') params.append('course', filterCourse)
          if (filterBatch !== 'all') params.append('batch', filterBatch)
          if (filterCompany !== 'all') params.append('company', filterCompany)

          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/filters-options?${params.toString()}`)
          if (res.ok) {
              const data = await res.json()
              setFilterOptions(data)
          }
      } catch (e) { console.error("Filter fetch error") }
  }

  useEffect(() => {
      fetchFilters();
  }, [filterCourse, filterBatch, filterCompany]);

  // جلب الجنود (للجدول)
  const fetchSoldiers = async () => {
      if (viewMode !== 'table') return; 

      setLoading(true)
      try {
          const skip = (currentPage - 1) * itemsPerPage;
          const params = {
            skip: skip.toString(),
            limit: itemsPerPage.toString(),
            search: debouncedSearch,
            course: filterCourse,
            batch: filterBatch,
            company: filterCompany,
            platoon: filterPlatoon,
            active_status: activeStatus, // 🟢 أضف هذا السطر هنا ليرسله للباك إند
            nationality: filterNationality !== 'all' ? filterNationality : '',
            min_height: filterMinHeight,
            max_height: filterMaxHeight
          };
          const queryString = buildQuery(params);
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/?${queryString}`)
          if (res.ok) {
              const responseData = await res.json()
              if (responseData.data) {
                setSoldiers(responseData.data)
                setTotalCount(responseData.total)
              } else {
                setSoldiers(responseData)
              }
          }
      } catch (error) { toast.error("فشل الاتصال بالسيرفر") } 
      finally { setLoading(false) }
  }

  useEffect(() => { 
      if (viewMode === 'table') {
          fetchSoldiers(); 
      }
  }, [currentPage, itemsPerPage, debouncedSearch, filterCourse, filterBatch, filterCompany, filterPlatoon, viewMode, activeStatus]); // 🟢 أضف activeStatus هنا
  
  useEffect(() => { setCurrentPage(1) }, [debouncedSearch, filterCourse, filterBatch, filterCompany, filterPlatoon, itemsPerPage])

  const totalPages = Math.ceil(totalCount / itemsPerPage)

  // 🟢 منطق فلترة وترقيم البطاقات
  const filteredCourses = useMemo(() => {
    return coursesList.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(cardSearch.toLowerCase()) || 
                            (c.batch && c.batch.toLowerCase().includes(cardSearch.toLowerCase()));
      const matchesArchive = showArchived ? true : c.is_active;
      return matchesSearch && matchesArchive;
    });
  }, [coursesList, cardSearch, showArchived]);

  const totalCardPages = Math.ceil(filteredCourses.length / cardsPerPage);
  const displayedCourses = filteredCourses.slice(
    (currentCardPage - 1) * cardsPerPage, 
    currentCardPage * cardsPerPage
  );
const handlePhotoUpload = async (soldierId: number, file: File) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        const base64 = reader.result;
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/${soldierId}/photo`, {
                method: "PUT",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify({ image_base64: base64 })
            });
            if (res.ok) {
                toast.success("تم رفع الصورة بنجاح");
                fetchSoldiers(); // تحديث الجدول
            }
        } catch (e) { toast.error("فشل الرفع"); }
    };
};

const handlePhotoDeleteClick = (soldierId: number) => {
    setPhotoToDelete(soldierId); // نفتح النافذة ونخزن ID الجندي
};

const confirmPhotoDelete = async () => {
    if (!photoToDelete) return;
    
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/${photoToDelete}/photo`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        if (res.ok) {
            toast.success("تم حذف الصورة بنجاح");
            fetchSoldiers();
        }
    } catch (e) { 
        toast.error("فشل حذف الصورة"); 
    } finally {
        setPhotoToDelete(null); // نغلق النافذة في كل الحالات
    }
};
  const filteredSoldiers = useMemo(() => {
    return soldiers.filter(s => {
        const matchNationality = filterNationality === "all" || s.nationality === filterNationality;
        const sHeight = parseFloat(s.height) || 0;
        const minH = parseFloat(filterMinHeight) || 0;
        const maxH = parseFloat(filterMaxHeight) || 300; 
        const matchHeight = sHeight >= minH && sHeight <= maxH;
        return matchNationality && matchHeight;
    });
  }, [soldiers, filterNationality, filterMinHeight, filterMaxHeight]);

  const canEditOrDelete = useMemo(() => {
      if (!userRole) return false;
      return !SPORTS_RESTRICTED_ROLES.includes(userRole);
  }, [userRole]);

  // --- Handlers ---

  const handleToggleCourse = async (courseId: string, isActive: boolean) => {
      setCoursesList(prev => prev.map(c => c.id === courseId ? { ...c, is_active: isActive } : c));
      try {
          const token = localStorage.getItem("token");
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${courseId}/toggle`, {
              method: 'PUT',
              headers: { "Authorization": `Bearer ${token}` }
          });

          if (!res.ok) {
              setCoursesList(prev => prev.map(c => c.id === courseId ? { ...c, is_active: !isActive } : c));
              toast.error("فشل تغيير الحالة");
          } else {
              const data = await res.json();
              toast.success(data.message);
              if (viewMode === 'table') fetchSoldiers();
          }
      } catch (error) {
          toast.error("خطأ في الاتصال");
          setCoursesList(prev => prev.map(c => c.id === courseId ? { ...c, is_active: !isActive } : c));
      }
  };

  const openEditModal = (soldier: any) => {
    setEditingSoldier({
        id: soldier.id,
        military_id: soldier.military_id,
        name: soldier.name || "", 
        rank: soldier.rank || "",
        phone: soldier.phone || "",
        course: soldier.course || "",
        batch: soldier.batch || "",
        company: soldier.company || "",
        platoon: soldier.platoon || "",
        nationality: soldier.nationality || "",
        dob: soldier.dob || "",
        height: soldier.height || "",
        initial_weight: soldier.initial_weight || "" 
    })
    setIsEditOpen(true)
  }

  const handleBulkDeleteClick = () => {
    if (filterCourse === "all") {
        toast.warning("تنبيه أمان", { description: "يجب تحديد الدورة أولاً." })
        return;
    }
    setIsBulkDeleteOpen(true);
  }

 const handleAddSoldier = async () => {
    if (!newSoldier.name || !newSoldier.militaryId) { 
        toast.error("بيانات ناقصة"); 
        return; 
    }
    try {
        const payload = {
            military_id: normalizeInput(newSoldier.militaryId), 
            name: newSoldier.name, 
            rank: newSoldier.rank || "مستجد",
            course: newSoldier.course, 
            batch: newSoldier.batch, 
            company: newSoldier.company, 
            platoon: newSoldier.platoon,
            nationality: newSoldier.nationality, 
            dob: newSoldier.dob || null, 
            phone: normalizeInput(newSoldier.phone),
            height: Number(normalizeInput(newSoldier.height)) || 0, 
            initial_weight: Number(normalizeInput(newSoldier.weight)) || 0
        };
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/`, { 
            method: "POST", 
            body: JSON.stringify(payload) 
        });
        if (res.ok) {
            toast.success("تم الحفظ بنجاح");
            setIsAddOpen(false);
            setNewSoldier({ 
                name: "", militaryId: "", rank: "", nationality: "", 
                phone: "", course: "", batch: "", company: "", 
                platoon: "", dob: "", height: "", weight: "" 
            });
            fetchSoldiers();
            fetchCourses(); // تحديث البطاقات
            fetchFilters();
        } else { 
            const errorData = await res.json();
            toast.error(errorData.detail || "فشل الحفظ"); 
        }
    } catch (e) { 
        toast.error("فشل الاتصال بالسيرفر"); 
    }
};

 const handleSaveChanges = async () => {
    if (!editingSoldier) return;
    setIsSaving(true);
    try {
        const payload = {
            military_id: normalizeInput(editingSoldier.military_id),
            name: editingSoldier.name || "", 
            rank: editingSoldier.rank || "", 
            phone: normalizeInput(editingSoldier.phone) || "",
            course: editingSoldier.course || "", 
            batch: editingSoldier.batch || "",
            company: editingSoldier.company || "", 
            platoon: editingSoldier.platoon || "",
            dob: editingSoldier.dob || null, 
            nationality: editingSoldier.nationality || "",
            height: Number(normalizeInput(String(editingSoldier.height))) || 0, 
            initial_weight: Number(normalizeInput(String(editingSoldier.initial_weight))) || 0
        };
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/${editingSoldier.id}`, { 
            method: 'PUT', 
            body: JSON.stringify(payload) 
        });
        if (response.ok) {
            toast.success("تم التعديل بنجاح");
            setIsEditOpen(false); 
            fetchSoldiers(); 
        } else { 
            const errorBody = await response.json();
            toast.error(errorBody.detail || "فشل التعديل");
        }
    } catch (error) { 
        toast.error("خطأ في الاتصال بالسيرفر");
    } finally { 
        setIsSaving(false); 
    }
};

  const confirmDelete = async () => {
  if (deleteId) {
    const deletePromise = fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/${deleteId}`, {
      method: "DELETE"
    }).then(async (res) => {
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "فشل الحذف");
      }
      return res.json();
    });
    toast.promise(deletePromise, {
      loading: 'جاري الحذف...',
      success: () => {
        setDeleteId(null);
        fetchSoldiers();
        return 'تم الحذف بنجاح';
      },
      error: (err) => `خطأ: ${err.message}`
    });
  }
}
// 🟢 دالة استعادة المجند
  const handleRestore = async (id: number) => {
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/${id}/restore`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        if (res.ok) {
            toast.success("تمت استعادة المجند بنجاح");
            fetchSoldiers();
            fetchCourses(); // لتحديث الأعداد في البطاقات
        } else {
            toast.error("فشل الاستعادة");
        }
    } catch (e) { toast.error("خطأ في الاتصال"); }
  };

 const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const formData = new FormData();
    formData.append("file", e.target.files[0]);
    const loadingToast = toast.loading("جاري رفع ومعالجة الملف...");
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/upload/excel`, { 
            method: "POST", 
            body: formData 
        });
        if (res.ok) {
            toast.dismiss(loadingToast);
            toast.success("تم استيراد البيانات بنجاح");
            fetchSoldiers();
            fetchCourses(); 
        } else {
            toast.dismiss(loadingToast);
            toast.error("فشل الاستيراد");
        }
    } catch {
        toast.dismiss(loadingToast);
        toast.error("خطأ في الاتصال");
    } finally {
        e.target.value = "";
    }
};

  const handleExportExcel = () => {
    const exportData = soldiers.map((s, index) => ({
        "م": index + 1, "الدورة": s.course, "الدفعة": s.batch, "السرية": s.company, "الفصيل": s.platoon,
        "الرتبة": s.rank, "الرقم العسكري": s.military_id, "الاسم": s.name, "الجنسية": s.nationality,
        "تاريخ الميلاد": s.dob, "الطول": s.height, "الوزن": s.initial_weight, "الهاتف": s.phone
    }));
    const ws = XLSX.utils.json_to_sheet(exportData); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "بيانات");
    XLSX.writeFile(wb, `بيانات_${format(new Date(), "yyyy-MM-dd")}.xlsx`); toast.success("تم التصدير");
  }

  const handleBulkDelete = async () => {
    try {
        const userStr = localStorage.getItem("user");
        const token = localStorage.getItem("token") || (userStr ? JSON.parse(userStr).access_token : null);
        if (!token) {
            toast.error("خطأ في المصادقة، يرجى تسجيل الدخول مجدداً");
            return;
        }
        const params = new URLSearchParams({ 
            course: filterCourse, 
            batch: filterBatch, 
            company: filterCompany, 
            platoon: filterPlatoon 
        });
        const deletePromise = fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/bulk-delete?${params}`, { 
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        }).then(async (res) => {
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.detail || "فشل الحذف الجماعي");
            }
            return res.json();
        });
        toast.promise(deletePromise, { 
            loading: 'جاري المسح الجماعي...', 
            success: (data) => { 
                setIsBulkDeleteOpen(false); 
                fetchSoldiers(); 
                return `تم مسح ${data.deleted_count} سجل بنجاح`; 
            }, 
            error: (err) => `خطأ: ${err.message}` 
        });
    } catch (error) { toast.error("حدث خطأ غير متوقع"); }
}

  return (
    <ProtectedRoute allowedRoles={["owner","manager","admin","assistant_admin","sports_officer","sports_supervisor", "sports_trainer"]}>
    <div className="space-y-6 pb-20 md:pb-32 " dir="rtl">
      
      {/* 🟢 الرأس (Header) */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${viewMode === 'cards' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                <User className="w-8 h-8" /> 
            </div>
            <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                    {viewMode === 'cards' ? 'قائمة الدورات والبرامج' : `دورة: ${filterCourse}`}
                </h1>
                <p className="text-slate-500 text-xs font-bold mt-1">
                    {viewMode === 'cards' 
                        ? `الدورات الظاهرة: ${filteredCourses.length}` 
                        : `الدفعة: ${filterBatch !== 'all' ? filterBatch : 'الكل'} | العدد: ${totalCount}`}
                </p>
            </div>
        </div>
        
        {/* أزرار التحكم العامة (تظهر دائماً) */}
        <div className="grid grid-cols-2 sm:flex gap-2 w-full xl:w-auto">
          {["owner", "manager", "admin", "assistant_admin"].includes(userRole || "") && (
            <>
                <div className="relative">
                    <Input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <Button variant="outline" className="gap-2 text-blue-700 w-full border-blue-200 hover:bg-blue-50 font-bold">
                        <FileSpreadsheet className="w-4 h-4" /> استيراد إكسل
                    </Button>
                </div>

                <Button variant="outline" onClick={handleExportExcel} className="gap-2 text-green-700 border-green-200 hover:bg-green-50 font-bold">
                    <Download className="w-4 h-4" /> تصدير
                </Button>

                <Button variant="outline" onClick={handleBulkDeleteClick} className="gap-2 text-red-600 border-red-200 hover:bg-red-50 font-bold">
                    <Trash2 className="w-4 h-4" /> مسح
                </Button>

                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-slate-900 text-white gap-2 font-bold hover:bg-slate-800">
                            <Plus className="w-4 h-4" /> إضافة مجند
                        </Button>
                    </DialogTrigger>
                    {/* أضفنا w-[95vw] لمنع الخروج عن الشاشة، و pb-28 لرفع الأزرار فوق شريط التنقل */}
<DialogContent className="w-[95vw] md:max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 pb-28 md:p-6" dir="rtl">
                        <DialogHeader><DialogTitle>إضافة مجند</DialogTitle><DialogDescription>أدخل البيانات.</DialogDescription></DialogHeader>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
                             <div className="space-y-2">
                                <Label>الرقم العسكري</Label>
                                <Input value={newSoldier.militaryId} onChange={e => setNewSoldier({...newSoldier, militaryId: normalizeInput(e.target.value).replace(/\D/g, '')})} />
                            </div>
                            <div className="space-y-2 md:col-span-2"><Label>الاسم</Label><Input value={newSoldier.name} onChange={e => setNewSoldier({...newSoldier, name: e.target.value})} /></div>
                            <div className="space-y-2"><Label>الجنسية</Label><Input value={newSoldier.nationality} onChange={e => setNewSoldier({...newSoldier, nationality: e.target.value})} /></div>
                            <div className="space-y-2"><Label>تاريخ الميلاد</Label><Input type="date" value={newSoldier.dob} onChange={e => setNewSoldier({...newSoldier, dob: e.target.value})} /></div>
                            <div className="space-y-2">
                                <Label>الهاتف</Label>
                                <Input value={newSoldier.phone} onChange={e => setNewSoldier({...newSoldier, phone: normalizeInput(e.target.value).replace(/\D/g, '')})} />
                            </div>
                            <div className="space-y-2"><Label>الرتبة</Label><Input value={newSoldier.rank} onChange={e => setNewSoldier({...newSoldier, rank: e.target.value})} /></div>
                            <div className="space-y-2"><Label>الدورة</Label><Input value={newSoldier.course} onChange={e => setNewSoldier({...newSoldier, course: e.target.value})} /></div>
                            <div className="space-y-2"><Label>الدفعة</Label><Input value={newSoldier.batch} onChange={e => setNewSoldier({...newSoldier, batch: e.target.value})} /></div>
                            <div className="space-y-2"><Label>السرية</Label><Input value={newSoldier.company} onChange={e => setNewSoldier({...newSoldier, company: e.target.value})} /></div>
                            <div className="space-y-2"><Label>الفصيل</Label><Input value={newSoldier.platoon} onChange={e => setNewSoldier({...newSoldier, platoon: e.target.value})} /></div>
                            <div className="space-y-2"><Label>الطول</Label><Input type="text" value={newSoldier.height} onChange={e => setNewSoldier({...newSoldier, height: normalizeInput(e.target.value).replace(/[^0-9.]/g, '')})} /></div>
                            <div className="space-y-2"><Label>الوزن</Label><Input type="text" value={newSoldier.weight} onChange={e => setNewSoldier({...newSoldier, weight: normalizeInput(e.target.value).replace(/[^0-9.]/g, '')})} /></div>
                        </div>
                        <DialogFooter><Button variant="outline" onClick={() => setIsAddOpen(false)}>إلغاء</Button><Button onClick={handleAddSoldier} className="bg-blue-600 text-white">حفظ</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
            </>
          )}
        </div>
      </div>

      {/* 🟢🟢 المشهد الأول: نظام البطاقات (بالتصميم الجديد الجميل) 🟢🟢 */}
      {viewMode === 'cards' && (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            
            {/* شريط أدوات البطاقات (بحث + فلتر الأرشيف) */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-3 rounded-lg border shadow-sm">
                <div className="flex items-center gap-2 w-full md:w-auto flex-1">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input 
                            placeholder="ابحث باسم الدورة أو رقم الدفعة..." 
                            className="pr-9 font-medium" 
                            value={cardSearch}
                            onChange={(e) => { setCardSearch(e.target.value); setCurrentCardPage(1); }}
                        />
                    </div>
                </div>
                
                <div className="flex items-center gap-6">
                    {/* 🟢 إظهار خيار الأرشيف فقط للمالك (Owner) */}
{userRole === "owner" && (
    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border animate-in fade-in duration-300">
        <Label className="text-xs font-bold text-slate-600 cursor-pointer flex gap-1 items-center" htmlFor="archive-mode">
            <Archive className="w-3.5 h-3.5" /> إظهار الأرشيف
        </Label>
        <Switch 
            id="archive-mode"
            checked={showArchived}
            onCheckedChange={setShowArchived}
            className="data-[state=checked]:bg-amber-600 scale-90"
        />
    </div>
)}

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 whitespace-nowrap font-bold">عرض:</span>
                        <Select value={String(cardsPerPage)} onValueChange={(v) => { setCardsPerPage(Number(v)); setCurrentCardPage(1); }}>
                            <SelectTrigger className="w-[70px] h-9 text-xs font-bold"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="12">12</SelectItem>
                                <SelectItem value="20">20</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* شبكة البطاقات */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {displayedCourses.map((course, idx) => (
                    <div 
                        key={course.id || idx}
                        onClick={() => {
                            setFilterCourse(course.name);
                            setFilterBatch(course.batch || 'all');
                            setViewMode('table');
                        }}
                        className={`
                            bg-white p-6 rounded-2xl border-2 transition-all cursor-pointer group relative overflow-hidden
                            ${course.is_active 
                                ? 'border-slate-100 hover:border-[#c5b391] hover:shadow-xl' 
                                : 'border-slate-200 bg-slate-50 opacity-80 hover:border-slate-300'}
                        `}
                    >
                        {/* الديكور الجانبي (الشريط الملون) */}
                        <div className={`absolute top-0 right-0 w-2 h-full transition-opacity opacity-20 group-hover:opacity-100 ${course.is_active ? 'bg-[#c5b391]' : 'bg-slate-400'}`} />
                        
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-black text-xl text-slate-800 mb-1 group-hover:text-[#8a7a5b] transition-colors line-clamp-1">
                                    {course.name}
                                </h3>
                                <p className="text-[#c5b391] font-bold text-sm mb-3">
                                    {course.batch ? `الدفعة ${course.batch}` : "بدون دفعة"}
                                </p>
                                
                                {/* حالة الدورة (Badge) */}
                                <div>
                                    {course.is_active ? (
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 font-black text-[10px]">
                                            دورة نشطة ✅
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 font-black text-[10px]">
                                            أرشيف 📦
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            {/* زر التفعيل (Switch) - مع منع الانتشار */}
                            <div onClick={(e) => e.stopPropagation()}>
    {userRole === "owner" && (
        <Switch 
            checked={course.is_active}
            onCheckedChange={(checked) => handleToggleCourse(course.id, checked)}
            className="data-[state=checked]:bg-[#c5b391] scale-90"
        />
    )}
</div>
                        </div>

                        {/* الفوتر السفلي للبطاقة */}
                        <div className="mt-6 flex items-center justify-between text-slate-400 text-[11px] font-bold border-t border-dashed border-slate-100 pt-4">
                            <div className="flex items-center gap-2">
                                <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-black">
                                    {course.count || 0} طلاب
                                </span>
                            </div>
                            <span className="group-hover:text-[#c5b391] transition-colors flex items-center gap-1">
                                عرض البيانات <ChevronLeft className="w-3 h-3" />
                            </span>
                        </div>
                    </div>
                ))}

                {/* حالة عدم وجود نتائج */}
                {displayedCourses.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-400 border-2 border-dashed rounded-xl bg-slate-50/50">
                        <Users className="w-12 h-12 mb-2 opacity-20" />
                        <p className="font-bold">لا توجد دورات مطابقة للبحث</p>
                        {coursesList.length === 0 && <p className="text-sm mt-2">قم باستيراد ملف إكسل لإنشاء الدورات تلقائياً</p>}
                    </div>
                )}
            </div>

            {filteredCourses.length > cardsPerPage && (
    <div className="flex justify-between items-center bg-white p-3 px-4 rounded-xl border shadow-sm mt-6">
        <span className="text-xs text-slate-500 font-bold">
            صفحة {currentCardPage} من {totalCardPages}
        </span>
        <div className="flex gap-2">
            <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                    setCurrentCardPage(p => Math.max(1, p - 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }} 
                disabled={currentCardPage === 1} 
                className="h-8 gap-1 font-bold"
            >
                <ChevronRight className="w-4 h-4"/> السابق
            </Button>
            
            <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                    setCurrentCardPage(p => Math.min(totalCardPages, p + 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }} 
                disabled={currentCardPage === totalCardPages} 
                className="h-8 gap-1 font-bold"
            >
                التالي <ChevronLeft className="w-4 h-4"/>
            </Button>
        </div>
    </div>
)}
        </div>
        
      )}

      {/* 🟢🟢 المشهد الثاني: الجدول (Table Mode) 🟢🟢 */}
      {viewMode === 'table' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <div className="flex items-center gap-2">
                <Button 
                    variant="ghost" 
                    onClick={() => {
                        setViewMode('cards');
                        setFilterCourse('all'); 
                        setFilterBatch('all');
                        setSearch(""); 
                    }} 
                    className="gap-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 font-bold"
                >
                    <ChevronRight className="w-4 h-4" /> العودة لقائمة الدورات
                </Button>
            </div>

            <Card>
                <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Select value={filterCourse} onValueChange={(val) => { setFilterCourse(val); setFilterBatch("all"); setFilterCompany("all"); setFilterPlatoon("all"); }}>
                        <SelectTrigger dir="rtl" className="bg-slate-50 border-blue-200"><SelectValue placeholder="الدورة" /></SelectTrigger>
                        <SelectContent align="end"><SelectItem value="all">كل الدورات</SelectItem>{filterOptions.courses.map((c:any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filterBatch} onValueChange={setFilterBatch}>
                        <SelectTrigger dir="rtl"><SelectValue placeholder="الدفعة" /></SelectTrigger>
                        <SelectContent align="end"><SelectItem value="all">كل الدفعات</SelectItem>{filterOptions.batches.map((b:any) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filterCompany} onValueChange={setFilterCompany}>
                        <SelectTrigger dir="rtl"><SelectValue placeholder="السرية" /></SelectTrigger>
                        <SelectContent align="end"><SelectItem value="all">كل السرايا</SelectItem>{filterOptions.companies.map((c:any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filterPlatoon} onValueChange={setFilterPlatoon}>
                        <SelectTrigger dir="rtl"><SelectValue placeholder="الفصيل" /></SelectTrigger>
                        <SelectContent align="end"><SelectItem value="all">كل الفصائل</SelectItem>{filterOptions.platoons.map((p:any) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-dashed">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-slate-500">الجنسية</Label>
                        <Select value={filterNationality} onValueChange={setFilterNationality}>
                            <SelectTrigger className="h-9 text-xs bg-white"><SelectValue placeholder="الجنسية" /></SelectTrigger>
                            <SelectContent align="end">
                                <SelectItem value="all">كل الجنسيات</SelectItem>
                                {Array.from(new Set(soldiers.map(s => s.nationality))).filter(Boolean).map(n => (
                                    <SelectItem key={n} value={n}>{n}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                        <Label className="text-[10px] font-bold text-slate-500">نطاق الطول (سم)</Label>
                        <div className="flex items-center gap-2">
                            <Input placeholder="من (مثلاً 170)" className="h-9 text-xs bg-white" type="number" value={filterMinHeight} onChange={(e) => setFilterMinHeight(e.target.value)} />
                            <span className="text-slate-400 text-xs">إلى</span>
                            <Input placeholder="إلى (مثلاً 185)" className="h-9 text-xs bg-white" type="number" value={filterMaxHeight} onChange={(e) => setFilterMaxHeight(e.target.value)} />
                            {(filterMinHeight || filterMaxHeight || filterNationality !== "all") && (
                                <Button variant="ghost" size="sm" onClick={() => { setFilterMinHeight(""); setFilterMaxHeight(""); setFilterNationality("all"); }} className="h-8 px-2 text-red-500 hover:text-red-600 text-[10px]">تصفية</Button>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col md:flex-row justify-between items-center gap-2">
    <div className="flex items-center gap-2 flex-1 w-full">
        <Search className="w-5 h-5 text-slate-400" />
        <Input placeholder="بحث بالاسم أو الرقم..." className="max-w-md" value={search} onChange={(e) => setSearch(e.target.value)} />
    </div>
    
    {/* 🟢 زر تبديل حالة القيد (نشط / محذوف) */}
    {/* 🟢 إخفاء النشطين والمحذوفين عن الكل إلا الأونر ومساعد المسؤول */}
{["owner", "assistant_admin"].includes(userRole || "") && (
    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border animate-in slide-in-from-left-2">
        <Button 
            variant={activeStatus === "active" ? "default" : "ghost"} 
            size="sm" 
            className="h-7 text-xs font-bold"
            onClick={() => setActiveStatus("active")}
        >
            النشطين
        </Button>
        <Button 
            variant={activeStatus === "inactive" ? "destructive" : "ghost"} 
            size="sm" 
            className="h-7 text-xs font-bold"
            onClick={() => setActiveStatus("inactive")}
        >
            المحذوفين
        </Button>
    </div>
)}
</div>
                </CardContent>
            </Card>

            <div className="border rounded-lg bg-white dark:bg-slate-900 overflow-hidden shadow-sm overflow-x-auto">
                <Table>
                    <TableHeader className="bg-[#c5b391] text-black border-b border-black">
                        <TableRow>
                            <TableHead className="text-center font-bold">#</TableHead><TableHead className="text-center font-bold">الصورة</TableHead>
                            <TableHead className="text-center font-bold">الدورة</TableHead><TableHead className="text-center font-bold">الدفعة</TableHead>
                            <TableHead className="text-center font-bold">السرية</TableHead><TableHead className="text-center font-bold">الفصيل</TableHead>
                            <TableHead className="text-center font-bold">الرتبة</TableHead><TableHead className="text-right font-bold">الرقم العسكري</TableHead>
                            <TableHead className="text-right w-[200px] font-bold">الاسم</TableHead><TableHead className="text-center font-bold">الجنسية</TableHead>
                            <TableHead className="text-center font-bold">الميلاد</TableHead><TableHead className="text-center font-bold">الطول</TableHead>
                            <TableHead className="text-center font-bold">الوزن</TableHead><TableHead className="text-center font-bold">الهاتف</TableHead>
                            {canEditOrDelete && <TableHead className="text-center font-bold">الإجراءات</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? ( 
                            <TableRow><TableCell colSpan={15} className="h-24 text-center">جارِ التحميل...</TableCell></TableRow>
                        ) : filteredSoldiers.length === 0 ? (
                            <TableRow><TableCell colSpan={15} className="h-24 text-center">لا توجد بيانات</TableCell></TableRow>
                        ) : (
                            filteredSoldiers.map((soldier, index) => (
                                <TableRow key={soldier.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <TableCell className="text-center font-mono">{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
                                    <TableCell className="text-center">
    <div className="relative group w-12 h-12 mx-auto">
        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden border-2 border-slate-200 group-hover:border-blue-400 transition-all shadow-sm">
            
            {/* 🟢 عرض الصورة السحابية أو الافتراضية فقط */}
            <label className={cn("w-full h-full", canUploadPhoto ? "cursor-pointer" : "cursor-default")}>
                <img 
                    // إذا وجد رابط سحابي يعرضه، وإلا يعرض الصورة الافتراضية
                    src={soldier.image_url ? `${soldier.image_url}?t=${new Date().getTime()}` : "/placeholder-user.png"} 
                    alt="Soldier" 
                    className="w-full h-full object-cover"
                    onError={(e) => { 
                        (e.target as HTMLImageElement).src = "/placeholder-user.png";
                    }}
                />
                
                {/* مدخل الملف المخفي (يظهر فقط إذا كان للمستخدم صلاحية الرفع) */}
                {canUploadPhoto && (
                    <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*" 
                        onChange={(e) => e.target.files?.[0] && handlePhotoUpload(soldier.id, e.target.files[0])} 
                    />
                )}
            </label>
        </div>

        {/* زر الحذف يظهر فقط فوق الصورة السحابية */}
        {soldier.image_url && canDeletePhoto && (
            <button 
                onClick={() => handlePhotoDeleteClick(soldier.id)}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:scale-110"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        )}
    </div>
</TableCell>
                                    <TableCell className="text-center text-xs">{soldier.course}</TableCell><TableCell className="text-center text-xs">{soldier.batch}</TableCell>
                                    <TableCell className="text-center text-xs">{soldier.company}</TableCell><TableCell className="text-center text-xs">{soldier.platoon}</TableCell>
                                    <TableCell className="text-center text-xs font-bold text-blue-700">{soldier.rank}</TableCell>
                                    <TableCell className="text-right font-bold text-xs">{soldier.military_id}</TableCell>
                                    <TableCell className="text-right font-medium text-xs">{soldier.name}</TableCell>
                                    <TableCell className="text-center text-xs">{soldier.nationality}</TableCell>
                                    <TableCell className="text-center text-xs" dir="ltr">{soldier.dob}</TableCell>
                                    <TableCell className="text-center text-xs">{soldier.height}</TableCell><TableCell className="text-center text-xs">{soldier.initial_weight}</TableCell>
                                    <TableCell className="text-center text-xs">{soldier.phone || "-"}</TableCell>
                                    {canEditOrDelete && (
    <TableCell className="text-center">
        <div className="flex gap-1 justify-center">
            {/* إذا كنا في وضع النشطين نظهر زر التعديل والحذف */}
            {activeStatus === "active" ? (
                <>
                    <Button size="icon" variant="ghost" onClick={() => openEditModal(soldier)} className="h-8 w-8 text-blue-600 hover:bg-blue-50"><Edit className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteId(soldier.id)} className="h-8 w-8 text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                </>
            ) : (
                /* 🟢 إذا كنا في وضع المحذوفين نظهر زر الاستعادة فقط */
                <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleRestore(soldier.id)} 
                    className="h-8 gap-1 text-green-600 border-green-200 hover:bg-green-50 font-bold"
                >
                    <RotateCcw className="w-3.5 h-3.5" /> استعادة
                </Button>
            )}
        </div>
    </TableCell>
)}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between bg-white dark:bg-slate-900 p-4 border rounded-lg shadow-sm gap-4">
                <div className="flex items-center gap-4 text-sm text-slate-500">
                    <span>صفحة <b>{currentPage}</b> من <b>{totalPages || 1}</b> (إجمالي {totalCount})</span>
                    <div className="flex items-center gap-2">
                        <span className="text-xs">عرض:</span>
                        <Select value={String(itemsPerPage)} onValueChange={(val) => { setItemsPerPage(Number(val)); setCurrentPage(1); }}>
                            <SelectTrigger className="w-[100px] h-8 text-xs bg-white">
                                <SelectValue>
                                    {itemsPerPage >= totalCount && totalCount > 0 ? "عرض الكل" : itemsPerPage}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="100">100</SelectItem>
                                <SelectItem value="200">200</SelectItem>
                                <SelectItem value={String(totalCount || 1000)}>عرض الكل</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1 || loading}><ChevronRight className="w-4 h-4 ml-1" /> السابق</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage >= totalPages || loading}>التالي <ChevronLeft className="w-4 h-4 mr-1" /></Button>
                </div>
            </div>
        </div>
      )}

      {/* النوافذ المنبثقة */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        {/* أضفنا w-[95vw] للموبايل و pb-28 لرفع الأزرار */}
<DialogContent className="w-[95vw] md:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 pb-28 md:p-6" dir="rtl">
            <DialogHeader><DialogTitle>تعديل بيانات المجند</DialogTitle><DialogDescription>تعديل البيانات الأساسية.</DialogDescription></DialogHeader>
            {editingSoldier && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                    <div className="space-y-2"><Label>الرقم العسكري</Label><Input value={editingSoldier.military_id} onChange={e => setEditingSoldier({...editingSoldier, military_id: normalizeInput(e.target.value).replace(/\D/g, '')})} className="bg-slate-50" /></div>
                    <div className="space-y-2"><Label>الاسم</Label><Input value={editingSoldier.name} onChange={e => setEditingSoldier({...editingSoldier, name: e.target.value})} /></div>
                    <div className="space-y-2"><Label>الرتبة</Label><Input value={editingSoldier.rank} onChange={e => setEditingSoldier({...editingSoldier, rank: e.target.value})} /></div>
                    <div className="space-y-2"><Label>الهاتف</Label><Input value={editingSoldier.phone} onChange={e => setEditingSoldier({...editingSoldier, phone: normalizeInput(e.target.value).replace(/\D/g, '')})} /></div>
                    <div className="space-y-2 md:col-span-2"><Label>الجنسية</Label><Input value={editingSoldier.nationality} onChange={e => setEditingSoldier({...editingSoldier, nationality: e.target.value})} /></div>
                    <div className="space-y-2"><Label>الدورة</Label><Input value={editingSoldier.course} onChange={e => setEditingSoldier({...editingSoldier, course: e.target.value})} /></div>
                    <div className="space-y-2"><Label>الدفعة</Label><Input value={editingSoldier.batch} onChange={e => setEditingSoldier({...editingSoldier, batch: e.target.value})} /></div>
                    <div className="space-y-2"><Label>السرية</Label><Input value={editingSoldier.company} onChange={e => setEditingSoldier({...editingSoldier, company: e.target.value})} /></div>
                    <div className="space-y-2"><Label>الفصيل</Label><Input value={editingSoldier.platoon} onChange={e => setEditingSoldier({...editingSoldier, platoon: e.target.value})} /></div>
                    <div className="space-y-2"><Label>الطول</Label><Input type="text" value={editingSoldier.height} onChange={e => setEditingSoldier({...editingSoldier, height: normalizeInput(e.target.value).replace(/[^0-9.]/g, '')})} /></div>
                    <div className="space-y-2"><Label>الوزن</Label><Input type="text" value={editingSoldier.initial_weight} onChange={e => setEditingSoldier({...editingSoldier, initial_weight: e.target.value})} /></div>
                </div>
            )}
            <DialogFooter className="flex flex-col md:flex-row gap-2 mt-6">
    <Button 
        onClick={handleSaveChanges} 
        disabled={isSaving} 
        className="w-full md:flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 shadow-lg order-1 md:order-2 gap-2"
    >
        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
        حفظ التغييرات النهائية
    </Button>
    
    <Button 
        variant="outline" 
        onClick={() => setIsEditOpen(false)} 
        className="w-full md:w-auto font-bold h-12 order-2 md:order-1"
    >
        إلغاء التعديل
    </Button>
</DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader className="flex flex-col items-center gap-2"><AlertTriangle className="w-12 h-12 text-red-500" /><DialogTitle>تأكيد الحذف</DialogTitle><DialogDescription>لا تراجع.</DialogDescription></DialogHeader>
            <DialogFooter className="justify-center"><Button variant="outline" onClick={() => setDeleteId(null)}>إلغاء</Button><Button variant="destructive" onClick={confirmDelete}>حذف</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader><DialogTitle>مسح جماعي</DialogTitle><DialogDescription>سيتم حذف المحدد.</DialogDescription></DialogHeader>
            <DialogFooter><Button variant="outline" onClick={() => setIsBulkDeleteOpen(false)}>إلغاء</Button><Button variant="destructive" onClick={handleBulkDelete}>مسح</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      {/* نافذة تأكيد حذف الصورة بتصميم احترافي */}
<Dialog open={!!photoToDelete} onOpenChange={() => setPhotoToDelete(null)}>
    <DialogContent className="max-w-md border-red-100" dir="rtl">
        <DialogHeader className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
                <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <DialogTitle className="text-xl font-black text-slate-900">تأكيد حذف الصورة</DialogTitle>
            <DialogDescription className="text-center font-bold text-slate-500">
                هل أنت متأكد من رغبتك في حذف صورة المجند؟ <br />
                لا يمكن التراجع عن هذه العملية بعد إتمامها.
            </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:gap-0 mt-4">
            <Button 
                variant="outline" 
                onClick={() => setPhotoToDelete(null)}
                className="flex-1 font-bold"
            >
                إلغاء
            </Button>
            <Button 
                variant="destructive" 
                onClick={confirmPhotoDelete}
                className="flex-1 font-bold bg-red-600 hover:bg-red-700"
            >
                نعم، احذف الصورة
            </Button>
        </DialogFooter>
    </DialogContent>
</Dialog>
    </div>
    </ProtectedRoute>
  )
}