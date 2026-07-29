export type DemoCommand = 'seed' | 'verify' | 'reset';

export class DemoDataError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

const allowedDatabaseHosts = new Set(['localhost', '127.0.0.1', 'postgres']);
const allowedStorageHosts = new Set(['localhost', '127.0.0.1', 'minio']);

export function parseDemoCommand(argv: string[]) {
  const command = argv[0] as DemoCommand | undefined;
  if (!command || !['seed', 'verify', 'reset'].includes(command))
    throw new DemoDataError('DEMO_DATA_COMMAND_INVALID');
  if (command === 'reset' && !argv.includes('--confirm'))
    throw new DemoDataError('DEMO_DATA_CONFIRMATION_REQUIRED');
  return command;
}

export function assertDemoEnvironment(env: NodeJS.ProcessEnv) {
  if (env.NODE_ENV === 'production') throw new DemoDataError('DEMO_DATA_PRODUCTION_REFUSED');
  if (env.DEMO_DATA_ENABLED !== 'true') throw new DemoDataError('DEMO_DATA_DISABLED');
  const required = [
    'DATABASE_URL',
    'DEMO_USER_PASSWORD',
    'PRODUCT_IMAGE_S3_ENDPOINT',
    'PRODUCT_IMAGE_S3_BUCKET',
    'PRODUCT_IMAGE_S3_ACCESS_KEY',
    'PRODUCT_IMAGE_S3_SECRET_KEY',
  ];
  if (required.some((key) => !env[key])) throw new DemoDataError('DEMO_DATA_ENV_MISSING');
  let database: URL;
  let storage: URL;
  try {
    database = new URL(env.DATABASE_URL!);
  } catch {
    throw new DemoDataError('DEMO_DATA_DATABASE_REFUSED');
  }
  const databaseName = database.pathname.slice(1).toLowerCase();
  if (
    !allowedDatabaseHosts.has(database.hostname) ||
    !/(local|test|demo)/.test(databaseName) ||
    /prod(uction)?/.test(databaseName)
  )
    throw new DemoDataError('DEMO_DATA_DATABASE_REFUSED');
  try {
    storage = new URL(env.PRODUCT_IMAGE_S3_ENDPOINT!);
  } catch {
    throw new DemoDataError('DEMO_DATA_STORAGE_REFUSED');
  }
  if (!allowedStorageHosts.has(storage.hostname))
    throw new DemoDataError('DEMO_DATA_STORAGE_REFUSED');
}
