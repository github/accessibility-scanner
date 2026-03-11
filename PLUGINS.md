# Plugins

The plugin system allows teams to create custom scans/tests to run on their pages. An example of this is Axe interaction tests. In some cases, it might be desirable to perform specific interactions on elements of a given page before doing an Axe scan. These interactions are usually unique to each page that is scanned, so it would require the owning team to write a custom plugin that can interact with the page and run the Axe scan when ready. See the example under [.github/scanner-plugins/test-plugin](https://github.com/github/accessibility-scanner/tree/main/.github/scanner-plugins/test-plugin) (this is not an Axe interaction test, but should give a general understanding of plugin structure).

Some plugins come built-in with the scanner and can be enabled via actions inputs.

## How Plugins Work

Plugins are dynamically loaded by the scanner when it runs. The scanner will look into the `./.github` folder in your repo (where you run the workflow from) and search for a `scanner-plugins` folder. If it finds it, it will assume each folder under that is a plugin, and attempt to load the `index.js` file inside it. Once loaded, the scanner will invoke the exported default function from the `index.js` file.

### Default function API

When the default function is invoked, the following arguments are passed to the function:

- page: this is the [playwright page](https://playwright.dev/docs/api/class-page) instance. See the linked docs for information on how to interact with the page.
- addFinding: this is a function that will add a finding to the list. Findings are used to generate issues and 'filings'. See here for the [types](https://github.com/github/accessibility-scanner/blob/main/tests/types.d.ts). This function expects a single object as an argument, and it should match the `Finding` type defined in the types linked above.

## How To Create Plugins

As mentioned above, plugins need to exist under `./.github/scanner-plugins`. For a plugin to work, it needs to meet the following criteria:

- Each seperate plugin should exist in a separate folder under `./.github/scanner-plugins`. So `./.github/scanner-plugins/plugin-1` would be 1 plugin loaded by the scanner.
- Each plugin should have one `index.js` file inside its folder.
- The `index.js` file must export a `name` field. This is the name used to pass to the `scans` input. So the following: `scans: ['my-custom-plugin']` would cause the scanner to only run that plugin.
- The `index.js` file must export a default function. This is the function that the scanner uses to run the plugin. This can be an async function.

## Things to look out for

- Plugin names should be unique. If multiple plugins have the same name, and the `scans` input array contains this name, all the plugins with that name _will_ run. However, this is not advised because if you want to turn off one plugin, you'll have to go back and change that plugin name.
