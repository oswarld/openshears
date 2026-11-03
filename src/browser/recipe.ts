import type { BrowserContext, Locator, Page } from 'playwright-core';
import {
  NotSignedInError,
  type AuditResult,
  type Connection,
  type ConnectionKind,
  type Provider,
  type ProviderContext,
  type ProviderSession,
} from '../core/model.js';
import { browserProfileDir, launchBrowser } from './session.js';

/** One click in a revoke flow, found by accessible role and name. */
export interface Step {
  /** Accessible role, or 'text' for a plain element found by its visible text. */
  role?: 'button' | 'menuitem' | 'link' | 'tab' | 'text';
  name?: RegExp;
  /** CSS selector, for controls without a usable accessible name. */
  selector?: string;
  /** Where to look: the whole page (default), the open dialog, or the connection's row. */
  within?: 'page' | 'dialog' | 'row';
  /** Skip silently when the control is absent (sites differ per account). */
  optional?: boolean;
}

export interface RowStrategy {
  /** CSS selector matching one element per connection. */
  selector: string;
  /** CSS selector inside the row holding the display name; the first heading/bold text otherwise. */
  name?: string;
  /** Row attribute to read the name from instead of text (e.g. aria-label). */
  nameAttribute?: string;
  /** Applied to the raw name; capture group 1 becomes the name (strips "Manage …" wording). */
  namePattern?: RegExp;
  /** Row attribute holding a stable id; a slug of the name otherwise. */
  idAttribute?: string;
  /** Rows whose text matches are not connections (headers, empty states). */
  exclude?: RegExp;
}

export interface ListPage {
  kind: ConnectionKind;
  label: string;
  /** Settings page path listing the connections. */
  path: string;
  /** Clicks needed after navigation, for lists that live inside dialogs or tabs. */
  openSteps?: Step[];
  /** Strategy A: links whose href starts with this prefix identify one connection each. */
  linkPrefix?: string;
  /** Use a slug of the name as id (with -2, -3 for duplicates) when link ids are not stable. */
  idFromName?: boolean;
  /** Strategy B: repeated row elements. */
  rows?: RowStrategy;
  revocable: boolean;
  note?: string;
}

export interface RevokeFlow {
  /** Open this page first; otherwise the flow runs on the list page. */
  detailPath?: (id: string) => string;
  /** On the list page, click the connection's row before the steps. */
  clickRow?: boolean;
  steps: Step[];
}

export interface WebRecipe {
  id: string;
  title: string;
  description: string;
  baseUrl: string;
  loginPath: string;
  /** Path prefixes the site redirects to when there is no session. */
  signedOutPaths: string[];
  /** Hostnames (other than baseUrl's) that mean "not signed in", e.g. accounts.google.com. */
  signedOutHosts?: string[];
  /** `<meta name=...>` whose content is the signed-in account name. */
  accountMeta?: string;
  lists: ListPage[];
  revoke: Partial<Record<ConnectionKind, RevokeFlow>>;
  /** Shown as a warning while the recipe has not been checked against the live site. */
  unverified?: string;
}

export interface ListedItem {
  /** Link href (strategy A) or stable id (strategy B). */
  href?: string;
  id?: string;
  text: string;
  row: string;
  /** First heading or bold text in the row, when the link text is generic. */
  nameHint?: string;
}

const ID_PATTERN = /^(?=.*[A-Za-z0-9])[A-Za-z0-9_.:@-]+$/;
const GENERIC_LINK_TEXT =
  /^(configure|revoke|edit|manage|view|details?|see details|remove|disconnect|open)$/i;
const SIGN_IN_TIMEOUT = 5 * 60 * 1000;
const MAX_PAGES = 25;
const DIALOG_SELECTOR =
  'dialog[open], details-dialog, [role="dialog"], [role="alertdialog"], details[open] > :not(summary)';

/** Navigation trace for recipe debugging: paths only, never query strings or page content. */
export function debug(message: string): void {
  if (process.env.OPENSHEARS_DEBUG)
    process.stderr.write(`[openshears] ${message}\n`);
}

function describeUrl(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);
    return `${hostname}${pathname}`;
  } catch {
    return url;
  }
}

