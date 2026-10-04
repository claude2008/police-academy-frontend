import { EXERCISE_LABELS, SESSIONS_KEY } from "./constants"
import type { Attempt, SavedSession } from "./types"

export const loadSavedSessions = (): SavedSession[] => {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((s: SavedSession) => ({
      ...s,
      attempts: Array.isArray(s.attempts)
        ? s.attempts.map((a) => ({
            bottom: a.bottom,
            top: a.top ?? null,
            counted: !!a.counted,
            at: typeof a.at === "number" ? a.at : 0,
          }))
        : [],
    }))
  } catch {
    return []
  }
}

export const persistSavedSessions = (sessions: SavedSession[]) => {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

/** One line per attempt: `# | bottom | top | status | seconds`. */
export const formatAttemptRows = (attempts: Attempt[]) =>
  attempts
    .map((a, i) => {
      const top = a.top == null ? "—" : String(a.top)
      const status = a.counted ? "محسوب" : "مرفوض"
      const sec = (a.at / 1000).toFixed(1)
      return `${i + 1} | ${a.bottom} | ${top} | ${status} | ${sec}`
    })
    .join("\n")

export const formatSessionsExport = (sessions: SavedSession[]) =>
  sessions
    .map((s) => {
      const label = EXERCISE_LABELS[s.exercise]
      const header = `${new Date(s.savedAt).toLocaleString("en-GB")} | ${label} | ${s.reps} تكرار | ${s.durationSec} ث`
      const rows = formatAttemptRows(s.attempts)
      return `${header}\n${rows || "(لا محاولات)"}`
    })
    .join("\n\n---\n\n")
