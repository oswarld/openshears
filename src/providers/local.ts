import fs from 'fs-extra';
import path from 'node:path';
import JSON5 from 'json5';
import type {
  AuditResult,
  Connection,
  Provider,
  ProviderContext,
  ProviderSession,
} from '../core/model.js';
import { pathExists } from '../utils.js';

interface Store {
  agent: string;
  /** Relative to the home directory. */
  path: string;
  holds: string;
  platforms?: NodeJS.Platform[];
  /** Key of the JSON object whose property names are MCP server names. */
  mcpKey?: string;
}

// Paths are inspected for existence only. MCP server *names* are read from
// JSON configuration; commands, arguments, environment and tokens are never read back.
export const LOCAL_STORES: Store[] = [
  {
    agent: 'Claude Desktop',
    path: 'Library/Application Support/Claude/claude_desktop_config.json',
    holds: 'MCP server configuration',
    platforms: ['darwin'],
    mcpKey: 'mcpServers',
  },
  {
    agent: 'Claude Desktop',
    path: '.config/Claude/claude_desktop_config.json',
    holds: 'MCP server configuration',
    platforms: ['linux'],
    mcpKey: 'mcpServers',
  },
  {
    agent: 'Claude Desktop',
    path: 'AppData/Roaming/Claude/claude_desktop_config.json',
    holds: 'MCP server configuration',
    platforms: ['win32'],
    mcpKey: 'mcpServers',
  },
  {
    agent: 'Claude Code',
    path: '.claude.json',
    holds: 'account session and MCP server configuration',
    mcpKey: 'mcpServers',
  },
  {
    agent: 'Claude Code',
    path: '.claude/.credentials.json',
    holds: 'OAuth credentials',
  },
  { agent: 'Codex CLI', path: '.codex/auth.json', holds: 'OpenAI credentials' },
  {
    agent: 'Codex CLI',
    path: '.codex/config.toml',
    holds: 'MCP server configuration',
  },
  {
    agent: 'Gemini CLI',
    path: '.gemini/oauth_creds.json',
    holds: 'Google OAuth credentials',
  },
  {
    agent: 'Gemini CLI',
    path: '.gemini/settings.json',
    holds: 'MCP server configuration',
    mcpKey: 'mcpServers',
  },
  {
    agent: 'Cursor',
    path: '.cursor/mcp.json',
    holds: 'MCP server configuration',
    mcpKey: 'mcpServers',
  },
  {
    agent: 'Windsurf',
    path: '.codeium/windsurf/mcp_config.json',
    holds: 'MCP server configuration',
    mcpKey: 'mcpServers',
  },
  {
    agent: 'Visual Studio Code',
    path: 'Library/Application Support/Code/User/mcp.json',
    holds: 'MCP server configuration',
    platforms: ['darwin'],
    mcpKey: 'servers',
  },
  {
    agent: 'Visual Studio Code',
    path: '.config/Code/User/mcp.json',
    holds: 'MCP server configuration',
    platforms: ['linux'],
    mcpKey: 'servers',
  },
  {
    agent: 'OpenClaw',
    path: '.openclaw/credentials',
    holds: 'stored provider credentials',
  },
  {
    agent: 'OpenClaw',
    path: '.openclaw/openclaw.json',
    holds: 'gateway configuration',
  },
  {
    agent: 'GitHub CLI',
    path: '.config/gh/hosts.yml',
    holds: 'GitHub OAuth tokens',
  },
];

async function mcpServerNames(
  file: string,
  key: string,
): Promise<string[] | undefined> {
  const parsed: unknown = JSON5.parse(await fs.readFile(file, 'utf8'));
  if (!parsed || typeof parsed !== 'object') return undefined;
  const servers = (parsed as Record<string, unknown>)[key];
  if (!servers || typeof servers !== 'object' || Array.isArray(servers))
    return undefined;
  return Object.keys(servers).sort();
}

export async function auditLocal(
  context: ProviderContext,
): Promise<AuditResult> {
  const result: AuditResult = {
    provider: 'local',
    connections: [],
    warnings: [],
  };
  for (const store of LOCAL_STORES) {
    if (store.platforms && !store.platforms.includes(context.platform))
      continue;
    const file = path.join(context.home, store.path);
    if (!(await pathExists(file))) continue;
    const connection: Connection = {
      provider: 'local',
      kind:
        store.mcpKey || /\bMCP\b/.test(store.holds)
          ? 'mcp-config'
          : 'credential-store',
      id: file,
      name: `${store.agent}: ${path.basename(store.path)}`,
      revocable: false,
      note: store.holds,
    };
    if (store.mcpKey) {
      try {
        connection.details = await mcpServerNames(file, store.mcpKey);
      } catch {
        result.warnings.push(
          `Could not parse ${file}; MCP server names unknown.`,
        );
      }
    }
    result.connections.push(connection);
  }
  return result;
}

export const local: Provider = {
  id: 'local',
  title: 'This machine',
  description:
    'Credential stores and MCP configurations of AI agents installed for the current user (read-only)',
  kind: 'local',
  async connect(context): Promise<ProviderSession> {
    return {
      audit: () => auditLocal(context),
      async revoke(connection) {
        throw new Error(
          `${connection.name} is reported for review only; OpenShears does not edit local agent configuration.`,
        );
      },
      async close() {},
    };
  },
};
