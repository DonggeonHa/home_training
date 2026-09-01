import { useCallback, useEffect, useRef, useState } from "react"
import { formatTargetLabel } from "../../domain/catalog"
import type { CategoryId, SessionId } from "../../domain/contracts"
import { getRestTimerSnapshot } from "../../domain/rest-timer"
import { Button, Notice, Progress } from "../../shared/ui"
import type { StoredState } from "../../storage/schemas"
import {
  currentCategoryPlan,
  finishWorkout,
  globalStopSignals,
  readCatalogCategory,
  toActiveSessionPatch,
} from "./engine"
import { RestTimerPanel } from "./RestTimerPanel"
import {
  createWorkoutState,
  readCategoryAdvanceReadiness,
  reduceWorkout,
  type WorkoutAction,
} from "./reducer"
import {
  AbandonDialog,
  GuidanceList,
  PullChecklist,
  uniqueItems,
  WarmupList,
} from "./SessionSections"
import { SetForm, SetList } from "./SetLogger"
import type { WorkoutState, WorkoutStoragePatch } from "./types"
import "./workout-session.css"

type WorkoutSessionPageProps = {
  readonly stored: StoredState
  readonly nowMs?: number | undefined
  readonly sessionId?: SessionId | undefined
  readonly onActiveSessionChange?: (activeSession: WorkoutStoragePatch["activeSession"]) => void
  readonly onComplete?: (patch: WorkoutStoragePatch) => void
}

