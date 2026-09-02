import { CheckCircle } from "@phosphor-icons/react/CheckCircle"
import { Info } from "@phosphor-icons/react/Info"
import { WarningCircle } from "@phosphor-icons/react/WarningCircle"
import { X } from "@phosphor-icons/react/X"
import {
  type ButtonHTMLAttributes,
  cloneElement,
  forwardRef,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from "react"

type ButtonVariant = "primary" | "secondary" | "ghost"

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant?: ButtonVariant
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, type = "button", variant = "primary", ...props },
  ref,
) {
  const classes = ["ui-button", `ui-button-${variant}`, className].filter(Boolean).join(" ")

  return <button className={classes} ref={ref} type={type} {...props} />
})

type CardProps = {
  readonly children: ReactNode
  readonly title?: string
}

export function Card({ children, title }: CardProps) {
  return (
    <section className="ui-card" aria-label={title}>
      {title === undefined ? null : <h2>{title}</h2>}
      {children}
    </section>
  )
}

type FieldControlProps = {
  readonly "aria-describedby"?: string
  readonly "aria-invalid"?: boolean
  readonly id?: string
}

type FieldProps = {
  readonly children: ReactElement<FieldControlProps>
  readonly error?: string
  readonly hint?: string
  readonly id: string
  readonly label: string
}

export function Field({ children, error, hint, id, label }: FieldProps) {
  const descriptionIds = [
    hint === undefined ? undefined : `${id}-hint`,
    error === undefined ? undefined : `${id}-error`,
  ].filter((descriptionId): descriptionId is string => descriptionId !== undefined)
  const controlProps = {
    id,
    ...(descriptionIds.length > 0 ? { "aria-describedby": descriptionIds.join(" ") } : {}),
    ...(error !== undefined ? { "aria-invalid": true } : {}),
  } satisfies FieldControlProps

  return (
    <div className="ui-field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, controlProps)}
      {hint === undefined ? null : (
        <p className="ui-field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error === undefined ? null : (
        <p className="ui-field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}

type NoticeTone = "info" | "success" | "warning" | "error"

type NoticeProps = {
  readonly children: ReactNode
  readonly title: string
  readonly tone?: NoticeTone
}

const noticeIcons = {
  error: WarningCircle,
  info: Info,
  success: CheckCircle,
  warning: WarningCircle,
} as const

export function Notice({ children, title, tone = "info" }: NoticeProps) {
  const Icon = noticeIcons[tone]
  const titleId = useId()

  return (
    <section className={`ui-notice ui-notice-${tone}`} aria-labelledby={titleId}>
      <Icon size={22} weight="duotone" aria-hidden="true" />
      <div>
        <h2 id={titleId}>{title}</h2>
        <div>{children}</div>
      </div>
    </section>
  )
}

type DialogProps = {
  readonly children: ReactNode
  readonly onOpenChange: (open: boolean) => void
  readonly open: boolean
  readonly title: string
  readonly triggerLabel: string
}

export function Dialog({ children, onOpenChange, open, title, triggerLabel }: DialogProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const onOpenChangeRef = useRef(onOpenChange)

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  }, [onOpenChange])

  useEffect(() => {
    if (!open) {
      if (dialogRef.current?.open === true && typeof dialogRef.current.close === "function") {
        dialogRef.current.close()
      }
      openerRef.current?.focus()
      return
    }

    const activeElement = document.activeElement
    openerRef.current = activeElement instanceof HTMLElement ? activeElement : null
    if (
      dialogRef.current !== null &&
      !dialogRef.current.open &&
      typeof dialogRef.current.showModal === "function"
    ) {
      dialogRef.current.showModal()
    }
    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChangeRef.current(false)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open])

  return (
    <dialog
      aria-labelledby={titleId}
      className="ui-dialog"
      onCancel={() => onOpenChange(false)}
      ref={dialogRef}
    >
      <header>
        <h2 id={titleId}>{title}</h2>
        <Button
          aria-label="닫기"
          className="ui-dialog-close"
          onClick={() => onOpenChange(false)}
          ref={closeButtonRef}
          variant="ghost"
        >
          <X size={20} weight="bold" aria-hidden="true" />
        </Button>
      </header>
      <div>{children}</div>
      <Button onClick={() => onOpenChange(false)} variant="secondary">
        {triggerLabel} 닫기
      </Button>
    </dialog>
  )
}

type ProgressProps = {
  readonly label: string
  readonly max: number
  readonly value: number
}

export function Progress({ label, max, value }: ProgressProps) {
  const safeValue = Math.min(Math.max(value, 0), max)
  const percent = max > 0 ? (safeValue / max) * 100 : 0

  return (
    <div className="ui-progress">
      <div className="ui-progress-label">
        <span>{label}</span>
        <span>{`${safeValue} / ${max}`}</span>
      </div>
      <div
        aria-label={label}
        aria-valuemax={max}
        aria-valuemin={0}
        aria-valuenow={safeValue}
        className="ui-progress-track"
        role="progressbar"
      >
        <span className="ui-progress-fill" style={{ inlineSize: `${percent}%` }} />
      </div>
    </div>
  )
}
