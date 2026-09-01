import { DownloadSimple, UploadSimple } from "@phosphor-icons/react"
import { useRef, useState } from "react"
import type { ThemePreference } from "../../app/theme"
import { Button, Field } from "../../shared/ui"
import { createRestorePreview, exportStoredState, type RestorePreview } from "../../storage/backup"
import type { DownloadPort } from "../../storage/ports"
import type { StoredState } from "../../storage/schemas"
import { readBackupFileAsText } from "./backup-file"
import {
  prepareRestore,
  restoreFailureMessage,
  type SettingsRestoreCommitResult,
} from "./restore-contract"
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

type ImportNotice =
  | { readonly kind: "idle" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "restored"; readonly message: string }

const maxImportBytes = 2 * 1024 * 1024

export function SettingsView(props: SettingsViewProps) {
  const [preview, setPreview] = useState<RestorePreview | null>(null)
  const [notice, setNotice] = useState<ImportNotice>({ kind: "idle" })
  const [confirmation, setConfirmation] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const confirmationInputRef = useRef<HTMLInputElement>(null)
  const restoreButtonRef = useRef<HTMLButtonElement>(null)

  const handleExport = () => {
    props.downloads.downloadJson(
      "home-training-level-up-backup.json",
      exportStoredState(props.currentState),
    )
  }

  const handleFileChange = (file: File | undefined) => {
    if (file === undefined) {
      return
    }
    if (file.size > maxImportBytes) {
      setPreview(null)
      setNotice({ kind: "error", message: "2MiB 이하 JSON 파일만 가져올 수 있습니다." })
      fileInputRef.current?.focus()
      return
    }
    void previewFile(file, props.currentState, setPreview, setNotice, () =>
      fileInputRef.current?.focus(),
    )
  }

  const handleRestore = async () => {
    if (preview === null) {
      setNotice({ kind: "error", message: "먼저 백업 파일을 선택하세요." })
      fileInputRef.current?.focus()
      return
    }
    const result = prepareRestore(preview, confirmation, props.currentState, props.downloads)
    switch (result.kind) {
      case "restored":
        await commitRestore(result.state, props.onRestoreConfirmed, setNotice)
        restoreButtonRef.current?.focus()
        return
      case "rejected":
        setNotice({ kind: "error", message: "확인 문구 REPLACE를 입력해야 합니다." })
        confirmationInputRef.current?.focus()
        return
      case "failed":
        setNotice({ kind: "error", message: "복원 전 현재 백업 저장에 실패했습니다." })
        restoreButtonRef.current?.focus()
        return
    }
  }

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
      <section className="settings-panel" aria-labelledby="backup-title">
        <h2 id="backup-title">백업과 복원</h2>
        <Button onClick={handleExport}>
          <DownloadSimple size={18} weight="bold" aria-hidden="true" />
          JSON 백업 내보내기
        </Button>
        <Field
          hint="현재 상태는 유효하지 않은 파일로 덮어쓰지 않습니다."
          id="backup-file"
          label="백업 파일 선택"
        >
          <input
            accept="application/json,.json"
            onChange={(event) => handleFileChange(event.currentTarget.files?.item(0) ?? undefined)}
            ref={fileInputRef}
            type="file"
          />
        </Field>
        <RestorePreviewPanel preview={preview} />
        <Field
          hint="전체 교체를 실행하려면 REPLACE를 입력하세요."
          id="restore-confirmation"
          label="확인 문구"
        >
          <input
            autoComplete="off"
            onChange={(event) => setConfirmation(event.currentTarget.value)}
            ref={confirmationInputRef}
            type="text"
            value={confirmation}
          />
        </Field>
        <Button onClick={() => void handleRestore()} ref={restoreButtonRef} variant="secondary">
          <UploadSimple size={18} weight="bold" aria-hidden="true" />
          전체 교체 복원
        </Button>
        <ImportNoticeView notice={notice} />
      </section>
    </section>
  )
}

async function previewFile(
  file: File,
  currentState: StoredState,
  setPreview: (preview: RestorePreview | null) => void,
  setNotice: (notice: ImportNotice) => void,
  restoreFocus: () => void,
): Promise<void> {
  try {
    const nextPreview = createRestorePreview({
      rawJson: await readBackupFileAsText(file),
      current: currentState,
    })
    if (nextPreview.kind === "invalid") {
      setPreview(null)
      setNotice({ kind: "error", message: "가져오기 파일을 읽을 수 없습니다." })
      restoreFocus()
      return
    }
    setPreview(nextPreview)
    setNotice({ kind: "idle" })
  } catch (error) {
    if (!isExpectedRestoreError(error)) {
      throw error
    }
    setPreview(null)
    setNotice({ kind: "error", message: "가져오기 파일을 읽을 수 없습니다." })
    restoreFocus()
    return
  }
}

async function commitRestore(
  state: StoredState,
  onRestoreConfirmed: SettingsViewProps["onRestoreConfirmed"],
  setNotice: (notice: ImportNotice) => void,
): Promise<void> {
  try {
    const commitResult = await onRestoreConfirmed(state)
    switch (commitResult.kind) {
      case "saved":
        setNotice({
          kind: "restored",
          message: "현재 상태를 백업하고 저장 확인 후 전체 교체했습니다.",
        })
        return
      case "failed":
        setNotice({ kind: "error", message: restoreFailureMessage(commitResult.reason) })
        return
    }
  } catch (error) {
    if (!isExpectedRestoreError(error)) {
      throw error
    }
    setNotice({ kind: "error", message: restoreFailureMessage("unknownStorageError") })
    return
  }
}

function isExpectedRestoreError(error: unknown): error is Error | DOMException {
  return (
    error instanceof Error || (typeof DOMException !== "undefined" && error instanceof DOMException)
  )
}

function RestorePreviewPanel({ preview }: { readonly preview: RestorePreview | null }) {
  if (preview?.kind !== "valid") {
    return null
  }

  return (
    <section className="restore-preview" aria-label="복원 미리보기">
      <p>{`복원 미리보기: 기록 ${preview.sessionCount}개`}</p>
      <p>{`레벨: ${Object.values(preview.levels).join(", ")}`}</p>
      <p>{`날짜 범위: ${preview.dateRange.from ?? "없음"} ~ ${preview.dateRange.to ?? "없음"}`}</p>
    </section>
  )
}

function ImportNoticeView({ notice }: { readonly notice: ImportNotice }) {
  if (notice.kind === "idle") {
    return null
  }
  return <p className={`settings-notice ${notice.kind}`}>{notice.message}</p>
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
