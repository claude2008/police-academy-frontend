import {
  CHEST_CENTER_RATIO,
  GROUND_REF_OFFSET,
  ATTEMPT_MIN_SWING_DEG,
  HAND_FAIL_WARN_FRAMES,
  JUMP_FILTER_DEG,
  JUMP_FILTER_MAX_FRAMES,
  JUMP_FILTER_RECOVER_MS,
  MAX_ATTEMPTS,
  MIN_SHOULDER_WIDTH,
  TRACKING_LOSS_DEG,
  VISIBILITY_MIN,
  WARNINGS,
} from "./constants"
import type {
  Attempt,
  Exercise,
  Landmark,
  Point,
  PushupThresholds,
  SitupThresholds,
} from "./types"

// MediaPipe Pose landmark indices
export const LM = {
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
} as const

export type SideIndices = {
  shoulder: number
  elbow: number
  wrist: number
  hip: number
  knee: number
  ankle: number
}

export const RIGHT_SIDE: SideIndices = { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28 }
export const LEFT_SIDE: SideIndices = { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 }

// ---------- Geometry ----------

export const calculateAngle = (a?: Point | null, b?: Point | null, c?: Point | null): number => {
  if (!a || !b || !c) return 0
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x)
  let angle = Math.abs(radians * 180.0 / Math.PI)
  if (angle > 180.0) angle = 360 - angle
  return angle
}

export const distanceBetween = (a: Point, b: Point): number => {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2))
}

/** Image size in pixels. A 1×1 frame leaves normalized coordinates unchanged. */
export type FrameSize = { width: number; height: number }

export const UNIT_FRAME: FrameSize = { width: 1, height: 1 }

/** Normalized MediaPipe coordinates → pixels, so angles do not depend on the frame aspect ratio. */
export const toPixelLandmarks = (landmarks: Landmark[], frame: FrameSize): Landmark[] =>
  landmarks.map((landmark) =>
    landmark ? { ...landmark, x: landmark.x * frame.width, y: landmark.y * frame.height } : landmark
  )

// ---------- Side selection and visibility ----------

export const getBestSide = (landmarks: Landmark[]): SideIndices => {
  const left  = [11, 23, 25, 27].reduce((s, i) => s + (landmarks[i]?.visibility || 0), 0)
  const right = [12, 24, 26, 28].reduce((s, i) => s + (landmarks[i]?.visibility || 0), 0)
  return right >= left ? RIGHT_SIDE : LEFT_SIDE
}

export const isBodyVisible = (landmarks: Landmark[] | null | undefined): boolean => {
  if (!landmarks) return false
  const s = getBestSide(landmarks)
  return [s.shoulder, s.hip, s.knee, s.ankle].every(
    (i) => (landmarks[i]?.visibility || 0) > VISIBILITY_MIN
  )
}

export const isBodyStraight = (
  landmarks: Landmark[] | null | undefined,
  t: { knee: number; hip: number }
): boolean => {
  if (!landmarks) return false
  const s = getBestSide(landmarks)
  const knee = calculateAngle(landmarks[s.hip], landmarks[s.knee], landmarks[s.ankle])
  const hip  = calculateAngle(landmarks[s.shoulder], landmarks[s.hip], landmarks[s.knee])
  return knee > t.knee && hip > t.hip
}

// ---------- Rep detection ----------

export type RepCounterState = {
  reps: number
  phase: "down" | "up" | null
  lastRepTime: number
  lastValidAngle: number | null
  handFailFrames: number
  /** Consecutive frames whose angle was past the jump limit. */
  jumpRun: number
  /** Timestamp of the first frame in the current jump run. */
  jumpSince: number | null
}

export const createRepCounterState = (): RepCounterState => ({
  reps: 0,
  phase: null,
  lastRepTime: 0,
  lastValidAngle: null,
  handFailFrames: 0,
  jumpRun: 0,
  jumpSince: null,
})

export const resetAngleTracking = (state: RepCounterState) => {
  state.lastValidAngle = null
  state.jumpRun = 0
  state.jumpSince = null
}

/**
 * Result of one active-stage frame.
 * `warning` is the final on-screen warning for the frame ("" = none).
 * `angle` is the accepted exercise angle, or null when a gate or the jump filter dropped the frame.
 */
export type FrameOutcome = {
  warning: string
  angle: number | null
  counted: boolean
  skippedJump: boolean
}

const gated = (warning: string, angle: number | null = null): FrameOutcome => ({
  warning,
  angle,
  counted: false,
  skippedJump: false,
})

const SKIPPED_JUMP: FrameOutcome = { warning: "", angle: null, counted: false, skippedJump: true }

