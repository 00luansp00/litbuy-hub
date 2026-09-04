type PrismaErrorShape = {
  code?: unknown;
  meta?: {
    code?: unknown;
  };
};

export function isSerializationFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const candidate = error as PrismaErrorShape;
  return (
    candidate.code === 'P2034' || (candidate.code === 'P2010' && candidate.meta?.code === '40001')
  );
}
