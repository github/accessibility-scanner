import type { Octokit } from '@octokit/core';
import type { Result } from './types.d.js';
import * as url from 'node:url'
const URL = url.URL;

export async function fileIssueForResult(octokit: Octokit, repoWithOwner: string, result: Result) {
  const owner = repoWithOwner.split('/')[0];
  const repo = repoWithOwner.split('/')[1];
  const title = `Accessibility issue: ${result.problemShort[0].toUpperCase() + result.problemShort.slice(1)} on ${new URL(result.url).pathname}`;
  const solutionLong = result.solutionLong?.split('\n').map((line) => { if (!line.trim().startsWith("Fix any") && !line.trim().startsWith("Fix all")) { return `- ${line}`; } else { return line; } }).join('\n');
  const body = `
An accessibility scan flagged the element \`${result.html}\` on ${result.url} because ${result.problemShort}. Learn more about why this was flagged by visiting ${result.problemUrl}.

To fix this, ${result.solutionShort}.
${solutionLong ? `\nSpecifically:\n\n${solutionLong}` : ''}
`;

  return await octokit.request(`POST /repos/${owner}/${repo}/issues`, {
    owner,
    repo,
    title,
    body
  });
}