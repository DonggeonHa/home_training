import { afterEach, describe, expect, it } from "vitest"
import { SessionIdSchema } from "../../domain/schemas"
import { APP_STORAGE_KEY } from "../../storage"
import { createDefaultStoredState } from "../../storage/defaults"
import { MemoryStoragePort } from "../../storage/test-ports"
import {
  createAppStoreState,
  reduceAppStore,
  selectAssessmentStep,
  selectCanUseDashboard,
  selectSafetyGate,
  toStoredState,
} from "./index"

const now = "2026-09-02T00:00:00.000Z"
const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage")

describe("app store hydration and safety reducer", () => {
  afterEach(() => {
    if (originalLocalStorageDescriptor !== undefined) {
      Object.defineProperty(window, "localStorage", originalLocalStorageDescriptor)
    }
  })

  it("recovers malformed persisted state through the parsed storage adapter", () => {
    // Given: storage contains bytes that are not parseable app state.
    const storage = new MemoryStoragePort()
    storage.values.set(APP_STORAGE_KEY, "{not-json")

    // When: the app store hydrates.
    const state = createAppStoreState({ storage })

    // Then: the parsed adapter supplies defaults and a typed recovery notice.
    expect(state.stored).toEqual(createDefaultStoredState())
    expect(state.loadNotice).toMatchObject({ kind: "recovered", reason: "malformedJson" })
  })

  it("hydrates display defaults when browser localStorage is unavailable", () => {
    // Given: the browser localStorage getter is blocked while app storage is injected.
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("denied", "SecurityError")
      },
    })

    // When: the app store hydrates.
    const state = createAppStoreState({ storage: new MemoryStoragePort() })

    // Then: display preferences use safe defaults and stored app state still hydrates.
    expect(state.display.themePreference).toBe("system")
    expect(state.display.reducedMotionPreference).toBe("system")
    expect(state.stored).toEqual(createDefaultStoredState())
  })

  it("blocks red-flag safety answers without storing individual health answers", () => {
    // Given: a fresh app store.
    const state = createAppStoreState({ storage: new MemoryStoragePort() })

    // When: current chest pain is reported.
    const blocked = reduceAppStore(state, {
      type: "safetyAnswersSubmitted",
      answers: {
        chestPain: true,
        faintingOrSevereDizziness: false,
        unusualShortnessOfBreath: false,
        cardiovascularMetabolicRenalDisease: false,
        recentInjury: false,
      },
      now,
    })

    // Then: assessment/dashboard are blocked and persisted JSON still contains only clearance.
    expect(selectSafetyGate(blocked)).toMatchObject({ kind: "blocked", urgent: true })
    expect(selectCanUseDashboard(blocked)).toBe(false)
    expect(toStoredState(blocked).safety).toEqual({ cleared: false, clearedAt: null })
    expect(JSON.stringify(toStoredState(blocked))).not.toContain("chestPain")
  })

  it("clears safety only when all answers are clear and persists the minimal clearance timestamp", () => {
    // Given: a fresh app store.
    const state = createAppStoreState({ storage: new MemoryStoragePort() })

    // When: all safety questions are answered clear.
    const cleared = reduceAppStore(state, {
      type: "safetyAnswersSubmitted",
      answers: {
        chestPain: false,
        faintingOrSevereDizziness: false,
        unusualShortnessOfBreath: false,
        cardiovascularMetabolicRenalDisease: false,
        recentInjury: false,
      },
      now,
    })

    // Then: only clearance state is retained.
    expect(selectSafetyGate(cleared)).toEqual({ kind: "cleared" })
    expect(toStoredState(cleared).safety).toEqual({ cleared: true, clearedAt: now })
    expect(JSON.stringify(toStoredState(cleared))).not.toContain("faintingOrSevereDizziness")
  })

  it("keeps assessment blocked before safety clearance and clears transient safety blocks on review", () => {
    // Given: a red flag has blocked the current safety form.
    const blocked = reduceAppStore(createAppStoreState({ storage: new MemoryStoragePort() }), {
      type: "safetyAnswersSubmitted",
      answers: {
        chestPain: false,
        faintingOrSevereDizziness: false,
        unusualShortnessOfBreath: true,
        cardiovascularMetabolicRenalDisease: true,
        recentInjury: true,
      },
      now,
    })

    // When: assessment is requested and then the transient answers are reset for review.
    const blockedAssessment = reduceAppStore(blocked, { type: "assessmentStarted" })
    const reset = reduceAppStore(blockedAssessment, { type: "safetyReviewReset" })

    // Then: no assessment starts before clearance and the red flag was not persisted.
    expect(selectSafetyGate(blocked)).toEqual({
      kind: "blocked",
      urgent: false,
      reasons: ["unusualShortnessOfBreath", "cardiovascularMetabolicRenalDisease", "recentInjury"],
    })
    expect(toStoredState(blockedAssessment).assessment.status).toBe("notStarted")
    expect(selectSafetyGate(reset)).toEqual({ kind: "needsReview" })
  })

  it("marks severe dizziness or fainting as an urgent safety block", () => {
    // Given: fainting or severe dizziness is reported without chest pain.
    const state = createAppStoreState({ storage: new MemoryStoragePort() })

    // When: the safety form is submitted.
    const blocked = reduceAppStore(state, {
      type: "safetyAnswersSubmitted",
      answers: {
        chestPain: false,
        faintingOrSevereDizziness: true,
        unusualShortnessOfBreath: false,
        cardiovascularMetabolicRenalDisease: false,
        recentInjury: false,
      },
      now,
    })

    // Then: the safety gate is urgent and assessment remains unavailable.
    expect(selectSafetyGate(blocked)).toEqual({
      kind: "blocked",
      reasons: ["faintingOrSevereDizziness"],
      urgent: true,
    })
    expect(selectAssessmentStep(blocked)).toEqual({ kind: "blocked" })
  })

  it("stores typed save notices and clears them after a later successful save", () => {
    // Given: a store state after a storage write failure.
    const state = createAppStoreState({ storage: new MemoryStoragePort() })

    // When: save failure and success actions are reduced.
    const failed = reduceAppStore(state, { type: "saveFailed", reason: "quotaExceeded" })
    const recovered = reduceAppStore(failed, { type: "saveSucceeded" })

    // Then: the notice is typed and recoverable.
    expect(failed.saveNotice).toEqual({ kind: "saveFailed", reason: "quotaExceeded" })
    expect(recovered.saveNotice).toBeUndefined()
  })

  it("applies active-session updates and clears them on abandon", () => {
    const state = createAppStoreState({ storage: new MemoryStoragePort() })
    const activeSession = {
      id: SessionIdSchema.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
      routineId: "A" as const,
      startedAt: now,
      currentEntry: { categoryId: state.stored.progress.squat.categoryId, level: 0 },
      completedSetIndexes: [],
      restTimer: null,
    }

    const updated = reduceAppStore(state, { type: "activeSessionChanged", activeSession })
    const cleared = reduceAppStore(updated, { type: "activeSessionChanged", activeSession: null })

    expect(updated.stored.activeSession).toEqual(activeSession)
    expect(cleared.stored.activeSession).toBeNull()
  })

  it("applies workout completion patches atomically and idempotently", () => {
    const state = createAppStoreState({ storage: new MemoryStoragePort() })
    const completedSession = {
      id: SessionIdSchema.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
      routineId: "A" as const,
      completedAt: now,
      entries: [],
    }
    const patch = {
      activeSession: null,
      completedSession,
      nextRoutine: "B" as const,
      progress: state.stored.progress,
    }

    const completed = reduceAppStore(state, { type: "workoutCompletionApplied", patch })
    const repeated = reduceAppStore(completed, { type: "workoutCompletionApplied", patch })

    expect(completed.stored).toMatchObject({
      activeSession: null,
      nextRoutine: "B",
      completedSessions: [completedSession],
    })
    expect(repeated.stored.completedSessions).toHaveLength(1)
  })

  it("throws on unsupported reducer actions in exhaustive builds", () => {
    // Given: an impossible action reaches the reducer.
    const state = createAppStoreState({ storage: new MemoryStoragePort() })
    const malformedAction = JSON.parse('{"type":"unsupportedAction"}')

    // When / Then: the exhaustive guard fails loudly.
    expect(() => reduceAppStore(state, malformedAction)).toThrow(/unsupportedAction/)
  })
})
