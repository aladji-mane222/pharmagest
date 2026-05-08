-- Index pour optimiser les requêtes fréquentes

-- Medicaments par pharmacie (très fréquent)
CREATE INDEX IF NOT EXISTS idx_medicaments_pharmacie ON "Medicament"("pharmacieId");

-- Ventes par pharmacie et date (dashboard, rapports)
CREATE INDEX IF NOT EXISTS idx_ventes_pharmacie_date ON "Vente"("pharmacieId", "createdAt");

-- Lots actifs par medicament (stock, FIFO)
CREATE INDEX IF NOT EXISTS idx_lots_medicament_actif ON "Lot"("medicamentId", "actif");

-- Lots par date péremption (alertes)
CREATE INDEX IF NOT EXISTS idx_lots_peremption ON "Lot"("datePeremption");

-- AuditLog par pharmacie et date
CREATE INDEX IF NOT EXISTS idx_audit_pharmacie_date ON "AuditLog"("pharmacieId", "createdAt");

-- Clients par pharmacie
CREATE INDEX IF NOT EXISTS idx_clients_pharmacie ON "Client"("pharmacieId");
