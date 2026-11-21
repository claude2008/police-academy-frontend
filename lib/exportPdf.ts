import html2pdf from "html2pdf.js"

type PdfWorker = {
  set: (options: object) => PdfWorker
  from: (element: HTMLElement) => PdfWorker
  toCanvas: () => Promise<void>
  get: (key: string) => Promise<HTMLCanvasElement>
  outputPdf: (type: "blob") => Promise<Blob>
}

const MAX_CANVAS_PIXELS = 16_000_000

const EXPORT_STYLE = `
.pdf-export .print\\:hidden,
.pdf-export .no-print,
.pdf-export nav,
.pdf-export aside,
.pdf-export header,
.pdf-export footer,
.pdf-export [data-sonner-toaster],
.pdf-export [role="dialog"],
.pdf-export [role="alertdialog"],
.pdf-export [data-radix-popper-content-wrapper] {
  display: none !important;
}
.pdf-export .print\\:block { display: block !important; }
.pdf-export .print\\:flex { display: flex !important; }
.pdf-export .print\\:table-header-group { display: table-header-group !important; }
.pdf-export .print\\:p-0 { padding: 0 !important; }
.pdf-export .print\\:shadow-none,
.pdf-export .shabaha-pdf-root,
.pdf-export .report-container,
.pdf-export .table-container {
  box-shadow: none !important;
  border-radius: 0 !important;
}
.pdf-export .shabaha-pdf-root,
.pdf-export .report-container,
.pdf-export .table-container,
.pdf-export .overflow-hidden,
.pdf-export .overflow-x-auto,
.pdf-export .overflow-auto {
  overflow: visible !important;
  max-width: none !important;
  height: auto !important;
  max-height: none !important;
}
.pdf-export .report-container {
  min-height: 0 !important;
  border: none !important;
  padding: 0 !important;
}
.pdf-export tr,
.pdf-export .break-inside-avoid,
.pdf-export .signature-image-container,
.pdf-export .approver-grid,
.pdf-export tfoot {
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}
`

function isIOSDevice(): boolean {
  const ua = navigator.userAgent || ""
  const classic = /iPad|iPhone|iPod/.test(ua)
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1
  return classic || iPadOS
}

export function isIosHomeScreen(): boolean {
  if (typeof window === "undefined") return false
  const nav = navigator as Navigator & { standalone?: boolean }
  const standalone = nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches
  return standalone && isIOSDevice()
}

export function pdfFilename(printTitle: string): string {
  const cleaned = printTitle.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "print"
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`
}

function pdfOrientation(): "portrait" | "landscape" {
  const texts: string[] = []
  document.querySelectorAll("style").forEach((node) => texts.push(node.textContent || ""))
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

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

async function waitForAssets(root: ParentNode) {
  if (document.fonts?.ready) await document.fonts.ready
  const images = Array.from(root.querySelectorAll("img"))
  await Promise.all(images.map((img) => {
    if (img.complete) return Promise.resolve()
    return new Promise<void>((resolve) => {
      img.addEventListener("load", () => resolve(), { once: true })
      img.addEventListener("error", () => resolve(), { once: true })
    })
  }))
}

function captureScale(width: number, height: number): number {
  const fitted = Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, width * height))
  return Math.min(2, fitted)
}

function loosen(start: HTMLElement) {
  const nodes: HTMLElement[] = []
  let node: HTMLElement | null = start
  while (node) {
    nodes.push(node)
    node = node.parentElement
  }
  const previous = nodes.map((el) => el.getAttribute("style"))
  for (const el of nodes) {
    el.style.setProperty("overflow", "visible", "important")
    el.style.setProperty("max-width", "none", "important")
    el.style.setProperty("height", "auto", "important")
    el.style.setProperty("max-height", "none", "important")
  }
  return () => {
    nodes.forEach((el, index) => {
      const prior = previous[index]
      if (prior === null) el.removeAttribute("style")
      else el.setAttribute("style", prior)
    })
  }
}

function trimTrailingBlank(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context || canvas.width < 2 || canvas.height < 2) return
  const sample = Math.max(1, Math.floor(canvas.width / 48))
  let lastInk = 0
  try {
    for (let y = canvas.height - 1; y >= 0; y -= 3) {
      const row = context.getImageData(0, y, canvas.width, 1).data
      let ink = false
      for (let x = 0; x < canvas.width; x += sample) {
        const index = x * 4
        const alpha = row[index + 3]
        if (alpha > 12 && (row[index] < 248 || row[index + 1] < 248 || row[index + 2] < 248)) {
          ink = true
          break
        }
      }
      if (ink) {
        lastInk = Math.min(canvas.height, y + 6)
        break
      }
    }
  } catch {
    return
  }
  if (lastInk < 2 || lastInk >= canvas.height - 2) return
  const copy = document.createElement("canvas")
  copy.width = canvas.width
  copy.height = lastInk
  copy.getContext("2d")?.drawImage(canvas, 0, 0)
  canvas.height = lastInk
  canvas.getContext("2d")?.drawImage(copy, 0, 0)
}

function openPdfBlob(file: Blob) {
  const url = URL.createObjectURL(file)
  const opened = window.open(url, "_blank")
  if (opened) return
  const link = document.createElement("a")
  link.href = url
  link.target = "_blank"
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export async function renderPdfFile(element: HTMLElement, filename: string): Promise<File> {
  const root = document.documentElement
  const style = document.createElement("style")
  style.setAttribute("data-pdf-export", "true")
  style.textContent = EXPORT_STYLE
  document.head.appendChild(style)
  root.classList.add("pdf-export")
  const restore = loosen(element)
  try {
    await waitForAssets(element)
    await nextFrame()
    await nextFrame()
    const width = Math.max(element.scrollWidth, Math.ceil(element.getBoundingClientRect().width), 1)
    const height = Math.max(element.scrollHeight, Math.ceil(element.getBoundingClientRect().height), 1)
    const worker = (html2pdf as unknown as () => PdfWorker)().set({
      margin: 5,
      filename,
      image: { type: "jpeg", quality: 0.92 },
      html2canvas: {
        scale: captureScale(width, height),
        useCORS: true,
        logging: false,
        width,
        windowWidth: width,
        height,
        windowHeight: height,
      },
      jsPDF: { unit: "mm", format: "a4", orientation: pdfOrientation() },
      pagebreak: {
        mode: ["css", "legacy"],
        avoid: ["tr", ".break-inside-avoid", ".signature-image-container", ".approver-grid"],
      },
    }).from(element)
    await worker.toCanvas()
    const canvas = await worker.get("canvas") as HTMLCanvasElement
    trimTrailingBlank(canvas)
    const blob = await worker.outputPdf("blob") as Blob
    return new File([blob], filename, { type: "application/pdf" })
  } finally {
    restore()
    root.classList.remove("pdf-export")
    style.remove()
    document.querySelectorAll(".html2pdf__overlay").forEach((node) => node.remove())
  }
}

export function sharePdfFile(file: File): void {
  const data: ShareData = { files: [file] }
  let supported = false
  try {
    supported = typeof navigator.share === "function" && (typeof navigator.canShare !== "function" || navigator.canShare(data))
  } catch {
    supported = false
  }
  if (!supported) {
    openPdfBlob(file)
    return
  }
  void navigator.share(data).catch((error: unknown) => {
    if (error instanceof DOMException && error.name === "AbortError") return
    openPdfBlob(file)
  })
}
