const sensitiveKeys =
  /authorization|cookie|csrf|password|code|token|secret|pepper|grant|recovery|phone|email/i;

export function redactValue(value: unknown, key = ''): unknown {
  if (value === null || value === undefined) return value;
  if (sensitiveKeys.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map((item) => redactValue(item, key));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        redactValue(entryValue, entryKey),
      ]),
    );
  }
  return value;
}
