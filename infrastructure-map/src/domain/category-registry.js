const HEX_COLOR = /^#[0-9A-F]{6}$/i;

export const DEFAULT_CATEGORIES = Object.freeze([
  Object.freeze({ id: 'generator', name: 'Generator', color: '#D32F2F', icon: 'bolt', description: 'Permanent, portable, and trailer-mounted generators.', active: true }),
  Object.freeze({ id: 'water-quality-pump', name: 'Water Quality Pump', color: '#1976D2', icon: 'droplets', description: 'Water-quality, circulation, filtration, and life-support pumps.', active: true }),
  Object.freeze({ id: 'electrical-meter', name: 'Electrical Meter', color: '#F9A825', icon: 'gauge', description: 'Utility and sub-meter locations.', active: true }),
  Object.freeze({ id: 'breaker-panel', name: 'Breaker / Distribution Panel', color: '#EF6C00', icon: 'panel-top', description: 'Breakers, disconnects, switchgear, and distribution panels.', active: true }),
  Object.freeze({ id: 'hvac-equipment', name: 'HVAC Equipment', color: '#7B1FA2', icon: 'fan', description: 'Air handlers, condensers, boilers, chillers, and controls.', active: true }),
  Object.freeze({ id: 'utility-shutoff', name: 'Water / Utility Shutoff', color: '#00897B', icon: 'valve', description: 'Water, gas, and other utility shutoff points.', active: true }),
  Object.freeze({ id: 'life-support', name: 'Life-Support Equipment', color: '#00838F', icon: 'heart-pulse', description: 'Animal life-support systems and critical support equipment.', active: true }),
  Object.freeze({ id: 'fire-emergency', name: 'Fire / Emergency Equipment', color: '#C2185B', icon: 'siren', description: 'Fire department connections, emergency equipment, and response assets.', active: true }),
  Object.freeze({ id: 'communications-controls', name: 'Communications / Controls', color: '#3949AB', icon: 'radio', description: 'Control panels, telemetry, communications, and automation assets.', active: true }),
  Object.freeze({ id: 'other', name: 'Other', color: '#616161', icon: 'map-pin', description: 'Infrastructure that does not yet have a dedicated category.', active: true })
]);

export function validateCategory(category) {
  if (!category || typeof category !== 'object') throw new TypeError('Category must be an object.');
  const id = String(category.id || '').trim();
  const name = String(category.name || '').trim();
  const color = String(category.color || '').trim().toUpperCase();
  const icon = String(category.icon || '').trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`Invalid category id: ${id || '(empty)'}`);
  if (!name) throw new Error(`Category ${id} requires a name.`);
  if (!HEX_COLOR.test(color)) throw new Error(`Category ${id} requires a six-digit hex color.`);
  if (!icon) throw new Error(`Category ${id} requires an icon identifier.`);
  return Object.freeze({
    id,
    name,
    color,
    icon,
    description: String(category.description || '').trim(),
    active: category.active !== false
  });
}

export function createCategoryRegistry(categories = DEFAULT_CATEGORIES) {
  const registry = new Map();
  for (const input of categories) {
    const category = validateCategory(input);
    if (registry.has(category.id)) throw new Error(`Duplicate category id: ${category.id}`);
    registry.set(category.id, category);
  }
  if (!registry.has('other')) throw new Error('Category registry requires an "other" fallback.');
  return registry;
}

export function getCategory(registry, categoryId) {
  if (!(registry instanceof Map)) throw new TypeError('Category registry must be a Map.');
  return registry.get(String(categoryId || '').trim()) || registry.get('other');
}

export function resolvePinColor(registry, categoryId, publishedColor = '') {
  const retained = String(publishedColor || '').trim().toUpperCase();
  if (HEX_COLOR.test(retained)) return retained;
  return getCategory(registry, categoryId).color;
}

export function suggestCategoryId(equipmentType = '') {
  const value = String(equipmentType).trim().toLowerCase();
  if (/generator|genset/.test(value)) return 'generator';
  if (/(water\s*quality|filtration|circulation|life\s*support).*pump|pump.*(water\s*quality|filtration|circulation|life\s*support)/.test(value)) return 'water-quality-pump';
  if (/meter/.test(value) && /electric|power|utility/.test(value)) return 'electrical-meter';
  if (/breaker|distribution\s*panel|switchgear|disconnect/.test(value)) return 'breaker-panel';
  if (/hvac|air\s*handler|condenser|chiller|boiler/.test(value)) return 'hvac-equipment';
  if (/shutoff|shut-off|valve/.test(value)) return 'utility-shutoff';
  if (/life\s*support/.test(value)) return 'life-support';
  if (/fire|emergency/.test(value)) return 'fire-emergency';
  if (/control|telemetry|radio|communications?/.test(value)) return 'communications-controls';
  return 'other';
}
