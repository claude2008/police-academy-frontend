/**
 * Runs before dev and build (never in the browser).
 * - Copies tasks-vision wasm into public/mediapipe/wasm (git-ignored).
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

if (!existsSync(wasmSrc)) {
  console.error("setup-mediapipe: @mediapipe/tasks-vision is not installed")
  process.exit(1)
}

mkdirSync(wasmDest, { recursive: true })
cpSync(wasmSrc, wasmDest, { recursive: true })
console.log("setup-mediapipe: wasm copied to public/mediapipe/wasm")

if (existsSync(modelDest) && statSync(modelDest).size > 0) {
  console.log("setup-mediapipe: model already present")
} else {
  console.log("setup-mediapipe: downloading pose_landmarker_full.task")
  mkdirSync(dirname(modelDest), { recursive: true })
  const response = await fetch(modelUrl)
  if (!response.ok || !response.body) {
    console.error(`setup-mediapipe: model download failed (${response.status})`)
    process.exit(1)
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(modelDest))
  console.log(`setup-mediapipe: model saved (${statSync(modelDest).size} bytes)`)
}
