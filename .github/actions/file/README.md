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

List of potential accessibility gaps (plus issue URLs), as stringified JSON. For example:

```JS
'[]'
```

#### `closed_issue_urls`

List of URLs for closed issues, as stringified JSON. For example: `'[123, 124, 126, 127]'`.

#### `opened_issue_urls`

List of URLs for newly-opened issues, as stringified JSON. For example: `'[123, 124, 126, 127]'`.

#### `repeated_issue_urls`

List of URLs for repeated issues, as stringified JSON. For example: `'[123, 124, 126, 127]'`.
