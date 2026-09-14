"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Camera, Dumbbell, Play, SwitchCamera, Timer } from "lucide-react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type Stage = "select" | "prepare" | "waiting" | "countdown" | "active" | "result"
type Exercise = "pushup" | "situp"
type Strictness = "easy" | "normal" | "strict" | "custom"
type Attempt = { bottom: number; top: number | null; counted: boolean; at: number }
type SavedSession = {
  id: number
  exercise: Exercise
  reps: number
  durationSec: number
  savedAt: string
  attempts: Attempt[]
}

const TEST_DURATION_SECONDS = 60
const SESSIONS_KEY = "smart-counter-sessions"

const loadSavedSessions = (): SavedSession[] => {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((s: SavedSession) => ({
      ...s,
      attempts: Array.isArray(s.attempts)
        ? s.attempts.map((a) => ({
            bottom: a.bottom,
            top: a.top ?? null,
            counted: !!a.counted,
            at: typeof a.at === "number" ? a.at : 0,
          }))
        : [],
    }))
  } catch {
    return []
  }
}

const persistSavedSessions = (sessions: SavedSession[]) => {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

const PRESETS = {
  easy:   { elbowDown: 110, elbowUp: 150, knee: 130, hip: 120, cooldownMs: 500 },
  normal: { elbowDown: 100, elbowUp: 155, knee: 145, hip: 135, cooldownMs: 650 },
  strict: { elbowDown: 90,  elbowUp: 160, knee: 160, hip: 150, cooldownMs: 800 },
}

const SITUP_PRESETS = {
  easy:   { up: 85, down: 130, kneeMax: 165, handRatio: 1.4, cooldownMs: 450 },
  normal: { up: 75, down: 140, kneeMax: 155, handRatio: 1.1, cooldownMs: 600 },
  strict: { up: 65, down: 150, kneeMax: 145, handRatio: 0.9, cooldownMs: 750 },
}

const STRICTNESS_LABELS: Record<Strictness, string> = {
  easy: "🟢 متساهل",
  normal: "🟡 متوسط",
  strict: "🔴 صارم",
  custom: "⚙️ مخصص",
}

const EXERCISE_TIPS = [
  { icon: "📐", title: "زاوية الكاميرا", text: "من الجانب بزاوية 90 درجة" },
  { icon: "💡", title: "الإضاءة", text: "إضاءة جيدة على الجسم كاملاً" },
  { icon: "📏", title: "المسافة", text: "2-3 متر من الكاميرا" },
  { icon: "🚫", title: "الثبات", text: "لا تحرك الكاميرا أثناء التمرين" },
]

const calculateAngle = (a: any, b: any, c: any): number => {
    if (!a || !b || !c) return 0
    const ax = a.x, ay = a.y
    const bx = b.x, by = b.y
    const cx = c.x, cy = c.y
    
    const radians = Math.atan2(cy - by, cx - bx) - Math.atan2(ay - by, ax - bx)
    let angle = Math.abs(radians * 180.0 / Math.PI)
    if (angle > 180.0) angle = 360 - angle
    return angle
}

const distanceBetween = (a: any, b: any): number => {
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2))
}

const getBestSide = (landmarks: any[]) => {
  const left  = [11, 23, 25, 27].reduce((s, i) => s + (landmarks[i]?.visibility || 0), 0)
  const right = [12, 24, 26, 28].reduce((s, i) => s + (landmarks[i]?.visibility || 0), 0)
  return right >= left
    ? { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28 }
    : { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 }
}

const isBodyVisibleForExercise = (landmarks: any[], exercise: Exercise | null) => {
  if (!landmarks || !exercise) return false
  const s = getBestSide(landmarks)
  const required = [s.shoulder, s.hip, s.knee, s.ankle]
  return required.every((i) => (landmarks[i]?.visibility || 0) > 0.5)
}

const calcAngle = (a: any, b: any, c: any) => {
  const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x)
  let deg = Math.abs(rad * 180 / Math.PI)
  if (deg > 180) deg = 360 - deg
  return deg
}

const isBodyStraight = (landmarks: any[], t: { knee: number; hip: number }) => {
  if (!landmarks) return false
  const s = getBestSide(landmarks)
  const knee = calcAngle(landmarks[s.hip], landmarks[s.knee], landmarks[s.ankle])
  const hip  = calcAngle(landmarks[s.shoulder], landmarks[s.hip], landmarks[s.knee])
  return knee > t.knee && hip > t.hip
}

const getVideoConstraints = (facing: "user" | "environment") => {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768
  return {
    video: {
      width: isMobile ? { ideal: window.innerWidth } : 640,
      height: isMobile ? { ideal: window.innerHeight * 0.7 } : 480,
      facingMode: facing,
    },
    audio: false as const,
  }
}

