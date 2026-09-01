import { describe, expect, it } from "vitest"
import { CategoryIdSchema, SessionEntrySchema } from "./schemas"

describe("session entry boundary schema", () => {
  it("rejects session entries whose set kind does not match metric laterality", () => {
    const singleMismatch = SessionEntrySchema.safeParse({
      categoryId: CategoryIdSchema.parse("push"),
      level: 5,
      exerciseName: "아처 푸시업",
      metricRule: {
        kind: "reps",
        min: 5,
        max: 8,
        sets: 3,
        laterality: "perSide",
        rir: { min: 1, max: 2 },
      },
      sets: [
        {
          kind: "single",
          value: 8,
          rir: 2,
          quality: { pain: false, form: "good", rom: "full" },
        },
      ],
    })
    const perSideMismatch = SessionEntrySchema.safeParse({
      categoryId: CategoryIdSchema.parse("push"),
      level: 3,
      exerciseName: "일반 푸시업",
      metricRule: {
        kind: "reps",
        min: 10,
        max: 15,
        sets: 3,
        laterality: "none",
        rir: { min: 1, max: 2 },
      },
      sets: [
        {
          kind: "perSide",
          left: 15,
          right: 15,
          rir: 2,
          quality: { pain: false, form: "good", rom: "full" },
        },
      ],
    })

    expect(singleMismatch.success).toBe(false)
    expect(perSideMismatch.success).toBe(false)
    expect(singleMismatch.error?.issues[0]?.message).toBe(
      "Metric laterality perSide requires perSide set records",
    )
    expect(perSideMismatch.error?.issues[0]?.message).toBe(
      "Metric laterality none requires single set records",
    )
  })
})
