import type { SetQuality } from "../../domain/contracts"
import { startRestTimer } from "../../domain/rest-timer"
import { acceptsRir, currentCategoryPlan, EMERGENCY_STOP_GUIDANCE } from "./engine"
import { replaceCurrentPlan, updateSession } from "./session-state-helpers"
import { parseSetRecord } from "./set-record-parser"
import { maybeSwitchFailedFirstTestSetToCurrentLevel } from "./test-fallback"
import type { WorkoutState } from "./types"

export type DraftTextField = "valueText" | "leftText" | "rightText" | "rirText" | "loadText"

const goodQuality = {
  pain: false,
  form: "good",
  rom: "full",
} as const satisfies SetQuality

export function completeCategoryWarmup(state: WorkoutState): WorkoutState {
  if (state.session === null) {
    return state
  }
  const plan = currentCategoryPlan(state.session)
  return updateSession(state, {
    categoryWarmupCompleteByCategory: {
      ...state.session.categoryWarmupCompleteByCategory,
      [plan.categoryId]: true,
    },
  })
}

export function confirmPullChecklist(state: WorkoutState): WorkoutState {
  if (state.session === null) {
    return state
  }
  const plan = currentCategoryPlan(state.session)
  return replaceCurrentPlan(state, { ...plan, pullChecklistConfirmed: true })
}

export function openSetDraft(state: WorkoutState): WorkoutState {
  if (state.session === null || !state.session.commonWarmupComplete) {
    return { ...state, error: "공통 워밍업을 먼저 완료하세요." }
  }
  const plan = currentCategoryPlan(state.session)
  if (!plan.pullChecklistConfirmed) {
    return { ...state, error: "철봉 설치와 흔들림 확인을 모두 완료해야 세트를 기록할 수 있습니다." }
  }
  const metric = plan.entry.metricRule
  return {
    ...state,
    error: null,
    setDraft:
      metric.laterality === "perSide"
        ? {
            kind: "perSide",
            leftText: "",
            rightText: "",
            rirText: "2",
            loadText: "",
            quality: goodQuality,
          }
        : { kind: "single", valueText: "", rirText: "2", loadText: "", quality: goodQuality },
  }
}

export function changeDraftText(
  state: WorkoutState,
  field: DraftTextField,
  value: string,
): WorkoutState {
  if (state.setDraft === null) {
    return state
  }
  return { ...state, setDraft: { ...state.setDraft, [field]: value } }
}

export function changeQuality(
  state: WorkoutState,
  field: keyof SetQuality,
  value: boolean,
): WorkoutState {
  if (state.setDraft === null) {
    return state
  }
  if (field === "pain") {
    return {
      ...state,
      setDraft: { ...state.setDraft, quality: { ...state.setDraft.quality, pain: value } },
    }
  }
  return {
    ...state,
    setDraft: {
      ...state.setDraft,
      quality: { ...state.setDraft.quality, [field]: value ? "failed" : "good" },
    },
  }
}

export function saveSet(state: WorkoutState): WorkoutState {
  if (state.session === null || state.setDraft === null) {
    return state
  }
  const plan = currentCategoryPlan(state.session)
  const parsed = parseSetRecord({
    draft: state.setDraft,
    acceptsRir: acceptsRir(plan.entry.metricRule),
  })
  if (parsed === null) {
    return { ...state, error: "0 이상의 숫자로 세트 기록을 입력하세요." }
  }
  const withPlan = replaceCurrentPlan(
    { ...state, setDraft: null },
    {
      ...plan,
      entry: { ...plan.entry, sets: [...plan.entry.sets, parsed] },
      stoppedByPain: parsed.quality.pain,
    },
  )
  const savedSession = withPlan.session as NonNullable<WorkoutState["session"]>
  if (parsed.quality.pain) {
    return {
      ...withPlan,
      error: EMERGENCY_STOP_GUIDANCE,
      session: { ...savedSession, restEndsAt: null },
    }
  }
  const fallbackState = maybeSwitchFailedFirstTestSetToCurrentLevel(withPlan)
  const fallbackSession = fallbackState.session as NonNullable<WorkoutState["session"]>
  const restPlan = currentCategoryPlan(fallbackSession)
  return updateSession(fallbackState, {
    restEndsAt: startRestTimer({
      durationSeconds: restPlan.entry.metricRule.kind === "terminal" ? 0 : restPlan.restSeconds,
      nowMs: state.nowMs,
    }).restEndsAt,
  })
}
