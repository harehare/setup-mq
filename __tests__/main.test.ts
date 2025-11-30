import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { run } from '../src/main.js';

vi.mock('node:process', () => ({
  default: {
    arch: 'x64',
    platform: 'linux',
    env: {},
  },
}));

vi.mock('fs', () => ({
  ...vi.importActual('fs'),
  promises: {
    copyFile: vi.fn(),
    chmod: vi.fn(),
  },
}));

vi.mock('@actions/core', () => {
  const getInput = vi.fn((name) => {
    if (name === 'version') {
      return 'v0.1.0';
    }

    if (name === 'github-token') {
      return 'fake-token';
    }

    return '';
  });

  return {
    getInput,
    info: vi.fn(),
    error: vi.fn(),
    setFailed: vi.fn(),
    addPath: vi.fn(),
  };
});

vi.mock('@actions/tool-cache', () => ({
  downloadTool: vi.fn(async (path) => {
    if (path === 'latest_url/mq') {
      return 'latest_tool/mq';
    }

    if (path === 'v0.1.0_url/mq') {
      return 'v0.1.0_tool/mq';
    }

    return '';
  }),
  extractTar: vi.fn().mockResolvedValue('/path/to/extracted/directory'),
  find: vi.fn().mockReturnValue(''),
  cacheDir: vi.fn(async (path) => path),
  cacheFile: vi.fn().mockResolvedValue('/path/to/cached/file'),
  addPath: vi.fn(),
}));

vi.mock('@actions/github', () => ({
  getOctokit: vi.fn(() => ({
    rest: {
      repos: {
        getLatestRelease: vi.fn().mockResolvedValue({
          data: {
            tag_name: 'v0.1.0',
            assets: [
              {
                browser_download_url: 'latest_url/mq',
                name: 'mq-x86_64-unknown-linux-gnu',
              },
            ],
          },
        }),
        getReleaseByTag: vi.fn().mockResolvedValue({
          data: {
            tag_name: 'v0.1.0',
            assets: [
              {
                browser_download_url: 'v0.1.0_url/mq',
                name: 'mq-x86_64-unknown-linux-gnu',
                version: 'v0.1.0',
              },
            ],
          },
        }),
      },
    },
  })),
}));

describe('GitHub Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should execute correctly with a specified version', async () => {
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'version') {
        return 'v0.1.0';
      }

      if (name === 'github-token') {
        return 'fake-token';
      }

      return '';
    });

    await run();

    expect(core.getInput).toHaveBeenCalledWith('version');
    expect(core.getInput).toHaveBeenCalledWith('github-token');
    expect(github.getOctokit).toHaveBeenCalledWith('fake-token');

    // Verify that addPath was called
    expect(core.addPath).toHaveBeenCalledWith('v0.1.0_tool');
  });

  it('should execute correctly with a no specified version', async () => {
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'version') {
        return '';
      }

      if (name === 'github-token') {
        return 'fake-token';
      }

      return '';
    });

    await run();

    expect(core.getInput).toHaveBeenCalledWith('version');
    expect(core.getInput).toHaveBeenCalledWith('github-token');
    expect(github.getOctokit).toHaveBeenCalledWith('fake-token');

    // Verify that getLatestRelease was called with the specified version
    expect(core.addPath).toHaveBeenCalledWith('latest_tool');
  });
});
