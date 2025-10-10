export type Issue = {
  url: string;
  nodeId?: string;
};

export type PullRequest = {
  url: string;
  nodeId?: string;
};

export type Fixing = {
  issue: Issue;
  pullRequest: PullRequest;
};
