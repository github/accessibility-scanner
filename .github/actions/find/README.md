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

#### `playwright_context_options`

**Optional** Stringified JSON object containing [Playwright `BrowserContext`](https://playwright.dev/docs/api/class-browsercontext) options, including `httpCredentials` and `storageState`. For example: `{"httpCredentials":{"username":"some-user",password:"correct-horse-battery-staple"},"storageState":"/tmp/.auth/12345678/sessionState.json"}`

### Outputs

#### `findings`

List of potential accessibility gaps, as stringified JSON. For example:

```JS
'[]'
```
