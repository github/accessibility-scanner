# auth

Log in using Playwright, then write authenticated session state to a file for reuse in other Playwright sessions.

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

### Outputs

#### `session_state_path`

Path to a file containing authenticated session state.
