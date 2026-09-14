import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// 运行时用拆分的 DB_* 变量拼 PG 连接串（prisma.config.ts 里 Prisma CLI 也走同一套，
// 全站只有这一套数据库配置）。注意：运行时**不读** DATABASE_URL。
const connectionString = `postgresql://${encodeURIComponent(process.env.DB_USER || "postgres")}:${encodeURIComponent(
  process.env.DB_PASSWORD ?? "",
)}@${process.env.DB_HOST || "localhost"}:${Number(process.env.DB_PORT || 5432)}/${process.env.DB_NAME || ""}`;

const adapter = new PrismaPg({ connectionString });

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    // log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
