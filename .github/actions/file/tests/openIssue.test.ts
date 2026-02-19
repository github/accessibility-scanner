import { describe, it, expect, vi } from "vitest";

// Mock generateIssueBody so we can inspect what screenshotRepo is passed
vi.mock("../src/generateIssueBody.js", () => ({
  generateIssueBody: vi.fn(
    (_finding, screenshotRepo: string) =>
      `body with screenshotRepo=${screenshotRepo}`,
  ),
}));

import { openIssue } from "../src/openIssue.ts";
import { generateIssueBody } from "../src/generateIssueBody.ts";

const baseFinding = {
  scannerType: "axe",
  ruleId: "color-contrast",
  url: "https://example.com/page",
  html: "<span>Low contrast</span>",
  problemShort: "elements must meet minimum color contrast ratio thresholds",
  problemUrl:
    "https://dequeuniversity.com/rules/axe/4.10/color-contrast?application=playwright",
  solutionShort:
    "ensure the contrast between foreground and background colors meets WCAG thresholds",
};

function mockOctokit() {
  return {
    request: vi.fn().mockResolvedValue({ data: { id: 1, html_url: "https://github.com/org/repo/issues/1" } }),
  } as any;
}

describe("openIssue", () => {
  it("passes screenshotRepo to generateIssueBody when provided", async () => {
    const octokit = mockOctokit();
    await openIssue(octokit, "org/filing-repo", baseFinding, "org/workflow-repo");

    expect(generateIssueBody).toHaveBeenCalledWith(baseFinding, "org/workflow-repo");
  });

  it("falls back to repoWithOwner when screenshotRepo is not provided", async () => {
    const octokit = mockOctokit();
    await openIssue(octokit, "org/filing-repo", baseFinding);

    expect(generateIssueBody).toHaveBeenCalledWith(baseFinding, "org/filing-repo");
  });

  it("posts to the correct filing repo, not the screenshot repo", async () => {
    const octokit = mockOctokit();
    await openIssue(octokit, "org/filing-repo", baseFinding, "org/workflow-repo");

    expect(octokit.request).toHaveBeenCalledWith(
      "POST /repos/org/filing-repo/issues",
      expect.objectContaining({
        owner: "org",
        repo: "filing-repo",
      }),
    );
  });

  it("includes the correct labels based on the finding", async () => {
    const octokit = mockOctokit();
    await openIssue(octokit, "org/repo", baseFinding);

    expect(octokit.request).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        labels: ["axe rule: color-contrast", "axe-scanning-issue"],
      }),
    );
  });

  it("truncates long titles with ellipsis", async () => {
    const octokit = mockOctokit();
    const longFinding = {
      ...baseFinding,
      problemShort: "a".repeat(300),
    };
    await openIssue(octokit, "org/repo", longFinding);

    const callArgs = octokit.request.mock.calls[0][1];
    expect(callArgs.title.length).toBeLessThanOrEqual(256);
    expect(callArgs.title).toMatch(/…$/);
  });
});