/**
 * Returns a skip outcome when the angle jumped more than JUMP_FILTER_DEG.
 * A jump that lasts more than JUMP_FILTER_MAX_FRAMES frames, or longer than
 * JUMP_FILTER_RECOVER_MS, is accepted and becomes the new baseline.
 */
const rejectJump = (state: RepCounterState, angle: number, now: number): FrameOutcome | null => {
  const baseline = state.lastValidAngle
  if (baseline === null || Math.abs(angle - baseline) <= JUMP_FILTER_DEG) {
    state.jumpRun = 0
    state.jumpSince = null
    return null
  }
  if (state.jumpSince == null) state.jumpSince = now
  state.jumpRun += 1
  const elapsed = now - state.jumpSince
  if (state.jumpRun > JUMP_FILTER_MAX_FRAMES || elapsed > JUMP_FILTER_RECOVER_MS) {
    state.jumpRun = 0
    state.jumpSince = null
    return null
  }
  return SKIPPED_JUMP
}

const tryCountRep = (state: RepCounterState, now: number, cooldownMs: number): boolean => {
  if (now - state.lastRepTime < cooldownMs) return false
  state.lastRepTime = now
  state.phase = "up"
  state.reps += 1
  return true
}

export const detectPushupFrame = (
  state: RepCounterState,
  landmarks: Landmark[],
  t: PushupThresholds,
  now: number,
  frame: FrameSize = UNIT_FRAME
): FrameOutcome => {
  const pixels = toPixelLandmarks(landmarks, frame)
  const s = getBestSide(pixels)
  const angle = calculateAngle(pixels[s.shoulder], pixels[s.elbow], pixels[s.wrist])
  // Form failures still expose the elbow angle for the attempt log. Phase and reps stay untouched.
  if (!isBodyStraight(pixels, t)) return gated(WARNINGS.bodyNotStraight, angle)
  if (rejectJump(state, angle, now)) return SKIPPED_JUMP
  state.lastValidAngle = angle

  let counted = false
  if (angle < t.elbowDown) {
    state.phase = "down"
  } else if (angle > t.elbowUp && state.phase === "down") {
    counted = tryCountRep(state, now, t.cooldownMs)
  }
  return { warning: "", angle, counted, skippedJump: false }
}

export const detectSitupFrame = (
  state: RepCounterState,
  landmarks: Landmark[],
  t: SitupThresholds,
  now: number,
  frame: FrameSize = UNIT_FRAME
): FrameOutcome => {
  const pixels = toPixelLandmarks(landmarks, frame)
  const s = getBestSide(pixels)
  const hip = pixels[s.hip]
  const shoulder = pixels[s.shoulder]
  const torsoLength = distanceBetween(shoulder, hip)
  const drop = Math.max(torsoLength, frame.height * GROUND_REF_OFFSET)
  const groundRef = { x: hip.x, y: hip.y + drop }
  const angle = calculateAngle(shoulder, hip, groundRef)

  const kneeAngle = calculateAngle(pixels[s.hip], pixels[s.knee], pixels[s.ankle])
  // Form failures still expose the torso angle for the attempt log. Phase and reps stay untouched.
  if (kneeAngle > t.kneeMax) return gated(WARNINGS.kneesStraight, angle)

  const lShoulder = pixels[LM.leftShoulder]
  const rShoulder = pixels[LM.rightShoulder]
  const shoulderWidth = distanceBetween(lShoulder, rShoulder)
  // 0.02 meant 2% of the frame; compare against the frame width in pixels.
  if (shoulderWidth < MIN_SHOULDER_WIDTH * frame.width) return gated(WARNINGS.comeCloser, angle)

  const midShoulder = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 }
  const lHip = pixels[LM.leftHip]
  const rHip = pixels[LM.rightHip]
  const midHip = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 }
  const chestCenter = {
    x: midShoulder.x + (midHip.x - midShoulder.x) * CHEST_CENTER_RATIO,
    y: midShoulder.y + (midHip.y - midShoulder.y) * CHEST_CENTER_RATIO,
  }

  const maxHandDist = shoulderWidth * t.handRatio
  const anchorPoints = [pixels[LM.leftEar], pixels[LM.rightEar], lShoulder, rShoulder, chestCenter]
  const handsInPosition = [LM.leftWrist, LM.rightWrist].every((w) =>
    anchorPoints.some((an) => distanceBetween(pixels[w], an) < maxHandDist)
  )
  if (!handsInPosition) {
    state.handFailFrames += 1
    return gated(state.handFailFrames > HAND_FAIL_WARN_FRAMES ? WARNINGS.handsPosition : "", angle)
  }
  state.handFailFrames = 0

  if (rejectJump(state, angle, now)) return SKIPPED_JUMP
  state.lastValidAngle = angle

  let counted = false
  if (angle > t.down) {
    state.phase = "down"
  } else if (angle < t.up && state.phase === "down") {
    counted = tryCountRep(state, now, t.cooldownMs)
  }
  return { warning: "", angle, counted, skippedJump: false }
}

