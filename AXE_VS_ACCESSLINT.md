# axe vs. AccessLint

The a11y scanner ships two built-in scan engines: [axe-core](https://github.com/dequelabs/axe-core) (the default) and [AccessLint](https://github.com/AccessLint/accesslint), a newer, lightweight ruleset. Both run against the live page, report WCAG violations, and share a large core of checks. axe is the mature, well-documented baseline; AccessLint adds extra WCAG 2.2 and best-practice checks. This doc explains what AccessLint adds and which combination to pick.

> 👉 Pick engines with the `scans` input. They run independently and file their findings as separate issues.

## Three ways to run

| `scans`                  | Runs            | Best when                                                                                          |
| ------------------------ | --------------- | -------------------------------------------------------------------------------------------------- |
| _(omitted)_ or `["axe"]` | axe only        | the mature default; lowest noise                                                                   |
| `["accesslint"]`         | AccessLint only | you want its newer ruleset without axe's duplicates, but you give up axe's maturity and Deque docs |
| `["axe","accesslint"]`   | both            | maximum coverage, at the cost of duplicate findings                                                |

## At a glance

|                   | axe-core                                                                                | AccessLint                                                           |
| ----------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Strength**      | Mature, widely adopted, well-documented baseline                                        | Lightweight second pass with newer WCAG 2.2 and best-practice checks |
| **Coverage**      | WCAG 2.0/2.1/2.2 (A/AA/AAA) tags plus best practices; some 2.2 rules are off by default | WCAG 2.2 A/AA plus best-practice rules                               |
| **Per-rule docs** | Deque University help URL on every finding                                              | Rule IDs + messages; less rich public per-rule docs                  |
| **Main risk**     | Doesn't catch every WCAG issue automatically (~57%)                                     | Newer and less battle-tested; smaller ecosystem                      |

Both cover the same large core: alt text, link/button names, form labels, ARIA validity, heading order, landmarks, table headers, language attributes, and color contrast.

## What AccessLint adds

AccessLint includes checks that may not be surfaced by the scanner's default axe configuration, including some WCAG 2.2 and best-practice checks. Findings link to the [AccessLint rules reference](https://github.com/AccessLint/accesslint/blob/main/core/README.md#rules-1). Examples:

- **Focus Visible (2.4.7)** — focusable elements without a visible focus indicator.
- **Orientation (1.3.4)** — pages locked to a single screen orientation.
- **Accessible Authentication (3.3.8)** — password fields that block password managers / paste.
- **Audio transcript (1.2.1)** — `<audio>` without a text alternative.
- Best-practice extras such as generic alt wording ("image", "photo") and paragraphs styled to look like headings.

axe has its own 2.1/2.2 and best-practice rules too (for example `avoid-inline-spacing` for text spacing), so expect overlap rather than a clean split.
