import AxeBuilder from "@axe-core/playwright"
import { expect, type Page, test } from "@playwright/test"

const routeCases = [
  { activeLabel: "홈", finalHash: "#/", hash: "#/", heading: "운동 전 안전 확인", theme: "light" },
  { activeLabel: "홈", finalHash: "#/", hash: "#/", heading: "운동 전 안전 확인", theme: "dark" },
  {
    activeLabel: "운동",
    finalHash: "#/workout",
    hash: "#/workout",
    heading: "운동 전 안전 확인",
    theme: "light",
  },
  {
    activeLabel: "운동",
    finalHash: "#/workout",
    hash: "#/workout",
    heading: "운동 전 안전 확인",
    theme: "dark",
  },
  {
    activeLabel: "레벨",
    finalHash: "#/levels",
    hash: "#/levels",
    heading: "운동 전 안전 확인",
    theme: "light",
  },
  {
    activeLabel: "레벨",
    finalHash: "#/levels",
    hash: "#/levels",
    heading: "운동 전 안전 확인",
    theme: "dark",
  },
  {
    activeLabel: "기록",
    finalHash: "#/record",
    hash: "#/record",
    heading: "운동 전 안전 확인",
    theme: "light",
  },
  {
    activeLabel: "기록",
    finalHash: "#/record",
    hash: "#/record",
    heading: "운동 전 안전 확인",
    theme: "dark",
  },
  {
    activeLabel: "설정",
    finalHash: "#/settings",
    hash: "#/settings",
    heading: "운동 전 안전 확인",
    theme: "light",
  },
  {
    activeLabel: "설정",
    finalHash: "#/settings",
    hash: "#/settings",
    heading: "운동 전 안전 확인",
    theme: "dark",
  },
  {
    activeLabel: "설정",
    finalHash: "#/settings",
    hash: "#/plan",
    heading: "운동 전 안전 확인",
    theme: "light",
  },
  {
    activeLabel: "설정",
    finalHash: "#/settings",
    hash: "#/plan",
    heading: "운동 전 안전 확인",
    theme: "dark",
  },
  {
    activeLabel: null,
    finalHash: "#/unsupported",
    hash: "#/unsupported",
    heading: "운동 전 안전 확인",
    theme: "light",
  },
  {
    activeLabel: null,
    finalHash: "#/unsupported",
    hash: "#/unsupported",
    heading: "운동 전 안전 확인",
    theme: "dark",
  },
] as const

const minimumTextContrastRatio = 4.5

test.describe("app shell accessibility", () => {
  for (const routeCase of routeCases) {
    test(`has zero axe violations at ${routeCase.hash} in ${routeCase.theme}`, async ({ page }) => {
      await page.addInitScript(
        (theme) => localStorage.setItem("home-training-theme", theme),
        routeCase.theme,
      )
      await page.goto(`/${routeCase.hash}`)

      await expect(page.getByRole("heading", { level: 1, name: routeCase.heading })).toBeVisible()
      await expect(page).toHaveURL(new RegExp(`${routeCase.finalHash}$`))
      await expect(page.locator(".app-nav-link.active")).toHaveCount(
        routeCase.activeLabel === null ? 0 : 1,
      )
      if (routeCase.activeLabel !== null) {
        const activeLink = page
          .locator(".app-nav-link.active[aria-current='page']")
          .filter({ hasText: routeCase.activeLabel })
        await expect(activeLink).toBeVisible()
        await expect(await readElementContrastRatio(activeLink)).toBeGreaterThanOrEqual(
          minimumTextContrastRatio,
        )
      }

      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
    })
  }

  test("focuses the main landmark when the skip link is activated", async ({ page }) => {
    await page.goto("/#/")
    await page.keyboard.press("Tab")
    await expect(page.getByRole("link", { name: "본문으로 건너뛰기" })).toBeFocused()

    await page.keyboard.press("Enter")

    await expect(page.getByRole("main")).toBeFocused()
    await expect(page).toHaveURL(/#\/$/)
    await expect(page.getByRole("heading", { level: 1, name: "운동 전 안전 확인" })).toBeVisible()
  })

  test("opens the safety principles dialog as a modal and restores focus", async ({ page }) => {
    await page.goto("/#/")
    const trigger = page.getByRole("button", { name: "안전 원칙" })

    await trigger.click()

    const dialog = page.getByRole("dialog", { name: "안전 원칙" })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText("통증이 있으면 즉시 중단합니다.")).toBeVisible()
    await expect(dialog.getByText("자세가 흐트러지면 반복을 멈춥니다.")).toBeVisible()
    await expect(dialog).toHaveJSProperty("open", true)
    expect(await dialog.evaluate((element) => element.matches(":modal"))).toBe(true)

    await page.keyboard.press("Escape")

    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })
})

async function readElementContrastRatio(locator: ReturnType<Page["locator"]>): Promise<number> {
  const colors = await locator.evaluate((element) => {
    const styles = window.getComputedStyle(element)

    return {
      background: styles.backgroundColor,
      foreground: styles.color,
    }
  })

  return contrastRatio(colors.foreground, colors.background)
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)

  return (lighter + 0.05) / (darker + 0.05)
}

function relativeLuminance(color: string): number {
  const [red, green, blue] = parseCssRgb(color)
  const linearRed = linearize(red)
  const linearGreen = linearize(green)
  const linearBlue = linearize(blue)

  return 0.2126 * linearRed + 0.7152 * linearGreen + 0.0722 * linearBlue
}

function parseCssRgb(color: string): readonly [number, number, number] {
  const matches = [...color.matchAll(/[\d.]+/g)]
  const redValue = matches[0]?.[0]
  const greenValue = matches[1]?.[0]
  const blueValue = matches[2]?.[0]

  if (redValue === undefined || greenValue === undefined || blueValue === undefined) {
    throw new CssColorParseError(color)
  }

  return [Number(redValue), Number(greenValue), Number(blueValue)]
}

function linearize(channel: number): number {
  const value = channel / 255

  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

class CssColorParseError extends Error {
  readonly name = "CssColorParseError"

  constructor(color: string) {
    super(`Cannot parse CSS RGB color: ${color}`)
  }
}
