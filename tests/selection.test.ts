import { describe, expect, it } from 'vitest';
import type { Connection } from '../src/core/model.js';
import { patternMatches, planPrune } from '../src/core/selection.js';

const connection = (
  name: string,
  id = name.toLowerCase(),
  revocable = true,
): Connection => ({
  provider: 'github',
  kind: 'oauth-app',
  id,
  name,
  revocable,
});

const apps = [
  connection('OpenAI dots', 'aaa111'),
  connection('Grok bots', 'bbb222'),
  connection('Gemini Spark', 'ccc333'),
  connection('Claude Duet', 'ddd444'),
  connection('Meta Muse', 'eee555'),
  connection('Installed thing', 'fff666', false),
];

describe('pattern matching', () => {
  it('matches names case-insensitively with wildcards, or exact ids', () => {
    expect(patternMatches('claude duet', apps[3])).toBe(true);
    expect(patternMatches('Claude*', apps[3])).toBe(true);
    expect(patternMatches('*bots', apps[1])).toBe(true);
    expect(patternMatches('ddd444', apps[3])).toBe(true);
    expect(patternMatches('Claude', apps[3])).toBe(false);
    expect(patternMatches('(claude', apps[3])).toBe(false);
  });
});

describe('prune planning', () => {
  it('keeps the selected agent and revokes the rest', () => {
    const plan = planPrune(apps, {
      keep: ['Claude Duet'],
      revoke: [],
      all: false,
    });
    expect(plan.keep.map((item) => item.name)).toEqual(['Claude Duet']);
    expect(plan.revoke.map((item) => item.name)).toEqual([
      'OpenAI dots',
      'Grok bots',
      'Gemini Spark',
      'Meta Muse',
    ]);
    expect(plan.skipped.map((item) => item.name)).toEqual(['Installed thing']);
    expect(plan.unmatched).toEqual([]);
  });

  it('limits revocation to --revoke patterns and honours keep', () => {
    const plan = planPrune(apps, {
      keep: ['Grok*'],
      revoke: ['*bots', 'Meta Muse'],
      all: false,
    });
    expect(plan.revoke.map((item) => item.name)).toEqual(['Meta Muse']);
    expect(plan.keep).toHaveLength(5);
  });

  it('reports patterns that match nothing', () => {
    const plan = planPrune(apps, {
      keep: ['Claude Duett'],
      revoke: [],
      all: false,
    });
    expect(plan.unmatched).toEqual(['Claude Duett']);
  });

  it('revokes nothing without a selection', () => {
    const plan = planPrune(apps, { keep: [], revoke: [], all: false });
    expect(plan.revoke).toEqual([]);
    expect(plan.keep).toHaveLength(apps.length);
  });

  it('keeps interactively chosen ids with --all', () => {
    const plan = planPrune(apps, {
      keep: [],
      revoke: [],
      all: true,
      keepIds: ['ddd444'],
    });
    expect(plan.keep.map((item) => item.id)).toEqual(['ddd444']);
    expect(plan.revoke).toHaveLength(4);
  });
});
