import { CategoryIdSchema } from "../domain/schemas"
import { createDefaultStoredState } from "../storage/defaults"

export function createCompletedOnboardingState() {
  return {
    ...createDefaultStoredState(),
    safety: { cleared: true, clearedAt: "2026-09-02T00:00:00.000Z" },
    assessment: {
      ...createDefaultStoredState().assessment,
      status: "complete",
      currentCategoryId: null,
    },
    progress: {
      push: {
        categoryId: CategoryIdSchema.parse("push"),
        level: 0,
        status: "provisional",
      },
      pull: { categoryId: CategoryIdSchema.parse("pull"), level: 0, status: "active" },
      squat: {
        categoryId: CategoryIdSchema.parse("squat"),
        level: 0,
        status: "testUnlocked",
      },
      hinge: {
        categoryId: CategoryIdSchema.parse("hinge"),
        level: 0,
        status: "provisional",
      },
      verticalPush: {
        categoryId: CategoryIdSchema.parse("verticalPush"),
        level: 0,
        status: "active",
      },
      core: {
        categoryId: CategoryIdSchema.parse("core"),
        level: 0,
        status: "testUnlocked",
      },
    },
  } satisfies ReturnType<typeof createDefaultStoredState>
}