export function WorkoutSessionPage(props: WorkoutSessionPageProps) {
  const { nowMs, onActiveSessionChange, onComplete, sessionId, stored } = props
  const [state, setState] = useState(() => createInitialState({ nowMs, sessionId, stored }))
  const stateRef = useRef(state)
  const completedSessionIdRef = useRef<SessionId | null>(null)
  const lastActivePatchKeyRef = useRef<string | null>(null)
  const emitState = useCallback(
    (nextState: WorkoutState) => {
      if (nextState.session?.completed === true) {
        if (completedSessionIdRef.current === nextState.session.id) {
          return
        }
        completedSessionIdRef.current = nextState.session.id
        lastActivePatchKeyRef.current = null
        onComplete?.(
          finishWorkout({
            now: new Date(nextState.nowMs),
            session: nextState.session,
            stored,
          }),
        )
        return
      }

      const activeSession = toActiveSessionPatch(nextState)
      const activePatchKey = JSON.stringify(activeSession)
      if (activePatchKey === lastActivePatchKeyRef.current) {
        return
      }
      lastActivePatchKeyRef.current = activePatchKey
      onActiveSessionChange?.(activeSession)
    },
    [onActiveSessionChange, onComplete, stored],
  )
  const dispatchWorkout = useCallback(
    (action: WorkoutAction) => {
      const nextState = reduceWorkout(stateRef.current, action)
      stateRef.current = nextState
      setState(nextState)
      emitState(nextState)
    },
    [emitState],
  )
  const restEndsAt = state.session?.restEndsAt ?? null
  useEffect(() => {
    if (nowMs !== undefined || restEndsAt === null) {
      return
    }
    const timer = window.setInterval(() => {
      const nextState = reduceWorkout(stateRef.current, { nowMs: Date.now(), type: "tick" })
      stateRef.current = nextState
      setState(nextState)
      emitState(nextState)
    }, 1_000)
    return () => window.clearInterval(timer)
  }, [emitState, nowMs, restEndsAt])

  const renderedState = nowMs === undefined ? state : reduceWorkout(state, { nowMs, type: "tick" })
  const session = renderedState.session

  if (session === null) {
    return (
      <section className="workout-page compact" aria-labelledby="workout-stopped-title">
        <h1 id="workout-stopped-title">세션이 중단되었습니다</h1>
        <p>포기한 세션은 완료 기록이나 레벨 판정에 반영하지 않습니다.</p>
      </section>
    )
  }

  const plan = currentCategoryPlan(session)
  const category = readCatalogCategory(plan.categoryId)
  const categoryWarmupComplete =
    session.categoryWarmupCompleteByCategory[categoryWarmupKey(plan.categoryId)]
  const progressValue = plan.entry.sets.length
  const categoryAdvance = readCategoryAdvanceReadiness(session)
  const restRemaining =
    session.restEndsAt === null
      ? null
      : getRestTimerSnapshot({
          nowMs: renderedState.nowMs,
          timer: { restEndsAt: session.restEndsAt },
        }).remainingSeconds

  return (
    <section className="workout-page" aria-labelledby="workout-title">
      <header className="workout-hero">
        <p className="panel-label">오늘의 루틴</p>
        <h1 id="workout-title">{`Routine ${session.routineId} · ${plan.categoryTitle}`}</h1>
        <p>{`${plan.entry.exerciseName} · ${formatTargetLabel(plan.entry.metricRule)}`}</p>
      </header>

      <section className="workout-panel" aria-labelledby="warmup-title">
        <h2 id="warmup-title">워밍업</h2>
        <WarmupList complete={session.commonWarmupComplete} />
        <Button
          disabled={session.commonWarmupComplete}
          onClick={() => dispatchWorkout({ type: "commonWarmupCompleted" })}
        >
          공통 워밍업 완료
        </Button>
      </section>

      <section className="workout-panel" aria-labelledby="category-title">
        <h2 id="category-title">{`${category.title} 준비`}</h2>
        <ul className="workout-list">
          {category.warmup.map((item) => (
            <li key={item}>{categoryWarmupComplete ? `완료 · ${item}` : item}</li>
          ))}
        </ul>
        <Button
          disabled={categoryWarmupComplete}
          onClick={() => dispatchWorkout({ type: "categoryWarmupCompleted" })}
        >
          카테고리 워밍업 완료
        </Button>
        <GuidanceList title="자세 핵심" items={plan.instructions} />
        <GuidanceList title="주의할 실수" items={plan.mistakes} />
        <GuidanceList
          title="중단 신호"
          items={uniqueItems([...plan.safety, ...globalStopSignals()])}
        />
      </section>

      {category.doorframeBarChecklist === undefined ? null : (
        <PullChecklist
          confirmed={plan.pullChecklistConfirmed}
          items={category.doorframeBarChecklist}
          onConfirm={() => dispatchWorkout({ type: "pullChecklistConfirmed" })}
        />
      )}

      <section className="workout-panel" aria-labelledby="sets-title">
        <h2 id="sets-title">본운동 기록</h2>
        <Progress label="세트 진행" max={plan.prescribedSetCount} value={progressValue} />
        <SetList metricRule={plan.entry.metricRule} sets={plan.entry.sets} />
        {renderedState.error === null ? null : (
          <Notice
            title="확인 필요"
            tone={renderedState.error.includes("119") ? "error" : "warning"}
          >
            <p>{renderedState.error}</p>
          </Notice>
        )}
        {renderedState.setDraft === null ? (
          <Button
            disabled={plan.stoppedByPain}
            onClick={() => dispatchWorkout({ type: "setDraftOpened" })}
          >
            세트 기록
          </Button>
        ) : (
          <SetForm
            metricRule={plan.entry.metricRule}
            state={renderedState}
            onDispatch={dispatchWorkout}
          />
        )}
      </section>

      <RestTimerPanel
        lastAnnouncement={renderedState.lastAnnouncement}
        remainingSeconds={restRemaining}
        onDispatch={dispatchWorkout}
      />

      <footer className="workout-sticky">
        <Button
          disabled={!categoryAdvance.canAdvance}
          onClick={() => dispatchWorkout({ type: "categoryAdvanced" })}
          variant="secondary"
        >
          {categoryAdvance.label}
        </Button>
        <Button onClick={() => dispatchWorkout({ type: "abandonRequested" })} variant="ghost">
          세션 포기
        </Button>
      </footer>
      <AbandonDialog
        open={renderedState.showAbandonDialog}
        onCancel={() => dispatchWorkout({ type: "abandonCancelled" })}
        onConfirm={() => dispatchWorkout({ type: "abandonConfirmed" })}
      />
    </section>
  )
}

function createInitialState(input: {
  readonly stored: StoredState
  readonly nowMs?: number | undefined
  readonly sessionId?: SessionId | undefined
}): WorkoutState {
  return createWorkoutState({
    nowMs: input.nowMs ?? Date.now(),
    sessionId: input.sessionId,
    stored: input.stored,
  })
}

function categoryWarmupKey(
  categoryId: CategoryId,
): keyof NonNullable<WorkoutState["session"]>["categoryWarmupCompleteByCategory"] {
  return categoryId as keyof NonNullable<
    WorkoutState["session"]
  >["categoryWarmupCompleteByCategory"]
}
