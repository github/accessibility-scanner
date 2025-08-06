# cache

Cache/uncache strings using an orphaned 'gh-cache' branch.

## Usage

### Inputs

#### `key`

**Required** Identifier for the string to cache/uncache.

#### `token`

**Required** Token with fine-grained permissions 'contents: write'.

#### `value`

**Optional** String to cache. If provided, the existing (cached) value will be overwritten and then outputted. If not provided, the existing (cached) value will be outputted.

#### `fail_on_cache_miss`

**Optional** Fail the workflow if cached item is not found. For example: `'true'`. Default: `'false'`.

### Outputs

#### `value`

Cached string.
