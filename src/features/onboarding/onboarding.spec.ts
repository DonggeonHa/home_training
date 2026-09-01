import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

const persistedStateKey = "home-training-level-up:v1"

test.describe("onboarding safety and assessment", () => {
  test("clears safety and persists only minimal safety state on mobile", async ({ page }) => {
    // Given: a fresh mobile-sized browser state.
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto("/#/")

    // When: the safety form is submitted with no red flags.
    await page.getByRole("button", { name: "안전 확인 제출" }).click()

    // Then: assessment can start and persisted data contains no detailed answers.
    await expect(page.getByRole("button", { name: "기초 레벨 평가 시작" })).toBeVisible()
    const persisted = await page.evaluate((key) => localStorage.getItem(key), persistedStateKey)
    expect(persisted).toContain('"safety":{"cleared":true')
    expect(persisted).not.toContain("chestPain")
    expect(persisted).not.toContain("recentInjury")
    expect(await new AxeBuilder({ page }).analyze()).toMatchObject({ violations: [] })
  })

  test("blocks urgent red flags with 119 guidance and no persisted answers", async ({ page }) => {
    // Given: a fresh desktop browser state.
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto("/#/")

    // When: current chest pain is selected.
    await page.getByRole("checkbox", { name: /현재 흉통/ }).check()
    await page.getByRole("button", { name: "안전 확인 제출" }).click()

    // Then: assessment is blocked with professional guidance.
    await expect(page.getByText(/의료 진단이나 처방을 제공하지 않습니다/)).toBeVisible()
    await expect(page.getByText(/119/)).toBeVisible()
    await expect(page.getByRole("button", { name: "기초 레벨 평가 시작" })).toBeHidden()
    expect(await page.evaluate((key) => localStorage.getItem(key), persistedStateKey)).toBeNull()
    expect(await new AxeBuilder({ page }).analyze()).toMatchObject({ violations: [] })
  })

  test("gates non-home routes until onboarding is complete", async ({ page }) => {
    // Given: a user deep-links to a normal app route before onboarding.
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto("/#/record")

    // Then: route content is not reachable before safety and assessment.
    await expect(page.getByRole("heading", { level: 1, name: "운동 전 안전 확인" })).toBeVisible()
    await expect(page.getByRole("heading", { level: 1, name: "기록" })).toBeHidden()
    expect(await new AxeBuilder({ page }).analyze()).toMatchObject({ violations: [] })
  })

  test("resumes the active assessment step after reload", async ({ page }) => {
    // Given: safety is clear and assessment has started.
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto("/#/")
    await page.getByRole("button", { name: "안전 확인 제출" }).click()
    await page.getByRole("button", { name: "기초 레벨 평가 시작" }).click()

    // When: the first controlled set passes and the page reloads.
    await page.getByRole("spinbutton", { name: "반복 수" }).fill("15")
    await page.getByRole("checkbox", { name: "자세가 안정적입니다" }).check()
    await page.getByRole("checkbox", { name: "통증 없는 전체 가동범위입니다" }).check()
    await page.getByRole("button", { name: "평가 세트 저장" }).click()
    await page.reload()

    // Then: the next PUSH assessment level is restored from parsed storage.
    await expect(page.getByRole("region", { name: "기초 레벨 평가" })).toBeVisible()
    await expect(page.getByRole("heading", { level: 1, name: "PUSH Lv.1" })).toBeVisible()
    const persisted = await page.evaluate((key) => localStorage.getItem(key), persistedStateKey)
    expect(persisted).not.toContain("chestPain")
  })
})
