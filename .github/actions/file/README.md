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

#### `cached_findings`

**Optional** Cached findings from previous runs, as stringified JSON. Without this, duplicate issues may be filed. For example: `'[]'`.

### Outputs

#### `findings`

**DEPRECATED: This output will be removed in `v2`.** List of potential accessibility gaps (plus issue URLs), as stringified JSON. For example:

```JS
'[]'
```

#### `closed_issues`

**DEPRECATED: This output will be removed in `v2`.** List of closed issues’ `id`, `nodeId`, `url`, and `title`, as stringified JSON. For example: `'[{"id":1,"nodeId":"SXNzdWU6MQ==","url":"https://github.com/github/docs/issues/123","title":"Accessibility issue: 1"},{"id":2,"nodeId":"SXNzdWU6Mg==","url":"https://github.com/github/docs/issues/124","title":"Accessibility issue: 2"},{"id":4,"nodeId":"SXNzdWU6NA==","url":"https://github.com/github/docs/issues/126","title":"Accessibility issue: 4"}]'`.

#### `opened_issues`

**DEPRECATED: This output will be removed in `v2`.** List of newly-opened issues’ `id`, `nodeId`, `url`, and `title`, as stringified JSON. For example: `'[{"id":1,"nodeId":"SXNzdWU6MQ==","url":"https://github.com/github/docs/issues/123","title":"Accessibility issue: 1"},{"id":2,"nodeId":"SXNzdWU6Mg==","url":"https://github.com/github/docs/issues/124","title":"Accessibility issue: 2"},{"id":4,"nodeId":"SXNzdWU6NA==","url":"https://github.com/github/docs/issues/126","title":"Accessibility issue: 4"}]'`.

#### `repeated_issues`

**DEPRECATED: This output will be removed in `v2`.** List of repeated issues’ `id`, `nodeId`, `url`, and `title`, as stringified JSON. For example: `'[{"id":1,"nodeId":"SXNzdWU6MQ==","url":"https://github.com/github/docs/issues/123","title":"Accessibility issue: 1"},{"id":2,"nodeId":"SXNzdWU6Mg==","url":"https://github.com/github/docs/issues/124","title":"Accessibility issue: 2"},{"id":4,"nodeId":"SXNzdWU6NA==","url":"https://github.com/github/docs/issues/126","title":"Accessibility issue: 4"}]'`.
