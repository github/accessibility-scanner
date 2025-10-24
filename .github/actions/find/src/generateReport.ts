import type { Finding } from "./types.d.js";

export function generateReport(findings: Finding[]): string {
  if (findings.length === 0) {
    return "# Accessibility Scan Report\n\nNo accessibility issues found.";
  }

  let report = "# Accessibility Scan Report\n\n";
  report += `Found ${findings.length} accessibility issues.\n\n`;

  report += "| URL | Problem | Solution | Rule ID |\n";
  report += "| --- | --- | --- | --- |\n";

  for (const finding of findings) {
    report += `| ${finding.url} | ${finding.problemShort} | ${finding.solutionShort} | [${finding.ruleId}](${finding.problemUrl}) |\n`;
  }

  return report;
}
