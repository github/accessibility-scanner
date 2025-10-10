export type Finding = {
  scannerType: string;
  ruleId: string;
  url: string;
  html: string;
  problemShort: string;
  problemUrl: string;
  solutionShort: string;
  solutionLong?: string;
};

export type Issue = {
  id: number;
  nodeId: string;
  url: string;
  title: string;
  state?: "open" | "reopened" | "closed";
};

export type PullRequest = {
  url: string;
  nodeId: string;
};

export type Result = {
  findings: Finding[];
  issue: Issue;
  pullRequest: PullRequest;
};
