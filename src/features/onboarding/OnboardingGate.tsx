import type { ReactNode } from "react"
import { useState } from "react"
import { useAppStore } from "../../app/store/provider"
import {
  selectAssessmentStep,
  selectCanUseDashboard,
  selectSafetyGate,
} from "../../app/store/selectors"
import { Notice } from "../../shared/ui"
import { AssessmentOnboarding } from "./AssessmentOnboarding"
import { SafetyOnboarding } from "./SafetyOnboarding"
import "./onboarding.css"

type OnboardingGateProps = {
  readonly children: ReactNode
}

export function OnboardingGate({ children }: OnboardingGateProps) {
  const [focusSafetyForm, setFocusSafetyForm] = useState(false)
  const { actions, state } = useAppStore()
  const safetyGate = selectSafetyGate(state)
  const assessmentStep = selectAssessmentStep(state)

  if (selectCanUseDashboard(state)) {
    return (
      <>
        <PersistenceNotices />
        {children}
      </>
    )
  }

  return (
    <div className="onboarding-stack">
      <PersistenceNotices />
      {safetyGate.kind === "cleared" ? null : (
        <SafetyOnboarding
          focusFirst={focusSafetyForm}
          gate={safetyGate}
          onReset={() => {
            actions.resetSafetyReview()
            setFocusSafetyForm(true)
          }}
          onSubmit={(answers) => {
            setFocusSafetyForm(false)
            actions.submitSafetyAnswers(answers)
          }}
        />
      )}
      {safetyGate.kind === "cleared" ? (
        <AssessmentOnboarding
          onStart={actions.startAssessment}
          onSubmitSet={actions.submitAssessmentSet}
          step={assessmentStep}
        />
      ) : null}
    </div>
  )
}

function PersistenceNotices() {
  const { state } = useAppStore()
  return (
    <>
      {state.loadNotice === undefined ? null : (
        <Notice title="저장된 데이터를 복구했습니다" tone="warning">
          <p>손상되었거나 지원하지 않는 저장 데이터는 기본 상태로 대체했습니다.</p>
        </Notice>
      )}
      {state.saveNotice === undefined ? null : (
        <Notice title="저장에 실패했습니다" tone="error">
          <p>
            브라우저 저장소가 현재 쓰기를 거부했습니다. 화면의 진행 상태가 저장되지 않을 수
            있습니다.
          </p>
        </Notice>
      )}
    </>
  )
}
