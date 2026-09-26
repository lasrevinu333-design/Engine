import {
  DEFAULT_CATEGORIES,
  createCategoryRegistry,
  resolvePinColor,
  suggestCategoryId
} from './category-registry.js';
import { MAP_ID } from '../config/calibration.js';

export const PUBLICATION_SCHEMA_VERSION = 1;
export const STORAGE_NAMESPACE = 'memphis-zoo-infrastructure-map-v1';

function text(value) {
  return String(value ?? '').trim();
}

function finiteOrNull(value) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function createEmptyPublication(projectName = 'Memphis Zoo Infrastructure Map') {
  return {
    schema_version: PUBLICATION_SCHEMA_VERSION,
    map_id: MAP_ID,
    publication_id: null,
    publication_version: 0,
    published_at: null,
    project: { name: text(projectName) || 'Memphis Zoo Infrastructure Map' },
    categories: DEFAULT_CATEGORIES.map((category) => ({ ...category })),
    assets: []
  };
}

export function normalizeLegacyPin(pin, options = {}) {
  if (!pin || typeof pin !== 'object') throw new TypeError('Pin must be an object.');
  const registry = options.registry || createCategoryRegistry(options.categories || DEFAULT_CATEGORIES);
  const equipmentType = text(pin.equipment_type_label || pin.equipmentType || pin.type);
  const categoryId = text(pin.category_id || pin.categoryId) || suggestCategoryId(equipmentType);
  const latitude = finiteOrNull(pin.latitude ?? pin.lat);
  const longitude = finiteOrNull(pin.longitude ?? pin.lon ?? pin.lng);
  const mapX = finiteOrNull(pin.map_x ?? pin.x);
  const mapY = finiteOrNull(pin.map_y ?? pin.y);
  if (latitude == null || longitude == null) throw new Error(`Pin ${text(pin.name) || '(unnamed)'} is missing valid coordinates.`);
  if (mapX == null || mapY == null) throw new Error(`Pin ${text(pin.name) || '(unnamed)'} is missing a valid calibrated map position.`);

  return {
    id: text(pin.id) || cryptoSafeId(),
    name: text(pin.name) || 'Unnamed location',
    department: text(pin.department) || 'Unassigned',
    category_id: categoryId,
    equipment_type_label: equipmentType,
    asset_tag: text(pin.asset_tag || pin.assetId),
    latitude,
    longitude,
    map_x: mapX,
    map_y: mapY,
    pin_color: resolvePinColor(registry, categoryId, pin.pin_color || pin.color),
    notes_internal: text(pin.notes_internal || pin.notes),
    notes_contractor: text(pin.notes_contractor),
    coordinate_source: text(pin.coordinate_source) || 'legacy-import',
    verification_status: text(pin.verification_status) || 'unverified',
    created_at: text(pin.created_at || pin.createdAt) || null,
    updated_at: text(pin.updated_at || pin.updatedAt) || null,
    updated_by: text(pin.updated_by) || null
  };
}

export function importLegacyEditorData(payload) {
  if (!payload || typeof payload !== 'object') throw new TypeError('Publication payload must be an object.');
  const categories = Array.isArray(payload.categories) && payload.categories.length
    ? payload.categories
    : DEFAULT_CATEGORIES;
  const registry = createCategoryRegistry(categories);
  const pins = Array.isArray(payload.pins) ? payload.pins : Array.isArray(payload.assets) ? payload.assets : [];
  const publication = createEmptyPublication(payload.project?.name || payload.project?.title);
  publication.categories = [...registry.values()].map((category) => ({ ...category }));
  publication.assets = pins.map((pin) => normalizeLegacyPin(pin, { registry }));
  return publication;
}

function cryptoSafeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `asset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
