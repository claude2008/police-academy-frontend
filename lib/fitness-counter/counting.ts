import {
  CHEST_CENTER_RATIO,
  GROUND_REF_OFFSET,
  HAND_FAIL_WARN_FRAMES,
  INITIAL_MIN_ANGLE,
  JUMP_FILTER_DEG,
  MAX_ATTEMPTS,
  MERGE_BOTTOM_TOLERANCE_DEG,
  MERGE_WINDOW_MS,
  MIN_SHOULDER_WIDTH,
  REJECT_MIN_DEPTH_DEG,
  SITUP_REJECT_ASCENT_DEG,
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
}

export const createRepCounterState = (): RepCounterState => ({
  reps: 0,
  phase: null,
  lastRepTime: 0,
  lastValidAngle: null,
  handFailFrames: 0,
})

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

const gated = (warning: string): FrameOutcome => ({ warning, angle: null, counted: false, skippedJump: false })

const SKIPPED_JUMP: FrameOutcome = { warning: "", angle: null, counted: false, skippedJump: true }

/** True when the angle jumped too far from the last accepted one; the frame must be skipped. */
const isImpossibleJump = (state: RepCounterState, angle: number) =>
  state.lastValidAngle !== null && Math.abs(angle - state.lastValidAngle) > JUMP_FILTER_DEG

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
  now: number
): FrameOutcome => {
  if (!isBodyStraight(landmarks, t)) return gated(WARNINGS.bodyNotStraight)

  const s = getBestSide(landmarks)
  const angle = calculateAngle(landmarks[s.shoulder], landmarks[s.elbow], landmarks[s.wrist])
  if (isImpossibleJump(state, angle)) return SKIPPED_JUMP
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
  now: number
): FrameOutcome => {
  const s = getBestSide(landmarks)

  const kneeAngle = calculateAngle(landmarks[s.hip], landmarks[s.knee], landmarks[s.ankle])
  if (kneeAngle > t.kneeMax) return gated(WARNINGS.kneesStraight)

  const lShoulder = landmarks[LM.leftShoulder]
  const rShoulder = landmarks[LM.rightShoulder]
  const shoulderWidth = distanceBetween(lShoulder, rShoulder)
  if (shoulderWidth < MIN_SHOULDER_WIDTH) return gated(WARNINGS.comeCloser)

  const midShoulder = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 }
  const lHip = landmarks[LM.leftHip]
  const rHip = landmarks[LM.rightHip]
  const midHip = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 }
  const chestCenter = {
    x: midShoulder.x + (midHip.x - midShoulder.x) * CHEST_CENTER_RATIO,
    y: midShoulder.y + (midHip.y - midShoulder.y) * CHEST_CENTER_RATIO,
  }

  const maxHandDist = shoulderWidth * t.handRatio
  const anchorPoints = [landmarks[LM.leftEar], landmarks[LM.rightEar], lShoulder, rShoulder, chestCenter]
  const handsInPosition = [LM.leftWrist, LM.rightWrist].every((w) =>
    anchorPoints.some((an) => distanceBetween(landmarks[w], an) < maxHandDist)
  )
  if (!handsInPosition) {
    state.handFailFrames += 1
    return gated(state.handFailFrames > HAND_FAIL_WARN_FRAMES ? WARNINGS.handsPosition : "")
  }
  state.handFailFrames = 0

  const hip = landmarks[s.hip]
  const groundRef = { x: hip.x, y: hip.y + GROUND_REF_OFFSET }
  const angle = calculateAngle(landmarks[s.shoulder], hip, groundRef)
  if (isImpossibleJump(state, angle)) return SKIPPED_JUMP
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
  now: number
): FrameOutcome => {
  if (!exercise || !isBodyVisible(landmarks)) return gated(WARNINGS.bodyNotVisible)
  return exercise === "pushup"
    ? detectPushupFrame(state, landmarks, thresholds.pushup, now)
    : detectSitupFrame(state, landmarks, thresholds.situp, now)
}

