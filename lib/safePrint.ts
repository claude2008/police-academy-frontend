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

async function sharePrintablePdf() {
  const html2pdf = (await import("html2pdf.js")).default
  const root = document.documentElement
  root.classList.add("pdf-mode")
  let blob: Blob
  try {
    const options = {
      margin: 5,
      filename: pdfFileName(),
      image: { type: "jpeg" as const, quality: 0.92 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
      },
      jsPDF: { unit: "mm" as const, format: "a4", orientation: pdfOrientation() },
      pagebreak: { mode: ["css", "legacy"] },
    }
    blob = (await html2pdf().set(options).from(document.body).outputPdf("blob")) as Blob
  } finally {
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

export function safePrint(): Promise<void> {
  if (!isIOSStandalone()) {
    window.print()
    return Promise.resolve()
  }
  return sharePrintablePdf()
}
