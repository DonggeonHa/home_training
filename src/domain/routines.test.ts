import { describe, expect, it } from "vitest"
import { getNextRoutine, ROUTINE_SEQUENCE, ROUTINES } from "./routines"
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
})
