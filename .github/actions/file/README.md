# file

Files GitHub issues to track potential accessibility gaps.

## Usage

### Inputs

#### `findings_file`

**Required** Path to a JSON file containing the list of potential accessibility gaps. For example:

```JS
'[]'
```

#### `repository`

**Required** Repository (with owner) to file issues in. For example: `primer/primer-docs`.

#### `token`

**Required** Token with fine-grained permission 'issues: write'.

#### `cached_filings_file`

**Optional** Path to a JSON file containing cached filings from previous runs. Without this, duplicate issues may be filed. For example: `'[{"findings":[],"issue":{"id":1,"nodeId":"SXNzdWU6MQ==","url":"https://github.com/github/docs/issues/123","title":"Accessibility issue: 1"}}]'`

### Outputs

#### `filings_file`

Path to a JSON file containing the list of issues filed (and their associated finding(s)). For example: `'[{"findings":[],"issue":{"id":1,"nodeId":"SXNzdWU6MQ==","url":"https://github.com/github/docs/issues/123","title":"Accessibility issue: 1"}}]'`
