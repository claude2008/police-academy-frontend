import { DEFAULT_FRAME, GROUND_REF_OFFSET, MIN_SHOULDER_WIDTH } from "./constants"
import {
  LM,
  calculateAngle,
  distanceBetween,
  getBestSide,
  toPixelLandmarks,
  type FrameSize,
} from "./counting"
import type { Exercise, Landmark, Point, PoseResults, PushupThresholds, SitupThresholds } from "./types"

/** On-screen sizes in CSS pixels. Multiplied by the canvas-to-screen scale when drawing. */
const LINE_CSS = 2.5
const POINT_CSS = 4
const ARC_RADIUS_CSS = 26
const ARC_LINE_CSS = 3
const FONT_CSS = 15
const OK_COLOR = "#22c55e"
const AMBER_COLOR = "#f59e0b"

/** Draws connectors and landmark dots. Supplied by the pose engine (tasks-vision DrawingUtils). */
export type SkeletonDrawer = (
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  scale: number
) => void

export type AngleGuide = {
  exercise: Exercise | null
  pushup: PushupThresholds
  situp: SitupThresholds
  mirrored: boolean
}

type JointMark = { at: Point; from: Point; to: Point; angle: number; ok: boolean }

/** Canvas pixels per CSS pixel, accounting for object-contain letterboxing. */
export const canvasPixelsPerCss = (canvas: HTMLCanvasElement) => {
  const boxW = canvas.clientWidth
  const boxH = canvas.clientHeight
  if (!boxW || !boxH || !canvas.width || !canvas.height) return 1
  const fit = Math.min(boxW / canvas.width, boxH / canvas.height)
  return fit > 0 ? 1 / fit : 1
}

const shoulderWidthOk = (pixels: Landmark[], frame: FrameSize) => {
  const lShoulder = pixels[LM.leftShoulder]
  const rShoulder = pixels[LM.rightShoulder]
  if (!lShoulder || !rShoulder) return false
  return distanceBetween(lShoulder, rShoulder) >= MIN_SHOULDER_WIDTH * frame.width
}

const jointMarks = (landmarks: Landmark[], frame: FrameSize, guide: AngleGuide): JointMark[] => {
  if (!guide.exercise) return []
  const pixels = toPixelLandmarks(landmarks, frame)
  const s = getBestSide(pixels)
  const shoulder = pixels[s.shoulder]
  const elbow = pixels[s.elbow]
  const wrist = pixels[s.wrist]
  const hip = pixels[s.hip]
  const knee = pixels[s.knee]
  const ankle = pixels[s.ankle]
  if (!shoulder || !hip || !knee || !ankle) return []

  const kneeAngle = calculateAngle(hip, knee, ankle)
  const hipAngle = calculateAngle(shoulder, hip, knee)

  if (guide.exercise === "pushup") {
    if (!elbow || !wrist) return []
    const t = guide.pushup
    const kneeOk = kneeAngle > t.knee
    const hipOk = hipAngle > t.hip
    return [
      { at: elbow, from: shoulder, to: wrist, angle: calculateAngle(shoulder, elbow, wrist), ok: kneeOk && hipOk },
      { at: knee, from: hip, to: ankle, angle: kneeAngle, ok: kneeOk },
      { at: hip, from: shoulder, to: knee, angle: hipAngle, ok: hipOk },
    ]
  }

  const t = guide.situp
  const kneeOk = kneeAngle <= t.kneeMax
  const torsoLength = distanceBetween(shoulder, hip)
  const drop = Math.max(torsoLength, frame.height * GROUND_REF_OFFSET)
  const groundRef = { x: hip.x, y: hip.y + drop }
  return [
    {
      at: hip,
      from: shoulder,
      to: groundRef,
      angle: calculateAngle(shoulder, hip, groundRef),
      ok: kneeOk && shoulderWidthOk(pixels, frame),
    },
    { at: knee, from: hip, to: ankle, angle: kneeAngle, ok: kneeOk },
  ]
}

const drawJoint = (
  ctx: CanvasRenderingContext2D,
  joint: JointMark,
  scale: number,
  mirrored: boolean
) => {
  const radius = ARC_RADIUS_CSS * scale
  const start = Math.atan2(joint.from.y - joint.at.y, joint.from.x - joint.at.x)
  const end = Math.atan2(joint.to.y - joint.at.y, joint.to.x - joint.at.x)
  let sweep = end - start
  while (sweep > Math.PI) sweep -= 2 * Math.PI
  while (sweep < -Math.PI) sweep += 2 * Math.PI
  const color = joint.ok ? OK_COLOR : AMBER_COLOR

  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth = ARC_LINE_CSS * scale
  ctx.arc(joint.at.x, joint.at.y, radius, start, start + sweep, sweep < 0)
  ctx.stroke()

  const mid = start + sweep / 2
  const labelAt = radius + 14 * scale
  const x = joint.at.x + Math.cos(mid) * labelAt
  const y = joint.at.y + Math.sin(mid) * labelAt
  const text = `${Math.round(joint.angle)}°`
  ctx.save()
  ctx.translate(x, y)
  if (mirrored) ctx.scale(-1, 1)
  ctx.font = `700 ${Math.round(FONT_CSS * scale)}px sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.lineWidth = 4 * scale
  ctx.strokeStyle = "rgba(0,0,0,0.7)"
  ctx.strokeText(text, 0, 0)
  ctx.fillStyle = color
  ctx.fillText(text, 0, 0)
  ctx.restore()
}

/** Paints the camera frame, then the skeleton and the counting-joint arcs. */
export const drawPoseFrame = (
  canvas: HTMLCanvasElement | null,
  video: HTMLVideoElement,
  results: PoseResults,
  drawSkeleton: SkeletonDrawer | null,
  guide: AngleGuide | null
) => {
  const ctx = canvas?.getContext("2d")
  if (!canvas || !ctx) return
  const w = video.videoWidth || DEFAULT_FRAME.width
  const h = video.videoHeight || DEFAULT_FRAME.height
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height)
  if (!results.poseLandmarks) return
  const scale = canvasPixelsPerCss(canvas)
  if (drawSkeleton) drawSkeleton(ctx, results.poseLandmarks, scale)
  if (!guide?.exercise) return
  const frame = results.frame ?? { width: w, height: h }
  for (const joint of jointMarks(results.poseLandmarks, frame, guide)) {
    drawJoint(ctx, joint, scale, guide.mirrored)
  }
}

export const overlayLineWidth = (scale: number) => LINE_CSS * scale
export const overlayPointRadius = (scale: number) => POINT_CSS * scale
