import { describe, expect, it } from "vitest"
import { hinge } from "./hinge"
import type { CatalogCategory } from "./lower-catalog.private"
import { squat } from "./squat"

const expectedSquat = [
  ["의자 스쿼트", "15회 × 3세트", { kind: "reps", min: 15, max: 15, sets: 3, laterality: "none" }],
  [
    "맨몸 스쿼트",
    "15~20회 × 3세트",
    { kind: "reps", min: 15, max: 20, sets: 3, laterality: "none" },
  ],
  [
    "5kg 고블릿 스쿼트",
    "15회 × 3세트",
    { kind: "reps", min: 15, max: 15, sets: 3, laterality: "none" },
  ],
  [
    "10kg 덤벨 스쿼트",
    "12~15회 × 3세트",
    { kind: "reps", min: 12, max: 15, sets: 3, laterality: "none" },
  ],
  [
    "리버스 런지",
    "좌우 10~12회 × 3세트",
    { kind: "reps", min: 10, max: 12, sets: 3, laterality: "perSide" },
  ],
  [
    "불가리안 스플릿 스쿼트",
    "좌우 8~12회 × 3세트",
    { kind: "reps", min: 8, max: 12, sets: 3, laterality: "perSide" },
  ],
  [
    "덤벨 불가리안 스플릿 스쿼트",
    "좌우 8~12회 × 3세트",
    { kind: "reps", min: 8, max: 12, sets: 3, laterality: "perSide" },
  ],
  [
    "박스 피스톨 스쿼트",
    "좌우 5~8회 × 3세트",
    { kind: "reps", min: 5, max: 8, sets: 3, laterality: "perSide" },
  ],
  [
    "피스톨 스쿼트",
    "좌우 5회 이상 × 3세트",
    { kind: "reps", min: 5, max: 5, sets: 3, laterality: "perSide" },
  ],
] as const

const expectedHinge = [
  ["맨몸 힙힌지", "15회 × 3세트", { kind: "reps", min: 15, max: 15, sets: 3, laterality: "none" }],
  [
    "글루트 브리지",
    "15~20회 × 3세트",
    { kind: "reps", min: 15, max: 20, sets: 3, laterality: "none" },
  ],
  [
    "덤벨 RDL 10kg",
    "12~15회 × 3세트",
    { kind: "reps", min: 12, max: 15, sets: 3, laterality: "none" },
  ],
  [
    "3초 하강 RDL",
    "3초 하강 × 12~15회 × 3세트",
    { kind: "tempoReps", min: 12, max: 15, tempoSeconds: 3, sets: 3, laterality: "none" },
  ],
  [
    "B-스탠스 RDL",
    "좌우 10~12회 × 3세트",
    { kind: "reps", min: 10, max: 12, sets: 3, laterality: "perSide" },
  ],
  [
    "맨몸 싱글레그 RDL",
    "좌우 8~12회 × 3세트",
    { kind: "reps", min: 8, max: 12, sets: 3, laterality: "perSide" },
  ],
  [
    "5kg 싱글레그 RDL",
    "좌우 10~15회 × 3세트",
    { kind: "reps", min: 10, max: 15, sets: 3, laterality: "perSide" },
  ],
  [
    "10kg 싱글레그 RDL",
    "좌우 8~12회 × 3세트",
    { kind: "reps", min: 8, max: 12, sets: 3, laterality: "perSide" },
  ],
] as const

function expectCatalog(
  category: CatalogCategory,
  expectedLevels: typeof expectedSquat | typeof expectedHinge,
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

describe("lower body catalog", () => {
  it("defines exact SQUAT levels and keeps advanced unilateral levels out of assessment", () => {
    // Given: the SQUAT source table and conservative assessment cap.
    // When: the catalog is read.
    // Then: levels, targets, laterality, gates, and assessment flags match the source.
    expectCatalog(squat, expectedSquat)
    expect(squat.levels.map((level) => level.assessmentEligible)).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
    ])
  })

  it("defines exact HIP HINGE levels with a 3 second eccentric RDL tempo gate", () => {
    // Given: the HIP HINGE source table and tempo override.
    // When: the catalog is read.
    // Then: levels, targets, laterality, gates, and assessment flags match the source.
    expectCatalog(hinge, expectedHinge)
    expect(hinge.levels.map((level) => level.assessmentEligible)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
    ])
  })
})
