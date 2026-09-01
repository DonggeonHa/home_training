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
        <li key={`${set.kind}-${index}`}>
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
            value={draft.leftText}
            onChange={(value) =>
              props.onDispatch({ field: "leftText", type: "draftTextChanged", value })
            }
          />
          <NumberInput
            label="오른쪽"
            value={draft.rightText}
            onChange={(value) =>
              props.onDispatch({ field: "rightText", type: "draftTextChanged", value })
            }
          />
        </>
      ) : (
        <NumberInput
          label={props.metricRule.kind === "duration" ? "초" : "반복 수"}
          value={draft.valueText}
          onChange={(value) =>
            props.onDispatch({ field: "valueText", type: "draftTextChanged", value })
          }
        />
      )}
      {props.metricRule.kind === "reps" || props.metricRule.kind === "tempoReps" ? (
        <NumberInput
          label="RIR"
          value={draft.rirText}
          onChange={(value) =>
            props.onDispatch({ field: "rirText", type: "draftTextChanged", value })
          }
        />
      ) : null}
      <NumberInput
        label="중량 kg"
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

function NumberInput(props: {
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
}) {
  return (
    <label className="workout-field">
      <span>{props.label}</span>
      <input
        inputMode="numeric"
        min="0"
        onChange={(event) => props.onChange(event.currentTarget.value)}
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
