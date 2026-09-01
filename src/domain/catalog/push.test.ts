import { describe, expect, it } from "vitest"
import { GLOBAL_SAFETY_STOP_SIGNALS } from "../content/common"
import { PUSH_CATEGORY } from "./push"
import { formatUpperBodyTargetLabel, validateUpperBodyCatalog } from "./upper-body"

describe("PUSH catalog", () => {
  it("lists exact Lv0-7 exercises, targets, and coaching when rendered from typed data", () => {
    // Given: the source PUSH progression table and inherited stop signals.
    const expectedLevels = [
      {
        level: 0,
        key: "push-0-wall-push-up",
        name: "벽 푸시업",
        target: "15회 × 3세트",
        metricRule: {
          kind: "reps",
          min: 15,
          max: 15,
          sets: 3,
          laterality: "none",
          rir: { min: 1, max: 2 },
        },
        restSeconds: 60,
        assessmentEligible: true,
      },
      {
        level: 1,
        key: "push-1-high-incline-push-up",
        name: "높은 인클라인 푸시업",
        target: "15회 × 3세트",
        metricRule: {
          kind: "reps",
          min: 15,
          max: 15,
          sets: 3,
          laterality: "none",
          rir: { min: 1, max: 2 },
        },
        restSeconds: 90,
        assessmentEligible: true,
      },
      {
        level: 2,
        key: "push-2-low-incline-push-up",
        name: "낮은 인클라인 푸시업",
        target: "12~15회 × 3세트",
        metricRule: {
          kind: "reps",
          min: 12,
          max: 15,
          sets: 3,
          laterality: "none",
          rir: { min: 1, max: 2 },
        },
        restSeconds: 90,
        assessmentEligible: true,
      },
      {
        level: 3,
        key: "push-3-standard-push-up",
        name: "일반 푸시업",
        target: "10~15회 × 3세트",
        metricRule: {
          kind: "reps",
          min: 10,
          max: 15,
          sets: 3,
          laterality: "none",
          rir: { min: 1, max: 2 },
        },
        restSeconds: 120,
        assessmentEligible: true,
      },
      {
        level: 4,
        key: "push-4-decline-push-up",
        name: "디클라인 푸시업",
        target: "8~12회 × 3세트",
        metricRule: {
          kind: "reps",
          min: 8,
          max: 12,
          sets: 3,
          laterality: "none",
          rir: { min: 1, max: 2 },
        },
        restSeconds: 180,
        assessmentEligible: false,
      },
      {
        level: 5,
        key: "push-5-archer-push-up",
        name: "아처 푸시업",
        target: "좌우 5~8회 × 3세트",
        metricRule: {
          kind: "reps",
          min: 5,
          max: 8,
          sets: 3,
          laterality: "perSide",
          rir: { min: 1, max: 2 },
        },
        restSeconds: 180,
        assessmentEligible: false,
      },
      {
        level: 6,
        key: "push-6-assisted-one-arm-push-up",
        name: "보조 원암 푸시업",
        target: "좌우 5~8회 × 3세트",
        metricRule: {
          kind: "reps",
          min: 5,
          max: 8,
          sets: 3,
          laterality: "perSide",
          rir: { min: 1, max: 2 },
        },
        restSeconds: 180,
        assessmentEligible: false,
      },
      {
        level: 7,
        key: "push-7-one-arm-push-up",
        name: "원암 푸시업",
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
      },
    ]

    // When: target labels are emitted from the catalog's typed metric rules.
    const renderedLevels = PUSH_CATEGORY.levels.map((level) => ({
      level: level.level,
      key: level.key,
      name: level.name,
      target: formatUpperBodyTargetLabel(level.metricRule),
      metricRule: level.metricRule,
      restSeconds: level.restSeconds,
      assessmentEligible: level.assessment.eligible,
    }))

    // Then: names, order, metric numbers, rest values, and conservative assessment flags match the plan.
    expect(renderedLevels).toEqual(expectedLevels)
    expect(PUSH_CATEGORY.warmup).toEqual([
      "팔 원 그리기: 작은 원 5회 + 큰 원 5회",
      "벽 슬라이드 8~10회",
      "스캐풀라 푸시업 8~10회",
      "현재 레벨보다 쉬운 푸시업 5~8회",
    ])
    expect(PUSH_CATEGORY.instructions).toEqual([
      "머리부터 발끝까지 몸통 일직선을 유지한다.",
      "엉덩이가 과하게 내려가거나 올라가지 않게 유지한다.",
      "팔꿈치를 몸통과 완전히 90도로 벌리지 않는다.",
      "가슴이 바닥 쪽으로 내려가도록 통증 없는 범위에서 충분한 가동범위를 확보한다.",
      "올라올 때 허리가 먼저 꺾이지 않도록 복부와 둔근에 힘을 유지한다.",
    ])
    expect(PUSH_CATEGORY.mistakes).toEqual([
      "목만 먼저 내려가기",
      "허리 꺾임",
      "반동 사용",
      "반복 수를 늘리려고 가동범위를 줄이기",
    ])
    expect(PUSH_CATEGORY.stopSignals).toEqual(GLOBAL_SAFETY_STOP_SIGNALS)
  })

  it("rejects malformed PUSH fixtures with duplicate or missing levels and empty required content", () => {
    // Given: duplicate, missing-level, and empty-content fixtures from the catalog boundary.
    const duplicateLevelFixture = {
      ...PUSH_CATEGORY,
      levels: PUSH_CATEGORY.levels.map((level) =>
        level.level === 1 ? { ...level, level: 0, key: "push-duplicate-wall-push-up" } : level,
      ),
    }
    const missingLevelFixture = {
      ...PUSH_CATEGORY,
      levels: PUSH_CATEGORY.levels.filter((level) => level.level !== 3),
    }
    const emptyContentFixture = { ...PUSH_CATEGORY, warmup: [] }

    // When: upper-body catalog validation runs.
    const duplicateLevelResult = validateUpperBodyCatalog(duplicateLevelFixture)
    const missingLevelResult = validateUpperBodyCatalog(missingLevelFixture)
    const emptyContentResult = validateUpperBodyCatalog(emptyContentFixture)
    const validResult = validateUpperBodyCatalog(PUSH_CATEGORY)

    // Then: malformed fixtures are rejected and the real catalog is accepted.
    expect(duplicateLevelResult).toEqual({ kind: "invalid", reason: "duplicate-level" })
    expect(missingLevelResult).toEqual({ kind: "invalid", reason: "missing-level" })
    expect(emptyContentResult).toEqual({ kind: "invalid", reason: "empty-required-content" })
    expect(validResult).toEqual({ kind: "valid" })
  })
})
