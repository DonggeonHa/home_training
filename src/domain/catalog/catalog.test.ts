import { describe, expect, it } from "vitest"
import type { MetricRule } from "../contracts"
import { CATEGORY_IDS } from "../contracts"
import {
  CATALOG_VALIDATION_ERROR_KINDS,
  EXERCISE_CATALOG,
  findCatalogCategory,
  formatTargetLabel,
  validateCatalog,
} from "./index"

const EXPECTED_LEVEL_COUNTS = {
  push: 8,
  pull: 9,
  squat: 9,
  hinge: 8,
  verticalPush: 9,
  core: 8,
} as const

const expectedCategoryIds = ["push", "pull", "squat", "hinge", "verticalPush", "core"] as const

function expectedLevelCountFor(categoryId: string): number {
  switch (categoryId) {
    case "push":
      return EXPECTED_LEVEL_COUNTS.push
    case "pull":
      return EXPECTED_LEVEL_COUNTS.pull
    case "squat":
      return EXPECTED_LEVEL_COUNTS.squat
    case "hinge":
      return EXPECTED_LEVEL_COUNTS.hinge
    case "verticalPush":
      return EXPECTED_LEVEL_COUNTS.verticalPush
    case "core":
      return EXPECTED_LEVEL_COUNTS.core
    default:
      throw new Error(`Unexpected test category ID: ${categoryId}`)
  }
}

