import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import config from "./config";

function createPrismaClient(): PrismaClient {
    const url = config.databaseUrl;

    if (url.startsWith("postgresql://") || url.startsWith("postgres://")) {
        const adapter = new PrismaPg({
            connectionString: url
        });
        return new PrismaClient({ adapter });
    }

    throw new Error(`Unsupported datasource URL`);
}

const prisma = createPrismaClient();

export default prisma;