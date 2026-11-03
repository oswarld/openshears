import fs from 'fs-extra';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditLocal } from '../src/providers/local.js';
import type { ProviderContext } from '../src/core/model.js';
import { fixture } from './helpers.js';

let home: string;
let cleanup: () => Promise<void>;

const context = (platform: NodeJS.Platform): ProviderContext => ({
  home,
  env: {},
  platform,
  interactive: false,
  headless: true,
  log: () => {},
});

beforeEach(async () => {
  ({ home, cleanup } = await fixture());
});
afterEach(() => cleanup());

describe('local agent inventory', () => {
  it('reports existing stores with MCP server names only', async () => {
    const config = path.join(
      home,
      'Library/Application Support/Claude/claude_desktop_config.json',
    );
    await fs.outputJson(config, {
      mcpServers: {
        github: { command: 'npx', env: { GITHUB_TOKEN: 'SECRET_TOKEN' } },
        notion: { url: 'https://example.invalid' },
      },
    });
    await fs.outputFile(
      path.join(home, '.codex/auth.json'),
      '{"token":"SECRET_TOKEN"}',
    );
    await fs.outputFile(path.join(home, '.claude.json'), '{ not json');
    const result = await auditLocal(context('darwin'));
    const names = result.connections.map((item) => item.name);
    expect(names).toEqual([
      'Claude Desktop: claude_desktop_config.json',
      'Claude Code: .claude.json',
      'Codex CLI: auth.json',
    ]);
    expect(result.connections[0].details).toEqual(['github', 'notion']);
    expect(result.connections.every((item) => !item.revocable)).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('SECRET_TOKEN');
  });

  it('skips stores for other platforms', async () => {
    await fs.outputJson(
      path.join(
        home,
        'Library/Application Support/Claude/claude_desktop_config.json',
      ),
      { mcpServers: {} },
    );
    const result = await auditLocal(context('linux'));
    expect(result.connections).toEqual([]);
  });
});
