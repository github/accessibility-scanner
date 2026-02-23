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
  try {
    const absoluteFolderPath = path.join(__dirname, '../../../scanner-plugins');

    const res = fs.readdirSync(absoluteFolderPath);
    for (const pluginFolder of res) {
      // @ts-ignore
      plugins.push(await import('../../../scanner-plugins/' + pluginFolder + '/index.js'));
    }
  } catch (e) {
    console.log('error: ');
    console.log(e);
  }
}

async function loadCustomPlugins() {
  console.log('cwd: ', process.cwd());
  console.log('cwd: ', process.cwd() + '/.github');
  console.log('cwd: ', process.cwd() + '/.github/scanner-plugins');


  // try {
  //   const absoluteFolderPath = path.join(__dirname, '../../../scanner-plugins');

  //   const res = fs.readdirSync(absoluteFolderPath);
  //   for (const pluginFolder of res) {
  //     // @ts-ignore
  //     plugins.push(await import('/home/runner/work/scanner-plugins/' + pluginFolder + '/index.js'));
  //   }
  // } catch (e) {
  //   console.log('error: ');
  //   console.log(e);
  // }
}
