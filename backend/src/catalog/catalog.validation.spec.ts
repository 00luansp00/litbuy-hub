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
