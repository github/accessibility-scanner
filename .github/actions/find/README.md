# find

Finds potential accessibility gaps.

## Usage

### Inputs

#### `urls`

**Required** Newline-delimited list of URLs to check for accessibility issues. For example:

```txt
https://primer.style
https://primer.style/octicons/
```

#### `url_configs`

**Optional** Stringified JSON array of per-URL configuration objects. Each object must include a `url` and may include `excludeSelectors` (selectors to exclude from Axe) and `waitForSelectors` (selectors that must become visible within 30 seconds before scanning). When provided, this input takes precedence over `urls`.

#### `auth_context`

**Optional** Stringified JSON object containing `username`, `password`, `cookies`, and/or `localStorage` from an authenticated session. For example: `{"username":"some-user","password":"correct-horse-battery-staple","cookies":[{"name":"theme-preference","value":"light","domain":"primer.style","path":"/"}],"localStorage":{"https://primer.style":{"theme-preference":"light"}}}`

#### `reduced_motion`

**Optional** Playwright
[`reducedMotion`](https://playwright.dev/docs/api/class-browser#browser-new-context-option-reduced-motion)
configuration option.

#### `color_scheme`

**Optional** Playwright
[`colorScheme`](https://playwright.dev/docs/api/class-browser#browser-new-context-option-color-scheme)
configuration option.

#### `ignore_https_errors`

**Optional** Bool - whether to ignore HTTPS errors when scanning URLs with self-signed certificates.

#### `include_screenshots`

**Optional** Bool - whether to capture screenshots of scanned pages and include links to them in the issue

#### `scans`

**Optional** Stringified JSON array of scans to perform. Core engines and local plugins use string names.
Allowlisted NPM plugins use an object with `name`, `package`, and optional `version`. If not provided, only Axe
will be performed. See [the plugin docs](../../../PLUGINS.md#loading-plugins-from-npm-packages) for an example.

### Outputs

#### `findings_file`

Absolute path to a JSON file containing the list of potential accessibility gaps. The action writes this file to a temporary directory and returns the absolute path. For example: `$RUNNER_TEMP/findings-<uuid>.json`.

The file will contain a JSON array of finding objects. For example:

```json
[]
```

#### `completion_file`

Absolute path to a JSON completion report. Each scan entry is keyed by the requested URL (not the browser's final URL after redirects) and scanner name. The findings file remains separate from scan status.

```json
{
  "schemaVersion": 1,
  "complete": true,
  "scans": [
    {"requestedUrl": "https://example.com/start", "scanner": "axe", "status": "completed"},
    {"requestedUrl": "https://example.com/start", "scanner": "accesslint", "status": "skipped"}
  ],
  "failures": []
}
```

`status` is `completed`, `failed`, `timed_out`, `skipped`, `not_started`, or `unknown`. A scan with zero findings is still `completed`. `failures` also records URL-level failures such as navigation, setup, and cleanup, with a `stage` and status; scanner failures include the scanner name. Consumers must treat `failed`, `timed_out`, `not_started`, and `unknown` coverage as incomplete. A report with no selected scanner is incomplete.

#### `scan_complete` and `scan_summary`

`scan_complete` is the string `true` only when at least one scanner completed and all requested scanner outcomes are completed or intentionally skipped, with no reported failures. `scan_summary` is a concise summary containing only the URL hostname, scanner, stage, and status; it does not include URL paths, query strings, browser state, or error details.

The top-level composite action exposes the same three outputs. It fails the action before issue filing or cache updates when `scan_complete` is not `true`; on complete runs, the existing results outputs retain their current format. `findings_file` and `completion_file` are still written first for diagnostics. The standalone `find` action remains successful and exposes `scan_complete` for callers to handle.
