# fix

Attempts to fix issues with Copilot.

## Usage

### Inputs

#### `issues_file`

**Required** Path to a JSON file containing the list of issues to attempt to fix—including, at a minimum, their `url`s. For example: `issues.json`.

The file should contain a JSON array of issue objects. For example:
```json
[
  {"url":"https://github.com/github/docs/issues/123"},
  {"nodeId":"SXNzdWU6Mg==","url":"https://github.com/github/docs/issues/124"},
  {"id":4,"nodeId":"SXNzdWU6NA==","url":"https://github.com/github/docs/issues/126","title":"Accessibility issue: 4"}
]
```

#### `repository`

**Required** Repository (with owner) to file issues in. For example: `primer/primer-docs`.

#### `token`

**Required** Personal access token (PAT) with fine-grained permissions 'issues: write' and 'pull_requests: write'.

### Outputs

#### `fixings_file`

Path to a JSON file containing the list of pull requests filed (and their associated issues). For example: `fixings.json`.

The file will contain a JSON array of fixing objects. For example:
```json
[
  {
    "issue": {"id":1,"nodeId":"SXNzdWU6MQ==","url":"https://github.com/github/docs/issues/123","title":"Accessibility issue: 1"},
    "pullRequest": {"url":"https://github.com/github/docs/pulls/124"}
  }
]
```
