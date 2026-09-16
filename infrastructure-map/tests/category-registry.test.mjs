import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_CATEGORIES,
  createCategoryRegistry,
  getCategory,
  resolvePinColor,
  suggestCategoryId,
  validateCategory
} from '../src/domain/category-registry.js';
import { importLegacyEditorData } from '../src/domain/publication-schema.js';

test('required initial category colors are locked', () => {
  const registry = createCategoryRegistry();
  assert.equal(getCategory(registry, 'generator').color, '#D32F2F');
  assert.equal(getCategory(registry, 'water-quality-pump').color, '#1976D2');
});

test('default category ids are unique and valid', () => {
  const registry = createCategoryRegistry(DEFAULT_CATEGORIES);
  assert.equal(registry.size, DEFAULT_CATEGORIES.length);
  for (const category of registry.values()) assert.deepEqual(validateCategory(category), category);
});

test('published pin color is retained when valid', () => {
  const registry = createCategoryRegistry();
  assert.equal(resolvePinColor(registry, 'generator', '#AA0000'), '#AA0000');
  assert.equal(resolvePinColor(registry, 'generator', ''), '#D32F2F');
});

test('equipment type suggestions recognize generators and water-quality pumps', () => {
  assert.equal(suggestCategoryId('Diesel generator'), 'generator');
  assert.equal(suggestCategoryId('Water quality filtration pump'), 'water-quality-pump');
  assert.equal(suggestCategoryId('Unknown equipment'), 'other');
});

test('legacy editor pins import with category and resolved color', () => {
  const publication = importLegacyEditorData({
    project: { name: 'Test Map' },
    pins: [{
      id: 'g-1',
      name: 'Aquarium Generator',
      department: 'Operations',
      equipmentType: 'Generator',
      assetId: 'GEN-01',
      latitude: 35.1522,
      longitude: -89.9972,
      x: 246,
      y: 343,
      notes: 'Test asset'
    }]
  });
  assert.equal(publication.project.name, 'Test Map');
  assert.equal(publication.assets.length, 1);
  assert.equal(publication.assets[0].category_id, 'generator');
  assert.equal(publication.assets[0].pin_color, '#D32F2F');
  assert.equal(publication.assets[0].asset_tag, 'GEN-01');
});
