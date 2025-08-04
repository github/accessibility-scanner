import type { Finding } from './types.d.js';
import AxeBuilder from '@axe-core/playwright'
import playwright from 'playwright';

export async function findForUrl(url: string): Promise<Finding[]> {
  const browser = await playwright.chromium.launch({ headless: true, executablePath: process.env.CI ? '/usr/bin/google-chrome' : undefined });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url);
  
  let findings: Finding[] = [];
  try {
    const rawFindings = await new AxeBuilder({ page }).analyze();
    findings = rawFindings.violations.map(violation => ({
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
  return findings;
}
