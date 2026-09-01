# 홈트레이닝 LEVEL UP

Korean mobile-first home-training web app foundation for progressive resistance training skill trees.

## Stack

- React + Vite + strict TypeScript
- pnpm
- Biome
- Vitest + Testing Library + jsdom
- Playwright
- HashRouter-ready routing

## Commands

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test --run
pnpm build
pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort
```

## Scope

This foundation commit intentionally includes only documentation, strict tooling, and a minimal accessible app root. Product exercise data, routing, persistence, workout flows, and dashboards are implemented in later todos from `.omo/plans/home-training-levelup.md`.
