import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const connect = async () => {
  try {
    await prisma.$connect();
    console.log("✅ Kết nối Postgres thành công!");
  } catch (err) {
    console.error("❌ Kết nối Postgres thất bại:", err);
    process.exit(1);
  }
};

export default prisma;
