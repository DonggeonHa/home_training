import { Barbell } from "@phosphor-icons/react/Barbell"

export function App() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        본문으로 건너뛰기
      </a>
      <div className="app-shell">
        <header className="app-header">
          <div className="brand-mark" aria-hidden="true">
            <Barbell size={28} weight="duotone" />
          </div>
          <div>
            <p className="eyebrow">초보자 저항운동 성장 시스템</p>
            <h1>홈트레이닝 LEVEL UP</h1>
          </div>
        </header>
        <main id="main-content" className="app-main">
          <section className="foundation-panel" aria-labelledby="foundation-title">
            <p className="panel-label">Foundation ready</p>
            <h2 id="foundation-title">스킬트리 기반 홈트레이닝 앱을 준비 중입니다.</h2>
            <p>
              안전 온보딩, 운동 레벨표, 세트 기록, 휴식 타이머, 진행 기록은 이후 단계에서 데이터와
              순수 규칙 위에 연결됩니다.
            </p>
          </section>
        </main>
      </div>
    </>
  )
}
