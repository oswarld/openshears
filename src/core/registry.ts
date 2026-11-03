import type { Provider } from './model.js';
import { github } from '../providers/github.js';
import { google } from '../providers/google.js';
import { notion } from '../providers/notion.js';
import { stripe } from '../providers/stripe.js';
import { slack } from '../providers/slack.js';
import { figma } from '../providers/figma.js';
import { vercel } from '../providers/vercel.js';
import { local } from '../providers/local.js';

export const providers: Provider[] = [
  github,
  google,
  notion,
  stripe,
  slack,
  figma,
  vercel,
  local,
];

export function findProvider(id: string, available: Provider[] = providers) {
  const provider = available.find((item) => item.id === id.toLowerCase());
  if (!provider)
    throw new Error(
      `Unknown provider "${id}". Available: ${available.map((item) => item.id).join(', ')}.`,
    );
  return provider;
}
