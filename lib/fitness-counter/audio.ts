import type { Ref } from "./types"

export const ensureAudio = (ctxRef: Ref<AudioContext | null>) => {
  const AC =
    typeof window !== "undefined"
      ? window.AudioContext || (window as any).webkitAudioContext
      : null
  if (!AC) return null
  if (!ctxRef.current) {
    ctxRef.current = new AC()
  }
  if (ctxRef.current.state === "suspended") {
    void ctxRef.current.resume()
  }
  return ctxRef.current
}

export const playBeep = (
  ctxRef: Ref<AudioContext | null>,
  beep: { freq: number; durationMs: number }
) => {
  const ctx = ctxRef.current || ensureAudio(ctxRef)
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = "sine"
  osc.frequency.value = beep.freq
  gain.gain.value = 0.2
  osc.connect(gain)
  gain.connect(ctx.destination)
  const now = ctx.currentTime
  osc.start(now)
  osc.stop(now + beep.durationMs / 1000)
}
