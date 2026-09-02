import type { Icon } from "@phosphor-icons/react"
import { ClipboardText, GearSix, House, SneakerMove, TreeStructure } from "@phosphor-icons/react"
import { type ReactElement, Suspense } from "react"
import { Navigate, NavLink, Route, Routes } from "react-router-dom"
import { OnboardingGate } from "../features/onboarding/OnboardingGate"
import type { DownloadPort } from "../storage/ports"
import {
  DashboardRoute,
  HistoryRoute,
  NotFoundRoute,
  RouteLoading,
  SettingsRoute,
  SkillTreeRoute,
  WorkoutRoute,
} from "./route-pages"

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

export function PrimaryNavigation(): ReactElement {
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

type AppRoutesProps = {
  readonly downloads: DownloadPort
  readonly onWorkoutCompleted: (message: string) => void
}

export function AppRoutes({ downloads, onWorkoutCompleted }: AppRoutesProps): ReactElement {
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
