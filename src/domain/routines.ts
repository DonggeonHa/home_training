import { assertNever } from "./assert-never"
import type { CategoryId, RoutineId } from "./contracts"
import { CategoryIdSchema } from "./schemas"

export type RoutineDefinition = {
  readonly id: RoutineId
  readonly title: string
  readonly categoryIds: readonly CategoryId[]
}

export const ROUTINE_SEQUENCE = ["A", "B", "C"] as const

export const ROUTINES: Readonly<Record<RoutineId, RoutineDefinition>> = {
  A: {
    id: "A",
    title: "Routine A",
    categoryIds: [
      CategoryIdSchema.parse("squat"),
      CategoryIdSchema.parse("push"),
      CategoryIdSchema.parse("pull"),
      CategoryIdSchema.parse("core"),
    ],
  },
  B: {
    id: "B",
    title: "Routine B",
    categoryIds: [
      CategoryIdSchema.parse("hinge"),
      CategoryIdSchema.parse("verticalPush"),
      CategoryIdSchema.parse("pull"),
      CategoryIdSchema.parse("core"),
    ],
  },
  C: {
    id: "C",
    title: "Routine C",
    categoryIds: [
      CategoryIdSchema.parse("squat"),
      CategoryIdSchema.parse("hinge"),
      CategoryIdSchema.parse("push"),
      CategoryIdSchema.parse("verticalPush"),
    ],
  },
} as const

export function getNextRoutine(currentRoutine: RoutineId): RoutineId {
  switch (currentRoutine) {
    case "A":
      return "B"
    case "B":
      return "C"
    case "C":
      return "A"
    default:
      return assertNever(currentRoutine)
  }
}
