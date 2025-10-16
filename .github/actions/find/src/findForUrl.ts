import type { Finding } from './types.d.js';
import AxeBuilder from '@axe-core/playwright'
import playwright from 'playwright';
import { AuthContext } from './AuthContext.js';

export async function findForUrl(
  url: string,
  authContext?: AuthContext,
  waitForSelector?: string,
  waitForTimeout?: number
): Promise<Finding[]> {
  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: process.env.CI ? "/usr/bin/google-chrome" : undefined,
  });
  const contextOptions = authContext?.toPlaywrightBrowserContextOptions() ?? {};
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  await page.goto(url);

  if (waitForSelector) {
    await page.waitForSelector(waitForSelector, { timeout: waitForTimeout });
  }

  let findings: Finding[] = [];
  try {
    const rawFindings = await new AxeBuilder({ page }).analyze();
    findings = rawFindings.violations.map(violation => ({
      scannerType: 'axe',
      url,
      html: violation.nodes[0].html,
      problemShort: violation.help.toLowerCase().replace(/[']/g, '’'),
      problemUrl: violation.helpUrl.replace(/[']/g, '’'),
      ruleId: violation.id,
      solutionShort: violation.description.toLowerCase().replace(/[']/g, '’'),
      solutionLong: violation.nodes[0].failureSummary?.replace(/[']/g, '’')
    }));
  } catch (e) {
    // do something with the error
  }
  await context.close();
  await browser.close();
  return findings;
}
