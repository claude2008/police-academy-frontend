"use client"

import { useState, useEffect, useMemo } from "react"
import { 
    ShieldCheck, Search, Save, Loader2, ChevronRight, ChevronLeft,
    Filter, LayoutGrid, ListChecks, UserCog, Layers,User,X
} from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import ProtectedRoute from "@/components/ProtectedRoute"

export default function ScopeManagementPage() {
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(20)
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [availableCourses, setAvailableCourses] = useState<any[]>([])
    const [rawSoldiersData, setRawSoldiersData] = useState<any[]>([])
    const [selectedScope, setSelectedScope] = useState({
        courses: [] as string[],
        companies: [] as string[],
        platoons: [] as string[],
        is_restricted: true 
    })

    useEffect(() => {
        fetchUsers()
        fetchInitialData()
    }, [])

const fetchUsers = async () => {
    setLoading(true)
    try {
        const currentUserData = JSON.parse(localStorage.getItem("user") || "{}");
        const currentRole = currentUserData.role || "";
        const currentBranch = currentUserData.branch || "";

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        })
        
        if (res.ok) {
            const data = await res.json()
            
            const filteredStaff = data.filter((u: any) => {
                // 1. الإدارة العامة مخفية دائماً
                if (u.branch === "الإدارة العامة") return false;

                // 2. القيادة العليا (المالك، المدير، الآدمن) يرى الجميع
                // 🟢 لاحظ: استبعدنا assistant_admin من هذه القائمة لكي يخضع لشروط الفرع أدناه
                if (["owner", "manager", "admin"].includes(currentRole)) {
                    return true;
                }

                // 3. 🛡️ المنطق الخاص بمساعد المسؤول (Assistant Admin)
                // إذا كنت مساعد مسؤول، فأنت "مراقب رياضي" ترى فرع الرياضة فقط
                if (currentRole === "assistant_admin") {
                    return u.branch === "تدريب رياضي";
                }

                // 4. بقية الضباط والمشرفين (كلٌ يرى فرعه)
                const isMeMilitary = currentRole.includes("military") || currentBranch === "تدريب عسكري";
                const isMeSports = currentRole.includes("sports") || currentBranch === "تدريب رياضي";

                if (isMeMilitary) return u.branch === "تدريب عسكري" || u.role.includes("military");
                if (isMeSports) return u.branch === "تدريب رياضي" || u.role.includes("sports") || u.role === "trainer";

                return false;
            });

            // الترتيب (الضباط أولاً)
            const sortedStaff = filteredStaff.sort((a: any, b: any) => {
                const aIsOfficer = a.role?.includes('officer') ? 0 : 1;
                const bIsOfficer = b.role?.includes('officer') ? 0 : 1;
                return aIsOfficer - bIsOfficer;
            });

            setUsers(sortedStaff);
        }
    } catch (e) { toast.error("فشل جلب المستخدمين") } finally { setLoading(false) }
}

    const fetchInitialData = async () => {
        try {
            const resCourses = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/active-courses`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
            })
            if (resCourses.ok) setAvailableCourses(await resCourses.json())
            const resSoldiers = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/soldiers/?limit=5000`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
            })
            if (resSoldiers.ok) {
                const result = await resSoldiers.json();
                setRawSoldiersData(result.data || []);
            }
        } catch (e) { console.error(e) }
    }

    const openEditModal = () => {
        if (selectedUserIds.length === 1) {
            const user = users.find(u => u.id === selectedUserIds[0]);
            const scope = user?.extra_permissions?.scope;
            if (scope) {
                setSelectedScope({
                    courses: scope.courses || [],
                    companies: scope.companies || [],
                    platoons: scope.platoons || [],
                    is_restricted: scope.is_restricted ?? true
                });
            } else {
                setSelectedScope({ courses: [], companies: [], platoons: [], is_restricted: true });
            }
        } else {
            setSelectedScope({ courses: [], companies: [], platoons: [], is_restricted: true });
        }
        setIsEditModalOpen(true);
    };

    const toggleUserSelection = (id: number) => {
        setSelectedUserIds(prev => prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id])
    }

    const toggleSelectAll = () => {
        if (selectedUserIds.length === paginatedUsers.length) setSelectedUserIds([])
        else setSelectedUserIds(paginatedUsers.map(u => u.id))
    }

    const dynamicOptions = useMemo(() => {
        if (selectedScope.courses.length === 0) return { companies: [], platoons: [] };
        // هنا نقوم بجمع السرايا والفصائل لكل الدورات المختارة دفعة واحدة
        const filteredSoldiers = rawSoldiersData.filter(s => {
            return selectedScope.courses.some(courseKey => {
                const [cName, cBatch] = courseKey.split('||');
                return s.course === cName && (cBatch ? s.batch === cBatch : true);
            });
        });
        return {
            companies: Array.from(new Set(filteredSoldiers.map(s => s.company).filter(Boolean))).sort(),
            platoons: Array.from(new Set(filteredSoldiers.map(s => s.platoon).filter(Boolean))).sort()
        };
    }, [selectedScope.courses, rawSoldiersData]);

    const filteredUsers = useMemo(() => {
        return users.filter(u => u.name.includes(searchQuery) || u.military_id.includes(searchQuery))
    }, [users, searchQuery])

    const paginatedUsers = useMemo(() => {
        if (itemsPerPage === -1) return filteredUsers
        const start = (currentPage - 1) * itemsPerPage
        return filteredUsers.slice(start, start + itemsPerPage)
    }, [filteredUsers, currentPage, itemsPerPage])

    const totalPages = itemsPerPage === -1 ? 1 : Math.ceil(filteredUsers.length / itemsPerPage)

 const handleBulkSave = async () => {
    setSaving(true);
    let successCount = 0;
    try {
        // 1️⃣ استخراج الدورات المختارة وتصفيتها فوراً من نص "لا توجد..." 
        // هذا يضمن أنه إذا أضفت دورة جديدة، سيتم تجاهل نص التنبيه القديم
        let finalCourses = (selectedScope.courses || []).filter(
            c => c !== "لا توجد دورات مسموحة حالياً"
        );

        let finalCompanies = selectedScope.companies || [];
        let finalPlatoons = selectedScope.platoons || [];

        // 2️⃣ منطق الحماية الذكي:
        // إذا كان التقييد مفعلاً (is_restricted) والمصفوفة أصبحت فارغة بعد التصفية
        if (selectedScope.is_restricted && finalCourses.length === 0) {
            // نعيد وضع "سدادة الأمان" لمنع ظهور كل البيانات في الصفحات الأخرى
            finalCourses = ["لا توجد دورات مسموحة حالياً"];
            finalCompanies = ["NONE"];
            finalPlatoons = ["NONE"];
        }

        // 3️⃣ بناء الكائن النهائي للحفظ
        const finalScopeToSave = {
            courses: finalCourses,
            companies: finalCompanies,
            platoons: finalPlatoons,
            is_restricted: selectedScope.is_restricted
        };

        // 4️⃣ حلقة الحفظ (تعديل الطلب ليرسل الكائن الذكي)
        for (const userId of selectedUserIds) {
            const user = users.find(u => u.id === userId);
            // نضمن دمج النطاق الجديد مع الصلاحيات الأخرى دون مسحها
            const currentPerms = typeof user.extra_permissions === 'object' ? user.extra_permissions : {};
            const updatedPerms = { ...currentPerms, scope: finalScopeToSave };

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${userId}`, {
                method: "PUT",
                headers: { 
                    "Content-Type": "application/json", 
                    "Authorization": `Bearer ${localStorage.getItem("token")}` 
                },
                body: JSON.stringify({ extra_permissions: updatedPerms })
            });
            if (res.ok) successCount++;
        }

        toast.success(`تم تحديث النطاق لـ ${successCount} مستخدم بنجاح ✅`);
        setIsEditModalOpen(false); 
        setSelectedUserIds([]); 
        fetchUsers(); // تحديث الجدول لعرض النتائج الجديدة
        
    } catch (e) { 
        toast.error("حدث خطأ أثناء الاتصال بالسيرفر"); 
    } finally { 
        setSaving(false); 
    }
};

    return (
        <ProtectedRoute allowedRoles={["owner", "manager", "admin", "assistant_admin", "sports_officer", "military_officer", "military_supervisor"]}>
            <div className="p-4 md:p-8 space-y-6 bg-slate-50/50 min-h-screen" dir="rtl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <ShieldCheck className="w-10 h-10 text-slate-700" />
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">إدارة نطاق العمل</h1>
                            <p className="text-slate-500 text-xs font-bold mt-0.5">تحديد صلاحيات الظهور حسب الدورات والسرايا</p>
                        </div>
                    </div>
                    <Button disabled={selectedUserIds.length === 0} onClick={openEditModal} className="bg-slate-900 hover:bg-slate-800 font-bold gap-2 h-11 px-6 rounded-lg shadow-sm text-white transition-all active:scale-95">
                        <UserCog className="w-4 h-4" /> تخصيص النطاق ({selectedUserIds.length})
                    </Button>
                </div>

                <Card className="border border-slate-200 shadow-sm bg-white rounded-xl overflow-hidden">
                    <CardHeader className="bg-white border-b p-4">
                        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                            <div className="relative w-full md:w-96">
                                <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                                <Input placeholder="بحث بالاسم أو الرقم العسكري..." className="pr-10 h-10 bg-slate-50/50 border-slate-200 focus:bg-white transition-all" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                            </div>
                            <div className="flex items-center gap-3">
                                <Label className="text-xs font-bold text-slate-500 underline underline-offset-4">إجمالي المستخدمين: {filteredUsers.length}</Label>
                                <Select value={String(itemsPerPage)} onValueChange={(v) => {setItemsPerPage(Number(v)); setCurrentPage(1)}}>
                                    <SelectTrigger className="h-9 w-24 font-bold bg-slate-50/50"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="20">20</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                        <SelectItem value="-1">الكل</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow className="border-b-slate-200">
                                    <TableHead className="w-12 text-center px-4"><Checkbox checked={selectedUserIds.length === paginatedUsers.length && paginatedUsers.length > 0} onCheckedChange={toggleSelectAll} /></TableHead>
                                    <TableHead className="text-right font-bold text-slate-700 py-3">المستخدم (رتبة / اسم)</TableHead>
                                    <TableHead className="text-center font-bold text-slate-700">الفرع</TableHead>
                                    <TableHead className="text-center font-bold text-slate-700 px-6">النطاق المسموح حالياً</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={4} className="h-40 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></TableCell></TableRow>
                                ) : paginatedUsers.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="h-40 text-center font-bold text-slate-400 italic text-sm">لا يوجد مستخدمين لعرضهم في هذا الفرع</TableCell></TableRow>
                                ) : paginatedUsers.map((u) => (
                                    <TableRow key={u.id} className={`hover:bg-slate-50 transition-colors border-b-slate-100 ${u.role.includes('officer') ? 'bg-blue-50/30 font-black' : ''}`}>
                                        <TableCell className="text-center px-4"><Checkbox checked={selectedUserIds.includes(u.id)} onCheckedChange={() => toggleUserSelection(u.id)} /></TableCell>
                                        <TableCell className="py-3 px-4">
    <div className="flex items-center gap-3">
        {/* 📸 حاوية الصورة الشخصية بنفس تنسيق إدارة المستخدمين */}
        <div className="w-10 h-10 flex-shrink-0 rounded-full overflow-hidden bg-slate-100 border border-slate-200 relative shadow-sm">
            {u.image_url ? (
                <img 
                    src={`${u.image_url}?t=${new Date().getTime()}`} 
                    alt="" 
                    className="object-cover w-full h-full" 
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-50">
                    <User className="w-5 h-5" />
                </div>
            )}
        </div>

        {/* بيانات المستخدم الرسمية */}
        <div className="flex flex-col">
            <span className="font-bold text-slate-900 text-[14px]">
                {u.rank ? `${u.rank} / ` : ''}{u.name}
            </span>
            <span className="text-[11px] text-blue-600 font-bold font-mono">
                #{u.military_id}
            </span>
        </div>
    </div>
</TableCell>
                                        <TableCell className="text-center font-bold text-slate-600 text-[11px]">{u.branch}</TableCell>
                                        <TableCell className="px-6 text-center">
    <div className="flex flex-wrap gap-1 justify-center">
        {/* 1. حالة الفتح الكامل */}
        {u.extra_permissions?.scope?.is_restricted === false ? (
            <Badge className="bg-green-600 text-white text-[9px]">ظهور شامل ✅</Badge>
        ) : (
            /* 2. حالة التقييد */
            (() => {
                // تصفية المصفوفة من جملة "لا توجد..." للعرض فقط
                const realCourses = (u.extra_permissions?.scope?.courses || []).filter(
                    (c: string) => c !== "لا توجد دورات مسموحة حالياً"
                );

                if (realCourses.length > 0) {
                    // عرض الدورات الحقيقية فقط
                    return realCourses.map((c: string) => {
                        const cleanLabel = c.includes('||') ? c.split('||')[0] + ' (' + c.split('||')[1] + ')' : c;
                        return <Badge key={c} variant="outline" className="text-[9px] bg-blue-50 border-blue-200 text-blue-700 font-bold">{cleanLabel}</Badge>
                    });
                } else {
                    // عرض وسم "محجوب" إذا كانت المصفوفة تحتوي فقط على جملة "لا توجد..."
                    return <Badge variant="destructive" className="text-[9px] bg-red-50 text-red-600 border-red-100 font-black">تقييد كلي 🔒</Badge>
                }
            })()
        )}
    </div>
</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {itemsPerPage !== -1 && (
                    <div className="flex items-center justify-center gap-4 py-4">
                        <Button variant="ghost" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="font-bold text-slate-600 transition-all hover:bg-white hover:shadow-sm"><ChevronRight className="ml-1 h-4 w-4" /> السابق</Button>
                        <div className="text-xs font-bold text-slate-500 bg-white border px-4 py-1.5 rounded-lg shadow-sm">صفحة {currentPage} من {totalPages}</div>
                        <Button variant="ghost" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="font-bold text-slate-600 transition-all hover:bg-white hover:shadow-sm">التالي <ChevronLeft className="mr-1 h-4 w-4" /></Button>
                    </div>
                )}

                <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl p-0 border-none shadow-2xl transition-all" dir="rtl">
                        <DialogHeader className="p-6 border-b bg-slate-50 sticky top-0 z-10 backdrop-blur-sm bg-white/80">
                            <DialogTitle className="flex items-center gap-2 text-xl font-black text-slate-800">
                                <UserCog className="text-slate-700 w-6 h-6" /> تخصيص نطاق العمل ({selectedUserIds.length})
                            </DialogTitle>
                        </DialogHeader>
                        
                        <div className="p-6 space-y-6">
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 shadow-inner">
                                <div className="space-y-0.5">
                                    <Label className="text-md font-bold text-slate-800">سياسة العرض والفلترة</Label>
                                    <p className="text-[11px] text-slate-500 font-bold italic">تحديد المسموح رؤيته في القوائم المنسدلة</p>
                                </div>
                                <div className="flex bg-white p-1 rounded-lg border">
                                    <Button variant={selectedScope.is_restricted ? "default" : "ghost"} size="sm" onClick={() => setSelectedScope({...selectedScope, is_restricted: true, courses: [], companies: [], platoons: []})} className={`rounded-md font-bold text-xs ${selectedScope.is_restricted ? 'bg-red-600 text-white hover:bg-red-700' : ''}`}>تقييد</Button>
                                    <Button variant={!selectedScope.is_restricted ? "default" : "ghost"} size="sm" onClick={() => setSelectedScope({...selectedScope, is_restricted: false, courses: [], companies: [], platoons: []})} className={`rounded-md font-bold text-xs ${!selectedScope.is_restricted ? 'bg-green-600 text-white hover:bg-green-700' : ''}`}>فتح الكل</Button>
                                </div>
                            </div>

                            {selectedScope.is_restricted && (
                                <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex justify-end">
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedScope({...selectedScope, courses: [], companies: [], platoons: []})}
                className="text-red-500 hover:text-red-700 font-bold text-[10px] gap-1"
            >
                <X className="w-3 h-3" /> إخفاء كافة الدورات (تقييد كلي)
            </Button>
        </div>
                                    <div className="space-y-3">
                                        <Label className="font-bold text-slate-700 flex items-center gap-2 text-sm border-r-4 border-blue-600 pr-2 h-5">1. الدورات المسموحة:</Label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 border rounded-lg bg-slate-50/30">
                                            {availableCourses.map(c => {
                                                const uniqueCourseKey = `${c.name}${c.batch ? `||${c.batch}` : ''}`;
                                                return (
                                                    <div key={c.id} className="flex items-center gap-3 bg-white p-2 rounded border border-slate-100 shadow-sm hover:border-blue-200 transition-all">
                                                        <Checkbox 
                                                            id={`c-${c.id}`} 
                                                            checked={selectedScope.courses.includes(uniqueCourseKey)} 
                                                            onCheckedChange={(checked) => {
                                                                const newCourses = checked 
                                                                    ? [...selectedScope.courses, uniqueCourseKey] 
                                                                    : selectedScope.courses.filter(name => name !== uniqueCourseKey);
                                                                
                                                                const newCompanies = selectedScope.companies.filter(comp => comp.startsWith(uniqueCourseKey + "->") === false);
                                                                const newPlatoons = selectedScope.platoons.filter(plat => plat.startsWith(uniqueCourseKey + "->") === false);
                                                                
                                                                setSelectedScope({...selectedScope, courses: newCourses, companies: newCompanies, platoons: newPlatoons})
                                                            }} 
                                                        />
                                                        <label htmlFor={`c-${c.id}`} className="text-[12px] font-bold cursor-pointer flex-1">{c.name} <span className="text-blue-600 text-[10px] italic">({c.batch || 'عام'})</span></label>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {selectedScope.courses.length > 0 && (
                                        <div className="space-y-4">
                                            <Label className="font-bold text-slate-700 flex items-center gap-2 text-sm border-r-4 border-orange-500 pr-2 h-5">2. تخصيص السرايا والفصائل حسب كل دورة:</Label>
                                            <div className="space-y-4">
                                                {selectedScope.courses.map(courseKey => {
                                                    const [cName, cBatch] = courseKey.split('||');
                                                    const courseSoldiers = rawSoldiersData.filter(s => s.course === cName && (cBatch ? s.batch === cBatch : true));
                                                    const companies = Array.from(new Set(courseSoldiers.map(s => s.company).filter(Boolean))).sort();
                                                    const platoons = Array.from(new Set(courseSoldiers.map(s => s.platoon).filter(Boolean))).sort();

                                                    return (
                                                        <div key={courseKey} className="bg-white border-r-4 border-r-slate-300 rounded-xl p-4 shadow-sm border border-slate-100 space-y-4 transition-all">
                                                            <div className="flex justify-between items-center border-b pb-2">
                                                                <span className="font-black text-slate-800 text-sm">{cName} {cBatch && <span className="text-blue-600 font-bold text-xs pr-1">({cBatch})</span>}</span>
                                                            </div>
                                                            
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                <div className="space-y-2">
                                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">السرايا:</span>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {companies.map(comp => {
                                                                            const compKey = `${courseKey}->${comp}`;
                                                                            return (
                                                                                <div key={comp} className="flex items-center gap-1.5 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100 hover:bg-blue-50 transition-colors">
                                                                                    <Checkbox 
                                                                                        id={`comp-${compKey}`}
                                                                                        checked={selectedScope.companies.includes(compKey)}
                                                                                        onCheckedChange={(checked) => {
                                                                                            const newComps = checked ? [...selectedScope.companies, compKey] : selectedScope.companies.filter(v => v !== compKey);
                                                                                            setSelectedScope({...selectedScope, companies: newComps});
                                                                                        }}
                                                                                    />
                                                                                    <label htmlFor={`comp-${compKey}`} className="text-[11px] font-bold cursor-pointer text-slate-700">{comp}</label>
                                                                                </div>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                </div>

                                                                <div className="space-y-2">
                                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">الفصائل:</span>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {platoons.map(plat => {
                                                                            const platKey = `${courseKey}->${plat}`;
                                                                            return (
                                                                                <div key={plat} className="flex items-center gap-1.5 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100 hover:bg-orange-50 transition-colors">
                                                                                    <Checkbox 
                                                                                        id={`plat-${platKey}`}
                                                                                        checked={selectedScope.platoons.includes(platKey)}
                                                                                        onCheckedChange={(checked) => {
                                                                                            const newPlats = checked ? [...selectedScope.platoons, platKey] : selectedScope.platoons.filter(v => v !== platKey);
                                                                                            setSelectedScope({...selectedScope, platoons: newPlats});
                                                                                        }}
                                                                                    />
                                                                                    <label htmlFor={`plat-${platKey}`} className="text-[11px] font-bold cursor-pointer text-slate-700">{plat}</label>
                                                                                </div>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <DialogFooter className="p-6 border-t bg-slate-50 sticky bottom-0 z-10 gap-3">
                            <Button variant="outline" onClick={() => setIsEditModalOpen(false)} className="font-bold h-11 flex-1 bg-white hover:bg-slate-100 transition-colors">إلغاء</Button>
                            <Button onClick={handleBulkSave} disabled={saving} className="bg-slate-900 hover:bg-slate-800 font-bold h-11 flex-1 text-white shadow-xl">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Save className="w-4 h-4 mr-2" />} حفظ نطاق العمل المختار
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </ProtectedRoute>
    )
}