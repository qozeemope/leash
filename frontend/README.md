# Leash frontend

React 19, TypeScript, Vite and TanStack Query. The interface for writing spending rules, running the shopping agent and reviewing the audit log.

## Run

```
npm install
npm run dev
```

The dev server runs on http://localhost:5173 and proxies `/api` to the Django backend on port 8000.

## Scripts

- `npm run build` type-checks and builds to `dist/`, which Django serves in production.
- `npm test` runs the unit tests (Node) and the component tests (Vitest).

## Structure

- `src/app` shell, routes and navigation.
- `src/features` one folder per area: auth, mandates, agent, audit, checkout, landing, dashboard.
- `src/shared` API client, types, formatting helpers and UI components.
- `src/styles/theme.css` the whole visual theme. Colours are custom properties on `:root`.
