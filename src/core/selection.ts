import type { Connection } from './model.js';

export interface PruneSelection {
  /** Patterns (name or id, `*` wildcard) for connections to keep. */
  keep: string[];
  /** Patterns for connections to revoke; empty means "everything not kept". */
  revoke: string[];
  /** Revoke every revocable connection that is not kept. */
  all: boolean;
  /** Exact ids chosen interactively; they are kept in addition to `keep`. */
  keepIds?: string[];
}

export interface PrunePlan {
  revoke: Connection[];
  keep: Connection[];
  /** Targeted but not revocable through OpenShears; listed for manual action. */
  skipped: Connection[];
  /** Patterns that matched nothing: usually a typo, so the plan must not run. */
  unmatched: string[];
}

export function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .trim()
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${escaped}$`, 'i');
}

export function patternMatches(
  pattern: string,
  connection: Connection,
): boolean {
  const regexp = patternToRegExp(pattern);
  return regexp.test(connection.name) || regexp.test(connection.id);
}

export function hasSelection(selection: PruneSelection): boolean {
  return Boolean(
    selection.all ||
    selection.keep.length ||
    selection.revoke.length ||
    selection.keepIds?.length,
  );
}

export function planPrune(
  connections: Connection[],
  selection: PruneSelection,
): PrunePlan {
  const keepIds = new Set(selection.keepIds ?? []);
  const unmatched = [...selection.keep, ...selection.revoke].filter(
    (pattern) =>
      !connections.some((connection) => patternMatches(pattern, connection)),
  );
  const plan: PrunePlan = { revoke: [], keep: [], skipped: [], unmatched };
  if (!hasSelection(selection)) {
    plan.keep = [...connections];
    return plan;
  }
  for (const connection of connections) {
    const kept =
      keepIds.has(connection.id) ||
      selection.keep.some((pattern) => patternMatches(pattern, connection));
    const targeted = selection.revoke.length
      ? selection.revoke.some((pattern) => patternMatches(pattern, connection))
      : true;
    if (kept || !targeted) plan.keep.push(connection);
    else if (connection.revocable) plan.revoke.push(connection);
    else plan.skipped.push(connection);
  }
  return plan;
}
