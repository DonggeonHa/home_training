import type { Icon } from "@phosphor-icons/react"
import { CalendarCheck, ClipboardText, House, Pulse, TreeStructure } from "@phosphor-icons/react"
import { NavLink, Route, Routes } from "react-router-dom"
import { Card, Notice, Progress } from "../shared/ui"

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
    description: "주간 루틴과 휴식일을 확인할 화면입니다.",
    href: "/plan",
    icon: CalendarCheck,
    title: "계획",
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

function RouteLanding({ route }: { readonly route: RouteDefinition }) {
  return (
    <section className="route-page" aria-labelledby="route-title">
      <p className="panel-label">Foundation ready</p>
      <h1 id="route-title">{route.title === "홈" ? "홈트레이닝 LEVEL UP" : route.title}</h1>
      <p>{route.description}</p>
      <div className="route-grid">
        <Card title="오늘의 준비">
          <p>안전 온보딩, 운동 레벨표, 세트 기록, 휴식 타이머는 이후 단계에서 연결됩니다.</p>
        </Card>
        <Notice title="안전 우선" tone="warning">
          <p>통증이 있으면 중단하고 강도를 낮추는 흐름으로 설계합니다.</p>
        </Notice>
      </div>
      <Progress label="기초 셸 진행률" max={12} value={8} />
    </section>
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

export function AppRoutes() {
  return (
    <Routes>
      {routes.map((route) => (
        <Route element={<RouteLanding route={route} />} key={route.href} path={route.href} />
      ))}
      <Route element={<NotFoundPage />} path="*" />
    </Routes>
  )
}
