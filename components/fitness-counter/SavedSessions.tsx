import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { EXERCISE_LABELS } from "@/lib/fitness-counter/constants"
import type { SavedSession } from "@/lib/fitness-counter/types"
import AttemptsTable from "./AttemptsTable"

type Props = {
  sessions: SavedSession[]
  expandedSessionId: number | null
  onToggleExpanded: (id: number) => void
  exportCopied: boolean
  onExportAll: () => void
  onDeleteAll: () => void
  onDelete: (id: number) => void
}

export default function SavedSessions({
  sessions,
  expandedSessionId,
  onToggleExpanded,
  exportCopied,
  onExportAll,
  onDeleteAll,
  onDelete,
}: Props) {
  return (
    <Card className="rounded-3xl border border-slate-200 shadow-sm">
      <CardContent className="p-5 space-y-4" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-black text-slate-900">📁 الجلسات المحفوظة</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 text-xs font-black"
              onClick={onExportAll}
              disabled={sessions.length === 0}
            >
              {exportCopied ? "✅ تم النسخ" : "📋 تصدير الكل"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9 text-xs font-black text-red-700 border-red-200 hover:bg-red-50"
              onClick={onDeleteAll}
              disabled={sessions.length === 0}
            >
              🗑️ حذف الكل
            </Button>
          </div>
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm text-slate-500 font-medium">لا توجد جلسات محفوظة بعد.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => {
              const open = expandedSessionId === s.id
              return (
                <div key={s.id} className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-right"
                    onClick={() => onToggleExpanded(s.id)}
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-black text-slate-900">
                        {EXERCISE_LABELS[s.exercise]} — {s.reps} تكرار
                      </p>
                      <p className="text-xs text-slate-500 font-medium" dir="ltr">
                        {new Date(s.savedAt).toLocaleString("en-GB")} · {s.durationSec}s
                      </p>
                    </div>
                    <span className="text-slate-400 text-sm">{open ? "▲" : "▼"}</span>
                  </button>
                  {open && (
                    <div className="px-4 pb-4 space-y-3">
                      <AttemptsTable rows={s.attempts} />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 text-xs font-black text-red-700 border-red-200"
                        onClick={() => onDelete(s.id)}
                      >
                        حذف هذه الجلسة
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
