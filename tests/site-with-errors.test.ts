import type { Endpoints } from "@octokit/types"
import type { Finding } from "./types.d.js";
import fs from "node:fs";
import { describe, it, expect, beforeAll } from "vitest";
import { Octokit } from "@octokit/core";

describe("site-with-errors", () => {
  let findings: Finding[];

  beforeAll(() => {
    expect(process.env.FINDINGS_PATH).toBeDefined();
    expect(fs.existsSync(process.env.FINDINGS_PATH!)).toBe(true);
    findings = JSON.parse(fs.readFileSync(process.env.FINDINGS_PATH!, "utf-8"));
  });

  it("cache has expected findings", () => {
    const actual = findings.map(({ issueUrl, pullRequestUrl, solutionLong, ...finding }) => {
      // Check volatile fields for existence only
      expect(issueUrl).toBeDefined();
      expect(pullRequestUrl).toBeDefined();
      expect(solutionLong).toBeDefined();
      return finding;
    });
    const expected = [
      {
        scannerType: "axe",
        url: "http://127.0.0.1:4000/",
        html: '<li class="p-name">Continuous Accessibility Scanner Demo</li>',
        problemShort: "elements must meet minimum color contrast ratio thresholds",
        problemUrl: "https://dequeuniversity.com/rules/axe/4.10/color-contrast?application=playwright",
        ruleId: "color-contrast",
        solutionShort: "ensure the contrast between foreground and background colors meets wcag 2 aa minimum contrast ratio thresholds"
      }, {
        scannerType: "axe",
        url: "http://127.0.0.1:4000/",
        html: '<html lang="en">',
        problemShort: "page should contain a level-one heading",
        problemUrl: "https://dequeuniversity.com/rules/axe/4.10/page-has-heading-one?application=playwright",
        ruleId: "page-has-heading-one",
        solutionShort: "ensure that the page, or at least one of its frames contains a level-one heading"
      }, {
        scannerType: "axe",
        url: "http://127.0.0.1:4000/404.html",
        html: '<li class="p-name">Continuous Accessibility Scanner Demo</li>',
        problemShort: "elements must meet minimum color contrast ratio thresholds",
        problemUrl: "https://dequeuniversity.com/rules/axe/4.10/color-contrast?application=playwright",
        ruleId: "color-contrast",
        solutionShort: "ensure the contrast between foreground and background colors meets wcag 2 aa minimum contrast ratio thresholds"
      }, {
        scannerType: "axe",
        url: "http://127.0.0.1:4000/404.html",
        html: '<h1 class="post-title"></h1>',
        problemShort: "headings should not be empty",
        problemUrl: "https://dequeuniversity.com/rules/axe/4.10/empty-heading?application=playwright",
        ruleId: "empty-heading",
        solutionShort: "ensure headings have discernible text",
      }, {
        scannerType: "axe",
        url: "http://127.0.0.1:4000/about/",
        html: '<a href="https://jekyllrb.com/">jekyllrb.com</a>',
        problemShort: "elements must meet minimum color contrast ratio thresholds",
        problemUrl: "https://dequeuniversity.com/rules/axe/4.10/color-contrast?application=playwright",
        ruleId: "color-contrast",
        solutionShort: "ensure the contrast between foreground and background colors meets wcag 2 aa minimum contrast ratio thresholds",
      }, {
        scannerType: "axe",
        url: "http://127.0.0.1:4000/jekyll/update/2025/07/30/welcome-to-jekyll.html",
        html: '<li class="p-name">Continuous Accessibility Scanner Demo</li>',
        problemShort: "elements must meet minimum color contrast ratio thresholds",
        problemUrl: "https://dequeuniversity.com/rules/axe/4.10/color-contrast?application=playwright",
        ruleId: "color-contrast",
        solutionShort: "ensure the contrast between foreground and background colors meets wcag 2 aa minimum contrast ratio thresholds",
      }, {
        scannerType: "axe",
        url: "http://127.0.0.1:4000/jekyll/update/2025/07/30/welcome-to-jekyll.html",
        html: '<h1 class="post-title"></h1>',
        problemShort: "headings should not be empty",
        problemUrl: "https://dequeuniversity.com/rules/axe/4.10/empty-heading?application=playwright",
        ruleId: "empty-heading",
        solutionShort: "ensure headings have discernible text",
      },
    ];
    // Check that:
    // - every expected object exists (no more and no fewer), and
    // - each object has all fields, and
    // - field values match expectations exactly
    // A specific order is _not_ enforced.
    expect(actual).toHaveLength(expected.length);
    expect(actual).toEqual(expect.arrayContaining(expected));
  });

  it("GITHUB_TOKEN environment variable is set", () => {
    expect(process.env.GITHUB_TOKEN).toBeDefined();
  });

  describe.runIf(!!process.env.GITHUB_TOKEN)("—", () => {
    let octokit: Octokit;
    let issues: Endpoints["GET /repos/{owner}/{repo}/issues/{issue_number}"]["response"]["data"][];
    let pullRequests: Endpoints["GET /repos/{owner}/{repo}/pulls/{pull_number}"]["response"]["data"][];

    beforeAll(async () => {
      octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
      // Fetch issues referenced in the findings file
      issues = await Promise.all(findings.map(async ({ issueUrl }) => {
        expect(issueUrl).toBeDefined();
        const { owner, repo, issueNumber } =
          /https:\/\/github\.com\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/issues\/(?<issueNumber>\d+)/.exec(issueUrl!)!.groups!;
        const {data: issue} = await octokit.request("GET /repos/{owner}/{repo}/issues/{issue_number}", {
          owner,
          repo,
          issue_number: parseInt(issueNumber, 10)
        });
        expect(issue).toBeDefined();
        return issue;
      }));
      // Fetch pull requests referenced in the findings file
      pullRequests = await Promise.all(findings.map(async ({ pullRequestUrl }) => {
        expect(pullRequestUrl).toBeDefined();
        const { owner, repo, pullNumber } =
          /https:\/\/github\.com\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/pull\/(?<pullNumber>\d+)/.exec(pullRequestUrl!)!.groups!;
        const {data: pullRequest} = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
          owner,
          repo,
          pull_number: parseInt(pullNumber, 10)
        });
        expect(pullRequest).toBeDefined();
        return pullRequest;
      }));
    });

    it("issues exist and have expected title, state, and assignee", async () => {
      const actualTitles = issues.map(({ title }) => (title));
      const expectedTitles = [
        "Accessibility issue: Elements must meet minimum color contrast ratio thresholds on /",
        "Accessibility issue: Page should contain a level-one heading on /",
        "Accessibility issue: Elements must meet minimum color contrast ratio thresholds on /404.html",
        "Accessibility issue: Headings should not be empty on /404.html",
        "Accessibility issue: Elements must meet minimum color contrast ratio thresholds on /about/",
        "Accessibility issue: Elements must meet minimum color contrast ratio thresholds on /jekyll/update/2025/07/30/welcome-to-jekyll.html",
        "Accessibility issue: Headings should not be empty on /jekyll/update/2025/07/30/welcome-to-jekyll.html",
      ];
      expect(actualTitles).toHaveLength(expectedTitles.length);
      expect(actualTitles).toEqual(expect.arrayContaining(expectedTitles));
      for (const issue of issues) {
        expect(issue.state).toBe("open");
        expect(issue.assignees).toBeDefined();
        expect(issue.assignees!.some(a => a.login === "Copilot")).toBe(true);
      }
    });

    it("pull requests exist and have expected author, state, and assignee", async () => {
      for (const pullRequest of pullRequests) {
        expect(pullRequest.user.login).toBe("Copilot");
        expect(pullRequest.state).toBe("open");
        expect(pullRequest.assignees).toBeDefined()
        expect(pullRequest.assignees!.some(a => a.login === "Copilot")).toBe(true);
      }
    });
  });
});
