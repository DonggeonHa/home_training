import type { Icon } from "@phosphor-icons/react"
import {
  ClipboardText,
  GearSix,
  House,
  Pulse,
  SneakerMove,
  TreeStructure,
} from "@phosphor-icons/react"
import { lazy, Suspense, useEffect } from "react"
import { Navigate, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom"
import { EXERCISE_CATALOG } from "../domain/catalog"
import type { CategoryId } from "../domain/contracts"
import { OnboardingGate } from "../features/onboarding/OnboardingGate"
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

type RouteDefinition = {
  readonly description: string
  readonly href: string
  readonly icon: Icon
  readonly title: string
}

const routes = [
  {
    description: "오늘 할 일을 확인하고 다음 운동을 준비합니다.",
    href: "/",
    icon: House,
    title: "홈",
  },
  {
    description: "세트와 휴식 기록을 남기며 오늘 루틴을 진행합니다.",
    href: "/workout",
    icon: SneakerMove,
    title: "운동",
  },
  {
    description: "레벨별 운동 흐름과 진행 조건을 확인합니다.",
    href: "/levels",
    icon: TreeStructure,
    title: "레벨",
  },
  {
    description: "세트, 반복, 휴식 기록을 남길 화면입니다.",
    href: "/record",
    icon: ClipboardText,
    title: "기록",
  },
  {
    description: "테마, 움직임 줄이기, 백업과 복원을 관리합니다.",
    href: "/settings",
    icon: GearSix,
    title: "설정",
  },
] as const satisfies readonly RouteDefinition[]

export function PrimaryNavigation() {
  return (
    <nav className="app-nav" aria-label="주요 메뉴">
      {routes.map((route) => (
        <NavLink
          className={({ isActive }) => (isActive ? "app-nav-link active" : "app-nav-link")}
          end={route.href === "/"}
          key={route.href}
          to={route.href}
        >
          <route.icon size={22} weight="duotone" aria-hidden="true" />
          <span>{route.title}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function NotFoundPage() {
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

function NotFoundRoute() {
  useDocumentTitle("페이지 없음")

  return <NotFoundPage />
}

type AppRoutesProps = {
  readonly downloads: DownloadPort
  readonly onWorkoutCompleted: (message: string) => void
}

export function AppRoutes({ downloads, onWorkoutCompleted }: AppRoutesProps) {
  return (
    <OnboardingGate>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route element={<DashboardRoute />} path="/" />
          <Route
            element={<WorkoutRoute onWorkoutCompleted={onWorkoutCompleted} />}
            path="/workout"
          />
          <Route element={<SkillTreeRoute />} path="/levels" />
          <Route element={<SkillTreeRoute />} path="/levels/:categoryId" />
          <Route element={<HistoryRoute />} path="/record" />
          <Route element={<SettingsRoute downloads={downloads} />} path="/settings" />
          <Route element={<Navigate replace to="/settings" />} path="/plan" />
          <Route element={<NotFoundRoute />} path="*" />
        </Routes>
      </Suspense>
    </OnboardingGate>
  )
}

function RouteLoading() {
  return (
    <section className="route-page compact" aria-labelledby="route-loading-title">
      <Pulse size={36} weight="duotone" aria-hidden="true" />
      <h1 id="route-loading-title">화면을 불러오는 중입니다</h1>
      <p role="status">운동 데이터를 유지한 채 다음 화면을 준비하고 있습니다.</p>
    </section>
  )
}

function DashboardRoute() {
  const { state } = useAppStore()
  useDocumentTitle("오늘의 대시보드")

  return <DashboardView startHref="#/workout" state={state.stored} />
}

function WorkoutRoute({
  onWorkoutCompleted,
}: {
  readonly onWorkoutCompleted: (message: string) => void
}) {
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

function SkillTreeRoute() {
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

function HistoryRoute() {
  const { state } = useAppStore()
  useDocumentTitle("기록과 성장")

  return <HistoryView state={state.stored} />
}

function SettingsRoute({ downloads }: { readonly downloads: DownloadPort }) {
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
