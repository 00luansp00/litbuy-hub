/* eslint-disable no-control-regex */
import { UserStatus, type SellerApplicationStatus, type User } from '@prisma/client';

export const SELLER_RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'auth',
  'login',
  'cadastro',
  'suporte',
  'ajuda',
  'litbuy',
  'lit-buy',
  'vendedor',
  'vendedores',
  'loja',
  'lojas',
  'contato',
  'termos',
  'privacidade',
]);
export const SELLER_PUBLIC_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
] as const;
export type SellerPublicStatus = (typeof SELLER_PUBLIC_STATUSES)[number];

export const SELLER_REJECTION_CODES = [
  'INCOMPLETE_INFORMATION',
  'INVALID_STORE_NAME',
  'INVALID_STORE_SLUG',
  'PROHIBITED_ACTIVITY',
  'ACCOUNT_REQUIREMENTS_NOT_MET',
  'OTHER',
] as const;
export type SellerRejectionCode = (typeof SELLER_REJECTION_CODES)[number];

export function normalizeStoreName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}
export function normalizeSellerSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');
}
export function hasHtmlOrControl(value: string): boolean {
  return /[<>]|[\u0000-\u001F\u007F]/.test(value);
}
export function validateStoreName(value: string): string | null {
  const v = normalizeStoreName(value);
  if (v.length < 3 || v.length > 60 || hasHtmlOrControl(v)) return null;
  return v;
}
export function validateSellerSlug(value: string): string | null {
  const slug = normalizeSellerSlug(value);
  if (slug.length < 3 || slug.length > 40) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  if (SELLER_RESERVED_SLUGS.has(slug)) return null;
  return slug;
}
export function validateSellerDescription(value?: string | null): string | null | undefined {
  if (value == null || value.trim() === '') return null;
  const v = value.trim().replace(/\s+/g, ' ');
  if (v.length > 500 || hasHtmlOrControl(v)) return undefined;
  if (/https?:\/\/|www\.|\b\d{2}\s?9?\d{4}[-\s]?\d{4}\b|@/.test(v)) return undefined;
  return v;
}
export function isAtLeast18On(date: Date, now = new Date()): boolean {
  const min = new Date(Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()));
  return date <= min;
}
export function toPublicStatus(status: SellerApplicationStatus): string {
  return status.toLowerCase();
}
export function assertTransition(
  from: SellerApplicationStatus,
  to: SellerApplicationStatus,
): boolean {
  return [
    ['DRAFT', 'SUBMITTED'],
    ['SUBMITTED', 'UNDER_REVIEW'],
    ['SUBMITTED', 'APPROVED'],
    ['UNDER_REVIEW', 'APPROVED'],
    ['SUBMITTED', 'REJECTED'],
    ['UNDER_REVIEW', 'REJECTED'],
    ['REJECTED', 'DRAFT'],
  ].some(([a, b]) => a === from && b === to);
}
export function requirementsFor(
  user: Pick<User, 'status' | 'emailVerifiedAt' | 'phoneVerifiedAt' | 'birthDate'>,
  version: string,
) {
  return {
    emailVerified: !!user.emailVerifiedAt,
    phoneVerified: !!user.phoneVerifiedAt,
    ageEligible: isAtLeast18On(user.birthDate),
    sellerAgreementVersion: version,
    accountActive: user.status === UserStatus.ACTIVE,
  };
}
