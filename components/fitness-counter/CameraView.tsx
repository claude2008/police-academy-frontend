"use client"

import { useEffect, useState, type ReactNode, type RefObject } from "react"
import { createPortal } from "react-dom"
import { Camera, SwitchCamera, Timer, X } from "lucide-react"
import {
  LOW_FPS_WARN,
  TIMER_DANGER_SECONDS,
  TIMER_WARN_SECONDS,
  WARNINGS,
} from "@/lib/fitness-counter/constants"
import type { FacingMode, PoseDelegate, Stage } from "@/lib/fitness-counter/types"

type Props = {
  stage: Stage
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  facingMode: FacingMode
  videoReady: boolean
  cameraError: string | null
  needsTap: boolean
  onVideoReady: () => void
  onTapToPlay: () => void
  onFlipCamera: () => void
  onClose: () => void
  onViewReady: (ready: boolean) => void
  warning: string
  countdown: number
  timeLeft: number
  reps: number
  strictnessLabel: string | null
  fps: number
  delegate: PoseDelegate | null
  onStop: () => void
  onCancel: () => void
  children?: ReactNode
}

const sidePad = {
  paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
  paddingRight: "max(0.75rem, env(safe-area-inset-right))",
}

/** Full-screen camera for the camera stages. Select and result stay on the page. */
export default function CameraView({
  stage,
  videoRef,
  canvasRef,
  facingMode,
  videoReady,
  cameraError,
  needsTap,
  onVideoReady,
  onTapToPlay,
  onFlipCamera,
  onClose,
  onViewReady,
  warning,
  countdown,
  timeLeft,
  reps,
  strictnessLabel,
  fps,
  delegate,
  onStop,
  onCancel,
  children,
}: Props) {
  const [mounted, setMounted] = useState(false)
  const mirrorStyle = { transform: facingMode === "user" ? "scaleX(-1)" : "scaleX(1)" }
  const closeLabel = stage === "active" ? "إلغاء" : "رجوع"

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    onViewReady(true)
    return () => onViewReady(false)
  }, [mounted, onViewReady])

  useEffect(() => {
    if (!mounted) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKey)
    }
  }, [mounted, onClose])

  if (!mounted) return null

  return createPortal(
    <div dir="rtl" className="fixed inset-0 z-[250] overflow-hidden bg-black text-white">
      <video
        ref={videoRef}
        className="absolute inset-0 z-0 h-full w-full object-contain"
        playsInline
        muted
        autoPlay
        onLoadedMetadata={onVideoReady}
        onPlaying={onVideoReady}
        style={mirrorStyle}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-10 h-full w-full object-contain"
        style={mirrorStyle}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-36 bg-gradient-to-b from-black/75 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-48 bg-gradient-to-t from-black/80 to-transparent" />

      {stage === "prepare" && !videoReady && !cameraError && !needsTap && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center gap-2 text-white/80">
          <Camera className="h-5 w-5 animate-pulse" /> جاري تشغيل الكاميرا...
        </div>
      )}
      {needsTap && (
        <button
          type="button"
          onClick={onTapToPlay}
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/60"
        >
          <span className="rounded-full bg-emerald-600 px-8 py-4 text-lg font-black text-white shadow-lg">
            ▶️ اضغط لتشغيل الكاميرا
          </span>
        </button>
      )}

      {stage === "waiting" && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/35 px-4">
          <p className="text-center text-xl font-black text-white drop-shadow md:text-2xl">
            {WARNINGS.waitingForBody}
          </p>
          {warning && (
            <p className="mt-3 rounded-xl bg-black/50 px-3 py-2 text-center text-sm font-bold text-amber-200">
              {warning}
            </p>
          )}
        </div>
      )}
      {stage === "countdown" && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/40">
          <span className="text-8xl font-black text-white drop-shadow-lg md:text-9xl" dir="ltr">
            {countdown}
          </span>
        </div>
      )}

      <div
        className="absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2"
        style={{ ...sidePad, paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <button
          type="button"
          onClick={onClose}
          title={closeLabel}
          aria-label={closeLabel}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/70 text-white shadow-lg"
        >
          <X className="h-5 w-5" />
        </button>
        {stage === "active" && (
          <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-2 pt-0.5">
            <div className="flex flex-col gap-2">
              <div
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xl font-black ${
                  timeLeft <= TIMER_DANGER_SECONDS
                    ? "bg-red-600/95 text-white"
                    : timeLeft <= TIMER_WARN_SECONDS
                      ? "bg-amber-500/95 text-white"
                      : "bg-black/70 text-white"
                }`}
              >
                <Timer
                  className={`h-5 w-5 ${
                    timeLeft <= TIMER_DANGER_SECONDS || timeLeft <= TIMER_WARN_SECONDS
                      ? "text-white"
                      : "text-amber-400"
                  }`}
                />
                {timeLeft}s
              </div>
              {strictnessLabel != null && (
                <span className="w-fit rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white">
                  {strictnessLabel}
                </span>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="rounded-2xl bg-emerald-600/90 px-4 py-2 text-lg font-black text-white">
                {reps} تكرار
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  fps > 0 && fps < LOW_FPS_WARN ? "bg-amber-500/90 text-white" : "bg-black/70 text-white"
                }`}
              >
                <span className="block">معدل المعالجة: {fps} إطار/ثانية</span>
                {delegate && <span className="block text-[10px] font-medium opacity-80">{delegate}</span>}
              </span>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={onFlipCamera}
          title="تبديل الكاميرا"
          aria-label="تبديل الكاميرا"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/70 text-white shadow-lg"
        >
          <SwitchCamera className="h-5 w-5" />
        </button>
      </div>

      <div
        className="absolute inset-x-0 bottom-0 z-30"
        style={{ ...sidePad, paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {stage === "active" && (
          <div className="mx-auto mb-2 flex max-w-md gap-2">
            <button
              type="button"
              onClick={onStop}
              className="flex h-12 min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-red-600 font-black text-white shadow-lg"
            >
              ⏹️ إيقاف
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex h-12 min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-red-700 font-black text-white shadow-lg"
            >
              إلغاء
            </button>
          </div>
        )}
        {children && (
          <div className="mx-auto max-h-[42dvh] max-w-lg overflow-y-auto overscroll-contain rounded-2xl [&_button]:min-h-11">
            {children}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
