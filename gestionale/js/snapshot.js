// Che cosa vede l'investitore: una copia dei soli dati di UN immobile, senza note private, link, recapiti dei fornitori
// e senza gli altri immobili. Pura: nessun accesso ad archivio o rete.

export const SNAPSHOT_VERSION = 1;

export function buildSnapshot(property, { suppliers, costs, updates }) {
  const propertyCosts = costs.filter(c => c.propertyId === property.id);
  const supplierIds = new Set(propertyCosts.map(c => c.supplierId).filter(Boolean));

  return {
    v: SNAPSHOT_VERSION,
    property: {
      numero: property.numero,
      nome: property.nome,
      indirizzo: property.indirizzo ?? '',
      stato: property.stato,
      avanzamento: property.avanzamento ?? 0,
      investitoreNome: property.investitoreNome ?? '',
      prezzoAcquisto: property.prezzoAcquisto ?? null,
      speseAcquisto: property.speseAcquisto ?? null,
      budgetLavori: property.budgetLavori ?? null,
      prezzoObiettivo: property.prezzoObiettivo ?? null,
      prezzoVendita: property.prezzoVendita ?? null,
      photoId: property.photoId || '',
    },
    suppliers: suppliers.filter(s => supplierIds.has(s.id)).map(s => ({ id: s.id, nome: s.nome, tipo: s.tipo ?? '' })),
    costs: propertyCosts.map(c => ({
      id: c.id,
      supplierId: c.supplierId || '',
      descrizione: c.descrizione,
      zona: (c.zona ?? '').trim(),
      categoria: c.categoria ?? '',
      importo: c.importo,
      iva: c.iva ?? 0,
      data: c.data ?? '',
      pagamenti: c.pagamenti.map(p => ({ id: p.id, nota: p.nota ?? '', importo: p.importo, data: p.data ?? '', pagato: Boolean(p.pagato) })),
    })),
    updates: updates
      .filter(u => u.propertyId === property.id && u.visibile !== false)
      .map(u => ({ id: u.id, data: u.data ?? '', titolo: u.titolo, testo: u.testo ?? '', photoIds: u.photoIds ?? [] })),
  };
}

export const snapshotPhotoIds = snapshot => [
  snapshot.property.photoId,
  ...snapshot.updates.flatMap(u => u.photoIds),
].filter(Boolean);
