import { PrismaClient } from './generated';
import 'dotenv/config';
export declare const prisma: PrismaClient<import("./generated").Prisma.PrismaClientOptions, never, import("./generated/runtime/client").DefaultArgs>;
export * from './generated';
