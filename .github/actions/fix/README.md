# fix

Attempts to fix issues with Copilot.

## Usage

### Inputs

#### `issue_numbers`

**Required** List of issue numbers to attempt to fix, as stringified JSON. For example: `'[123, 124, 126, 127]'`.

#### `repository`

**Required** Repository (with owner) to file issues in. For example: `primer/primer-docs`.

#### `token`

**Required** Personal access token (PAT) with fine-grained permissions 'issues: write' and 'pull_requests: write'.
