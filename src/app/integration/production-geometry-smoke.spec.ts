import { mkdirSync, writeFileSync } from "node:fs"
import { expect, test } from "@playwright/test"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import {
  type GeometrySnapshot,
  readActionContentGeometry,
  readElementTextLineWidths,
  readNavContentGeometry,
  scrollMainContent,
} from "./production-geometry-helpers"
import {
  evidenceDirectory,
  findHorizontalOverflow,
  seedCompletedState,
  themes,
} from "./production-smoke-helpers"

type GeometryRecord = GeometrySnapshot & {
  readonly blockerKind: "action" | "nav"
  readonly route: string
  readonly scrollPosition: "bottom" | "middle" | "top"
  readonly theme: (typeof themes)[number]
  readonly viewport: GeometrySnapshot["viewport"] & {
    readonly name: "mobile" | "tablet"
  }
}

const geometryViewports = [
  { height: 812, name: "mobile", width: 375 },
  { height: 1024, name: "tablet", width: 768 },
] as const

const geometryRoutes = [
  { hash: "#/", heading: "오늘의 진행 대시보드", name: "dashboard" },
  { hash: "#/levels", heading: "전체 스킬트리", name: "levels" },
  { hash: "#/levels/push", heading: "PUSH 스킬트리", name: "levels-push" },
  { hash: "#/settings", heading: "설정과 백업", name: "settings" },
  { hash: "#/workout", heading: /Routine A/, name: "workout" },
] as const

const scrollPositions = ["top", "middle", "bottom"] as const
const geometryEvidencePath = `${evidenceDirectory}/geometry-boxes.json`

function geometryUrl(hash: string, scenarioName: string) {
  return `/?geometry=${encodeURIComponent(scenarioName)}${hash}`
}

test.describe("production mobile and tablet geometry smoke", () => {
  test("keeps dashboard title from orphaning a final Korean syllable on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 812, width: 375 })
    await seedCompletedState(page, createCompletedOnboardingState(), "dark")
    await page.goto("/#/")

    await expect(
      page.getByRole("heading", { level: 1, name: "오늘의 진행 대시보드" }),
    ).toBeVisible()
    const lineWidths = await readElementTextLineWidths(page, "#dashboard-title")

    expect(lineWidths.length).toBeLessThanOrEqual(2)
    expect(lineWidths.at(-1)).toBeGreaterThanOrEqual(80)
    await page.screenshot({
      fullPage: true,
      path: `${evidenceDirectory}/dashboard-mobile-title-no-orphan.png`,
    })
  })

  test("keeps route content out of the mobile and tablet navigation space", async ({ page }) => {
    const geometryRecords: GeometryRecord[] = []

    for (const viewport of geometryViewports) {
      for (const theme of themes) {
        for (const routeCase of geometryRoutes) {
          await page.setViewportSize({ height: viewport.height, width: viewport.width })
          await seedCompletedState(page, createCompletedOnboardingState(), theme)
          await page.goto(
            geometryUrl(routeCase.hash, `${routeCase.name}-${theme}-${viewport.name}`),
          )
          await expect(
            page.getByRole("heading", { level: 1, name: routeCase.heading }),
          ).toBeVisible()

          await expect.poll(() => findHorizontalOverflow(page)).toEqual([])

          for (const scrollPosition of scrollPositions) {
            await scrollMainContent(page, scrollPosition)
            const geometry = await readNavContentGeometry(page)
            expect(geometry.intersections).toEqual([])
            geometryRecords.push({
              ...geometry,
              blockerKind: "nav",
              route: routeCase.name,
              scrollPosition,
              theme,
              viewport: { ...geometry.viewport, name: viewport.name },
            })
            await page.screenshot({
              fullPage: true,
              path: `${evidenceDirectory}/${routeCase.name}-${theme}-${viewport.name}-nav-clear-final-${scrollPosition}.png`,
            })
          }
        }
      }
    }

    mkdirSync(evidenceDirectory, { recursive: true })
    writeFileSync(geometryEvidencePath, `${JSON.stringify(geometryRecords, null, 2)}\n`)
  })

  test("keeps workout actions in normal flow without obscuring content or navigation", async ({
    page,
  }) => {
    const geometryRecords: GeometryRecord[] = []

    for (const viewport of geometryViewports) {
      for (const theme of themes) {
        await page.setViewportSize({ height: viewport.height, width: viewport.width })
        await seedCompletedState(page, createCompletedOnboardingState(), theme)
        await page.goto(geometryUrl("#/workout", `workout-actions-${theme}-${viewport.name}`))
        await expect(page.getByRole("heading", { level: 1, name: /Routine A/ })).toBeVisible()
        await expect(page.locator(".workout-sticky")).toHaveCSS("position", "static")

        for (const scrollPosition of scrollPositions) {
          await scrollMainContent(page, scrollPosition)
          const navGeometry = await readNavContentGeometry(page)
          const actionGeometry = await readActionContentGeometry(page)
          expect(navGeometry.intersections).toEqual([])
          expect(actionGeometry.intersections).toEqual([])
          geometryRecords.push({
            ...navGeometry,
            blockerKind: "nav",
            route: "workout",
            scrollPosition,
            theme,
            viewport: { ...navGeometry.viewport, name: viewport.name },
          })
          geometryRecords.push({
            ...actionGeometry,
            blockerKind: "action",
            route: "workout",
            scrollPosition,
            theme,
            viewport: { ...actionGeometry.viewport, name: viewport.name },
          })
        }

        await page.locator(".workout-sticky").scrollIntoViewIfNeeded()
        const footerBox = await page.locator(".workout-sticky").boundingBox()
        const navBox = await page.locator(".app-nav").boundingBox()

        expect(footerBox).not.toBeNull()
        expect(navBox).not.toBeNull()
        expect(Math.round((footerBox?.y ?? 0) + (footerBox?.height ?? 0))).toBeLessThanOrEqual(
          Math.round(navBox?.y ?? 0),
        )
        await expect.poll(() => findHorizontalOverflow(page)).toEqual([])
        await page.screenshot({
          fullPage: true,
          path: `${evidenceDirectory}/workout-${theme}-${viewport.name}-actions-clear-final.png`,
        })
      }
    }

    mkdirSync(evidenceDirectory, { recursive: true })
    writeFileSync(
      `${evidenceDirectory}/workout-action-geometry-boxes.json`,
      `${JSON.stringify(geometryRecords, null, 2)}\n`,
    )
  })
})
