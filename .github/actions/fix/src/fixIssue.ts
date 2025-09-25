import type { Octokit } from '@octokit/core';
import { Issue } from './Issue.js';

// https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/use-copilot-agents/coding-agent/assign-copilot-to-an-issue#assigning-an-existing-issue
export async function fixIssue(octokit: Octokit, { owner, repository, issueNumber, nodeId }: Issue) {
  // Check whether issues can be assigned to Copilot
  const suggestedActorsResponse = await octokit.graphql<{
    repository: {
      suggestedActors: {
        nodes: { login: string, id: string }[]
      }
    }
  }>(
    `query ($owner: String!, $repository: String!) {
      repository(owner: $owner, name: $repository) {
        suggestedActors(capabilities: [CAN_BE_ASSIGNED], first: 1) {
          nodes {
            login
            __typename
            ... on Bot { id }
            ... on User { id }
          }
        }
      }
    }`,
    { owner, repository },
  );
  if (suggestedActorsResponse?.repository?.suggestedActors?.nodes[0]?.login !== "copilot-swe-agent") {
    return;
  }
  // Get GraphQL identifier for issue (unless already provided)
  let issueId = nodeId;
  if (!issueId) {
    console.debug(`Fetching identifier for issue ${owner}/${repository}#${issueNumber}`);
    const issueResponse = await octokit.graphql<{
      repository: {
        issue: { id: string }
      }
    }>(
      `query($owner: String!, $repository: String!, $issueNumber: Int!) {
        repository(owner: $owner, name: $repository) {
          issue(number: $issueNumber) { id }
        }
      }`,
      { owner, repository, issueNumber }
    );
    issueId = issueResponse?.repository?.issue?.id;
    console.debug(`Fetched identifier for issue ${owner}/${repository}#${issueNumber}: ${issueId}`);
  } else {
    console.debug(`Using provided identifier for issue ${owner}/${repository}#${issueNumber}: ${issueId}`);
  }
  if (!issueId) {
    console.warn(`Couldn’t get identifier for issue ${owner}/${repository}#${issueNumber}. Skipping assignment to Copilot.`);
    return;
  }
  // Assign issue to Copilot
  await octokit.graphql<{
    replaceActorsForAssignable: {
      assignable: {
        id: string;
        url: string;
        title: string;
        assignees: {
          nodes: { login: string }[]
        }
      }
    }
  }>(
    `mutation($issueId: ID!, $assigneeId: ID!) {
      replaceActorsForAssignable(input: {assignableId: $issueId, actorIds: [$assigneeId]}) {
        assignable {
          ... on Issue {
            id
            title
            assignees(first: 10) {
              nodes {
                login
              }
            }
          }
        }
      }
    }`,
    { issueId, assigneeId: suggestedActorsResponse?.repository?.suggestedActors?.nodes[0]?.id }
  );
}