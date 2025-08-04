import core from "@actions/core";
import { findForUrl } from "./findForUrl.js";

export default async function () {
  const urls = core.getMultilineInput('urls', { required: true });

  let findings = [];
  for (const url of urls) {
    const findingsForUrl = await findForUrl(url);
    if (findingsForUrl.length === 0) {
      console.log(`No accessibility gaps were found on ${url}`);
      continue;
    }
    findings.push(...findingsForUrl);
  }

  core.setOutput("results", JSON.stringify(findings));
}
