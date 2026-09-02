import { Pulse } from "@phosphor-icons/react"
import { lazy, type ReactElement, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { EXERCISE_CATALOG } from "../domain/catalog"
import type { CategoryId } from "../domain/contracts"
import type { SettingsRestoreCommitResult } from "../features/settings/restore-contract"
import type { WorkoutStoragePatch } from "../features/workout-session/types"
import type { DownloadPort } from "../storage/ports"
import { useAppStore } from "./store/provider"
import type { WorkoutCompletionPatch } from "./store/types"

const DashboardView = lazy(() =>
  import("../features/dashboard/DashboardView").then((module) => ({
    default: module.DashboardView,
  })),
)
const HistoryView = lazy(() =>
  import("../features/history/HistoryView").then((module) => ({
    default: module.HistoryView,
  })),
)
const SettingsView = lazy(() =>
  import("../features/settings/SettingsView").then((module) => ({
    default: module.SettingsView,
  })),
)
const SkillTreeView = lazy(() =>
  import("../features/skill-tree/SkillTreeView").then((module) => ({
    default: module.SkillTreeView,
  })),
)
const WorkoutSessionPage = lazy(() =>
  import("../features/workout-session/WorkoutSessionPage").then((module) => ({
    default: module.WorkoutSessionPage,
  })),
)

export function RouteLoading(): ReactElement {
  return (
    <section className="route-page compact" aria-labelledby="route-loading-title">
      <Pulse size={36} weight="duotone" aria-hidden="true" />
      <h1 id="route-loading-title">화면을 불러오는 중입니다</h1>
      <p role="status">운동 데이터를 유지한 채 다음 화면을 준비하고 있습니다.</p>
    </section>
  )
}

export function DashboardRoute(): ReactElement {
  const { state } = useAppStore()
  useDocumentTitle("오늘의 대시보드")

  return <DashboardView startHref="#/workout" state={state.stored} />
}

type WorkoutRouteProps = {
  readonly onWorkoutCompleted: (message: string) => void
}

export function WorkoutRoute({ onWorkoutCompleted }: WorkoutRouteProps): ReactElement {
  const navigate = useNavigate()
  const { actions, state } = useAppStore()
  useDocumentTitle("운동 세션")

  return (
    <WorkoutSessionPage
      stored={state.stored}
      onActiveSessionChange={actions.changeActiveSession}
      onComplete={(patch) => {
        if (!isCompletionPatch(patch)) {
          return
        }
        actions.applyWorkoutCompletion(patch)
        onWorkoutCompleted(`루틴 ${state.stored.nextRoutine} 완료`)
        navigate("/", { replace: true })
      }}
    />
  )
}

export function SkillTreeRoute(): ReactElement {
  const { categoryId } = useParams()
  const { state } = useAppStore()
  const selectedCategoryId = readSelectedCategoryId(categoryId)
  const selectedCategory = EXERCISE_CATALOG.find((category) => category.id === selectedCategoryId)
  useDocumentTitle(
    selectedCategory === undefined ? "전체 스킬트리" : `${selectedCategory.title} 스킬트리`,
  )

  if (categoryId !== undefined && selectedCategoryId === null) {
    return <NotFoundRoute />
  }

  return <SkillTreeView selectedCategoryId={selectedCategoryId ?? undefined} state={state.stored} />
}

export function HistoryRoute(): ReactElement {
  const { state } = useAppStore()
  useDocumentTitle("기록과 성장")

  return <HistoryView state={state.stored} />
}

type SettingsRouteProps = {
  readonly downloads: DownloadPort
}

export function SettingsRoute({ downloads }: SettingsRouteProps): ReactElement {
  const { actions, state } = useAppStore()
  useDocumentTitle("설정과 백업")

  return (
    <SettingsView
      currentState={state.stored}
      downloads={downloads}
      onReducedMotionChange={actions.setReducedMotionPreference}
      onRestoreConfirmed={(nextState): SettingsRestoreCommitResult =>
        actions.replaceStoredState(nextState)
      }
      onThemeChange={actions.setThemePreference}
      reducedMotion={state.display.reducedMotionPreference}
      theme={state.display.themePreference}
    />
  )
}

export function NotFoundRoute(): ReactElement {
  useDocumentTitle("페이지 없음")

  return <NotFoundPage />
}

function NotFoundPage(): ReactElement {
  return (
    <section className="route-page compact" aria-labelledby="not-found-title">
      <Pulse size={36} weight="duotone" aria-hidden="true" />
      <h1 id="not-found-title">페이지를 찾을 수 없습니다</h1>
      <p>지원하지 않는 주소입니다. 홈 화면에서 다시 시작하세요.</p>
      <a className="ui-button ui-button-primary" href="#/">
        홈으로 돌아가기
      </a>
    </section>
  )
}

function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} | 홈트레이닝 LEVEL UP`
  }, [title])
}

function readSelectedCategoryId(categoryId: string | undefined): CategoryId | null {
  if (categoryId === undefined) {
    return null
  }

  return EXERCISE_CATALOG.find((category) => category.id === categoryId)?.id ?? null
}

function isCompletionPatch(patch: WorkoutStoragePatch): patch is WorkoutCompletionPatch {
  return patch.activeSession === null
}
