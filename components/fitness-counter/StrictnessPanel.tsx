import type { ReactNode } from "react"
import { PRESETS, SITUP_PRESETS, STRICTNESS_LABELS } from "@/lib/fitness-counter/constants"
import type {
  Exercise,
  PushupThresholds,
  SitupThresholds,
  Strictness,
} from "@/lib/fitness-counter/types"

type Props = {
  exercise: Exercise
  strictness: Strictness
  onStrictnessChange: (s: Strictness) => void
  thresholds: PushupThresholds
  onThresholdsChange: (t: PushupThresholds) => void
  situpStrictness: Strictness
  onSitupStrictnessChange: (s: Strictness) => void
  situpThresholds: SitupThresholds
  onSitupThresholdsChange: (t: SitupThresholds) => void
}

const STRICTNESS_ORDER: Strictness[] = ["easy", "normal", "strict", "custom"]

function PresetButtons({
  selected,
  onSelect,
  caption,
}: {
  selected: Strictness
  onSelect: (s: Strictness) => void
  caption: (s: Strictness) => string
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {STRICTNESS_ORDER.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onSelect(key)}
          className={`rounded-xl px-1 py-2 text-center transition-all border-2 ${
            selected === key
              ? "border-emerald-500 bg-emerald-50 shadow-sm"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <p className="text-[11px] sm:text-xs font-black text-slate-800 leading-tight">{STRICTNESS_LABELS[key]}</p>
          <p className="text-[9px] sm:text-[10px] font-medium text-slate-500 mt-1" dir="ltr">{caption(key)}</p>
        </button>
      ))}
    </div>
  )
}

function ThresholdSlider({
  label,
  display,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string
  display: string
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="block space-y-1">
      <div className="flex justify-between items-center gap-2">
        <span className="text-xs font-bold text-slate-800">{label}</span>
        <span className="text-xs font-black text-emerald-700" dir="ltr">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-600"
      />
    </label>
  )
}

function PanelShell({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 space-y-3" dir="rtl">
      <h3 className="font-black text-slate-900 text-sm">⚙️ مستوى الدقة</h3>
      {children}
    </div>
  )
}

function PushupPanel({
  strictness,
  onStrictnessChange,
  thresholds: t,
  onThresholdsChange: set,
}: Pick<Props, "strictness" | "onStrictnessChange" | "thresholds" | "onThresholdsChange">) {
  const caption = (key: Strictness) => {
    const p = key === "custom" ? t : PRESETS[key]
    return `${p.elbowDown}° / ${p.elbowUp}°`
  }
  return (
    <PanelShell>
      <PresetButtons selected={strictness} onSelect={onStrictnessChange} caption={caption} />
      {strictness === "custom" && (
        <div className="space-y-3 pt-1">
          <ThresholdSlider
            label="زاوية الكوع (النزول)"
            display={`${t.elbowDown}°`}
            min={70}
            max={130}
            step={5}
            value={t.elbowDown}
            onChange={(next) => set({ ...t, elbowDown: Math.min(next, t.elbowUp - 20) })}
          />
          <ThresholdSlider
            label="زاوية الكوع (الصعود)"
            display={`${t.elbowUp}°`}
            min={130}
            max={175}
            step={5}
            value={t.elbowUp}
            onChange={(next) => set({ ...t, elbowUp: Math.max(next, t.elbowDown + 20) })}
          />
          <ThresholdSlider
            label="استقامة الركبة"
            display={`${t.knee}°`}
            min={110}
            max={170}
            step={5}
            value={t.knee}
            onChange={(knee) => set({ ...t, knee })}
          />
          <ThresholdSlider
            label="استقامة الورك"
            display={`${t.hip}°`}
            min={100}
            max={170}
            step={5}
            value={t.hip}
            onChange={(hip) => set({ ...t, hip })}
          />
          <ThresholdSlider
            label="أقل زمن بين التكرارات (مللي ثانية)"
            display={`${t.cooldownMs}`}
            min={300}
            max={1000}
            step={50}
            value={t.cooldownMs}
            onChange={(cooldownMs) => set({ ...t, cooldownMs })}
          />
        </div>
      )}
    </PanelShell>
  )
}

function SitupPanel({
  situpStrictness,
  onSitupStrictnessChange,
  situpThresholds: t,
  onSitupThresholdsChange: set,
}: Pick<
  Props,
  "situpStrictness" | "onSitupStrictnessChange" | "situpThresholds" | "onSitupThresholdsChange"
>) {
  const caption = (key: Strictness) =>
    `الصعود < ${key === "custom" ? t.up : SITUP_PRESETS[key].up}°`
  return (
    <PanelShell>
      <PresetButtons selected={situpStrictness} onSelect={onSitupStrictnessChange} caption={caption} />
      {situpStrictness === "custom" && (
        <div className="space-y-3 pt-1">
          <ThresholdSlider
            label="زاوية الصعود"
            display={`${t.up}°`}
            min={55}
            max={95}
            step={5}
            value={t.up}
            onChange={(up) => set({ ...t, up })}
          />
          <ThresholdSlider
            label="زاوية النزول"
            display={`${t.down}°`}
            min={120}
            max={165}
            step={5}
            value={t.down}
            onChange={(down) => set({ ...t, down })}
          />
          <ThresholdSlider
            label="أقصى انثناء مسموح للركبة"
            display={`${t.kneeMax}°`}
            min={130}
            max={175}
            step={5}
            value={t.kneeMax}
            onChange={(kneeMax) => set({ ...t, kneeMax })}
          />
          <ThresholdSlider
            label="مسافة اليد المسموحة"
            display={t.handRatio.toFixed(1)}
            min={0.6}
            max={2.0}
            step={0.1}
            value={t.handRatio}
            onChange={(handRatio) => set({ ...t, handRatio })}
          />
          <ThresholdSlider
            label="أقل زمن بين التكرارات (مللي ثانية)"
            display={`${t.cooldownMs}`}
            min={300}
            max={1000}
            step={50}
            value={t.cooldownMs}
            onChange={(cooldownMs) => set({ ...t, cooldownMs })}
          />
        </div>
      )}
    </PanelShell>
  )
}

export default function StrictnessPanel(props: Props) {
  return (
    <>
      {props.exercise === "pushup" && <PushupPanel {...props} />}
      {props.exercise === "situp" && <SitupPanel {...props} />}
    </>
  )
}
