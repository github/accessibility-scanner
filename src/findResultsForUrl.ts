import type { Result } from './types.d.js';
import AxeBuilder from '@axe-core/playwright'
import playwright from 'playwright';

export async function findResultsForUrl(url: string): Promise<Result[]> {
  const browser = await playwright.chromium.launch({ headless: true, executablePath: process.env.CI ? '/usr/bin/google-chrome' : undefined });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url);

  let results: Result[] = [];
  try {
    const rawResults = await new AxeBuilder({ page }).analyze();
    results = rawResults.violations.map(violation => ({
      url,
      html: violation.nodes[0].html,
      problemShort: violation.help.toLowerCase(),
      problemUrl: violation.helpUrl,
      solutionShort: violation.description.toLowerCase(),
      solutionLong: violation.nodes[0].failureSummary
    }));
  } catch (e) {
    // do something with the error
  }
  await context.close();
  await browser.close();
  return results;
}
