import type { Octokit } from "@octokit/core";
import { Issue } from "./Issue.js";

export async function getLinkedPR(
  octokit: Octokit,
  { owner, repository, issueNumber, nodeId }: Issue
) {
  // Check whether issues can be assigned to Copilot
  const response = await octokit.graphql<{
    repository?: {
      issue?: {
        timelineItems?: {
          nodes: (
            | { source: { id: string; url: string; title: string } }
            | { subject: { id: string; url: string; title: string } }
          )[];
        };
      };
    };
  }>(
    `query($owner: String!, $repo: String!, $issueNumber: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $issueNumber) {
          timelineItems(first: 100, itemTypes: [CONNECTED_EVENT, CROSS_REFERENCED_EVENT]) {
            nodes {
              ... on CrossReferencedEvent { source { ... on PullRequest { id url title } } }
              ... on ConnectedEvent { subject { ... on PullRequest { id url title } } }
            }
          }
        }
      }
    }`,
    { owner, repository, issueNumber }
  );
  const timelineNodes = response?.repository?.issue?.timelineItems?.nodes || [];
  const pullRequest: { id: string; url: string; title: string } | undefined =
    timelineNodes
      .map((node) => {
        if ("source" in node && node.source?.url) return node.source;
        if ("subject" in node && node.subject?.url) return node.subject;
        return undefined;
      })
      .find((pr) => !!pr);
  return pullRequest;
}
