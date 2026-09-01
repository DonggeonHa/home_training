import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { MetricRule } from "../../domain/contracts"
import { SetForm, SetList } from "./SetLogger"
import type { WorkoutState } from "./types"

const repsRule = {
  kind: "reps",
  laterality: "none",
  min: 10,
  max: 15,
  rir: { min: 1, max: 2 },
  sets: 3,
} as const satisfies MetricRule

const durationRule = {
  kind: "duration",
  laterality: "none",
  minSeconds: 30,
  maxSeconds: 45,
  sets: 3,
} as const satisfies MetricRule

const tempoRule = {
  kind: "tempoReps",
  laterality: "none",
  min: 5,
  max: 8,
  rir: { min: 1, max: 2 },
  sets: 3,
  tempoSeconds: 3,
} as const satisfies MetricRule

const terminalRule = {
  kind: "terminal",
  label: "상급 목표",
  laterality: "none",
} as const satisfies MetricRule

describe("SetLogger", () => {
  afterEach(() => cleanup())

  it("renders unit labels for duration, tempo, and terminal set records", () => {
    const set = { kind: "single", value: 10, quality: goodQuality() } as const

    const { rerender } = render(<SetList metricRule={durationRule} sets={[set]} />)
    expect(screen.getByText(/10 초/)).toBeVisible()

    rerender(<SetList metricRule={tempoRule} sets={[set]} />)
    expect(screen.getByText(/10 3초 템포/)).toBeVisible()

    rerender(<SetList metricRule={terminalRule} sets={[set]} />)
    expect(screen.getByText(/10 상급 목표/)).toBeVisible()
  })

  it("does not render a form without an active draft", () => {
    const { container } = render(
      <SetForm metricRule={repsRule} onDispatch={vi.fn()} state={stateWithDraft(null)} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it("dispatches RIR, load, pain, and save actions from the rep form", async () => {
    const onDispatch = vi.fn()
    const user = userEvent.setup()

    render(
      <SetForm
        metricRule={repsRule}
        onDispatch={onDispatch}
        state={stateWithDraft({
          kind: "single",
          valueText: "",
          rirText: "2",
          loadText: "",
          quality: goodQuality(),
        })}
      />,
    )

    await user.type(screen.getByRole("spinbutton", { name: "반복 수" }), "12")
    await user.clear(screen.getByRole("spinbutton", { name: "RIR" }))
    await user.type(screen.getByRole("spinbutton", { name: "RIR" }), "1")
    await user.type(screen.getByRole("spinbutton", { name: "중량 kg" }), "5")
    await user.click(screen.getByRole("checkbox", { name: /통증/ }))
    await user.click(screen.getByRole("button", { name: "세트 저장" }))

    expect(onDispatch).toHaveBeenCalledWith({
      field: "pain",
      type: "qualityChanged",
      value: true,
    })
    expect(onDispatch).toHaveBeenLastCalledWith({ type: "setSaved" })
  })

  it("dispatches both sides from a per-side form", async () => {
    const onDispatch = vi.fn()
    const user = userEvent.setup()

    render(
      <SetForm
        metricRule={{ ...repsRule, laterality: "perSide" }}
        onDispatch={onDispatch}
        state={stateWithDraft({
          kind: "perSide",
          leftText: "",
          rightText: "",
          rirText: "2",
          loadText: "",
          quality: goodQuality(),
        })}
      />,
    )

    await user.type(screen.getByRole("spinbutton", { name: "왼쪽" }), "8")
    await user.type(screen.getByRole("spinbutton", { name: "오른쪽" }), "9")

    expect(onDispatch).toHaveBeenCalledWith({
      field: "leftText",
      type: "draftTextChanged",
      value: "8",
    })
    expect(onDispatch).toHaveBeenCalledWith({
      field: "rightText",
      type: "draftTextChanged",
      value: "9",
    })
  })
})

function stateWithDraft(draft: WorkoutState["setDraft"]): WorkoutState {
  return {
    error: null,
    lastAnnouncement: null,
    nowMs: 0,
    session: null,
    setDraft: draft,
    showAbandonDialog: false,
  }
}

function goodQuality() {
  return { pain: false, form: "good" as const, rom: "full" as const }
}
