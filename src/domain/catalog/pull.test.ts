import { describe, expect, it } from "vitest"
import { GLOBAL_SAFETY_STOP_SIGNALS } from "../content/common"
import { PULL_CATEGORY } from "./pull"
import { formatUpperBodyTargetLabel, validateUpperBodyCatalog } from "./upper-body"

describe("PULL catalog", () => {
  it("lists exact Lv0-8 exercises, targets, checklist, and conservative assessment flags", () => {
    // Given: the source PULL progression table and doorframe-bar checklist boundary.
    const expectedLevels = [
      {
        level: 0,
        key: "pull-0-foot-assisted-hang",
        name: "발 보조 매달리기",
        target: "30초 × 3세트",
        metricRule: {
          kind: "duration",
          minSeconds: 30,
          maxSeconds: 30,
          sets: 3,
          laterality: "none",
        },
        restSeconds: 120,
        assessmentEligible: true,
        requiresDoorframeBarChecklist: true,
      },
      {
        level: 1,
        key: "pull-1-dead-hang",
        name: "데드행",
        target: "30~45초 × 3세트",
        metricRule: {
          kind: "duration",
          minSeconds: 30,
          maxSeconds: 45,
          sets: 3,
          laterality: "none",
        },
        restSeconds: 120,
        assessmentEligible: false,
        requiresDoorframeBarChecklist: true,
      },
      {
        level: 2,
        key: "pull-2-scapular-pull-up",
        name: "스캐풀라 풀업",
        target: "8~10회 × 3세트",
        metricRule: {
          kind: "reps",
          min: 8,
          max: 10,
          sets: 3,
          laterality: "none",
          rir: { min: 1, max: 2 },
        },
        restSeconds: 120,
        assessmentEligible: false,
        requiresDoorframeBarChecklist: true,
      },
      {
        level: 3,
        key: "pull-3-foot-assisted-pull-up",
        name: "발 보조 풀업",
        target: "8~12회 × 3세트",
        metricRule: {
          kind: "reps",
          min: 8,
          max: 12,
          sets: 3,
          laterality: "none",
          rir: { min: 1, max: 2 },
        },
        restSeconds: 120,
        assessmentEligible: false,
        requiresDoorframeBarChecklist: true,
      },
      {
        level: 4,
        key: "pull-4-negative-pull-up",
        name: "네거티브 풀업",
        target: "5초 하강 × 5회 × 3세트",
        metricRule: {
          kind: "tempoReps",
          min: 5,
          max: 5,
          tempoSeconds: 5,
          sets: 3,
          laterality: "none",
        },
        restSeconds: 180,
        assessmentEligible: false,
        requiresDoorframeBarChecklist: true,
      },
      {
        level: 5,
        key: "pull-5-chin-up",
        name: "친업",
        target: "5~8회 × 3세트",
        metricRule: {
          kind: "reps",
          min: 5,
          max: 8,
          sets: 3,
          laterality: "none",
          rir: { min: 1, max: 2 },
        },
        restSeconds: 180,
        assessmentEligible: false,
        requiresDoorframeBarChecklist: true,
      },
      {
        level: 6,
        key: "pull-6-strict-pull-up",
        name: "정자세 풀업",
        target: "5~8회 × 3세트",
        metricRule: {
          kind: "reps",
          min: 5,
          max: 8,
          sets: 3,
          laterality: "none",
          rir: { min: 1, max: 2 },
        },
        restSeconds: 180,
        assessmentEligible: false,
        requiresDoorframeBarChecklist: true,
      },
      {
        level: 7,
        key: "pull-7-chest-to-bar",
        name: "체스트 투 바",
        target: "5~8회 × 3세트",
        metricRule: {
          kind: "reps",
          min: 5,
          max: 8,
          sets: 3,
          laterality: "none",
          rir: { min: 1, max: 2 },
        },
        restSeconds: 180,
        assessmentEligible: false,
        requiresDoorframeBarChecklist: true,
      },
      {
        level: 8,
        key: "pull-8-archer-pull-up-progression",
        name: "아처 풀업 진행",
        target: "좌우 3~5회 × 3세트",
        metricRule: {
          kind: "reps",
          min: 3,
          max: 5,
          sets: 3,
          laterality: "perSide",
          rir: { min: 1, max: 2 },
        },
        restSeconds: 180,
        assessmentEligible: false,
        requiresDoorframeBarChecklist: true,
      },
    ]

    // When: target labels are emitted from the catalog's typed metric rules.
    const renderedLevels = PULL_CATEGORY.levels.map((level) => ({
      level: level.level,
      key: level.key,
      name: level.name,
      target: formatUpperBodyTargetLabel(level.metricRule),
      metricRule: level.metricRule,
      restSeconds: level.restSeconds,
      assessmentEligible: level.assessment.eligible,
      requiresDoorframeBarChecklist: level.assessment.requiresDoorframeBarChecklist,
    }))

    // Then: all source levels and the checklist policy are present without asserting equipment guarantees.
    expect(renderedLevels).toEqual(expectedLevels)
    expect(PULL_CATEGORY.doorframeBarChecklist).toEqual([
      "운동 전 문틈철봉 설치 상태를 확인한다.",
      "제품 허용하중을 확인한다.",
      "처음부터 점프해서 매달리지 않는다.",
      "발을 바닥에 둔 상태에서 서서히 하중을 걸어 흔들림을 확인한다.",
    ])
    expect(PULL_CATEGORY.instructions).toEqual([
      "반동 없이 시작한다.",
      "어깨가 귀 쪽으로 계속 올라가 있지 않도록 견갑을 조절한다.",
      "턱만 억지로 철봉 위로 넘기지 않는다.",
      "몸을 과하게 젖혀 치팅하지 않는다.",
      "내려올 때도 통제한다.",
    ])
    expect(PULL_CATEGORY.mistakes).toEqual([
      "반동으로 올라가기",
      "어깨가 계속 귀 쪽으로 올라간 상태로 버티기",
      "턱만 철봉 위로 넘기기",
      "내려오는 구간을 놓치기",
    ])
    expect(PULL_CATEGORY.stopSignals).toEqual(GLOBAL_SAFETY_STOP_SIGNALS)
    expect(
      PULL_CATEGORY.levels.every(
        (level) => level.equipment.length > 0 && level.regression.length > 0,
      ),
    ).toBe(true)
  })

  it("rejects malformed PULL fixtures when checklist-gated loading or required content is missing", () => {
    // Given: malformed variants that would make hanging work fail the checklist boundary.
    const missingChecklistFixture = { ...PULL_CATEGORY, doorframeBarChecklist: [] }
    const missingGateFixture = {
      ...PULL_CATEGORY,
      levels: PULL_CATEGORY.levels.map((level) =>
        level.level === 0 ? { ...level, assessment: { eligible: true } } : level,
      ),
    }
    const emptyEquipmentFixture = {
      ...PULL_CATEGORY,
      levels: PULL_CATEGORY.levels.map((level) =>
        level.level === 2 ? { ...level, equipment: [] } : level,
      ),
    }

    // When: upper-body catalog validation runs.
    const missingChecklistResult = validateUpperBodyCatalog(missingChecklistFixture)
    const missingGateResult = validateUpperBodyCatalog(missingGateFixture)
    const emptyEquipmentResult = validateUpperBodyCatalog(emptyEquipmentFixture)
    const validResult = validateUpperBodyCatalog(PULL_CATEGORY)

    // Then: checklist and equipment regressions are enforced.
    expect(missingChecklistResult).toEqual({
      kind: "invalid",
      reason: "missing-doorframe-checklist",
    })
    expect(missingGateResult).toEqual({
      kind: "invalid",
      reason: "missing-doorframe-assessment-gate",
    })
    expect(emptyEquipmentResult).toEqual({
      kind: "invalid",
      reason: "empty-equipment-or-regression",
    })
    expect(validResult).toEqual({ kind: "valid" })
  })
})
