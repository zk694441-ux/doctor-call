import { PrismaClient } from "@prisma/client";

const defaultDbUrl = 'postgresql://postgres.pgeasehxmhzzurjagyhl:xwrB3ehv%23T7qq.a@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require';
const dbUrl = process.env.DATABASE_URL || defaultDbUrl;

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: dbUrl
        }
    },
    errorFormat: 'minimal'
});

export default prisma;
