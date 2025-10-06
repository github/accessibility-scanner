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

### Outputs

#### `findings`

List of potential accessibility gaps, as stringified JSON. For example:

```JS
'[]'
```
