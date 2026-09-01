export const THEME_STORAGE_KEY = "home-training-theme"
export const REDUCED_MOTION_STORAGE_KEY = "home-training-reduced-motion"

export const themePreferences = ["system", "light", "dark"] as const
export const reducedMotionPreferences = ["system", "reduce"] as const

export type ThemePreference = (typeof themePreferences)[number]
export type ReducedMotionPreference = (typeof reducedMotionPreferences)[number]
export type ResolvedTheme = Exclude<ThemePreference, "system">
export type MotionClass = "motion-ok" | "motion-reduce"

export function isThemePreference(value: string): value is ThemePreference {
  return themePreferences.some((preference) => preference === value)
}

export function isReducedMotionPreference(value: string): value is ReducedMotionPreference {
  return reducedMotionPreferences.some((preference) => preference === value)
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
  const stored = readPreference(storage, THEME_STORAGE_KEY)

  return stored !== null && isThemePreference(stored) ? stored : "system"
}

export function storeThemePreference(
  storage: Pick<Storage, "setItem">,
  preference: ThemePreference,
): void {
  writePreference(storage, THEME_STORAGE_KEY, preference)
}

export function loadReducedMotionPreference(
  storage: Pick<Storage, "getItem">,
): ReducedMotionPreference {
  const stored = readPreference(storage, REDUCED_MOTION_STORAGE_KEY)

  return stored !== null && isReducedMotionPreference(stored) ? stored : "system"
}

export function storeReducedMotionPreference(
  storage: Pick<Storage, "setItem">,
  preference: ReducedMotionPreference,
): void {
  writePreference(storage, REDUCED_MOTION_STORAGE_KEY, preference)
}

export function getBrowserPreferenceStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    return window.localStorage
  } catch (error) {
    if (isExpectedPreferenceStorageError(error)) {
      return null
    }
    throw error
  }
}

export function resolveMotionClass(prefersReducedMotion: boolean): MotionClass {
  return prefersReducedMotion ? "motion-reduce" : "motion-ok"
}

export function resolveReducedMotionPreference(
  preference: ReducedMotionPreference,
  prefersReducedMotion: boolean,
): boolean {
  return preference === "reduce" || prefersReducedMotion
}

function readPreference(storage: Pick<Storage, "getItem">, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch (error) {
    if (isExpectedPreferenceStorageError(error)) {
      return null
    }
    throw error
  }
}

function writePreference(storage: Pick<Storage, "setItem">, key: string, value: string): void {
  try {
    storage.setItem(key, value)
  } catch (error) {
    if (!isExpectedPreferenceStorageError(error)) {
      throw error
    }
  }
}

function isExpectedPreferenceStorageError(error: unknown): error is Error {
  return error instanceof DOMException || error instanceof Error
}
