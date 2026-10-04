import {
  DEFAULT_FRAME,
  DRAWING_UTILS_SCRIPT_URL,
  MEDIAPIPE_SETTLE_MS,
  MOBILE_BREAKPOINT_PX,
  MOBILE_VIDEO_HEIGHT_RATIO,
  POSE_CDN_BASE,
  POSE_INIT_TIMEOUT_MS,
  POSE_OPTIONS,
  POSE_POLL_ATTEMPTS,
  POSE_POLL_INTERVAL_MS,
  POSE_SCRIPT_URL,
} from "./constants"
import type { FacingMode, PoseResults, Ref } from "./types"

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement("script")
    script.src = src
    script.crossOrigin = "anonymous"
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

/** Loads the MediaPipe Pose and drawing_utils scripts from the CDN (exposes window.Pose etc.). */
export const loadMediaPipeScripts = async () => {
  await loadScript(POSE_SCRIPT_URL)
  await loadScript(DRAWING_UTILS_SCRIPT_URL)
  await sleep(MEDIAPIPE_SETTLE_MS)
}

/** Polls until window.Pose exists; resolves false if it never appears. */
export const waitForPoseClass = async () => {
  for (let i = 0; i < POSE_POLL_ATTEMPTS && !(window as any).Pose; i++) {
    await sleep(POSE_POLL_INTERVAL_MS)
  }
  return !!(window as any).Pose
}

export const getVideoConstraints = (facing: FacingMode) => {
  const isMobile = typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT_PX
  return {
    video: {
      width: isMobile ? { ideal: window.innerWidth } : DEFAULT_FRAME.width,
      height: isMobile ? { ideal: window.innerHeight * MOBILE_VIDEO_HEIGHT_RATIO } : DEFAULT_FRAME.height,
      facingMode: facing,
    },
    audio: false as const,
  }
}

const isPermissionError = (err: any) =>
  err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError"

/** Throws Error("permission") when access is denied; falls back to `{ video: true }` on other errors. */
export const requestCameraStream = async (facing: FacingMode) => {
  try {
    return await navigator.mediaDevices.getUserMedia(getVideoConstraints(facing))
  } catch (err: any) {
    if (isPermissionError(err)) throw new Error("permission")
    try {
      return await navigator.mediaDevices.getUserMedia({ video: true })
    } catch (err2: any) {
      if (isPermissionError(err2)) throw new Error("permission")
      throw err2
    }
  }
}

export const stopMediaStream = (streamRef: Ref<MediaStream | null>) => {
  if (streamRef.current) {
    streamRef.current.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }
}

export const createPose = async (onResults: (results: PoseResults) => void) => {
  const PoseClass = (window as any).Pose
  if (!PoseClass) throw new Error("Pose not loaded")
  const pose = new PoseClass({
    locateFile: (file: string) => `${POSE_CDN_BASE}/${file}`,
  })
  await Promise.race([
    pose.initialize(),
    new Promise((_, rej) => setTimeout(() => rej(new Error("init timeout")), POSE_INIT_TIMEOUT_MS)),
  ])
  pose.setOptions({ ...POSE_OPTIONS })
  pose.onResults(onResults)
  return pose
}

/** Must not await close(). */
export const closePose = (poseRef: Ref<any>) => {
  if (poseRef.current) {
    try {
      const old = poseRef.current
      poseRef.current = null
      old.close()
    } catch {}
  }
}

export const cancelFrameLoop = (loopRef: Ref<number | null>) => {
  if (loopRef.current != null) {
    cancelAnimationFrame(loopRef.current)
    loopRef.current = null
  }
}

/** Sends one frame at a time to the pose model; stops when there is no pose or `isRunning()` is false. */
export const startFrameLoop = (
  video: HTMLVideoElement,
  poseRef: Ref<any>,
  loopRef: Ref<number | null>,
  isRunning: () => boolean
) => {
  const processFrame = async () => {
    if (poseRef.current && video && isRunning()) {
      try {
        await poseRef.current.send({ image: video })
      } catch {}
      loopRef.current = requestAnimationFrame(processFrame)
    }
  }
  loopRef.current = requestAnimationFrame(processFrame)
}
