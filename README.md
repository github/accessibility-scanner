# continuous-ai-for-accessibility-scanner

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

**Required** Personal access token (PAT) with fine-grained permissions 'contents: write', 'issues: write', and 'pull_requests: write'.

#### `cache_key`

**Optional** Custom key for caching findings across runs. Allowed characters are `A-Za-z0-9._/-`. For example: `cached_findings-main-primer.style.json`.

### Example workflow

```YAML
name: Continuous Accessibility Scanner
on: workflow_dispatch

jobs:
  continuous_accessibility_scanner:
    runs-on: ubuntu-latest
    steps:
      - uses: github-community-projects/continuous-ai-for-accessibility-scanner@main
        with:
          urls: |
            https://primer.style/octicons/
          repository: github/accessibility-sandbox
          token: ${{ secrets.GH_TOKEN }}
```
