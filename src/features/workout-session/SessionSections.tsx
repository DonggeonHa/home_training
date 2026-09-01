import { WarningCircle } from "@phosphor-icons/react"
import { type SyntheticEvent, useEffect, useRef, useState } from "react"
import { Button } from "../../shared/ui"

export function WarmupList({ complete }: { readonly complete: boolean }) {
  return (
    <ol className="workout-list" aria-label="공통 워밍업">
      {[
        "제자리 걷기 60초",
        "팔 돌리기",
        "가슴 열고 닫기",
        "골반 원 그리기",
        "굿모닝",
        "맨몸 스쿼트",
      ].map((item) => (
        <li key={item}>{complete ? `완료 · ${item}` : item}</li>
      ))}
    </ol>
  )
}

export function GuidanceList(props: { readonly title: string; readonly items: readonly string[] }) {
  return (
    <div>
      <h3>{props.title}</h3>
      <ul className="workout-list">
        {props.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

export function PullChecklist(props: {
  readonly confirmed: boolean
  readonly items: readonly string[]
  readonly onConfirm: () => void
}) {
  const [checkedItems, setCheckedItems] = useState<ReadonlySet<string>>(() => new Set())
  const toggleItem = (item: string, checked: boolean) => {
    const nextItems = new Set(checkedItems)
    if (checked) {
      nextItems.add(item)
    } else {
      nextItems.delete(item)
    }
    setCheckedItems(nextItems)
    if (nextItems.size === props.items.length) {
      props.onConfirm()
    }
  }

  return (
    <fieldset className="workout-panel" disabled={props.confirmed}>
      <legend>철봉 안전 확인</legend>
      {props.items.map((item) => (
        <label className="workout-check" key={item}>
          <input
            checked={checkedItems.has(item)}
            type="checkbox"
            onChange={(event) => toggleItem(item, event.currentTarget.checked)}
          />
          <span>{item}</span>
        </label>
      ))}
    </fieldset>
  )
}

export function AbandonDialog(props: {
  readonly open: boolean
  readonly onCancel: () => void
  readonly onConfirm: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    /* c8 ignore next 3 */
    if (dialog === null) {
      return
    }

    if (props.open) {
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      if (dialog.open) {
        return
      }
      if (typeof dialog.showModal === "function") {
        dialog.showModal()
      } else {
        dialog.setAttribute("open", "")
      }
      dialog.querySelector<HTMLElement>("button")?.focus()
      return
    }

    if (dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close()
      } else {
        dialog.removeAttribute("open")
      }
    }
    returnFocusRef.current?.focus()
  }, [props.open])

  useEffect(() => {
    const dialog = dialogRef.current
    return () => {
      /* c8 ignore next 3 */
      if (dialog?.open === true && typeof dialog.close === "function") {
        dialog.close()
      }
      returnFocusRef.current?.focus()
    }
  }, [])

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault()
    props.onCancel()
  }

  return (
    <dialog
      aria-label="세션을 포기할까요?"
      className="workout-dialog"
      onCancel={handleCancel}
      ref={dialogRef}
    >
      <WarningCircle size={24} weight="duotone" aria-hidden="true" />
      <p>포기하면 완료 기록과 레벨 판정에 반영하지 않습니다.</p>
      <div className="workout-actions">
        <Button onClick={props.onConfirm}>포기 확정</Button>
        <Button onClick={props.onCancel} variant="secondary">
          계속하기
        </Button>
      </div>
    </dialog>
  )
}

export function uniqueItems(items: readonly string[]): readonly string[] {
  return [...new Set(items)]
}
