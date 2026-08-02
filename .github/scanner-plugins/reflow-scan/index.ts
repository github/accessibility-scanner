export default async function reflowScan({page, addFinding} = {}) {
  const originalViewport = page.viewportSize()
  const url = page.url()
  // Check for horizontal scrolling at 320 viewport
  try {
    await page.setViewportSize({width: 320, height: 256})
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)

    // If horizontal scroll is required (with 1px tolerance for rounding)
    if (scrollWidth > clientWidth + 1) {
      await addFinding({
        scannerType: 'reflow-scan',
        url,
        problemShort: 'needs review: page presents a horizontal scrollbar at a 320px wide viewport',
        problemUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/reflow.html',
        solutionShort:
          'verify if sections of content can be viewed within the 320px wide viewport without needing to scroll in two dimensions to read the content of an individual section',
        solutionLong: `The page has a scroll width of ${scrollWidth}px but a client width of only ${clientWidth}px at a 320px wide viewport, resulting in a horizontal scrollbar. Ensure that multi-line text does not require scrolling in two-dimensions to read, as this would be a violation of WCAG Success Criterion 1.4.10 (Reflow).`,
      })
    }
  } catch (e) {
    console.error('Error checking horizontal scroll:', e)
  } finally {
    // Restore original viewport so subsequent scans (e.g. Axe) aren't affected
    if (originalViewport) {
      await page.setViewportSize(originalViewport)
    }
  }
}

export const name = 'reflow-scan'
