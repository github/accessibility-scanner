# fix

Attempts to fix issues with Copilot.

## Usage

### Inputs

#### `issues`

**NOTE: This input will be unconditionally required in `v2`.** **Required if `issue_urls` is not provided** List of issues to attempt to fix—including, at a minimum, their `url`s—as stringified JSON. For example: `'[{"url":"https://github.com/github/docs/issues/123"},{"nodeId":"SXNzdWU6Mg==","url":"https://github.com/github/docs/issues/124"},{"id":4,"nodeId":"SXNzdWU6NA==","url":"https://github.com/github/docs/issues/126","title":"Accessibility issue: 4"}]'`.

#### `issue_urls`

**DEPRECATED: This input will be removed in `v2`.** **Required if `issues` is not provided** List of issue URLs to attempt to fix, as stringified JSON. For example: `'["https://github.com/github/docs/issues/123","https://github.com/github/docs/issues/124","https://github.com/github/docs/issues/126","https://github.com/github/docs/issues/127"]'`. If both `issues` and `issue_urls` are provided, `issue_urls` will be ignored.

#### `repository`

**Required** Repository (with owner) to file issues in. For example: `primer/primer-docs`.

#### `token`

**Required** Personal access token (PAT) with fine-grained permissions 'issues: write' and 'pull_requests: write'.
