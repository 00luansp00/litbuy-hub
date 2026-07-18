import { SellerApplicationStatus } from '@prisma/client';
import {
  assertTransition,
  isAtLeast18On,
  normalizeSellerSlug,
  normalizeStoreName,
  validateSellerDescription,
  validateSellerSlug,
  validateStoreName,
} from './seller-onboarding.utils';

describe('seller onboarding validation utils', () => {
  it('normalizes and validates store names', () => {
    expect(normalizeStoreName('  Minha   Loja  ')).toBe('Minha Loja');
    expect(validateStoreName('  Minha   Loja  ')).toBe('Minha Loja');
    expect(validateStoreName(' <b> ')).toBeNull();
  });
  it('normalizes slugs and blocks reserved/invalid slugs', () => {
    expect(normalizeSellerSlug('Minha Loja')).toBe('minha-loja');
    expect(validateSellerSlug('Minha Loja')).toBe('minha-loja');
    expect(validateSellerSlug('admin')).toBeNull();
    expect(validateSellerSlug('-abc')).toBeNull();
    expect(validateSellerSlug('ab--cd')).toBeNull();
  });
  it('validates descriptions and age', () => {
    expect(validateSellerDescription(' texto simples ')).toBe('texto simples');
    expect(validateSellerDescription('acesse https://x.test')).toBeUndefined();
    expect(isAtLeast18On(new Date('2008-07-18'), new Date('2026-07-18'))).toBe(true);
    expect(isAtLeast18On(new Date('2008-07-19'), new Date('2026-07-18'))).toBe(false);
  });
  it('declares allowed transitions explicitly', () => {
    expect(assertTransition(SellerApplicationStatus.DRAFT, SellerApplicationStatus.SUBMITTED)).toBe(
      true,
    );
    expect(assertTransition(SellerApplicationStatus.APPROVED, SellerApplicationStatus.DRAFT)).toBe(
      false,
    );
  });
});
