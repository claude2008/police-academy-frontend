import { DEFAULT_FRAME, LANDMARK_STYLE, SKELETON_STYLE } from "./constants"
import type { Landmark, PoseResults } from "./types"

/** Draws connectors and landmark dots. Supplied by the pose engine (tasks-vision DrawingUtils). */
export type SkeletonDrawer = (ctx: CanvasRenderingContext2D, landmarks: Landmark[]) => void

/** Paints the camera frame, then the skeleton: green connections, red points, all landmarks. */
export const drawPoseFrame = (
  canvas: HTMLCanvasElement | null,
  video: HTMLVideoElement,
  results: PoseResults,
  drawSkeleton: SkeletonDrawer | null
) => {
  const ctx = canvas?.getContext("2d")
  if (!canvas || !ctx) return
  canvas.width = video.videoWidth || DEFAULT_FRAME.width
  canvas.height = video.videoHeight || DEFAULT_FRAME.height
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height)
  if (results.poseLandmarks && drawSkeleton) {
    drawSkeleton(ctx, results.poseLandmarks)
  }
}
