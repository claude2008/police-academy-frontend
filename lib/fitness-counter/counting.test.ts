import { describe, expect, it } from "vitest"
import { MAX_ATTEMPTS, PRESETS, SITUP_PRESETS, WARNINGS } from "./constants"
import {
  LEFT_SIDE,
  RIGHT_SIDE,
  calculateAngle,
  createAttemptLog,
  createRepCounterState,
  detectRepFrame,
  getBestSide,
  getRejectAscentThreshold,
  isBodyVisible,
  noteSkippedJump,
  recordAngle,
  resetAttemptLog,
  type AttemptLog,
  type FrameOutcome,
  type RepCounterState,
  type SideIndices,
} from "./counting"
import type { Exercise, Landmark, Point } from "./types"

// ---------- Synthetic pose builders ----------

const VIS = 0.9
const THRESHOLDS = { pushup: PRESETS.normal, situp: SITUP_PRESETS.normal }

const blankPose = (): Landmark[] =>
  Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }))

/** Returns c such that calculateAngle(a, b, c) === deg. */
const place = (b: Point, a: Point, deg: number, len: number): Point => {
  const r = Math.atan2(a.y - b.y, a.x - b.x) + (deg * Math.PI) / 180
  return { x: b.x + len * Math.cos(r), y: b.y + len * Math.sin(r) }
}

const put = (lm: Landmark[], i: number, p: Point, visibility = VIS) => {
  lm[i] = { x: p.x, y: p.y, visibility }
}

/** Side-view push-up: elbow angle = shoulder-elbow-wrist, hip = shoulder-hip-knee, knee = hip-knee-ankle. */
const pushupPose = ({
  elbow,
  hip = 180,
  knee = 180,
  side = RIGHT_SIDE,
  kneeVisibility = VIS,
}: {
  elbow: number
  hip?: number
  knee?: number
  side?: SideIndices
  kneeVisibility?: number
}): Landmark[] => {
  const lm = blankPose()
  const shoulder = { x: 0.3, y: 0.5 }
  const hipP = { x: 0.5, y: 0.5 }
  const kneeP = place(hipP, shoulder, hip, 0.15)
  const ankle = place(kneeP, hipP, knee, 0.15)
  const elbowP = { x: 0.3, y: 0.6 }
  const wrist = place(elbowP, shoulder, elbow, 0.1)
  put(lm, side.shoulder, shoulder)
  put(lm, side.hip, hipP)
  put(lm, side.knee, kneeP, kneeVisibility)
  put(lm, side.ankle, ankle)
  put(lm, side.elbow, elbowP)
  put(lm, side.wrist, wrist)
  return lm
}

/**
 * Sit-up seen from the right. `torso` = angle(shoulder, hip, point straight below hip):
 * ~90° torso horizontal, ~180° upright, <90° shoulders below hips.
 */
const situpPose = ({
  torso,
  knee = 90,
  shoulderWidth = 0.05,
  handsInPlace = true,
}: {
  torso: number
  knee?: number
  shoulderWidth?: number
  handsInPlace?: boolean
}): Landmark[] => {
  const lm = blankPose()
  const hip = { x: 0.5, y: 0.6 }
  const groundRef = { x: hip.x, y: hip.y + 0.3 }
  const rShoulder = place(hip, groundRef, torso, 0.2)
  const lShoulder = { x: rShoulder.x + shoulderWidth, y: rShoulder.y }
  const kneeP = { x: 0.7, y: 0.6 }
  const ankle = place(kneeP, hip, knee, 0.15)
  put(lm, 12, rShoulder)
  put(lm, 24, hip)
  put(lm, 26, kneeP)
  put(lm, 28, ankle)
  put(lm, 11, lShoulder)
  put(lm, 23, { x: hip.x + shoulderWidth, y: hip.y })
  put(lm, 7, { x: lShoulder.x, y: lShoulder.y - 0.05 })
  put(lm, 8, { x: rShoulder.x, y: rShoulder.y - 0.05 })
  if (handsInPlace) {
    put(lm, 15, lShoulder)
    put(lm, 16, rShoulder)
  } else {
    put(lm, 15, { x: 0, y: 0 })
    put(lm, 16, { x: 0.02, y: 0 })
  }
  return lm
}

type Frame = { lm: Landmark[]; at: number }

