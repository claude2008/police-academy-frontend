"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Camera, Dumbbell, Play, RotateCcw, SwitchCamera, Timer } from "lucide-react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type Stage = "select" | "prepare" | "active" | "result"
type Exercise = "pushup" | "situp"

const DURATION_SEC = 60

const calculateAngle = (a: any, b: any, c: any): number => {
    if (!a || !b || !c) return 0
    const ax = a.x, ay = a.y
    const bx = b.x, by = b.y
    const cx = c.x, cy = c.y
    
    const radians = Math.atan2(cy - by, cx - bx) - Math.atan2(ay - by, ax - bx)
    let angle = Math.abs(radians * 180.0 / Math.PI)
    if (angle > 180.0) angle = 360 - angle
    console.log('Calculated angle:', angle, 'a:', a?.x, b?.x, c?.x)
    return angle
}

const distanceBetween = (a: any, b: any): number => {
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2))
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
  const [timeLeft, setTimeLeft] = useState(DURATION_SEC)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [previewReady, setPreviewReady] = useState(false)
  const [mediapipeReady, setMediapipeReady] = useState(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [warning, setWarning] = useState("")

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const poseRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const rafRef = useRef<number | null>(null)
  const repsRef = useRef(0)
  const timeLeftRef = useRef(DURATION_SEC)
  const phaseRef = useRef<"down" | "up" | null>(null)
  const facingModeRef = useRef(facingMode)
  facingModeRef.current = facingMode

  const stopStream = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
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
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => stopStream()
  }, [stopStream])

  useEffect(() => {
    const loadScripts = async () => {
        const scripts = [
            'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
            'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js',
        ]
        for (const src of scripts) {
            await new Promise<void>((resolve) => {
                const script = document.createElement('script')
                script.src = src
                script.crossOrigin = 'anonymous'
                script.onload = () => resolve()
                script.onerror = () => resolve()
                document.head.appendChild(script)
            })
        }
        setMediapipeReady(true)
    }
    loadScripts()
  }, [])

  const startPrepareCamera = useCallback(async () => {
    setCameraError(null)
    setPreviewReady(false)
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingModeRef.current, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setPreviewReady(true)
    } catch {
      setCameraError("تعذر الوصول إلى الكاميرا. تحقق من الأذونات.")
    }
  }, [])

  const flipCamera = useCallback(async () => {
    const next = facingModeRef.current === "user" ? "environment" : "user"
    setFacingMode(next)
    facingModeRef.current = next
    setCameraError(null)
    setPreviewReady(false)
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: next, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setPreviewReady(true)
    } catch {
      setCameraError("تعذر تبديل الكاميرا.")
    }
  }, [])

  useEffect(() => {
    if (stage === "prepare") {
      startPrepareCamera()
    } else if (stage === "select" || stage === "result") {
      stopStream()
    }
  }, [stage, startPrepareCamera, stopStream])

  const drawLoop = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (video && canvas && stageRef.current === "active") {
      const ctx = canvas.getContext("2d")
      if (ctx && video.readyState >= 2) {
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480
        ctx.save()
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        ctx.restore()
      }
      rafRef.current = requestAnimationFrame(drawLoop)
    }
  }, [])

  const detectRep = (landmarks: any) => {
    console.log('detectRep called, exercise:', exerciseRef.current, 'landmarks count:', landmarks?.length)
    if (exerciseRef.current === "pushup") {
      const leftHip = landmarks[23]
      const rightHip = landmarks[24]
      const leftAnkle = landmarks[27]
      const rightAnkle = landmarks[28]

      const bodyVisible = 
          (leftHip?.visibility || 0) > 0.5 &&
          (rightHip?.visibility || 0) > 0.5 &&
          (leftAnkle?.visibility || 0) > 0.5 &&
          (rightAnkle?.visibility || 0) > 0.5

      if (!bodyVisible) {
          setWarning("⚠️ تأكد من ظهور الجسم كاملاً في الكاميرا")
          return
      } else {
          setWarning("")
      }

      const shoulder = landmarks[12]
      const elbow = landmarks[14]  
      const wrist = landmarks[16]
      console.log('Landmarks:', shoulder, elbow, wrist)
      const angle = calculateAngle(shoulder, elbow, wrist)
      console.log('Pushup angle:', angle, 'position:', phaseRef.current)
      if (angle < 90) {
        phaseRef.current = "down"
      } else if (angle > 160 && phaseRef.current === "down") {
        phaseRef.current = "up"
        repsRef.current += 1
        setReps(repsRef.current)
      }
    } else if (exerciseRef.current === "situp") {
      const angle = calculateAngle(landmarks[12], landmarks[24], landmarks[26])
      console.log('Situp angle:', angle, 'position:', phaseRef.current)
      const leftWrist = landmarks[15]
      const rightWrist = landmarks[16]
      const leftEar = landmarks[7]
      const rightEar = landmarks[8]
      const leftShoulder = landmarks[11]
      const rightShoulder = landmarks[12]

      const leftWristNearBody = distanceBetween(leftWrist, leftEar) < 0.3 || 
                                distanceBetween(leftWrist, leftShoulder) < 0.3
      const rightWristNearBody = distanceBetween(rightWrist, rightEar) < 0.3 || 
                                 distanceBetween(rightWrist, rightShoulder) < 0.3

      const handsInPosition = leftWristNearBody && rightWristNearBody

      if (angle < 70) {
        phaseRef.current = "up"
      } else if (angle > 140 && phaseRef.current === 'up' && handsInPosition) {
        setReps(prev => prev + 1)
        phaseRef.current = 'down'
      }
    }
  }

  const finishSession = useCallback(() => {
    stopStream()
    updateStage("result")
  }, [stopStream])

  const startActiveSession = useCallback(async () => {
    setReps(0)
    repsRef.current = 0
    phaseRef.current = null
    setTimeLeft(DURATION_SEC)
    timeLeftRef.current = DURATION_SEC
    setCameraError(null)
    updateStage("active")

    await new Promise((r) => setTimeout(r, 100))

    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) throw new Error("video/canvas missing")

      // Reuse prepare stream if still alive; otherwise request a new one
      if (!streamRef.current || streamRef.current.getTracks().every((t) => t.readyState === "ended")) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: facingModeRef.current },
          audio: false,
        })
        streamRef.current = stream
        video.srcObject = stream
      } else if (!video.srcObject) {
        video.srcObject = streamRef.current
      }
      await video.play()

      const ctx = canvas.getContext("2d")
      const PoseClass = (window as any).Pose
      if (PoseClass) {
          const pose = new PoseClass({
              locateFile: (file: string) => 
                  `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
          })
          pose.setOptions({
              modelComplexity: 1,
              smoothLandmarks: true,
              minDetectionConfidence: 0.5,
              minTrackingConfidence: 0.5,
          })
          pose.onResults((results: any) => {
              if (!canvas || !ctx) return
              ctx.clearRect(0, 0, canvas.width, canvas.height)
              ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height)
              if (results.poseLandmarks) {
                  const drawingUtils = (window as any)
                  if (drawingUtils.drawConnectors && drawingUtils.drawLandmarks) {
                      drawingUtils.drawConnectors(ctx, results.poseLandmarks, (window as any).POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 2})
                      drawingUtils.drawLandmarks(ctx, results.poseLandmarks, {color: '#FF0000', lineWidth: 1})
                  }
                  detectRep(results.poseLandmarks)
              }
          })
          poseRef.current = pose
          const processFrame = async () => {
              if (poseRef.current && video && stageRef.current === 'active') {
                  await poseRef.current.send({ image: video })
                  requestAnimationFrame(processFrame)
              }
          }
          requestAnimationFrame(processFrame)
      }

      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(drawLoop)

      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        timeLeftRef.current -= 1
        setTimeLeft(timeLeftRef.current)
        if (timeLeftRef.current <= 0) {
          if (timerRef.current) clearInterval(timerRef.current)
          timerRef.current = null
          finishSession()
        }
      }, 1000)
    } catch (err: any) {
      console.error(err)
      setCameraError("فشل تشغيل الكاميرا.")
    }
  }, [drawLoop, finishSession])

  const selectExercise = (ex: Exercise) => {
    setExercise(ex)
    exerciseRef.current = ex
    updateStage("prepare")
  }

  const goHome = () => {
    stopStream()
    setExercise(null)
    exerciseRef.current = null
    setReps(0)
    setTimeLeft(DURATION_SEC)
    updateStage("select")
  }

  const retry = () => {
    stopStream()
    setReps(0)
    setTimeLeft(DURATION_SEC)
    updateStage("prepare")
  }

  const exerciseLabel = exercise === "pushup" ? "ضغط" : exercise === "situp" ? "بطن" : ""

  return (
    <ProtectedRoute
      allowedRoles={[
        "owner",
        "assistant_admin",
      ]}
    >
      <div className="min-h-screen bg-slate-50 p-4 md:p-8" dir="rtl">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900">🤖 العد الذكي</h1>
              <p className="text-sm text-slate-500 font-medium">تجريبي — بدون حفظ في قاعدة البيانات</p>
            </div>
            <Button variant="outline" onClick={() => router.push("/dashboard")} className="gap-2 font-bold">
              <ArrowRight className="w-4 h-4" /> لوحة التحكم
            </Button>
          </div>

          {stage === "select" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card
                className="cursor-pointer border-2 hover:border-emerald-500 hover:shadow-lg transition-all rounded-3xl overflow-hidden"
                onClick={() => selectExercise("pushup")}
              >
                <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-emerald-100 flex items-center justify-center">
                    <Dumbbell className="w-10 h-10 text-emerald-700" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900">ضغط</h2>
                  <p className="text-sm text-slate-500">عدّاد ضغط الأرض بالكاميرا</p>
                </CardContent>
              </Card>
              <Card
                className="cursor-pointer border-2 hover:border-sky-500 hover:shadow-lg transition-all rounded-3xl overflow-hidden"
                onClick={() => selectExercise("situp")}
              >
                <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-sky-100 flex items-center justify-center">
                    <Dumbbell className="w-10 h-10 text-sky-700 rotate-90" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900">بطن</h2>
                  <p className="text-sm text-slate-500">عدّاد تمارين البطن بالكاميرا</p>
                </CardContent>
              </Card>
            </div>
          )}

          {(stage === "prepare" || stage === "active") && exercise && (
            <Card className="rounded-3xl overflow-hidden shadow-md">
              <CardContent className="p-0">
                <div className="relative bg-black aspect-video">
                  <video
                    ref={videoRef}
                    className={`w-full h-full object-cover ${stage === "active" ? "hidden" : ""}`}
                    playsInline
                    muted
                    style={{ transform: "scaleX(-1)" }}
                  />
                  {stage === "active" && (
                    <canvas
                      ref={canvasRef}
                      className="w-full h-full object-contain"
                      style={{ transform: "scaleX(-1)" }}
                    />
                  )}
                  {stage === "prepare" && !previewReady && !cameraError && (
                    <div className="absolute inset-0 flex items-center justify-center text-white/80 gap-2">
                      <Camera className="w-5 h-5 animate-pulse" /> جاري تشغيل الكاميرا...
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={flipCamera}
                    className="absolute top-3 right-3 z-10 bg-black/70 hover:bg-black/90 text-white rounded-full p-2.5 shadow-lg"
                    title="تبديل الكاميرا"
                  >
                    <SwitchCamera className="w-5 h-5" />
                  </button>
                  {stage === "active" && (
                    <>
                      <div className="absolute top-3 left-3 right-14 flex justify-between gap-2 pointer-events-none">
                        <div className="bg-black/70 text-white rounded-2xl px-4 py-2 flex items-center gap-2 font-black">
                          <Timer className="w-4 h-4 text-amber-400" />
                          {timeLeft}s
                        </div>
                        <div className="bg-emerald-600/90 text-white rounded-2xl px-4 py-2 font-black text-lg">
                          {reps} تكرار
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={finishSession}
                        className="absolute bottom-3 inset-x-3 z-10 mx-auto max-w-xs bg-red-600 hover:bg-red-700 text-white font-black rounded-full h-12 flex items-center justify-center gap-2 shadow-lg"
                      >
                        ⏹️ إيقاف
                      </button>
                    </>
                  )}
                </div>
                {stage === "prepare" && (
                  <div className="p-6 space-y-4">
                    <h2 className="text-xl font-black">تجهيز تمرين {exerciseLabel}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(exercise === "pushup"
                        ? [
                            { icon: "📐", title: "زاوية الكاميرا", text: "من الجانب بزاوية 90 درجة" },
                            { icon: "💡", title: "الإضاءة", text: "تأكد من إضاءة جيدة على الجسم كاملاً" },
                            { icon: "📏", title: "المسافة", text: "2-3 متر من الكاميرا" },
                            { icon: "🚫", title: "الثبات", text: "لا تحرك الكاميرا أثناء التمرين" },
                          ]
                        : [
                            { icon: "📐", title: "زاوية الكاميرا", text: "من الجانب بزاوية 90 درجة" },
                            { icon: "💡", title: "الإضاءة", text: "تأكد من إضاءة جيدة" },
                            { icon: "📏", title: "المسافة", text: "2-3 متر من الكاميرا" },
                            { icon: "🚫", title: "الثبات", text: "لا تحرك الكاميرا أثناء التمرين" },
                          ]
                      ).map((tip) => (
                        <div
                          key={tip.title}
                          className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm"
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-2xl leading-none">{tip.icon}</span>
                            <div>
                              <p className="font-black text-slate-900 text-sm">{tip.title}</p>
                              <p className="text-slate-600 text-sm font-medium mt-1 leading-relaxed">{tip.text}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {cameraError && (
                      <p className="text-red-600 text-sm font-bold">{cameraError}</p>
                    )}
                    <div className="flex gap-3">
                      <Button
                        onClick={startActiveSession}
                        disabled={!!cameraError || !previewReady}
                        className="flex-1 h-12 font-black gap-2 bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Play className="w-5 h-5" /> ابدأ
                      </Button>
                      <Button variant="outline" onClick={goHome} className="font-bold">
                        رجوع
                      </Button>
                    </div>
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
                    <p className="text-xl font-black text-amber-800">{DURATION_SEC} ث</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={retry} className="flex-1 h-12 font-black gap-2 bg-sky-600 hover:bg-sky-700">
                    <RotateCcw className="w-4 h-4" /> إعادة
                  </Button>
                  <Button onClick={goHome} variant="outline" className="flex-1 h-12 font-black">
                    الرئيسية
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
