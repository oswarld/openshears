# OpenClaw compatibility review

Baseline: official **v2026.9.3**, published September 8, 2026. Reviewed September 10, 2026. The requested “2.0” update is treated as a request to support the current official release, whose package uses calendar versioning.

## Upstream contracts

| Contract                                                              | Reference at the reviewed tag                                                                                                                                                            | OpenShears change                                                                  |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Service teardown gates data removal; partial failure must be reported | [Uninstall command](https://github.com/openclaw/openclaw/blob/v2026.9.3/src/commands/uninstall.ts)                                                                                       | Stop services and verify process exit before deleting data; propagate failures.    |
| State and home can be relocated                                       | [State paths](https://github.com/openclaw/openclaw/blob/v2026.9.3/src/config/state-dir.ts), [home resolution](https://github.com/openclaw/openclaw/blob/v2026.9.3/src/infra/home-dir.ts) | Resolve environment paths at scan time; inspect default and relocated homes.       |
| Profiles use isolated `.openclaw-<profile>` directories               | [Profile names and paths](https://github.com/openclaw/openclaw/blob/v2026.9.3/src/cli/profile-utils.ts)                                                                                  | Validate names; discover configured profiles and the selected environment profile. |
| Gateway/profile and node services have separate identities            | [Service constants](https://github.com/openclaw/openclaw/blob/v2026.9.3/src/daemon/constants.ts)                                                                                         | Detect both gateway and node services, including registered jobs without files.    |
| Update handoffs can leave launchd jobs                                | [Update jobs](https://github.com/openclaw/openclaw/blob/v2026.9.3/src/daemon/launchd-update-jobs.ts)                                                                                     | Block removal while a recognized update job or definition remains.                 |
| npm, pnpm and Bun installs need the corresponding package manager     | [Removal guide](https://github.com/openclaw/openclaw/blob/v2026.9.3/docs/install/uninstall.md)                                                                                           | Detect exact package names per manager; suppress lifecycle scripts during removal. |
| The standalone installer can colocate state and runtime in a prefix   | [Installer guide](https://github.com/openclaw/openclaw/blob/v2026.9.3/docs/install/installer.md)                                                                                         | Refuse wholesale deletion of state roots containing installer tools/packages.      |

## Deliberate scope choices

- OpenShears remains an independent uninstaller and does not import or execute OpenClaw. No plugin SDK migration is required.
- The existing full-state deletion behavior is retained, including workspaces inside state. `--keep-data` preserves all state. External workspaces require `--include-workspaces`; this differs from the upstream uninstaller's separate state/workspace scopes and is stated in the CLI confirmation and README.
- The default scan covers all detected profiles. It does not promise single-profile isolation while uninstalling a shared global CLI package.
- Native Windows removal, system-service teardown, custom source/prefix installations, shell edits and containers are not implemented. Blockers and manual checks replace unconditional “your system is clean” claims.
- `$include` directives are not followed. Configuration parsing is limited to workspace discovery and never executes configuration expressions or prints configuration values.

## Safety regressions addressed

- Clack cancellation returns a truthy Symbol: removal now requires an explicit `true` result.
- `pgrep -f`/`pkill -f` previously matched arbitrary command-line substrings: process discovery now checks executable/entry point, user ownership and ancestry. Signals recheck PID, command and start time.
- Stopping a child process did not disable its supervisor: launchd/systemd teardown now precedes process and data cleanup.
- Generic errors previously disappeared or left a zero exit code: failed inspections block unsafe removal; mutation failures return status 1.
- Environment-controlled paths are checked against protected roots, shared directories and the working directory. Symlink ancestors and path redirection are rejected.
- Preview and JSON modes have no mutation path; JSON omits raw process commands.

## Review and verification

Run `npm test`, `npm run lint`, `npm run build` and `npm audit`. Test cases cover profile/env paths, JSON5, workspace preservation, service identities and teardown failures, package-manager detection, PID reuse, graceful/forced exit, filesystem boundaries, cancellation and previews.

CLI smoke checks: `node dist/index.js --help`, `--version`, `--dry-run` and `--json`. Packaging check: `npm pack --dry-run`.

The host is not used for a real uninstall. Linux service behavior is exercised through command fixtures, not a live Linux systemd service. Native Windows removal is explicitly blocked. Live service/package removal still merits platform testing before publication.

Verified locally: 66 tests pass; clean `npm ci --ignore-scripts`, TypeScript build, lint/typecheck, read-only CLI smoke checks, and package dry-run pass. `npm audit` reports zero vulnerabilities after upgrading Vitest/Vite and configuring ESLint for TypeScript. No commit or publication is part of this change.
