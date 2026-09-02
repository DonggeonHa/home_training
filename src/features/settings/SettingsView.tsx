import type { ReactElement } from "react"
import type { ThemePreference } from "../../app/theme"
import { Field } from "../../shared/ui"
import type { DownloadPort } from "../../storage/ports"
import type { StoredState } from "../../storage/schemas"
import type { SettingsRestoreCommitResult } from "./restore-contract"
import { SettingsBackupPanel } from "./SettingsBackupPanel"
import "./settings.css"

export type ReducedMotionPreference = "system" | "reduce"
export type { SettingsRestoreCommitResult } from "./restore-contract"

type SettingsViewProps = {
  readonly currentState: StoredState
  readonly downloads: DownloadPort
  readonly onReducedMotionChange: (preference: ReducedMotionPreference) => void
  readonly onRestoreConfirmed: (
    state: StoredState,
  ) => SettingsRestoreCommitResult | Promise<SettingsRestoreCommitResult>
  readonly onThemeChange: (preference: ThemePreference) => void
  readonly reducedMotion: ReducedMotionPreference
  readonly theme: ThemePreference
}

export function SettingsView(props: SettingsViewProps): ReactElement {
  return (
    <section className="settings-page" aria-labelledby="settings-title">
      <div className="settings-intro">
        <p className="panel-label">Local controls</p>
        <h1 id="settings-title">설정과 백업</h1>
        <p>테마, 움직임 줄이기, JSON 백업과 전체 교체 복원을 관리합니다.</p>
      </div>
      <section className="settings-panel" aria-labelledby="display-settings-title">
        <h2 id="display-settings-title">표시 설정</h2>
        <Field id="theme-select" label="테마">
          <select
            value={props.theme}
            onChange={(event) =>
              props.onThemeChange(readThemePreference(event.currentTarget.value))
            }
          >
            <option value="system">시스템</option>
            <option value="light">라이트</option>
            <option value="dark">다크</option>
          </select>
        </Field>
        <label className="settings-check">
          <input
            checked={props.reducedMotion === "reduce"}
            onChange={(event) =>
              props.onReducedMotionChange(event.currentTarget.checked ? "reduce" : "system")
            }
            type="checkbox"
          />
          움직임 줄이기
        </label>
      </section>
      <SettingsBackupPanel
        currentState={props.currentState}
        downloads={props.downloads}
        onRestoreConfirmed={props.onRestoreConfirmed}
      />
    </section>
  )
}

function readThemePreference(value: string): ThemePreference {
  switch (value) {
    case "system":
    case "light":
    case "dark":
      return value
    default:
      return "system"
  }
}
