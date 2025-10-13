# AI-powered Accessibility Scanner

The AI-powered Accessibility Scanner (a11y scanner) is a GitHub Action that detects accessibility barriers across your digital products, creates trackable issues, and leverages Copilot for AI-powered fixes.

The a11y scanner helps teams:

- 🔍 Scan websites, files, repositories, and dynamic content for accessibility issues
- 📝 Create actionable GitHub issues that can be assigned to Copilot
- 🤖 Propose fixes with Copilot, with humans reviewing before merging

> ⚠️ **Note:** The a11y scanner is currently in beta. It can help identify accessibility gaps but cannot guarantee fully accessible code suggestions. Always review before merging!

---

## Requirements

This project is a GitHub Actions action. A GitHub Actions workflow is required to run it, and you must have available GitHub Actions minutes.

📚 [Understanding GitHub Actions](https://docs.github.com/en/actions/get-started/understand-github-actions) | [Quickstart for GitHub Actions](https://docs.github.com/en/actions/get-started/quickstart) | [Writing workflows](https://docs.github.com/en/actions/how-tos/write-workflows) | [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

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
      - uses: github/accessibility-scanner@smockle/backport-10-and-11-testing
        with:
          urls: | # Provide a newline-delimited list of URLs to scan; more information below.
            REPLACE_THIS
          repository: REPLACE_THIS/REPLACE_THIS # Provide a repository name-with-owner (in the format "primer/primer-docs"). This is where issues will be filed and where Copilot will open PRs; more information below.
          token: ${{ secrets.GH_TOKEN }} # This token must have write access to the repo above (contents, issues, and PRs); more information below. Note: GitHub Actions’ `GITHUB_TOKEN` (https://docs.github.com/en/actions/tutorials/authenticate-with-github_token) cannot be used here.
          cache_key: REPLACE_THIS # Provide a filename that will be used when caching results. We recommend including the name or domain of the site being scanning.
```

> 👉 Update all `REPLACE_THIS` placeholders with your actual values. See [Action Inputs](#action-inputs) for details.

Required Permissions:

- Write access to add or update workflows
- Admin access to add repository secrets

📚 [Understanding GitHub Actions](https://docs.github.com/en/actions/get-started/understand-github-actions) | [Managing GitHub Actions settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository) | [Writing workflows](https://docs.github.com/en/actions/how-tos/write-workflows)

---

### 2. Create a Token and Add a Secret

The a11y scanner requires a Personal Access Token (PAT) as repository secret:

#### The `GH_TOKEN` is a fine-grained PAT with

- `actions: write`
- `contents: write`
- `issues: write`
- `pull-requests: write`
- `metadata: read`
- Scope: Your target repository (where issues and PRs will be created) and the repository containing your workflow

> 👉 GitHub Actions' default `GITHUB_TOKEN` cannot be used here.

📚 [Creating a fine-grained PAT](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token) | [Creating repository secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets#creating-secrets-for-a-repository)

---

### 3. Run Your First Scan

Trigger the workflow manually or automatically based on your configuration. The scanner will run and create issues for any accessibility findings. When issues are assigned to Copilot, always review proposed fixes before merging.

📚 [Running a workflow manually](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow#running-a-workflow)

---

## Action Inputs

| Input                     | Required | Description                                                                                                                                                  | Example                                                                                                                                                                                                                              |
| ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `urls`                    | Yes      | Newline-delimited list of URLs to scan                                                                                                                       | `https://primer.style`<br>`https://primer.style/octicons`                                                                                                                                                                            |
| `repository`              | Yes      | Repository (with owner) for issues and PRs                                                                                                                   | `primer/primer-docs`                                                                                                                                                                                                                 |
| `token`                   | Yes      | PAT with write permissions (see above)                                                                                                                       | `${{ secrets.GH_TOKEN }}`                                                                                                                                                                                                            |
| `cache_key`               | Yes      | Key for caching results across runs<br>Allowed: `A-Za-z0-9._/-`                                                                                              | `cached_results-primer.style-main.json`                                                                                                                                                                                              |
| `login_url`               | No       | If scanned pages require authentication, the URL of the login page                                                                                           | `https://github.com/login`                                                                                                                                                                                                           |
| `username`                | No       | If scanned pages require authentication, the username to use for login                                                                                       | `some-user`                                                                                                                                                                                                                          |
| `password`                | No       | If scanned pages require authentication, the password to use for login                                                                                       | `correct-horse-battery-staple`                                                                                                                                                                                                       |
| `auth_context`            | No       | If scanned pages require authentication, a stringified JSON object containing username, password, cookies, and/or localStorage from an authenticated session | `{"username":"some-user","password":"correct-horse-battery-staple","cookies":[{"name":"theme-preference","value":"light","domain":"primer.style","path":"/"}],"localStorage":{"https://primer.style":{"theme-preference":"light"}}}` |
| `skip_copilot_assignment` | No       | Whether to skip assigning filed issues to Copilot                                                                                                            | `true`                                                                                                                                                                                                                               |

---

## Authentication

If access to a page requires logging-in first, and logging-in requires only a username and password, then provide the `login_url`, `username`, and `password` inputs.

If your login flow is more complex—if it requires two-factor authentication, single sign-on, passkeys, etc.–and you have a custom action that [authenticates with Playwright](https://playwright.dev/docs/auth) and persists authenticated session state to a file, then provide the `auth_context` input. (If `auth_context` is provided, `login_url`, `username`, and `password` will be ignored.)

> [!IMPORTANT]
> Don’t put passwords in your workflow as plain text; instead reference a [repository secret](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets#creating-secrets-for-a-repository).

---

## Configuring Copilot

The a11y scanner leverages Copilot coding agent, which can be configured with custom instructions:

- Repository-wide: `.github/copilot-instructions.md`
- Directory/file-scoped: `.github/instructions/*.instructions.md`

📚 [Adding repository custom instructions](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions) | [Copilot .instructions.md support](https://github.blog/changelog/2025-07-23-github-copilot-coding-agent-now-supports-instructions-md-custom-instructions/) | [Copilot agents.md support](https://github.blog/changelog/2025-08-28-copilot-coding-agent-now-supports-agents-md-custom-instructions)

---

## Feedback

Please refer to the [CONTRIBUTING](./CONTRIBUTING.md) file for more information.

## License

This project is licensed under the terms of the MIT open source license. Please refer to the [LICENSE](./LICENSE) file for the full terms.

## Maintainers

Please refer to the [CODEOWNERS](./.github/CODEOWNERS) file for more information.

## Support

Please refer to the [SUPPORT](./SUPPORT.md) file for more information.

## Acknowledgement

Thank you to our beta testers for their help in testing this project.

---

_Last updated: 2025-10-09_
