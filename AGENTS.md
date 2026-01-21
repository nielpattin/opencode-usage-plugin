# AGENTS.md - Usage Tracking Plugin

<instructions>
This plugin tracks and reports real-time usage snapshots (quotas, rate limits, credits) for AI providers like Copilot and Codex. It integrates into the opencode environment via hooks and provides a specialized tool for querying usage state.
</instructions>

## 🧭 Navigation

- **Entry Point**: `index.ts` (wires hooks and tools)
- **Core Logic**:
  - `hooks/`: Intercepts system events (auth, commands, sessions)
  - `providers/`: Specialized fetchers for different AI providers (e.g., GitHub Copilot)
  - `usage/`: Business logic for fetching and caching snapshots
  - `ui/`: Status indicators and display logic
- **Data Model**: `types.ts` defines `UsageSnapshot`, `UsageEntry`, and `PlanType`
- **State Management**: `state.ts` manages the in-memory usage snapshots

## 🛠️ Development Workflow

### Commands
Dependencies are in root `package.json`. The plugin loads via `opencode.json`.

- **Load Plugin**: `opencode` (automatically loads plugin specified in `opencode.json`)
- **Build Check**: Verify `index.ts` compiles: `bun --version && bun index.ts --help 2>/dev/null || true`
- **Test Storage**: `bun run debug-db.ts` (queries SQLite at `.opencode/plugin/usage/usage.sqlite`)
- **Test Paths**: `bun run debug-path.ts` (verifies auth file path resolution)

### Debug Scripts
Root-level `debug-*.ts` files provide isolated testing without full plugin startup:
- `debug-db.ts`: Query snapshot storage directly
- `debug-path.ts`: Verify cross-platform path resolution

### Conventions
- **Hooks**: MUST follow the pattern in `hooks/index.ts`. Use barrel exports to keep `index.ts` lean.
- **Providers**: NEW providers MUST implement the `UsageProvider` interface from `providers/base.ts` and be registered in `providers/index.ts`.
- **Types**: ALWAYS refer to `types.ts` for usage schemas to ensure consistency across providers.
- **Error Handling**: Use the utility helpers in `utils/` for consistent header and path handling.

## 🚀 Common Tasks

### Adding a New Provider
1. Create a new directory in `providers/<name>/`.
2. Implement `UsageProvider` interface.
3. Register the provider in `providers/index.ts`.
4. Add any necessary types to `types.ts`.

### Modifying UI Indicators
- Update `ui/status.ts` to change how usage information is displayed in the CLI/IDE.

### Debugging API Calls
- Use or adapt existing `probe-*.ts` scripts to test new API endpoints or authentication flows without running the full plugin.

<rules>
- MUST NOT modify `storage.ts` without verifying cross-platform path compatibility via `utils/paths.ts`.
- MUST use the `authHooks` to manage provider-specific credentials.
- SHOULD prioritize `CopilotProvider` patterns when implementing similar REST-based fetchers.
</rules>
