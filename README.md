# 홈트레이닝 LEVEL UP

Korean mobile-first home-training app for progressive calisthenics and simple home equipment training. The app runs entirely in the browser with local-only storage.

## Product Features

- Onboarding gate for safety principles, available equipment, and starting level setup.
- HashRouter app routes for dashboard, workout, skill trees, workout history, and settings.
- Six movement categories: PUSH, PULL, SQUAT, HIP HINGE, VERTICAL PUSH, and CORE.
- Guided workout session flow with warmup checks, set logging, rest timing, abandonment, resume, and completion handling.
- Progression dashboard with current level, test-ready state, latest record, personal records, and next-routine guidance.
- History charts and accessible tables for reps, seconds, load, and left/right records.
- Settings for theme, reduced motion, JSON backup export, import preview, and full-state restore.
- Production smoke coverage for GitHub Pages-style subpath serving at `https://donggeonha.github.io/home_training/#/`.

## Data And Safety

All app data is stored locally in the browser. Clearing site data, changing browsers/devices, private browsing, or browser storage cleanup can remove progress. Use the JSON backup export before clearing data or restoring another state.

This app is not medical advice. Stop any exercise that causes sharp pain, numbness, chest pain, severe dizziness, or unusual symptoms, and consult a qualified professional when unsure. Check that pull-up bars, dumbbells, chairs, bands, and floor surfaces are stable before use.

## Requirements

- Node.js `22.23.2` for CI parity.
- pnpm `11.19.0`.
- Playwright browsers installed through the project command below.

## Commands

```powershell
pnpm install --frozen-lockfile
pnpm audit:security
pnpm exec playwright install --with-deps chromium chrome
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm test:domain-storage-coverage
pnpm test:catalog-coverage
pnpm build
pnpm exec playwright test --project=chromium
pnpm exec playwright test -c src/features/dashboard/todo11-playwright.config.ts --project=chromium
pnpm audit:react-doctor
pnpm audit:react-scan
pnpm audit:lighthouse
```

To audit an already deployed GitHub Pages URL without starting a local preview:

```powershell
pnpm audit:lighthouse --url "https://donggeonha.github.io/home_training/"
```

Local preview after `pnpm build`:

```powershell
pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort
```

Open `http://127.0.0.1:4173/#/`.

## Branches And Deployment

CI runs on pull requests plus pushes to `main`, `feature/**`, and `codex/**`. The Pages workflow runs on `main` and `workflow_dispatch`, runs the full quality suite before upload/deploy, deploys `dist`, and then reruns the Lighthouse real-Chrome gate against the deployed Pages URL on a clean runner.

The expected GitHub Pages URL is:

```text
https://donggeonha.github.io/home_training/#/
```

Pages enablement is not performed by this repository change. After merging to `main`, if GitHub Pages is not already enabled for GitHub Actions, run:

```powershell
gh api repos/DonggeonHa/home_training/pages -X POST -f build_type=workflow
```
