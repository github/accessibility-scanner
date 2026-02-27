# FAQ

## Find Action (Scanning for Problems)

### Do you support scanning PDFs?

Not at this time — our focus is on **website accessibility**, so PDF scanning
isn't something we're planning to build into this Action.

That said, there are great tools out there for that! We'd suggest checking out
the [standalone PDF accessibility checkers listed by the PDF
Association](https://pdfa.org/tools-for-accessible-pdf/).

### What about mobile apps, documents, or email templates?

This Action is built specifically to scan **websites, repositories, and dynamic
content** for accessibility issues. We don't support scanning for:

- **Mobile apps** (iOS or Android)
- **Desktop applications**
- **Documents** (Word, PowerPoint, Excel, etc.)
- **Email templates**

If you need accessibility testing for those, there are dedicated tools better
suited for each — but for catching web accessibility problems before they reach
your users, that's exactly what we're here for.

---

## Other / Repository-Wide Questions

### What's the `gh-cache` branch/Action all about?

**The short version:** It's an orphan branch we use to store data between Action
runs. You can safely ignore it — it's just a behind-the-scenes detail.

**The longer version:** We use the `gh-cache` branch (and its associated Action)
to keep track of issue data across runs. This is what prevents the Action from
opening duplicate issues, and it's also how we're able to **automatically close
issues** that have been fixed — in other words, if a problem isn't detected
again on a subsequent run, we treat it as resolved.

Why use a git branch instead of some other caching method? A couple of reasons:

- You can view and edit the cache contents right in the GitHub UI — no extra
  tooling needed.
- Everything is version-controlled, so you can manage it with the same git
  commands you already know.

### How do I remove or reset the cache?

Since the cache lives on the `gh-cache` branch, you have a couple of options:

- **Delete the branch entirely** — the Action will create a fresh one on its
  next run
- **Edit or remove specific files** on the branch through the GitHub UI or git
  commands

Just keep in mind that resetting the cache means the Action will "forget" what
it's already seen, so it may reopen issues that were previously tracked or
closed.

### Does this work with private repositories?

Yes! The Action works with both public and private repositories. Since it runs
within GitHub Actions, it has access to your repository's content regardless of
visibility settings. No extra configuration needed.

### Does this work with monorepos or multiple sites?

It does. If your repository contains multiple sites or projects, you can
configure separate workflow runs targeting different URLs or paths. Each scan
runs independently, so you can tailor the setup to match however your repo is
structured.

### How often does / should the Action run?

That's really up to you and your workflow. Some common setups include:

- **On every push or pull request** — great for catching issues early in
  development
- **On a scheduled cron job** (e.g., daily or weekly) — good for ongoing
  monitoring of live sites
- **Manually triggered** — useful for one-off audits

If you're just getting started, running on pull requests is a solid default — it
catches problems before they get merged without adding noise to every single
commit.

### Will this slow down my CI/CD pipeline?

The Action runs as its own job, so it won't block your builds or deployments
unless you specifically configure it to. Scan times depend on the size and
complexity of the site being scanned, but for most projects it adds minimal
overhead. You can also run it on a schedule instead of on every push if speed is
a concern.

### Can I customize which rules or checks are run?

Under the hood, this Action uses
**[axe-core](https://github.com/dequelabs/axe-core)** — the industry gold
standard for automated accessibility testing. That gives you a solid,
well-maintained foundation right out of the box.

That said, you're not locked into a single setup. You can tap into different
APIs and configure the Action to focus on the specific accessibility standards
or rules that matter most to your project.

If you're looking to go even further, we also have resources for integrating
accessibility into your development workflow with GitHub Copilot:

- **[Getting Started with GitHub Copilot Custom Agents for
  Accessibility](https://accessibility.github.com/documentation/guide/getting-started-with-agents/)**
  — learn how to set up custom agents tailored to accessibility workflows
- **[Optimizing GitHub Copilot for Accessibility with Custom
  Instructions](https://accessibility.github.com/documentation/guide/copilot-instructions/)**
  — fine-tune how Copilot assists you with accessibility-specific guidance

Between axe-core's rule set, API flexibility, and Copilot's custom instructions,
you've got a lot of room to shape the tooling around how your team actually
works.

### Does this work with GitHub Enterprise?

Yes, the Action is compatible with GitHub Enterprise Cloud. For GitHub
Enterprise Server, compatibility may depend on your version and Actions
availability. If you run into any issues, feel free to open an issue and we'll
do our best to help.

### Can multiple people use this on the same repo?

Absolutely. The Action is tied to the repository, not to any individual user.
Anyone with the appropriate permissions can trigger runs, view results, and
manage the issues it creates. It works just like any other GitHub Action in that
regard.
