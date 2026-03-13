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

#### `include_screenshots`

**Optional** Bool - whether to capture screenshots of scanned pages and include links to them in the issue

#### `scans`

**Optional** Stringified JSON array of scans (string) to perform. If not provided, only Axe will be performed.

### Outputs

#### `findings`

List of potential accessibility gaps, as stringified JSON. For example:

```JS
'[]'
```
