export type Stage = "select" | "prepare" | "waiting" | "countdown" | "active" | "result"
export type Exercise = "pushup" | "situp"
export type Strictness = "easy" | "normal" | "strict" | "custom"
export type PresetStrictness = Exclude<Strictness, "custom">
export type FacingMode = "user" | "environment"

export type Attempt = { bottom: number; top: number | null; counted: boolean; at: number }

export type SavedSession = {
  id: number
  exercise: Exercise
  reps: number
  durationSec: number
  savedAt: string
  attempts: Attempt[]
}

export type PushupThresholds = {
  elbowDown: number
  elbowUp: number
  knee: number
  hip: number
  cooldownMs: number
}

export type SitupThresholds = {
  up: number
  down: number
  kneeMax: number
  handRatio: number
  cooldownMs: number
}

export type Point = { x: number; y: number }
export type Landmark = Point & { z?: number; visibility?: number }

export type PoseResults = {
  image: CanvasImageSource
  poseLandmarks?: Landmark[]
}

export type Ref<T> = { current: T }
