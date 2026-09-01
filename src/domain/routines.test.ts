import { describe, expect, it } from "vitest"
import { getNextRoutine, getPrescribedSetCount, ROUTINE_SEQUENCE, ROUTINES } from "./routines"
import { CategoryIdSchema } from "./schemas"

describe("routine constants", () => {
  it("keeps manual A/B/C routines in the approved category order", () => {
    expect(ROUTINE_SEQUENCE).toEqual(["A", "B", "C"])
    expect(ROUTINES.A.categoryIds).toEqual([
      CategoryIdSchema.parse("squat"),
      CategoryIdSchema.parse("push"),
      CategoryIdSchema.parse("pull"),
      CategoryIdSchema.parse("core"),
    ])
    expect(ROUTINES.B.categoryIds).toEqual([
      CategoryIdSchema.parse("hinge"),
      CategoryIdSchema.parse("verticalPush"),
      CategoryIdSchema.parse("pull"),
      CategoryIdSchema.parse("core"),
    ])
    expect(ROUTINES.C.categoryIds).toEqual([
      CategoryIdSchema.parse("squat"),
      CategoryIdSchema.parse("hinge"),
      CategoryIdSchema.parse("push"),
      CategoryIdSchema.parse("verticalPush"),
    ])
  })

  it("advances only by manual completed-session sequence", () => {
    expect(getNextRoutine("A")).toBe("B")
    expect(getNextRoutine("B")).toBe("C")
    expect(getNextRoutine("C")).toBe("A")
  })

  it("prescribes two sets before session six completes and three sets from session seven", () => {
    // Given: completed-session counts before starting the next session.
    const sessionOrdinals = [5, 6, 7] as const

    // When: prescribed set counts are requested.
    const setCounts = sessionOrdinals.map(getPrescribedSetCount)

    // Then: count 6 means the first six sessions are done, so session 7 uses three sets.
    expect(setCounts).toEqual([2, 3, 3])
  })

  it("rejects malformed routine IDs at the exhaustive guard", () => {
    // Given: an impossible routine ID reaches the pure function from malformed state.
    const malformedRoutine = JSON.parse('"Z"')

    // When / Then: the exhaustive guard rejects it.
    expect(() => getNextRoutine(malformedRoutine)).toThrow("Unexpected domain variant")
  })
})
