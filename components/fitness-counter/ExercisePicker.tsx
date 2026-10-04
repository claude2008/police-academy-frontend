import { Dumbbell } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { EXERCISE_TIPS } from "@/lib/fitness-counter/constants"
import type { Exercise } from "@/lib/fitness-counter/types"

const CARDS: {
  exercise: Exercise
  title: string
  description: string
  cardClass: string
  iconBoxClass: string
  iconClass: string
  tipClass: string
}[] = [
  {
    exercise: "pushup",
    title: "ضغط",
    description: "عدّاد ضغط الأرض بالكاميرا",
    cardClass: "hover:border-emerald-500",
    iconBoxClass: "bg-emerald-100",
    iconClass: "text-emerald-700",
    tipClass: "bg-emerald-50/80 border border-emerald-100",
  },
  {
    exercise: "situp",
    title: "بطن",
    description: "عدّاد تمارين البطن بالكاميرا",
    cardClass: "hover:border-sky-500",
    iconBoxClass: "bg-sky-100",
    iconClass: "text-sky-700 rotate-90",
    tipClass: "bg-sky-50/80 border border-sky-100",
  },
]

export default function ExercisePicker({ onSelect }: { onSelect: (exercise: Exercise) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {CARDS.map((c) => (
        <Card
          key={c.exercise}
          className={`cursor-pointer border-2 ${c.cardClass} hover:shadow-lg transition-all rounded-3xl overflow-hidden`}
          onClick={() => onSelect(c.exercise)}
        >
          <CardContent className="p-6 flex flex-col items-center gap-4 text-center">
            <div className={`w-20 h-20 rounded-2xl ${c.iconBoxClass} flex items-center justify-center`}>
              <Dumbbell className={`w-10 h-10 ${c.iconClass}`} />
            </div>
            <h2 className="text-2xl font-black text-slate-900">{c.title}</h2>
            <p className="text-sm text-slate-500">{c.description}</p>
            <div className="w-full space-y-2 text-right mt-2">
              {EXERCISE_TIPS.map((tip) => (
                <div key={tip.title} className={`rounded-xl ${c.tipClass} px-3 py-2`}>
                  <p className="text-xs font-black text-slate-800">
                    {tip.icon} {tip.title}: <span className="font-medium text-slate-600">{tip.text}</span>
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
