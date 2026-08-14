import { PrismaService } from '../database/prisma.service';
import { OrderFulfillmentService } from './order-fulfillment.service';

async function main() {
  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    const processed = await new OrderFulfillmentService(prisma).processAvailabilityBatch();
    process.stdout.write(`${JSON.stringify({ processed })}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
