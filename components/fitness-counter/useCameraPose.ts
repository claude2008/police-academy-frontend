"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AUTOPLAY_CHECK_MS, CAMERA_ERRORS, isCameraStage } from "@/lib/fitness-counter/constants"
import { drawPoseFrame, type SkeletonDrawer } from "@/lib/fitness-counter/drawing"
import {
  cancelFrameLoop,
  closeLandmarker,
  createPoseRuntime,
  requestCameraStream,
  startFrameLoop,
  stopMediaStream,
  type PoseRuntime,
} from "@/lib/fitness-counter/pose-engine"
import type { FacingMode, PoseDelegate, PoseResults, Ref, Stage } from "@/lib/fitness-counter/types"

/**
 * Camera stream + one PoseLandmarker, created once and reused across flips and sessions.
 * `onResults` is read through a ref, so it always sees the latest render.
 */
export function useCameraPose(stageRef: Ref<Stage>, onResults: (results: PoseResults) => void) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const landmarkerRef = useRef<PoseRuntime["landmarker"] | null>(null)
  const drawSkeletonRef = useRef<SkeletonDrawer | null>(null)
  const creatingRef = useRef<Promise<void> | null>(null)
  const poseLoopRef = useRef<number | null>(null)
  const fpsTickRef = useRef({ count: 0, lastTs: Date.now() })
  const onResultsRef = useRef(onResults)
  onResultsRef.current = onResults
  const mountedRef = useRef(true)

  const [cameraError, setCameraError] = useState<string | null>(null)
  const [previewReady, setPreviewReady] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [needsTap, setNeedsTap] = useState(false)
  const [mediapipeReady, setMediapipeReady] = useState(false)
  const [facingMode, setFacingMode] = useState<FacingMode>("user")
  const [fps, setFps] = useState(0)
  const [delegate, setDelegate] = useState<PoseDelegate | null>(null)
  const facingModeRef = useRef(facingMode)
  facingModeRef.current = facingMode

  const isRunning = useCallback(() => isCameraStage(stageRef.current), [stageRef])

  const handleFrame = useCallback((results: PoseResults) => {
    const video = videoRef.current
    if (!video) return
    const tick = fpsTickRef.current
    tick.count += 1
    const nowTs = Date.now()
    if (nowTs - tick.lastTs >= 1000) {
      setFps(tick.count)
      tick.count = 0
      tick.lastTs = nowTs
    }
    drawPoseFrame(canvasRef.current, video, results, drawSkeletonRef.current)
    onResultsRef.current(results)
  }, [])

  const runLoop = useCallback(() => {
    const video = videoRef.current
    if (!video || !landmarkerRef.current) return
    startFrameLoop(video, landmarkerRef, poseLoopRef, isRunning, handleFrame)
  }, [handleFrame, isRunning])

  const ensureLandmarker = useCallback(async () => {
    if (landmarkerRef.current) return
    if (!creatingRef.current) {
      creatingRef.current = (async () => {
        try {
          const runtime = await createPoseRuntime()
          if (!mountedRef.current) {
            runtime.landmarker.close()
            return
          }
          landmarkerRef.current = runtime.landmarker
          drawSkeletonRef.current = runtime.drawSkeleton
          setDelegate(runtime.delegate)
          setMediapipeReady(true)
        } catch (err) {
          creatingRef.current = null
          throw err
        }
      })()
    }
    await creatingRef.current
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void ensureLandmarker().catch((err) => {
      console.error("MediaPipe load failed:", err)
      if (!mountedRef.current) return
      setMediapipeReady(false)
      setCameraError(CAMERA_ERRORS.modelLoad)
    })
    return () => {
      mountedRef.current = false
      cancelFrameLoop(poseLoopRef)
      closeLandmarker(landmarkerRef)
      stopMediaStream(streamRef)
    }
  }, [ensureLandmarker])

  const stopStream = useCallback(() => {
    cancelFrameLoop(poseLoopRef)
    stopMediaStream(streamRef)
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setVideoReady(false)
  }, [])

  const attachVideoStream = useCallback(async (stream: MediaStream) => {
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
    }, AUTOPLAY_CHECK_MS)
  }, [])

  const startTracking = useCallback(async () => {
    try {
      await ensureLandmarker()
      if (landmarkerRef.current) runLoop()
    } catch (err) {
      console.error("Pose init failed:", err)
      setCameraError(CAMERA_ERRORS.modelLoad)
    }
  }, [ensureLandmarker, runLoop])

  const startPrepareCamera = useCallback(async () => {
    setCameraError(null)
    setPreviewReady(false)
    setVideoReady(false)
    try {
      cancelFrameLoop(poseLoopRef)
      stopMediaStream(streamRef)
      const stream = await requestCameraStream(facingModeRef.current)
      streamRef.current = stream
      await attachVideoStream(stream)
      setPreviewReady(true)
      await startTracking()
    } catch (err: any) {
      setCameraError(err?.message === "permission" ? CAMERA_ERRORS.permission : CAMERA_ERRORS.access)
    }
  }, [attachVideoStream, startTracking])

  const flipCamera = useCallback(async () => {
    const next: FacingMode = facingModeRef.current === "user" ? "environment" : "user"
    setFacingMode(next)
    facingModeRef.current = next
    setCameraError(null)
    setPreviewReady(false)
    setVideoReady(false)
    try {
      cancelFrameLoop(poseLoopRef)
      stopMediaStream(streamRef)
      const stream = await requestCameraStream(next)
      streamRef.current = stream
      await attachVideoStream(stream)
      setPreviewReady(true)
      if (isRunning()) await startTracking()
    } catch (err: any) {
      setCameraError(err?.message === "permission" ? CAMERA_ERRORS.permission : CAMERA_ERRORS.flip)
    }
  }, [attachVideoStream, isRunning, startTracking])

  /** Restarts the frame loop after a stage switch if it is not running. */
  const ensureFrameLoop = useCallback(() => {
    if (poseLoopRef.current == null && landmarkerRef.current && videoRef.current) {
      runLoop()
    }
  }, [runLoop])

  const playAfterTap = useCallback(() => {
    videoRef.current
      ?.play()
      .then(() => {
        setNeedsTap(false)
      })
      .catch(() => {})
  }, [])

  return {
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
    startPrepareCamera,
    flipCamera,
    stopStream,
    ensureFrameLoop,
    playAfterTap,
  }
}
