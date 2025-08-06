import type { Octokit } from '@octokit/core';

// https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/use-copilot-agents/coding-agent/assign-copilot-to-an-issue#assigning-an-existing-issue
export async function fixIssue(octokit: Octokit, repoWithOwner: string, issueUrl: string) {
  const owner = repoWithOwner.split('/')[0];
  const repo = repoWithOwner.split('/')[1];
  const issueNumber = Number(issueUrl.split('/').pop());
  // Check whether issues can be assigned to Copilot
  const suggestedActorsResponse = await octokit.graphql<{
    repository: {
      suggestedActors: {
        nodes: { login: string, id: string }[]
      }
    }
  }>(
    `query ($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
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
    { owner, repo },
  );
  if (suggestedActorsResponse?.repository?.suggestedActors?.nodes[0]?.login !== "copilot-swe-agent") {
    return;
  }
  // Get GraphQL identifier for issue
  const issueResponse = await octokit.graphql<{
    repository: {
      issue: { id: string }
    }
  }>(
    `query($owner: String!, $repo: String!, $issueNumber: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $issueNumber) { id }
      }
    }`,
    { owner, repo, issueNumber }
  );
  const issueId = issueResponse?.repository?.issue?.id;
  if (!issueId) {
    return;
  }
  // Assign issue to Copilot
  return await octokit.graphql(
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