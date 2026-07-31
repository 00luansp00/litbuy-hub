import { PrismaClient } from '@prisma/client';
import { OrderExpirationService } from './order-expiration.service';
async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await new OrderExpirationService(prisma as never).expire();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}
void main();
