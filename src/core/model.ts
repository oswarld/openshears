export type ConnectionKind =
  | 'oauth-app'
  | 'app-authorization'
  | 'app-installation'
  | 'sign-in'
  | 'linked-account'
  | 'credential-store'
  | 'mcp-config';

export interface Connection {
  provider: string;
  kind: ConnectionKind;
  /** Stable identifier: client id, authorization id, installation id or file path. */
  id: string;
  name: string;
  /** Account that owns the app, when the site shows it. */
  owner?: string;
  url?: string;
  lastUsed?: string;
  /** Names only (MCP server names, scopes); never secrets or configuration values. */
  details?: string[];
  revocable: boolean;
  note?: string;
}

export interface AuditResult {
  provider: string;
  account?: string;
  connections: Connection[];
  warnings: string[];
}

export interface ProviderContext {
  home: string;
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  interactive: boolean;
  /** Run browser-backed providers without a visible window. */
  headless: boolean;
  /** Wait for the user to sign in instead of failing when a session is missing. */
  signIn?: boolean;
  log: (message: string) => void;
}

export interface ProviderSession {
  audit(): Promise<AuditResult>;
  revoke(connection: Connection): Promise<void>;
  close(): Promise<void>;
}

export interface Provider {
  id: string;
  title: string;
  description: string;
  kind: 'remote' | 'local';
  connect(context: ProviderContext): Promise<ProviderSession>;
}

export class NotSignedInError extends Error {
  constructor(
    public readonly provider: string,
    public readonly loginUrl: string,
  ) {
    super(
      `Not signed in to ${provider}. Run "openshears login ${provider}" first.`,
    );
    this.name = 'NotSignedInError';
  }
}

export const KIND_LABELS: Record<ConnectionKind, string> = {
  'oauth-app': 'OAuth app',
  'app-authorization': 'App authorization',
  'app-installation': 'App installation',
  'sign-in': 'Sign-in',
  'linked-account': 'Linked account',
  'credential-store': 'Credential store',
  'mcp-config': 'MCP configuration',
};
