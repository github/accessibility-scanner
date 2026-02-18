export default async function test({ page, addFinding } = {}) {
  console.log('reflow test');
    // Check for horizontal scrolling at 320x256 viewport
  try {
    await page.setViewportSize({ width: 320, height: 256 });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

    // If horizontal scroll is required (with 1px tolerance for rounding)
    if (scrollWidth > clientWidth + 1) {
      const htmlSnippet = await page.evaluate(() => {
        return `<html lang="${document.documentElement.lang || 'en'}">`;
      });

      addFinding({
        scannerType: 'viewport',
        ruleId: 'horizontal-scroll-320x256',
        url,
        html: htmlSnippet.replace(/'/g, "&apos;"),
        problemShort: 'page requires horizontal scrolling at 320x256 viewport',
        problemUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/reflow.html',
        solutionShort: 'ensure content is responsive and does not require horizontal scrolling at small viewport sizes',
        solutionLong: `The page has a scroll width of ${scrollWidth}px but a client width of only ${clientWidth}px at 320x256 viewport, requiring horizontal scrolling. This violates WCAG 2.1 Level AA Success Criterion 1.4.10 (Reflow).`
      });
    }
  } catch (e) {
    console.error('Error checking horizontal scroll:', e);
  }

}

export const name = 'reflow test';
