import {
  PrismaClient,
  PlatformRole,
  SecurityEventOutcome,
  SecurityEventType,
} from '@prisma/client';
import { normalizeEmail } from '../src/auth/auth.utils';

const prisma = new PrismaClient();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const action = process.argv[2];
  const roleRaw = arg('role');
  const userId = arg('user-id');
  const email = arg('email');
  const confirmed = process.argv.includes('--confirm');
  if (action !== 'grant' && action !== 'revoke') throw new Error('Use grant ou revoke.');
  if (!confirmed) throw new Error('Inclua --confirm para executar.');
  if (!roleRaw || !(roleRaw in PlatformRole))
    throw new Error('Role inválido. Use BUYER, SELLER ou ADMIN.');
  const role = roleRaw as PlatformRole;
  if (action === 'revoke' && role === PlatformRole.BUYER)
    throw new Error('Revogação de BUYER está desabilitada.');
  if (!!userId === !!email)
    throw new Error('Informe exatamente --user-id=<uuid> ou --email=<email>.');
  if (userId && !uuid.test(userId)) throw new Error('UUID inválido.');
  const user = await prisma.user.findUnique({
    where: userId ? { id: userId } : { email: normalizeEmail(email!) },
    select: { id: true },
  });
  if (!user) throw new Error('Usuário não encontrado.');
  if (action === 'grant') {
    await prisma.$transaction(async (tx) => {
      await tx.userRoleAssignment.upsert({
        where: { userId_role: { userId: user.id, role } },
        create: { userId: user.id, role },
        update: {},
      });
      await tx.securityEvent.create({
        data: {
          userId: user.id,
          eventType: SecurityEventType.ROLE_GRANTED,
          outcome: SecurityEventOutcome.SUCCESS,
          metadata: { role, origin: 'cli', result: 'granted', targetUserId: user.id },
        },
      });
    });
  } else {
    await prisma.$transaction(async (tx) => {
      const result = await tx.userRoleAssignment.deleteMany({ where: { userId: user.id, role } });
      await tx.securityEvent.create({
        data: {
          userId: user.id,
          eventType: SecurityEventType.ROLE_REVOKED,
          outcome: SecurityEventOutcome.SUCCESS,
          metadata: {
            role,
            origin: 'cli',
            result: result.count > 0 ? 'revoked' : 'unchanged',
            targetUserId: user.id,
          },
        },
      });
    });
  }
  console.log(JSON.stringify({ ok: true, action, role, userId: user.id }));
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Erro ao gerenciar papel.');
    process.exit(1);
  });
