# fix

Attempts to fix issues with Copilot.

## Usage

### Inputs

#### `issues`

**Required** List of issues to attempt to fix—including, at a minimum, their `url`s—as stringified JSON. For example: `'[{"url":"https://github.com/github/docs/issues/123"},{"nodeId":"SXNzdWU6Mg==","url":"https://github.com/github/docs/issues/124"},{"id":4,"nodeId":"SXNzdWU6NA==","url":"https://github.com/github/docs/issues/126","title":"Accessibility issue: 4"}]'`.

#### `repository`

**Required** Repository (with owner) to file issues in. For example: `primer/primer-docs`.

#### `token`

**Required** Personal access token (PAT) with fine-grained permissions 'issues: write' and 'pull_requests: write'.

### Outputs

#### `fixings`

List of pull requests filed (and their associated issues), as stringified JSON. For example: `'[{"issue":{"id":1,"nodeId":"SXNzdWU6MQ==","url":"https://github.com/github/docs/issues/123","title":"Accessibility issue: 1"},"pullRequest":{"url":"https://github.com/github/docs/pulls/124"}}]'`
