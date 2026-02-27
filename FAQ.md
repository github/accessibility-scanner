# [Frequently-Asked Questions (FAQ)]

## `find` Action (Scanning for problems)

### Do you support scanning PDFs?

We're focusing this Action on website accessibility and currently don't plan to
add PDF scanning capabilities.

If you're looking to scan PDFs, we recommend using one of the
[standalone PDF accessibility checkers listed by the PDF
Association](https://pdfa.org/tools-for-accessible-pdf/).

## Other / repository-wide questions

### What is the `gh-cache` branch/Action for?

Short answer: This is an orphan branch for storing information between Actions
runs. It's an implementation detail and can be safely ignored by users.

Longer answer: We use the `gh-cache` branch and [its associated
Action](https://github.com/github/accessibility-scanner/tree/066e45c819d270bfb2392cfe141b570131c8011b/.github/actions/gh-cache)
to persist issue data between action runs, which both prevents opening duplicate
issues and allows us to automatically close issues which have been fixed
(in other words, if a problem wasn't detected again in an ensuing run, it is
therefore no longer a problem).

Using a `git` branch as a caching mechanism allows users to view and/or edit the current
contents of the cache through the usual GitHub user interface. It also means the
contents of the cache are version controlled and can be changed through the
`git` commands users are accustomed to.
