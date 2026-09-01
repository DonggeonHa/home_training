import type { WorkoutCategoryPlan, WorkoutState } from "./types"

export function replaceCurrentPlan(state: WorkoutState, plan: WorkoutCategoryPlan): WorkoutState {
  /* c8 ignore next 3 */
  if (state.session === null) {
    return state
  }

  return {
    ...state,
    session: {
      ...state.session,
      categoryPlans: state.session.categoryPlans.map((candidate, index) =>
        index === state.session?.currentCategoryIndex ? plan : candidate,
      ),
    },
  }
}

export function updateSession(
  state: WorkoutState,
  patch: Partial<WorkoutState["session"]>,
): WorkoutState {
  if (state.session === null) {
    return state
  }

  return { ...state, session: { ...state.session, ...patch } }
}