/** Feeds frames through detectRepFrame (and optionally the attempts log), like the page does. */
const run = (
  exercise: Exercise,
  frames: Frame[],
  state: RepCounterState = createRepCounterState(),
  log?: AttemptLog
) => {
  const outcomes: FrameOutcome[] = []
  for (const f of frames) {
    const o = detectRepFrame(exercise, state, f.lm, THRESHOLDS, f.at)
    if (log) {
      if (o.skippedJump) noteSkippedJump(log)
      if (o.angle != null) {
        recordAngle(log, o.angle, o.counted, f.at, getRejectAscentThreshold(exercise, THRESHOLDS.pushup))
      }
    }
    outcomes.push(o)
  }
  return { state, outcomes }
}

const pushupFrames = (angles: number[], start = 1000, step = 100): Frame[] =>
  angles.map((elbow, i) => ({ lm: pushupPose({ elbow }), at: start + i * step }))

const situpFrames = (angles: number[], start = 1000, step = 100): Frame[] =>
  angles.map((torso, i) => ({ lm: situpPose({ torso }), at: start + i * step }))

const FULL_PUSHUP = [170, 140, 110, 90, 120, 150, 170]

// ---------- Tests ----------

describe("calculateAngle", () => {
  it("measures the angle at the middle point in degrees (0–180)", () => {
    expect(calculateAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90)
    expect(calculateAngle({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(180)
    expect(calculateAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(45)
  })

  it("returns 0 when a point is missing", () => {
    expect(calculateAngle(undefined, { x: 0, y: 0 }, { x: 1, y: 1 })).toBe(0)
  })

  it("the test helper places points at the requested angle", () => {
    const b = { x: 0.5, y: 0.5 }
    const a = { x: 0.3, y: 0.5 }
    for (const deg of [30, 90, 135, 170]) {
      expect(calculateAngle(a, b, place(b, a, deg, 0.1))).toBeCloseTo(deg)
    }
  })
})

describe("side selection and visibility", () => {
  it("picks the right side when its visibility sum is higher", () => {
    expect(getBestSide(pushupPose({ elbow: 170, side: RIGHT_SIDE }))).toEqual(RIGHT_SIDE)
  })

  it("picks the left side when its visibility sum is higher", () => {
    expect(getBestSide(pushupPose({ elbow: 170, side: LEFT_SIDE }))).toEqual(LEFT_SIDE)
  })

  it("prefers the right side on a tie", () => {
    expect(getBestSide(blankPose())).toEqual(RIGHT_SIDE)
  })

  it("requires shoulder, hip, knee and ankle of the best side above 0.5 visibility", () => {
    expect(isBodyVisible(pushupPose({ elbow: 170 }))).toBe(true)
    expect(isBodyVisible(pushupPose({ elbow: 170, kneeVisibility: 0.5 }))).toBe(false)
    expect(isBodyVisible(null)).toBe(false)
  })

  it("counts push-ups using the left arm when the left side is visible", () => {
    const frames = FULL_PUSHUP.map((elbow, i) => ({
      lm: pushupPose({ elbow, side: LEFT_SIDE }),
      at: 1000 + i * 100,
    }))
    expect(run("pushup", frames).state.reps).toBe(1)
  })
})

describe("detectRepFrame — gates shared by both exercises", () => {
  it("warns and ignores the frame when the body is not fully visible", () => {
    const state = createRepCounterState()
    const o = detectRepFrame("pushup", state, pushupPose({ elbow: 90, kneeVisibility: 0.3 }), THRESHOLDS, 0)
    expect(o).toEqual({ warning: WARNINGS.bodyNotVisible, angle: null, counted: false, skippedJump: false })
    expect(state).toEqual(createRepCounterState())
  })

  it("treats a missing exercise as body not visible", () => {
    const o = detectRepFrame(null, createRepCounterState(), pushupPose({ elbow: 90 }), THRESHOLDS, 0)
    expect(o.warning).toBe(WARNINGS.bodyNotVisible)
  })
})

describe("push-up counting (normal preset: down < 100°, up > 155°, cooldown 650 ms)", () => {
  it("counts one full rep: down below elbowDown, then up above elbowUp", () => {
    const { state, outcomes } = run("pushup", pushupFrames(FULL_PUSHUP))
    expect(state.reps).toBe(1)
    expect(outcomes.map((o) => o.counted)).toEqual([false, false, false, false, false, false, true])
    expect(state.phase).toBe("up")
    expect(state.lastRepTime).toBe(1600)
    expect(outcomes.every((o) => o.warning === "")).toBe(true)
  })

  it("does not count when starting in the up position without going down first", () => {
    expect(run("pushup", pushupFrames([170, 170, 170])).state.reps).toBe(0)
  })

  it("rejects a sagging hip (shoulder-hip-knee ≤ 135°)", () => {
    const state = createRepCounterState()
    const o = detectRepFrame("pushup", state, pushupPose({ elbow: 90, hip: 120 }), THRESHOLDS, 0)
    expect(o).toEqual({ warning: WARNINGS.bodyNotStraight, angle: null, counted: false, skippedJump: false })
    expect(state.phase).toBeNull()
  })

  it("rejects bent knees (hip-knee-ankle ≤ 145°)", () => {
    const o = detectRepFrame("pushup", createRepCounterState(), pushupPose({ elbow: 90, knee: 130 }), THRESHOLDS, 0)
    expect(o.warning).toBe(WARNINGS.bodyNotStraight)
  })

  it("a bent-body frame keeps the current phase (frame is ignored, not reset)", () => {
    const { state } = run("pushup", pushupFrames([170, 140, 110, 90]))
    expect(state.phase).toBe("down")
    detectRepFrame("pushup", state, pushupPose({ elbow: 170, hip: 120 }), THRESHOLDS, 5000)
    expect(state.phase).toBe("down")
    expect(state.reps).toBe(0)
  })

  it("ignores half reps that never go below elbowDown", () => {
    const { state } = run("pushup", pushupFrames([170, 140, 120, 140, 170]))
    expect(state.reps).toBe(0)
    expect(state.phase).toBeNull()
  })

  it("respects cooldown: an early second rep is delayed, then counted on the next frame past cooldown", () => {
    const frames = [
      ...pushupFrames(FULL_PUSHUP, 1000), // counted at 1600
      ...pushupFrames([140, 110, 90, 120, 150, 170], 1700), // reaches up at 2200 (600 ms < 650)
    ]
    const { state, outcomes } = run("pushup", frames)
    expect(state.reps).toBe(1)
    expect(outcomes[outcomes.length - 1].counted).toBe(false)
    expect(state.phase).toBe("down")

    const late = detectRepFrame("pushup", state, pushupPose({ elbow: 170 }), THRESHOLDS, 2300)
    expect(late.counted).toBe(true)
    expect(state.reps).toBe(2)
  })
})

describe("sit-up counting (normal preset: down > 140°, up < 75°, kneeMax 155°, handRatio 1.1)", () => {
  it("counts a rep when the torso goes from near-upright (>140°) to below 75° (shoulders below hips)", () => {
    const { state, outcomes } = run("situp", situpFrames([170, 150, 120, 95, 80, 70]))
    expect(state.reps).toBe(1)
    expect(outcomes[outcomes.length - 1].counted).toBe(true)
  })

  it("does not count when lying flat stops at ~90° (current angle convention)", () => {
    expect(run("situp", situpFrames([170, 150, 120, 90, 90, 90])).state.reps).toBe(0)
  })

  it("rejects straight legs (knee angle > kneeMax)", () => {
    const o = detectRepFrame("situp", createRepCounterState(), situpPose({ torso: 150, knee: 170 }), THRESHOLDS, 0)
    expect(o).toEqual({ warning: WARNINGS.kneesStraight, angle: null, counted: false, skippedJump: false })
  })

  it("asks to come closer when shoulder width is below 0.02", () => {
    const o = detectRepFrame("situp", createRepCounterState(), situpPose({ torso: 150, shoulderWidth: 0.01 }), THRESHOLDS, 0)
    expect(o.warning).toBe(WARNINGS.comeCloser)
    expect(o.angle).toBeNull()
  })

  it("checks the knee gate before the distance gate", () => {
    const o = detectRepFrame(
      "situp",
      createRepCounterState(),
      situpPose({ torso: 150, knee: 170, shoulderWidth: 0.01 }),
      THRESHOLDS,
      0
    )
    expect(o.warning).toBe(WARNINGS.kneesStraight)
  })

  it("ignores frames with hands away from chest/head; warns only after more than 8 such frames", () => {
    const state = createRepCounterState()
    const away = situpPose({ torso: 150, handsInPlace: false })
    for (let i = 1; i <= 8; i++) {
      const o = detectRepFrame("situp", state, away, THRESHOLDS, i)
      expect(o).toEqual({ warning: "", angle: null, counted: false, skippedJump: false })
    }
    expect(detectRepFrame("situp", state, away, THRESHOLDS, 9).warning).toBe(WARNINGS.handsPosition)
    expect(state.handFailFrames).toBe(9)

    const ok = detectRepFrame("situp", state, situpPose({ torso: 150 }), THRESHOLDS, 10)
    expect(ok.angle).toBeCloseTo(150)
    expect(state.handFailFrames).toBe(0)
  })

  it("an earlier gate failure does not reset the hand-fail frame count", () => {
    const state = createRepCounterState()
    state.handFailFrames = 5
    detectRepFrame("situp", state, situpPose({ torso: 150, knee: 170 }), THRESHOLDS, 0)
    expect(state.handFailFrames).toBe(5)
  })
})

describe("pixel angles", () => {
  it("measures the elbow angle in pixels, so a wide frame does not skew it", () => {
    const frame = { width: 640, height: 480 }
    const side = RIGHT_SIDE
    const shoulder = { x: 200, y: 200 }
    const hip = { x: 400, y: 200 }
    const knee = { x: 520, y: 200 }
    const ankle = { x: 620, y: 200 }
    const elbow = { x: 260, y: 320 }
    const wrist = place(elbow, shoulder, 90, 70)
    const norm = (p: Point): Landmark => ({
      x: p.x / frame.width,
      y: p.y / frame.height,
      visibility: 0.9,
    })
    const lm = blankPose()
    lm[side.shoulder] = norm(shoulder)
    lm[side.hip] = norm(hip)
    lm[side.knee] = norm(knee)
    lm[side.ankle] = norm(ankle)
    lm[side.elbow] = norm(elbow)
    lm[side.wrist] = norm(wrist)

    const normalizedAngle = calculateAngle(norm(shoulder), norm(elbow), norm(wrist))
    expect(Math.abs(normalizedAngle - 90)).toBeGreaterThan(1)

    const outcome = detectRepFrame("pushup", createRepCounterState(), lm, THRESHOLDS, 0, frame)
    expect(outcome.warning).toBe("")
    expect(outcome.angle).toBeCloseTo(90, 0)
  })
})

describe("jump filter (> 35° between accepted frames)", () => {
  it("skips a frame that jumps more than 35° and keeps the last accepted angle", () => {
    const state = createRepCounterState()
    detectRepFrame("pushup", state, pushupPose({ elbow: 170 }), THRESHOLDS, 0)
    const o = detectRepFrame("pushup", state, pushupPose({ elbow: 120 }), THRESHOLDS, 100)
    expect(o).toEqual({ warning: "", angle: null, counted: false, skippedJump: true })
    expect(state.lastValidAngle).toBeCloseTo(170)
  })

  it("accepts changes up to 35°", () => {
    const state = createRepCounterState()
    detectRepFrame("pushup", state, pushupPose({ elbow: 170 }), THRESHOLDS, 0)
    expect(detectRepFrame("pushup", state, pushupPose({ elbow: 136 }), THRESHOLDS, 100).angle).toBeCloseTo(136)
  })

  it("keeps skipping a short jump, then accepts the new angle once it has lasted more than 150 ms", () => {
    const { state, outcomes } = run("pushup", pushupFrames([170, 100, 100, 100, 100]))
    expect(outcomes.map((o) => o.skippedJump)).toEqual([false, true, true, false, false])
    expect(state.lastValidAngle).toBeCloseTo(100)
  })

  it("accepts a new baseline after more than 3 consecutive jump frames", () => {
    const { state, outcomes } = run("pushup", pushupFrames([170, 90, 90, 90, 90], 0, 10))
    expect(outcomes.map((o) => o.skippedJump)).toEqual([false, true, true, true, false])
    expect(state.lastValidAngle).toBeCloseTo(90)
    expect(state.phase).toBe("down")
    expect(state.jumpRun).toBe(0)
  })

  it("applies to sit-ups too", () => {
    const { outcomes } = run("situp", situpFrames([170, 120]))
    expect(outcomes[1].skippedJump).toBe(true)
  })

  it("skipped frames are counted in the attempt log", () => {
    const log = createAttemptLog()
    run("pushup", pushupFrames([170, 100, 100]), createRepCounterState(), log)
    expect(log.skippedJumps).toBe(2)
  })
})

describe("attempts log and rejected-attempt detection", () => {
  const feed = (log: AttemptLog, angles: number[], threshold: number, start = 0, step = 100) =>
    angles.map((a, i) => recordAngle(log, a, false, start + i * step, threshold))

  it("uses elbowUp as the push-up rejection threshold and a fixed 150° for sit-ups", () => {
    expect(getRejectAscentThreshold("pushup", PRESETS.normal)).toBe(155)
    expect(getRejectAscentThreshold(null, PRESETS.strict)).toBe(160)
    expect(getRejectAscentThreshold("situp", PRESETS.easy)).toBe(150)
  })

  it("logs a rejected attempt when a dip reaches 25° below the threshold and recovers", () => {
    const log = createAttemptLog()
    const results = feed(log, [170, 150, 130, 160], 155)
    expect(log.attempts).toEqual([{ bottom: 130, top: null, counted: false, at: 300 }])
    expect(results.map((r) => r.attemptsChanged)).toEqual([false, false, false, true])
    expect(log.rejectArmed).toBe(false)
  })

  it("does not log a shallow dip", () => {
    const log = createAttemptLog()
    feed(log, [170, 140, 160], 155)
    expect(log.attempts).toEqual([])
  })

  it("logs sit-up rejections against 150°", () => {
    const log = createAttemptLog()
    feed(log, [170, 140, 120, 160], 150)
    expect(log.attempts).toEqual([{ bottom: 120, top: null, counted: false, at: 300 }])
  })

  it("records a counted attempt with the min/max angle since the previous counted rep", () => {
    const log = createAttemptLog()
    feed(log, [170, 140, 110, 90, 120, 150], 155)
    recordAngle(log, 170, true, 600, 155)
    expect(log.attempts).toEqual([{ bottom: 90, top: 170, counted: true, at: 600 }])
    expect(log.currentMin).toBe(999)
    expect(log.currentMax).toBe(0)
  })

  it("replaces a just-logged rejection with the counted attempt (bottom within 3°, within 1500 ms)", () => {
    const log = createAttemptLog()
    feed(log, [170, 150, 130, 160], 155)
    recordAngle(log, 165, true, 1000, 155)
    expect(log.attempts).toEqual([{ bottom: 130, top: 170, counted: true, at: 1000 }])
  })

  it("keeps both entries when the counted rep comes more than 1500 ms later", () => {
    const log = createAttemptLog()
    feed(log, [170, 150, 130, 160], 155)
    recordAngle(log, 165, true, 1801, 155)
    expect(log.attempts.map((a) => a.counted)).toEqual([false, true])
  })

  it("counts tracking loss when consecutive rounded angles differ by more than 30°", () => {
    const log = createAttemptLog()
    const r = feed(log, [170, 139, 100], 155)
    expect(r.map((x) => x.trackingLossChanged)).toEqual([false, true, true])
    expect(log.trackingLoss).toBe(2)
  })

  it(`keeps only the last ${MAX_ATTEMPTS} attempts`, () => {
    const log = createAttemptLog()
    for (let i = 0; i < MAX_ATTEMPTS + 5; i++) {
      recordAngle(log, 170, true, i * 2000, 155)
    }
    expect(log.attempts).toHaveLength(MAX_ATTEMPTS)
    expect(log.attempts[0].at).toBe(5 * 2000)
  })

  it("resetAttemptLog clears attempts, trackers and diagnostics", () => {
    const log = createAttemptLog()
    feed(log, [170, 150, 130, 160, 100], 155)
    noteSkippedJump(log)
    const before = log.attempts
    resetAttemptLog(log)
    expect(log).toEqual(createAttemptLog())
    expect(log.attempts).not.toBe(before)
  })

  it("end to end: a full push-up logs one counted attempt; a half rep logs one rejection", () => {
    const fullLog = createAttemptLog()
    run("pushup", pushupFrames(FULL_PUSHUP), createRepCounterState(), fullLog)
    expect(fullLog.attempts).toEqual([{ bottom: 90, top: 170, counted: true, at: 1600 }])

    const halfLog = createAttemptLog()
    const { state } = run("pushup", pushupFrames([170, 140, 120, 140, 170]), createRepCounterState(), halfLog)
    expect(state.reps).toBe(0)
    expect(halfLog.attempts).toEqual([{ bottom: 120, top: null, counted: false, at: 1400 }])
  })
})
