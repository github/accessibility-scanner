# file

Files GitHub issues to track potential accessibility gaps.

## Usage

### Inputs

#### `findings_file`

**Required** Path to a JSON file containing the list of potential accessibility gaps. The path can be absolute or relative to the working directory (which defaults to `GITHUB_WORKSPACE`). For example: `findings.json`.

The file should contain a JSON array of finding objects. For example:
```json
[]
```

#### `repository`

**Required** Repository (with owner) to file issues in. For example: `primer/primer-docs`.

#### `token`

**Required** Token with fine-grained permission 'issues: write'.

#### `cached_filings_file`

**Optional** Path to a JSON file containing cached filings from previous runs. The path can be absolute or relative to the working directory (which defaults to `GITHUB_WORKSPACE`). Without this, duplicate issues may be filed. For example: `cached-filings.json`.

The file should contain a JSON array of filing objects. For example:
```json
[
  {
    "findings": [],
    "issue": {"id":1,"nodeId":"SXNzdWU6MQ==","url":"https://github.com/github/docs/issues/123","title":"Accessibility issue: 1"}
  }
]
```

### Outputs

#### `filings_file`

Absolute path to a JSON file containing the list of issues filed (and their associated finding(s)). The action writes this file to a temporary directory and returns the absolute path. For example: `$RUNNER_TEMP/filings-<uuid>.json`.

The file will contain a JSON array of filing objects. For example:
```json
[
  {
    "findings": [],
    "issue": {"id":1,"nodeId":"SXNzdWU6MQ==","url":"https://github.com/github/docs/issues/123","title":"Accessibility issue: 1"}
  }
]
```
