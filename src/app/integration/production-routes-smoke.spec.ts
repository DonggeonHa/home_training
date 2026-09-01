import { join } from "node:path"
import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { EXERCISE_CATALOG } from "../../domain/catalog"
import { SessionIdSchema } from "../../domain/schemas"
import { APP_STORAGE_KEY } from "../../storage"
import { exportStoredState } from "../../storage/backup"
import { type StoredState, StoredStateSchema } from "../../storage/schemas"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"

const evidenceDirectory = ".omo/evidence/home-training/task-12/screenshots"
const viewports = [
  { height: 812, name: "mobile", width: 375 },
  { height: 1024, name: "tablet", width: 768 },
  { height: 900, name: "desktop", width: 1280 },
] as const
const themes = ["light", "dark"] as const

const routeCases = [
  { hash: "#/", heading: "오늘의 진행 대시보드", name: "dashboard" },
  { hash: "#/workout", heading: /Routine A/, name: "workout" },
  { hash: "#/levels", heading: "전체 스킬트리", name: "levels" },
  { hash: "#/levels/push", heading: "PUSH 스킬트리", name: "levels-push" },
  { hash: "#/record", heading: "기록과 성장", name: "record" },
  { hash: "#/settings", heading: "설정과 백업", name: "settings" },
] as const

