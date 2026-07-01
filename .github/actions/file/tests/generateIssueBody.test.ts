import {describe, it, expect} from 'vitest'
import {generateIssueBody} from '../src/generateIssueBody.ts'

const baseFinding = {
  scannerType: 'axe',
  ruleId: 'color-contrast',
  url: 'https://example.com/page',
  html: '<span>Low contrast</span>',
  problemShort: 'elements must meet minimum color contrast ratio thresholds',
  problemUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast?application=playwright',
  solutionShort: 'ensure the contrast between foreground and background colors meets WCAG thresholds',
}

const findingWithEmptyOptionalFields = {
  scannerType: 'reflow',
  url: 'https://example.com/404',
  problemShort: 'page requires horizontal scrolling at 320x256 viewport',
  problemUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/reflow.html',
  solutionShort: 'ensure content is responsive and does not require horizontal scrolling at small viewport sizes',
}

describe('generateIssueBody', () => {
  it('includes acceptance criteria and omits the Specifically section when solutionLong is missing', () => {
    const body = generateIssueBody(baseFinding, 'github/accessibility-scanner')

    expect(body).toContain('## What')
    expect(body).toContain('## Acceptance Criteria')
    expect(body).toContain('The specific violation reported in this issue is no longer reproducible.')
    expect(body).toContain('The fix MUST meet WCAG 2.2 guidelines OR')
    expect(body).not.toContain('Specifically:')
  })

  it('formats solutionLong lines into bullets while preserving Fix any/Fix all lines', () => {
    const body = generateIssueBody(
      {
        ...baseFinding,
        solutionLong: [
          'Use a darker foreground color.',
          'Fix any of the following:',
          'Increase font weight.',
          'Fix all of the following:',
          'Add a non-color visual indicator.',
          '',
        ].join('\n'),
      },
      'github/accessibility-scanner',
    )

    expect(body).toContain('Specifically:')
    expect(body).toContain('- Use a darker foreground color.')
    expect(body).toContain('Fix any of the following:')
    expect(body).toContain('- Increase font weight.')
    expect(body).toContain('Fix all of the following:')
    expect(body).toContain('- Add a non-color visual indicator.')

    expect(body).not.toContain('- Fix any of the following:')
    expect(body).not.toContain('- Fix all of the following:')
  })

  it('uses the screenshotRepo for the screenshot URL, not the filing repo', () => {
    const body = generateIssueBody({...baseFinding, screenshotId: 'abc123'}, 'github/my-workflow-repo')

    expect(body).toContain('github/my-workflow-repo/blob/gh-cache/.screenshots/abc123.png')
    expect(body).not.toContain('github/accessibility-scanner')
  })

  it('omits screenshot section when screenshotId is not present', () => {
    const body = generateIssueBody(baseFinding, 'github/accessibility-scanner')

    expect(body).not.toContain('View screenshot')
    expect(body).not.toContain('.screenshots')
  })

  it('uses url fallback when html is not present', () => {
    const body = generateIssueBody(findingWithEmptyOptionalFields, 'github/accessibility-scanner')

    expect(body).toContain(`found an issue on ${findingWithEmptyOptionalFields.url}`)
    expect(body).not.toContain('flagged the element')
  })

  it('lists every node when the finding carries multiple elements', () => {
    const body = generateIssueBody(
      {
        ...baseFinding,
        html: '<span>first</span>',
        nodes: [
          {html: '<span>first</span>', target: 'span.first'},
          {html: '<a href="x">link</a>', target: 'a.link'},
        ],
      },
      'github/accessibility-scanner',
    )

    expect(body).toContain('flagged 2 elements')
    expect(body).toContain('- `<span>first</span>` (selector: `span.first`)')
    expect(body).toContain('- `<a href="x">link</a>` (selector: `a.link`)')
    expect(body).not.toContain('flagged the element')
  })

  it('omits the Occurrences section for a single finding', () => {
    const body = generateIssueBody(baseFinding, 'github/accessibility-scanner')

    expect(body).not.toContain('Other Occurrences')
  })

  it('renders an Occurrences checklist when given multiple findings', () => {
    const second = {...baseFinding, url: 'https://example.com/other', html: '<a>Link</a>'}
    const body = generateIssueBody([baseFinding, second], 'github/accessibility-scanner')

    expect(body).toContain('## 2 Other Occurrences:')
    expect(body).toContain(`- [ ] \`${baseFinding.html}\` on ${baseFinding.url}`)
    expect(body).toContain(`- [ ] \`${second.html}\` on ${second.url}`)
  })

  it('omits the category notice for WCAG findings', () => {
    expect(generateIssueBody(baseFinding, 'github/accessibility-scanner')).not.toContain('> [!NOTE]')
    expect(generateIssueBody({...baseFinding, category: 'wcag'}, 'github/accessibility-scanner')).not.toContain(
      '> [!NOTE]',
    )
  })

  it('includes a best-practice notice for best-practice findings', () => {
    const body = generateIssueBody({...baseFinding, category: 'best-practice'}, 'github/accessibility-scanner')

    expect(body).toContain('> [!NOTE]')
    expect(body).toContain('best-practice recommendation')
    expect(body).toContain('not a definite WCAG failure')
    expect(body).toContain('WCAG 2.2 if applicable')
    expect(body).not.toContain('The fix MUST meet WCAG 2.2 guidelines OR')
  })

  it('includes an experimental notice for experimental findings', () => {
    const body = generateIssueBody({...baseFinding, category: 'experimental'}, 'github/accessibility-scanner')

    expect(body).toContain('> [!NOTE]')
    expect(body).toContain('an experimental check')
    expect(body).toContain('not a definite WCAG failure')
    expect(body).toContain('WCAG 2.2 if applicable')
    expect(body).not.toContain('The fix MUST meet WCAG 2.2 guidelines OR')
  })
})
