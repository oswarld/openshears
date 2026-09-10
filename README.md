# 🦞 OpenShears

Inspect and remove local OpenClaw installations on **macOS and Linux/WSL with a working user service manager**. OpenShears works independently of the OpenClaw CLI, including when that CLI is already missing or cannot start.

Compatibility is based on the official [OpenClaw v2026.9.3 release](https://github.com/openclaw/openclaw/releases/tag/v2026.9.3) and its [uninstall instructions](https://github.com/openclaw/openclaw/blob/v2026.9.3/docs/install/uninstall.md). OpenClaw currently uses date-based release versions; this project does not assume a `2.0` package version.

## Preview first

Requires Node.js 20 or newer to run the CLI. Preview commands never stop services, signal processes, uninstall packages or delete files:

```bash
npx openshears --dry-run
npx openshears --json
```

`--json` emits a JSON plan without banners or progress output and always implies a dry run, including when combined with `--yes`. Process arguments and configuration contents are omitted because they can contain credentials. A blocked scan exits with status 1 and still shows the available plan.

## Remove OpenClaw

```bash
npx openshears
```

Review the listed paths, services, processes and packages before confirming. **Removal is permanent.** State directories contain credentials, sessions, memory, installed plugins and any workspaces inside those directories. Back up anything you want to keep first.

The scan covers **all detected local profiles**, not only `OPENCLAW_PROFILE`. `OPENCLAW_PROFILE` adds that profile's state path to the scan. External workspaces are preserved by default. To keep all state/config/workspace data while removing the detected services and CLI packages:

```bash
npx openshears --keep-data
```

Options:

| Option                 | Behavior                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| `--dry-run`            | Show the removal plan without changes.                                                              |
| `--json`               | Print a read-only JSON plan.                                                                        |
| `-y`, `--yes`          | Confirm removal; required without a terminal.                                                       |
| `--force`              | Allow SIGKILL after a verified OpenClaw process ignores SIGTERM for five seconds.                   |
| `--include-workspaces` | Also remove configured workspaces outside state directories. Cannot be combined with `--keep-data`. |
| `--keep-data`          | Preserve state, configuration, credentials and workspaces.                                          |

Ctrl-C, Escape and a negative confirmation cancel removal. `--force` does not bypass confirmation, path protections or failed service checks.

## What is detected

- State under `~/.openclaw` and the existing legacy `.clawdbot`, `.moltbot`, `.moldbot` paths.
- Named `~/.openclaw-<profile>` directories containing `openclaw.json`, plus an explicitly selected `OPENCLAW_PROFILE` path.
- `OPENCLAW_HOME`, `OPENCLAW_STATE_DIR`, `OPENCLAW_CONFIG_PATH` and `OPENCLAW_OAUTH_DIR`, including tilde and relative paths.
- JSON/JSON5 workspace paths in `agents.defaults.workspace`, `agents.list[].workspace` and legacy `agent.workspace`.
- macOS gateway/profile/node LaunchAgents, registered jobs whose plist has disappeared, the OpenClaw app in `/Applications` or `~/Applications`, and `~/Library/Logs/OpenClaw`.
- Linux systemd user gateway/profile/node units, legacy `clawdbot-gateway.service`, unit backups and drop-in directories.
- Global `openclaw`, `clawdbot` and `moltbot` packages reported by npm, pnpm and Bun available on the current PATH.
- Current-user OpenClaw executable/process titles and known Node/Bun entry points. Incidental mentions in editors, shell arguments and unrelated scripts are not process targets.

## Removal behavior and boundaries

OpenShears validates paths before making changes, stops and unregisters services before removing packages or data, and verifies that matching processes have exited. Process signals use a PID whose command and start time are checked again. Service, process or package removal failures stop subsequent data deletion and return a nonzero exit status. Earlier successful changes are not rolled back.

Root directories, home directories, common shared directories and the current working directory (including their ancestors) cannot be removed. A state directory used as an installer prefix containing `tools` or `lib/node_modules` blocks data deletion: shared runtimes and packages require manual inspection. Final symbolic links are only unlinked; user-created symlinks in ancestor directories block removal. Run OpenShears outside the directory you intend to remove.

The scan is local and bounded. The following still need separate attention:

- Native Windows Scheduled Tasks: use `openclaw uninstall` on Windows. OpenShears reports native Windows removal as unsupported; WSL uses the Linux path.
- System services, Nix-managed installs, unrecognized custom service names and registered OpenClaw update jobs: resolve the reported blocker before retrying. OpenShears does not request sudo.
- Source checkouts, custom installer prefixes/wrappers, shell completion/PATH edits, shared caches, Docker/Podman containers and remote gateway hosts.
- Arbitrary custom process wrappers, other users' processes, and package installations not visible to the current package managers/PATH.
- Config `$include` files and custom logging paths outside state: config includes are not executed or expanded, and external paths remain for manual inspection.

Successful removal means the **detected artifacts** were removed. Preserved paths and reported manual checks still apply.

## Development

Use Node.js 22.12+ (22.x), 24.x or 26+ for the current test tooling. OpenShears does not require OpenClaw's own Node runtime to inspect an installation.

```bash
git clone https://github.com/oswarld/openshears.git
cd openshears
npm ci
npm run build
npm test
npm run lint
node dist/index.js --dry-run
```

Tests use temporary directories and mocked service/package/process commands. They never uninstall a host package or signal a real OpenClaw process. See [the compatibility review notes](docs/openclaw-compatibility.md) for upstream references and validation scope.

## Contributing

Include a regression test and an upstream reference when adding a new artifact or service identity. Keep detection read-only, preserve shared resources, and report incomplete cleanup explicitly.

## License

MIT. See [LICENSE](LICENSE).
