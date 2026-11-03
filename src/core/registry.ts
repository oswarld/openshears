import type { Provider } from './model.js';
import { github } from '../providers/github.js';
import { google } from '../providers/google.js';
import { notion } from '../providers/notion.js';
import { stripe } from '../providers/stripe.js';
import { local } from '../providers/local.js';

export const providers: Provider[] = [github, google, notion, stripe, local];

export function findProvider(id: string, available: Provider[] = providers) {
  const provider = available.find((item) => item.id === id.toLowerCase());
  if (!provider)
    throw new Error(
      `Unknown provider "${id}". Available: ${available.map((item) => item.id).join(', ')}.`,
    );
  return provider;
}
