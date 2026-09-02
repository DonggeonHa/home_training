import { FirstAidKit } from "@phosphor-icons/react/FirstAidKit"
import { WarningCircle } from "@phosphor-icons/react/WarningCircle"
import { forwardRef, useEffect, useRef, useState } from "react"
import type { SafetyAnswers, SafetyGate } from "../../app/store"
import { Button, Notice } from "../../shared/ui"

const clearAnswers: SafetyAnswers = {
  chestPain: false,
  faintingOrSevereDizziness: false,
  unusualShortnessOfBreath: false,
  cardiovascularMetabolicRenalDisease: false,
  recentInjury: false,
}

type SafetyOnboardingProps = {
  readonly focusFirst: boolean
  readonly gate: SafetyGate
  readonly onReset: () => void
  readonly onSubmit: (answers: SafetyAnswers) => void
}

export function SafetyOnboarding({ focusFirst, gate, onReset, onSubmit }: SafetyOnboardingProps) {
  const [answers, setAnswers] = useState(clearAnswers)
  const firstCheckboxRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (focusFirst && gate.kind === "needsReview") {
      firstCheckboxRef.current?.focus()
    }
  }, [focusFirst, gate.kind])

  if (gate.kind === "blocked") {
    return <SafetyBlocked gate={gate} onReset={onReset} />
  }

  return (
    <section className="onboarding-panel" aria-labelledby="safety-title">
      <p className="panel-label">Safety screening</p>
      <h1 id="safety-title">운동 전 안전 확인</h1>
      <p>
        이 앱은 운동 기록과 진행 판단을 돕는 도구이며 의료 진단이나 처방을 제공하지 않습니다. 아래
        항목 중 해당되는 것이 있으면 평가와 운동을 시작하지 않습니다.
      </p>
      <form
        className="onboarding-form"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(answers)
        }}
      >
        <SafetyCheckbox
          checked={answers.chestPain}
          label="현재 흉통, 심한 흉부 압박감, 또는 지속되는 가슴 불편감이 있습니다"
          name="chestPain"
          onChange={(checked) => setAnswers({ ...answers, chestPain: checked })}
          ref={firstCheckboxRef}
        />
        <SafetyCheckbox
          checked={answers.faintingOrSevereDizziness}
          label="실신했거나 심한 어지럼증이 있습니다"
          name="faintingOrSevereDizziness"
          onChange={(checked) => setAnswers({ ...answers, faintingOrSevereDizziness: checked })}
        />
        <SafetyCheckbox
          checked={answers.unusualShortnessOfBreath}
          label="평소와 다른 숨참 또는 호흡 곤란이 있습니다"
          name="unusualShortnessOfBreath"
          onChange={(checked) => setAnswers({ ...answers, unusualShortnessOfBreath: checked })}
        />
        <SafetyCheckbox
          checked={answers.cardiovascularMetabolicRenalDisease}
          label="심혈관, 대사, 신장 질환을 진단받았거나 관리 중입니다"
          name="cardiovascularMetabolicRenalDisease"
          onChange={(checked) =>
            setAnswers({ ...answers, cardiovascularMetabolicRenalDisease: checked })
          }
        />
        <SafetyCheckbox
          checked={answers.recentInjury}
          label="최근 부상, 날카로운 관절 통증, 저림 또는 감각 이상이 있습니다"
          name="recentInjury"
          onChange={(checked) => setAnswers({ ...answers, recentInjury: checked })}
        />
        <Button type="submit">안전 확인 제출</Button>
      </form>
    </section>
  )
}

type SafetyCheckboxProps = {
  readonly checked: boolean
  readonly label: string
  readonly name: keyof SafetyAnswers
  readonly onChange: (checked: boolean) => void
}

const SafetyCheckbox = forwardRef<HTMLInputElement, SafetyCheckboxProps>(function SafetyCheckbox(
  { checked, label, name, onChange },
  ref,
) {
  return (
    <label className="check-row">
      <input
        checked={checked}
        name={name}
        onChange={(event) => onChange(event.currentTarget.checked)}
        ref={ref}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  )
})

function SafetyBlocked({
  gate,
  onReset,
}: {
  readonly gate: SafetyGate
  readonly onReset: () => void
}) {
  const urgent = gate.kind === "blocked" && gate.urgent
  return (
    <section className="onboarding-panel" aria-labelledby="safety-title">
      <p className="panel-label">Safety hold</p>
      <h1 id="safety-title">운동 전 안전 확인</h1>
      <Notice title="평가와 운동을 시작하지 않습니다" tone="error">
        <p>
          이 앱은 의료 진단이나 처방을 제공하지 않습니다. 선택한 항목이 있다면 운동을 보류하고 의료
          전문가와 상담하세요.
        </p>
        {urgent ? (
          <p>현재 또는 심한 흉통, 지속되는 가슴 불편감, 실신 증상이 있으면 119에 연락하세요.</p>
        ) : null}
      </Notice>
      <div className="onboarding-actions">
        <FirstAidKit size={28} weight="duotone" aria-hidden="true" />
        <p>증상이 사라졌다고 앱이 운동 가능 여부를 판단하지 않습니다. 답변은 저장되지 않습니다.</p>
      </div>
      <Button onClick={onReset} variant="secondary">
        <WarningCircle size={20} weight="duotone" aria-hidden="true" />
        답변 다시 확인
      </Button>
    </section>
  )
}
