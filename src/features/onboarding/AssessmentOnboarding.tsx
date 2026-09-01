import { ArrowRight, FloppyDisk, Play } from "@phosphor-icons/react"
import { useState } from "react"
import type { AssessmentSetInput, AssessmentStep } from "../../app/store"
import { Button, Field, Notice } from "../../shared/ui"

type AssessmentOnboardingProps = {
  readonly onStart: () => void
  readonly onSubmitSet: (input: AssessmentSetInput) => void
  readonly step: AssessmentStep
}

export function AssessmentOnboarding({ onStart, onSubmitSet, step }: AssessmentOnboardingProps) {
  switch (step.kind) {
    case "blocked":
      return null
    case "ready":
      return (
        <section className="onboarding-panel" aria-labelledby="assessment-ready-title">
          <p className="panel-label">Baseline assessment</p>
          <h1 id="assessment-ready-title">기초 레벨 평가</h1>
          <p>
            카탈로그 순서대로 한 카테고리씩 확인합니다. 통증, 자세 실패, 가동범위 제한, 또는 첫
            미달이 나오면 해당 카테고리는 마지막 안전 레벨에서 멈춥니다.
          </p>
          <Button onClick={onStart}>
            <Play size={20} weight="duotone" aria-hidden="true" />
            기초 레벨 평가 시작
          </Button>
        </section>
      )
    case "active":
      return <ActiveAssessmentStep onSubmitSet={onSubmitSet} step={step} />
    case "complete":
      return (
        <section className="onboarding-panel" aria-labelledby="assessment-complete-title">
          <p className="panel-label">Assessment complete</p>
          <h1 id="assessment-complete-title">기초 레벨 평가 완료</h1>
          <Notice title="대시보드 준비 완료" tone="success">
            <p>모든 카테고리에 보수적인 임시 레벨이 저장되었습니다.</p>
          </Notice>
        </section>
      )
    default:
      return assertAssessmentNever(step)
  }
}

function ActiveAssessmentStep({
  onSubmitSet,
  step,
}: {
  readonly onSubmitSet: (input: AssessmentSetInput) => void
  readonly step: Extract<AssessmentStep, { readonly kind: "active" }>
}) {
  const [singleValue, setSingleValue] = useState("")
  const [leftValue, setLeftValue] = useState("")
  const [rightValue, setRightValue] = useState("")
  const [formGood, setFormGood] = useState(false)
  const [romFull, setRomFull] = useState(false)
  const [pain, setPain] = useState(false)
  const inputValid =
    step.metricKind === "single"
      ? singleValue.trim().length > 0
      : leftValue.trim().length > 0 && rightValue.trim().length > 0

  return (
    <section className="onboarding-panel" aria-label="기초 레벨 평가">
      <p className="panel-label">{`${step.categoryTitle} ${step.level + 1} / ${
        step.eligibleLevelCount
      }`}</p>
      <h1 id="assessment-title">{`${step.categoryTitle} Lv.${step.level}`}</h1>
      <p>{`${step.exerciseName} 목표: ${step.targetLabel}`}</p>
      <form
        className="onboarding-form"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmitSet(
            createAssessmentInput({
              singleValue,
              leftValue,
              rightValue,
              formGood,
              romFull,
              pain,
              step,
            }),
          )
          setSingleValue("")
          setLeftValue("")
          setRightValue("")
          setFormGood(false)
          setRomFull(false)
          setPain(false)
        }}
      >
        {step.metricKind === "single" ? (
          <Field id="assessment-value" label={step.targetLabel.includes("초") ? "초" : "반복 수"}>
            <input
              inputMode="numeric"
              min={0}
              onChange={(event) => setSingleValue(event.currentTarget.value)}
              required
              type="number"
              value={singleValue}
            />
          </Field>
        ) : (
          <div className="assessment-pair">
            <Field id="assessment-left" label="왼쪽">
              <input
                inputMode="numeric"
                min={0}
                onChange={(event) => setLeftValue(event.currentTarget.value)}
                required
                type="number"
                value={leftValue}
              />
            </Field>
            <Field id="assessment-right" label="오른쪽">
              <input
                inputMode="numeric"
                min={0}
                onChange={(event) => setRightValue(event.currentTarget.value)}
                required
                type="number"
                value={rightValue}
              />
            </Field>
          </div>
        )}
        <label className="check-row">
          <input
            checked={formGood}
            onChange={(event) => setFormGood(event.currentTarget.checked)}
            type="checkbox"
          />
          <span>자세가 안정적입니다</span>
        </label>
        <label className="check-row">
          <input
            checked={romFull}
            onChange={(event) => setRomFull(event.currentTarget.checked)}
            type="checkbox"
          />
          <span>통증 없는 전체 가동범위입니다</span>
        </label>
        <label className="check-row">
          <input
            checked={pain}
            onChange={(event) => setPain(event.currentTarget.checked)}
            type="checkbox"
          />
          <span>평가 중 통증이나 중단 신호가 있었습니다</span>
        </label>
        <Button disabled={!inputValid} type="submit">
          <FloppyDisk size={20} weight="duotone" aria-hidden="true" />
          평가 세트 저장
        </Button>
      </form>
      <div className="onboarding-actions">
        <ArrowRight size={24} weight="duotone" aria-hidden="true" />
        <p>미달 또는 통증이 있으면 이 카테고리는 즉시 멈추고 다음 카테고리로 이동합니다.</p>
      </div>
    </section>
  )
}

type InputDraft = {
  readonly singleValue: string
  readonly leftValue: string
  readonly rightValue: string
  readonly formGood: boolean
  readonly romFull: boolean
  readonly pain: boolean
  readonly step: Extract<AssessmentStep, { readonly kind: "active" }>
}

function createAssessmentInput(draft: InputDraft): AssessmentSetInput {
  const quality = {
    pain: draft.pain,
    form: draft.formGood ? ("good" as const) : ("failed" as const),
    rom: draft.romFull ? ("full" as const) : ("failed" as const),
  }

  return draft.step.metricKind === "single"
    ? { kind: "single", value: Number(draft.singleValue), ...quality }
    : {
        kind: "perSide",
        left: Number(draft.leftValue),
        right: Number(draft.rightValue),
        ...quality,
      }
}

function assertAssessmentNever(value: never): never {
  throw new Error(`Unhandled assessment step: ${JSON.stringify(value)}`)
}
