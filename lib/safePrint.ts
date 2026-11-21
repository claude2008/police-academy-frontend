import { toast } from "sonner"

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent || ""
  const classicIOS = /iPad|iPhone|iPod/.test(ua)
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1
  return classicIOS || iPadOS
}

function isIOSStandalone(): boolean {
  if (typeof window === "undefined") return false
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  return standalone && isIOSDevice()
}

export function safePrint(): void {
  window.print()
  if (!isIOSStandalone()) return
  toast("لم تظهر الطباعة؟ افتح التطبيق من Safari", {
    duration: 6000,
    style: { direction: "rtl", textAlign: "right" },
  })
}
