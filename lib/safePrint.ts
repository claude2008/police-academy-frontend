function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent || ""
  const classicIOS = /iPad|iPhone|iPod/.test(ua)
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1
  return classicIOS || iPadOS
}

export function isIOSStandalone(): boolean {
  if (typeof window === "undefined") return false
  const standalone =
    (navigator as any).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  return standalone && isIOSDevice()
}

function pdfOrientation(): "portrait" | "landscape" {
  const texts: string[] = []
  document.querySelectorAll("style").forEach((node) => {
    texts.push(node.textContent || "")
  })
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      texts.push(Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n"))
    } catch {
      /* cross-origin stylesheet */
    }
  }
  const pageRules = texts.join("\n").match(/@page[^{]*\{[^}]*\}/gi) || []
  const landscape = pageRules.some((rule) => {
    const withoutComments = rule.replace(/\/\*[\s\S]*?\*\//g, "")
    return /size\s*:[^;]*landscape/i.test(withoutComments)
  })
  return landscape ? "landscape" : "portrait"
}

function pdfFileName(): string {
  const raw = (typeof document !== "undefined" && document.title) || "print"
  const cleaned = raw.replace(/[\\/:*?"<>|]+/g, "_").trim() || "print"
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`
}

function openPdfBlob(blob: Blob) {
  const url = URL.createObjectURL(blob)
  const opened = window.open(url, "_blank")
  if (opened) return
  const link = document.createElement("a")
  link.href = url
  link.target = "_blank"
  link.rel = "noopener"
  link.download = pdfFileName()
  document.body.appendChild(link)
  link.click()
  link.remove()
}

const MAX_CANVAS_PIXELS = 16_000_000

type PdfWorker = {
  from: (element: HTMLElement) => PdfWorker
  toCanvas: () => Promise<unknown>
  get: (key: string) => Promise<HTMLCanvasElement>
  outputPdf: (type: "blob") => Promise<Blob>
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function isRenderedAndVisible(element: HTMLElement): boolean {
  const style = getComputedStyle(element)
  if (style.display === "none" || style.visibility === "hidden") return false
  const rect = element.getBoundingClientRect()
  return rect.width > 1 && rect.height > 1
}

async function visibleReportContainer(): Promise<HTMLElement | null> {
  if (!document.querySelector(".report-container")) return null
  const started = Date.now()
  while (Date.now() - started < 1500) {
    const visible = Array.from(document.querySelectorAll<HTMLElement>(".report-container")).find((node) => isRenderedAndVisible(node))
    if (visible) return visible
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return null
}

async function waitForImages(root: ParentNode) {
  const images = Array.from(root.querySelectorAll("img"))
  await Promise.all(images.map((img) => {
    if (img.complete) return Promise.resolve()
    return new Promise<void>((resolve) => {
      img.addEventListener("load", () => resolve(), { once: true })
      img.addEventListener("error", () => resolve(), { once: true })
    })
  }))
}

function captureScale(element: HTMLElement): number {
  const rect = element.getBoundingClientRect()
  const width = Math.max(element.scrollWidth, rect.width, 1)
  const height = Math.max(element.scrollHeight, rect.height, 1)
  const fitted = Math.sqrt(MAX_CANVAS_PIXELS / (width * height))
  return Math.min(2, fitted)
}

function canvasHasInk(canvas: HTMLCanvasElement): boolean {
  if (canvas.width < 2 || canvas.height < 2) return false
  let context: CanvasRenderingContext2D | null
  try {
    context = canvas.getContext("2d", { willReadFrequently: true })
  } catch {
    return false
  }
  if (!context) return false
  const steps = 16
  try {
    for (let y = 0; y < steps; y++) {
      for (let x = 0; x < steps; x++) {
        const px = Math.min(canvas.width - 1, Math.floor(((x + 0.5) / steps) * canvas.width))
        const py = Math.min(canvas.height - 1, Math.floor(((y + 0.5) / steps) * canvas.height))
        const pixel = context.getImageData(px, py, 1, 1).data
        if (pixel[3] > 10 && (pixel[0] < 248 || pixel[1] < 248 || pixel[2] < 248)) return true
      }
    }
  } catch {
    return false
  }
  return false
}

function releaseCapture(element: HTMLElement, previousStyle: string | null) {
  if (previousStyle === null) element.removeAttribute("style")
  else element.setAttribute("style", previousStyle)
}

async function sharePrintablePdf() {
  const html2pdf = (await import("html2pdf.js")).default
  const root = document.documentElement
  root.classList.add("pdf-mode")
  let blob: Blob
  let captured: HTMLElement | null = null
  let previousStyle: string | null = null
  try {
    if (document.fonts?.ready) await document.fonts.ready
    await nextFrame()
    const report = await visibleReportContainer()
    const target = report ?? document.body
    if (report) {
      captured = report
      previousStyle = report.getAttribute("style")
      report.style.setProperty("position", "relative", "important")
      report.style.setProperty("left", "auto", "important")
      report.style.setProperty("top", "auto", "important")
      report.style.setProperty("width", "100%", "important")
      await nextFrame()
    }
    await waitForImages(target)

    const render = async (foreignObjectRendering: boolean) => {
      const worker = (html2pdf() as unknown as { set: (options: object) => PdfWorker }).set({
        margin: 5,
        filename: pdfFileName(),
        image: { type: "jpeg", quality: 0.92 },
        html2canvas: {
          scale: captureScale(target),
          useCORS: true,
          logging: false,
          foreignObjectRendering,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: pdfOrientation() },
        pagebreak: { mode: ["css", "legacy"] },
      }).from(target)
      await worker.toCanvas()
      const canvas = await worker.get("canvas")
      if (foreignObjectRendering && !canvasHasInk(canvas)) {
        throw new Error("blank-canvas")
      }
      return worker.outputPdf("blob")
    }

    try {
      blob = await render(true)
    } catch {
      document.querySelectorAll(".html2pdf__overlay").forEach((node) => node.remove())
      blob = await render(false)
    }
  } finally {
    if (captured) releaseCapture(captured, previousStyle)
    document.querySelectorAll(".html2pdf__overlay").forEach((node) => node.remove())
    root.classList.remove("pdf-mode")
  }

  const file = new File([blob], pdfFileName(), { type: "application/pdf" })
  const payload: ShareData = { files: [file], title: document.title || "print" }
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean }

  if (typeof nav.share === "function" && (typeof nav.canShare !== "function" || nav.canShare(payload))) {
    try {
      await nav.share(payload)
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
    }
  }

  openPdfBlob(blob)
}

let activeTimer: number | null = null
let activeBeforePrint: (() => void) | null = null
let activeDialog: HTMLDivElement | null = null
let activeResolve: (() => void) | null = null

function cleanupWatch() {
  if (activeTimer !== null) {
    window.clearTimeout(activeTimer)
    activeTimer = null
  }
  if (activeBeforePrint) {
    window.removeEventListener("beforeprint", activeBeforePrint)
    activeBeforePrint = null
  }
}

function removeFallbackDialog() {
  activeDialog?.remove()
  activeDialog = null
}

function finishPending() {
  cleanupWatch()
  removeFallbackDialog()
  const resolve = activeResolve
  activeResolve = null
  resolve?.()
}

function showFallbackDialog(done: () => void) {
  removeFallbackDialog()
  const overlay = document.createElement("div")
  overlay.setAttribute("dir", "rtl")
  overlay.style.cssText = "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.45);padding:16px;font-family:inherit;"
  const card = document.createElement("div")
  card.style.cssText = "background:#fff;color:#0f172a;border-radius:12px;padding:20px;max-width:320px;width:100%;text-align:right;box-shadow:0 12px 32px rgba(0,0,0,.2);"
  const message = document.createElement("p")
  message.textContent = "تعذّر فتح الطباعة على هذا الجهاز"
  message.style.cssText = "margin:0 0 16px;font-weight:700;font-size:16px;line-height:1.6;"
  const button = document.createElement("button")
  button.type = "button"
  button.textContent = "إنشاء PDF للطباعة"
  button.style.cssText = "width:100%;background:#0f172a;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;font-size:15px;cursor:pointer;"
  button.addEventListener("click", () => {
    button.disabled = true
    void sharePrintablePdf().finally(() => {
      removeFallbackDialog()
      done()
    })
  })
  card.append(message, button)
  overlay.appendChild(card)
  document.body.appendChild(overlay)
  activeDialog = overlay
}

export function safePrint(): Promise<void> {
  finishPending()

  if (!isIOSStandalone()) {
    window.print()
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    let nativeOpened = false
    activeResolve = resolve

    const onBeforePrint = () => {
      nativeOpened = true
      cleanupWatch()
      if (activeResolve === resolve) activeResolve = null
      resolve()
    }

    activeBeforePrint = onBeforePrint
    window.addEventListener("beforeprint", onBeforePrint)
    activeTimer = window.setTimeout(() => {
      cleanupWatch()
      if (nativeOpened) return
      showFallbackDialog(() => {
        if (activeResolve === resolve) activeResolve = null
        resolve()
      })
    }, 1000)
    window.print()
  })
}
