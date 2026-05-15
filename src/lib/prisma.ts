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
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

export const prisma = globalThis.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma
