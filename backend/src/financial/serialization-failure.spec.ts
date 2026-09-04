import { isSerializationFailure } from './serialization-failure';

describe('isSerializationFailure', () => {
  it('recognizes Prisma transaction serialization failures', () => {
    expect(isSerializationFailure({ code: 'P2034' })).toBe(true);
  });

  it('recognizes a structural raw-query PostgreSQL serialization failure', () => {
    expect(isSerializationFailure({ code: 'P2010', meta: { code: '40001' } })).toBe(true);
  });

  it('does not recognize other raw-query SQLSTATE values', () => {
    expect(isSerializationFailure({ code: 'P2010', meta: { code: '23505' } })).toBe(false);
  });

  it('does not recognize arbitrary objects', () => {
    expect(isSerializationFailure({ code: '40001' })).toBe(false);
  });

  it('does not recognize ordinary errors', () => {
    expect(isSerializationFailure(new Error('not retryable'))).toBe(false);
  });
});
