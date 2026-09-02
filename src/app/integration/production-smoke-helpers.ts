import { join } from "node:path"
import type { Page } from "@playwright/test"
import { expect } from "@playwright/test"
import { EXERCISE_CATALOG } from "../../domain/catalog"
import { SessionIdSchema } from "../../domain/schemas"
import { APP_STORAGE_KEY } from "../../storage"
import { type StoredState, StoredStateSchema } from "../../storage/schemas"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"

export const evidenceDirectory = ".omo/evidence/home-training/task-12/screenshots"

export const viewports = [
  { height: 812, name: "mobile", width: 375 },
  { height: 1024, name: "tablet", width: 768 },
  { height: 900, name: "desktop", width: 1280 },
] as const

export const themes = ["light", "dark"] as const

export function captureConsoleErrors(page: Page) {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text())
    }
  })
  page.on("pageerror", (error) => consoleErrors.push(error.message))

  return consoleErrors
}

export async function seedCompletedState(
  page: Page,
  state: StoredState,
  theme: (typeof themes)[number],
) {
  const storedState = StoredStateSchema.parse(state)
  await page.addInitScript(
    ([storageKey, seededState, themePreference]) => {
      if (localStorage.getItem(storageKey) === null) {
        localStorage.setItem(storageKey, JSON.stringify(seededState))
      }
      localStorage.setItem("home-training-theme", themePreference)
    },
    [APP_STORAGE_KEY, storedState, theme] as const,
  )
}

export async function readStoredState(page: Page): Promise<StoredState> {
  return page.evaluate((storageKey) => {
    const rawState = localStorage.getItem(storageKey)
    if (rawState === null) {
      throw new Error("Expected stored state to exist")
    }

    return JSON.parse(rawState) as StoredState
  }, APP_STORAGE_KEY)
}

export function createStateWithCompletedSession(overrides: Partial<StoredState> = {}): StoredState {
  const baseState = createCompletedOnboardingState()
  const pushCategory = EXERCISE_CATALOG.find((category) => category.id === "push")
  const pushLevel = pushCategory?.levels[1]
  if (pushCategory === undefined || pushLevel === undefined) {
    throw new Error("Expected PUSH level fixture to exist")
  }

  return StoredStateSchema.parse({
    ...baseState,
    completedSessions: [
      {
        completedAt: "2026-09-02T01:00:00.000Z",
        entries: [
          {
            categoryId: pushCategory.id,
            exerciseName: pushLevel.name,
            level: pushLevel.level,
            metricRule: pushLevel.metricRule,
            sets: [
              {
                kind: "single",
                loadKg: 0,
                quality: { form: "good", pain: false, rom: "full" },
                rir: 2,
                value: 12,
              },
            ],
          },
        ],
        id: SessionIdSchema.parse("33333333-3333-4333-8333-333333333333"),
        routineId: "A",
      },
    ],
    ...overrides,
  })
}

export async function routeDistSubpath(page: Page, subpath: string): Promise<void> {
  await page.route(`**/${subpath}/`, (route) =>
    route.fulfill({
      contentType: "text/html",
      path: join(process.cwd(), "dist", "index.html"),
    }),
  )
  await page.route(`**/${subpath}/assets/**`, (route) => {
    const assetName = new URL(route.request().url()).pathname.split("/assets/").at(1)
    if (assetName === undefined) {
      throw new Error("Expected asset route to include an asset name")
    }
    route.fulfill({
      contentType: assetName.endsWith(".css") ? "text/css" : "application/javascript",
      path: join(process.cwd(), "dist", "assets", assetName),
    })
  })
}

export async function findHorizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth
    if (document.documentElement.scrollWidth <= clientWidth + 1) {
      return []
    }

    return [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((element) => element.getBoundingClientRect().right > clientWidth + 1)
      .slice(0, 5)
      .map((element) => ({
        className: element.className.toString(),
        left: Math.round(element.getBoundingClientRect().left),
        right: Math.round(element.getBoundingClientRect().right),
        tagName: element.tagName.toLowerCase(),
        text: element.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ?? "",
        width: Math.round(element.getBoundingClientRect().width),
      }))
  })
}

export async function stopCurrentCategoryByPain(
  page: Page,
  inputName: string,
  value: string,
): Promise<void> {
  const commonWarmup = page.getByRole("button", { name: "공통 워밍업 완료" })
  if (await commonWarmup.isEnabled()) {
    await commonWarmup.click()
  }
  const categoryWarmup = page.getByRole("button", { name: "카테고리 워밍업 완료" })
  if (await categoryWarmup.isEnabled()) {
    await categoryWarmup.click()
  }
  await page.getByRole("button", { name: "세트 기록" }).click()
  await page.getByRole("spinbutton", { name: inputName }).fill(value)
  await page.getByRole("checkbox", { name: /통증/ }).check()
  await page.getByRole("button", { name: "세트 저장" }).click()
  await page.getByRole("button", { name: "다음 카테고리" }).click()
}

export async function confirmPullChecklist(page: Page): Promise<void> {
  const checklist = page.getByRole("group", { name: "철봉 안전 확인" })
  for (const checkbox of await checklist.getByRole("checkbox").all()) {
    await checkbox.check()
  }
}

export { APP_STORAGE_KEY, EXERCISE_CATALOG, expect }
