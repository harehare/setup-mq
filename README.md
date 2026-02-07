# Setup mq

This GitHub Action will setup [mq](https://github.com/harehare/mq) in your GitHub Actions workflow, allowing you
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

You can install additional binaries from `mq-XXX` repositories using the `bins` option.

```yaml
steps:
  - uses: actions/checkout@v4
  - name: Setup mq
    uses: harehare/setup-mq@v1
    with:
      version: 'v0.1.0'
      bins: 'foo,bar' # Installs binaries from mq-foo and mq-bar repositories
  - name: Run mq
    run: echo "# Test" | mq '.h'
```

## Inputs

| Name      | Description                                                                  | Required | Default        |
| --------- | ---------------------------------------------------------------------------- | -------- | -------------- |
| `version` | mq version to install                                                        | No       | Latest version |
| `bins`    | Comma-separated list of additional binaries to install from `mq-XXX` repositories | No       | `''`           |

## License

This GitHub Action is available under the [MIT License](LICENSE).
