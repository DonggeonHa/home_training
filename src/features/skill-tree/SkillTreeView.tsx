import type { StoredState } from "../../storage"
import { buildSkillTrees } from "./model"
import "./skill-tree.css"

type SkillTreeViewProps = {
  readonly state: StoredState
}

export function SkillTreeView({ state }: SkillTreeViewProps) {
  const trees = buildSkillTrees(state)

  return (
    <section className="skill-tree-page" aria-labelledby="skill-tree-title">
      <div className="skill-tree-intro">
        <p className="panel-label">Six movement patterns</p>
        <h1 id="skill-tree-title">전체 스킬트리</h1>
        <p>모든 레벨은 목표, 장비, 회귀 동작, 워밍업, 중단 신호와 함께 표시됩니다.</p>
      </div>
      {trees.map((tree) => (
        <section className="skill-tree-section" key={tree.category.id}>
          <div className="skill-tree-heading">
            <div>
              <h2>{tree.category.title}</h2>
              <p>{tree.category.muscles.join(" / ")}</p>
            </div>
            <div>
              <h3>워밍업</h3>
              <p>{tree.category.warmup.join(" · ")}</p>
            </div>
            <div>
              <h3>중단 신호</h3>
              <p>{tree.category.stopSignals.join(" · ")}</p>
            </div>
          </div>
          <ol className="skill-tree-list" aria-label={`${tree.category.title} 스킬트리`}>
            {tree.levels.map((item) => (
              <li
                aria-label={`레벨 ${item.level.level} ${item.level.name}`}
                className={`skill-tree-item status-${item.status}`}
                key={item.level.id}
              >
                <div className="skill-tree-node">
                  <span>{`Lv.${item.level.level}`}</span>
                  <strong>{item.level.name}</strong>
                  <em>{item.statusLabel}</em>
                </div>
                <dl className="skill-tree-details">
                  <div>
                    <dt>목표</dt>
                    <dd>{`목표: ${item.level.targetLabel}`}</dd>
                  </div>
                  <div>
                    <dt>장비</dt>
                    <dd>{`장비: ${item.level.equipment.join(", ")}`}</dd>
                  </div>
                  <div>
                    <dt>회귀</dt>
                    <dd>{`회귀: ${item.level.regressions.join(", ")}`}</dd>
                  </div>
                  <div>
                    <dt>안전</dt>
                    <dd>{`안전: ${item.level.safety.join(", ")}`}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </section>
  )
}
