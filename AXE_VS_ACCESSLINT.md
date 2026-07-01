# axe vs. AccessLint

The a11y scanner ships two built-in scan engines: [axe-core](https://github.com/dequelabs/axe-core) (the default) and [AccessLint](https://github.com/AccessLint/accesslint), a newer, lightweight ruleset. Both run against the live page and report WCAG violations as well as some best practices suggestions (unless disabled), and the two mostly overlap. axe is the mature, well-documented baseline; AccessLint adds a small set of checks axe doesn't run by default. This document covers what's different and provides advice on which to enable.

> 👉 Pick engines with the `scans` input. They run independently and file their findings as separate issues.

## Three ways to run

| `scans`                  | Runs            | Best when                                                                                          |
| ------------------------ | --------------- | -------------------------------------------------------------------------------------------------- |
| _(omitted)_ or `["axe"]` | axe only        | the mature default; lowest noise                                                                   |
| `["accesslint"]`         | AccessLint only | you want AccessLint's extra checks without axe's duplicates, but you give up axe's maturity and Deque docs |
| `["axe","accesslint"]`   | both            | maximum coverage, at the cost of duplicate findings                                                |

## At a glance

|                   | axe-core                                                                                | AccessLint                                                           |
| ----------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Strength**      | Mature, widely adopted, well-documented baseline                                        | Lightweight second pass; adds a few checks axe doesn't run by default |
| **Coverage**      | WCAG 2.0/2.1/2.2 (A/AA/AAA) tags plus best practices; some 2.2 rules are off by default | WCAG 2.2 A/AA plus best-practice rules                               |
| **Per-rule docs** | Deque University help URL on every finding                                              | Rule IDs + messages; less rich public per-rule docs                  |
| **Main risk**     | Doesn't catch every WCAG issue automatically (~57%)                                     | Newer and less battle-tested; smaller ecosystem                      |

Both cover the same large core: alt text, link/button names, form labels, ARIA validity, heading order, landmarks, table headers, language attributes, and color contrast.

## What AccessLint adds

The engines share most of their rules (AccessLint ships ~93, axe ~104, and the bulk map to the same checks). Measured against the scanner's **default** axe run, these are the only AccessLint checks with no axe rule that fires. See the [AccessLint rules reference](https://github.com/AccessLint/accesslint/blob/main/core/README.md#rules-1) for the full catalog.

**No axe rule covers these:**

- **Visible focus indicator** (2.4.7 AA) — `keyboard-accessible/focus-visible`: focusable elements must show a visible focus indicator.
- **Accessible authentication** (3.3.8 AA) — `input-assistance/accessible-authentication`: password fields must not block password managers / paste.
- **Generic alt wording** — `text-alternatives/image-alt-words`: alt text shouldn't be "image", "photo", etc. (axe only flags alt that _duplicates adjacent text_).
- **Presentational element with focusable children** — `aria/presentational-children-focusable` (adjacent to axe's `presentation-role-conflict`, but a separate check).

**axe has the rule, but only as _experimental_, so the scanner's default run skips it:**

- **Orientation lock** (1.3.4 AA) — `adaptable/orientation-lock` ↔ axe `css-orientation-lock`.
- **Paragraph styled as a heading** — `navigable/p-as-heading` ↔ axe `p-as-heading`.
- **Accessible name missing visible label text** (2.5.3) — `labels-and-names/label-content-mismatch` ↔ axe `label-content-name-mismatch`.
- **Focusable element without a semantic role** — `keyboard-accessible/focus-order` ↔ axe `focus-order-semantics`.
- **Large-table data cell without a header** — `adaptable/td-has-header` ↔ axe `td-has-header`.

Everything else overlaps. Even where rule IDs differ the checks coincide — e.g. 1.4.12 text spacing (axe's single `avoid-inline-spacing` vs AccessLint's `letter-spacing` / `line-height` / `word-spacing`) and 1.2.1 audio (axe `audio-caption` vs AccessLint `audio-transcript`).
