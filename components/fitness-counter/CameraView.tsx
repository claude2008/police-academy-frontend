import type { ReactNode, RefObject } from "react"
import { Camera, SwitchCamera, Timer } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
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

/** Video box with the pose canvas and stage overlays; `children` renders below the video. */
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
  const mirrorStyle = { transform: facingMode === "user" ? "scaleX(-1)" : "scaleX(1)" }

  return (
    <Card className="rounded-3xl overflow-hidden shadow-md">
      <CardContent className="p-0">
        <div className="relative bg-slate-900 w-full aspect-video md:w-[640px] md:h-[480px] md:mx-auto rounded-2xl overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-contain rounded-2xl absolute inset-0 z-0"
            playsInline
            muted
            autoPlay
            onLoadedMetadata={onVideoReady}
            onPlaying={onVideoReady}
            style={mirrorStyle}
          />
          {(stage === "waiting" || stage === "countdown" || stage === "active") && (
            <canvas
              ref={canvasRef}
              className="w-full h-full object-contain rounded-2xl absolute inset-0 z-10"
              style={mirrorStyle}
            />
          )}
          {stage === "prepare" && !videoReady && !cameraError && !needsTap && (
            <div className="absolute inset-0 flex items-center justify-center text-white/80 gap-2 z-[5] pointer-events-none">
              <Camera className="w-5 h-5 animate-pulse" /> جاري تشغيل الكاميرا...
            </div>
          )}
          {needsTap && (
            <button
              type="button"
              onClick={onTapToPlay}
              className="absolute inset-0 z-20 flex items-center justify-center bg-black/60"
            >
              <span className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-full px-8 py-4 shadow-lg">
                ▶️ اضغط لتشغيل الكاميرا
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={onFlipCamera}
            className="absolute top-3 right-3 z-10 bg-black/70 hover:bg-black/90 text-white rounded-full p-2.5 shadow-lg"
            title="تبديل الكاميرا"
          >
            <SwitchCamera className="w-5 h-5" />
          </button>
          {stage === "waiting" && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none bg-black/35 px-4">
              <p className="text-white text-xl md:text-2xl font-black text-center drop-shadow">
                {WARNINGS.waitingForBody}
              </p>
              {warning && (
                <p className="mt-3 text-amber-200 text-sm font-bold text-center bg-black/50 rounded-xl px-3 py-2">
                  {warning}
                </p>
              )}
            </div>
          )}
          {stage === "countdown" && (
            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none bg-black/40">
              <span className="text-white text-8xl md:text-9xl font-black drop-shadow-lg" dir="ltr">
                {countdown}
              </span>
            </div>
          )}
          {stage === "active" && (
            <>
              <div className="absolute top-3 left-3 right-14 flex justify-between gap-2 pointer-events-none z-10">
                <div
                  className={`rounded-2xl px-4 py-2 flex items-center gap-2 font-black text-xl ${
                    timeLeft <= TIMER_DANGER_SECONDS
                      ? "bg-red-600/95 text-white"
                      : timeLeft <= TIMER_WARN_SECONDS
                        ? "bg-amber-500/95 text-white"
                        : "bg-black/70 text-white"
                  }`}
                >
                  <Timer
                    className={`w-5 h-5 ${
                      timeLeft <= TIMER_DANGER_SECONDS
                        ? "text-white"
                        : timeLeft <= TIMER_WARN_SECONDS
                          ? "text-white"
                          : "text-amber-400"
                    }`}
                  />
                  {timeLeft}s
                </div>
                <div className="bg-emerald-600/90 text-white rounded-2xl px-4 py-2 font-black text-lg">
                  {reps} تكرار
                </div>
              </div>
              {strictnessLabel != null && (
                <div className="absolute top-14 left-3 z-10 pointer-events-none">
                  <span className="bg-black/70 text-white text-xs font-bold rounded-full px-3 py-1">
                    {strictnessLabel}
                  </span>
                </div>
              )}
              <div className="absolute top-14 right-3 z-10 pointer-events-none">
                <span
                  className={`text-xs font-bold rounded-full px-3 py-1 ${
                    fps > 0 && fps < LOW_FPS_WARN
                      ? "bg-amber-500/90 text-white"
                      : "bg-black/70 text-white"
                  }`}
                >
                  <span className="block">معدل المعالجة: {fps} إطار/ثانية</span>
                  {delegate && (
                    <span className="block text-[10px] font-medium opacity-80">{delegate}</span>
                  )}
                </span>
              </div>
              <div className="absolute bottom-3 inset-x-3 z-10 mx-auto max-w-md flex gap-2">
                <button
                  type="button"
                  onClick={onStop}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black rounded-full h-12 flex items-center justify-center gap-2 shadow-lg"
                >
                  ⏹️ إيقاف
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 bg-red-700 hover:bg-red-800 text-white font-black rounded-full h-12 flex items-center justify-center gap-2 shadow-lg"
                >
                  إلغاء
                </button>
              </div>
            </>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}
