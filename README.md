<div align="center">

# Setup mq

**Set up [mq](https://github.com/harehare/mq) in your GitHub Actions workflow.**

[![ci](https://img.shields.io/github/actions/workflow/status/harehare/setup-mq/ci.yml?style=flat-square&logo=github-actions&label=ci)](https://github.com/harehare/setup-mq/actions/workflows/ci.yml)
[![marketplace](https://img.shields.io/badge/marketplace-Setup%20mq-2088FF?style=flat-square&logo=githubactions&logoColor=white)](https://github.com/marketplace/actions/setup-mq)
[![LICENCE](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)

</div>

This GitHub Action sets up [mq](https://github.com/harehare/mq) in your GitHub Actions workflow, allowing you
to easily integrate mq into your CI/CD pipeline.

## Usage

```yaml
steps:
  - uses: actions/checkout@v4
  - name: Setup mq
    uses: harehare/setup-mq@v1
    with:
      version: 'v0.1.0' # Optional: defaults to latest
  - name: Run mq
    run: echo "# Test" | mq '.h'
```

### With additional binaries

mq ships companion tools (`lsp`, `dbg`, `test`, `crawl`) as part of its own releases, and other tools
are distributed from separate `mq-XXX` repositories (e.g. `mq-foo`). Use the `bins` option to install
either kind by name.

```yaml
steps:
  - uses: actions/checkout@v4
  - name: Setup mq
    uses: harehare/setup-mq@v1
    with:
      version: 'v0.1.0'
      bins: 'crawl,foo' # Installs mq-crawl from the mq release, and mq-foo from the mq-foo repository
  - name: Run mq
    run: echo "# Test" | mq '.h'
```

## Inputs

| Name           | Description                                                                       | Required | Default               |
| -------------- | --------------------------------------------------------------------------------- | -------- | --------------------- |
| `version`      | mq version to install                                                             | No       | Latest version        |
| `bins`         | Comma-separated list of additional binaries to install from `mq-XXX` repositories | No       | `''`                  |
| `github-token` | Token used to query the GitHub Releases API, mainly to avoid rate limiting        | No       | `${{ github.token }}` |

## Supported platforms

| OS      | Architecture | Notes                                          |
| ------- | ------------ | ---------------------------------------------- |
| Linux   | x64, arm64   | glibc and musl (e.g. Alpine) are auto-detected |
| macOS   | arm64        |                                                |
| Windows | x64, arm64   |                                                |

A job summary showing the installed tool versions is written to the workflow run automatically.

## Development

```bash
npm install
npm test
npm run lint
npm run bundle # builds dist/index.js
```

## License

This GitHub Action is available under the [MIT License](LICENSE).
