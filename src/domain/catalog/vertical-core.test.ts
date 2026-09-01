import { describe, expect, it } from "vitest"
import { core } from "./core"
import {
  type CatalogCategory,
  type CatalogLevel,
  isCatalogLevelValid,
} from "./lower-catalog.private"
import { verticalPush } from "./vertical-push"

type CatalogMetric =
  | {
      readonly kind: "reps"
      readonly min: number
      readonly max: number
      readonly sets: 3
      readonly laterality: "none" | "perSide"
      readonly rir?: { readonly min: number; readonly max: number } | undefined
    }
  | {
      readonly kind: "duration"
      readonly minSeconds: number
      readonly maxSeconds: number
      readonly sets: 3
      readonly laterality: "none" | "perSide"
    }
  | {
      readonly kind: "tempoReps"
      readonly min: number
      readonly max: number
      readonly tempoSeconds: number
      readonly sets: 3
      readonly laterality: "none" | "perSide"
      readonly rir?: { readonly min: number; readonly max: number } | undefined
    }
  | {
      readonly kind: "terminal"
      readonly label: string
      readonly laterality: "none" | "perSide"
    }

const expectedVerticalPush = [
  [
    "덤벨 숄더프레스",
    "8~12회 × 3세트",
    { kind: "reps", min: 8, max: 12, sets: 3, laterality: "none" },
  ],
  [
    "높은 인클라인 파이크 푸시업",
    "10~12회 × 3세트",
    { kind: "reps", min: 10, max: 12, sets: 3, laterality: "none" },
  ],
  [
    "파이크 푸시업",
    "8~12회 × 3세트",
    { kind: "reps", min: 8, max: 12, sets: 3, laterality: "none" },
  ],
  [
    "발 높인 파이크 푸시업",
    "6~10회 × 3세트",
    { kind: "reps", min: 6, max: 10, sets: 3, laterality: "none" },
  ],
  [
    "벽 핸드스탠드 홀드",
    "30~45초 × 3세트",
    { kind: "duration", minSeconds: 30, maxSeconds: 45, sets: 3, laterality: "none" },
  ],
  [
    "부분범위 벽 HSPU",
    "5~8회 × 3세트",
    { kind: "reps", min: 5, max: 8, sets: 3, laterality: "none" },
  ],
  ["벽 HSPU", "5~8회 × 3세트", { kind: "reps", min: 5, max: 8, sets: 3, laterality: "none" }],
  [
    "프리 핸드스탠드",
    "20~30초 × 3세트",
    { kind: "duration", minSeconds: 20, maxSeconds: 30, sets: 3, laterality: "none" },
  ],
  ["프리 HSPU", "상급 목표", { kind: "terminal", label: "상급 목표", laterality: "none" }],
] as const

const expectedCore = [
  [
    "데드버그",
    "좌우 10회 × 3세트",
    { kind: "reps", min: 10, max: 10, sets: 3, laterality: "perSide" },
  ],
  [
    "플랭크",
    "45초 × 3세트",
    { kind: "duration", minSeconds: 45, maxSeconds: 45, sets: 3, laterality: "none" },
  ],
  [
    "할로우 바디 홀드",
    "30초 × 3세트",
    { kind: "duration", minSeconds: 30, maxSeconds: 30, sets: 3, laterality: "none" },
  ],
  [
    "행잉 니레이즈",
    "10~12회 × 3세트",
    { kind: "reps", min: 10, max: 12, sets: 3, laterality: "none" },
  ],
  [
    "스트레이트 레그레이즈 진행",
    "8~10회 × 3세트",
    { kind: "reps", min: 8, max: 10, sets: 3, laterality: "none" },
  ],
  [
    "행잉 레그레이즈",
    "8~12회 × 3세트",
    { kind: "reps", min: 8, max: 12, sets: 3, laterality: "none" },
  ],
  [
    "푸시업바 Tuck L-sit",
    "20~30초 × 3세트",
    { kind: "duration", minSeconds: 20, maxSeconds: 30, sets: 3, laterality: "none" },
  ],
  [
    "L-sit",
    "20~30초 × 3세트",
    { kind: "duration", minSeconds: 20, maxSeconds: 30, sets: 3, laterality: "none" },
  ],
] as const

