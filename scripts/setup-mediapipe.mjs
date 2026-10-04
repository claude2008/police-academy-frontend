/**
 * Manual refresh after upgrading @mediapipe/tasks-vision.
 * May run before dev. Never exits with an error, so a build does not depend on it.
 * - Copies tasks-vision wasm into public/mediapipe/wasm when the package is installed.
 * - Downloads the Full pose model once if it is not already on disk.
 */
import { cpSync, createWriteStream, existsSync, mkdirSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const wasmSrc = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm")
const wasmDest = join(root, "public", "mediapipe", "wasm")
const modelDest = join(root, "public", "models", "pose", "pose_landmarker_full.task")
const modelUrl =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task"

const warn = (message) => {
  console.warn(message)
}

if (!existsSync(wasmSrc)) {
  warn("setup-mediapipe: @mediapipe/tasks-vision wasm not found; keeping the committed copy")
} else {
  try {
    mkdirSync(wasmDest, { recursive: true })
    cpSync(wasmSrc, wasmDest, { recursive: true })
    console.log("setup-mediapipe: wasm copied to public/mediapipe/wasm")
  } catch (err) {
    warn(`setup-mediapipe: wasm copy failed (${err instanceof Error ? err.message : err}); keeping the committed copy`)
  }
}

if (existsSync(modelDest) && statSync(modelDest).size > 0) {
  console.log("setup-mediapipe: model already present")
} else {
  try {
    console.log("setup-mediapipe: downloading pose_landmarker_full.task")
    mkdirSync(dirname(modelDest), { recursive: true })
    const response = await fetch(modelUrl)
    if (!response.ok || !response.body) {
      warn(`setup-mediapipe: model download failed (${response.status}); keeping the committed copy`)
    } else {
      await pipeline(Readable.fromWeb(response.body), createWriteStream(modelDest))
      console.log(`setup-mediapipe: model saved (${statSync(modelDest).size} bytes)`)
    }
  } catch (err) {
    warn(`setup-mediapipe: model download failed (${err instanceof Error ? err.message : err}); keeping the committed copy`)
  }
}
