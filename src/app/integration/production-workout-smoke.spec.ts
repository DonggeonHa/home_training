import { expect, test } from "@playwright/test"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import {
  APP_STORAGE_KEY,
  confirmPullChecklist,
  createStateWithCompletedSession,
  evidenceDirectory,
  findHorizontalOverflow,
  findMainContentNavIntersections,
  readStoredState,
  scrollMainContent,
  seedCompletedState,
  stopCurrentCategoryByPain,
} from "./production-smoke-helpers"

test.describe("production workout smoke", () => {
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

  test("keeps mobile workout actions above the fixed navigation", async ({ page }) => {
    await page.setViewportSize({ height: 812, width: 375 })
    await seedCompletedState(page, createCompletedOnboardingState(), "dark")
    await page.goto("/#/workout")
    await scrollMainContent(page, "bottom")

    const footerBox = await page.locator(".workout-sticky").boundingBox()
    const navBox = await page.locator(".app-nav").boundingBox()

    expect(footerBox).not.toBeNull()
    expect(navBox).not.toBeNull()
    expect(Math.round(footerBox?.y ?? 0) + Math.round(footerBox?.height ?? 0)).toBeLessThanOrEqual(
      Math.round(navBox?.y ?? 0),
    )
    expect(await findMainContentNavIntersections(page)).toEqual([])
    await expect.poll(() => findHorizontalOverflow(page)).toEqual([])
    await page.screenshot({
      fullPage: true,
      path: `${evidenceDirectory}/workout-mobile-bottom-safe-area.png`,
    })
  })

  test("keeps the closed workout abandon dialog from intercepting mobile actions", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 812, width: 375 })
    await seedCompletedState(page, createCompletedOnboardingState(), "dark")
    await page.goto("/#/workout")

    const nextCategoryButton = page.getByRole("button", { name: "공통 워밍업 필요" })
    await expect(page.locator(".workout-dialog")).not.toHaveAttribute("open", "")
    await expect(page.locator(".workout-dialog")).toHaveCSS("display", "none")
    await expect(page.locator(".workout-dialog")).toHaveCSS("pointer-events", "none")

    const hitTest = await nextCategoryButton.evaluate((button) => {
      const rect = button.getBoundingClientRect()
      const hitElement = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      )

      return hitElement === button || button.contains(hitElement)
    })
    expect(hitTest).toBe(true)
  })

  test("abandons a workout without adding duplicate history", async ({ page }) => {
    await page.setViewportSize({ height: 812, width: 375 })
    await seedCompletedState(page, createStateWithCompletedSession(), "dark")
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

  test("completes a workout once with recorded pain-stopped categories", async ({ page }) => {
    await page.setViewportSize({ height: 812, width: 375 })
    await seedCompletedState(page, createCompletedOnboardingState(), "dark")
    await page.goto("/#/workout")

    await stopCurrentCategoryByPain(page, "반복 수", "15")
    await stopCurrentCategoryByPain(page, "반복 수", "10")
    await confirmPullChecklist(page)
    await stopCurrentCategoryByPain(page, "초", "30")
    await stopCurrentCategoryByPain(page, "초", "45")

    await expect(
      page.getByRole("heading", { level: 1, name: "오늘의 진행 대시보드" }),
    ).toBeVisible()
    const completedState = await readStoredState(page)
    expect(completedState.completedSessions).toHaveLength(1)
    expect(
      completedState.completedSessions[0]?.entries.every((entry) => entry.sets.length > 0),
    ).toBe(true)
    await page.reload()
    expect((await readStoredState(page)).completedSessions).toHaveLength(1)
  })
})
