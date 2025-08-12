import core from "@actions/core";
import { findForUrl } from "./findForUrl.js";

export default async function () {
  core.info("Starting 'find' action");
  const urls = core.getMultilineInput('urls', { required: true });
  core.debug(`Input: 'urls: ${JSON.stringify(urls)}'`);

  let findings = [];
  for (const url of urls) {
    core.info(`Scanning ${url}`)
    const findingsForUrl = await findForUrl(url);
    if (findingsForUrl.length === 0) {
      core.info(`No accessibility gaps were found on ${url}`);
      continue;
    }
    findings.push(...findingsForUrl);
    core.info(`Found ${findingsForUrl.length} findings for ${url}`);
  }

  core.setOutput("findings", JSON.stringify(findings));
  core.debug(`Output: 'findings: ${JSON.stringify(findings)}'`);
  core.info(`Found ${findings.length} findings in total`);
  core.info("Finished 'find' action");
}
