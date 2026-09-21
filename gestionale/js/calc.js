// Calcoli su costi, pagamenti e immobili. Nessun accesso allo store: funzioni pure.

export const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
export const sum = numbers => round2(numbers.reduce((acc, n) => acc + (Number(n) || 0), 0));

export const propertyCode = property => `N.${String(property.numero).padStart(2, '0')}`;

/* ── Costo ─────────────────────────────────────────── */

export const costTotal = cost => round2((cost.importo || 0) * (1 + (cost.iva || 0) / 100));
export const costPaid = cost => sum(cost.pagamenti.filter(p => p.pagato).map(p => p.importo));
export const costScheduled = cost => sum(cost.pagamenti.filter(p => !p.pagato).map(p => p.importo));
export const costRemaining = cost => Math.max(0, round2(costTotal(cost) - costPaid(cost)));

/* Quanto resta senza un pagamento associato (né effettuato né programmato). */
export const costUnallocated = (cost, ignorePaymentId = null) =>
  Math.max(0, round2(costTotal(cost) - sum(cost.pagamenti.filter(p => p.id !== ignorePaymentId).map(p => p.importo))));

/* Stato dei pagamenti di una spesa: saldato, con acconto versato o ancora da pagare. */
export function payState(cost) {
  const paid = costPaid(cost);
  if (paid >= costTotal(cost) - 0.005) return 'saldato';
  return paid > 0 ? 'acconto' : 'da-pagare';
}

/* ── Immobile ───────────────────────────────────────────────────────────── */

export function propertySummary(property, allCosts) {
  const costs = allCosts.filter(c => c.propertyId === property.id);

  const lavori = sum(costs.map(costTotal));
  const pagato = sum(costs.map(costPaid));
  const acquisto = sum([property.prezzoAcquisto, property.speseAcquisto]);
  const investimento = round2(acquisto + lavori);
  const ricavo = property.stato === 'venduto' && property.prezzoVendita ? property.prezzoVendita : property.prezzoObiettivo || 0;
  const margine = ricavo ? round2(ricavo - investimento) : null;

  return {
    costs,
    lavori,
    pagato,
    daPagare: round2(lavori - pagato),
    budget: property.budgetLavori || 0,
    acquisto,
    investimento,
    ricavo,
    ricavoEffettivo: property.stato === 'venduto' && Boolean(property.prezzoVendita),
    margine,
    marginePct: margine !== null && investimento > 0 ? margine / investimento : null,
  };
}

/* ── Panoramica generale ────────────────────────────────────────────────── */

/* Pagamenti ancora da effettuare, con il costo a cui appartengono. Prima quelli con data (in ordine), poi gli altri. */
export function openPayments(costs) {
  const items = [];
  costs.forEach(cost => {
    cost.pagamenti.filter(p => !p.pagato).forEach(payment => items.push({ cost, payment }));
  });
  return items.sort((a, b) => {
    const da = a.payment.data, db = b.payment.data;
    if (da && db) return da.localeCompare(db);
    return da ? -1 : db ? 1 : 0;
  });
}

export function donePayments(costs) {
  const items = [];
  costs.forEach(cost => {
    cost.pagamenti.filter(p => p.pagato).forEach(payment => items.push({ cost, payment }));
  });
  return items.sort((a, b) => (b.payment.data || '').localeCompare(a.payment.data || ''));
}

export function overallTotals(properties, costs) {
  const totale = sum(costs.map(costTotal));
  const pagato = sum(costs.map(costPaid));
  return {
    attivi: properties.filter(p => p.stato !== 'venduto').length,
    voci: costs.length,
    totale,
    pagato,
    daPagare: round2(totale - pagato),
  };
}

/* Raggruppa i costi di un immobile (o di un insieme) per fornitore. */
export function groupBySupplier(costs, suppliers) {
  const groups = new Map();
  costs.forEach(cost => {
    const key = cost.supplierId || '';
    if (!groups.has(key)) groups.set(key, { supplier: suppliers.find(s => s.id === key) ?? null, costs: [] });
    groups.get(key).costs.push(cost);
  });
  return [...groups.values()]
    .map(group => ({ ...group, totale: sum(group.costs.map(costTotal)), pagato: sum(group.costs.map(costPaid)) }))
    .sort((a, b) => b.totale - a.totale);
}
