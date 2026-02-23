import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Helper to get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const plugins: any[] = [];
let pluginsLoaded = false;


export async function loadPlugins() {
  try {
    if (!pluginsLoaded) {
      await loadBuiltInPlugins();
      await loadCustomPlugins();
    }
  } catch (e) {
    plugins.length = 0;
    console.log('There was an error while loading plugins.');
    console.log('Clearing all plugins and aborting custom plugin scans.');
    console.log('Please check the logs for hints as to what may have gone wrong.');
  } finally {
    pluginsLoaded = true;
    return plugins;
  }
}

async function loadBuiltInPlugins() {
  console.log('Loading built-in plugins');

  const pluginsPath = '../../../scanner-plugins/';
  await loadPluginsFromPath({
    readPath: path.join(__dirname, pluginsPath),
    importPath: pluginsPath,
  });
}

async function loadCustomPlugins() {
  console.log('Loading custom plugins');

  const pluginsPath = process.cwd() + '/.github/scanner-plugins/';
  await loadPluginsFromPath({
    readPath: pluginsPath,
    importPath: pluginsPath
  });
}

async function loadPluginsFromPath({ readPath, importPath }: { readPath: string, importPath: string }) {
  try {
    const res = fs.readdirSync(readPath);
    for (const pluginFolder of res) {
      console.log('Found plugin: ', pluginFolder);
      // @ts-ignore
      plugins.push(await import(path.join(importPath, pluginFolder, '/index.js')));
    }
  } catch (e) {
    // - log errors here for granular info
    console.log('error: ');
    console.log(e);
    // - throw error to handle aborting the plugin scans
    throw(e);
  }
}
