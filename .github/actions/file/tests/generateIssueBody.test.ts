import { describe, it, expect } from "vitest";
import { generateIssueBody } from "../src/generateIssueBody.ts";

const baseFinding = {
  scannerType: "axe",
  ruleId: "color-contrast",
  url: "https://example.com/page",
  html: "<span>Low contrast</span>",
  problemShort: "elements must meet minimum color contrast ratio thresholds",
  problemUrl: "https://dequeuniversity.com/rules/axe/4.10/color-contrast?application=playwright",
  solutionShort: "ensure the contrast between foreground and background colors meets WCAG thresholds",
};

describe("generateIssueBody", () => {
  it("includes acceptance criteria and omits the Specifically section when solutionLong is missing", () => {
    const body = generateIssueBody(baseFinding, "github/accessibility-scanner");

    expect(body).toContain("## What");
    expect(body).toContain("## Acceptance Criteria");
    expect(body).toContain("The specific axe violation reported in this issue is no longer reproducible.");
    expect(body).not.toContain("Specifically:");
  });

  it("formats solutionLong lines into bullets while preserving Fix any/Fix all lines", () => {
    const body = generateIssueBody(
      {
        ...baseFinding,
        solutionLong: [
          "Use a darker foreground color.",
          "Fix any of the following:",
          "Increase font weight.",
          "Fix all of the following:",
          "Add a non-color visual indicator.",
          "",
        ].join("\n"),
      },
      "github/accessibility-scanner",
    );

    expect(body).toContain("Specifically:");
    expect(body).toContain("- Use a darker foreground color.");
    expect(body).toContain("Fix any of the following:");
    expect(body).toContain("- Increase font weight.");
    expect(body).toContain("Fix all of the following:");
    expect(body).toContain("- Add a non-color visual indicator.");

    expect(body).not.toContain("- Fix any of the following:");
    expect(body).not.toContain("- Fix all of the following:");
  });

  it("uses the screenshotRepo for the screenshot URL, not the filing repo", () => {
    const body = generateIssueBody(
      { ...baseFinding, screenshotId: "abc123" },
      "github/my-workflow-repo",
    );

    expect(body).toContain("github/my-workflow-repo/blob/gh-cache/.screenshots/abc123.png");
    expect(body).not.toContain("github/accessibility-scanner");
  });

  it("omits screenshot section when screenshotId is not present", () => {
    const body = generateIssueBody(baseFinding, "github/accessibility-scanner");

    expect(body).not.toContain("View screenshot");
    expect(body).not.toContain(".screenshots");
  });
});
