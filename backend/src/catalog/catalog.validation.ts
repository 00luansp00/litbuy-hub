/* eslint-disable no-control-regex */
import { BadRequestException } from '@nestjs/common';
import type { CatalogAttributeInputType } from '@prisma/client';
import { CATALOG_ALLOWED_ICON_KEYS, CATALOG_RESERVED_SLUGS } from './catalog.constants';

export function normalizeCatalogSlugFormat(v: string) {
  const s = (v ?? '').trim().toLowerCase();
  if (!/^(?!.*--)[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(s))
    throw new BadRequestException({ code: 'CATALOG_SLUG_INVALID' });
  return s;
}

export function validateNewCatalogSlug(v: string) {
  const s = normalizeCatalogSlugFormat(v);
  if (CATALOG_RESERVED_SLUGS.has(s))
    throw new BadRequestException({ code: 'CATALOG_SLUG_INVALID' });
  return s;
}

export const normalizeSlug = validateNewCatalogSlug;

export function normalizeName(v: string) {
  const s = (v ?? '').trim().replace(/\s+/g, ' ');
  if (s.length < 2 || s.length > 80 || /[<>]|[\u0000-\u001f\u007f]/.test(s))
    throw new BadRequestException({ code: 'CATALOG_NAME_INVALID' });
  return s;
}
export function normalizeDescription(v?: string | null) {
  if (v == null || v === '') return null;
  const s = v.trim().replace(/\s+/g, ' ');
  if (s.length > 300 || /[<>]|[\u0000-\u001f\u007f]/.test(s))
    throw new BadRequestException({ code: 'CATALOG_DESCRIPTION_INVALID' });
  return s;
}
export function normalizeIcon(v?: string | null) {
  if (v == null || v === '') return null;
  if (!CATALOG_ALLOWED_ICON_KEYS.includes(v as never))
    throw new BadRequestException({ code: 'CATALOG_ICON_INVALID' });
  return v;
}
export function normalizeColor(v?: string | null) {
  if (v == null || v === '') return null;
  const s = v.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(s)) throw new BadRequestException({ code: 'CATALOG_COLOR_INVALID' });
  return s;
}
export function normalizeOrder(v?: number) {
  const n = v ?? 0;
  if (!Number.isInteger(n) || n < -100000 || n > 100000)
    throw new BadRequestException({ code: 'CATALOG_SORT_ORDER_INVALID' });
  return n;
}
export function normalizeKey(v: string) {
  const raw = (v ?? '').trim().toLowerCase();
  const hasInvalidFormat =
    raw.length < 2 ||
    raw.length > 60 ||
    /[<>]|[\u0000-\u001f\u007f]/.test(raw) ||
    !/^[a-z0-9_-]+$/.test(raw) ||
    /^[_-]/.test(raw) ||
    /[_-]$/.test(raw) ||
    /[_-]{2,}/.test(raw);

  if (hasInvalidFormat) throw new BadRequestException({ code: 'CATALOG_ATTRIBUTE_KEY_INVALID' });

  return raw.replace(/-/g, '_');
}
export function normalizeOptions(inputType: CatalogAttributeInputType, opts?: string[]) {
  const arr = [...new Set((opts ?? []).map((o) => normalizeName(o)))];
  if (inputType === 'SELECT' && arr.length === 0)
    throw new BadRequestException({ code: 'CATALOG_SELECT_OPTIONS_REQUIRED' });
  if (inputType !== 'SELECT' && arr.length > 0)
    throw new BadRequestException({ code: 'CATALOG_SELECT_OPTIONS_NOT_ALLOWED' });
  if (arr.length > 40) throw new BadRequestException({ code: 'CATALOG_SELECT_OPTIONS_INVALID' });
  return arr;
}
