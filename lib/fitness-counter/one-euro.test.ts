import { describe, expect, it } from "vitest"
import { LandmarkSmoother, OneEuroFilter } from "./one-euro"
import type { Landmark } from "./types"

describe("One Euro Filter", () => {
  it("passes the first sample through and smooths a small jitter", () => {
    const filter = new OneEuroFilter()
    expect(filter.filter(0, 0)).toBe(0)
    const jitter = filter.filter(0.01, 33)
    expect(jitter).toBeGreaterThan(0)
    expect(jitter).toBeLessThan(0.005)
  })

  it("follows a fast move without adopting it in one frame", () => {
    const filter = new OneEuroFilter()
    filter.filter(0, 0)
    const stepped = filter.filter(1, 33)
    expect(stepped).toBeGreaterThan(0.2)
    expect(stepped).toBeLessThan(0.9)
  })

  it("resets so the next sample is not pulled toward the old value", () => {
    const filter = new OneEuroFilter()
    filter.filter(0, 0)
    filter.filter(0.01, 33)
    filter.reset()
    expect(filter.filter(0.8, 500)).toBeCloseTo(0.8)
  })

  it("smooths landmark x and y and leaves visibility untouched", () => {
    const smoother = new LandmarkSmoother()
    const raw = (x: number): Landmark[] => [{ x, y: x, visibility: 0.8 }]
    const first = smoother.smooth(raw(0.2), 0)
    expect(first[0].x).toBeCloseTo(0.2)
    expect(first[0].visibility).toBe(0.8)
    const second = smoother.smooth(raw(0.21), 33)
    expect(second[0].x).toBeGreaterThan(0.2)
    expect(second[0].x).toBeLessThan(0.21)
    expect(second[0].y).toBeCloseTo(second[0].x)

    smoother.reset()
    expect(smoother.smooth(raw(0.9), 1000)[0].x).toBeCloseTo(0.9)
  })
})
