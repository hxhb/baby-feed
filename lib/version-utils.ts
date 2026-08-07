export interface SemanticVersion {
  major: number
  minor: number
  patch: number
  prerelease: string[]
  buildMetadata: string | null
}

const VERSION_PATTERN = /^[vV]?(\d+)\.(\d+)(?:\.(\d+))?(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/

function parseNumericIdentifier(value: string): number | null {
  if (value.length > 1 && value.startsWith('0')) return null

  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

export function parseSemanticVersion(value: string): SemanticVersion | null {
  const match = VERSION_PATTERN.exec(value.trim())
  if (!match) return null

  const major = parseNumericIdentifier(match[1])
  const minor = parseNumericIdentifier(match[2])
  const patch = parseNumericIdentifier(match[3] ?? '0')
  if (major === null || minor === null || patch === null) return null

  const prerelease = match[4]?.split('.') ?? []
  if (prerelease.some(identifier => /^\d+$/.test(identifier) && parseNumericIdentifier(identifier) === null)) {
    return null
  }

  return {
    major,
    minor,
    patch,
    prerelease,
    buildMetadata: match[5] ?? null,
  }
}

export function formatDisplayVersion(value: string): string | null {
  const parsed = parseSemanticVersion(value)
  if (!parsed) return null

  const canOmitPatch = parsed.patch === 0
    && parsed.prerelease.length === 0
    && parsed.buildMetadata === null
  const core = canOmitPatch
    ? `${parsed.major}.${parsed.minor}`
    : `${parsed.major}.${parsed.minor}.${parsed.patch}`
  const prerelease = parsed.prerelease.length > 0 ? `-${parsed.prerelease.join('.')}` : ''
  const buildMetadata = parsed.buildMetadata ? `+${parsed.buildMetadata}` : ''

  return `v${core}${prerelease}${buildMetadata}`
}

function comparePrereleaseIdentifiers(left: string, right: string): number {
  const leftIsNumeric = /^\d+$/.test(left)
  const rightIsNumeric = /^\d+$/.test(right)

  if (leftIsNumeric && rightIsNumeric) {
    return Number(left) - Number(right)
  }
  if (leftIsNumeric) return -1
  if (rightIsNumeric) return 1
  if (left === right) return 0
  return left < right ? -1 : 1
}

export function compareSemanticVersions(leftValue: string, rightValue: string): number | null {
  const left = parseSemanticVersion(leftValue)
  const right = parseSemanticVersion(rightValue)
  if (!left || !right) return null

  for (const key of ['major', 'minor', 'patch'] as const) {
    if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1
  }

  if (left.prerelease.length === 0 && right.prerelease.length === 0) return 0
  if (left.prerelease.length === 0) return 1
  if (right.prerelease.length === 0) return -1

  const identifierCount = Math.max(left.prerelease.length, right.prerelease.length)
  for (let index = 0; index < identifierCount; index += 1) {
    const leftIdentifier = left.prerelease[index]
    const rightIdentifier = right.prerelease[index]
    if (leftIdentifier === undefined) return -1
    if (rightIdentifier === undefined) return 1

    const comparison = comparePrereleaseIdentifiers(leftIdentifier, rightIdentifier)
    if (comparison !== 0) return comparison < 0 ? -1 : 1
  }

  return 0
}

export function isVersionNewer(candidate: string, current: string): boolean {
  return compareSemanticVersions(candidate, current) === 1
}
