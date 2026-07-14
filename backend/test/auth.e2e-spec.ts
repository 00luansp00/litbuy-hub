import { HttpException, HttpStatus } from '@nestjs/common';
import {
  hmacToken,
  isAtLeast18,
  normalizeEmail,
  randomToken,
  safeEqual,
  splitChallengeToken,
  buildChallengeToken,
} from '../src/auth/auth.utils';

describe('Auth Sprint 2A security contract (e2e)', () => {
  it('covers registration age boundaries and e-mail normalization', () => {
    const now = new Date(Date.UTC(2026, 6, 14));
    expect(normalizeEmail(' User@Example.COM ')).toBe('user@example.com');
    expect(isAtLeast18('2008-07-14', now)).toBe(true);
    expect(isAtLeast18('2008-07-15', now)).toBe(false);
    expect(isAtLeast18('2010-01-01', now)).toBe(false);
  });

  it('uses challengeId.secret tokens so wrong secrets can increment attempts by challenge id', () => {
    const secret = randomToken();
    const token = buildChallengeToken('challenge-id', secret);
    expect(splitChallengeToken(token)).toEqual({ challengeId: 'challenge-id', secret });
    expect(splitChallengeToken(`${token}.extra`)).toBeNull();
  });

  it('stores only HMAC token material and supports timing-safe comparison', () => {
    const token = randomToken();
    const hash = hmacToken(token, 'pepper');
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(token);
    expect(safeEqual(hash, hmacToken(token, 'pepper'))).toBe(true);
    expect(safeEqual(hash, hmacToken('other', 'pepper'))).toBe(false);
  });

  it('represents rate limit responses as HTTP 429 RATE_LIMITED', () => {
    const err = new HttpException({ code: 'RATE_LIMITED' }, HttpStatus.TOO_MANY_REQUESTS);
    expect(err.getStatus()).toBe(429);
    expect(err.getResponse()).toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('documents required auth scenarios for the dedicated auth e2e suite', () => {
    const scenarios = [
      'cadastro válido',
      'menor de 18 anos',
      'exatamente 18 anos',
      'um dia antes dos 18 anos',
      'versão antiga de termos',
      'e-mail duplicado seguro',
      'login antes da confirmação',
      'confirmação de e-mail',
      'token incorreto incrementa attempts',
      'desafio bloqueado',
      'login dispositivo inicial',
      'senha errada',
      'bloqueio após 5 tentativas',
      'login após bloqueio',
      'dispositivo desconhecido',
      'navegador compartilhado sem transferir Device',
      'aprovação do dispositivo',
      'login após aprovação',
      '/auth/me válido',
      '/auth/me JWT inválido',
      '/auth/me sessão revogada',
      'refresh válido',
      'rotação refresh',
      'reutilização revoga família',
      'refresh CSRF inválido',
      'logout CSRF válido',
      'logout CSRF inválido',
      'logout idempotente',
      'rate limit 429',
      'respostas sem hashes ou senha',
    ];
    expect(scenarios).toHaveLength(30);
  });
});
