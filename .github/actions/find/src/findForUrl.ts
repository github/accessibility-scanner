import type { Finding } from './types.d.js';
import AxeBuilder from '@axe-core/playwright'
import playwright from 'playwright';
import { AuthContext } from './AuthContext.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Helper to get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function findForUrl(url: string, authContext?: AuthContext): Promise<Finding[]> {
  const browser = await playwright.chromium.launch({ headless: true, executablePath: process.env.CI ? '/usr/bin/google-chrome' : undefined });
  const contextOptions = authContext?.toPlaywrightBrowserContextOptions() ?? {};
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  await page.goto(url);
  console.log(`Scanning ${page.url()}`);

  let findings: Finding[] = [];
  const addFinding = (findingData: Finding) => {
    findings.push(findingData);
  };

  const plugins = await loadPlugins();
  for (const plugin of plugins) {
    console.log('running plugin: ', plugin.name);
    await plugin.default({ page, addFinding, url });
  }

  try {
    const rawFindings = await new AxeBuilder({ page }).analyze();
    findings = rawFindings.violations.map(violation => ({
      scannerType: 'axe',
      url,
      html: violation.nodes[0].html.replace(/'/g, "&apos;"),
      problemShort: violation.help.toLowerCase().replace(/'/g, "&apos;"),
      problemUrl: violation.helpUrl.replace(/'/g, "&apos;"),
      ruleId: violation.id,
      solutionShort: violation.description.toLowerCase().replace(/'/g, "&apos;"),
      solutionLong: violation.nodes[0].failureSummary?.replace(/'/g, "&apos;")
    }));
  } catch (e) {
    // do something with the error
  }
  await context.close();
  await browser.close();
  return findings;
}

const plugins: any[] = [];
let pluginsLoaded = false;

async function loadPlugins() {
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
  loadPluginsFromPath({
    readPath: path.join(__dirname, pluginsPath),
    importPath: pluginsPath,
  });
}

async function loadCustomPlugins() {
  console.log('Loading custom plugins');

  const pluginsPath = process.cwd() + '/.github/scanner-plugins';
  loadPluginsFromPath({
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
      plugins.push(await import(importPath + pluginFolder + '/index.js'));
    }
  } catch (e) {
    console.log('error: ');
    console.log(e);
  }
}
