import { assertNever } from "../../domain/assert-never"
import type { MetricRule, SetRecord } from "../../domain/contracts"
import { Button } from "../../shared/ui"
import type { WorkoutAction } from "./reducer"
import type { WorkoutState } from "./types"

export function SetList(props: {
  readonly metricRule: MetricRule
  readonly sets: readonly SetRecord[]
}) {
  return (
    <ol className="workout-set-list">
      {props.sets.map((set, index) => (
        <li key={setRecordKey(set)}>
          {`${index + 1}세트 · ${set.kind === "single" ? set.value : `${set.left}/${set.right}`} ${unitLabel(props.metricRule)}`}
        </li>
      ))}
    </ol>
  )
}

export function SetForm(props: {
  readonly metricRule: MetricRule
  readonly state: WorkoutState
  readonly onDispatch: (action: WorkoutAction) => void
}) {
  const draft = props.state.setDraft
  if (draft === null) {
    return null
  }
  const isPerSide = draft.kind === "perSide"
  return (
    <form className="workout-form" onSubmit={(event) => event.preventDefault()}>
      {isPerSide ? (
        <>
          <NumberInput
            label="왼쪽"
            step="1"
            value={draft.leftText}
            onChange={(value) =>
              props.onDispatch({ field: "leftText", type: "draftTextChanged", value })
            }
          />
          <NumberInput
            label="오른쪽"
            step="1"
            value={draft.rightText}
            onChange={(value) =>
              props.onDispatch({ field: "rightText", type: "draftTextChanged", value })
            }
          />
        </>
      ) : (
        <NumberInput
          label={props.metricRule.kind === "duration" ? "초" : "반복 수"}
          step="1"
          value={draft.valueText}
          onChange={(value) =>
            props.onDispatch({ field: "valueText", type: "draftTextChanged", value })
          }
        />
      )}
      {props.metricRule.kind === "reps" || props.metricRule.kind === "tempoReps" ? (
        <NumberInput
          label="RIR"
          max="5"
          step="1"
          value={draft.rirText}
          onChange={(value) =>
            props.onDispatch({ field: "rirText", type: "draftTextChanged", value })
          }
        />
      ) : null}
      <NumberInput
        label="중량 kg"
        inputMode="decimal"
        step="0.5"
        value={draft.loadText}
        onChange={(value) =>
          props.onDispatch({ field: "loadText", type: "draftTextChanged", value })
        }
      />
      <label className="workout-check">
        <input
          type="checkbox"
          checked={draft.quality.pain}
          onChange={(event) =>
            props.onDispatch({
              field: "pain",
              type: "qualityChanged",
              value: event.currentTarget.checked,
            })
          }
        />
        <span>통증 또는 중단 신호가 있었습니다</span>
      </label>
      <Button onClick={() => props.onDispatch({ type: "setSaved" })}>세트 저장</Button>
    </form>
  )
}

function setRecordKey(set: SetRecord): string {
  const rir = set.rir ?? "none"
  const loadKg = set.loadKg ?? "none"
  const quality = `${set.quality.pain}-${set.quality.form}-${set.quality.rom}`

  switch (set.kind) {
    case "single":
      return `${set.kind}-${set.value}-${rir}-${loadKg}-${quality}`
    case "perSide":
      return `${set.kind}-${set.left}-${set.right}-${rir}-${loadKg}-${quality}`
    default:
      return assertNever(set)
  }
}

function NumberInput(props: {
  readonly label: string
  readonly inputMode?: "decimal" | "numeric" | undefined
  readonly max?: string | undefined
  readonly step: string
  readonly value: string
  readonly onChange: (value: string) => void
}) {
  return (
    <label className="workout-field">
      <span>{props.label}</span>
      <input
        inputMode={props.inputMode ?? "numeric"}
        max={props.max}
        min="0"
        onChange={(event) => props.onChange(event.currentTarget.value)}
        step={props.step}
        type="number"
        value={props.value}
      />
    </label>
  )
}

function unitLabel(rule: MetricRule): string {
  switch (rule.kind) {
    case "duration":
      return "초"
    case "reps":
      return "회"
    case "tempoReps":
      return `${rule.tempoSeconds}초 템포`
    case "terminal":
      return rule.label
    /* c8 ignore next 2 */
    default:
      return assertNever(rule)
  }
}
