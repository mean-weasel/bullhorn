import { readFileSync } from 'fs'
import { parse } from 'yaml'
import type { FixtureFile, RefRegistry } from './types'

/** Read and parse a YAML fixture file. */
export function readFixture(filePath: string): FixtureFile {
  const raw = readFileSync(filePath, 'utf-8')
  const parsed = parse(raw)
  if (parsed === null || parsed === undefined) return {}
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Invalid fixture: expected a YAML mapping, got ${typeof parsed}`)
  }
  return parsed as FixtureFile
}

/**
 * Resolve relative timestamp patterns to ISO 8601 strings.
 * Patterns: "+1d 10:00" = tomorrow at 10:00 UTC, "+0d 09:00" = today at 09:00 UTC
 */
export function resolveTimestamp(pattern: string): string {
  const match = pattern.match(/^\+(\d+)d\s+(\d{1,2}):(\d{2})$/)
  if (!match) throw new Error(`Invalid timestamp pattern: ${pattern}`)
  const [, days, hours, minutes] = match
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + parseInt(days))
  date.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0)
  return date.toISOString()
}

/**
 * Resolve all `ref:` prefixed keys in an object using the registry.
 * e.g. { "ref:campaignId": "launch-week" } → { campaignId: "abc-123" }
 * Also strips the `_name` field and resolves timestamp patterns in `scheduledAt`.
 */
export function resolveRefs<T extends Record<string, unknown>>(
  raw: T,
  registry: RefRegistry
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(raw)) {
    if (key === '_name') continue

    if (key.startsWith('ref:')) {
      const targetField = key.slice(4)
      const refName = value as string
      const id = registry.get(refName)
      if (!id) throw new Error(`Unresolved ref "${refName}" for field "${targetField}"`)
      if (id === '__FAILED__')
        throw new Error(`Skipped: depends on "${refName}" which failed to create`)
      resolved[targetField] = id
    } else if (key === 'scheduledAt' && typeof value === 'string' && value.startsWith('+')) {
      resolved[key] = resolveTimestamp(value)
    } else {
      resolved[key] = value
    }
  }

  return resolved
}
