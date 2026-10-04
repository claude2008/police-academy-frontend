import type { Attempt } from "@/lib/fitness-counter/types"
import AttemptsTable from "./AttemptsTable"

type Props = {
  calibOn: boolean
  onToggle: () => void
  hasData: boolean
  attempts: Attempt[]
  fps: number
  calibTick: number
  calibCopied: boolean
  onCopy: () => void
  skippedJumps: number
  trackingLoss: number
}

export default function CalibrationPanel({
  calibOn,
  onToggle,
  hasData,
  attempts,
  fps,
  calibTick,
  calibCopied,
  onCopy,
  skippedJumps,
  trackingLoss,
}: Props) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className={`text-xs font-bold rounded-full px-4 py-2 border transition-colors ${
          calibOn
            ? "bg-amber-100 border-amber-400 text-amber-900"
            : "bg-slate-100 border-slate-200 text-slate-700"
        }`}
      >
        📊 تسجيل الزوايا {calibOn ? "(يعمل)" : ""}
      </button>
      {calibOn && hasData && (
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-2 text-right" dir="rtl">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-bold text-slate-800 flex-1" dir="rtl">
              محسوبة: {attempts.filter((a) => a.counted).length}
              {"   |   "}
              مرفوضة: {attempts.filter((a) => !a.counted).length}
              {"   |   "}
              معدل المعالجة: {fps} إطار/ثانية
              <span className="hidden">{calibTick}</span>
            </p>
            <button
              type="button"
              onClick={onCopy}
              className="shrink-0 text-xs font-black rounded-full px-3 py-1.5 bg-sky-600 text-white hover:bg-sky-700"
            >
              {calibCopied ? "✅ تم النسخ" : "📋 نسخ"}
            </button>
          </div>
          {attempts.length > 0 && <AttemptsTable rows={attempts} />}
          {(skippedJumps > 0 || trackingLoss > 0) && (
            <div className="text-[11px] font-bold text-slate-600 space-y-0.5">
              {skippedJumps > 0 && (
                <p>إطارات متجاهلة (قفزات غير منطقية): {skippedJumps}</p>
              )}
              {trackingLoss > 0 && (
                <p className="text-amber-700">⚠️ فقدان تتبّع: {trackingLoss} مرة</p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}
