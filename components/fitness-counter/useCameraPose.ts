"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AUTOPLAY_CHECK_MS, CAMERA_ERRORS, isCameraStage } from "@/lib/fitness-counter/constants"
import { drawPoseFrame } from "@/lib/fitness-counter/drawing"
import {
  cancelFrameLoop,
  closePose,
  createPose,
  loadMediaPipeScripts,
  requestCameraStream,
  startFrameLoop,
  stopMediaStream,
  waitForPoseClass,
} from "@/lib/fitness-counter/pose-engine"
import type { FacingMode, PoseResults, Ref, Stage } from "@/lib/fitness-counter/types"

/**
 * Camera stream + MediaPipe pose lifecycle. `onResults` is read through a ref,
 * so it always sees the latest render; it must rely on refs for per-frame state.
 */
export function useCameraPose(stageRef: Ref<Stage>, onResults: (results: PoseResults) => void) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const poseRef = useRef<any>(null)
  const poseLoopRef = useRef<number | null>(null)
  const fpsTickRef = useRef({ count: 0, lastTs: Date.now() })
  const onResultsRef = useRef(onResults)
  onResultsRef.current = onResults

  const [cameraError, setCameraError] = useState<string | null>(null)
  const [previewReady, setPreviewReady] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [needsTap, setNeedsTap] = useState(false)
  const [mediapipeReady, setMediapipeReady] = useState(false)
  const [facingMode, setFacingMode] = useState<FacingMode>("user")
  const [fps, setFps] = useState(0)
  const facingModeRef = useRef(facingMode)
  facingModeRef.current = facingMode

  useEffect(() => {
    loadMediaPipeScripts()
      .then(() => setMediapipeReady(true))
      .catch((err) => {
        console.error("MediaPipe load failed:", err)
        setMediapipeReady(false)
      })
  }, [])

  const isRunning = useCallback(() => isCameraStage(stageRef.current), [stageRef])

  const stopStream = useCallback(() => {
    cancelFrameLoop(poseLoopRef)
    closePose(poseRef)
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

  const startPoseTracking = useCallback(async () => {
    const video = videoRef.current
    if (!video) return

    closePose(poseRef)
    cancelFrameLoop(poseLoopRef)

    try {
      const pose = await createPose((results) => {
        const tick = fpsTickRef.current
        tick.count += 1
        const nowTs = Date.now()
        if (nowTs - tick.lastTs >= 1000) {
          setFps(tick.count)
          tick.count = 0
          tick.lastTs = nowTs
        }
        drawPoseFrame(canvasRef.current, video, results)
        onResultsRef.current(results)
      })
      poseRef.current = pose
      startFrameLoop(video, poseRef, poseLoopRef, isRunning)
    } catch (err) {
      console.error("Pose init failed:", err)
      setCameraError(CAMERA_ERRORS.modelLoad)
      return
    }
  }, [isRunning])

  const startPrepareCamera = useCallback(async () => {
    setCameraError(null)
    setPreviewReady(false)
    setVideoReady(false)
    try {
      stopMediaStream(streamRef)
      closePose(poseRef)
      cancelFrameLoop(poseLoopRef)
      const stream = await requestCameraStream(facingModeRef.current)
      streamRef.current = stream
      await attachVideoStream(stream)
      setPreviewReady(true)

      try {
        if (await waitForPoseClass()) {
          await startPoseTracking()
        } else {
          setCameraError(CAMERA_ERRORS.modelLoad)
        }
      } catch {
        setCameraError(CAMERA_ERRORS.modelLoad)
      }
    } catch (err: any) {
      setCameraError(err?.message === "permission" ? CAMERA_ERRORS.permission : CAMERA_ERRORS.access)
    }
  }, [attachVideoStream, startPoseTracking])

  const flipCamera = useCallback(async () => {
    const next: FacingMode = facingModeRef.current === "user" ? "environment" : "user"
    setFacingMode(next)
    facingModeRef.current = next
    setCameraError(null)
    setPreviewReady(false)
    setVideoReady(false)
    try {
      stopMediaStream(streamRef)
      const stream = await requestCameraStream(next)
      streamRef.current = stream
      await attachVideoStream(stream)
      setPreviewReady(true)
      if (isRunning()) {
        await startPoseTracking()
      }
    } catch (err: any) {
      setCameraError(err?.message === "permission" ? CAMERA_ERRORS.permission : CAMERA_ERRORS.flip)
    }
  }, [attachVideoStream, startPoseTracking, isRunning])

  /** Restarts the frame loop after a stage switch if it is not running. */
  const ensureFrameLoop = useCallback(() => {
    if (poseLoopRef.current == null && poseRef.current && videoRef.current) {
      startFrameLoop(videoRef.current, poseRef, poseLoopRef, isRunning)
    }
  }, [isRunning])

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
    startPrepareCamera,
    flipCamera,
    stopStream,
    ensureFrameLoop,
    playAfterTap,
  }
}
