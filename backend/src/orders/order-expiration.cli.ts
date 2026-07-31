import { PrismaService } from '../database/prisma.service';
import { OrderExpirationService } from './order-expiration.service';
async function main() {
  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    const result = await new OrderExpirationService(prisma).expire();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}
void main();
