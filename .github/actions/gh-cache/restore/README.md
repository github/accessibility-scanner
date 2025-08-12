# restore

Checkout a file or directory from an orphaned 'gh-cache' branch.

## Usage

### Inputs

#### `path`

**Required** Relative path to a file or directory to restore. For example: `findings.json`.

#### `token`

**Required** Token with fine-grained permissions 'contents: read'.

#### `fail_on_cache_miss`

**Optional** Fail the workflow if cached item is not found. For example: `'true'`. Default: `'false'`.
