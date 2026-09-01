import { Timer } from "@phosphor-icons/react"
import { Button } from "../../shared/ui"
import type { WorkoutAction } from "./reducer"
import type { WorkoutState } from "./types"

type RestTimerPanelProps = {
  readonly remainingSeconds: number | null
  readonly lastAnnouncement: WorkoutState["lastAnnouncement"]
  readonly onDispatch: (action: WorkoutAction) => void
}

export function RestTimerPanel(props: RestTimerPanelProps) {
  return (
    <>
      {props.remainingSeconds === null ? null : (
        <section className="workout-rest" aria-labelledby="rest-title">
          <Timer size={24} weight="duotone" aria-hidden="true" />
          <h2 id="rest-title">휴식</h2>
          <p className="workout-timer">{formatSeconds(props.remainingSeconds)}</p>
          <div className="workout-actions">
            <Button
              onClick={() => props.onDispatch({ type: "restAdjusted", deltaSeconds: -30 })}
              variant="secondary"
            >
              -30초
            </Button>
            <Button
              onClick={() => props.onDispatch({ type: "restAdjusted", deltaSeconds: 30 })}
              variant="secondary"
            >
              +30초
            </Button>
            <Button onClick={() => props.onDispatch({ type: "restSkipped" })} variant="secondary">
              Skip
            </Button>
          </div>
        </section>
      )}
      <p className="sr-only" aria-live="polite">
        {props.lastAnnouncement === null ? "" : `${props.lastAnnouncement}초 남았습니다`}
      </p>
    </>
  )
}

function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
}
