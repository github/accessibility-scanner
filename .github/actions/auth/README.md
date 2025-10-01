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

### Outputs

#### `session_state_path`

Path to a file containing authenticated session state.
