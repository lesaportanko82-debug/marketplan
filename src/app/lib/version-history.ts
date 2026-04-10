/**
 * Version History - saves snapshots of content edits to KV.
 *
 * Key pattern: `versions:{entityType}:{entityId}`
 * Each entry: { id, data, timestamp, label }
 * Max versions per entity: 20 (oldest pruned automatically)
 */

import { getData, saveData } from "./api";

export interface VersionEntry<T = any> {
  id: string;
  data: T;
  timestamp: string;
  label: string;
}

const MAX_VERSIONS = 20;

function versionsKey(entityType: string, entityId: string) {
  return `versions:${entityType}:${entityId}`;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Save a new version snapshot.
 */
export async function saveVersion<T>(
  entityType: string,
  entityId: string,
  data: T,
  label: string
): Promise<void> {
  const key = versionsKey(entityType, entityId);
  const existing = (await getData<VersionEntry<T>[]>(key)) || [];

  const entry: VersionEntry<T> = {
    id: genId(),
    data,
    timestamp: new Date().toISOString(),
    label,
  };

  // Prepend new, prune old
  const updated = [entry, ...existing].slice(0, MAX_VERSIONS);
  await saveData(key, updated);
}

/**
 * Get all versions for an entity.
 */
export async function getVersions<T>(
  entityType: string,
  entityId: string
): Promise<VersionEntry<T>[]> {
  const key = versionsKey(entityType, entityId);
  const data = await getData<VersionEntry<T>[]>(key);
  return data || [];
}

/**
 * Delete a specific version.
 */
export async function deleteVersion(
  entityType: string,
  entityId: string,
  versionId: string
): Promise<void> {
  const key = versionsKey(entityType, entityId);
  const existing = (await getData<VersionEntry[]>(key)) || [];
  const updated = existing.filter((v) => v.id !== versionId);
  await saveData(key, updated);
}