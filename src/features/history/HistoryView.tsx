import { useState } from "react"
import { EXERCISE_CATALOG } from "../../domain/catalog"
import type { CompletedSession } from "../../domain/contracts"
import type { StoredState } from "../../storage"
import { HistoryChart } from "./HistoryCharts"
import {
  buildHistorySummary,
  categoryTitleForEntry,
  chartSeriesForFilter,
  entriesForFilter,
  type HistoryCategoryFilter,
} from "./model"
import "./history.css"

type HistoryViewProps = {
  readonly state: StoredState
}

export function HistoryView({ state }: HistoryViewProps) {
  const [filter, setFilter] = useState<HistoryCategoryFilter>("all")
  const sessions = entriesForFilter(state.completedSessions, filter)
  const selectedCategory = EXERCISE_CATALOG.find((category) => category.id === filter)
  const summary =
    selectedCategory === undefined ? null : buildHistorySummary(state, selectedCategory)
  const series = chartSeriesForFilter(state.completedSessions, filter)

  return (
    <section className="history-page" aria-labelledby="history-title">
      <div className="history-intro">
        <p className="panel-label">Progress history</p>
        <h1 id="history-title">기록과 성장</h1>
        <label>
          카테고리 필터
          <select
            value={filter}
            onChange={(event) => setFilter(readHistoryFilter(event.currentTarget.value))}
          >
            <option value="all">전체</option>
            {EXERCISE_CATALOG.map((category) => (
              <option key={category.id} value={category.id}>
                {category.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {state.completedSessions.length === 0 ? (
        <p className="history-empty">아직 완료된 운동 기록이 없습니다.</p>
      ) : (
        <>
          {summary === null ? null : (
            <section className="history-summary" aria-label="선택 카테고리 요약">
              <p>{`최근 기록: ${summary.latest}`}</p>
              <p>{`같은 레벨 PR: ${summary.sameLevelPr}`}</p>
              <p>{`레벨 변화: ${summary.levelTimeline}`}</p>
            </section>
          )}
          <div className="history-charts">
            {series.map((item) => (
              <HistoryChart key={item.unit} series={item} />
            ))}
          </div>
          <SessionList sessions={sessions} />
        </>
      )}
    </section>
  )
}

function SessionList({ sessions }: { readonly sessions: readonly CompletedSession[] }) {
  return (
    <ol className="history-session-list" aria-label="완료 세션 목록">
      {sessions.map((session) => (
        <li key={session.id}>
          <strong>{`${session.completedAt.slice(0, 10)} 루틴 ${session.routineId}`}</strong>
          <ul>
            {session.entries.map((entry) => (
              <li key={`${session.id}-${entry.categoryId}-${entry.level}`}>
                <span>{`${categoryTitleForEntry(entry)} Lv.${entry.level} `}</span>
                <span>{entry.exerciseName}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}

function readHistoryFilter(value: string): HistoryCategoryFilter {
  if (value === "all") {
    return "all"
  }
  const category = EXERCISE_CATALOG.find((candidate) => candidate.id === value)
  return category?.id ?? "all"
}