export default function FitnessCounterPage() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>("select")
  const stageRef = useRef(stage)
  const updateStage = (newStage: typeof stage) => {
    stageRef.current = newStage
    setStage(newStage)
  }
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const exerciseRef = useRef(exercise)
  const [reps, setReps] = useState(0)
  const [timeLeft, setTimeLeft] = useState(TEST_DURATION_SECONDS)
  const [countdown, setCountdown] = useState(5)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [previewReady, setPreviewReady] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [needsTap, setNeedsTap] = useState(false)
  const [bodyReady, setBodyReady] = useState(false)
  const [mediapipeReady, setMediapipeReady] = useState(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
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

  useEffect(() => { thresholdsRef.current = thresholds }, [thresholds])

  useEffect(() => {
    if (strictness !== "custom") setThresholds(PRESETS[strictness])
  }, [strictness])

  const [situpStrictness, setSitupStrictness] = useState<Strictness>("normal")
  const [situpThresholds, setSitupThresholds] = useState(SITUP_PRESETS.normal)
  const situpThresholdsRef = useRef(SITUP_PRESETS.normal)
  const [calibData, setCalibData] = useState<number[]>([])
  const [calibOn, setCalibOn] = useState(false)
  const [calibCopied, setCalibCopied] = useState(false)
  const [trackingLoss, setTrackingLoss] = useState(0)
  const [skippedJumps, setSkippedJumps] = useState(0)
  const [calibTick, setCalibTick] = useState(0)
  const [fps, setFps] = useState(0)
  const calibRef = useRef(false)
  const fpsTickRef = useRef({ count: 0, lastTs: Date.now() })
  const attempts = useRef<Attempt[]>([])
  const currentMin = useRef<number>(999)
  const currentMax = useRef<number>(0)
  const lastCalibAngle = useRef<number | null>(null)
  const lastValidAngle = useRef<number | null>(null)
  const rejectArmed = useRef(false)
  const rejectMin = useRef(999)
  const trackingLossRef = useRef(0)
  const skippedJumpsRef = useRef(0)
  const sessionStartTimeRef = useRef(0)

  const pushAttempt = (entry: Attempt) => {
    attempts.current.push(entry)
    if (attempts.current.length > 100) {
      attempts.current.splice(0, attempts.current.length - 100)
    }
  }

  const getRejectAscentThreshold = () => {
    // Pushup: elbowUp. Situp: keep prior 150° cycle gate (torso open/close).
    if (exerciseRef.current === "situp") return 150
    return thresholdsRef.current.elbowUp
  }

  const resetCalibSession = () => {
    setCalibData([])
    setTrackingLoss(0)
    setSkippedJumps(0)
    setCalibTick(0)
    setCalibCopied(false)
    attempts.current = []
    currentMin.current = 999
    currentMax.current = 0
    lastCalibAngle.current = null
    rejectArmed.current = false
    rejectMin.current = 999
    trackingLossRef.current = 0
    skippedJumpsRef.current = 0
  }

  const recordCalibAngle = (angle: number, counted: boolean) => {
    const rounded = Math.round(angle)
    if (lastCalibAngle.current != null && Math.abs(rounded - lastCalibAngle.current) > 30) {
      trackingLossRef.current += 1
      setTrackingLoss(trackingLossRef.current)
    }
    lastCalibAngle.current = rounded

    currentMin.current = Math.min(currentMin.current, angle)
    currentMax.current = Math.max(currentMax.current, angle)
    setCalibData((prev) => [...prev, rounded])

    const at = Date.now() - sessionStartTimeRef.current

    if (counted) {
      const entry: Attempt = {
        bottom: Math.round(currentMin.current),
        top: Math.round(currentMax.current),
        counted: true,
        at,
      }
      const last = attempts.current[attempts.current.length - 1]
      const nowMs = Date.now() - sessionStartTimeRef.current
      if (
        last &&
        last.counted === false &&
        Math.abs(last.bottom - entry.bottom) <= 3 &&
        Math.abs(nowMs - last.at) <= 1500
      ) {
        attempts.current[attempts.current.length - 1] = entry
      } else {
        pushAttempt(entry)
      }
      // Reset rejection tracker immediately so ascent/recovery cannot start a new attempt
      currentMin.current = 999
      currentMax.current = 0
      rejectArmed.current = false
      rejectMin.current = 999
      setCalibTick((t) => t + 1)
      return
    }

    const ascentThreshold = getRejectAscentThreshold()
    if (angle < ascentThreshold) {
      rejectArmed.current = true
      rejectMin.current = Math.min(rejectMin.current, angle)
    } else if (angle > ascentThreshold && rejectArmed.current) {
      // Real rejected attempt: local min at least 25° below ascent threshold
      if (rejectMin.current <= ascentThreshold - 25) {
        pushAttempt({
          bottom: Math.round(rejectMin.current),
          top: null,
          counted: false,
          at,
        })
        setCalibTick((t) => t + 1)
      }
      rejectArmed.current = false
      rejectMin.current = 999
    }
  }

  const buildCalibSummary = () => {
    return attempts.current
      .map((a, i) => {
        const top = a.top == null ? "—" : String(a.top)
        const status = a.counted ? "محسوب" : "مرفوض"
        const sec = (a.at / 1000).toFixed(1)
        return `${i + 1} | ${a.bottom} | ${top} | ${status} | ${sec}`
      })
      .join("\n")
  }

  useEffect(() => { situpThresholdsRef.current = situpThresholds }, [situpThresholds])
  useEffect(() => {
    if (situpStrictness !== "custom") setSitupThresholds(SITUP_PRESETS[situpStrictness])
  }, [situpStrictness])
  useEffect(() => { calibRef.current = calibOn }, [calibOn])
  useEffect(() => {
    setSavedSessions(loadSavedSessions())
  }, [])

  const ensureAudio = () => {
    const AC =
      typeof window !== "undefined"
        ? window.AudioContext || (window as any).webkitAudioContext
        : null
    if (!AC) return null
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AC()
    }
    if (audioCtxRef.current.state === "suspended") {
      void audioCtxRef.current.resume()
    }
    return audioCtxRef.current
  }

  const playBeep = (freq: number, durationMs: number) => {
    const ctx = audioCtxRef.current || ensureAudio()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.value = freq
    gain.gain.value = 0.2
    osc.connect(gain)
    gain.connect(ctx.destination)
    const now = ctx.currentTime
    osc.start(now)
    osc.stop(now + durationMs / 1000)
  }

  const clearCountdownTimer = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
  }

  const evaluateBodyVisible = (landmarks: any): boolean => {
    if (!landmarks) return false
    const s = getBestSide(landmarks)
    return [s.shoulder, s.hip, s.knee, s.ankle].every(
      (i) => (landmarks[i]?.visibility || 0) > 0.5
    )
  }

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const poseRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const rafRef = useRef<number | null>(null)
  const poseLoopRef = useRef<number | null>(null)
  const repsRef = useRef(0)
  const timeLeftRef = useRef(TEST_DURATION_SECONDS)
  const phaseRef = useRef<"down" | "up" | null>(null)
  const lastRepTime = useRef(0)
  const handFailFrames = useRef(0)
  const facingModeRef = useRef(facingMode)
  facingModeRef.current = facingMode
  const audioCtxRef = useRef<AudioContext | null>(null)
  const postureOkSinceRef = useRef<number | null>(null)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownValueRef = useRef(5)
  const beginCountdownRef = useRef<() => void>(() => {})
  const abortCountdownToWaitingRef = useRef<(message?: string) => void>(() => {})

  const mirrorStyle = { transform: facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)' }

  const stopStream = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (poseLoopRef.current != null) {
      cancelAnimationFrame(poseLoopRef.current)
      poseLoopRef.current = null
    }
    if (poseRef.current) {
      try {
        poseRef.current.close()
      } catch {}
      poseRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setVideoReady(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => stopStream()
  }, [stopStream])

  useEffect(() => {
    const loadMediaPipe = async () => {
        const loadScript = (src: string): Promise<void> => {
            return new Promise((resolve, reject) => {
                if (document.querySelector(`script[src="${src}"]`)) {
                    resolve()
                    return
                }
                const script = document.createElement('script')
                script.src = src
                script.crossOrigin = 'anonymous'
                script.onload = () => resolve()
                script.onerror = () => reject(new Error(`Failed to load ${src}`))
                document.head.appendChild(script)
            })
        }

        try {
            await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.js')
            await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1675466124/drawing_utils.js')
            await new Promise(resolve => setTimeout(resolve, 500))
            setMediapipeReady(true)
        } catch (err) {
            console.error('MediaPipe load failed:', err)
            setMediapipeReady(false)
        }
    }
    loadMediaPipe()
  }, [])

  const requestCameraStream = async (facing: "user" | "environment") => {
    try {
      return await navigator.mediaDevices.getUserMedia(getVideoConstraints(facing))
    } catch (err: any) {
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        throw new Error("permission")
      }
      try {
        return await navigator.mediaDevices.getUserMedia({ video: true })
      } catch (err2: any) {
        if (err2?.name === "NotAllowedError" || err2?.name === "PermissionDeniedError") {
          throw new Error("permission")
        }
        throw err2
      }
    }
  }

  const attachVideoStream = async (stream: MediaStream) => {
    if (!videoRef.current) return
    const video = videoRef.current
    video.setAttribute("playsinline", "true")
    video.setAttribute("webkit-playsinline", "true")
    video.muted = true
    setVideoReady(false)
    setNeedsTap(false)
    video.srcObject = stream
    video.play()
      .then(() => {
        setNeedsTap(false)
      })
      .catch(() => {
        setNeedsTap(true)
      })
    setTimeout(() => {
      if (videoRef.current && videoRef.current.readyState === 0) {
        setNeedsTap(true)
      }
    }, 3000)
  }

  const detectRep = (landmarks: any) => {
    const bodyVisible = isBodyVisibleForExercise(landmarks, exerciseRef.current)
    if (!bodyVisible) {
      setWarning("⚠️ تأكد من ظهور الجسم كاملاً في الكاميرا")
      return
    }
    setWarning("")

    const now = Date.now()

    if (exerciseRef.current === "pushup") {
      const t = thresholdsRef.current
      if (!isBodyStraight(landmarks, t)) {
        setWarning("⚠️ حافظ على استقامة الجسم — لا تضع الركبة على الأرض")
        return
      }
      const s = getBestSide(landmarks)
      const shoulder = landmarks[s.shoulder]
      const elbow = landmarks[s.elbow]
      const wrist = landmarks[s.wrist]
      const angle = calculateAngle(shoulder, elbow, wrist)
      const prev = lastValidAngle.current
      if (prev !== null && Math.abs(angle - prev) > 35) {
        // impossible jump — tracking glitch, skip this frame entirely
        skippedJumpsRef.current += 1
        setSkippedJumps(skippedJumpsRef.current)
        return
      }
      lastValidAngle.current = angle
      let counted = false
      if (angle < t.elbowDown) {
        phaseRef.current = "down"
      } else if (angle > t.elbowUp && phaseRef.current === "down") {
        if (now - lastRepTime.current >= t.cooldownMs) {
          lastRepTime.current = now
          phaseRef.current = "up"
          repsRef.current += 1
          setReps(repsRef.current)
          counted = true
        }
      }
      if (calibRef.current || stageRef.current === "active") {
        recordCalibAngle(angle, counted)
      }
    } else if (exerciseRef.current === "situp") {
      const t = situpThresholdsRef.current
      const s = getBestSide(landmarks)

      // knee must be BENT (not straight) — machine keeps legs bent
      const kneeAngle = calcAngle(landmarks[s.hip], landmarks[s.knee], landmarks[s.ankle])
      if (kneeAngle > t.kneeMax) {
        setWarning("⚠️ اثنِ الركبتين — يجب ألا تكون الساقان مستقيمتين")
        return
      }

      // hands on chest or behind head
      const shoulderWidth = distanceBetween(landmarks[11], landmarks[12])
      if (shoulderWidth < 0.02) {
        setWarning("⚠️ اقترب من الكاميرا")
        return
      }

      // virtual chest center: midpoint between shoulders, shifted toward hips
      const midShoulder = {
        x: (landmarks[11].x + landmarks[12].x) / 2,
        y: (landmarks[11].y + landmarks[12].y) / 2,
      }
      const midHip = {
        x: (landmarks[23].x + landmarks[24].x) / 2,
        y: (landmarks[23].y + landmarks[24].y) / 2,
      }
      const chestCenter = {
        x: midShoulder.x + (midHip.x - midShoulder.x) * 0.3,
        y: midShoulder.y + (midHip.y - midShoulder.y) * 0.3,
      }

      const maxHandDist = shoulderWidth * t.handRatio
      const anchorPoints = [landmarks[7], landmarks[8], landmarks[11], landmarks[12], chestCenter]
      const wrists = [15, 16]

      const handsInPosition = wrists.every(w =>
        anchorPoints.some(an => distanceBetween(landmarks[w], an) < maxHandDist)
      )

      if (!handsInPosition) {
        handFailFrames.current += 1
        if (handFailFrames.current > 8) {
          setWarning("⚠️ ضع اليدين على الصدر أو خلف الرأس")
        }
        return
      }
      handFailFrames.current = 0

      const groundRef = { x: landmarks[s.hip].x, y: landmarks[s.hip].y + 0.3 }
      const angle = calculateAngle(landmarks[s.shoulder], landmarks[s.hip], groundRef)
      const prev = lastValidAngle.current
      if (prev !== null && Math.abs(angle - prev) > 35) {
        // impossible jump — tracking glitch, skip this frame entirely
        skippedJumpsRef.current += 1
        setSkippedJumps(skippedJumpsRef.current)
        return
      }
      lastValidAngle.current = angle
      let counted = false

      if (angle > t.down) {
        phaseRef.current = "down"
      } else if (angle < t.up && phaseRef.current === "down") {
        if (now - lastRepTime.current >= t.cooldownMs) {
          lastRepTime.current = now
          phaseRef.current = "up"
          repsRef.current += 1
          setReps(repsRef.current)
          counted = true
        }
      }
      if (calibRef.current || stageRef.current === "active") {
        recordCalibAngle(angle, counted)
      }
    }
  }

  const startPoseTracking = useCallback(async () => {
    const video = videoRef.current
    if (!video) return

    if (poseRef.current) {
      try {
        const old = poseRef.current
        poseRef.current = null
        old.close()   // do NOT await this
      } catch {}
    }
    if (poseLoopRef.current != null) {
      cancelAnimationFrame(poseLoopRef.current)
      poseLoopRef.current = null
    }

    try {
      const PoseClass = (window as any).Pose
      if (!PoseClass) throw new Error('Pose not loaded')
      const pose = new PoseClass({
          locateFile: (file: string) => 
              `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`
      })
      await Promise.race([
        pose.initialize(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("init timeout")), 10000))
      ])
      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })
      pose.onResults((results: any) => {
        const tick = fpsTickRef.current
        tick.count += 1
        const nowTs = Date.now()
        if (nowTs - tick.lastTs >= 1000) {
          setFps(tick.count)
          tick.count = 0
          tick.lastTs = nowTs
        }
        const canvas = canvasRef.current
        const ctx = canvas?.getContext("2d")
        if (canvas && ctx) {
          canvas.width = video.videoWidth || 640
          canvas.height = video.videoHeight || 480
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height)
          if (results.poseLandmarks) {
            const drawingUtils = window as any
            if (drawingUtils.drawConnectors && drawingUtils.drawLandmarks) {
              drawingUtils.drawConnectors(
                ctx,
                results.poseLandmarks,
                (window as any).POSE_CONNECTIONS,
                { color: "#00FF00", lineWidth: 2 }
              )
              drawingUtils.drawLandmarks(ctx, results.poseLandmarks, {
                color: "#FF0000",
                lineWidth: 1,
              })
            }
          }
        }
        if (results.poseLandmarks) {
          if (stageRef.current === "prepare") {
            const visible = isBodyVisibleForExercise(results.poseLandmarks, exerciseRef.current)
            setBodyReady(visible)
            setWarning(visible ? "✅ الوضع مثالي" : "⚠️ تأكد من ظهور الجسم كاملاً في الكاميرا")
          } else if (stageRef.current === "waiting") {
            const ok = evaluateBodyVisible(results.poseLandmarks)
            if (ok) {
              setWarning("")
              if (postureOkSinceRef.current == null) {
                postureOkSinceRef.current = Date.now()
              } else if (Date.now() - postureOkSinceRef.current >= 2000) {
                postureOkSinceRef.current = null
                beginCountdownRef.current()
              }
            } else {
              postureOkSinceRef.current = null
              setWarning("في انتظار ظهور الجسم في الكاميرا")
            }
          } else if (stageRef.current === "countdown") {
            if (!evaluateBodyVisible(results.poseLandmarks)) {
              abortCountdownToWaitingRef.current("في انتظار ظهور الجسم في الكاميرا")
            }
          } else if (stageRef.current === "active") {
            detectRep(results.poseLandmarks)
          }
        } else if (stageRef.current === "prepare") {
          setBodyReady(false)
          setWarning("⚠️ تأكد من ظهور الجسم كاملاً في الكاميرا")
        } else if (stageRef.current === "waiting") {
          postureOkSinceRef.current = null
          setWarning("في انتظار ظهور الجسم في الكاميرا")
        } else if (stageRef.current === "countdown") {
          abortCountdownToWaitingRef.current("في انتظار ظهور الجسم في الكاميرا")
        }
      })

      poseRef.current = pose

      const processFrame = async () => {
        if (
          poseRef.current &&
          video &&
          (stageRef.current === "prepare" ||
            stageRef.current === "waiting" ||
            stageRef.current === "countdown" ||
            stageRef.current === "active")
        ) {
          try {
            await poseRef.current.send({ image: video })
          } catch {}
          poseLoopRef.current = requestAnimationFrame(processFrame)
        }
      }
      poseLoopRef.current = requestAnimationFrame(processFrame)
    } catch (err) {
      console.error('Pose init failed:', err)
      setCameraError("فشل تحميل نموذج الذكاء الاصطناعي، حاول مرة أخرى")
      return
    }
  }, [])

  const startPrepareCamera = useCallback(async () => {
    setCameraError(null)
    setPreviewReady(false)
    setVideoReady(false)
    setBodyReady(false)
    setWarning("")
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      // Stop any leftover pose from a previous session
      if (poseRef.current) {
        try {
          const old = poseRef.current
          poseRef.current = null
          old.close()
        } catch {}
      }
      if (poseLoopRef.current != null) {
        cancelAnimationFrame(poseLoopRef.current)
        poseLoopRef.current = null
      }
      const stream = await requestCameraStream(facingModeRef.current)
      streamRef.current = stream
      await attachVideoStream(stream)
      setPreviewReady(true)

      try {
        for (let i = 0; i < 50 && !(window as any).Pose; i++) {
          await new Promise((r) => setTimeout(r, 200))
        }
        if ((window as any).Pose) {
          await startPoseTracking()
        } else {
          setCameraError("فشل تحميل نموذج الذكاء الاصطناعي، حاول مرة أخرى")
        }
      } catch (e) {
        setCameraError("فشل تحميل نموذج الذكاء الاصطناعي، حاول مرة أخرى")
      }
    } catch (err: any) {
      if (err?.message === "permission") {
        setCameraError("يرجى السماح بالوصول للكاميرا من إعدادات المتصفح")
      } else {
        setCameraError("تعذر الوصول إلى الكاميرا. تحقق من الأذونات.")
      }
    }
  }, [startPoseTracking])

  const flipCamera = useCallback(async () => {
    const next = facingModeRef.current === "user" ? "environment" : "user"
    setFacingMode(next)
    facingModeRef.current = next
    setCameraError(null)
    setPreviewReady(false)
    setVideoReady(false)
    setBodyReady(false)
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      const stream = await requestCameraStream(next)
      streamRef.current = stream
      await attachVideoStream(stream)
      setPreviewReady(true)
      if (
        stageRef.current === "prepare" ||
        stageRef.current === "waiting" ||
        stageRef.current === "countdown" ||
        stageRef.current === "active"
      ) {
        await startPoseTracking()
      }
    } catch (err: any) {
      if (err?.message === "permission") {
        setCameraError("يرجى السماح بالوصول للكاميرا من إعدادات المتصفح")
      } else {
        setCameraError("تعذر تبديل الكاميرا.")
      }
    }
  }, [startPoseTracking])

  useEffect(() => {
    if (stage === "prepare") {
      startPrepareCamera()
    } else if (stage === "waiting" && !streamRef.current) {
      startPrepareCamera()
    } else if (stage === "select" || stage === "result") {
      clearCountdownTimer()
      stopStream()
    }
  }, [stage, startPrepareCamera, stopStream])

  const finishSession = useCallback(() => {
    clearCountdownTimer()
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const elapsed = TEST_DURATION_SECONDS - Math.max(0, timeLeftRef.current)
    setElapsedSec(elapsed)
    setResultAttempts([...attempts.current])
    setSessionSaved(false)
    handFailFrames.current = 0
    lastValidAngle.current = null
    stopStream()
    updateStage("result")
  }, [stopStream])

  const startActiveFromCountdown = useCallback(() => {
    setReps(0)
    repsRef.current = 0
    phaseRef.current = null
    lastRepTime.current = 0
    handFailFrames.current = 0
    lastValidAngle.current = null
    skippedJumpsRef.current = 0
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

    // Restart pose loop after stage switch (processFrame may have stopped briefly)
    if (poseLoopRef.current == null && poseRef.current && videoRef.current) {
      const video = videoRef.current
      const processFrame = async () => {
        if (
          poseRef.current &&
          video &&
          (stageRef.current === "prepare" ||
            stageRef.current === "waiting" ||
            stageRef.current === "countdown" ||
            stageRef.current === "active")
        ) {
          try {
            await poseRef.current.send({ image: video })
          } catch {}
          poseLoopRef.current = requestAnimationFrame(processFrame)
        }
      }
      poseLoopRef.current = requestAnimationFrame(processFrame)
    }

    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      timeLeftRef.current -= 1
      const left = timeLeftRef.current
      setTimeLeft(left)
      if (left >= 1 && left <= 5) {
        playBeep(880, 120)
      }
      if (left <= 0) {
        playBeep(330, 800)
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = null
        finishSession()
      }
    }, 1000)
  }, [finishSession])

  const abortCountdownToWaiting = useCallback((message?: string) => {
    if (stageRef.current !== "countdown") return
    clearCountdownTimer()
    countdownValueRef.current = 5
    setCountdown(5)
    postureOkSinceRef.current = null
    if (message) setWarning(message)
    updateStage("waiting")
  }, [])

  const beginCountdown = useCallback(() => {
    if (stageRef.current !== "waiting") return
    clearCountdownTimer()
    countdownValueRef.current = 5
    setCountdown(5)
    setWarning("")
    updateStage("countdown")
    playBeep(880, 120)

    countdownTimerRef.current = setInterval(() => {
      const next = countdownValueRef.current - 1
      countdownValueRef.current = next
      if (next > 0) {
        setCountdown(next)
        playBeep(880, 120)
      } else {
        clearCountdownTimer()
        setCountdown(0)
        playBeep(440, 500)
        startActiveFromCountdown()
      }
    }, 1000)
  }, [startActiveFromCountdown])

  beginCountdownRef.current = beginCountdown
  abortCountdownToWaitingRef.current = abortCountdownToWaiting

  const enterWaiting = () => {
    ensureAudio()
    postureOkSinceRef.current = null
    clearCountdownTimer()
    countdownValueRef.current = 5
    setCountdown(5)
    setWarning("")
    setCameraError(null)
    updateStage("waiting")
    // Keep pose loop running after prepare→waiting
    if (poseLoopRef.current == null && poseRef.current && videoRef.current) {
      const video = videoRef.current
      const processFrame = async () => {
        if (
          poseRef.current &&
          video &&
          (stageRef.current === "prepare" ||
            stageRef.current === "waiting" ||
            stageRef.current === "countdown" ||
            stageRef.current === "active")
        ) {
          try {
            await poseRef.current.send({ image: video })
          } catch {}
          poseLoopRef.current = requestAnimationFrame(processFrame)
        }
      }
      poseLoopRef.current = requestAnimationFrame(processFrame)
    }
  }

  const cancelActiveSession = () => {
    clearCountdownTimer()
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    handFailFrames.current = 0
    lastValidAngle.current = null
    resetCalibSession()
    setCalibOn(false)
    setReps(0)
    repsRef.current = 0
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
    handFailFrames.current = 0
    lastValidAngle.current = null
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
    clearCountdownTimer()
    handFailFrames.current = 0
    lastValidAngle.current = null
    resetCalibSession()
    setCalibOn(false)
    setReps(0)
    repsRef.current = 0
    phaseRef.current = null
    lastRepTime.current = 0
    setTimeLeft(TEST_DURATION_SECONDS)
    timeLeftRef.current = TEST_DURATION_SECONDS
    setResultAttempts([])
    setElapsedSec(0)
    setSessionSaved(false)
    setWarning("")
    setBodyReady(false)
    postureOkSinceRef.current = null
    countdownValueRef.current = 5
    setCountdown(5)
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
    const sessions = loadSavedSessions()
    const text = sessions
      .map((s) => {
        const label = s.exercise === "pushup" ? "ضغط" : "بطن"
        const header = `${new Date(s.savedAt).toLocaleString("en-GB")} | ${label} | ${s.reps} تكرار | ${s.durationSec} ث`
        const rows = s.attempts
          .map((a, i) => {
            const top = a.top == null ? "—" : String(a.top)
            const sec = (a.at / 1000).toFixed(1)
            return `${i + 1} | ${a.bottom} | ${top} | ${a.counted ? "محسوب" : "مرفوض"} | ${sec}`
          })
          .join("\n")
        return `${header}\n${rows || "(لا محاولات)"}`
      })
      .join("\n\n---\n\n")
    try {
      await navigator.clipboard.writeText(text || "لا توجد جلسات")
      setExportCopied(true)
      setTimeout(() => setExportCopied(false), 2000)
    } catch {}
  }

  const renderAttemptsTable = (rows: Attempt[]) => (
    <div className="max-h-[300px] overflow-y-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-xs font-bold text-slate-800" dir="rtl">
        <thead className="sticky top-0 bg-slate-100">
          <tr>
            <th className="px-2 py-1.5 text-center">#</th>
            <th className="px-2 py-1.5 text-center">النزول</th>
            <th className="px-2 py-1.5 text-center">الصعود</th>
            <th className="px-2 py-1.5 text-center">الحالة</th>
            <th className="px-2 py-1.5 text-center">الزمن (ثانية)</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-2 py-3 text-center text-slate-500">
                لا توجد محاولات
              </td>
            </tr>
          ) : (
            rows.map((a, i) => (
              <tr key={i} className={a.counted ? "bg-emerald-50" : "bg-amber-50"}>
                <td className="px-2 py-1 text-center" dir="ltr">
                  {i + 1}
                </td>
                <td className="px-2 py-1 text-center" dir="ltr">
                  {a.bottom}
                </td>
                <td className="px-2 py-1 text-center" dir="ltr">
                  {a.top == null ? "—" : a.top}
                </td>
                <td className="px-2 py-1 text-center">{a.counted ? "✅" : "❌"}</td>
                <td className="px-2 py-1 text-center" dir="ltr">
                  {(a.at / 1000).toFixed(1)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )

  const exerciseLabel = exercise === "pushup" ? "ضغط" : exercise === "situp" ? "بطن" : ""

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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card
                  className="cursor-pointer border-2 hover:border-emerald-500 hover:shadow-lg transition-all rounded-3xl overflow-hidden"
                  onClick={() => selectExercise("pushup")}
                >
                  <CardContent className="p-6 flex flex-col items-center gap-4 text-center">
                    <div className="w-20 h-20 rounded-2xl bg-emerald-100 flex items-center justify-center">
                      <Dumbbell className="w-10 h-10 text-emerald-700" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900">ضغط</h2>
                    <p className="text-sm text-slate-500">عدّاد ضغط الأرض بالكاميرا</p>
                    <div className="w-full space-y-2 text-right mt-2">
                      {EXERCISE_TIPS.map((tip) => (
                        <div key={tip.title} className="rounded-xl bg-emerald-50/80 border border-emerald-100 px-3 py-2">
                          <p className="text-xs font-black text-slate-800">
                            {tip.icon} {tip.title}: <span className="font-medium text-slate-600">{tip.text}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card
                  className="cursor-pointer border-2 hover:border-sky-500 hover:shadow-lg transition-all rounded-3xl overflow-hidden"
                  onClick={() => selectExercise("situp")}
                >
                  <CardContent className="p-6 flex flex-col items-center gap-4 text-center">
                    <div className="w-20 h-20 rounded-2xl bg-sky-100 flex items-center justify-center">
                      <Dumbbell className="w-10 h-10 text-sky-700 rotate-90" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900">بطن</h2>
                    <p className="text-sm text-slate-500">عدّاد تمارين البطن بالكاميرا</p>
                    <div className="w-full space-y-2 text-right mt-2">
                      {EXERCISE_TIPS.map((tip) => (
                        <div key={tip.title} className="rounded-xl bg-sky-50/80 border border-sky-100 px-3 py-2">
                          <p className="text-xs font-black text-slate-800">
                            {tip.icon} {tip.title}: <span className="font-medium text-slate-600">{tip.text}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-3xl border border-slate-200 shadow-sm">
                <CardContent className="p-5 space-y-4" dir="rtl">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-black text-slate-900">📁 الجلسات المحفوظة</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 text-xs font-black"
                        onClick={exportAllSessions}
                        disabled={savedSessions.length === 0}
                      >
                        {exportCopied ? "✅ تم النسخ" : "📋 تصدير الكل"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 text-xs font-black text-red-700 border-red-200 hover:bg-red-50"
                        onClick={deleteAllSessions}
                        disabled={savedSessions.length === 0}
                      >
                        🗑️ حذف الكل
                      </Button>
                    </div>
                  </div>
                  {savedSessions.length === 0 ? (
                    <p className="text-sm text-slate-500 font-medium">لا توجد جلسات محفوظة بعد.</p>
                  ) : (
                    <div className="space-y-2">
                      {savedSessions.map((s) => {
                        const label = s.exercise === "pushup" ? "ضغط" : "بطن"
                        const open = expandedSessionId === s.id
                        return (
                          <div key={s.id} className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
                            <button
                              type="button"
                              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-right"
                              onClick={() => setExpandedSessionId(open ? null : s.id)}
                            >
                              <div className="space-y-0.5">
                                <p className="text-sm font-black text-slate-900">
                                  {label} — {s.reps} تكرار
                                </p>
                                <p className="text-xs text-slate-500 font-medium" dir="ltr">
                                  {new Date(s.savedAt).toLocaleString("en-GB")} · {s.durationSec}s
                                </p>
                              </div>
                              <span className="text-slate-400 text-sm">{open ? "▲" : "▼"}</span>
                            </button>
                            {open && (
                              <div className="px-4 pb-4 space-y-3">
                                {renderAttemptsTable(s.attempts)}
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-9 text-xs font-black text-red-700 border-red-200"
                                  onClick={() => deleteSession(s.id)}
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
            </div>
          )}

          {(stage === "prepare" ||
            stage === "waiting" ||
            stage === "countdown" ||
            stage === "active") &&
            exercise && (
            <Card className="rounded-3xl overflow-hidden shadow-md">
              <CardContent className="p-0">
                <div className="relative bg-slate-900 w-full aspect-video md:w-[640px] md:h-[480px] md:mx-auto rounded-2xl overflow-hidden">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-contain rounded-2xl absolute inset-0 z-0"
                    playsInline
                    muted
                    autoPlay
                    onLoadedMetadata={() => {
                      setVideoReady(true)
                    }}
                    onPlaying={() => {
                      setVideoReady(true)
                    }}
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
                      onClick={() => {
                        videoRef.current
                          ?.play()
                          .then(() => {
                            setNeedsTap(false)
                          })
                          .catch(() => {})
                      }}
                      className="absolute inset-0 z-20 flex items-center justify-center bg-black/60"
                    >
                      <span className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-full px-8 py-4 shadow-lg">
                        ▶️ اضغط لتشغيل الكاميرا
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={flipCamera}
                    className="absolute top-3 right-3 z-10 bg-black/70 hover:bg-black/90 text-white rounded-full p-2.5 shadow-lg"
                    title="تبديل الكاميرا"
                  >
                    <SwitchCamera className="w-5 h-5" />
                  </button>
                  {stage === "waiting" && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none bg-black/35 px-4">
                      <p className="text-white text-xl md:text-2xl font-black text-center drop-shadow">
                        في انتظار ظهور الجسم في الكاميرا
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
                            timeLeft <= 5
                              ? "bg-red-600/95 text-white"
                              : timeLeft <= 10
                                ? "bg-amber-500/95 text-white"
                                : "bg-black/70 text-white"
                          }`}
                        >
                          <Timer
                            className={`w-5 h-5 ${
                              timeLeft <= 5
                                ? "text-white"
                                : timeLeft <= 10
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
                      {(exercise === "pushup" || exercise === "situp") && (
                        <div className="absolute top-14 left-3 z-10 pointer-events-none">
                          <span className="bg-black/70 text-white text-xs font-bold rounded-full px-3 py-1">
                            {STRICTNESS_LABELS[exercise === "pushup" ? strictness : situpStrictness]}
                          </span>
                        </div>
                      )}
                      <div className="absolute top-14 right-3 z-10 pointer-events-none">
                        <span
                          className={`text-xs font-bold rounded-full px-3 py-1 ${
                            fps > 0 && fps < 15
                              ? "bg-amber-500/90 text-white"
                              : "bg-black/70 text-white"
                          }`}
                        >
                          معدل المعالجة: {fps} إطار/ثانية
                        </span>
                      </div>
                      <div className="absolute bottom-3 inset-x-3 z-10 mx-auto max-w-md flex gap-2">
                        <button
                          type="button"
                          onClick={finishSession}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black rounded-full h-12 flex items-center justify-center gap-2 shadow-lg"
                        >
                          ⏹️ إيقاف
                        </button>
                        <button
                          type="button"
                          onClick={cancelActiveSession}
                          className="flex-1 bg-red-700 hover:bg-red-800 text-white font-black rounded-full h-12 flex items-center justify-center gap-2 shadow-lg"
                        >
                          إلغاء
                        </button>
                      </div>
                    </>
                  )}
                </div>
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
                    {exercise === "pushup" && (
                      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 space-y-3" dir="rtl">
                        <h3 className="font-black text-slate-900 text-sm">⚙️ مستوى الدقة</h3>
                        <div className="grid grid-cols-4 gap-2">
                          {(
                            [
                              { key: "easy" as const, label: "🟢 متساهل", caption: `${PRESETS.easy.elbowDown}° / ${PRESETS.easy.elbowUp}°` },
                              { key: "normal" as const, label: "🟡 متوسط", caption: `${PRESETS.normal.elbowDown}° / ${PRESETS.normal.elbowUp}°` },
                              { key: "strict" as const, label: "🔴 صارم", caption: `${PRESETS.strict.elbowDown}° / ${PRESETS.strict.elbowUp}°` },
                              { key: "custom" as const, label: "⚙️ مخصص", caption: `${thresholds.elbowDown}° / ${thresholds.elbowUp}°` },
                            ]
                          ).map((opt) => (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => setStrictness(opt.key)}
                              className={`rounded-xl px-1 py-2 text-center transition-all border-2 ${
                                strictness === opt.key
                                  ? "border-emerald-500 bg-emerald-50 shadow-sm"
                                  : "border-slate-200 bg-white hover:border-slate-300"
                              }`}
                            >
                              <p className="text-[11px] sm:text-xs font-black text-slate-800 leading-tight">{opt.label}</p>
                              <p className="text-[9px] sm:text-[10px] font-medium text-slate-500 mt-1" dir="ltr">{opt.caption}</p>
                            </button>
                          ))}
                        </div>
                        {strictness === "custom" && (
                          <div className="space-y-3 pt-1">
                            <label className="block space-y-1">
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-xs font-bold text-slate-800">زاوية الكوع (النزول)</span>
                                <span className="text-xs font-black text-emerald-700" dir="ltr">{thresholds.elbowDown}°</span>
                              </div>
                              <input
                                type="range"
                                min={70}
                                max={130}
                                step={5}
                                value={thresholds.elbowDown}
                                onChange={(e) => {
                                  const next = Number(e.target.value)
                                  const maxDown = thresholds.elbowUp - 20
                                  setThresholds({
                                    ...thresholds,
                                    elbowDown: Math.min(next, maxDown),
                                  })
                                }}
                                className="w-full accent-emerald-600"
                              />
                            </label>
                            <label className="block space-y-1">
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-xs font-bold text-slate-800">زاوية الكوع (الصعود)</span>
                                <span className="text-xs font-black text-emerald-700" dir="ltr">{thresholds.elbowUp}°</span>
                              </div>
                              <input
                                type="range"
                                min={130}
                                max={175}
                                step={5}
                                value={thresholds.elbowUp}
                                onChange={(e) => {
                                  const next = Number(e.target.value)
                                  const minUp = thresholds.elbowDown + 20
                                  setThresholds({
                                    ...thresholds,
                                    elbowUp: Math.max(next, minUp),
                                  })
                                }}
                                className="w-full accent-emerald-600"
                              />
                            </label>
                            <label className="block space-y-1">
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-xs font-bold text-slate-800">استقامة الركبة</span>
                                <span className="text-xs font-black text-emerald-700" dir="ltr">{thresholds.knee}°</span>
                              </div>
                              <input
                                type="range"
                                min={110}
                                max={170}
                                step={5}
                                value={thresholds.knee}
                                onChange={(e) =>
                                  setThresholds({ ...thresholds, knee: Number(e.target.value) })
                                }
                                className="w-full accent-emerald-600"
                              />
                            </label>
                            <label className="block space-y-1">
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-xs font-bold text-slate-800">استقامة الورك</span>
                                <span className="text-xs font-black text-emerald-700" dir="ltr">{thresholds.hip}°</span>
                              </div>
                              <input
                                type="range"
                                min={100}
                                max={170}
                                step={5}
                                value={thresholds.hip}
                                onChange={(e) =>
                                  setThresholds({ ...thresholds, hip: Number(e.target.value) })
                                }
                                className="w-full accent-emerald-600"
                              />
                            </label>
                            <label className="block space-y-1">
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-xs font-bold text-slate-800">أقل زمن بين التكرارات (مللي ثانية)</span>
                                <span className="text-xs font-black text-emerald-700" dir="ltr">{thresholds.cooldownMs}</span>
                              </div>
                              <input
                                type="range"
                                min={300}
                                max={1000}
                                step={50}
                                value={thresholds.cooldownMs}
                                onChange={(e) =>
                                  setThresholds({ ...thresholds, cooldownMs: Number(e.target.value) })
                                }
                                className="w-full accent-emerald-600"
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    )}
                    {exercise === "situp" && (
                      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 space-y-3" dir="rtl">
                        <h3 className="font-black text-slate-900 text-sm">⚙️ مستوى الدقة</h3>
                        <div className="grid grid-cols-4 gap-2">
                          {(
                            [
                              { key: "easy" as const, label: "🟢 متساهل", caption: `الصعود < ${SITUP_PRESETS.easy.up}°` },
                              { key: "normal" as const, label: "🟡 متوسط", caption: `الصعود < ${SITUP_PRESETS.normal.up}°` },
                              { key: "strict" as const, label: "🔴 صارم", caption: `الصعود < ${SITUP_PRESETS.strict.up}°` },
                              { key: "custom" as const, label: "⚙️ مخصص", caption: `الصعود < ${situpThresholds.up}°` },
                            ]
                          ).map((opt) => (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => setSitupStrictness(opt.key)}
                              className={`rounded-xl px-1 py-2 text-center transition-all border-2 ${
                                situpStrictness === opt.key
                                  ? "border-emerald-500 bg-emerald-50 shadow-sm"
                                  : "border-slate-200 bg-white hover:border-slate-300"
                              }`}
                            >
                              <p className="text-[11px] sm:text-xs font-black text-slate-800 leading-tight">{opt.label}</p>
                              <p className="text-[9px] sm:text-[10px] font-medium text-slate-500 mt-1" dir="ltr">{opt.caption}</p>
                            </button>
                          ))}
                        </div>
                        {situpStrictness === "custom" && (
                          <div className="space-y-3 pt-1">
                            <label className="block space-y-1">
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-xs font-bold text-slate-800">زاوية الصعود</span>
                                <span className="text-xs font-black text-emerald-700" dir="ltr">{situpThresholds.up}°</span>
                              </div>
                              <input
                                type="range"
                                min={55}
                                max={95}
                                step={5}
                                value={situpThresholds.up}
                                onChange={(e) =>
                                  setSitupThresholds({ ...situpThresholds, up: Number(e.target.value) })
                                }
                                className="w-full accent-emerald-600"
                              />
                            </label>
                            <label className="block space-y-1">
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-xs font-bold text-slate-800">زاوية النزول</span>
                                <span className="text-xs font-black text-emerald-700" dir="ltr">{situpThresholds.down}°</span>
                              </div>
                              <input
                                type="range"
                                min={120}
                                max={165}
                                step={5}
                                value={situpThresholds.down}
                                onChange={(e) =>
                                  setSitupThresholds({ ...situpThresholds, down: Number(e.target.value) })
                                }
                                className="w-full accent-emerald-600"
                              />
                            </label>
                            <label className="block space-y-1">
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-xs font-bold text-slate-800">أقصى انثناء مسموح للركبة</span>
                                <span className="text-xs font-black text-emerald-700" dir="ltr">{situpThresholds.kneeMax}°</span>
                              </div>
                              <input
                                type="range"
                                min={130}
                                max={175}
                                step={5}
                                value={situpThresholds.kneeMax}
                                onChange={(e) =>
                                  setSitupThresholds({ ...situpThresholds, kneeMax: Number(e.target.value) })
                                }
                                className="w-full accent-emerald-600"
                              />
                            </label>
                            <label className="block space-y-1">
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-xs font-bold text-slate-800">مسافة اليد المسموحة</span>
                                <span className="text-xs font-black text-emerald-700" dir="ltr">{situpThresholds.handRatio.toFixed(1)}</span>
                              </div>
                              <input
                                type="range"
                                min={0.6}
                                max={2.0}
                                step={0.1}
                                value={situpThresholds.handRatio}
                                onChange={(e) =>
                                  setSitupThresholds({ ...situpThresholds, handRatio: Number(e.target.value) })
                                }
                                className="w-full accent-emerald-600"
                              />
                            </label>
                            <label className="block space-y-1">
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-xs font-bold text-slate-800">أقل زمن بين التكرارات (مللي ثانية)</span>
                                <span className="text-xs font-black text-emerald-700" dir="ltr">{situpThresholds.cooldownMs}</span>
                              </div>
                              <input
                                type="range"
                                min={300}
                                max={1000}
                                step={50}
                                value={situpThresholds.cooldownMs}
                                onChange={(e) =>
                                  setSitupThresholds({ ...situpThresholds, cooldownMs: Number(e.target.value) })
                                }
                                className="w-full accent-emerald-600"
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    )}
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
                    <button
                      type="button"
                      onClick={() => {
                        setCalibOn((on) => {
                          if (!on) resetCalibSession()
                          return !on
                        })
                      }}
                      className={`text-xs font-bold rounded-full px-4 py-2 border transition-colors ${
                        calibOn
                          ? "bg-amber-100 border-amber-400 text-amber-900"
                          : "bg-slate-100 border-slate-200 text-slate-700"
                      }`}
                    >
                      📊 تسجيل الزوايا {calibOn ? "(يعمل)" : ""}
                    </button>
                    {calibOn && (calibData.length > 0 || attempts.current.length > 0) && (
                      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-2 text-right" dir="rtl">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-bold text-slate-800 flex-1" dir="rtl">
                            محسوبة: {attempts.current.filter((a) => a.counted).length}
                            {"   |   "}
                            مرفوضة: {attempts.current.filter((a) => !a.counted).length}
                            {"   |   "}
                            معدل المعالجة: {fps} إطار/ثانية
                            <span className="hidden">{calibTick}</span>
                          </p>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(buildCalibSummary())
                                setCalibCopied(true)
                                setTimeout(() => setCalibCopied(false), 2000)
                              } catch {}
                            }}
                            className="shrink-0 text-xs font-black rounded-full px-3 py-1.5 bg-sky-600 text-white hover:bg-sky-700"
                          >
                            {calibCopied ? "✅ تم النسخ" : "📋 نسخ"}
                          </button>
                        </div>
                        {attempts.current.length > 0 && renderAttemptsTable(attempts.current)}
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
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {stage === "result" && (
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
                  {renderAttemptsTable(resultAttempts)}
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={saveCurrentSession}
                    disabled={sessionSaved}
                    className="flex-1 h-12 font-black gap-2 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {sessionSaved ? "✅ تم الحفظ" : "💾 حفظ"}
                  </Button>
                  <Button
                    onClick={prepareNextTrainee}
                    className="flex-1 h-12 font-black gap-2 bg-sky-600 hover:bg-sky-700"
                  >
                    استعداد للمتدرب التالي
                  </Button>
                </div>
                <Button onClick={goHome} variant="outline" className="w-full h-11 font-black">
                  الرئيسية
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
