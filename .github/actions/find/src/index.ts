import type { AuthContextInput } from "./types.js";
import core from "@actions/core";
import { AuthContext } from "./AuthContext.js";
import { findForUrl } from "./findForUrl.js";

export default async function () {
  core.info("Starting 'find' action");
  const urls = core.getMultilineInput("urls", { required: true });
  core.debug(`Input: 'urls: ${JSON.stringify(urls)}'`);
  const authContextInput: AuthContextInput = JSON.parse(
    core.getInput("auth_context", { required: false }) || "{}"
  );
  const authContext = new AuthContext(authContextInput);

  let findings = [];
  for (const url of urls) {
    core.info(`Preparing to scan ${url}`);
    const findingsForUrl = await findForUrl(url, authContext);
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
