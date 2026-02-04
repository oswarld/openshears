import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectArtifacts } from '../src/detector.js';
import fs from 'fs-extra';
import { execa } from 'execa';
import { OPENCLAW_STATE_DIR } from '../src/paths.js';

vi.mock('fs-extra');
vi.mock('execa');

describe('detectArtifacts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should detect state directory if it exists', async () => {
    vi.mocked(fs.pathExists).mockImplementation(async (p) => {
        return p === OPENCLAW_STATE_DIR;
    });
    
    // Mock execa to fail/empty for others
    vi.mocked(execa).mockRejectedValue(new Error('not found'));

    const artifacts = await detectArtifacts();
    expect(artifacts.directories).toContain(OPENCLAW_STATE_DIR);
  });

  it('should detect global package if npm list returns it', async () => {
    vi.mocked(fs.pathExists).mockResolvedValue(false);
    vi.mocked(execa).mockImplementation(async (cmd: string, args?: readonly string[]) => {
      if (cmd === 'npm' && args?.includes('list')) {
        return { stdout: 'openclaw@1.0.0' } as any;
      }
      throw new Error('cmd not found');
    });

    const artifacts = await detectArtifacts();
    expect(artifacts.globalPackage).toBe(true);
  });
});
