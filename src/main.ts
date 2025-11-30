import process from 'node:process';
import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import * as core from '@actions/core';
import * as github from '@actions/github';
import * as tc from '@actions/tool-cache';

const TOOL_NAME = 'mq';
const OWNER = 'harehare';
const REPO = 'mq';

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
    const release = await getRelease(token, `${platform}_${arch}`, version);

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
  } catch (error) {
    console.log('error', error);
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('Unknown error occurred');
    }
  }
}

async function getRelease(
  token: string,
  platform: Platform,
  version?: string,
): Promise<Release> {
  const octokit = github.getOctokit(token);

  if (!version || version === '*' || version === 'latest') {
    core.info(
      `No specific version provided. Fetching latest release for ${REPO}`,
    );

    const latestReleaseResponse = await octokit.rest.repos.getLatestRelease({
      owner: OWNER,
      repo: REPO,
    });

    core.info(`Latest release is ${latestReleaseResponse.data.tag_name}`);

    return {
      version: latestReleaseResponse.data.tag_name,
      url: latestReleaseResponse.data.assets.find(
        (asset: { name: string; browser_download_url: string }) =>
          asset.name === `mq-${PLATFORM_MAP[platform]}`,
      )?.browser_download_url,
    };
  }

  const tagVersion = version.startsWith('v') ? version : `v${version}`;
  const versionWithoutV = version.startsWith('v') ? version.slice(1) : version;

  core.info(`Fetching release information for ${REPO} ${version}`);

  try {
    const releaseResponse = await octokit.rest.repos.getReleaseByTag({
      owner: OWNER,
      repo: REPO,
      tag: tagVersion,
    });

    return {
      version: releaseResponse.data.tag_name,
      url: releaseResponse.data.assets.find(
        (asset: { name: string; browser_download_url: string }) =>
          asset.name === `mq-${PLATFORM_MAP[platform]}`,
      )?.browser_download_url,
    };
  } catch {
    try {
      const releaseResponse = await octokit.rest.repos.getReleaseByTag({
        owner: OWNER,
        repo: REPO,
        tag: versionWithoutV,
      });

      return {
        version: releaseResponse.data.tag_name,
        url: releaseResponse.data.assets.find(
          (asset: { name: string; browser_download_url: string }) =>
            asset.name === `mq-${PLATFORM_MAP[platform]}`,
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
