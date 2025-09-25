export type Finding = {
  scannerType: string;
  ruleId: string;
  url: string;
  html: string;
  problemShort: string;
  problemUrl: string;
  solutionShort: string;
  solutionLong?: string;
  issueUrl?: string;
}

export type Issue = {
  id: number;
  nodeId: string;
  url: string;
  title: string;
}