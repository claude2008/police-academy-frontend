import {
  ONE_EURO_BETA,
  ONE_EURO_D_CUTOFF,
  ONE_EURO_INITIAL_FREQ,
  ONE_EURO_MIN_CUTOFF,
} from "./constants"
import type { Landmark } from "./types"

export type OneEuroParams = {
  minCutoff: number
  beta: number
  dCutoff: number
}

const DEFAULT_PARAMS: OneEuroParams = {
  minCutoff: ONE_EURO_MIN_CUTOFF,
  beta: ONE_EURO_BETA,
  dCutoff: ONE_EURO_D_CUTOFF,
}

const alpha = (cutoff: number, freq: number) => {
  const te = 1 / freq
  const tau = 1 / (2 * Math.PI * cutoff)
  return 1 / (1 + tau / te)
}

/** Low-pass whose first sample passes through unchanged. */
class LowPass {
  private value = 0
  private raw = 0
  private ready = false

  filter(sample: number, a: number) {
    const result = this.ready ? a * sample + (1 - a) * this.value : sample
    this.raw = sample
    this.value = result
    this.ready = true
    return result
  }

  lastRaw() {
    return this.raw
  }

  hasRaw() {
    return this.ready
  }

  reset() {
    this.ready = false
  }
}

/** Time-based 1€ filter. `timestampMs` is a real clock, not a frame index. */
export class OneEuroFilter {
  private readonly params: OneEuroParams
  private freq = ONE_EURO_INITIAL_FREQ
  private lastTime: number | null = null
  private readonly x = new LowPass()
  private readonly dx = new LowPass()

  constructor(params: OneEuroParams = DEFAULT_PARAMS) {
    this.params = params
  }

  filter(sample: number, timestampMs: number) {
    if (this.lastTime != null && timestampMs > this.lastTime) {
      this.freq = 1000 / (timestampMs - this.lastTime)
    }
    this.lastTime = timestampMs

    const prev = this.x.hasRaw() ? this.x.lastRaw() : sample
    const derivative = (sample - prev) * this.freq
    const smoothedDerivative = this.dx.filter(derivative, alpha(this.params.dCutoff, this.freq))
    const cutoff = this.params.minCutoff + this.params.beta * Math.abs(smoothedDerivative)
    return this.x.filter(sample, alpha(cutoff, this.freq))
  }

  reset() {
    this.freq = ONE_EURO_INITIAL_FREQ
    this.lastTime = null
    this.x.reset()
    this.dx.reset()
  }
}

/** One filter per landmark axis. Visibility and z are left as measured. */
export class LandmarkSmoother {
  private readonly x = new Map<number, OneEuroFilter>()
  private readonly y = new Map<number, OneEuroFilter>()

  smooth(landmarks: Landmark[], timestampMs: number): Landmark[] {
    return landmarks.map((landmark, index) => {
      if (!landmark) return landmark
      let xFilter = this.x.get(index)
      let yFilter = this.y.get(index)
      if (!xFilter || !yFilter) {
        xFilter = new OneEuroFilter()
        yFilter = new OneEuroFilter()
        this.x.set(index, xFilter)
        this.y.set(index, yFilter)
      }
      return {
        ...landmark,
        x: xFilter.filter(landmark.x, timestampMs),
        y: yFilter.filter(landmark.y, timestampMs),
      }
    })
  }

  reset() {
    this.x.clear()
    this.y.clear()
  }
}
