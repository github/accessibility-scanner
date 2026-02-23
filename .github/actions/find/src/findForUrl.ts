import type { Finding } from './types.d.js';
import AxeBuilder from '@axe-core/playwright'
import playwright from 'playwright';
import { AuthContext } from './AuthContext.js';
import { loadPlugins } from './pluginManager.js';

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
    console.log('Running plugin: ', plugin.name);
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
