import { useEffect, useMemo, useState } from "react"

export const THEME_STORAGE_KEY = "home-training-theme"

export const themePreferences = ["system", "light", "dark"] as const

export type ThemePreference = (typeof themePreferences)[number]
export type ResolvedTheme = Exclude<ThemePreference, "system">
export type MotionClass = "motion-ok" | "motion-reduce"

export function isThemePreference(value: string): value is ThemePreference {
  return themePreferences.some((preference) => preference === value)
}

export function resolveThemePreference(
  preference: ThemePreference,
  prefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") {
    return prefersDark ? "dark" : "light"
  }

  return preference
}

export function loadThemePreference(storage: Pick<Storage, "getItem">): ThemePreference {
  const stored = storage.getItem(THEME_STORAGE_KEY)

  return stored !== null && isThemePreference(stored) ? stored : "system"
}

export function storeThemePreference(
  storage: Pick<Storage, "setItem">,
  preference: ThemePreference,
): void {
  storage.setItem(THEME_STORAGE_KEY, preference)
}

export function resolveMotionClass(prefersReducedMotion: boolean): MotionClass {
  return prefersReducedMotion ? "motion-reduce" : "motion-ok"
}

function createMediaMatcher(query: string): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null
  }

  return window.matchMedia(query)
}

export function useThemePreference(): {
  readonly motionClass: MotionClass
  readonly preference: ThemePreference
  readonly resolvedTheme: ResolvedTheme
  readonly setPreference: (preference: ThemePreference) => void
} {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") {
      return "system"
    }

    return loadThemePreference(window.localStorage)
  })
  const [prefersDark, setPrefersDark] = useState(() => {
    const matcher = createMediaMatcher("(prefers-color-scheme: dark)")
    return matcher?.matches ?? false
  })
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    const matcher = createMediaMatcher("(prefers-reduced-motion: reduce)")
    return matcher?.matches ?? false
  })

  useEffect(() => {
    const colorMatcher = createMediaMatcher("(prefers-color-scheme: dark)")
    const motionMatcher = createMediaMatcher("(prefers-reduced-motion: reduce)")

    const handleColorChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches)
    const handleMotionChange = (event: MediaQueryListEvent) =>
      setPrefersReducedMotion(event.matches)

    colorMatcher?.addEventListener("change", handleColorChange)
    motionMatcher?.addEventListener("change", handleMotionChange)

    return () => {
      colorMatcher?.removeEventListener("change", handleColorChange)
      motionMatcher?.removeEventListener("change", handleMotionChange)
    }
  }, [])

  const setPreference = (nextPreference: ThemePreference) => {
    storeThemePreference(window.localStorage, nextPreference)
    setPreferenceState(nextPreference)
  }

  const resolvedTheme = resolveThemePreference(preference, prefersDark)

  return useMemo(
    () => ({
      motionClass: resolveMotionClass(prefersReducedMotion),
      preference,
      resolvedTheme,
      setPreference,
    }),
    [preference, prefersReducedMotion, resolvedTheme],
  )
}
