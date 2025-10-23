# AI-powered Accessibility Scanner

The AI-powered Accessibility Scanner (a11y scanner) is a GitHub Action that detects accessibility barriers across your digital products, creates trackable issues, and leverages GitHub Copilot for AI-powered fixes.

The a11y scanner helps teams:

- 🔍 Scan websites, files, repositories, and dynamic content for accessibility issues
- 📝 Create actionable GitHub issues that can be assigned to GitHub Copilot
- 🤖 Propose fixes with GitHub Copilot, with humans reviewing before merging

> ⚠️ **Note:** The a11y scanner is currently in public preview. Feature development work is still ongoing. It can help identify accessibility gaps but cannot guarantee fully accessible code suggestions. Always review before merging!

🎥 **[Watch the demo video](https://youtu.be/CvRJcEzCSQM)** to see the a11y scanner in action.

---

## Requirements

To use the a11y scanner, you'll need:

- **GitHub Actions** enabled in your repository
- **GitHub Issues** enabled in your repository
- **Available GitHub Actions minutes** for your account
- **Admin access** to add repository secrets
- **GitHub Copilot** (optional) - The a11y scanner works without GitHub Copilot and will still create issues for accessibility findings. However, without GitHub Copilot, you won't be able to automatically assign issues to GitHub Copilot for AI-powered fix suggestions and PR creation.

## Getting started

### 1. Add a workflow file

Create a workflow file in `.github/workflows/` (e.g., `a11y-scan.yml`) in your repository:

```yaml
name: Accessibility Scanner
on: workflow_dispatch # This configures the workflow to run manually, instead of (e.g.) automatically in every PR. Check out https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#on for more options.

jobs:
  accessibility_scanner:
    runs-on: ubuntu-latest
    steps:
      - uses: github/accessibility-scanner@v2
        with:
          urls: | # Provide a newline-delimited list of URLs to scan; more information below.
            REPLACE_THIS
          repository: REPLACE_THIS/REPLACE_THIS # Provide a repository name-with-owner (in the format "primer/primer-docs"). This is where issues will be filed and where Copilot will open PRs; more information below.
          token: ${{ secrets.GH_TOKEN }} # This token must have write access to the repo above (contents, issues, and PRs); more information below. Note: GitHub Actions' GITHUB_TOKEN cannot be used here.
          cache_key: REPLACE_THIS # Provide a filename that will be used when caching results. We recommend including the name or domain of the site being scanned.
          # login_url: # Optional: URL of the login page if authentication is required
          # username: # Optional: Username for authentication
          # password: ${{ secrets.PASSWORD }} # Optional: Password for authentication (use secrets!)
          # auth_context: # Optional: Stringified JSON object for complex authentication
          # skip_copilot_assignment: false # Optional: Set to true to skip assigning issues to GitHub Copilot (or if you don't have GitHub Copilot)
```

> 👉 Update all `REPLACE_THIS` placeholders with your actual values. See [Action Inputs](#action-inputs) for details.

**Required permissions:**

- Write access to add or update workflows
- Admin access to add repository secrets

📚 Learn more
- [Quickstart for GitHub Actions](https://docs.github.com/en/actions/get-started/quickstart)
- [Understanding GitHub Actions](https://docs.github.com/en/actions/get-started/understand-github-actions)
- [Writing workflows](https://docs.github.com/en/actions/how-tos/write-workflows)
- [Managing GitHub Actions settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

---

### 2. Create a token and add a secret

The a11y scanner requires a Personal Access Token (PAT) as a repository secret:

**The `GH_TOKEN` is a fine-grained PAT with:**

- `actions: write`
- `contents: write`
- `issues: write`
- `pull-requests: write`
- `metadata: read`
- **Scope:** Your target repository (where issues and PRs will be created) and the repository containing your workflow

> 👉 GitHub Actions' default [GITHUB_TOKEN](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token) cannot be used here.

📚 Learn more
- [Creating a fine-grained PAT](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token)
- [Creating repository secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets#creating-secrets-for-a-repository)

---

### 3. Run your first scan

Trigger the workflow manually or automatically based on your configuration. The a11y scanner will run and create issues for any accessibility findings. When issues are assigned to GitHub Copilot, always review proposed fixes before merging.

📚 Learn more
- [View workflow run history](https://docs.github.com/en/actions/how-tos/monitor-workflows/view-workflow-run-history)
- [Running a workflow manually](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow#running-a-workflow)
- [Re-run workflows and jobs](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)

---

## Action inputs

| Input | Required | Description | Example |
|-------|----------|-------------|---------|
| `urls` | Yes | Newline-delimited list of URLs to scan | `https://primer.style`<br>`https://primer.style/octicons` |
| `repository` | Yes | Repository (with owner) for issues and PRs | `primer/primer-docs` |
| `token` | Yes | PAT with write permissions (see above) | `${{ secrets.GH_TOKEN }}` |
| `cache_key` | Yes | Key for caching results across runs<br>Allowed: `A-Za-z0-9._/-` | `cached_results-primer.style-main.json` |
| `login_url` | No | If scanned pages require authentication, the URL of the login page | `https://github.com/login` |
| `username` | No | If scanned pages require authentication, the username to use for login | `some-user` |
| `password` | No | If scanned pages require authentication, the password to use for login | `${{ secrets.PASSWORD }}` |
| `auth_context` | No | If scanned pages require authentication, a stringified JSON object containing username, password, cookies, and/or localStorage from an authenticated session | `{"username":"some-user","password":"***","cookies":[...]}` |
| `skip_copilot_assignment` | No | Whether to skip assigning filed issues to GitHub Copilot. Set to `true` if you don't have GitHub Copilot or prefer to handle issues manually | `true` |

---

## Authentication

If access to a page requires logging-in first, and logging-in requires only a username and password, then provide the `login_url`, `username`, and `password` inputs.

If your login flow is more complex—if it requires two-factor authentication, single sign-on, passkeys, etc.—and you have a custom action that [authenticates with Playwright](https://playwright.dev/docs/auth) and persists authenticated session state to a file, then provide the `auth_context` input. (If `auth_context` is provided, `login_url`, `username`, and `password` will be ignored.)

> [!IMPORTANT]
> Don't put passwords in your workflow as plain text; instead reference a [repository secret](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets#creating-secrets-for-a-repository).

---

## Configuring GitHub Copilot

The a11y scanner leverages GitHub Copilot coding agent, which can be configured with custom instructions:

- **Repository-wide:** `.github/copilot-instructions.md`
- **Directory/file-scoped:** `.github/instructions/*.instructions.md`

📚 Learn more
- [Adding repository custom instructions](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions)
- [Optimizing GitHub Copilot for accessibility](https://accessibility.github.com/documentation/guide/copilot-instructions)
- [GitHub Copilot .instructions.md support](https://github.blog/changelog/2025-07-23-github-copilot-coding-agent-now-supports-instructions-md-custom-instructions/)
- [GitHub Copilot agents.md support](https://github.blog/changelog/2025-08-28-copilot-coding-agent-now-supports-agents-md-custom-instructions)

---

## Feedback

💬 We welcome your feedback! To submit feedback or report issues, please create an issue in this repository. For more information on contributing, please refer to the [CONTRIBUTING](./CONTRIBUTING.md) file.

## License 

📄 This project is licensed under the terms of the MIT open source license. Please refer to the [LICENSE](./LICENSE) file for the full terms.

## Maintainers 

🔧 Please refer to the [CODEOWNERS](./.github/CODEOWNERS) file for more information.

## Support

❓ Please refer to the [SUPPORT](./SUPPORT.md) file for more information.

## Acknowledgement

✨ Thank you to our beta testers for their help making this project!
