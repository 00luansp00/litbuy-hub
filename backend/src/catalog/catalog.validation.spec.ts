import { BadRequestException } from '@nestjs/common';
import { CatalogAttributeInputType } from '@prisma/client';
import {
  normalizeColor,
  normalizeDescription,
  normalizeIcon,
  normalizeKey,
  normalizeName,
  normalizeOptions,
  normalizeOrder,
  normalizeSlug,
} from './catalog.validation';
import { INPUT_TYPE_API, PRODUCT_TYPE_API } from './catalog.constants';

describe('catalog validation and mapping', () => {
  it('normalizes valid fields', () => {
    expect(normalizeSlug(' contas ')).toBe('contas');
    expect(normalizeName('  League   of Legends ')).toBe('League of Legends');
    expect(normalizeDescription(' texto simples ')).toBe('texto simples');
    expect(normalizeIcon('Gift')).toBe('Gift');
    expect(normalizeColor('#8b5cf6')).toBe('#8B5CF6');
    expect(normalizeOrder(10)).toBe(10);
    expect(normalizeKey('preco-unidade')).toBe('preco_unidade');
  });
  it('rejects reserved/unsafe fields', () => {
    for (const fn of [
      () => normalizeSlug('admin'),
      () => normalizeSlug('a--b'),
      () => normalizeName('<b>x</b>'),
      () => normalizeDescription('<script>'),
      () => normalizeIcon('NotLucide'),
      () => normalizeColor('url(x)'),
      () => normalizeOrder(200000),
    ])
      expect(fn).toThrow(BadRequestException);
  });

  it('normalizes canonical catalog attribute keys independently from slug validation', () => {
    expect(normalizeKey('preco_unidade')).toBe('preco_unidade');
    expect(normalizeKey('preco-unidade')).toBe('preco_unidade');
    expect(normalizeKey('skins_raras')).toBe('skins_raras');
    expect(normalizeKey(' race_attr_123 ')).toBe('race_attr_123');
    expect(normalizeKey('a1')).toBe('a1');
    expect(normalizeKey('a'.repeat(60))).toBe('a'.repeat(60));
  });

  it('rejects unsafe catalog attribute keys with a categorical error', () => {
    for (const key of [
      '_preco',
      'preco_',
      'preco__unidade',
      'preco--unidade',
      'preco_-unidade',
      'preco unidade',
      'Preço',
      '<script>',
      'a',
      'a'.repeat(61),
      'preco.unidade',
    ]) {
      try {
        normalizeKey(key);
        throw new Error(`Expected ${key} to be rejected`);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toEqual({
          code: 'CATALOG_ATTRIBUTE_KEY_INVALID',
        });
      }
    }
  });
  it('validates select options and enum public mapping', () => {
    expect(normalizeOptions(CatalogAttributeInputType.SELECT, ['BR', 'BR', 'NA'])).toEqual([
      'BR',
      'NA',
    ]);
    expect(() => normalizeOptions(CatalogAttributeInputType.SELECT, [])).toThrow(
      BadRequestException,
    );
    expect(() => normalizeOptions(CatalogAttributeInputType.TEXT, ['x'])).toThrow(
      BadRequestException,
    );
    expect(PRODUCT_TYPE_API.ACCOUNT.id).toBe('account');
    expect(INPUT_TYPE_API.SELECT).toBe('select');
  });
});
