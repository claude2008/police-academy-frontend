import { DEFAULT_FRAME, LANDMARK_STYLE, SKELETON_STYLE } from "./constants"
import type { PoseResults } from "./types"

/** Paints the camera frame plus the MediaPipe skeleton (drawing_utils globals from the CDN script). */
export const drawPoseFrame = (
  canvas: HTMLCanvasElement | null,
  video: HTMLVideoElement,
  results: PoseResults
) => {
  const ctx = canvas?.getContext("2d")
  if (!canvas || !ctx) return
  canvas.width = video.videoWidth || DEFAULT_FRAME.width
  canvas.height = video.videoHeight || DEFAULT_FRAME.height
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height)
  if (!results.poseLandmarks) return
  const drawingUtils = window as any
  if (drawingUtils.drawConnectors && drawingUtils.drawLandmarks) {
    drawingUtils.drawConnectors(ctx, results.poseLandmarks, drawingUtils.POSE_CONNECTIONS, { ...SKELETON_STYLE })
    drawingUtils.drawLandmarks(ctx, results.poseLandmarks, { ...LANDMARK_STYLE })
  }
}
