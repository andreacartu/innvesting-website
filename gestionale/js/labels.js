// Elenchi di valori ammessi e relative etichette. Il `value` è quello salvato, la `label` è quella mostrata.

export const STATI_IMMOBILE = [
  { value: 'ricerca', label: 'In ricerca' },
  { value: 'acquisto', label: 'In acquisto' },
  { value: 'cantiere', label: 'In cantiere' },
  { value: 'vendita', label: 'In vendita' },
  { value: 'venduto', label: 'Venduto' },
];

export const CATEGORIE_COSTO = [
  { value: 'progetto', label: 'Progetto e pratiche' },
  { value: 'opere-edili', label: 'Opere edili' },
  { value: 'elettrico', label: 'Impianto elettrico' },
  { value: 'idraulico', label: 'Impianto idraulico' },
  { value: 'termico', label: 'Riscaldamento e clima' },
  { value: 'serramenti', label: 'Serramenti' },
  { value: 'pavimenti', label: 'Pavimenti e rivestimenti' },
  { value: 'bagni', label: 'Bagni' },
  { value: 'cucina', label: 'Cucina' },
  { value: 'arredi', label: 'Arredi' },
  { value: 'elettrodomestici', label: 'Elettrodomestici' },
  { value: 'tinteggiatura', label: 'Tinteggiatura' },
  { value: 'esterni', label: 'Giardino ed esterni' },
  { value: 'altro', label: 'Altro' },
];

export const TIPI_FORNITORE = [
  { value: 'impresa', label: 'Impresa edile' },
  { value: 'geometra', label: 'Geometra' },
  { value: 'architetto', label: 'Architetto' },
  { value: 'elettricista', label: 'Elettricista' },
  { value: 'idraulico', label: 'Idraulico' },
  { value: 'serramentista', label: 'Serramentista' },
  { value: 'pavimenti', label: 'Pavimenti e rivestimenti' },
  { value: 'arredi', label: 'Arredi e cucine' },
  { value: 'agenzia', label: 'Agenzia immobiliare' },
  { value: 'notaio', label: 'Notaio' },
  { value: 'altro', label: 'Altro' },
];

export const ALIQUOTE_IVA = [
  { value: 0, label: 'IVA inclusa o esente' },
  { value: 4, label: '+ IVA 4%' },
  { value: 10, label: '+ IVA 10%' },
  { value: 22, label: '+ IVA 22%' },
  { value: 25, label: '+ IVA 25%' },
];

export const labelOf = (list, value) => list.find(item => String(item.value) === String(value))?.label ?? '';
