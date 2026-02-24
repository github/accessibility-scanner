import type {Issue as IssueInput} from './types.d.js'

export class Issue implements IssueInput {
  #url!: string
  #parsedUrl!: {
    owner: string
    repository: string
    issueNumber: number
  }
  nodeId: string
  id: number
  title: string
  state?: 'open' | 'reopened' | 'closed'

  constructor({url, nodeId, id, title, state}: IssueInput) {
    this.url = url
    this.nodeId = nodeId
    this.id = id
    this.title = title
    this.state = state
  }

  set url(newUrl: string) {
    this.#url = newUrl
    this.#parsedUrl = this.#parseUrl()
  }

  get url(): string {
    return this.#url
  }

  get owner(): string {
    return this.#parsedUrl.owner
  }

  get repository(): string {
    return this.#parsedUrl.repository
  }

  get issueNumber(): number {
    return this.#parsedUrl.issueNumber
  }

  /**
   * Extracts owner, repository, and issue number from the Issue instance’s GitHub issue URL.
   * @returns An object with `owner`, `repository`, and `issueNumber` keys.
   * @throws The provided URL is unparseable due to its unexpected format.
   */
  #parseUrl(): {
    owner: string
    repository: string
    issueNumber: number
  } {
    const {owner, repository, issueNumber} =
      /\/(?<owner>[^/]+)\/(?<repository>[^/]+)\/issues\/(?<issueNumber>\d+)(?:[/?#]|$)/.exec(this.#url)?.groups || {}
    if (!owner || !repository || !issueNumber) {
      throw new Error(`Could not parse issue URL: ${this.#url}`)
    }
    return {owner, repository, issueNumber: Number(issueNumber)}
  }
}
