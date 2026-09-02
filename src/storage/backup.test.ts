import { describe, expect, it, vi } from "vitest"
import { createRestorePreview, exportStoredState, restoreStoredState } from "./backup"
import { createDefaultStoredState } from "./defaults"
import { MemoryDownloadPort } from "./test-ports"

describe("backup and restore boundaries", () => {
  it("exports validated current state JSON", () => {
    // Given: a valid current state.
    const state = createDefaultStoredState()

    // When: the user exports a backup.
    const exported = exportStoredState(state)

    // Then: the JSON round-trips through the storage schema.
    expect(JSON.parse(exported)).toEqual(state)
  })

  it("previews a valid backup with counts, levels, and date range", () => {
    // Given: a backup with completed sessions.
    const state = {
      ...createDefaultStoredState(),
      completedSessions: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          routineId: "A",
          completedAt: "2026-09-01T00:00:00.000Z",
          entries: [],
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          routineId: "B",
          completedAt: "2026-09-03T00:00:00.000Z",
          entries: [],
        },
      ],
    }
    const current = createDefaultStoredState()

    // When: the user opens restore preview.
    const result = createRestorePreview({ rawJson: JSON.stringify(state), current })

    // Then: no replacement occurs during preview.
    expect(result).toMatchObject({
      kind: "valid",
      sessionCount: 2,
      dateRange: { from: "2026-09-01T00:00:00.000Z", to: "2026-09-03T00:00:00.000Z" },
      levels: { push: 0, pull: 0, squat: 0, hinge: 0, verticalPush: 0, core: 0 },
    })
    expect(current.completedSessions).toHaveLength(0)
  })

  it("previews an empty backup with a null date range", () => {
    // Given: a valid backup without completed sessions.
    const current = createDefaultStoredState()

    // When: the user opens restore preview.
    const result = createRestorePreview({ rawJson: JSON.stringify(current), current })

    // Then: date range is intentionally empty, not fabricated.
    expect(result).toMatchObject({
      kind: "valid",
      sessionCount: 0,
      dateRange: { from: null, to: null },
    })
  })

  it("rejects oversized, invalid JSON, future versions, extra fields, and invalid categories without mutation", () => {
    // Given: malformed restore inputs and a current state.
    const current = createDefaultStoredState()
    const invalidCategory = {
      ...current,
      progress: {
        ...current.progress,
        push: { ...current.progress.push, categoryId: "cardio" },
      },
    }
    const swappedValidCategory = {
      ...current,
      progress: {
        ...current.progress,
        push: { ...current.progress.push, categoryId: "pull" },
      },
    }
    const extraField = { ...current, healthAnswers: { chestPain: false } }

    // When: the user previews each invalid input.
    const oversized = createRestorePreview({ rawJson: "x".repeat(2 * 1024 * 1024 + 1), current })
    const invalidJson = createRestorePreview({ rawJson: "{nope", current })
    const multibyteInvalidJson = createRestorePreview({ rawJson: "é한😀", current })
    const futureVersion = createRestorePreview({
      rawJson: JSON.stringify({ ...current, schemaVersion: 99 }),
      current,
    })
    const unknownField = createRestorePreview({ rawJson: JSON.stringify(extraField), current })
    const badCategory = createRestorePreview({ rawJson: JSON.stringify(invalidCategory), current })
    const swappedCategory = createRestorePreview({
      rawJson: JSON.stringify(swappedValidCategory),
      current,
    })

    // Then: current state remains byte-equivalent and no success is claimed.
    expect(oversized).toMatchObject({ kind: "invalid", reason: "tooLarge", currentState: current })
    expect(invalidJson).toMatchObject({
      kind: "invalid",
      reason: "malformedJson",
      currentState: current,
    })
    expect(multibyteInvalidJson).toMatchObject({
      kind: "invalid",
      reason: "malformedJson",
      currentState: current,
    })
    expect(futureVersion).toMatchObject({
      kind: "invalid",
      reason: "futureVersion",
      currentState: current,
    })
    expect(unknownField).toMatchObject({
      kind: "invalid",
      reason: "schemaMismatch",
      currentState: current,
    })
    expect(badCategory).toMatchObject({
      kind: "invalid",
      reason: "schemaMismatch",
      currentState: current,
    })
    expect(swappedCategory).toMatchObject({
      kind: "invalid",
      reason: "schemaMismatch",
      currentState: current,
    })
    expect(JSON.stringify(current)).toBe(JSON.stringify(createDefaultStoredState()))
  })

  it("rejects invalid metric and laterality imports without changing current state", () => {
    // Given: imported history with incompatible metric and set laterality.
    const current = createDefaultStoredState()
    const invalidMetric = {
      ...current,
      completedSessions: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          routineId: "A",
          completedAt: "2026-09-01T00:00:00.000Z",
          entries: [
            {
              categoryId: "push",
              level: 3,
              exerciseName: "일반 푸시업",
              metricRule: {
                kind: "duration",
                minSeconds: 30,
                maxSeconds: 45,
                sets: 3,
                laterality: "none",
              },
              sets: [
                {
                  kind: "perSide",
                  left: 30,
                  right: 30,
                  quality: { pain: false, form: "good", rom: "full" },
                },
              ],
            },
          ],
        },
      ],
    }

    // When: the user previews the invalid import.
    const result = createRestorePreview({ rawJson: JSON.stringify(invalidMetric), current })

    // Then: the current state is returned byte-equivalent with no restore success.
    expect(result).toMatchObject({
      kind: "invalid",
      reason: "schemaMismatch",
      currentState: current,
    })
    expect(JSON.stringify(current)).toBe(JSON.stringify(createDefaultStoredState()))
  })

  it("requires an explicit confirmation token and downloads a pre-restore backup before replacing", () => {
    // Given: a valid preview and current state that differs from the import.
    const current = {
      ...createDefaultStoredState(),
      safety: { cleared: true, clearedAt: "2026-09-01T00:00:00.000Z" },
    }
    const replacement = createDefaultStoredState()
    const preview = createRestorePreview({ rawJson: JSON.stringify(replacement), current })
    const downloads = new MemoryDownloadPort()

    // When: restore is attempted without and then with the confirmation token.
    const rejected = restoreStoredState({ preview, confirmation: "wrong", current, downloads })
    const restored =
      preview.kind === "valid"
        ? restoreStoredState({
            preview,
            confirmation: preview.confirmationToken,
            current,
            downloads,
          })
        : rejected

    // Then: restore is full replacement only after backup download.
    expect(rejected).toEqual({ kind: "rejected", reason: "confirmationMismatch", state: current })
    expect(restored).toEqual({ kind: "restored", state: replacement })
    expect(downloads.downloads).toHaveLength(1)
    expect(downloads.downloads[0]?.content).toBe(JSON.stringify(current, null, 2))
  })

  it("rejects restore attempts from an invalid preview", () => {
    // Given: an invalid preview and a current state.
    const current = createDefaultStoredState()
    const preview = createRestorePreview({ rawJson: "{broken", current })
    const downloads = new MemoryDownloadPort()

    // When: restore is requested anyway.
    const result = restoreStoredState({ preview, confirmation: "REPLACE", current, downloads })

    // Then: no replacement or pre-restore download occurs.
    expect(result).toEqual({ kind: "rejected", reason: "invalidPreview", state: current })
    expect(downloads.downloads).toEqual([])
  })

  it("rethrows unexpected restore JSON parser failures", () => {
    // Given: JSON.parse fails with a non-syntax parser error.
    const current = createDefaultStoredState()
    const parseSpy = vi.spyOn(JSON, "parse").mockImplementation(() => {
      throw new TypeError("parser unavailable")
    })

    // When / Then: the boundary does not convert unexpected runtime failures to user data errors.
    expect(() => createRestorePreview({ rawJson: "{}", current })).toThrow(TypeError)
    parseSpy.mockRestore()
  })
})
