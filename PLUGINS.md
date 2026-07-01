# Plugins

The plugin system allows teams to create custom scans/tests to run on their pages. An example of this is Axe interaction tests. In some cases, it might be desirable to perform specific interactions on elements of a given page before doing an Axe scan. These interactions are usually unique to each page that is scanned, so it would require the owning team to write a custom plugin that can interact with the page and run the Axe scan when ready. See the existing plugins under [.github/scanner-plugins](https://github.com/github/accessibility-scanner/tree/main/.github/scanner-plugins) for examples of plugin structure.

Some plugins come built-in with the scanner and can be enabled via [actions inputs](https://github.com/github/accessibility-scanner/tree/main/action.yml#L48-L50).

## How plugins work

Plugins are dynamically loaded by the scanner when it runs. The scanner will look into the `./.github` folder in your repo (where you run the workflow from) and search for a `scanner-plugins` folder. If it finds it, it will assume each folder under that is a plugin, and attempt to load the `index.ts` (first) or `index.js` (second) file inside it. Once loaded, the scanner will invoke the exported default function from the `index.js/index.ts` file.

### Default function API

When the default function is invoked, the following arguments are passed to the function:

#### `page`

This is the [playwright page](https://playwright.dev/docs/api/class-page) instance.

#### `addFinding`

A async function (you must use `await` or `.then` when invoking this function) that will add a finding to the list (findings are used to generate and file issues). It will also generate a screenshot and add the `screenshotId` to the finding data if `includeScreenshots` is true in the scanner action input. It has the following arguments:

- An object that should match the [`Finding` type](https://github.com/github/accessibility-scanner/blob/main/.github/actions/find/src/types.d.ts#L1-L9).

## How to create plugins

As mentioned above, plugins need to exist under `./.github/scanner-plugins`. For a plugin to work, it needs to meet the following criteria:

- Each separate plugin should be contained in it's own directory in `./.github/scanner-plugins`. For example, `./.github/scanner-plugins/plugin-1` would be 1 plugin loaded by the scanner.
- Each plugin should have one `index.ts` OR `index.js` file inside its folder.
- The `index.ts/index.js` file must export a `name` field. This is the name used to pass to the `scans` input. So if the plugin exports a name value of `my-custom-plugin` and we pass the following to the scanner action inputs: `scans: ['my-custom-plugin']`, it would cause the scanner to only run that plugin.
- The `index.ts/index.js` file must export a default function. This is the function that the scanner uses to run the plugin. This can be an async function.
- In your workflow file, before the scanner step, add `- uses: actions/checkout@v6` (or whatever the current version is). This allows the current repository's files (where your custom plugin's file exists) to be read:

```yaml
jobs:
  accessibility_scanner:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: github/accessibility-scanner@v3
        with:
          # ... the rest of the workflow setup
```

## Loading plugins from NPM packages

In addition to local plugins under `./.github/scanner-plugins`, the scanner can install and load plugins published as NPM packages. This avoids having to vendor a plugin's source into your repo.

To use an NPM plugin, pass an object (instead of a plain string) in the `scans` input with the following fields:

- `name` — the plugin name exported by the package (used to match against `scans`, same as local plugins).
- `package` — the NPM package name to install.
- `version` — (optional) a version or dist-tag to pin. If omitted, the latest version is installed.

Only the set of [first-party packages](.github/actions/find/src/pluginManager/index.ts#L91) may be loaded from NPM. Any other package is skipped with a warning.

```yaml
jobs:
  accessibility_scanner:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: github/accessibility-scanner@v3
        with:
          scans: |
            ["axe", {"name": "alt-text-scan", "package": "@github/accessibility-scanner-alt-text-plugin", "version": "1.0.0"}]
```

Notes:

- Packages are installed at runtime with `npm install --ignore-scripts`, so install/postinstall scripts in the package will not run. Pin a `version` to avoid silently picking up future releases.
- If an NPM plugin shares a name with a built-in or local plugin, the built-in/local plugin wins and the NPM one is skipped.
- Plugin configuration works the same as local plugins: place a config-only folder at `./.github/scanner-plugins/<name>/config.json` in your repo (the plugin reads its config relative to the repo you run the workflow from).

## Things to look out for

- Plugin names should be unique. If multiple plugins have the same name, and the `scans` input array contains this name, all the plugins with that name _will_ run. However, this is not advised because if you want to turn off one plugin, you'll have to go back and change that plugin name.
