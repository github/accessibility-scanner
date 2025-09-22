# AI-powered Accessibility Scanner

The AI-powered Accessibility Scanner (a11y scanner) is a GitHub Action that detects accessibility barriers across your digital products, creates trackable issues, and leverages Copilot for AI-powered fixes.

The a11y scanner helps teams:

- 🔍 Scan websites, files, repositories, and dynamic content for accessibility issues
- 📝 Create actionable GitHub issues that can be assigned to Copilot
- 🤖 Propose fixes with Copilot, with humans reviewing before merging

> ⚠️ **Note:** The a11y scanner is currently in beta. It can help identify accessibility gaps but cannot guarantee fully accessible code suggestions. Always review before merging!

---

## Getting Started

### 1. Add a Workflow File

Create a workflow file in `.github/workflows/` (e.g., `a11y-scan.yml`) in your repository:

```YAML
name: Accessibility Scanner
on: workflow_dispatch # This configures the workflow to run manually, instead of (e.g.) automatically in every PR. Check out https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#on for more options.

jobs:
  accessibility_scanner:
    runs-on: ubuntu-latest
    steps:
      # Retrieve the scanner code
      - uses: actions/checkout@v5
        with:
          repository: github-community-projects/continuous-ai-for-accessibility-scanner
          ref: v1
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
          token: ${{ secrets.GH_TOKEN }} # This token must have write access to the repo above (contents, issues, and PRs); more information below. Note: GitHub Actions’ `GITHUB_TOKEN` (https://docs.github.com/en/actions/tutorials/authenticate-with-github_token) cannot be used here.
```

> 👉 Update all `REPLACE_THIS` placeholders with your actual values. See [Action Inputs](#action-inputs) for details.

Required Permissions:

- Write access to add or update workflows
- Admin access to add repository secrets

📚 [Understanding GitHub Actions](https://docs.github.com/en/actions/get-started/understand-github-actions) | [Managing GitHub Actions settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository) | [Writing workflows](https://docs.github.com/en/actions/how-tos/write-workflows)

---

### 2. Create Tokens and Add Secrets

The a11y scanner requires two Personal Access Tokens (PATs) as repository secrets:

#### The `GH_COMMUNITY_PROJECTS_TOKEN` is a fine-grained PAT with

- `contents: read`
- `metadata: read`
- Scope: [`github-community-projects/continuous-ai-for-accessibility-scanner`](https://github.com/github-community-projects/continuous-ai-for-accessibility-scanner)

#### The `GH_TOKEN` is a classic PAT with

- `repo` scope

> 👉 Neither GitHub Actions' default `GITHUB_TOKEN` nor a fine-grained PAT can be used here.

📚 [Creating a fine-grained PAT](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token) | [Creating a classic PAT](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-personal-access-token-classic) | [Creating repository secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets#creating-secrets-for-a-repository)

---

### 3. Run Your First Scan

Trigger the workflow manually or automatically based on your configuration. The scanner will run and create issues for any accessibility findings. When issues are assigned to Copilot, always review proposed fixes before merging.

📚 [Running a workflow manually](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow#running-a-workflow)

---

## Action Inputs

| Input | Required | Description | Example |
|-------|----------|-------------|---------|
| `urls` | Yes | Newline-delimited list of URLs to scan | `https://primer.style`<br>`https://primer.style/octicons` |
| `repository` | Yes | Repository (with owner) for issues and PRs | `primer/primer-docs` |
| `token` | Yes | PAT with write permissions (see above) | `${{ secrets.GH_TOKEN }}` |
| `cache_key` | No | Custom key for caching findings across runs<br>Allowed: `A-Za-z0-9._/-` | `cached_findings-main-primer.style.json` |
| `skip_copilot_assignment` | No | Whether to skip assigning filed issues to Copilot | `true` |

---

## Configuring Copilot

The a11y scanner leverages Copilot coding agent, which can be configured with custom instructions:

- Repository-wide: `.github/copilot-instructions.md`
- Directory/file-scoped: `.github/instructions/*.instructions.md`

📚 [Adding repository custom instructions](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions) | [Copilot .instructions.md support](https://github.blog/changelog/2025-07-23-github-copilot-coding-agent-now-supports-instructions-md-custom-instructions/) | [Copilot agents.md support](https://github.blog/changelog/2025-08-28-copilot-coding-agent-now-supports-agents-md-custom-instructions)

---

## Feedback

Beta participants have direct contact for questions and suggestions. A public feedback form will be available once the project is open-sourced.

---

*Last updated: 2025-08-28*
