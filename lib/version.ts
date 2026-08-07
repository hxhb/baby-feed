import packageMetadata from '../package.json'
import { formatDisplayVersion, parseSemanticVersion } from './version-utils'

export const CURRENT_VERSION_NUMBER = packageMetadata.version

if (!parseSemanticVersion(CURRENT_VERSION_NUMBER)) {
  throw new Error(`package.json contains an invalid version: ${CURRENT_VERSION_NUMBER}`)
}

export const CURRENT_VERSION = formatDisplayVersion(CURRENT_VERSION_NUMBER) as string
