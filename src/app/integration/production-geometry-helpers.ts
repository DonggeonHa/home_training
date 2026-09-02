import type { Page } from "@playwright/test"

type GeometryBox = {
  readonly bottom: number
  readonly className: string
  readonly left: number
  readonly right: number
  readonly tagName: string
  readonly text: string
  readonly top: number
}

export async function findMainContentNavIntersections(page: Page): Promise<readonly GeometryBox[]> {
  return findMainContentIntersections(page, ".app-nav", [])
}

export async function findMainContentActionIntersections(
  page: Page,
): Promise<readonly GeometryBox[]> {
  return findMainContentIntersections(page, ".workout-sticky", [".workout-sticky"])
}

export async function readElementTextLineWidths(
  page: Page,
  selector: string,
): Promise<readonly number[]> {
  return page.evaluate((elementSelector) => {
    const element = document.querySelector<HTMLElement>(elementSelector)
    const textNode = [...(element?.childNodes ?? [])].find(
      (node): node is Text =>
        node.nodeType === Node.TEXT_NODE && (node.textContent?.trim() ?? "") !== "",
    )
    if (element === null || textNode === undefined) {
      throw new Error(`Expected ${elementSelector} to contain direct text`)
    }

    const range = document.createRange()
    range.selectNodeContents(textNode)
    const lineWidths = [...range.getClientRects()]
      .map((rect) => Math.round(rect.width))
      .filter((width) => width > 0)
    range.detach()

    return lineWidths
  }, selector)
}

export async function scrollMainContent(page: Page, position: "bottom" | "middle" | "top") {
  await page.evaluate((scrollPosition) => {
    const main = document.querySelector<HTMLElement>("#main-content")
    const documentScroller = document.scrollingElement
    const scroller =
      main !== null && main.scrollHeight > main.clientHeight + 1 ? main : documentScroller
    if (scroller === null) {
      throw new Error("Expected a scrollable page or main region")
    }

    const scrollRatio = scrollPosition === "bottom" ? 1 : scrollPosition === "middle" ? 0.5 : 0
    scroller.scrollTo({ top: (scroller.scrollHeight - scroller.clientHeight) * scrollRatio })
  }, position)
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
}

async function findMainContentIntersections(
  page: Page,
  blockerSelector: string,
  ignoredSelectors: readonly string[],
): Promise<readonly GeometryBox[]> {
  return page.evaluate(
    ({
      blockerSelector: evaluatedBlockerSelector,
      ignoredSelectors: evaluatedIgnoredSelectors,
    }) => {
      const main = document.querySelector<HTMLElement>("#main-content")
      const blocker = document.querySelector<HTMLElement>(evaluatedBlockerSelector)
      if (main === null || blocker === null) {
        throw new Error("Expected main content and blocker element to exist")
      }

      const blockerRect = blocker.getBoundingClientRect()
      const mainRect = main.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const viewportWidth = window.innerWidth

      return [
        ...main.querySelectorAll<HTMLElement>(
          [
            "h1",
            "h2",
            "h3",
            "p",
            "a",
            "button",
            "li",
            "dt",
            "dd",
            ".dashboard-card",
            ".ui-card",
            ".workout-panel",
            ".workout-rest",
          ].join(","),
        ),
      ]
        .filter((element) =>
          evaluatedIgnoredSelectors.every((selector) => element.closest(selector) === null),
        )
        .map((element) => {
          const rect = element.getBoundingClientRect()
          const visibleRect = {
            bottom: Math.min(rect.bottom, mainRect.bottom, viewportHeight),
            left: Math.max(rect.left, mainRect.left, 0),
            right: Math.min(rect.right, mainRect.right, viewportWidth),
            top: Math.max(rect.top, mainRect.top, 0),
          }

          return {
            bottom: Math.round(visibleRect.bottom),
            className: element.className.toString(),
            left: Math.round(visibleRect.left),
            right: Math.round(visibleRect.right),
            tagName: element.tagName.toLowerCase(),
            text: element.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ?? "",
            top: Math.round(visibleRect.top),
          }
        })
        .filter(
          (box) =>
            box.right > box.left &&
            box.bottom > box.top &&
            box.right > 0 &&
            box.left < viewportWidth &&
            box.bottom > 0 &&
            box.top < viewportHeight &&
            box.right > blockerRect.left &&
            box.left < blockerRect.right &&
            box.bottom > blockerRect.top &&
            box.top < blockerRect.bottom,
        )
    },
    { blockerSelector, ignoredSelectors },
  )
}
