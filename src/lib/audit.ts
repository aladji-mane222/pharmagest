import { prisma } from '@/lib/prisma'

interface AuditParams {
  action: string
  details?: object
  userId?: string
  pharmacieId?: string
}

export async function createAuditLog({
  action,
  details,
  userId,
  pharmacieId,
}: AuditParams) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        details: details ? (details as object) : undefined,
        userId: userId ?? undefined,
        pharmacieId: pharmacieId ?? undefined,
      },
    })
  } catch (error) {
    console.error('Erreur audit log:', error)
  }
}
