import type { Finding } from './types.d.js';
import AxeBuilder from '@axe-core/playwright'
import playwright from 'playwright';
import { AuthContext } from './AuthContext.js';
import * as fs from 'fs';
import * as path from 'path';

export async function findForUrl(url: string, authContext?: AuthContext): Promise<Finding[]> {
  // const browser = await playwright.chromium.launch({ headless: true, executablePath: process.env.CI ? '/usr/bin/google-chrome' : undefined });
  // const contextOptions = authContext?.toPlaywrightBrowserContextOptions() ?? {};
  // const context = await browser.newContext(contextOptions);
  // const page = await context.newPage();
  // await page.goto(url);
  // console.log(`Scanning ${page.url()}`);

  const plugins = await PluginsProvider.getPlugins();
  for (const plugin of plugins) {
    plugin.default();
    // plugin.test2();
  }
  console.log('number of plugins: ', plugins.length);


  let findings: Finding[] = [];
  // try {
  //   const rawFindings = await new AxeBuilder({ page }).analyze();
  //   findings = rawFindings.violations.map(violation => ({
  //     scannerType: 'axe',
  //     url,
  //     html: violation.nodes[0].html.replace(/'/g, "&apos;"),
  //     problemShort: violation.help.toLowerCase().replace(/'/g, "&apos;"),
  //     problemUrl: violation.helpUrl.replace(/'/g, "&apos;"),
  //     ruleId: violation.id,
  //     solutionShort: violation.description.toLowerCase().replace(/'/g, "&apos;"),
  //     solutionLong: violation.nodes[0].failureSummary?.replace(/'/g, "&apos;")
  //   }));
  // } catch (e) {
  //   // do something with the error
  // }
  // await context.close();
  // await browser.close();
  return findings;
}

class PluginsProvider {
  static #plugins: any[] = [];
  static #pluginsLoaded = false;

  static async getPlugins() {
    if (!PluginsProvider.#pluginsLoaded) {
      console.log('loading plugins');
      PluginsProvider.#pluginsLoaded = true;
      try {
        const pluginsDir = path.join(process.cwd(), '.github', 'scanner-plugins');
        const res = fs.readdirSync('../../../scanner-plugins/');
        console.log('done reading dir');
        for (const pluginFolder of res) {
          // will also include directory names
          console.log('pluginFolder: ', pluginFolder);
          // const indexFile = path.join('/home/runner/work/accessibility-sandbox/accessibility-sandbox/.github/scanner-plugins/reflow-test/index.js');
          // PluginsProvider.#plugins.push(await require('/home/runner/work/accessibility-sandbox/accessibility-sandbox/.github/scanner-plugins/' + pluginFolder + '/index.js'));
          // @ts-ignore
          PluginsProvider.#plugins.push(await import('../../../scanner-plugins/' + pluginFolder + '/index.js'));
        }
      } catch (e) {
        console.log('error: ');
        console.log(e);
      }
    }

    return PluginsProvider.#plugins;
  }
}

interface IPluginContext {
  performAxeScan(): Promise<void>;
  page: playwright.Page;
}

// - need to consider that some pages might need
//   multiple scans (e.g. scan, click something, scan again)
// - some pages might need to be refreshed to reset the state
//   before performing another interaction/scan
// - we also need to be able to report those findings individually
// - maybe each 'scenario' needs a name, because using the url
//   alone will not make it clear which scenario the finding came from
class PluginContext implements IPluginContext {
  static create({ page }: { page: playwright.Page }): IPluginContext {
    return new PluginContext({ page });
  }

  constructor({ page }: { page: playwright.Page }) {
    this.#page = page;
  }

  #page: playwright.Page;

  async performAxeScan() {
    if (!this.page) return;
    await new AxeBuilder({ page: this.page }).analyze();
  }

  get page() {
    return this.#page;
  }

  // - js doesnt know about ts
  // - this poJo (plain old js object) is what
  //   we pass to the plugin
  get toPoJo(): IPluginContext {
    return {
      performAxeScan: this.performAxeScan,
      page: this.page,
    };
  }
}
