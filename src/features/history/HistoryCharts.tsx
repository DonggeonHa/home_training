import type { HistoryChartSeries, PerSideHistoryChartPoint, SingleHistoryChartPoint } from "./model"

export function HistoryChart({ series }: { readonly series: HistoryChartSeries }) {
  const title = chartTitle(series.unit)
  const categoryLabels = uniqueCategoryLabels(series.points)

  return (
    <section className="history-chart-panel" aria-labelledby={`${series.unit}-chart-title`}>
      <h2 id={`${series.unit}-chart-title`}>{title}</h2>
      <ul className="history-chart-categories" aria-label={`${title} 카테고리`}>
        {categoryLabels.map((label) => (
          <li key={label}>{`카테고리: ${label}`}</li>
        ))}
      </ul>
      {series.unit === "perSideReps" ? (
        <PerSideChart title={title} points={series.points} />
      ) : (
        <SingleValueChart title={title} series={series} />
      )}
    </section>
  )
}

function SingleValueChart({
  series,
  title,
}: {
  readonly series: Exclude<HistoryChartSeries, { readonly unit: "perSideReps" }>
  readonly title: string
}) {
  const values = series.points.map((point) => point.value)
  const maxValue = Math.max(...values, 1)

  return (
    <>
      <svg
        role="img"
        aria-label={`${title} 그래프`}
        viewBox="0 0 320 120"
        className="history-chart"
      >
        <polyline
          points={polylinePoints(values, maxValue)}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
      </svg>
      <table aria-label={`${title} 표`}>
        <thead>
          <tr>
            <th>카테고리</th>
            <th>날짜</th>
            <th>세트</th>
            <th>값</th>
          </tr>
        </thead>
        <tbody>
          {series.points.map((point) => (
            <tr key={`${point.categoryTitle}-${point.completedAt}-${point.setIndex}`}>
              <td>{point.categoryTitle}</td>
              <td>{point.completedAt.slice(0, 10)}</td>
              <td>{point.setIndex + 1}</td>
              <td>{formatSinglePointValue(series.unit, point)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function PerSideChart({
  points,
  title,
}: {
  readonly points: readonly PerSideHistoryChartPoint[]
  readonly title: string
}) {
  const leftValues = points.map((point) => point.left)
  const rightValues = points.map((point) => point.right)
  const maxValue = Math.max(...leftValues, ...rightValues, 1)

  return (
    <>
      <ul className="history-chart-categories" aria-label={`${title} 좌우 시리즈`}>
        <li>시리즈: 왼쪽</li>
        <li>시리즈: 오른쪽</li>
      </ul>
      <svg
        role="img"
        aria-label={`${title} 그래프`}
        viewBox="0 0 320 120"
        className="history-chart"
      >
        <polyline
          points={polylinePoints(leftValues, maxValue)}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        <polyline
          points={polylinePoints(rightValues, maxValue)}
          fill="none"
          stroke="var(--text-secondary)"
          strokeDasharray="6 4"
          strokeWidth="3"
        />
      </svg>
      <table aria-label={`${title} 표`}>
        <thead>
          <tr>
            <th>카테고리</th>
            <th>날짜</th>
            <th>세트</th>
            <th>왼쪽</th>
            <th>오른쪽</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={`${point.categoryTitle}-${point.completedAt}-${point.setIndex}`}>
              <td>{point.categoryTitle}</td>
              <td>{point.completedAt.slice(0, 10)}</td>
              <td>{point.setIndex + 1}</td>
              <td>{`${point.left}회`}</td>
              <td>{`${point.right}회`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function polylinePoints(values: readonly number[], maxValue: number): string {
  if (values.length === 1) {
    return `160,${112 - ((values[0] ?? 0) / maxValue) * 96}`
  }
  return values
    .map(
      (value, index) =>
        `${16 + (index * 288) / (values.length - 1)},${112 - (value / maxValue) * 96}`,
    )
    .join(" ")
}

function chartTitle(unit: HistoryChartSeries["unit"]): string {
  switch (unit) {
    case "reps":
      return "반복 기록"
    case "seconds":
      return "초 기록"
    case "kg":
      return "중량 기록"
    case "perSideReps":
      return "좌우 반복 기록"
  }
}

function formatSinglePointValue(
  unit: Exclude<HistoryChartSeries["unit"], "perSideReps">,
  point: SingleHistoryChartPoint,
): string {
  switch (unit) {
    case "reps":
      return `${point.value}회`
    case "seconds":
      return `${point.value}초`
    case "kg":
      return `${point.value}kg`
  }
}

function uniqueCategoryLabels(
  points: readonly (SingleHistoryChartPoint | PerSideHistoryChartPoint)[],
): readonly string[] {
  return [...new Set(points.map((point) => point.categoryTitle))]
}
