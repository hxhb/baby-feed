import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  compareSemanticVersions,
  formatDisplayVersion,
  isVersionNewer,
  parseSemanticVersion,
} from '../lib/version-utils.ts'
import {
  checkForUpdates,
  LATEST_RELEASE_API_URL,
  RELEASE_CACHE_SECONDS,
  RELEASES_URL,
  UpdateCheckError,
} from '../lib/update-check.ts'

test('package metadata is the canonical v0.22 version source', () => {
  const packageMetadata = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

  assert.equal(packageMetadata.version, '0.22.0')
  assert.equal(formatDisplayVersion(packageMetadata.version), 'v0.22')
})

test('semantic versions are normalized and compared numerically', () => {
  assert.equal(formatDisplayVersion('v0.21.0'), 'v0.21')
  assert.equal(formatDisplayVersion('0.21.1'), 'v0.21.1')
  assert.equal(formatDisplayVersion('0.21.0-beta.2'), 'v0.21.0-beta.2')
  assert.equal(compareSemanticVersions('v0.10', 'v0.9.9'), 1)
  assert.equal(compareSemanticVersions('1.0.0-beta.2', '1.0.0-beta.10'), -1)
  assert.equal(compareSemanticVersions('1.0.0+one', '1.0.0+two'), 0)
  assert.equal(isVersionNewer('v0.22', '0.21.0'), true)
  assert.equal(isVersionNewer('v0.20.9', '0.21.0'), false)
})

test('malformed and ambiguous versions are rejected', () => {
  assert.equal(parseSemanticVersion('release-0.22'), null)
  assert.equal(parseSemanticVersion('0.021.0'), null)
  assert.equal(parseSemanticVersion('1.0.0-beta.01'), null)
  assert.equal(compareSemanticVersions('invalid', '0.21.0'), null)
})

test('GitHub release data is validated and converted into update information', async () => {
  let requestUrl = ''
  let requestInit
  const fetcher = async (url, init) => {
    requestUrl = url
    requestInit = init
    return new Response(JSON.stringify({
      tag_name: 'v0.22.0',
      name: 'Baby Feed v0.22',
      html_url: 'https://github.com/hxhb/baby-feed/releases/tag/v0.22.0',
      published_at: '2026-08-08T01:00:00.000Z',
      draft: false,
      prerelease: false,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  const result = await checkForUpdates('0.21.0', fetcher)

  assert.equal(requestUrl, LATEST_RELEASE_API_URL)
  assert.equal(requestInit.next.revalidate, RELEASE_CACHE_SECONDS)
  assert.equal(requestInit.headers.Accept, 'application/vnd.github+json')
  assert.ok(requestInit.signal instanceof AbortSignal)
  assert.deepEqual(result, {
    currentVersion: 'v0.21',
    latestVersion: 'v0.22',
    updateAvailable: true,
    releaseName: 'Baby Feed v0.22',
    releaseUrl: 'https://github.com/hxhb/baby-feed/releases/tag/v0.22.0',
    publishedAt: '2026-08-08T01:00:00.000Z',
  })
})

test('untrusted release links fall back to this repository', async () => {
  const result = await checkForUpdates('0.21.0', async () => new Response(JSON.stringify({
    tag_name: 'v0.21.0',
    name: '',
    html_url: 'https://example.com/download',
    published_at: 'not-a-date',
    draft: false,
    prerelease: false,
  }), { status: 200 }))

  assert.equal(result.updateAvailable, false)
  assert.equal(result.releaseName, 'v0.21')
  assert.equal(result.releaseUrl, `${RELEASES_URL}/tag/v0.21.0`)
  assert.equal(result.publishedAt, null)
})

test('rate limits and malformed release tags fail closed', async () => {
  await assert.rejects(
    checkForUpdates('0.21.0', async () => new Response(null, { status: 429 })),
    error => error instanceof UpdateCheckError && error.code === 'RATE_LIMITED',
  )
  await assert.rejects(
    checkForUpdates('0.21.0', async () => new Response(JSON.stringify({
      tag_name: 'latest',
      draft: false,
      prerelease: false,
    }), { status: 200 })),
    error => error instanceof UpdateCheckError && error.code === 'INVALID_RELEASE',
  )
  await assert.rejects(
    checkForUpdates('0.21.0', async () => new Response('null', { status: 200 })),
    error => error instanceof UpdateCheckError && error.code === 'INVALID_RELEASE',
  )
})