export const detectRepFrame = (
  exercise: Exercise | null,
  state: RepCounterState,
  landmarks: Landmark[],
  thresholds: { pushup: PushupThresholds; situp: SitupThresholds },
  now: number,
  frame: FrameSize = UNIT_FRAME
): FrameOutcome => {
  if (!exercise || !isBodyVisible(landmarks)) return gated(WARNINGS.bodyNotVisible)
  return exercise === "pushup"
    ? detectPushupFrame(state, landmarks, thresholds.pushup, now, frame)
    : detectSitupFrame(state, landmarks, thresholds.situp, now, frame)
}

// ---------- Attempts log (counted + rejected attempts, diagnostics) ----------

export type AttemptLog = {
  attempts: Attempt[]
  lastAngle: number | null
  trackingLoss: number
  skippedJumps: number
  /** Highest resting angle. A descent is a fall of at least ATTEMPT_MIN_SWING_DEG from here. */
  origin: number | null
  /** Lowest angle of the open descent. Null while no movement is open. */
  bottom: number | null
  /** Highest angle reached on the way back up. */
  returnPeak: number | null
  returning: boolean
}

export const createAttemptLog = (): AttemptLog => ({
  attempts: [],
  lastAngle: null,
  trackingLoss: 0,
  skippedJumps: 0,
  origin: null,
  bottom: null,
  returnPeak: null,
  returning: false,
})

export const resetAttemptLog = (log: AttemptLog) => {
  Object.assign(log, createAttemptLog())
}

export const noteSkippedJump = (log: AttemptLog) => {
  log.skippedJumps += 1
}

const pushAttempt = (log: AttemptLog, entry: Attempt) => {
  log.attempts.push(entry)
  if (log.attempts.length > MAX_ATTEMPTS) {
    log.attempts.splice(0, log.attempts.length - MAX_ATTEMPTS)
  }
}

const restAt = (log: AttemptLog, angle: number) => {
  log.origin = angle
  log.bottom = null
  log.returnPeak = null
  log.returning = false
}

export type RecordResult = {
  rounded: number
  trackingLossChanged: boolean
  attemptsChanged: boolean
}

/**
 * Logs one counting angle. `at` is ms since session start.
 * Descent is a falling angle (push-up elbow, and the sit-up torso motion that completes a rep).
 * نزول is that low point. صعود is how high the return got, or the high point a counted
 * sit-up descended from when the rep is counted before a return.
 * One movement becomes one row: ✅ when a rep is counted, ❌ when the angle reverses
 * again by ATTEMPT_MIN_SWING_DEG without a count.
 */
export const recordAngle = (
  log: AttemptLog,
  angle: number,
  counted: boolean,
  at: number
): RecordResult => {
  const rounded = Math.round(angle)
  let trackingLossChanged = false
  if (log.lastAngle != null && Math.abs(rounded - log.lastAngle) > TRACKING_LOSS_DEG) {
    log.trackingLoss += 1
    trackingLossChanged = true
  }
  log.lastAngle = rounded

  if (log.origin == null) log.origin = angle

  if (!counted && log.bottom == null) {
    if (angle > log.origin) log.origin = angle
    if (log.origin - angle >= ATTEMPT_MIN_SWING_DEG) log.bottom = angle
    return { rounded, trackingLossChanged, attemptsChanged: false }
  }

  if (log.bottom != null && !log.returning && angle < log.bottom) log.bottom = angle
  if (log.bottom != null && !log.returning && angle - log.bottom >= ATTEMPT_MIN_SWING_DEG) {
    log.returning = true
    log.returnPeak = angle
  } else if (log.returning && angle > (log.returnPeak ?? angle)) {
    log.returnPeak = angle
  }

  if (counted) {
    const bottom = log.bottom ?? angle
    const top = log.returning ? (log.returnPeak ?? angle) : log.origin
    pushAttempt(log, {
      bottom: Math.round(bottom),
      top: Math.round(top),
      counted: true,
      at,
    })
    restAt(log, angle)
    return { rounded, trackingLossChanged, attemptsChanged: true }
  }

  if (log.returning && (log.returnPeak ?? angle) - angle >= ATTEMPT_MIN_SWING_DEG) {
    const bottom = log.bottom ?? angle
    const top = log.returnPeak ?? angle
    pushAttempt(log, {
      bottom: Math.round(bottom),
      top: Math.round(top),
      counted: false,
      at,
    })
    log.origin = top
    log.bottom = angle
    log.returnPeak = null
    log.returning = false
    return { rounded, trackingLossChanged, attemptsChanged: true }
  }

  return { rounded, trackingLossChanged, attemptsChanged: false }
}