// ---------- Attempts log (counted + rejected attempts, diagnostics) ----------

export type AttemptLog = {
  attempts: Attempt[]
  currentMin: number
  currentMax: number
  lastAngle: number | null
  rejectArmed: boolean
  rejectMin: number
  trackingLoss: number
  skippedJumps: number
}

export const createAttemptLog = (): AttemptLog => ({
  attempts: [],
  currentMin: INITIAL_MIN_ANGLE,
  currentMax: 0,
  lastAngle: null,
  rejectArmed: false,
  rejectMin: INITIAL_MIN_ANGLE,
  trackingLoss: 0,
  skippedJumps: 0,
})

export const resetAttemptLog = (log: AttemptLog) => {
  Object.assign(log, createAttemptLog())
}

export const noteSkippedJump = (log: AttemptLog) => {
  log.skippedJumps += 1
}

/** Push-ups re-arm rejection below elbowUp; sit-ups use a fixed threshold regardless of preset. */
export const getRejectAscentThreshold = (exercise: Exercise | null, pushup: PushupThresholds) =>
  exercise === "situp" ? SITUP_REJECT_ASCENT_DEG : pushup.elbowUp

const pushAttempt = (log: AttemptLog, entry: Attempt) => {
  log.attempts.push(entry)
  if (log.attempts.length > MAX_ATTEMPTS) {
    log.attempts.splice(0, log.attempts.length - MAX_ATTEMPTS)
  }
}

export type RecordResult = {
  rounded: number
  trackingLossChanged: boolean
  attemptsChanged: boolean
}

/**
 * Logs one accepted angle. `at` is ms since session start.
 * Counted frames close the current attempt; otherwise a dip below `rejectThreshold`
 * that recovers is logged as a rejected attempt when it went at least REJECT_MIN_DEPTH_DEG deep.
 */
export const recordAngle = (
  log: AttemptLog,
  angle: number,
  counted: boolean,
  at: number,
  rejectThreshold: number
): RecordResult => {
  const rounded = Math.round(angle)
  let trackingLossChanged = false
  if (log.lastAngle != null && Math.abs(rounded - log.lastAngle) > TRACKING_LOSS_DEG) {
    log.trackingLoss += 1
    trackingLossChanged = true
  }
  log.lastAngle = rounded

  log.currentMin = Math.min(log.currentMin, angle)
  log.currentMax = Math.max(log.currentMax, angle)

  if (counted) {
    const entry: Attempt = {
      bottom: Math.round(log.currentMin),
      top: Math.round(log.currentMax),
      counted: true,
      at,
    }
    const last = log.attempts[log.attempts.length - 1]
    if (
      last &&
      last.counted === false &&
      Math.abs(last.bottom - entry.bottom) <= MERGE_BOTTOM_TOLERANCE_DEG &&
      Math.abs(at - last.at) <= MERGE_WINDOW_MS
    ) {
      log.attempts[log.attempts.length - 1] = entry
    } else {
      pushAttempt(log, entry)
    }
    log.currentMin = INITIAL_MIN_ANGLE
    log.currentMax = 0
    log.rejectArmed = false
    log.rejectMin = INITIAL_MIN_ANGLE
    return { rounded, trackingLossChanged, attemptsChanged: true }
  }

  let attemptsChanged = false
  if (angle < rejectThreshold) {
    log.rejectArmed = true
    log.rejectMin = Math.min(log.rejectMin, angle)
  } else if (angle > rejectThreshold && log.rejectArmed) {
    if (log.rejectMin <= rejectThreshold - REJECT_MIN_DEPTH_DEG) {
      pushAttempt(log, {
        bottom: Math.round(log.rejectMin),
        top: null,
        counted: false,
        at,
      })
      attemptsChanged = true
    }
    log.rejectArmed = false
    log.rejectMin = INITIAL_MIN_ANGLE
  }
  return { rounded, trackingLossChanged, attemptsChanged }
}
