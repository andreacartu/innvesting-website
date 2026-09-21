// Stato di interfaccia che non fa parte dei dati: filtri attivi e ricerche.

export const ui = {
  propertyFilter: 'attivi',
  costFilter: 'tutti',
  costFilterFor: null,
  openZones: new Set(), // tendine delle zone aperte nella scheda Costi
  paymentFilter: 'da-pagare',
  supplierQuery: '',
};
