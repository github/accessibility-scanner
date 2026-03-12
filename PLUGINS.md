# Plugins

The plugin system allows teams to create custom scans/tests to run on their pages. An example of this is Axe interaction tests. In some cases, it might be desirable to perform specific interactions on elements of a given page before doing an Axe scan. These interactions are usually unique to each page that is scanned, so it would require the owning team to write a custom plugin that can interact with the page and run the Axe scan when ready. See the example under [.github/scanner-plugins/test-plugin](https://github.com/github/accessibility-scanner/tree/main/.github/scanner-plugins/test-plugin) (this is not an Axe interaction test, but should give a general understanding of plugin structure).

Some plugins come built-in with the scanner and can be enabled via [actions inputs](https://github.com/github/accessibility-scanner/tree/main/action.yml#L48-L50).

## How plugins work

Plugins are dynamically loaded by the scanner when it runs. The scanner will look into the `./.github` folder in your repo (where you run the workflow from) and search for a `scanner-plugins` folder. If it finds it, it will assume each folder under that is a plugin, and attempt to load the `index.js` file inside it. Once loaded, the scanner will invoke the exported default function from the `index.js` file.

### Default function API

When the default function is invoked, the following arguments are passed to the function:

#### `page`

This is the [playwright page](https://playwright.dev/docs/api/class-page) instance.

#### `addFinding`

A function that will add a finding to the list (findings are used to generate and file issues). It will also generate a screenshot and add the `screenshotId` to the finding data if `includeScreenshots` is true in either the scanner action input OR in the arguments to this function (see below). It has the following arguments:

- An object that should match the [`Finding` type](https://github.com/github/accessibility-scanner/blob/main/.github/actions/find/src/types.d.ts#L1-L9).
- An [optional] 'options' object that has the following fields:
  - [optional] `includeScreenshots` <bool>: Will automatically generate a screenshot and add the screenshotId to the `Finding` data if it's set to true.

Example usage:

```
addFinding({ ...findingTypeData })
addFinding({
  ...findingTypeData
}, {
  includeScreenshots: true
})

```

## How to create plugins

As mentioned above, plugins need to exist under `./.github/scanner-plugins`. For a plugin to work, it needs to meet the following criteria:

- Each separate plugin should be contained in it's own directory in `./.github/scanner-plugins`. For example, `./.github/scanner-plugins/plugin-1` would be 1 plugin loaded by the scanner.
- Each plugin should have one `index.js` file inside its folder.
- The `index.js` file must export a `name` field. This is the name used to pass to the `scans` input. So the following: `scans: ['my-custom-plugin']` would cause the scanner to only run that plugin.
- The `index.js` file must export a default function. This is the function that the scanner uses to run the plugin. This can be an async function.

## Things to look out for

- Plugin names should be unique. If multiple plugins have the same name, and the `scans` input array contains this name, all the plugins with that name _will_ run. However, this is not advised because if you want to turn off one plugin, you'll have to go back and change that plugin name.
