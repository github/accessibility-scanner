import { readFile } from 'node:fs/promises';
import type { Finding } from './types.d.js';
import AxeBuilder from '@axe-core/playwright'
import playwright from 'playwright';

export async function findForUrl(url: string, sessionStatePath?: string): Promise<Finding[]> {
  const browser = await playwright.chromium.launch({ headless: true, executablePath: process.env.CI ? '/usr/bin/google-chrome' : undefined });
  let sessionState;
  if (sessionStatePath) {
    try {
      sessionState = JSON.parse(await readFile(sessionStatePath, 'utf8'));
    } catch (error) {
      console.error(`Error reading or parsing session state file at path: ${sessionStatePath}`, error);
    }
  }
  const context = await browser.newContext({ storageState: sessionState });
  const page = await context.newPage();
  await page.goto(url);

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
