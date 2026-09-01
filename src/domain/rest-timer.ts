export type RestTimer = {
  readonly restEndsAt: string
}

export type RestTimerStartInput = {
  readonly nowMs: number
  readonly durationSeconds: number
}

export type RestTimerAdjustment = {
  readonly timer: RestTimer
  readonly nowMs: number
  readonly deltaSeconds: 30 | -30
}

export type RestTimerSkipInput = {
  readonly timer: RestTimer
  readonly nowMs: number
}

export type RestTimerSnapshotInput = {
  readonly timer: RestTimer
  readonly nowMs: number
  readonly previousRemainingSeconds?: number | undefined
}

export type RestAnnouncement = "30" | "10" | "0"

export type RestTimerSnapshot = {
  readonly remainingSeconds: number
  readonly announcements: readonly RestAnnouncement[]
}

const ANNOUNCEMENT_THRESHOLDS = [30, 10, 0] as const satisfies readonly number[]

export function startRestTimer(input: RestTimerStartInput): RestTimer {
  return createTimerEndingAt(input.nowMs + input.durationSeconds * 1_000)
}

export function adjustRestTimer(input: RestTimerAdjustment): RestTimer {
  const remainingSeconds = getRemainingSeconds(input.timer, input.nowMs)
  const adjustedSeconds = Math.max(0, remainingSeconds + input.deltaSeconds)
  return createTimerEndingAt(input.nowMs + adjustedSeconds * 1_000)
}

export function skipRestTimer(input: RestTimerSkipInput): RestTimer {
  return createTimerEndingAt(input.nowMs)
}

export function getRestTimerSnapshot(input: RestTimerSnapshotInput): RestTimerSnapshot {
  const remainingSeconds = getRemainingSeconds(input.timer, input.nowMs)
  return {
    remainingSeconds,
    announcements: getAnnouncements(input.previousRemainingSeconds, remainingSeconds),
  }
}

function createTimerEndingAt(epochMs: number): RestTimer {
  return { restEndsAt: new Date(epochMs).toISOString() }
}

function getRemainingSeconds(timer: RestTimer, nowMs: number): number {
  const restEndsAtMs = Date.parse(timer.restEndsAt)
  return Math.max(0, Math.ceil((restEndsAtMs - nowMs) / 1_000))
}

function getAnnouncements(
  previousRemainingSeconds: number | undefined,
  remainingSeconds: number,
): readonly RestAnnouncement[] {
  if (previousRemainingSeconds === undefined) {
    return []
  }

  return ANNOUNCEMENT_THRESHOLDS.filter(
    (threshold) => previousRemainingSeconds > threshold && remainingSeconds <= threshold,
  ).map((threshold) => String(threshold) as RestAnnouncement)
}
