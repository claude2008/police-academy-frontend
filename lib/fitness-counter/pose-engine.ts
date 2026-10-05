import {
  DEFAULT_FRAME,
  DESKTOP_CAMERA_IDEAL,
  LANDMARK_STYLE,
  MOBILE_BREAKPOINT_PX,
  MODEL_PATH,
  PHONE_CAMERA_IDEAL_LANDSCAPE,
  PHONE_CAMERA_IDEAL_PORTRAIT,
  POSE_INIT_TIMEOUT_MS,
  POSE_MIN_POSE_DETECTION_CONFIDENCE,
  POSE_MIN_POSE_PRESENCE_CONFIDENCE,
  POSE_MIN_TRACKING_CONFIDENCE,
  POSE_NUM_POSES,
  SKELETON_STYLE,
  WASM_PATH,
} from "./constants"
import type { PoseLandmarker } from "@mediapipe/tasks-vision"
import { overlayLineWidth, overlayPointRadius, type SkeletonDrawer } from "./drawing"
import type { FacingMode, Landmark, PoseDelegate, PoseResults, Ref } from "./types"

export type { SkeletonDrawer }

export type PoseRuntime = {
  landmarker: PoseLandmarker
  delegate: PoseDelegate
  drawSkeleton: SkeletonDrawer
}

const withTimeout = (work: Promise<PoseLandmarker>, ms: number): Promise<PoseLandmarker> => {
  let timedOut = false
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true
      reject(new Error("init timeout"))
    }, ms)
  })
  work.then(
    (landmarker) => {
      if (timedOut) landmarker.close()
    },
    () => {}
  )
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer))
}

/** One blank frame so the first real frame is not the one that compiles the model. */
const warmup = (landmarker: PoseLandmarker) => {
  const canvas = document.createElement("canvas")
  canvas.width = DEFAULT_FRAME.width
  canvas.height = DEFAULT_FRAME.height
  landmarker.detectForVideo(canvas, performance.now())
}

const toLandmarks = (raw: { x: number; y: number; z?: number; visibility?: number }[] | undefined): Landmark[] | undefined => {
  if (!raw || raw.length === 0) return undefined
  return raw.map((l) => ({ x: l.x, y: l.y, z: l.z, visibility: l.visibility }))
}

/**
 * Loads tasks-vision on demand, from wasm and the model on this origin.
 * Tries the GPU delegate and falls back to CPU if creation or warmup fails.
 */
export const createPoseRuntime = async (): Promise<PoseRuntime> => {
  const { DrawingUtils, FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision")
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH)

  const drawSkeleton: SkeletonDrawer = (ctx, landmarks, scale) => {
    const utils = new DrawingUtils(ctx)
    const points = landmarks.map((l) => ({
      x: l.x,
      y: l.y,
      z: l.z ?? 0,
      visibility: l.visibility ?? 0,
    }))
    utils.drawConnectors(points, PoseLandmarker.POSE_CONNECTIONS, {
      color: SKELETON_STYLE.color,
      lineWidth: overlayLineWidth(scale),
    })
    utils.drawLandmarks(points, {
      color: LANDMARK_STYLE.color,
      lineWidth: LANDMARK_STYLE.lineWidth * scale,
      radius: overlayPointRadius(scale),
    })
  }

  const create = async (delegate: PoseDelegate): Promise<PoseLandmarker> => {
    const landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate },
      runningMode: "VIDEO",
      numPoses: POSE_NUM_POSES,
      minPoseDetectionConfidence: POSE_MIN_POSE_DETECTION_CONFIDENCE,
      minPosePresenceConfidence: POSE_MIN_POSE_PRESENCE_CONFIDENCE,
      minTrackingConfidence: POSE_MIN_TRACKING_CONFIDENCE,
      outputSegmentationMasks: false,
    })
    try {
      warmup(landmarker)
    } catch (err) {
      landmarker.close()
      throw err
    }
    return landmarker
  }

  try {
    const landmarker = await withTimeout(create("GPU"), POSE_INIT_TIMEOUT_MS)
    return { landmarker, delegate: "GPU", drawSkeleton }
  } catch (err) {
    console.warn("GPU delegate failed, falling back to CPU", err)
    const landmarker = await withTimeout(create("CPU"), POSE_INIT_TIMEOUT_MS)
    return { landmarker, delegate: "CPU", drawSkeleton }
  }
}

export const getVideoConstraints = (facing: FacingMode) => {
  const isPhone = typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT_PX
  const portrait = typeof window !== "undefined" && window.innerHeight > window.innerWidth
  const ideal = !isPhone
    ? DESKTOP_CAMERA_IDEAL
    : portrait
      ? PHONE_CAMERA_IDEAL_PORTRAIT
      : PHONE_CAMERA_IDEAL_LANDSCAPE
  return {
    video: {
      width: { ideal: ideal.width },
      height: { ideal: ideal.height },
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

export const closeLandmarker = (landmarkerRef: Ref<PoseLandmarker | null>) => {
  if (landmarkerRef.current) {
    try {
      landmarkerRef.current.close()
    } catch {}
    landmarkerRef.current = null
  }
}

export const cancelFrameLoop = (loopRef: Ref<number | null>) => {
  if (loopRef.current != null) {
    cancelAnimationFrame(loopRef.current)
    loopRef.current = null
  }
}

/** One frame at a time. Stops when the landmarker is gone or `isRunning()` is false. */
export const startFrameLoop = (
  video: HTMLVideoElement,
  landmarkerRef: Ref<PoseLandmarker | null>,
  loopRef: Ref<number | null>,
  isRunning: () => boolean,
  onFrame: (results: PoseResults) => void
) => {
  cancelFrameLoop(loopRef)
  const processFrame = () => {
    const landmarker = landmarkerRef.current
    if (landmarker && video && isRunning()) {
      if (video.readyState >= 2) {
        try {
          const result = landmarker.detectForVideo(video, performance.now())
          onFrame({ image: video, poseLandmarks: toLandmarks(result.landmarks[0]) })
        } catch {}
      }
      loopRef.current = requestAnimationFrame(processFrame)
    }
  }
  loopRef.current = requestAnimationFrame(processFrame)
}
