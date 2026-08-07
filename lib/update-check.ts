import { formatDisplayVersion, isVersionNewer, parseSemanticVersion } from './version-utils.ts'

export const RELEASE_REPOSITORY_URL = 'https://github.com/hxhb/baby-feed'
export const RELEASES_URL = `${RELEASE_REPOSITORY_URL}/releases`
export const LATEST_RELEASE_API_URL = 'https://api.github.com/repos/hxhb/baby-feed/releases/latest'
export const RELEASE_CACHE_SECONDS = 60 * 60
export const RELEASE_REQUEST_TIMEOUT_MS = 5_000

interface GitHubRequestInit extends RequestInit {
  next?: {
    revalidate: number
  }
}

export type ReleaseFetcher = (input: string, init?: GitHubRequestInit) => Promise<Response>

interface GitHubReleaseResponse {
  tag_name?: unknown
  name?: unknown
  html_url?: unknown
  published_at?: unknown
  draft?: unknown
  prerelease?: unknown
}

export interface UpdateCheckResult {
  currentVersion: string
  latestVersion: string
  updateAvailable: boolean
  releaseName: string
  releaseUrl: string
  publishedAt: string | null
}

export type UpdateCheckErrorCode = 'RATE_LIMITED' | 'NO_RELEASE' | 'INVALID_RELEASE' | 'UPSTREAM_ERROR'

export class UpdateCheckError extends Error {
  readonly code: UpdateCheckErrorCode

  constructor(code: UpdateCheckErrorCode, message: string) {
    super(message)
    this.name = 'UpdateCheckError'
    this.code = code
  }
}

function getReleaseUrl(tagName: string, value: unknown): string {
  if (typeof value === 'string') {
    try {
      const url = new URL(value)
      if (
        url.protocol === 'https:'
        && url.hostname === 'github.com'
        && url.pathname.toLowerCase().startsWith('/hxhb/baby-feed/releases/')
      ) {
        return url.toString()
      }
    } catch {
      // Fall back to a repository-scoped URL below.
    }
  }

  return `${RELEASES_URL}/tag/${encodeURIComponent(tagName)}`
}

function getPublishedAt(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return Number.isNaN(Date.parse(value)) ? null : value
}

export async function checkForUpdates(
  currentVersionNumber: string,
  fetcher: ReleaseFetcher = fetch,
): Promise<UpdateCheckResult> {
  const currentVersion = formatDisplayVersion(currentVersionNumber)
  if (!currentVersion) {
    throw new UpdateCheckError('INVALID_RELEASE', 'Current application version is invalid')
  }

  const response = await fetcher(LATEST_RELEASE_API_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': `baby-feed/${currentVersionNumber}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    next: { revalidate: RELEASE_CACHE_SECONDS },
    signal: AbortSignal.timeout(RELEASE_REQUEST_TIMEOUT_MS),
  })

  if (response.status === 403 || response.status === 429) {
    throw new UpdateCheckError('RATE_LIMITED', 'GitHub release API rate limit exceeded')
  }
  if (response.status === 404) {
    throw new UpdateCheckError('NO_RELEASE', 'No published GitHub release was found')
  }
  if (!response.ok) {
    throw new UpdateCheckError('UPSTREAM_ERROR', `GitHub release API returned ${response.status}`)
  }

  let release: GitHubReleaseResponse
  try {
    const parsed: unknown = await response.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Release response is not an object')
    }
    release = parsed as GitHubReleaseResponse
  } catch {
    throw new UpdateCheckError('INVALID_RELEASE', 'GitHub release API returned invalid JSON')
  }

  if (release.draft === true || release.prerelease === true || typeof release.tag_name !== 'string') {
    throw new UpdateCheckError('INVALID_RELEASE', 'GitHub release API returned an unsupported release')
  }

  const tagName = release.tag_name.trim()
  if (!parseSemanticVersion(tagName)) {
    throw new UpdateCheckError('INVALID_RELEASE', 'Latest release tag is not a semantic version')
  }

  const latestVersion = formatDisplayVersion(tagName) as string
  const releaseName = typeof release.name === 'string' && release.name.trim()
    ? release.name.trim()
    : latestVersion

  return {
    currentVersion,
    latestVersion,
    updateAvailable: isVersionNewer(tagName, currentVersionNumber),
    releaseName,
    releaseUrl: getReleaseUrl(tagName, release.html_url),
    publishedAt: getPublishedAt(release.published_at),
  }
}
