import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // On évite env() strict : `prisma generate` (postinstall) ne doit pas échouer
    // si DATABASE_URL est absente au build (ex. install Vercel). L'URL réelle est
    // lue au runtime par l'adaptateur dans src/lib/db.ts.
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  },
})
