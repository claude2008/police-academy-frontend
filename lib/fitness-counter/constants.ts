import type {
  Exercise,
  PresetStrictness,
  PushupThresholds,
  SitupThresholds,
  Stage,
  Strictness,
} from "./types"

// Session protocol
export const TEST_DURATION_SECONDS = 60
export const COUNTDOWN_SECONDS = 5
export const POSTURE_HOLD_MS = 2000
export const FINAL_BEEP_SECONDS = 5
export const TIMER_WARN_SECONDS = 10
export const TIMER_DANGER_SECONDS = 5
export const COPIED_FEEDBACK_MS = 2000
export const SESSIONS_KEY = "smart-counter-sessions"

export const BEEPS = {
  tick: { freq: 880, durationMs: 120 },
  go: { freq: 440, durationMs: 500 },
  end: { freq: 330, durationMs: 800 },
} as const

// Rep-counting thresholds
export const PRESETS: Record<PresetStrictness, PushupThresholds> = {
  easy:   { elbowDown: 110, elbowUp: 150, knee: 130, hip: 120, cooldownMs: 500 },
  normal: { elbowDown: 100, elbowUp: 155, knee: 145, hip: 135, cooldownMs: 650 },
  strict: { elbowDown: 90,  elbowUp: 160, knee: 160, hip: 150, cooldownMs: 800 },
}

export const SITUP_PRESETS: Record<PresetStrictness, SitupThresholds> = {
  easy:   { up: 85, down: 130, kneeMax: 165, handRatio: 1.4, cooldownMs: 450 },
  normal: { up: 75, down: 140, kneeMax: 155, handRatio: 1.1, cooldownMs: 600 },
  strict: { up: 65, down: 150, kneeMax: 145, handRatio: 0.9, cooldownMs: 750 },
}

export const VISIBILITY_MIN = 0.5
export const JUMP_FILTER_DEG = 35
export const TRACKING_LOSS_DEG = 30
export const SITUP_REJECT_ASCENT_DEG = 150
export const REJECT_MIN_DEPTH_DEG = 25
export const MERGE_BOTTOM_TOLERANCE_DEG = 3
export const MERGE_WINDOW_MS = 1500
export const MAX_ATTEMPTS = 100
export const HAND_FAIL_WARN_FRAMES = 8
export const MIN_SHOULDER_WIDTH = 0.02
export const CHEST_CENTER_RATIO = 0.3
export const GROUND_REF_OFFSET = 0.3
export const INITIAL_MIN_ANGLE = 999

// Camera and model
export const MOBILE_BREAKPOINT_PX = 768
export const MOBILE_VIDEO_HEIGHT_RATIO = 0.7
export const DEFAULT_FRAME = { width: 640, height: 480 }
export const AUTOPLAY_CHECK_MS = 3000
export const LOW_FPS_WARN = 15

/** Served from public/ by scripts/setup-mediapipe.mjs (wasm is git-ignored, the model is committed). */
export const WASM_PATH = "/mediapipe/wasm"
export const MODEL_PATH = "/models/pose/pose_landmarker_full.task"
export const POSE_INIT_TIMEOUT_MS = 10000
export const POSE_NUM_POSES = 1
export const POSE_MIN_POSE_DETECTION_CONFIDENCE = 0.5
export const POSE_MIN_POSE_PRESENCE_CONFIDENCE = 0.5
export const POSE_MIN_TRACKING_CONFIDENCE = 0.5

export const SKELETON_STYLE = { color: "#00FF00", lineWidth: 2 }
export const LANDMARK_STYLE = { color: "#FF0000", lineWidth: 1 }

export const CAMERA_STAGES: readonly Stage[] = ["prepare", "waiting", "countdown", "active"]
export const isCameraStage = (stage: Stage) => CAMERA_STAGES.includes(stage)

// UI text
export const EXERCISE_LABELS: Record<Exercise, string> = {
  pushup: "ضغط",
  situp: "بطن",
}

export const STRICTNESS_LABELS: Record<Strictness, string> = {
  easy: "🟢 متساهل",
  normal: "🟡 متوسط",
  strict: "🔴 صارم",
  custom: "⚙️ مخصص",
}

export const EXERCISE_TIPS = [
  { icon: "📐", title: "زاوية الكاميرا", text: "من الجانب بزاوية 90 درجة" },
  { icon: "💡", title: "الإضاءة", text: "إضاءة جيدة على الجسم كاملاً" },
  { icon: "📏", title: "المسافة", text: "2-3 متر من الكاميرا" },
  { icon: "🚫", title: "الثبات", text: "لا تحرك الكاميرا أثناء التمرين" },
]

export const WARNINGS = {
  bodyNotVisible: "⚠️ تأكد من ظهور الجسم كاملاً في الكاميرا",
  bodyNotStraight: "⚠️ حافظ على استقامة الجسم — لا تضع الركبة على الأرض",
  kneesStraight: "⚠️ اثنِ الركبتين — يجب ألا تكون الساقان مستقيمتين",
  comeCloser: "⚠️ اقترب من الكاميرا",
  handsPosition: "⚠️ ضع اليدين على الصدر أو خلف الرأس",
  waitingForBody: "في انتظار ظهور الجسم في الكاميرا",
  postureOk: "✅ الوضع مثالي",
}

export const CAMERA_ERRORS = {
  modelLoad: "فشل تحميل نموذج الذكاء الاصطناعي، حاول مرة أخرى",
  permission: "يرجى السماح بالوصول للكاميرا من إعدادات المتصفح",
  access: "تعذر الوصول إلى الكاميرا. تحقق من الأذونات.",
  flip: "تعذر تبديل الكاميرا.",
}
