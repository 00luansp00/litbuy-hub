import { PrismaService } from '../database/prisma.service';
import { PaidOrderActivationService } from './paid-order-activation.service';

async function main() {
  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    const processed = await new PaidOrderActivationService(prisma).processBatch();
    process.stdout.write(`${JSON.stringify({ processed })}\n`);
  } finally {
    await prisma.$disconnect();
  }
}
void main();
