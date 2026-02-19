import type { Endpoints } from "@octokit/types"
import type { Result } from "./types.d.js";
import fs from "node:fs";
import { describe, it, expect, beforeAll } from "vitest";
import { Octokit } from "@octokit/core";
import { throttling } from "@octokit/plugin-throttling";
const OctokitWithThrottling = Octokit.plugin(throttling);

describe("site-with-errors", () => {
  let results: Result[];

  beforeAll(() => {
    expect(process.env.CACHE_PATH).toBeDefined();
    expect(fs.existsSync(process.env.CACHE_PATH!)).toBe(true);
    results = JSON.parse(fs.readFileSync(process.env.CACHE_PATH!, "utf-8"));
  });

  it("cache has expected results", () => {
    const actual = results.map(({ issue: { url: issueUrl }, pullRequest: { url: pullRequestUrl }, findings }) => {
      const { problemUrl, solutionLong, screenshotId, ...finding } =
        findings[0];
      // Check volatile fields for existence only
      expect(issueUrl).toBeDefined();
      expect(pullRequestUrl).toBeDefined();
      expect(problemUrl).toBeDefined();
      expect(solutionLong).toBeDefined();
      expect(screenshotId).toBeDefined();
      // Check `problemUrl`, ignoring axe version
      expect(
        problemUrl.startsWith("https://dequeuniversity.com/rules/axe/"),
      ).toBe(true);
      expect(
        problemUrl.endsWith(`/${finding.ruleId}?application=playwright`),
      ).toBe(true);
      // Check `screenshotId` is a valid UUID
      expect(screenshotId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      return finding;
    });
    const expected = [
      {
        scannerType: "axe",
        url: "http://127.0.0.1:4000/",
        html: '<span class="post-meta">Jul 30, 2025</span>',
        problemShort:
          "elements must meet minimum color contrast ratio thresholds",
        ruleId: "color-contrast",
        solutionShort:
          "ensure the contrast between foreground and background colors meets wcag 2 aa minimum contrast ratio thresholds",
        screenshotId: "12345678-1234-1234-1234-123456789012",
      },
      {
        scannerType: "axe",
        url: "http://127.0.0.1:4000/",
        html: '<html lang="en">',
        problemShort: "page should contain a level-one heading",
        ruleId: "page-has-heading-one",
        solutionShort:
          "ensure that the page, or at least one of its frames contains a level-one heading",
        screenshotId: "12345678-1234-1234-1234-123456789012",
      },
      {
        scannerType: "axe",
        url: "http://127.0.0.1:4000/jekyll/update/2025/07/30/welcome-to-jekyll.html",
        html: `<time class="dt-published" datetime="2025-07-30T17:32:33+00:00" itemprop="datePublished">Jul 30, 2025
      </time>`,
        problemShort:
          "elements must meet minimum color contrast ratio thresholds",
        ruleId: "color-contrast",
        solutionShort:
          "ensure the contrast between foreground and background colors meets wcag 2 aa minimum contrast ratio thresholds",
        screenshotId: "12345678-1234-1234-1234-123456789012",
      },
      {
        scannerType: "axe",
        url: "http://127.0.0.1:4000/about/",
        html: '<a href="https://jekyllrb.com/">jekyllrb.com</a>',
        problemShort:
          "elements must meet minimum color contrast ratio thresholds",
        ruleId: "color-contrast",
        solutionShort:
          "ensure the contrast between foreground and background colors meets wcag 2 aa minimum contrast ratio thresholds",
        screenshotId: "12345678-1234-1234-1234-123456789012",
      },
      {
        scannerType: "axe",
        url: "http://127.0.0.1:4000/404.html",
        html: '<li class="p-name">Accessibility Scanner Demo</li>',
        problemShort:
          "elements must meet minimum color contrast ratio thresholds",
        ruleId: "color-contrast",
        solutionShort:
          "ensure the contrast between foreground and background colors meets wcag 2 aa minimum contrast ratio thresholds",
        screenshotId: "12345678-1234-1234-1234-123456789012",
      },
      {
        scannerType: "axe",
        url: "http://127.0.0.1:4000/404.html",
        html: '<h1 class="post-title"></h1>',
        problemShort: "headings should not be empty",
        ruleId: "empty-heading",
        solutionShort: "ensure headings have discernible text",
        screenshotId: "12345678-1234-1234-1234-123456789012",
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
      octokit = new OctokitWithThrottling({
        auth: process.env.GITHUB_TOKEN,
        throttle: {
          onRateLimit: (retryAfter, options, octokit, retryCount) => {
            octokit.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`);
            if (retryCount < 3) {
              octokit.log.info(`Retrying after ${retryAfter} seconds!`);
              return true;
            }
          },
          onSecondaryRateLimit: (retryAfter, options, octokit, retryCount) => {
            octokit.log.warn(`Secondary rate limit hit for request ${options.method} ${options.url}`);
            if (retryCount < 3) {
              octokit.log.info(`Retrying after ${retryAfter} seconds!`);
              return true;
            }
          },
        }
      });
      // Fetch issues referenced in the cache file
      issues = await Promise.all(results.map(async ({ issue: { url: issueUrl } }) => {
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
      pullRequests = await Promise.all(results.map(async ({ pullRequest: { url: pullRequestUrl } }) => {
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
        expect(pullRequest.assignees).toBeDefined();
        expect(pullRequest.assignees!.some(a => a.login === "Copilot")).toBe(true);
      }
    });
  });
});
