import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Attempt } from "@/lib/fitness-counter/types"
import AttemptsTable from "./AttemptsTable"

type Props = {
  exerciseLabel: string
  reps: number
  elapsedSec: number
  attempts: Attempt[]
  sessionSaved: boolean
  onSave: () => void
  onNextTrainee: () => void
  onHome: () => void
}

export default function ResultScreen({
  exerciseLabel,
  reps,
  elapsedSec,
  attempts,
  sessionSaved,
  onSave,
  onNextTrainee,
  onHome,
}: Props) {
  return (
    <Card className="rounded-3xl shadow-md">
      <CardContent className="p-8 space-y-6 text-center">
        <div className="text-5xl">✅</div>
        <h2 className="text-2xl font-black text-slate-900">انتهى التمرين</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-100 rounded-2xl p-4">
            <p className="text-xs text-slate-500 font-bold mb-1">التمرين</p>
            <p className="text-xl font-black">{exerciseLabel}</p>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-4">
            <p className="text-xs text-emerald-700 font-bold mb-1">التكرارات</p>
            <p className="text-xl font-black text-emerald-800">{reps}</p>
          </div>
          <div className="bg-amber-50 rounded-2xl p-4">
            <p className="text-xs text-amber-700 font-bold mb-1">الزمن</p>
            <p className="text-xl font-black text-amber-800">{elapsedSec} ث</p>
          </div>
        </div>
        <div className="text-right space-y-2" dir="rtl">
          <p className="text-sm font-black text-slate-800">جدول المحاولات</p>
          <AttemptsTable rows={attempts} />
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={onSave}
            disabled={sessionSaved}
            className="flex-1 h-12 font-black gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            {sessionSaved ? "✅ تم الحفظ" : "💾 حفظ"}
          </Button>
          <Button
            onClick={onNextTrainee}
            className="flex-1 h-12 font-black gap-2 bg-sky-600 hover:bg-sky-700"
          >
            استعداد للمتدرب التالي
          </Button>
        </div>
        <Button onClick={onHome} variant="outline" className="w-full h-11 font-black">
          الرئيسية
        </Button>
      </CardContent>
    </Card>
  )
}
