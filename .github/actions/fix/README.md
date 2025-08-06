# fix

Attempts to fix issues with Copilot.

## Usage

### Inputs

#### `issue_urls`

**Required** List of issue URLs to attempt to fix, as stringified JSON. For example: `'["https://github.com/github/docs/issues/123","https://github.com/github/docs/issues/124","https://github.com/github/docs/issues/126","https://github.com/github/docs/issues/127"]'`.

#### `repository`

**Required** Repository (with owner) to file issues in. For example: `primer/primer-docs`.

#### `token`

**Required** Personal access token (PAT) with fine-grained permissions 'issues: write' and 'pull_requests: write'.
