import type { Issue as IssueInput } from "./types.d.js";

export class Issue implements IssueInput {
  /**
   * Extracts owner, repository, and issue number from a GitHub issue URL.
   * @param issueUrl A GitHub issue URL (e.g. `https://github.com/owner/repo/issues/42`).
   * @returns An object with `owner`, `repository`, and `issueNumber` keys.
   * @throws The provided URL is unparseable due to its unexpected format.
   */
  static parseIssueUrl(issueUrl: string): {
    owner: string;
    repository: string;
    issueNumber: number;
  } {
    const { owner, repository, issueNumber } =
      /\/(?<owner>[^/]+)\/(?<repository>[^/]+)\/issues\/(?<issueNumber>\d+)(?:[/?#]|$)/.exec(
        issueUrl
      )?.groups || {};
    if (!owner || !repository || !issueNumber) {
      throw new Error(`Could not parse issue URL: ${issueUrl}`);
    }
    return { owner, repository, issueNumber: Number(issueNumber) };
  }

  url: string;
  nodeId: string;
  id: number;
  title: string;
  state?: "open" | "reopened" | "closed";

  get owner(): string {
    return Issue.parseIssueUrl(this.url).owner;
  }

  get repository(): string {
    return Issue.parseIssueUrl(this.url).repository;
  }

  get issueNumber(): number {
    return Issue.parseIssueUrl(this.url).issueNumber;
  }

  constructor({ url, nodeId, id, title, state }: IssueInput) {
    this.url = url;
    this.nodeId = nodeId;
    this.id = id;
    this.title = title;
    this.state = state;
  }
}
