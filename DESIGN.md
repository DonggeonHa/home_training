# 홈트레이닝 LEVEL UP Design System

## 1. Atmosphere & Identity

홈트레이닝 LEVEL UP feels like a calm training console for a beginner who wants visible progress without gym bravado. The signature is gameful restraint: level, progress, and session readiness are clear and motivating, while safety and form guidance stay sober and direct.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
| --- | --- | --- | --- | --- |
| Surface/primary | --surface-primary | #F6F8F4 | #101614 | Main app background |
| Surface/secondary | --surface-secondary | #EBF0EA | #17211E | Section bands and quiet panels |
| Surface/elevated | --surface-elevated | #FFFFFF | #1D2925 | Cards, dialogs, and controls |
| Surface/progress | --surface-progress | #DCE7DC | #25342F | Progress tracks and level tree rails |
| Text/primary | --text-primary | #15201C | #F3F7F1 | Headlines and body |
| Text/secondary | --text-secondary | #4C5F58 | #B7C5BE | Secondary text |
| Text/tertiary | --text-tertiary | #728179 | #82928B | Disabled text and hints |
| Border/default | --border-default | #C9D5CB | #33433D | Controls and dividers |
| Border/subtle | --border-subtle | #DDE6DD | #27352F | Soft separations |
| Accent/primary | --accent-primary | #256F4E | #72D49D | Primary actions, focus, current level |
| Accent/hover | --accent-hover | #1F5F42 | #95E4B4 | Hover and active action states |
| Accent/ink | --accent-ink | #F7FFF8 | #0D1712 | Text on accent surfaces |
| Status/success | --status-success | #256F4E | #72D49D | Clear, passed, saved |
| Status/warning | --status-warning | #965D16 | #E3B45D | Cautions and readiness prompts |
| Status/error | --status-error | #B84545 | #F08A8A | Pain, stop, destructive actions |
| Status/info | --status-info | #316F7F | #7CC9D8 | Neutral notices |

### Rules

- Green is interactive and progress-related, not decorative filler.
- Slate surfaces keep the app work-focused and readable for repeated use.
- Safety states never use playful treatment. Warning and error colors are direct.
- No raw color is allowed in UI code unless it is declared here first.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
| --- | --- | --- | --- | --- | --- |
| Display | 40px / 2.5rem | 750 | 1.15 | 0 | App title and major status |
| H1 | 32px / 2rem | 700 | 1.2 | 0 | Page titles |
| H2 | 24px / 1.5rem | 650 | 1.3 | 0 | Sections |
| H3 | 20px / 1.25rem | 650 | 1.35 | 0 | Cards and step titles |
| Body/lg | 18px / 1.125rem | 450 | 1.6 | 0 | Lead guidance |
| Body | 16px / 1rem | 400 | 1.6 | 0 | Default copy |
| Body/sm | 14px / 0.875rem | 400 | 1.5 | 0 | Secondary details |
| Caption | 12px / 0.75rem | 600 | 1.4 | 0 | Labels and metadata |
| Number | 24px / 1.5rem | 700 | 1.15 | 0 | Levels, timers, set values |

### Font Stack

- Primary: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
- Mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace

### Rules

- Use system UI fonts for Korean readability and fast loading.
- Body text never drops below 14px.
- Korean headings must preserve phrase integrity; reduce size before allowing awkward syllable wraps.
- Numeric progress may use the mono stack only when comparison benefits from fixed-width digits.

## 4. Spacing & Layout

### Base Unit

All spacing derives from 4px.

| Token | Value | Usage |
| --- | --- | --- |
| --space-1 | 4px | Tight icon or label gaps |
| --space-2 | 8px | Compact inline groups |
| --space-3 | 12px | Form field padding |
| --space-4 | 16px | Standard control and card spacing |
| --space-5 | 20px | Comfortable inner panel spacing |
| --space-6 | 24px | Default section content spacing |
| --space-8 | 32px | Card groups and route rhythm |
| --space-10 | 40px | Major page groups |
| --space-12 | 48px | Large vertical separation |
| --space-16 | 64px | Desktop page rhythm |

### Grid

- Max content width: 1184px
- Column system: single column on mobile, 12-column grid from 768px
- Breakpoints: sm 640px, md 768px, lg 1024px, xl 1280px
- Full-height surfaces use min-height: 100dvh, never fixed viewport height.

### Rules

- Mobile controls must be thumb-reachable and stable.
- Cards stay 8px radius or less.
- Do not nest cards inside cards.
- Use full-width page bands or unframed layouts for sections.

## 5. Components

### App Root

- Structure: skip link, app landmark header, main landmark, status panel.
- Variants: foundation-only before product routes exist.
- Spacing: --space-4 through --space-10.
- States: focus-visible skip link and action focus rings.
- Accessibility: Korean `lang`, semantic landmarks, one h1, no icon-only unlabeled controls.
- Motion: no automatic motion in the foundation root.

### Primary Navigation

- Structure: five route links in a semantic navigation landmark.
- Active state: use --accent-primary with --accent-ink.
- Accessibility: active link text and icon contrast must stay at AA through route redirects and state changes.
- Motion: transform may animate for press feedback; active color and background changes are discrete so transitional frames never dip below AA.

## 6. Motion & Interaction

### Timing

| Type | Duration | Easing | Usage |
| --- | --- | --- | --- |
| Micro | 120ms | ease-out | Button press and focus change |
| Standard | 220ms | ease-in-out | Panel or route state changes |
| Emphasis | 420ms | cubic-bezier(0.16, 1, 0.3, 1) | Level-up celebration later |

### Rules

- Animate only transform and opacity.
- Respect prefers-reduced-motion.
- Every interactive element has hover, active, and focus-visible states.
- Workout timers never depend on animation timing.

## 7. Depth & Surface

### Strategy

Use tonal-shift with restrained borders.

| Level | Treatment | Usage |
| --- | --- | --- |
| Base | --surface-primary | Page background |
| Quiet band | --surface-secondary | Grouping repeated content |
| Elevated | --surface-elevated with --border-subtle | Cards and controls |

### Rules

- Shadows are not part of the foundation system.
- Borders support affordance; tonal shifts carry hierarchy.
- Progress and level states use strong contrast before decoration.
