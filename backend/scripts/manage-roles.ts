import { PrismaClient, PlatformRole } from '@prisma/client';
import { normalizeEmail } from '../src/auth/auth.utils';
import { grantPlatformRole, revokePlatformRole } from '../src/auth/platform-role-operations';

export type ParsedRoleCommand = {
  action: 'grant' | 'revoke';
  role: PlatformRole;
  userId?: string;
  email?: string;
};

const prisma = new PrismaClient();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function arg(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return args.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

export function parseRoleCommand(args: string[]): ParsedRoleCommand {
  const action = args[0];
  const roleRaw = arg(args, 'role');
  const userId = arg(args, 'user-id');
  const email = arg(args, 'email');
  if (action !== 'grant' && action !== 'revoke') throw new Error('INVALID_ACTION');
  if (!args.includes('--confirm')) throw new Error('CONFIRMATION_REQUIRED');
  if (!roleRaw || !(roleRaw in PlatformRole)) throw new Error('INVALID_ROLE');
  const role = roleRaw as PlatformRole;
  if (action === 'revoke' && role === PlatformRole.BUYER)
    throw new Error('BUYER_ROLE_REVOKE_DISABLED');
  if (!!userId === !!email) throw new Error('EXACTLY_ONE_USER_IDENTIFIER_REQUIRED');
  if (userId && !uuid.test(userId)) throw new Error('INVALID_USER_ID');
  return { action, role, userId, email: email ? normalizeEmail(email) : undefined };
}

export async function executeRoleCommand(parsed: ParsedRoleCommand) {
  const user = await prisma.user.findUnique({
    where: parsed.userId ? { id: parsed.userId } : { email: parsed.email! },
    select: { id: true },
  });
  if (!user) throw new Error('USER_NOT_FOUND');
  const operation =
    parsed.action === 'grant'
      ? await grantPlatformRole(prisma, user.id, parsed.role, 'cli')
      : await revokePlatformRole(prisma, user.id, parsed.role, 'cli');
  return { ok: true, action: parsed.action, role: parsed.role, userId: user.id, ...operation };
}

async function main() {
  const parsed = parseRoleCommand(process.argv.slice(2));
  const result = await executeRoleCommand(parsed);
  console.log(JSON.stringify(result));
}

if (require.main === module) {
  main()
    .finally(() => prisma.$disconnect())
    .catch((error) => {
      console.error(error instanceof Error ? error.message : 'ROLE_OPERATION_FAILED');
      process.exit(1);
    });
}