export function isSignedOut(recipe: WebRecipe, url: string): boolean {
  const { pathname, hostname } = new URL(url);
  if (recipe.signedOutHosts?.includes(hostname)) return true;
  if (hostname !== new URL(recipe.baseUrl).hostname) return false;
  return recipe.signedOutPaths.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function assertSignedIn(recipe: WebRecipe, page: Page): void {
  if (isSignedOut(recipe, page.url()))
    throw new NotSignedInError(recipe.id, recipe.baseUrl + recipe.loginPath);
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page
    .waitForLoadState('networkidle', { timeout: 15_000 })
    .catch(() => undefined);
}

async function open(recipe: WebRecipe, page: Page, path: string) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await page.goto(recipe.baseUrl + path, { waitUntil: 'domcontentloaded' });
      break;
    } catch (error) {
      // A sign-in redirect still in flight aborts our navigation; try once more.
      if (attempt > 0 || !/ERR_ABORTED/.test(String(error))) throw error;
      await page.waitForTimeout(1_500);
    }
  }
  await settle(page);
  debug(
    `open ${describeUrl(recipe.baseUrl + path)} -> ${describeUrl(page.url())}`,
  );
  assertSignedIn(recipe, page);
}

export function parseLastUsed(row: string): string | undefined {
  const text = row.replace(/\s+/g, ' ');
  if (/\bnever used\b/i.test(text)) return 'Never used';
  const match =
    /last used\b.*?\b(?:ago|today|yesterday|never|(?:last|past) (?:day|week|month|year|\d+ \w+))\b/i.exec(
      text,
    );
  return match ? match[0].trim().slice(0, 80) : undefined;
}

export function parseOwner(row: string): string | undefined {
  const match = /\bowned by ([^\s·.,]+)/i.exec(row.replace(/\s+/g, ' '));
  return match?.[1];
}

export function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function nameFromRow(row: string, linkText: string): string {
  const withoutLink = linkText
    ? row.replace(new RegExp(`\\s*${escapeRegExp(linkText)}\\s*$`, 'i'), '')
    : row;
  return withoutLink.split('\n')[0].trim().slice(0, 80);
}

