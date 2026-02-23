import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Helper to get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const plugins: any[] = [];
let pluginsLoaded = false;


export async function loadPlugins() {
  if (!pluginsLoaded) {
    pluginsLoaded = true;
    await loadBuiltInPlugins();
    await loadCustomPlugins();
  }

  return plugins;
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
    console.log('error: ');
    console.log(e);
  }
}
