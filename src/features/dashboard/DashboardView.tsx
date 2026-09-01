import { ArrowRight, FlagCheckered } from "@phosphor-icons/react"
import { Progress } from "../../shared/ui"
import type { StoredState } from "../../storage"
import { adaptationProgressLabel, buildDashboardCards } from "./model"
import "./dashboard.css"

type DashboardViewProps = {
  readonly startHref: string
  readonly state: StoredState
}

export function DashboardView({ startHref, state }: DashboardViewProps) {
  const cards = buildDashboardCards(state)

  return (
    <section className="dashboard-page" aria-labelledby="dashboard-title">
      <div className="dashboard-hero">
        <div>
          <p className="panel-label">Manual routine sequence</p>
          <h1 id="dashboard-title">오늘의 진행 대시보드</h1>
          <p>다음 운동과 각 패턴의 레벨업 조건을 한 화면에서 확인합니다.</p>
        </div>
        <section className="dashboard-routine" aria-label="다음 추천 루틴">
          <FlagCheckered size={28} weight="duotone" aria-hidden="true" />
          <strong>{`다음 추천 루틴 ${state.nextRoutine}`}</strong>
          <span>{adaptationProgressLabel(state.completedSessions.length)}</span>
          <a className="ui-button ui-button-primary" href={startHref}>
            {`루틴 ${state.nextRoutine} 운동 시작`}
            <ArrowRight size={18} weight="bold" aria-hidden="true" />
          </a>
        </section>
      </div>
      <div className="dashboard-grid">
        {cards.map((card) => (
          <article
            aria-label={`${card.category.title} 카테고리 카드`}
            className={`dashboard-card status-${card.status}`}
            key={card.category.id}
          >
            <div className="dashboard-card-header">
              <div>
                <h2>{card.category.title}</h2>
                <p>{card.category.muscles.join(" / ")}</p>
              </div>
              <span>{`현재 Lv.${card.currentLevel}`}</span>
            </div>
            <p className="status-copy">{`상태: ${card.statusLabel}`}</p>
            <p>{`현재 운동: ${card.currentExercise}`}</p>
            <p>{`다음 운동: ${card.nextExercise}`}</p>
            <dl className="dashboard-facts">
              <div>
                <dt>최근 기록</dt>
                <dd>{`최근 기록: ${card.latestRecord}`}</dd>
              </div>
              <div>
                <dt>같은 레벨 PR</dt>
                <dd>{`같은 레벨 PR: ${card.sameLevelPr}`}</dd>
              </div>
              <div>
                <dt>남은 조건</dt>
                <dd>{`남은 조건: ${card.remainingCondition}`}</dd>
              </div>
            </dl>
            <Progress
              label={`${card.category.title} 레벨 진행`}
              max={card.category.levels.length}
              value={card.progressValue}
            />
          </article>
        ))}
      </div>
    </section>
  )
}
