"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Play } from "lucide-react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { Button } from "@/components/ui/button"
import CalibrationPanel from "@/components/fitness-counter/CalibrationPanel"
import CameraView from "@/components/fitness-counter/CameraView"
import ExercisePicker from "@/components/fitness-counter/ExercisePicker"
import ResultScreen from "@/components/fitness-counter/ResultScreen"
import SavedSessions from "@/components/fitness-counter/SavedSessions"
import StrictnessPanel from "@/components/fitness-counter/StrictnessPanel"
import { useCameraPose } from "@/components/fitness-counter/useCameraPose"
import { ensureAudio, playBeep } from "@/lib/fitness-counter/audio"
import {
  BEEPS,
  COPIED_FEEDBACK_MS,
  COUNTDOWN_SECONDS,
  EXERCISE_LABELS,
  FINAL_BEEP_SECONDS,
  POSTURE_HOLD_MS,
  PRESETS,
  SITUP_PRESETS,
  STRICTNESS_LABELS,
  TEST_DURATION_SECONDS,
  WARNINGS,
} from "@/lib/fitness-counter/constants"
import {
  createAttemptLog,
  createRepCounterState,
  detectRepFrame,
  getRejectAscentThreshold,
  isBodyVisible,
  noteSkippedJump,
  recordAngle,
  resetAttemptLog,
} from "@/lib/fitness-counter/counting"
import {
  formatAttemptRows,
  formatSessionsExport,
  loadSavedSessions,
  persistSavedSessions,
} from "@/lib/fitness-counter/sessions"
import type {
  Attempt,
  Exercise,
  Landmark,
  PoseResults,
  SavedSession,
  Stage,
  Strictness,
} from "@/lib/fitness-counter/types"