describe("complete exercise catalog", () => {
  it("aggregates exactly six category IDs in product order with exact source level counts", () => {
    // Given: the complete six-pattern source catalog.
    // When: the public catalog index is read.
    const summary = EXERCISE_CATALOG.map((category) => ({
      id: category.id,
      levelCount: category.levels.length,
    }))

    // Then: category order and level counts match the approved progression source.
    expect(EXERCISE_CATALOG.map((category) => category.id)).toEqual(expectedCategoryIds)
    expect(CATEGORY_IDS).toEqual(expectedCategoryIds)
    expect(CATALOG_VALIDATION_ERROR_KINDS).toHaveLength(17)
    expect(summary).toEqual([
      { id: "push", levelCount: EXPECTED_LEVEL_COUNTS.push },
      { id: "pull", levelCount: EXPECTED_LEVEL_COUNTS.pull },
      { id: "squat", levelCount: EXPECTED_LEVEL_COUNTS.squat },
      { id: "hinge", levelCount: EXPECTED_LEVEL_COUNTS.hinge },
      { id: "verticalPush", levelCount: EXPECTED_LEVEL_COUNTS.verticalPush },
      { id: "core", levelCount: EXPECTED_LEVEL_COUNTS.core },
    ])
  })

  it("validates contiguous levels, unique keys, required content, gates, and terminal policy", () => {
    // Given: the complete catalog assembled from category modules.
    // When: catalog-wide validation runs.
    const result = validateCatalog(EXERCISE_CATALOG)

    // Then: the real catalog satisfies all cross-category invariants.
    expect(result).toEqual({ kind: "valid" })
    for (const category of EXERCISE_CATALOG) {
      expect(category.levels.map((level) => level.level)).toEqual(
        Array.from({ length: expectedLevelCountFor(category.id) }, (_, index) => index),
      )
      for (const level of category.levels) {
        expect(`${category.id}-${level.level}`).toBe(level.id)
        expect(level.equipment.length).toBeGreaterThan(0)
        expect(level.regressions.length).toBeGreaterThan(0)
        expect(level.instructions.length).toBeGreaterThan(0)
        expect(level.mistakes.length).toBeGreaterThan(0)
        expect(level.safety.length).toBeGreaterThan(0)
        if (level.metricRule.kind !== "terminal") {
          expect(level.metricRule.sets).toBe(3)
          expect(level.promotable).toBe(true)
        }
      }
    }
    expect(
      EXERCISE_CATALOG.flatMap((category) => category.levels.map((level) => level.key)),
    ).toHaveLength(
      new Set(EXERCISE_CATALOG.flatMap((category) => category.levels.map((level) => level.key)))
        .size,
    )
    expect(
      EXERCISE_CATALOG.flatMap((category) => category.levels).filter(
        (level) => level.metricRule.kind === "terminal",
      ),
    ).toEqual([
      expect.objectContaining({
        categoryId: "verticalPush",
        level: 8,
        name: "프리 HSPU",
        promotable: false,
      }),
    ])
  })

  it("returns typed lookup failures for unknown category IDs", () => {
    // Given: user- or storage-originated category IDs.
    // When: a known and unknown ID are looked up.
    const knownResult = findCatalogCategory("push")
    const unknownResult = findCatalogCategory("unknown")

    // Then: known IDs resolve and unknown IDs fail without throwing.
    expect(knownResult).toEqual({ kind: "found", category: EXERCISE_CATALOG[0] })
    expect(unknownResult).toEqual({ kind: "notFound", id: "unknown" })
  })

  it("formats all metric target variants exhaustively", () => {
    // Given: each metric target variant used by the catalog.
    const examples: readonly MetricRule[] = [
      { kind: "reps", min: 10, max: 12, sets: 3, laterality: "none", rir: { min: 1, max: 2 } },
      { kind: "reps", min: 5, max: 5, sets: 3, laterality: "perSide", rir: { min: 1, max: 2 } },
      { kind: "duration", minSeconds: 20, maxSeconds: 30, sets: 3, laterality: "none" },
      { kind: "duration", minSeconds: 20, maxSeconds: 30, sets: 3, laterality: "perSide" },
      { kind: "duration", minSeconds: 45, maxSeconds: 45, sets: 3, laterality: "none" },
      { kind: "tempoReps", min: 5, max: 5, tempoSeconds: 5, sets: 3, laterality: "none" },
      { kind: "tempoReps", min: 3, max: 5, tempoSeconds: 4, sets: 3, laterality: "perSide" },
      { kind: "terminal", label: "상급 목표", laterality: "none" },
    ]

    // When: target labels are rendered through the catalog-wide formatter.
    const labels = examples.map(formatTargetLabel)

    // Then: reps, duration, tempo, terminal, and laterality semantics are preserved.
    expect(labels).toEqual([
      "10~12회 × 3세트",
      "좌우 5회 × 3세트",
      "20~30초 × 3세트",
      "좌우 20~30초 × 3세트",
      "45초 × 3세트",
      "5초 하강 × 5회 × 3세트",
      "좌우 4초 하강 × 3~5회 × 3세트",
      "상급 목표",
    ])
  })

  it("serializes category counts and representative target labels for data QA", () => {
    // Given: the complete catalog data-only public export.
    // When: a compact QA summary is serialized.
    const serializedSummary = JSON.stringify({
      counts: Object.fromEntries(
        EXERCISE_CATALOG.map((category) => [category.id, category.levels.length]),
      ),
      labels: {
        push3: EXERCISE_CATALOG[0].levels[3]?.targetLabel,
        pull4: EXERCISE_CATALOG[1].levels[4]?.targetLabel,
        verticalTerminal: EXERCISE_CATALOG[4].levels[8]?.targetLabel,
        core0: EXERCISE_CATALOG[5].levels[0]?.targetLabel,
      },
    })

    // Then: the binary summary preserves exact counts and representative target labels.
    expect(serializedSummary).toBe(
      '{"counts":{"push":8,"pull":9,"squat":9,"hinge":8,"verticalPush":9,"core":8},"labels":{"push3":"10~15회 × 3세트","pull4":"5초 하강 × 5회 × 3세트","verticalTerminal":"상급 목표","core0":"좌우 10회 × 3세트"}}',
    )
  })

  it("throws on unknown target formatter variants at the domain boundary", () => {
    // Given: a malformed runtime metric variant that bypassed TypeScript.
    const unknownMetric = JSON.parse('{"kind":"unknown","sets":3,"laterality":"none"}')

    // When / Then: exhaustive formatting fails closed.
    expect(() => formatTargetLabel(unknownMetric)).toThrow("Unexpected domain variant")
  })
})
