import process from 'node:process';
import * as os from 'node:os';
import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import * as core from '@actions/core';
import * as github from '@actions/github';
import * as tc from '@actions/tool-cache';

const TOOL_NAME = 'mq';
const OWNER = 'harehare';
const REPO = 'mq';
const MQ_BIN_DIR = path.join(os.homedir(), '.mq', 'bin');

const PLATFORM_MAP = {
  darwin_x64: 'x86_64-apple-darwin',
  darwin_arm64: 'aarch64-apple-darwin',
  win32_x64: 'x86_64-pc-windows-msvc.exe',
  win32_arm64: 'aarch64-pc-windows-msvc.exe',
  linux_arm64: 'aarch64-unknown-linux-gnu',
  linux_x64: 'x86_64-unknown-linux-gnu',
} as const;

type Platform = keyof typeof PLATFORM_MAP;

type Release = {
  version?: string;
  url?: string;
};

type GetReleaseOptions = {
  token: string;
  repo: string;
  toolName: string;
  platform: Platform;
  version?: string;
};

export async function run(): Promise<void> {
  try {
    const { arch, platform } = process;

    if (platform !== 'linux' && platform !== 'win32' && platform !== 'darwin') {
      core.error(`Not supported platform ${platform}`);
      return;
    }

    if (arch !== 'x64' && arch !== 'arm64') {
      core.error(`Not supported platform ${platform}`);
      return;
    }

    const version: string = core.getInput('version');
    const token = core.getInput('github-token');
    const binsInput: string = core.getInput('bins');

    // Setup main mq tool
    await setupMq(token, platform, arch, version);

    // Setup additional bins from mq-XXX repositories
    if (binsInput) {
      const bins = binsInput
        .split(',')
        .map((b) => b.trim())
        .filter((b) => b.length > 0);

      if (bins.length > 0) {
        await fs.mkdir(MQ_BIN_DIR, { recursive: true });
        core.addPath(MQ_BIN_DIR);

        await Promise.all(
          bins.map(async (bin) =>
            setupAdditionalBin(token, platform, arch, bin),
          ),
        );
      }
    }
  } catch (error) {
    console.log('error', error);
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('Unknown error occurred');
    }
  }
}

async function setupMq(
  token: string,
  platform: string,
  arch: string,
  version: string,
): Promise<void> {
  const release = await getRelease({
    token,
    repo: REPO,
    toolName: TOOL_NAME,
    platform: `${platform}_${arch}` as Platform,
    version,
  });

  if (!release.url || !release.version) {
    core.info(
      `Not Found ${TOOL_NAME} version ${version} for ${platform}-${arch}`,
    );
    return;
  }

  let toolPath = tc.find(TOOL_NAME, release.version, arch);
  const isAct = process.env.ACT === 'true';

  if (!toolPath) {
    const downloadPath = await tc.downloadTool(release.url);
    const mqPath = path.join(path.dirname(downloadPath), 'mq');

    await fs.copyFile(downloadPath, mqPath);
    await fs.chmod(mqPath, '755');

    if (isAct) {
      toolPath = path.dirname(downloadPath);
    } else {
      toolPath = await tc.cacheDir(
        path.dirname(downloadPath),
        TOOL_NAME,
        release.version,
        arch,
      );
    }
  }

  core.addPath(toolPath);
  core.info(
    `Setting up ${TOOL_NAME} version ${version} for ${platform}-${arch}`,
  );
}

async function setupAdditionalBin(
  token: string,
  platform: string,
  arch: string,
  bin: string,
): Promise<void> {
  const repo = `mq-${bin}`;
  const toolName = bin.startsWith('mq-') ? bin : `mq-${bin}`;
  const release = await getRelease({
    token,
    repo,
    toolName,
    platform: `${platform}_${arch}` as Platform,
  });

  if (!release.url || !release.version) {
    core.warning(`Not Found ${toolName} for ${platform}-${arch} in ${repo}`);
    return;
  }

  const downloadPath = await tc.downloadTool(release.url);
  const binPath = path.join(MQ_BIN_DIR, bin);

  await fs.copyFile(downloadPath, binPath);
  await fs.chmod(binPath, '755');

  core.info(`Setting up ${bin} version ${release.version} from ${repo}`);
}

async function getRelease(options: GetReleaseOptions): Promise<Release> {
  const { token, repo, toolName, platform, version } = options;
  const octokit = github.getOctokit(token);

  if (!version || version === '*' || version === 'latest') {
    core.info(
      `No specific version provided. Fetching latest release for ${repo}`,
    );

    const latestReleaseResponse = await octokit.rest.repos.getLatestRelease({
      owner: OWNER,
      repo,
    });

    core.info(`Latest release is ${latestReleaseResponse.data.tag_name}`);

    const assetName = `${toolName}-${PLATFORM_MAP[platform]}`;
    core.info(`Looking for asset: ${assetName}`);
    core.info(`Available assets: ${latestReleaseResponse.data.assets.map((a: any) => a.name).join(', ')}`);

    return {
      version: latestReleaseResponse.data.tag_name,
      url: latestReleaseResponse.data.assets.find(
        (asset: { name: string; browser_download_url: string }) =>
          asset.name === assetName,
      )?.browser_download_url,
    };
  }

  const tagVersion = version.startsWith('v') ? version : `v${version}`;
  const versionWithoutV = version.startsWith('v') ? version.slice(1) : version;

  core.info(`Fetching release information for ${repo} ${version}`);

  try {
    const releaseResponse = await octokit.rest.repos.getReleaseByTag({
      owner: OWNER,
      repo,
      tag: tagVersion,
    });

    const assetName = `${toolName}-${PLATFORM_MAP[platform]}`;
    core.info(`Looking for asset: ${assetName}`);

    return {
      version: releaseResponse.data.tag_name,
      url: releaseResponse.data.assets.find(
        (asset: { name: string; browser_download_url: string }) =>
          asset.name === assetName,
      )?.browser_download_url,
    };
  } catch {
    try {
      const releaseResponse = await octokit.rest.repos.getReleaseByTag({
        owner: OWNER,
        repo,
        tag: versionWithoutV,
      });

      const assetName = `${toolName}-${PLATFORM_MAP[platform]}`;
      core.info(`Looking for asset: ${assetName}`);

      return {
        version: releaseResponse.data.tag_name,
        url: releaseResponse.data.assets.find(
          (asset: { name: string; browser_download_url: string }) =>
            asset.name === assetName,
        )?.browser_download_url,
      };
    } catch (error) {
      if (error instanceof Error) {
        core.setFailed(error.message);
      } else {
        core.setFailed('Unknown error occurred');
      }
    }
  }

  return {
    version,
    url: undefined,
  };
}
