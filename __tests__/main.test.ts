import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as core from '@actions/core';
import * as github from '@actions/github';
import * as tc from '@actions/tool-cache';
import { run } from '../src/main.js';

vi.mock('node:process', () => ({
  default: {
    arch: 'x64',
    platform: 'linux',
    env: {},
  },
}));

vi.mock('node:fs', () => ({
  promises: {
    copyFile: vi.fn(),
    chmod: vi.fn(),
    mkdir: vi.fn(),
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
    warning: vi.fn(),
    setFailed: vi.fn(),
    addPath: vi.fn(),
  };
});

vi.mock('@actions/tool-cache', () => ({
  downloadTool: vi.fn(async (url) => {
    if (url === 'latest_url/mq') {
      return 'latest_tool/mq';
    }

    if (url === 'v0.1.0_url/mq') {
      return 'v0.1.0_tool/mq';
    }

    if (url === 'bin_foo_url/foo') {
      return 'bin_foo_tool/foo';
    }

    if (url === 'bin_bar_url/bar') {
      return 'bin_bar_tool/bar';
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
  getOctokit: vi.fn(() => {
    const getLatestRelease = vi.fn(async ({ repo }) => {
      if (repo === 'mq') {
        return {
          data: {
            tag_name: 'v0.1.0',
            assets: [
              {
                browser_download_url: 'latest_url/mq',
                name: 'mq-x86_64-unknown-linux-gnu',
              },
            ],
          },
        };
      }

      if (repo === 'mq-foo') {
        return {
          data: {
            tag_name: 'v1.0.0',
            assets: [
              {
                browser_download_url: 'bin_foo_url/foo',
                name: 'foo-x86_64-unknown-linux-gnu',
              },
            ],
          },
        };
      }

      if (repo === 'mq-bar') {
        return {
          data: {
            tag_name: 'v2.0.0',
            assets: [
              {
                browser_download_url: 'bin_bar_url/bar',
                name: 'bar-x86_64-unknown-linux-gnu',
              },
            ],
          },
        };
      }

      throw new Error(`Unknown repo: ${repo}`);
    });

    const getReleaseByTag = vi.fn(async ({ repo }) => {
      if (repo === 'mq') {
        return {
          data: {
            tag_name: 'v0.1.0',
            assets: [
              {
                browser_download_url: 'v0.1.0_url/mq',
                name: 'mq-x86_64-unknown-linux-gnu',
              },
            ],
          },
        };
      }

      throw new Error(`Unknown repo: ${repo}`);
    });

    return {
      rest: {
        repos: {
          getLatestRelease,
          getReleaseByTag,
        },
      },
    };
  }),
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

  it('should setup additional bins when bins input is provided', async () => {
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'version') {
        return '';
      }

      if (name === 'github-token') {
        return 'fake-token';
      }

      if (name === 'bins') {
        return 'foo,bar';
      }

      return '';
    });

    await run();

    expect(core.getInput).toHaveBeenCalledWith('bins');

    // Verify mq itself was set up
    expect(core.addPath).toHaveBeenCalledWith('latest_tool');

    // Verify additional bins were downloaded
    expect(tc.downloadTool).toHaveBeenCalledWith('bin_foo_url/foo');
    expect(tc.downloadTool).toHaveBeenCalledWith('bin_bar_url/bar');

    // Verify info messages for additional bins
    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining('foo'),
    );
    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining('bar'),
    );
  });

  it('should handle bins with whitespace correctly', async () => {
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'version') {
        return '';
      }

      if (name === 'github-token') {
        return 'fake-token';
      }

      if (name === 'bins') {
        return ' foo , bar ';
      }

      return '';
    });

    await run();

    // Verify additional bins were downloaded despite whitespace
    expect(tc.downloadTool).toHaveBeenCalledWith('bin_foo_url/foo');
    expect(tc.downloadTool).toHaveBeenCalledWith('bin_bar_url/bar');
  });

  it('should setup a single bin', async () => {
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'version') {
        return '';
      }

      if (name === 'github-token') {
        return 'fake-token';
      }

      if (name === 'bins') {
        return 'foo';
      }

      return '';
    });

    await run();

    expect(tc.downloadTool).toHaveBeenCalledWith('bin_foo_url/foo');
    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining('foo'),
    );
  });

  it('should not setup bins when bins input is empty', async () => {
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'version') {
        return '';
      }

      if (name === 'github-token') {
        return 'fake-token';
      }

      if (name === 'bins') {
        return '';
      }

      return '';
    });

    await run();

    // Only mq download, no additional bin downloads
    expect(tc.downloadTool).toHaveBeenCalledTimes(1);
    expect(tc.downloadTool).toHaveBeenCalledWith('latest_url/mq');
  });

  it('should warn when a bin release has no matching asset', async () => {
    const octokit = vi.mocked(github.getOctokit);
    octokit.mockReturnValue({
      rest: {
        repos: {
          getLatestRelease: vi.fn(async ({ repo }) => {
            if (repo === 'mq') {
              return {
                data: {
                  tag_name: 'v0.1.0',
                  assets: [
                    {
                      browser_download_url: 'latest_url/mq',
                      name: 'mq-x86_64-unknown-linux-gnu',
                    },
                  ],
                },
              };
            }

            // Return a release with no matching asset for the platform
            return {
              data: {
                tag_name: 'v1.0.0',
                assets: [],
              },
            };
          }),
          getReleaseByTag: vi.fn(),
        },
      },
    } as any);

    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'version') {
        return '';
      }

      if (name === 'github-token') {
        return 'fake-token';
      }

      if (name === 'bins') {
        return 'unknown';
      }

      return '';
    });

    await run();

    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('unknown'),
    );
  });
});
