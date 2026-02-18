export type Finding = {
  scannerType: string;
  ruleId: string;
  url: string;
  html: string;
  problemShort: string;
  problemUrl: string;
  solutionShort: string;
  solutionLong?: string;
  screenshotId?: string;
};

export type Issue = {
  id: number;
  nodeId: string;
  url: string;
  title: string;
  state?: "open" | "reopened" | "closed";
};

export type ResolvedFiling = {
  findings: never[];
  issue: Issue;
};

export type NewFiling = {
  findings: Finding[];
  issue?: never;
};

export type RepeatedFiling = {
  findings: Finding[];
  issue: Issue;
};

export type Filing = ResolvedFiling | NewFiling | RepeatedFiling;