function expectCatalog(
  category: CatalogCategory,
  expectedLevels: typeof expectedVerticalPush | typeof expectedCore,
): void {
  expect(category.warmup.length).toBeGreaterThan(0)
  expect(category.instructions.length).toBeGreaterThan(0)
  expect(category.mistakes.length).toBeGreaterThan(0)
  expect(category.stopSignals.length).toBeGreaterThan(0)
  expect(category.levels.map((level) => level.level)).toEqual(
    expectedLevels.map((_, index) => index),
  )
  expect(new Set(category.levels.map((level) => `${category.id}-${level.level}`)).size).toBe(
    category.levels.length,
  )

  for (const [index, [name, targetLabel, metricRule]] of expectedLevels.entries()) {
    const level = category.levels[index]
    expect(level).toBeDefined()
    expect(level?.name).toBe(name)
    expect(level?.targetLabel).toBe(targetLabel)
    expect(level?.metricRule).toEqual(
      metricRule.kind === "reps" ? { ...metricRule, rir: { min: 1, max: 2 } } : metricRule,
    )
    expect(level?.restSeconds).toBeGreaterThanOrEqual(60)
    expect(level?.equipment.length).toBeGreaterThan(0)
    expect(level?.regressions.length).toBeGreaterThan(0)
    expect(level?.instructions.length).toBeGreaterThan(0)
    expect(level?.mistakes.length).toBeGreaterThan(0)
    expect(level?.safety.length).toBeGreaterThan(0)
  }
}

function hasRir(metricRule: CatalogMetric): boolean {
  return "rir" in metricRule
}

function canAutoPromote(level: CatalogLevel): boolean {
  return level.metricRule.kind !== "terminal" && level.promotable
}

describe("vertical push and core catalog", () => {
  it("defines exact VERTICAL PUSH levels and keeps handstand skills out of assessment", () => {
    // Given: the VERTICAL PUSH source table and conservative assessment cap.
    // When: the catalog is read.
    // Then: levels, targets, RIR use, assessment flags, and terminal HSPU match the source.
    expectCatalog(verticalPush, expectedVerticalPush)
    expect(verticalPush.levels.map((level) => level.assessmentEligible)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ])
    expect(
      verticalPush.levels
        .filter((level) => level.metricRule.kind !== "reps")
        .some((level) => hasRir(level.metricRule)),
    ).toBe(false)
    expect(verticalPush.levels[8]?.metricRule).toEqual({
      kind: "terminal",
      label: "상급 목표",
      laterality: "none",
    })
    expect(verticalPush.levels[8]?.promotable).toBe(false)
    const terminalLevel = verticalPush.levels[8]
    expect(terminalLevel).toBeDefined()
    if (terminalLevel !== undefined) {
      expect(canAutoPromote(terminalLevel)).toBe(false)
    }
  })

  it("defines exact CORE levels and excludes hanging and L-sit skills from assessment", () => {
    // Given: the CORE source table and conservative assessment cap.
    // When: the catalog is read.
    // Then: levels, targets, laterality, RIR use, and assessment flags match the source.
    expectCatalog(core, expectedCore)
    expect(core.levels.map((level) => level.assessmentEligible)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
    ])
    expect(
      core.levels
        .filter((level) => level.metricRule.kind !== "reps")
        .some((level) => hasRir(level.metricRule)),
    ).toBe(false)
  })

  it("rejects malformed duration targets with RIR and terminal promotion rules", () => {
    // Given: malformed fixtures that violate catalog metric contracts.
    const durationWithRir = {
      kind: "duration",
      minSeconds: 20,
      maxSeconds: 30,
      sets: 3,
      laterality: "none",
      rir: { min: 1, max: 2 },
    }
    const promotedTerminalLevel = {
      level: 8,
      name: "프리 HSPU",
      metricRule: { kind: "terminal", label: "상급 목표", laterality: "none" },
      promotable: true,
    }

    // When: catalog-level validation is applied.
    // Then: duration metrics cannot carry RIR and terminal levels cannot promote.
    expect(isCatalogLevelValid({ ...core.levels[1], metricRule: durationWithRir })).toBe(false)
    expect(isCatalogLevelValid({ ...verticalPush.levels[8], ...promotedTerminalLevel })).toBe(false)
  })
})
