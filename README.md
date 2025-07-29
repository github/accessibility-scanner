# continuous-accessibility-scanner

Finds potential accessibility gaps, files GitHub issues to track them, and attempts to fix them with Copilot.

## Usage

### Inputs

#### `urls`

**Required** Newline-delimited list of URLs to check for accessibility issues. For example:

```txt
https://primer.style
https://primer.style/octicons/
```

#### `repository`

**Required** Repository (with owner) to file issues in. For example: `primer/primer-docs`.

#### `token`

**Required** Personal access token (PAT) with fine-grained permissions 'issues: write' and 'pull_requests: write'.

### Example workflow

```YAML
name: Continuous Accessibilty Scanner
on: workflow_dispatch

jobs:
  continuous_accessibility_scanner:
    runs-on: ubuntu-latest
    steps:
      - uses: github/continuous-accessibility-scanner@main
        with:
          urls: |
            https://primer.style/octicons/
          repository: github/accessibility-sandbox
          token: ${{ secrets.GH_TOKEN }}
```