function pickName(item: ListedItem, id: string): string {
  const hint = item.nameHint?.trim();
  if (item.text && !GENERIC_LINK_TEXT.test(item.text))
    return item.text.slice(0, 80);
  if (hint && !GENERIC_LINK_TEXT.test(hint) && !hint.endsWith('?'))
    return hint.slice(0, 80);
  return nameFromRow(item.row, item.text) || id;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function connectionsFromItems(
  recipe: WebRecipe,
  list: ListPage,
  items: ListedItem[],
): Connection[] {
  const seen = new Map<string, Connection>();
  const linkIds = new Set<string>();
  for (const item of items) {
    let id: string;
    let url: string;
    if (list.linkPrefix && item.href !== undefined) {
      const rest = item.href.slice(list.linkPrefix.length);
      const linkId = rest.split(/[/?#]/)[0];
      // Only the connection page itself; sub-pages such as /permissions/update are not it.
      if (/^[^?#]/.test(rest.slice(linkId.length)) || !ID_PATTERN.test(linkId))
        continue;
      url = joinUrl(recipe.baseUrl, list.linkPrefix + linkId);
      if (list.idFromName) {
        // The same link listed twice (icon + name) is one connection; the same name
        // under different links is several.
        if (linkIds.has(linkId)) continue;
        linkIds.add(linkId);
        const base = slug(pickName(item, linkId)) || linkId;
        id = base;
        for (let n = 2; seen.has(id); n += 1) id = `${base}-${n}`;
        url = joinUrl(recipe.baseUrl, list.path);
      } else id = linkId;
    } else {
      id = item.id || slug(pickName(item, ''));
      url = joinUrl(recipe.baseUrl, list.path);
    }
    if (!ID_PATTERN.test(id)) continue;
    const name = pickName(item, id);
    const existing = seen.get(id);
    if (existing) {
      if (GENERIC_LINK_TEXT.test(existing.name) || existing.name === id)
        existing.name = name;
      continue;
    }
    seen.set(id, {
      provider: recipe.id,
      kind: list.kind,
      id,
      name,
      owner: parseOwner(item.row),
      url,
      lastUsed: parseLastUsed(item.row),
      revocable: list.revocable && Boolean(recipe.revoke[list.kind]),
      note: list.note,
    });
  }
  return [...seen.values()];
}

async function collectLinks(page: Page, prefix: string): Promise<ListedItem[]> {
  return page.$$eval(
    'a[href]',
    (anchors, linkPrefix) => {
      const idOf = (href: string) =>
        href.slice(linkPrefix.length).split(/[/?#]/)[0];
      const clean = (value: string | null | undefined) =>
        (value ?? '')
          .replace(/[ \t]+/g, ' ')
          .replace(/\s*\n\s*/g, '\n')
          .trim();
      return anchors.flatMap((anchor) => {
        const href = anchor.getAttribute('href') ?? '';
        if (!href.startsWith(linkPrefix)) return [];
        // The row is the widest ancestor that still links to this one connection only.
        let row: Element = anchor;
        while (
          row.parentElement &&
          !['BODY', 'MAIN', 'HTML'].includes(row.parentElement.tagName)
        ) {
          const parent = row.parentElement;
          const ids = new Set(
            Array.from(parent.querySelectorAll('a[href]'))
              .map((link) => link.getAttribute('href') ?? '')
              .filter((link) => link.startsWith(linkPrefix))
              .map(idOf),
          );
          if (ids.size > 1) break;
          row = parent;
        }
        const nameElement = row.querySelector(
          'h1, h2, h3, h4, h5, strong, b, .text-bold',
        );
        return [
          {
            href,
            text: clean(anchor.textContent),
            row: clean(row.textContent),
            nameHint: clean(nameElement?.textContent) || undefined,
          },
        ];
      });
    },
    prefix,
  );
}

async function collectRows(
  page: Page,
  rows: RowStrategy,
): Promise<ListedItem[]> {
  const items = await page.$$eval(
    rows.selector,
    (
      elements,
      options: { name?: string; idAttribute?: string; nameAttribute?: string },
    ) => {
      const clean = (value: string | null | undefined) =>
        (value ?? '')
          .replace(/[ \t]+/g, ' ')
          .replace(/\s*\n\s*/g, '\n')
          .trim();
      return elements
        .filter(
          (element) =>
            !elements.some(
              (other) => other !== element && other.contains(element),
            ),
        )
        .map((element) => {
          const nameElement = element.querySelector(
            options.name ?? 'h1, h2, h3, h4, h5, strong, b',
          );
          return {
            id: options.idAttribute
              ? (element.getAttribute(options.idAttribute) ?? undefined)
              : undefined,
            text: options.nameAttribute
              ? clean(element.getAttribute(options.nameAttribute))
              : clean(nameElement?.textContent),
            row:
              clean(element.textContent) ||
              clean(element.getAttribute(options.nameAttribute ?? '')),
          };
        });
    },
    {
      name: rows.name,
      idAttribute: rows.idAttribute,
      nameAttribute: rows.nameAttribute,
    },
  );
  return items
    .map((item) => {
      const match = rows.namePattern?.exec(item.text);
      return match ? { ...item, text: match[1] ?? item.text } : item;
    })
    .filter((item) => item.row && !rows.exclude?.test(item.row));
}

async function nextPage(page: Page): Promise<string | undefined> {
  const next = await page.$('a[rel="next"]');
  const href = await next?.getAttribute('href');
  return href && /^\/[^/]/.test(href) ? href : undefined;
}

function describeStep(step: Step): string {
  const target =
    step.selector ?? `${step.role ?? 'element'} matching ${step.name}`;
  return `${target} ${step.within ? `in the ${step.within}` : 'on the page'}`;
}

async function runSteps(
  page: Page,
  steps: Step[],
  row?: Locator,
): Promise<void> {
  for (const step of steps) {
    // The topmost visible dialog is the one a click just opened.
    const scope =
      step.within === 'dialog'
        ? page.locator(DIALOG_SELECTOR).filter({ visible: true }).last()
        : step.within === 'row' && row
          ? row
          : page;
    const control = step.selector
      ? scope.locator(step.selector).first()
      : step.role === 'text'
        ? scope.getByText(step.name ?? /./).last()
        : scope.getByRole(step.role ?? 'button', { name: step.name }).first();
    try {
      await control.click({ timeout: step.optional ? 5_000 : 15_000 });
    } catch (error) {
      if (step.optional) continue;
      throw new Error(
        `Could not find the ${describeStep(step)}: ${
          error instanceof Error ? error.message.split('\n')[0] : String(error)
        }`,
      );
    }
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(400);
  }
}

async function openList(
  recipe: WebRecipe,
  page: Page,
  list: ListPage,
): Promise<void> {
  await open(recipe, page, list.path);
  if (list.openSteps) {
    await runSteps(page, list.openSteps);
    await settle(page);
  }
}

async function collect(
  recipe: WebRecipe,
  page: Page,
  list: ListPage,
): Promise<ListedItem[]> {
  if (list.linkPrefix) return collectLinks(page, list.linkPrefix);
  if (list.rows) return collectRows(page, list.rows);
  throw new Error(`List "${list.label}" of ${recipe.id} declares no strategy.`);
}

async function listPage(
  recipe: WebRecipe,
  page: Page,
  list: ListPage,
): Promise<Connection[]> {
  await openList(recipe, page, list);
  const items: ListedItem[] = [];
  for (let count = 0; count < MAX_PAGES; count += 1) {
    items.push(...(await collect(recipe, page, list)));
    const next = await nextPage(page);
    if (!next) break;
    await open(recipe, page, next);
  }
  return connectionsFromItems(recipe, list, items);
}

function rowLocator(
  page: Page,
  list: ListPage,
  connection: Connection,
): Locator {
  const exactName = new RegExp(`^\\s*${escapeRegExp(connection.name)}\\s*$`);
  if (list.rows) {
    const { selector, idAttribute, nameAttribute } = list.rows;
    const rows = page.locator(selector);
    const byAttribute = (attribute: string, value: string, exact: boolean) => {
      const clean = value.replace(/"/g, '');
      const match = exact
        ? `[${attribute}="${clean}"]`
        : `[${attribute}*="${clean}"]`;
      // The attribute may sit on the row itself or on an element inside it. A
      // selector list needs the attribute appended to every alternative.
      const own = selector
        .split(',')
        .map((part) => `${part.trim()}${match}`)
        .join(', ');
      return rows
        .filter({ has: page.locator(match) })
        .or(page.locator(own))
        .first();
    };
    if (idAttribute) return byAttribute(idAttribute, connection.id, true);
    if (nameAttribute)
      return byAttribute(nameAttribute, connection.name, false);
    return rows
      .filter({
        hasText: new RegExp(`^\\s*${escapeRegExp(connection.name)}\\b`),
      })
      .first();
  }
  if (list.idFromName) {
    // Duplicate names get -2, -3 suffixes in list order.
    const index = Number(/-(\d+)$/.exec(connection.id)?.[1] ?? '1') - 1;
    return page
      .locator(`a[href^="${list.linkPrefix}"]`)
      .filter({ hasText: exactName })
      .nth(index);
  }
  return page
    .locator(`a[href^="${list.linkPrefix}${connection.id}"]`)
    .first()
    .locator(
      'xpath=ancestor::*[self::li or self::tr or @role="listitem" or contains(@class, "row") or contains(@class, "item")][1]',
    );
}

async function readAccount(
  recipe: WebRecipe,
  page: Page,
): Promise<string | undefined> {
  if (!recipe.accountMeta) return undefined;
  const meta = await page.$(`meta[name="${recipe.accountMeta}"]`);
  return (await meta?.getAttribute('content')) ?? undefined;
}

/** Check for a session in a separate tab so the user's own tab is never disturbed. */
async function probeSignedIn(
  recipe: WebRecipe,
  browser: BrowserContext,
): Promise<boolean> {
  const probe = await browser.newPage();
  try {
    await probe.goto(recipe.baseUrl + recipe.lists[0].path, {
      waitUntil: 'domcontentloaded',
    });
    await settle(probe);
    debug(
      `probe ${describeUrl(recipe.baseUrl + recipe.lists[0].path)} -> ${describeUrl(probe.url())}`,
    );
    return !isSignedOut(recipe, probe.url());
  } catch {
    return false;
  } finally {
    await probe.close().catch(() => undefined);
  }
}

async function waitForSignIn(
  recipe: WebRecipe,
  browser: BrowserContext,
  page: Page,
  log: (message: string) => void,
) {
  await page.goto(recipe.baseUrl + recipe.loginPath, {
    waitUntil: 'domcontentloaded',
  });
  await settle(page);
  const site = new URL(recipe.baseUrl).hostname;
  const deadline = Date.now() + SIGN_IN_TIMEOUT;
  let announced = false;
  let last = '';
  let lastProbe = 0;
  // Leaving the login page is not proof of a session: sign-in detours through
  // identity providers and two-factor pages. The user's tab is left alone; a
  // second tab checks whether the first list page opens without bouncing to
  // the login page.
  for (;;) {
    const current = describeUrl(page.url());
    const changed = current !== last;
    if (changed) {
      last = current;
      debug(`sign-in wait: at ${current}`);
    }
    const onSite =
      new URL(page.url()).hostname === site && !isSignedOut(recipe, page.url());
    if (onSite && (changed || Date.now() - lastProbe > 8_000)) {
      lastProbe = Date.now();
      if (await probeSignedIn(recipe, browser)) {
        await open(recipe, page, recipe.lists[0].path);
        return;
      }
    }
    if (!announced) {
      log(
        `Sign in to ${recipe.title} in the browser window, including any verification step. OpenShears waits up to five minutes and never reads what you type.`,
      );
      announced = true;
    }
    if (Date.now() > deadline)
      throw new Error(
        `Timed out waiting for the ${recipe.title} sign-in to complete.`,
      );
    if (page.isClosed() || browser.pages().length === 0)
      throw new Error(
        `The browser window was closed before the ${recipe.title} sign-in finished. Run the login again and leave the window open; it closes by itself once the session is confirmed.`,
      );
    await page.waitForTimeout(2_000).catch(() => undefined);
  }
}

/** Read-only dump of what a page exposes, for writing and repairing recipes. */
export interface PageInspection {
  url: string;
  headings: string[];
  links: { href: string; text: string }[];
  buttons: string[];
  /** Candidate repeated containers: selector-ish description and sample text. */
  rows: { tag: string; count: number; sample: string }[];
}

export async function inspectPage(page: Page): Promise<PageInspection> {
  const clean = (value: string) =>
    value.replace(/\s+/g, ' ').trim().slice(0, 100);
  const unique = <T>(values: T[]) => [...new Set(values)];
  const links = await page.$$eval('a[href]', (anchors) =>
    anchors.map((anchor) => ({
      href: anchor.getAttribute('href') ?? '',
      text: anchor.textContent ?? '',
    })),
  );
  const buttons = await page
    .getByRole('button')
    .evaluateAll((elements) =>
      elements.map(
        (element) =>
          element.getAttribute('aria-label') || element.textContent || '',
      ),
    );
  const headings = await page.$$eval('h1, h2, h3, h4', (elements) =>
    elements.map((element) => element.textContent ?? ''),
  );
  const rows = await page.$$eval(
    'li, tr, [role="listitem"], [role="row"], [role="link"]',
    (elements) => {
      const groups = new Map<string, { count: number; sample: string }>();
      for (const element of elements) {
        const key = `${element.tagName.toLowerCase()}${element.getAttribute('role') ? `[role=${element.getAttribute('role')}]` : ''}`;
        const sample = (element.textContent ?? '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 100);
        const group = groups.get(key) ?? { count: 0, sample };
        group.count += 1;
        if (!group.sample && sample) group.sample = sample;
        groups.set(key, group);
      }
      return [...groups.entries()].map(([tag, group]) => ({ tag, ...group }));
    },
  );
  return {
    url: page.url(),
    headings: unique(headings.map(clean).filter(Boolean)).slice(0, 50),
    links: unique(links.map((link) => `${link.href}\u0000${clean(link.text)}`))
      .map((pair) => pair.split('\u0000'))
      .filter(([href]) => !/^(#|javascript:|mailto:)/.test(href))
      .map(([href, text]) => ({ href: href.slice(0, 160), text }))
      .slice(0, 300),
    buttons: unique(buttons.map(clean).filter(Boolean)).slice(0, 120),
    rows,
  };
}

export class WebProviderSession implements ProviderSession {
  constructor(
    private readonly recipe: WebRecipe,
    private readonly browser: BrowserContext,
    private readonly page: Page,
  ) {}

  async audit(): Promise<AuditResult> {
    const result: AuditResult = {
      provider: this.recipe.id,
      connections: [],
      warnings: [],
    };
    const seen = new Set<string>();
    for (const list of this.recipe.lists) {
      for (const connection of await listPage(this.recipe, this.page, list)) {
        // Sites may reuse one detail page for several tabs; the first tab wins.
        if (seen.has(connection.id)) continue;
        seen.add(connection.id);
        result.connections.push(connection);
      }
      result.account ??= await readAccount(this.recipe, this.page);
    }
    if (this.recipe.unverified) result.warnings.push(this.recipe.unverified);
    return result;
  }

  async revoke(connection: Connection): Promise<void> {
    const flow = this.recipe.revoke[connection.kind];
    const list = this.recipe.lists.find(
      (item) => item.kind === connection.kind,
    );
    if (
      !flow ||
      !list ||
      !connection.revocable ||
      !ID_PATTERN.test(connection.id)
    )
      throw new Error(
        `${connection.name} cannot be revoked by OpenShears; use ${connection.url ?? this.recipe.baseUrl} instead.`,
      );
    let row: Locator | undefined;
    let before: Connection[] = [];
    if (flow.detailPath) {
      await open(this.recipe, this.page, flow.detailPath(connection.id));
    } else {
      before = await listPage(this.recipe, this.page, list);
      row = rowLocator(this.page, list, connection);
      if (flow.clickRow) {
        await row.click({ timeout: 15_000 });
        await settle(this.page);
      }
    }
    await runSteps(this.page, flow.steps, row);
    // Single-page apps send the revoke request after the dialog closes; give it a moment
    // before navigating away, otherwise the request is cancelled.
    await this.page.waitForTimeout(1_000);
    await settle(this.page);
    const remaining = await listPage(this.recipe, this.page, list);
    const sameName = (items: Connection[]) =>
      items.filter((item) => item.name === connection.name).length;
    const gone = list.idFromName
      ? sameName(remaining) < sameName(before)
      : !remaining.some((item) => item.id === connection.id);
    if (!gone)
      throw new Error(
        `${connection.name} is still listed after the revoke attempt; check ${connection.url}.`,
      );
  }

  async inspect(paths: string[]): Promise<PageInspection[]> {
    const results: PageInspection[] = [];
    const targets = paths.length
      ? paths
      : this.recipe.lists.map((list) => list.path);
    for (const path of targets) {
      const list = this.recipe.lists.find((item) => item.path === path);
      if (list) await openList(this.recipe, this.page, list);
      else await open(this.recipe, this.page, path);
      results.push(await inspectPage(this.page));
    }
    return results;
  }

  async close(): Promise<void> {
    await this.browser.close();
  }
}

export interface WebProvider extends Provider {
  recipe: WebRecipe;
}

export function createWebProvider(recipe: WebRecipe): WebProvider {
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    kind: 'remote',
    recipe,
    async connect(context: ProviderContext): Promise<ProviderSession> {
      const browser = await launchBrowser({
        profileDir: browserProfileDir(context.home),
        headless: context.headless,
        env: context.env,
      });
      try {
        const page = browser.pages()[0] ?? (await browser.newPage());
        if (context.signIn)
          await waitForSignIn(recipe, browser, page, context.log);
        else await open(recipe, page, recipe.lists[0].path);
        return new WebProviderSession(recipe, browser, page);
      } catch (error) {
        await browser.close().catch(() => undefined);
        throw error;
      }
    },
  };
}
