import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { CategoryIdSchema } from "../../domain/schemas"
import type { StoredState } from "../../storage"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import { SkillTreeView } from "./SkillTreeView"

function definitionValue(item: HTMLElement, label: string): string {
  const term = Array.from(item.querySelectorAll("dt")).find(
    (candidate) => candidate.textContent === label,
  )
  const definition = term?.nextElementSibling

  expect(term).not.toBeUndefined()
  expect(definition?.tagName).toBe("DD")
  return definition?.textContent ?? ""
}

describe("SkillTreeView", () => {
  it("renders all six semantic skill trees and all 51 catalog levels", () => {
    render(<SkillTreeView state={createCompletedOnboardingState()} />)

    expect(screen.getAllByRole("list", { name: /스킬트리/ })).toHaveLength(6)
    expect(screen.getAllByRole("listitem", { name: /레벨/ })).toHaveLength(51)
  })

  it("uses text status for cleared, current, testable, locked, and terminal levels", () => {
    const base: StoredState = createCompletedOnboardingState()
    const state = {
      ...base,
      progress: {
        ...base.progress,
        push: { categoryId: CategoryIdSchema.parse("push"), level: 3, status: "testUnlocked" },
      },
    } satisfies StoredState

    render(<SkillTreeView state={state} />)

    const pushTree = screen.getByRole("list", { name: "PUSH 스킬트리" })

    expect(within(pushTree).getAllByText("클리어").length).toBeGreaterThan(0)
    expect(within(pushTree).getByText("현재")).toBeVisible()
    expect(within(pushTree).getByText("테스트 가능")).toBeVisible()
    expect(within(pushTree).getAllByText("잠김").length).toBeGreaterThan(0)
    expect(screen.getByText("터미널 목표")).toBeVisible()
  })

  it("shows target, equipment, regression, warmup, and safety content without media placeholders", () => {
    render(<SkillTreeView state={createCompletedOnboardingState()} />)

    const firstLevel = screen.getByRole("listitem", { name: "레벨 0 벽 푸시업" })

    expect(definitionValue(firstLevel, "목표")).toBe("15회 × 3세트")
    expect(definitionValue(firstLevel, "장비")).toBe("맨몸, 푸시업바 선택 사용")
    expect(definitionValue(firstLevel, "회귀")).toBe(
      "현재 레벨보다 쉬운 푸시업으로 워밍업하거나 반복 수를 낮춰 자세를 유지한다.",
    )
    expect(definitionValue(firstLevel, "안전")).toContain("흉통")
    expect(within(firstLevel).queryByText("목표: 15회 × 3세트")).not.toBeInTheDocument()
    expect(within(firstLevel).queryByText(/장비:/)).not.toBeInTheDocument()
    expect(within(firstLevel).queryByText(/회귀:/)).not.toBeInTheDocument()
    expect(within(firstLevel).queryByText(/안전:/)).not.toBeInTheDocument()
    expect(screen.getAllByText("워밍업").length).toBe(6)
    expect(screen.getAllByText("중단 신호").length).toBe(6)
    expect(screen.queryByText(/영상|이미지|placeholder/i)).not.toBeInTheDocument()
  })
})
