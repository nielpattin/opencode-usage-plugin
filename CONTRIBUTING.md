# Contributing

This plugin stays intentionally small. Keep changes minimal, predictable, and consistent with existing provider patterns.

## Non-negotiables

- Do not add random refactors in feature PRs.
- Do not add `console.log`/`console.error`/debug prints in `src/**`.
- Do not change formatting style or naming conventions outside the feature scope.
- Do not export new public APIs unless they are used by plugin runtime.
- Do not open PRs with unresolved conflicts or conflict markers.

## Required flow for every PR

1. Branch from latest `master`.
2. Keep PR scope focused (one feature/fix topic).
3. Follow existing module structure and file split.
4. Run checks locally:
   - `tsc --noEmit`
   - `npm run build`
5. Re-sync with `master` before final review request.

## Provider implementation rules

When adding/changing a provider under `src/providers/<name>/`:

- **Auth guard first**: return `null` when required auth is missing.
- **Validate external API payloads** with Zod `safeParse`.
- **Error handling**: return `null` for provider fetch failures; no noisy logging.
- **Types**: prefer inferred types from schemas for API responses.
- **No dead fields**: remove unused locals/exports immediately.
- **Integrate fully** in one PR:
  - `src/providers/index.ts`
  - `src/types.ts`
  - `src/usage/registry.ts`
  - `src/usage/fetch.ts`
  - relevant formatter in `src/ui/formatters/`
  - `src/ui/status.ts`

## UI/status output conventions

- Reuse shared helpers (`formatBar`, `formatResetSuffix`, `formatMissingSnapshot`).
- Keep line layout consistent with existing providers (`Label:` padded alignment).
- Include meaningful missing-data guidance for new providers in `formatMissingSnapshot`.
- Avoid introducing standalone formatter exports unless needed.

## Review checklist

- [ ] Scope is focused and minimal
- [ ] No logging/debug leftovers
- [ ] API payload validation present
- [ ] Type-check passes (`tsc --noEmit`)
- [ ] Build passes (`npm run build`)
- [ ] Provider is wired through config, registry, fetch, and status output
- [ ] PR is conflict-free against latest `master`
