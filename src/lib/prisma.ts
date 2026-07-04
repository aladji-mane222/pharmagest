import { PrismaClient } from '@prisma/client'

// Configuration de Prisma pour optimiser les performances
// et le débogage en environnement à haute latence.
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    // On peut ajouter des paramètres ici pour forcer des limites si nécessaire
  })
}

declare global {
  // "var" est obligatoire ici : TypeScript n'accepte pas "let"/"const" pour
  // augmenter globalThis (vérifié le 04/07/2026 : avec "let", TS renvoie
  // "Property 'prisma' does not exist on type 'typeof globalThis'").
  // eslint-disable-next-line no-var
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

export const prisma = globalThis.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma
