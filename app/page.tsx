"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { toast } from "sonner" 
import { ShieldAlert, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function LoginPage() {
  const router = useRouter()
  
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showForceChange, setShowForceChange] = useState(false)
  const [tempUser, setTempUser] = useState<any>(null)
  const [newPass, setNewPass] = useState("")

  const handleLogin = async () => {
    setLoading(true)
    setError("")

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      if (res.ok) {
        const data = await res.json()
        
        if (data.access_token) {
    localStorage.setItem("token", data.access_token);
    // تأكد أن التوكن يكتب في الكوكيز أولاً
    document.cookie = `token=${data.access_token}; path=/; max-age=604800; samesite=lax`;
    
    // ثم نقوم بالانتقال
    window.dispatchEvent(new Event("auth-change"));
    router.push("/dashboard");
}

        if (data.user) {
            if (data.user.must_change_password) {
                setTempUser(data.user)
                localStorage.setItem("token", data.access_token)
                setShowForceChange(true)
                setLoading(false)
                return 
            }

            localStorage.setItem("user", JSON.stringify(data.user))
            localStorage.setItem("token", data.access_token)
            window.dispatchEvent(new Event("auth-change"))
            router.push("/dashboard")
        } else {
             router.push("/dashboard")
        }
      } else {
        const data = await res.json()
        setError(data.detail || "بيانات الدخول غير صحيحة")
      }
    } catch (err) {
      console.error("خطأ:", err)
      setError("فشل الاتصال بالخادم")
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin()
    }
  }

 const handleForceChange = async () => {
    if (newPass.length < 6) {
        toast.error("كلمة المرور قصيرة جداً");
        return;
    }
    
    setLoading(true); // 🟢 1. ابدأ التحميل الآن
    
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${tempUser.id}`, {
            method: "PUT",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify({ password: newPass })
        });

        if (res.ok) {
            toast.success("تم تغيير كلمة المرور بنجاح! جاري الدخول...");
            const updatedUser = { ...tempUser, must_change_password: false };
            localStorage.setItem("user", JSON.stringify(updatedUser));
            window.dispatchEvent(new Event("auth-change"));
            router.push("/dashboard");
        } else {
            toast.error("فشل تحديث البيانات");
            setLoading(false); // 🔴 إيقاف التحميل في حال الفشل للسماح بالمحاولة مجدداً
        }
    } catch (e) { 
        toast.error("فشل تغيير كلمة المرور"); 
        setLoading(false); // 🔴 إيقاف التحميل في حال وجود خطأ اتصال
    }
};

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300" dir="rtl">
        <Card className="w-full max-w-md shadow-2xl border-0 dark:border dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="text-center flex flex-col items-center pb-2">
            <div className="w-36 h-36 relative mb-6 p-1 bg-white rounded-full shadow-xl overflow-hidden border-4 border-slate-100 dark:border-slate-800 flex items-center justify-center">
              <Image 
                src="/logo.jpg" 
                alt="شعار الأكاديمية" 
                fill 
                className="object-contain p-2"
                priority
              />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-800 dark:text-white">
              معهد الشرطة
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
             البوابة الرقمية لإدارة وتقييم التدريب
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4 pt-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-sm rounded-md text-center">
                {error}
              </div>
            )}

            <div className="space-y-2 text-right">
              <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">
                البريد الإلكتروني
              </Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="user@police.academy" 
                className="text-right bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            
            <div className="space-y-2 text-right">
              <Label htmlFor="password" className="text-slate-700 dark:text-slate-300">
                كلمة المرور
              </Label>
              <Input 
                id="password" 
                type="password" 
                className="text-right bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          </CardContent>
          
          <CardFooter className="pt-2 pb-8">
            <Button 
              className="w-full text-lg py-6 font-semibold shadow-lg transition-all bg-slate-900 hover:bg-slate-800 text-white dark:bg-blue-600 dark:hover:bg-blue-700"
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? "جارِ التحقق..." : "تسجيل الدخول"}
            </Button>
          </CardFooter>
          <CardDescription className="text-center text-slate-500 dark:text-slate-400">
             إعداد وتطوير : مـحمد خـالد الصدفـي
            </CardDescription>
        </Card>
      </div>

      <Dialog open={showForceChange} onOpenChange={() => {}}> 
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <ShieldAlert className="w-6 h-6" /> تغيير كلمة المرور مطلوب
            </DialogTitle>
            <DialogDescription>
              لأسباب أمنية، يجب عليك تغيير كلمة المرور الافتراضية "123" قبل الدخول للنظام لأول مرة.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label>كلمة المرور الجديدة</Label>
            <Input 
              type="password" 
              value={newPass} 
              onChange={(e) => setNewPass(e.target.value)} 
              placeholder="أدخل كلمة مرور قوية وجديدة"
            />
          </div>
          <DialogFooter>
            <Button 
  onClick={handleForceChange} 
  className="w-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2"
  disabled={loading} // 🔒 منع الضغط أثناء التحميل
>
  {loading ? (
    <>
      <Loader2 className="w-4 h-4 animate-spin" /> {/* 🔄 أيقونة تدور */}
      جاري الحفظ...
    </>
  ) : (
    "حفظ ودخول"
  )}
</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}