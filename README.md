# continuous-ai-for-accessibility-scanner

This repo contains code for a GitHub Actions action named `github-community-projects/continuous-ai-for-accessibility-scanner` (“scanner”, for short). The scanner finds potential accessibility gaps on a provided list of URLs, files GitHub issues to track them, and attempts to fix them with Copilot. For more information about GitHub Actions, check out [“Understanding GitHub Actions” (GitHub Docs)](https://docs.github.com/en/actions/get-started/understand-github-actions).

## Getting started

### Adding a workflow file

To use the scanner, create a GitHub Actions workflow in the `.github/workflows` directory of one of your repositories (for example, a file named `scan.yml`), commit it, and push the commit.

For general workflow authoring tips, check out [“Writing workflows” (GitHub Docs)](https://docs.github.com/en/actions/how-tos/write-workflows); specifics are below.

The contents of the workflow file should look similar to the example below:

```YAML
name: Continuous Accessibility Scanner
on: workflow_dispatch # This configures the workflow to run manually, instead of (e.g.) automatically in every PR. Check out https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#on for more options.

jobs:
  continuous_accessibility_scanner:
    runs-on: ubuntu-latest
    steps:
      # Retrieve the scanner code
      - uses: actions/checkout@v5
        with:
          repository: github-community-projects/continuous-ai-for-accessibility-scanner
          token: ${{ secrets.GH_COMMUNITY_PROJECTS_TOKEN }} # This token must have read access to github-community-projects/continuous-ai-for-accessibility-scanner; more information below.
          path: ./.github/actions/continuous-ai-for-accessibility-scanner
      # Prepare the scanner to run
      - shell: bash
        run: cp -Rf ./.github/actions/continuous-ai-for-accessibility-scanner/.github/actions/* ./.github/actions
      # Run the scanner
      - uses: ./.github/actions/continuous-ai-for-accessibility-scanner
        with:
          urls: | # Provide a newline-delimited list of URLs to scan; more information below.
            REPLACE_THIS
          repository: REPLACE_THIS/REPLACE_THIS # Provide a repository name-with-owner (in the format "primer/primer-docs"). This is where issues will be filed and where Copilot will open PRs; more information below.
          token: ${{ secrets.GH_TOKEN }} # This token must have write access to the repo above (contents, issues, and PRs); more information below.
```

All instances of `REPLACE_THIS` must be replaced before the workflow will run. For more information, check out the [`urls` input’s documentation](#urls) and the [`repository` input’s documentation](#repository).

### Creating tokens and adding secrets

After you’ve committed the workflow file to your repository, create two tokens, then add them as repository secrets named `GH_COMMUNITY_PROJECTS_TOKEN` and `GH_TOKEN`, respectively.

- `GH_COMMUNITY_PROJECTS_TOKEN` should be a fine-grained personal access token (PAT) with the `contents: read` and `metadata: read` permission for the `github-community-projects/continuous-ai-for-accessibility-scanner` repository.

- `GH_TOKEN` should be a fine-grained PAT with `contents: write`, `issues: write`, `pull-requests: write`, and `metadata: read` for the repository referenced in your workflow (the `repository` input).

Check out [“Creating a fine-grained personal access token” (GitHub Docs)](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token) and [“Creating secrets for a repository” (GitHub Docs)](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets#creating-secrets-for-a-repository) for step-by-step guidance.

### Scanning your website

Run your newly-added workflow, by following the instructions in [“Running a workflow” (GitHub Docs)](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow#running-a-workflow).

## Configuring the action

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

**Required** Personal access token (PAT) with fine-grained permissions 'contents: write', 'issues: write', 'pull_requests: write', and 'metadata: read'.

#### `cache_key`

**Optional** Custom key for caching findings across runs. Allowed characters are `A-Za-z0-9._/-`. For example: `cached_findings-main-primer.style.json`.

## Configuring Copilot

The scanner leverages Copilot coding agent, which can be configured by providing custom instructions. Check out [“Adding repository custom instructions for GitHub Copilot”](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions) to learn how to get started with custom instructions.

As announced in [“GitHub Copilot coding agent now supports .instructions.md custom instructions” (GitHub Blog)](https://github.blog/changelog/2025-07-23-github-copilot-coding-agent-now-supports-instructions-md-custom-instructions/), Copilot coding agent—and, by extension, this scanner action—supports custom instructions provided in `.github/copilot-instructions.md` _and_ `.instructions.md` files stored under `.github/instructions` (which can be scoped to specific files or directories).
