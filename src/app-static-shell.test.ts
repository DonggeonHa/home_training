import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const staticShellMarkup = readFileSync("index.html", "utf8")

describe("static app shell document", () => {
  it("renders a persistent semantic app shell before the React entry script", () => {
    const document = new DOMParser().parseFromString(staticShellMarkup, "text/html")
    const appHost = document.querySelector("#app-host.app-shell")
    const skipLink = document.querySelector("body > a.skip-link")
    const header = document.querySelector("#app-host > header.app-header")
    const root = document.querySelector("#root")
    const entryScript = document.querySelector('script[type="module"][src="/src/main.tsx"]')

    expect(skipLink?.getAttribute("href")).toBe("#main-content")
    expect(header?.getAttribute("role")).toBeNull()
    expect(header?.querySelector("p.eyebrow")?.textContent).toBe("LOCAL TRAINING SYSTEM")
    expect(header?.querySelector("h1.brand-title")?.textContent).toBe("홈트레이닝 LEVEL UP")
    expect(header?.querySelector(".brand-tagline")?.textContent).toBe(
      "집에서도 안전하게, 오늘 할 운동만 선명하게.",
    )
    expect(header?.querySelector("#app-header-actions")).not.toBeNull()
    expect(root?.parentElement).toBe(appHost)
    expect(root?.nextElementSibling).toBe(entryScript)
  })
})
