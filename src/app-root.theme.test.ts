import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import { resolveMotionClass, resolveThemePreference, storeThemePreference } from "./app/theme"

describe("theme and motion helpers", () => {
  it("resolves system, light, and dark theme preferences", () => {
    expect(resolveThemePreference("system", true)).toBe("dark")
    expect(resolveThemePreference("system", false)).toBe("light")
    expect(resolveThemePreference("light", true)).toBe("light")
    expect(resolveThemePreference("dark", false)).toBe("dark")
  })

  it("persists only supported theme preferences", () => {
    const storage = {
      setItem: vi.fn(),
    } satisfies Pick<Storage, "setItem">

    storeThemePreference(storage, "dark")

    expect(storage.setItem).toHaveBeenCalledWith("home-training-theme", "dark")
  })

  it("maps reduced motion preference to stable class names", () => {
    expect(resolveMotionClass(true)).toBe("motion-reduce")
    expect(resolveMotionClass(false)).toBe("motion-ok")
  })
})

describe("design token accessibility", () => {
  const tokenCss = readFileSync("src/styles/tokens.css", "utf8")
  const lightTokens = {
    accentInk: readToken("accent-ink"),
    accentPrimary: readToken("accent-primary"),
    surfaceSecondary: readToken("surface-secondary"),
    statusWarning: readToken("status-warning"),
    surfaceElevated: readToken("surface-elevated"),
  } as const

  function readToken(name: string) {
    const value = tokenCss.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`))?.at(1)
    expect(value).toBeDefined()

    return value ?? ""
  }

  function contrastRatio(foreground: string, background: string) {
    const foregroundLuminance = relativeLuminance(foreground)
    const backgroundLuminance = relativeLuminance(background)
    const lighter = Math.max(foregroundLuminance, backgroundLuminance)
    const darker = Math.min(foregroundLuminance, backgroundLuminance)

    return (lighter + 0.05) / (darker + 0.05)
  }

  function relativeLuminance(color: string) {
    const red = Number.parseInt(color.slice(1, 3), 16) / 255
    const green = Number.parseInt(color.slice(3, 5), 16) / 255
    const blue = Number.parseInt(color.slice(5, 7), 16) / 255
    const linearRed = linearize(red)
    const linearGreen = linearize(green)
    const linearBlue = linearize(blue)

    return 0.2126 * linearRed + 0.7152 * linearGreen + 0.0722 * linearBlue
  }

  function linearize(channel: number) {
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }

  it("keeps light theme warning, active nav, and primary button contrast at AA", () => {
    expect(
      contrastRatio(lightTokens.statusWarning, lightTokens.surfaceElevated),
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      contrastRatio(lightTokens.accentPrimary, lightTokens.surfaceSecondary),
    ).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(lightTokens.accentInk, lightTokens.accentPrimary)).toBeGreaterThanOrEqual(
      4.5,
    )
  })
})
