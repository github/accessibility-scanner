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

### Outputs

#### `issue_numbers`

List of issue numbers for created issues, as stringified JSON. For example: `'[123, 124, 126, 127]'`.