export default function FitnessCounterPage() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>("select")
  const stageRef = useRef(stage)
  const updateStage = (newStage: Stage) => {
    stageRef.current = newStage
    setStage(newStage)
  }
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const exerciseRef = useRef(exercise)
  const [reps, setReps] = useState(0)
  const [timeLeft, setTimeLeft] = useState(TEST_DURATION_SECONDS)
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [bodyReady, setBodyReady] = useState(false)
  const [warning, setWarning] = useState("")
  const [resultAttempts, setResultAttempts] = useState<Attempt[]>([])
  const [elapsedSec, setElapsedSec] = useState(0)
  const [sessionSaved, setSessionSaved] = useState(false)
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([])
  const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null)
  const [exportCopied, setExportCopied] = useState(false)

  const [strictness, setStrictness] = useState<Strictness>("normal")
  const [thresholds, setThresholds] = useState(PRESETS.normal)
  const thresholdsRef = useRef(PRESETS.normal)
  const [situpStrictness, setSitupStrictness] = useState<Strictness>("normal")
  const [situpThresholds, setSitupThresholds] = useState(SITUP_PRESETS.normal)
  const situpThresholdsRef = useRef(SITUP_PRESETS.normal)

  const [calibData, setCalibData] = useState<number[]>([])
  const [calibOn, setCalibOn] = useState(false)
  const [calibCopied, setCalibCopied] = useState(false)
  const [trackingLoss, setTrackingLoss] = useState(0)
  const [skippedJumps, setSkippedJumps] = useState(0)
  const [calibTick, setCalibTick] = useState(0)

  const counterRef = useRef(createRepCounterState())
  const logRef = useRef(createAttemptLog())
  const sessionStartTimeRef = useRef(0)
  const timeLeftRef = useRef(TEST_DURATION_SECONDS)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownValueRef = useRef(COUNTDOWN_SECONDS)
  const postureOkSinceRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  useEffect(() => { thresholdsRef.current = thresholds }, [thresholds])
  useEffect(() => {
    if (strictness !== "custom") setThresholds(PRESETS[strictness])
  }, [strictness])
  useEffect(() => { situpThresholdsRef.current = situpThresholds }, [situpThresholds])
  useEffect(() => {
    if (situpStrictness !== "custom") setSitupThresholds(SITUP_PRESETS[situpStrictness])
  }, [situpStrictness])
  useEffect(() => {
    setSavedSessions(loadSavedSessions())
  }, [])

  const resetCalibSession = () => {
    setCalibData([])
    setTrackingLoss(0)
    setSkippedJumps(0)
    setCalibTick(0)
    setCalibCopied(false)
    resetAttemptLog(logRef.current)
  }

  const recordCalibAngle = (angle: number, counted: boolean) => {
    const log = logRef.current
    const result = recordAngle(
      log,
      angle,
      counted,
      Date.now() - sessionStartTimeRef.current,
      getRejectAscentThreshold(exerciseRef.current, thresholdsRef.current)
    )
    if (result.trackingLossChanged) setTrackingLoss(log.trackingLoss)
    setCalibData((prev) => [...prev, result.rounded])
    if (result.attemptsChanged) setCalibTick((t) => t + 1)
  }

  const detectRep = (landmarks: Landmark[]) => {
    const counter = counterRef.current
    const outcome = detectRepFrame(
      exerciseRef.current,
      counter,
      landmarks,
      { pushup: thresholdsRef.current, situp: situpThresholdsRef.current },
      Date.now()
    )
    setWarning(outcome.warning)
    if (outcome.skippedJump) {
      noteSkippedJump(logRef.current)
      setSkippedJumps(logRef.current.skippedJumps)
    }
    if (outcome.counted) setReps(counter.reps)
    if (outcome.angle != null) recordCalibAngle(outcome.angle, outcome.counted)
  }

  const handlePoseResults = (results: PoseResults) => {
    const landmarks = results.poseLandmarks
    const current = stageRef.current
    if (landmarks) {
      if (current === "prepare") {
        const visible = exerciseRef.current != null && isBodyVisible(landmarks)
        setBodyReady(visible)
        setWarning(visible ? WARNINGS.postureOk : WARNINGS.bodyNotVisible)
      } else if (current === "waiting") {
        if (isBodyVisible(landmarks)) {
          setWarning("")
          if (postureOkSinceRef.current == null) {
            postureOkSinceRef.current = Date.now()
          } else if (Date.now() - postureOkSinceRef.current >= POSTURE_HOLD_MS) {
            postureOkSinceRef.current = null
            beginCountdown()
          }
        } else {
          postureOkSinceRef.current = null
          setWarning(WARNINGS.waitingForBody)
        }
      } else if (current === "countdown") {
        if (!isBodyVisible(landmarks)) {
          abortCountdownToWaiting(WARNINGS.waitingForBody)
        }
      } else if (current === "active") {
        detectRep(landmarks)
      }
    } else if (current === "prepare") {
      setBodyReady(false)
      setWarning(WARNINGS.bodyNotVisible)
    } else if (current === "waiting") {
      postureOkSinceRef.current = null
      setWarning(WARNINGS.waitingForBody)
    } else if (current === "countdown") {
      abortCountdownToWaiting(WARNINGS.waitingForBody)
    }
  }

  const {
    videoRef,
    canvasRef,
    streamRef,
    cameraError,
    setCameraError,
    previewReady,
    videoReady,
    setVideoReady,
    needsTap,
    mediapipeReady,
    facingMode,
    fps,
    delegate,
    startPrepareCamera: startCamera,
    flipCamera: flipCameraStream,
    stopStream: stopCamera,
    ensureFrameLoop,
    playAfterTap,
  } = useCameraPose(stageRef, handlePoseResults)

  const clearTestTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const clearCountdownTimer = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
  }

  const stopStream = useCallback(() => {
    stopCamera()
    clearTestTimer()
  }, [stopCamera])

  const startPrepareCamera = useCallback(() => {
    setBodyReady(false)
    setWarning("")
    return startCamera()
  }, [startCamera])

  const flipCamera = () => {
    setBodyReady(false)
    void flipCameraStream()
  }

  useEffect(() => {
    return () => stopStream()
  }, [stopStream])

  useEffect(() => {
    if (stage === "prepare") {
      startPrepareCamera()
    } else if (stage === "waiting" && !streamRef.current) {
      startPrepareCamera()
    } else if (stage === "select" || stage === "result") {
      clearCountdownTimer()
      stopStream()
    }
  }, [stage, startPrepareCamera, stopStream, streamRef])

  const finishSession = useCallback(() => {
    clearCountdownTimer()
    clearTestTimer()
    const elapsed = TEST_DURATION_SECONDS - Math.max(0, timeLeftRef.current)
    setElapsedSec(elapsed)
    setResultAttempts([...logRef.current.attempts])
    setSessionSaved(false)
    counterRef.current.handFailFrames = 0
    counterRef.current.lastValidAngle = null
    stopStream()
    updateStage("result")
  }, [stopStream])

  const startActiveFromCountdown = useCallback(() => {
    const counter = counterRef.current
    setReps(0)
    counter.reps = 0
    counter.phase = null
    counter.lastRepTime = 0
    counter.handFailFrames = 0
    counter.lastValidAngle = null
    logRef.current.skippedJumps = 0
    setSkippedJumps(0)
    resetCalibSession()
    setCalibOn(true)
    sessionStartTimeRef.current = Date.now()
    setTimeLeft(TEST_DURATION_SECONDS)
    timeLeftRef.current = TEST_DURATION_SECONDS
    setCameraError(null)
    setWarning("")
    setCountdown(0)
    updateStage("active")
    ensureFrameLoop()

    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      timeLeftRef.current -= 1
      const left = timeLeftRef.current
      setTimeLeft(left)
      if (left >= 1 && left <= FINAL_BEEP_SECONDS) {
        playBeep(audioCtxRef, BEEPS.tick)
      }
      if (left <= 0) {
        playBeep(audioCtxRef, BEEPS.end)
        clearTestTimer()
        finishSession()
      }
    }, 1000)
  }, [finishSession])

  const abortCountdownToWaiting = (message?: string) => {
    if (stageRef.current !== "countdown") return
    clearCountdownTimer()
    countdownValueRef.current = COUNTDOWN_SECONDS
    setCountdown(COUNTDOWN_SECONDS)
    postureOkSinceRef.current = null
    if (message) setWarning(message)
    updateStage("waiting")
  }

  const beginCountdown = () => {
    if (stageRef.current !== "waiting") return
    clearCountdownTimer()
    countdownValueRef.current = COUNTDOWN_SECONDS
    setCountdown(COUNTDOWN_SECONDS)
    setWarning("")
    updateStage("countdown")
    playBeep(audioCtxRef, BEEPS.tick)

    countdownTimerRef.current = setInterval(() => {
      const next = countdownValueRef.current - 1
      countdownValueRef.current = next
      if (next > 0) {
        setCountdown(next)
        playBeep(audioCtxRef, BEEPS.tick)
      } else {
        clearCountdownTimer()
        setCountdown(0)
        playBeep(audioCtxRef, BEEPS.go)
        startActiveFromCountdown()
      }
    }, 1000)
  }

  const enterWaiting = () => {
    ensureAudio(audioCtxRef)
    postureOkSinceRef.current = null
    clearCountdownTimer()
    countdownValueRef.current = COUNTDOWN_SECONDS
    setCountdown(COUNTDOWN_SECONDS)
    setWarning("")
    setCameraError(null)
    updateStage("waiting")
    ensureFrameLoop()
  }

  const cancelActiveSession = () => {
    clearCountdownTimer()
    clearTestTimer()
    counterRef.current.handFailFrames = 0
    counterRef.current.lastValidAngle = null
    resetCalibSession()
    setCalibOn(false)
    setReps(0)
    counterRef.current.reps = 0
    setTimeLeft(TEST_DURATION_SECONDS)
    timeLeftRef.current = TEST_DURATION_SECONDS
    setWarning("")
    stopStream()
    updateStage("prepare")
  }

  const selectExercise = (ex: Exercise) => {
    setVideoReady(false)
    setExercise(ex)
    exerciseRef.current = ex
    updateStage("prepare")
  }

  const goHome = () => {
    clearCountdownTimer()
    counterRef.current.handFailFrames = 0
    counterRef.current.lastValidAngle = null
    resetCalibSession()
    setCalibOn(false)
    stopStream()
    setExercise(null)
    exerciseRef.current = null
    setReps(0)
    setTimeLeft(TEST_DURATION_SECONDS)
    setBodyReady(false)
    setVideoReady(false)
    setWarning("")
    setResultAttempts([])
    setElapsedSec(0)
    setSessionSaved(false)
    updateStage("select")
  }

  const prepareNextTrainee = () => {
    const counter = counterRef.current
    clearCountdownTimer()
    counter.handFailFrames = 0
    counter.lastValidAngle = null
    resetCalibSession()
    setCalibOn(false)
    setReps(0)
    counter.reps = 0
    counter.phase = null
    counter.lastRepTime = 0
    setTimeLeft(TEST_DURATION_SECONDS)
    timeLeftRef.current = TEST_DURATION_SECONDS
    setResultAttempts([])
    setElapsedSec(0)
    setSessionSaved(false)
    setWarning("")
    setBodyReady(false)
    postureOkSinceRef.current = null
    countdownValueRef.current = COUNTDOWN_SECONDS
    setCountdown(COUNTDOWN_SECONDS)
    updateStage("waiting")
  }

  const saveCurrentSession = () => {
    if (!exercise) return
    const session: SavedSession = {
      id: Date.now(),
      exercise,
      reps,
      durationSec: elapsedSec,
      savedAt: new Date().toISOString(),
      attempts: resultAttempts,
    }
    const next = [session, ...loadSavedSessions()]
    persistSavedSessions(next)
    setSavedSessions(next)
    setSessionSaved(true)
  }

  const deleteSession = (id: number) => {
    const next = loadSavedSessions().filter((s) => s.id !== id)
    persistSavedSessions(next)
    setSavedSessions(next)
    if (expandedSessionId === id) setExpandedSessionId(null)
  }

  const deleteAllSessions = () => {
    if (!window.confirm("هل أنت متأكد من حذف كل الجلسات المحفوظة؟")) return
    persistSavedSessions([])
    setSavedSessions([])
    setExpandedSessionId(null)
  }

  const exportAllSessions = async () => {
    const text = formatSessionsExport(loadSavedSessions())
    try {
      await navigator.clipboard.writeText(text || "لا توجد جلسات")
      setExportCopied(true)
      setTimeout(() => setExportCopied(false), COPIED_FEEDBACK_MS)
    } catch {}
  }

  const copyCalibSummary = async () => {
    try {
      await navigator.clipboard.writeText(formatAttemptRows(logRef.current.attempts))
      setCalibCopied(true)
      setTimeout(() => setCalibCopied(false), COPIED_FEEDBACK_MS)
    } catch {}
  }

  const toggleCalib = () => {
    setCalibOn((on) => {
      if (!on) resetCalibSession()
      return !on
    })
  }

  const exerciseLabel = exercise ? EXERCISE_LABELS[exercise] : ""
  const strictnessLabel =
    exercise === "pushup" || exercise === "situp"
      ? STRICTNESS_LABELS[exercise === "pushup" ? strictness : situpStrictness]
      : null
  const attempts = logRef.current.attempts

  return (
    <ProtectedRoute
      allowedRoles={[
        "owner",
      ]}
    >
      <div className="min-h-screen bg-slate-50 p-4 md:p-8" dir="rtl">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900">🤖 العد الذكي</h1>
              <p className="text-sm text-slate-500 font-medium">حفظ الجلسات محلياً على هذا الجهاز</p>
            </div>
            <Button variant="outline" onClick={() => router.push("/dashboard")} className="gap-2 font-bold">
              <ArrowRight className="w-4 h-4" /> لوحة التحكم
            </Button>
          </div>

          {stage === "select" && (
            <div className="space-y-6">
              <ExercisePicker onSelect={selectExercise} />
              <SavedSessions
                sessions={savedSessions}
                expandedSessionId={expandedSessionId}
                onToggleExpanded={(id) => setExpandedSessionId(expandedSessionId === id ? null : id)}
                exportCopied={exportCopied}
                onExportAll={exportAllSessions}
                onDeleteAll={deleteAllSessions}
                onDelete={deleteSession}
              />
            </div>
          )}

          {(stage === "prepare" ||
            stage === "waiting" ||
            stage === "countdown" ||
            stage === "active") &&
            exercise && (
            <CameraView
              stage={stage}
              videoRef={videoRef}
              canvasRef={canvasRef}
              facingMode={facingMode}
              videoReady={videoReady}
              cameraError={cameraError}
              needsTap={needsTap}
              onVideoReady={() => setVideoReady(true)}
              onTapToPlay={playAfterTap}
              onFlipCamera={flipCamera}
              warning={warning}
              countdown={countdown}
              timeLeft={timeLeft}
              reps={reps}
              strictnessLabel={strictnessLabel}
              fps={fps}
              delegate={delegate}
              onStop={finishSession}
              onCancel={cancelActiveSession}
            >
              {stage === "prepare" && (
                <div className="p-6 space-y-4">
                  <h2 className="text-xl font-black text-center">تجهيز تمرين {exerciseLabel}</h2>
                  {cameraError && (
                    <p className="text-red-600 text-sm font-bold text-center">{cameraError}</p>
                  )}
                  {!mediapipeReady && (
                    <p className="text-amber-600 text-sm font-bold text-center animate-pulse">
                      ⏳ جاري تحميل نموذج العد...
                    </p>
                  )}
                  {mediapipeReady && previewReady && warning && (
                    <p
                      className={`text-sm font-bold text-center rounded-xl px-3 py-2 ${
                        bodyReady
                          ? "text-emerald-700 bg-emerald-50"
                          : "text-amber-700 bg-amber-50 animate-pulse"
                      }`}
                    >
                      {warning}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <Button
                      onClick={enterWaiting}
                      disabled={!mediapipeReady || !previewReady}
                      className={`flex-1 h-12 font-black gap-2 ${
                        !mediapipeReady || !previewReady
                          ? "opacity-50 cursor-not-allowed bg-gray-400 hover:bg-gray-400"
                          : "bg-emerald-600 hover:bg-emerald-700"
                      }`}
                    >
                      <Play className="w-5 h-5" /> استعداد
                    </Button>
                    <Button variant="outline" onClick={goHome} className="font-bold">
                      رجوع
                    </Button>
                  </div>
                  <StrictnessPanel
                    exercise={exercise}
                    strictness={strictness}
                    onStrictnessChange={setStrictness}
                    thresholds={thresholds}
                    onThresholdsChange={setThresholds}
                    situpStrictness={situpStrictness}
                    onSitupStrictnessChange={setSitupStrictness}
                    situpThresholds={situpThresholds}
                    onSitupThresholdsChange={setSitupThresholds}
                  />
                </div>
              )}
              {(stage === "waiting" || stage === "countdown") && (
                <div className="p-4 flex flex-col gap-2 items-center">
                  {cameraError && (
                    <p className="text-red-600 text-sm font-bold">{cameraError}</p>
                  )}
                  <Button variant="outline" onClick={goHome} className="font-bold">
                    رجوع
                  </Button>
                </div>
              )}
              {stage === "active" && (
                <div className="p-4 flex flex-col gap-2 items-center">
                  {warning && (
                    <div className="text-red-600 font-bold text-sm text-center animate-pulse bg-red-50 rounded-xl px-3 py-2">
                      {warning}
                    </div>
                  )}
                  {cameraError && (
                    <p className="text-red-600 text-sm font-bold">{cameraError}</p>
                  )}
                  <CalibrationPanel
                    calibOn={calibOn}
                    onToggle={toggleCalib}
                    hasData={calibData.length > 0 || attempts.length > 0}
                    attempts={attempts}
                    fps={fps}
                    calibTick={calibTick}
                    calibCopied={calibCopied}
                    onCopy={copyCalibSummary}
                    skippedJumps={skippedJumps}
                    trackingLoss={trackingLoss}
                  />
                </div>
              )}
            </CameraView>
          )}

          {stage === "result" && (
            <ResultScreen
              exerciseLabel={exerciseLabel}
              reps={reps}
              elapsedSec={elapsedSec}
              attempts={resultAttempts}
              sessionSaved={sessionSaved}
              onSave={saveCurrentSession}
              onNextTrainee={prepareNextTrainee}
              onHome={goHome}
            />
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
