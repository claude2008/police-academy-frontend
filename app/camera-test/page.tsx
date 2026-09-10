"use client"
import { useRef, useState } from "react"

export default function CameraTest() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [log, setLog] = useState<string[]>([])
  const add = (m: string) => setLog(p => [...p, m])

  const start = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true })
      add("stream ok")
      if (videoRef.current) {
        videoRef.current.srcObject = s
        await videoRef.current.play()
        add("playing, readyState=" + videoRef.current.readyState)
      }
    } catch (e: any) {
      add("err " + e.name + " " + e.message)
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <button onClick={start} style={{ padding: 16, fontSize: 20, background: "green", color: "white" }}>
        تشغيل الكاميرا
      </button>
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{ width: "100%", maxWidth: 480, background: "#000", marginTop: 12 }}
      />
      <pre style={{ fontSize: 11, marginTop: 12 }}>{log.join("\n")}</pre>
    </div>
  )
}
