export type Finding = {
  scannerType: string;
  id: string;
  url: string;
  html: string;
  problemShort: string;
  problemUrl: string;
  solutionShort: string;
  solutionLong?: string;
  issueUrl?: string;
}