import { createRoot } from "react-dom/client"
import { CategoryIdSchema, SessionIdSchema } from "../../domain/schemas"
import type { StoredState } from "../../storage"
import { MemoryDownloadPort } from "../../storage/test-ports"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import { HistoryView } from "../history/HistoryView"
import { type SettingsRestoreCommitResult, SettingsView } from "../settings/SettingsView"
import { SkillTreeView } from "../skill-tree/SkillTreeView"
import { DashboardView } from "./DashboardView"
import "../../styles/tokens.css"
import "../../styles/layout.css"
import "../../styles/ui.css"
import "./dashboard.css"
import "../history/history.css"
import "../settings/settings.css"
import "../skill-tree/skill-tree.css"

function createSeededState(): StoredState {
  const base = createCompletedOnboardingState()
  return {
    ...base,
    nextRoutine: "B",
    progress: {
      ...base.progress,
      push: {
        categoryId: CategoryIdSchema.parse("push"),
        level: 2,
        qualifiedSessionIds: [SessionIdSchema.parse("55555555-5555-4555-8555-555555555555")],
        status: "testUnlocked",
      },
      squat: {
        categoryId: CategoryIdSchema.parse("squat"),
        level: 3,
        status: "active",
      },
    },
    completedSessions: [
      {
        completedAt: "2026-09-01T09:00:00.000Z",
        entries: [
          {
            categoryId: CategoryIdSchema.parse("push"),
            exerciseName: "인클라인 푸시업",
            level: 2,
            metricRule: { kind: "reps", laterality: "none", max: 15, min: 12, sets: 3 },
            sets: [
              { kind: "single", quality: { form: "good", pain: false, rom: "full" }, value: 12 },
              {
                kind: "single",
                loadKg: 4,
                quality: { form: "good", pain: false, rom: "full" },
                value: 14,
              },
            ],
          },
          {
            categoryId: CategoryIdSchema.parse("squat"),
            exerciseName: "리버스 런지",
            level: 3,
            metricRule: { kind: "reps", laterality: "perSide", max: 12, min: 10, sets: 3 },
            sets: [
              {
                kind: "perSide",
                left: 9,
                quality: { form: "good", pain: false, rom: "full" },
                right: 8,
              },
            ],
          },
          {
            categoryId: CategoryIdSchema.parse("core"),
            exerciseName: "플랭크",
            level: 1,
            metricRule: {
              kind: "duration",
              laterality: "none",
              maxSeconds: 45,
              minSeconds: 30,
              sets: 3,
            },
            sets: [
              { kind: "single", quality: { form: "good", pain: false, rom: "full" }, value: 40 },
            ],
          },
        ],
        id: SessionIdSchema.parse("55555555-5555-4555-8555-555555555555"),
        routineId: "A",
      },
    ],
  }
}

const theme = new URLSearchParams(window.location.search).get("theme") === "dark" ? "dark" : "light"
const seededState = createSeededState()
const rootElement = document.getElementById("root")

function noopSaved(): SettingsRestoreCommitResult {
  return { kind: "saved" }
}

if (rootElement !== null) {
  createRoot(rootElement).render(
    <div className="app-shell todo11-visual-shell" data-theme={theme}>
      <main className="app-main" id="main-content">
        <DashboardView startHref="#/workout" state={seededState} />
        <SkillTreeView state={seededState} />
        <HistoryView state={seededState} />
        <SettingsView
          currentState={seededState}
          downloads={new MemoryDownloadPort()}
          onReducedMotionChange={() => undefined}
          onRestoreConfirmed={noopSaved}
          onThemeChange={() => undefined}
          reducedMotion="system"
          theme={theme}
        />
      </main>
    </div>,
  )
}