test.describe("production route smoke", () => {
  test("completes safety onboarding in a production browser", async ({ page }) => {
    await page.setViewportSize({ height: 812, width: 375 })
    await page.goto("/#/")

    await expect(page.getByRole("heading", { level: 1, name: "운동 전 안전 확인" })).toBeVisible()
    await page.getByRole("button", { name: "안전 확인 제출" }).click()

    await expect(page.getByRole("button", { name: "기초 레벨 평가 시작" })).toBeVisible()
    const persisted = await page.evaluate(
      (storageKey) => localStorage.getItem(storageKey),
      APP_STORAGE_KEY,
    )
    expect(persisted).toContain('"safety":{"cleared":true')
    expect(persisted).not.toContain("chestPain")
    await page.screenshot({
      fullPage: true,
      path: `${evidenceDirectory}/onboarding-safety-mobile.png`,
    })
  })

  for (const viewport of viewports) {
    for (const theme of themes) {
      for (const routeCase of routeCases) {
        test(`renders ${routeCase.name} at ${viewport.name} in ${theme} without overflow, console errors, or axe violations`, async ({
          page,
        }) => {
          const consoleErrors = captureConsoleErrors(page)

          await page.setViewportSize({ height: viewport.height, width: viewport.width })
          await seedCompletedState(page, createCompletedOnboardingState(), theme)
          await page.goto(`/${routeCase.hash}`)

          await expect(
            page.getByRole("heading", { level: 1, name: routeCase.heading }),
          ).toBeVisible()
          await expect(page.locator(".app-shell")).toHaveAttribute("data-theme", theme)
          await expect.poll(() => findHorizontalOverflow(page)).toEqual([])

          const results = await new AxeBuilder({ page }).analyze()
          expect(results.violations).toEqual([])
          expect(consoleErrors).toEqual([])

          await page.screenshot({
            fullPage: true,
            path: `${evidenceDirectory}/${routeCase.name}-${theme}-${viewport.name}.png`,
          })
        })
      }
    }
  }

  test("resumes an active workout session after a production reload", async ({ page }) => {
    await page.setViewportSize({ height: 812, width: 375 })
    await seedCompletedState(page, createCompletedOnboardingState(), "dark")
    await page.goto("/#/workout")

    await page.getByRole("button", { name: "공통 워밍업 완료" }).click()
    await page.waitForFunction((storageKey) => {
      const rawState = localStorage.getItem(storageKey)
      if (rawState === null) {
        return false
      }
      const state = JSON.parse(rawState) as { readonly activeSession?: unknown }
      return state.activeSession !== null && state.activeSession !== undefined
    }, APP_STORAGE_KEY)
    await page.reload()

    await expect(page.getByRole("heading", { level: 1, name: /Routine A/ })).toBeVisible()
    await expect(page.getByRole("button", { name: "공통 워밍업 완료" })).toBeDisabled()
    await expect.poll(() => findHorizontalOverflow(page)).toEqual([])
    await page.screenshot({
      fullPage: true,
      path: `${evidenceDirectory}/workout-resume-mobile.png`,
    })
  })

  test("persists a running rest timer across a production reload", async ({ page }) => {
    await page.setViewportSize({ height: 812, width: 375 })
    await seedCompletedState(page, createCompletedOnboardingState(), "dark")
    await page.goto("/#/workout")

    await page.getByRole("button", { name: "공통 워밍업 완료" }).click()
    await page.getByRole("button", { name: "세트 기록" }).click()
    await page.getByRole("spinbutton", { name: "반복 수" }).fill("12")
    await page.getByRole("spinbutton", { name: "RIR" }).fill("2")
    await page.getByRole("button", { name: "세트 저장" }).click()
    await expect(page.getByRole("heading", { level: 2, name: "휴식" })).toBeVisible()
    await expect(page.locator(".workout-timer")).toContainText(":")

    await page.reload()

    await expect(page.getByRole("heading", { level: 2, name: "휴식" })).toBeVisible()
    await expect(page.locator(".workout-timer")).toContainText(":")
    await page.screenshot({
      fullPage: true,
      path: `${evidenceDirectory}/workout-rest-timer-reload-mobile.png`,
    })
  })

  test("keeps the closed workout abandon dialog from intercepting mobile actions", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 812, width: 375 })
    await seedCompletedState(page, createCompletedOnboardingState(), "dark")
    await page.goto("/#/workout")

    const currentHeading = page.getByRole("heading", { level: 1, name: /Routine A ·/ })
    const headingBeforeAdvance = await currentHeading.textContent()
    await expect(page.locator(".workout-dialog")).not.toHaveAttribute("open", "")
    await expect(page.locator(".workout-dialog")).toHaveCSS("display", "none")
    await expect(page.locator(".workout-dialog")).toHaveCSS("pointer-events", "none")

    const nextCategoryButton = page.getByRole("button", { name: "다음 카테고리" })
    const hitTest = await nextCategoryButton.evaluate((button) => {
      const rect = button.getBoundingClientRect()
      const hitElement = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      )

      return hitElement === button || button.contains(hitElement)
    })
    expect(hitTest).toBe(true)

    await nextCategoryButton.click()
    await expect.poll(async () => currentHeading.textContent()).not.toBe(headingBeforeAdvance)
    await page.screenshot({
      fullPage: true,
      path: `${evidenceDirectory}/workout-closed-dialog-mobile.png`,
    })
  })

  test("abandons a workout without adding duplicate history", async ({ page }) => {
    await page.setViewportSize({ height: 812, width: 375 })
    const seededState = createStateWithCompletedSession()
    await seedCompletedState(page, seededState, "dark")
    await page.goto("/#/workout")

    await page.getByRole("button", { name: "세션 포기" }).click()
    await expect(page.getByRole("dialog", { name: "세션을 포기할까요?" })).toBeVisible()
    await page.getByRole("button", { name: "포기 확정" }).click()

    await expect(
      page.getByRole("heading", { level: 1, name: "세션이 중단되었습니다" }),
    ).toBeVisible()
    const storedState = await readStoredState(page)
    expect(storedState.completedSessions).toHaveLength(1)
    expect(storedState.activeSession).toBeNull()
  })

  test("completes a workout once and does not duplicate history after reload", async ({ page }) => {
    await page.setViewportSize({ height: 812, width: 375 })
    await seedCompletedState(page, createCompletedOnboardingState(), "dark")
    await page.goto("/#/workout")

    await page.getByRole("button", { name: "다음 카테고리" }).click()
    await page.getByRole("button", { name: "다음 카테고리" }).click()
    await page.getByRole("button", { name: "다음 카테고리" }).click()
    await page.getByRole("button", { name: "다음 카테고리" }).click()

    await expect(
      page.getByRole("heading", { level: 1, name: "오늘의 진행 대시보드" }),
    ).toBeVisible()
    expect((await readStoredState(page)).completedSessions).toHaveLength(1)
    await page.reload()
    expect((await readStoredState(page)).completedSessions).toHaveLength(1)
  })

  test("applies settings theme and restores a backup in production smoke", async ({ page }) => {
    const restoredState = {
      ...createCompletedOnboardingState(),
      completedSessions: [],
      nextRoutine: "C",
    } satisfies StoredState

    await page.setViewportSize({ height: 812, width: 375 })
    await seedCompletedState(page, createCompletedOnboardingState(), "light")
    await page.goto("/#/settings")

    await page.getByLabel("테마").selectOption("dark")
    await expect(page.locator(".app-shell")).toHaveAttribute("data-theme", "dark")
    await page.getByRole("checkbox", { name: "움직임 줄이기" }).check()
    await expect(page.locator(".app-shell")).toHaveClass(/motion-reduce/)
    await page.getByLabel("백업 파일 선택").setInputFiles({
      buffer: Buffer.from(exportStoredState(restoredState)),
      mimeType: "application/json",
      name: "backup.json",
    })
    await expect(page.getByText("복원 미리보기: 기록 0개")).toBeVisible()
    await page.getByLabel("확인 문구").fill("REPLACE")
    await page.getByRole("button", { name: "전체 교체 복원" }).click()

    await expect(
      page.getByText("현재 상태를 백업하고 저장 확인 후 전체 교체했습니다."),
    ).toBeVisible()
    await page.goto("/#/")
    await expect(page.getByText("다음 추천 루틴 C")).toBeVisible()
    await expect.poll(() => findHorizontalOverflow(page)).toEqual([])
    await page.screenshot({
      fullPage: true,
      path: `${evidenceDirectory}/settings-restore-theme-mobile.png`,
    })
  })

  test("renders every category skill tree from a schema-validated seeded state", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: 1280 })
    await seedCompletedState(page, createCompletedOnboardingState(), "light")

    for (const category of EXERCISE_CATALOG) {
      await page.goto(`/#/levels/${category.id}`)
      await expect(
        page.getByRole("heading", { level: 1, name: `${category.title} 스킬트리` }),
      ).toBeVisible()
      await expect(page.getByRole("list", { name: `${category.title} 스킬트리` })).toBeVisible()
    }
  })

  test("shows history and preserves test-unlocked progress after failed level-test seed", async ({
    page,
  }) => {
    const seededState = createStateWithCompletedSession({
      progress: {
        ...createCompletedOnboardingState().progress,
        push: {
          ...createCompletedOnboardingState().progress.push,
          level: 1,
          qualifiedSessionIds: [
            SessionIdSchema.parse("11111111-1111-4111-8111-111111111111"),
            SessionIdSchema.parse("22222222-2222-4222-8222-222222222222"),
          ],
          status: "testUnlocked",
        },
      },
    })
    await seedCompletedState(page, seededState, "light")

    await page.goto("/#/record")
    await expect(page.getByRole("heading", { level: 1, name: "기록과 성장" })).toBeVisible()
    await expect(page.getByRole("list", { name: "완료 세션 목록" })).toContainText("PUSH Lv.1")

    await page.goto("/#/levels/push")
    await expect(page.getByText("Lv.1")).toBeVisible()
    expect((await readStoredState(page)).progress.push.status).toBe("testUnlocked")
  })

  test("exports valid JSON and rejects malformed import without replacing state", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 812, width: 375 })
    await seedCompletedState(page, createStateWithCompletedSession(), "light")
    await page.goto("/#/settings")

    const download = page.waitForEvent("download")
    await page.getByRole("button", { name: "JSON 백업 내보내기" }).click()
    expect((await download).suggestedFilename()).toBe("home-training-level-up-backup.json")

    await page.getByLabel("백업 파일 선택").setInputFiles({
      buffer: Buffer.from("{not-json"),
      mimeType: "application/json",
      name: "broken.json",
    })
    await expect(page.getByText("가져오기 파일을 읽을 수 없습니다.")).toBeVisible()
    expect((await readStoredState(page)).completedSessions).toHaveLength(1)
    await page.screenshot({
      fullPage: true,
      path: `${evidenceDirectory}/settings-malformed-import-mobile.png`,
    })
  })

  test("recovers corrupt storage and still renders the onboarding gate", async ({ page }) => {
    await page.addInitScript((storageKey) => {
      localStorage.setItem(storageKey, "{corrupt")
    }, APP_STORAGE_KEY)

    await page.goto("/#/settings")

    await expect(page.getByRole("heading", { level: 1, name: "운동 전 안전 확인" })).toBeVisible()
    await expect(
      page.getByRole("heading", { level: 2, name: "저장된 데이터를 복구했습니다" }),
    ).toBeVisible()
  })

  test("serves the HashRouter app from a deployment subpath", async ({ page }) => {
    await seedCompletedState(page, createCompletedOnboardingState(), "dark")
    await routeDistSubpath(page, "home-training-levelup")

    await page.goto("/home-training-levelup/#/settings")

    await expect(page.getByRole("heading", { level: 1, name: "설정과 백업" })).toBeVisible()
    await expect(page.locator(".app-shell")).toHaveAttribute("data-theme", "dark")
  })
})

function captureConsoleErrors(page: Page) {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text())
    }
  })
  page.on("pageerror", (error) => consoleErrors.push(error.message))

  return consoleErrors
}

async function seedCompletedState(page: Page, state: StoredState, theme: (typeof themes)[number]) {
  const storedState = StoredStateSchema.parse(state)
  await page.addInitScript(
    ([storageKey, storedState, themePreference]) => {
      if (localStorage.getItem(storageKey) === null) {
        localStorage.setItem(storageKey, JSON.stringify(storedState))
      }
      localStorage.setItem("home-training-theme", themePreference)
    },
    [APP_STORAGE_KEY, storedState, theme] as const,
  )
}

async function readStoredState(page: Page): Promise<StoredState> {
  return page.evaluate((storageKey) => {
    const rawState = localStorage.getItem(storageKey)
    if (rawState === null) {
      throw new Error("Expected stored state to exist")
    }

    return JSON.parse(rawState) as StoredState
  }, APP_STORAGE_KEY)
}

function createStateWithCompletedSession(overrides: Partial<StoredState> = {}): StoredState {
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

async function routeDistSubpath(page: Page, subpath: string): Promise<void> {
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

async function findHorizontalOverflow(page: Page) {
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
