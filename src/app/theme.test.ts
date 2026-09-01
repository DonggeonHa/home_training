import { describe, expect, it } from "vitest"
import {
  loadReducedMotionPreference,
  loadThemePreference,
  storeReducedMotionPreference,
  storeThemePreference,
} from "./theme"

class ThrowingThemeStorage {
  constructor(private readonly error: Error) {}

  getItem(_key: string): string | null {
    throw this.error
  }

  setItem(_key: string, _value: string): void {
    throw this.error
  }
}

describe("display preference storage", () => {
  it("falls back to system preferences when storage reads are blocked", () => {
    // Given: browser preference storage is unavailable.
    const storage = new ThrowingThemeStorage(new DOMException("denied", "SecurityError"))

    // When: display preferences hydrate.
    const themePreference = loadThemePreference(storage)
    const reducedMotionPreference = loadReducedMotionPreference(storage)

    // Then: hydration uses safe system defaults.
    expect(themePreference).toBe("system")
    expect(reducedMotionPreference).toBe("system")
  })

  it("keeps the app usable when preference writes are blocked", () => {
    // Given: browser preference storage rejects writes.
    const storage = new ThrowingThemeStorage(new DOMException("denied", "SecurityError"))

    // When / Then: preference updates fail safely without bubbling to React effects.
    expect(() => storeThemePreference(storage, "dark")).not.toThrow()
    expect(() => storeReducedMotionPreference(storage, "reduce")).not.toThrow()
  })
})
