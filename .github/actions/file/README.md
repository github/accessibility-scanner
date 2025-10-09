# file

Files GitHub issues to track potential accessibility gaps.

## Usage

### Inputs

#### `findings`

**Required** List of potential accessibility gaps, as stringified JSON. For example:

```JS
'[]'
```

#### `repository`

**Required** Repository (with owner) to file issues in. For example: `primer/primer-docs`.

#### `token`

**Required** Token with fine-grained permission 'issues: write'.

#### `cached_filings`

**Optional** Cached filings from previous runs, as stringified JSON. Without this, duplicate issues may be filed. For example: `'[{"findings":[],"issue":{"id":1,"nodeId":"SXNzdWU6MQ==","url":"https://github.com/github/docs/issues/123","title":"Accessibility issue: 1"}}]'`

### Outputs

#### `filings`

List of issues filed (and their associated finding(s)), as stringified JSON. For example: `'[{"findings":[],"issue":{"id":1,"nodeId":"SXNzdWU6MQ==","url":"https://github.com/github/docs/issues/123","title":"Accessibility issue: 1"}}]'`
