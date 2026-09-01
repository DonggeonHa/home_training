import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { App } from "./App"

describe("App root", () => {
  it("renders the Korean app title when the application entry exists", () => {
    render(<App />)

    expect(screen.getByRole("heading", { level: 1, name: "홈트레이닝 LEVEL UP" })).toBeVisible()
  })
})
