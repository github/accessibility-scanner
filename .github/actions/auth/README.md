# auth

Authenticate with Playwright and save session state. Supports HTTP Basic and form authentication.

## Usage

### Inputs

#### `login_url`

**Required** Login page URL. For example, `https://github.com/login`

#### `username`

**Required** Username.

#### `password`

**Required** Password.

> [!IMPORTANT]
> Don’t put passwords in your workflow as plain text; instead reference a [repository secret](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets#creating-secrets-for-a-repository).

#### `ignore_https_errors`

**Optional** Bool - whether to ignore HTTPS errors when logging in to hosts with self-signed certificates.

[!WARNING]
Enabling this disables TLS certificate validation for the authentication step itself. If an attacker can intercept traffic, they can present an untrusted certificate and capture submitted credentials (including HTTP Basic auth and form passwords) and resulting session cookies/storage.

Use this only in trusted test/staging environments. For shared workflows, prefer a separate explicit opt-in for auth flows (for example, `auth_ignore_https_errors`) so certificate checks are not unintentionally disabled during credentialed requests.

### Outputs

#### `auth_context`

Stringified JSON object containing `username`, `password`, `cookies`, and/or `localStorage` from an authenticated session. For example: `{"username":"some-user","password":"correct-horse-battery-staple","cookies":[{"name":"theme-preference","value":"light","domain":"primer.style","path":"/"}],"localStorage":{"https://primer.style":{"theme-preference":"light"}}}`
