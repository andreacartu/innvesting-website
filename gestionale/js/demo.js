// Dati di esempio, per provare l'app prima di inserire quelli veri. Le date sono relative a oggi.

import { addDays, todayISO } from './format.js';

export function buildDemo() {
  const today = todayISO();
  const day = offset => addDays(today, offset);
  let seq = 0;
  const id = prefix => `demo-${prefix}-${++seq}`;

  const suppliers = [
    { id: 'demo-s-impresa', nome: 'Impresa Edile Rossi', tipo: 'impresa', referente: 'Marco Rossi', telefono: '340 111 2233', email: 'info@impresarossi.example', note: '' },
    { id: 'demo-s-elettrico', nome: 'Elettro Sistemi', tipo: 'elettricista', referente: 'Luca Bianchi', telefono: '347 222 3344', email: '', note: 'Disponibile anche il sabato mattina.' },
    { id: 'demo-s-idraulico', nome: 'Idrotermica Moro', tipo: 'idraulico', referente: 'Paolo Moro', telefono: '349 333 4455', email: '', note: '' },
    { id: 'demo-s-geometra', nome: 'Studio Geom. Furlan', tipo: 'geometra', referente: 'Elena Furlan', telefono: '335 444 5566', email: 'studio@furlan.example', note: '' },
    { id: 'demo-s-serramenti', nome: 'Serramenti Veneto', tipo: 'serramentista', referente: '', telefono: '0422 123456', email: '', note: '' },
    { id: 'demo-s-arredi', nome: 'Arredi Design Treviso', tipo: 'arredi', referente: 'Giulia Rizzo', telefono: '348 555 6677', email: '', note: '' },
  ];

  const pay = (nota, importo, data, pagato) => ({ id: id('p'), nota, importo, data, pagato });

  const properties = [
    {
      id: 'demo-p-1', numero: 1, nome: 'Trilocale in centro', indirizzo: 'Centro storico, Treviso', cliente: 'Cliente A',
      stato: 'cantiere', prezzoAcquisto: 185000, speseAcquisto: 14500, budgetLavori: 62000, prezzoObiettivo: 340000, prezzoVendita: null,
      investitoreNome: 'Investitore A', investitoreEmail: 'investitore.a@example.com', condiviso: false, avanzamento: 55, photoId: null,
      note: 'Rogito a nome del cliente. Fine lavori prevista tra circa due mesi.',
    },
    {
      id: 'demo-p-2', numero: 2, nome: 'Villa con giardino', indirizzo: 'Provincia di Treviso', cliente: 'Cliente B',
      stato: 'acquisto', prezzoAcquisto: 420000, speseAcquisto: 31000, budgetLavori: 140000, prezzoObiettivo: 780000, prezzoVendita: null,
      investitoreNome: 'Investitore B', investitoreEmail: '', condiviso: false, avanzamento: 0, photoId: null,
      note: '',
    },
    {
      id: 'demo-p-3', numero: 3, nome: 'Appartamento zona stazione', indirizzo: 'Treviso', cliente: 'Cliente C',
      stato: 'venduto', prezzoAcquisto: 138000, speseAcquisto: 11200, budgetLavori: 41000, prezzoObiettivo: 235000, prezzoVendita: 241000,
      investitoreNome: 'Investitore C', investitoreEmail: '', condiviso: false, avanzamento: 100, photoId: null,
      note: 'Operazione conclusa.',
    },
  ];

  const cost = (propertyId, supplierId, descrizione, categoria, importo, iva, pagamenti = [], extra = {}) => ({
    id: id('c'), propertyId, supplierId, descrizione, categoria, importo, iva, pagamenti, data: day(-40), link: '', note: '', ...extra,
  });

  const costs = [
    cost('demo-p-1', 'demo-s-geometra', 'Progetto e pratiche edilizie', 'progetto', 4800, 22, [
      pay('Acconto 50%', 2928, day(-38), true), pay('Saldo', 2928, day(10), false),
    ]),
    cost('demo-p-1', 'demo-s-impresa', 'Opere edili e demolizioni', 'opere-edili', 21500, 10, [
      pay('Acconto 30%', 7095, day(-30), true), pay('SAL 40%', 9460, day(-8), true), pay('Saldo', 7095, day(25), false),
    ]),
    cost('demo-p-1', 'demo-s-elettrico', 'Impianto elettrico completo', 'elettrico', 7200, 10, [
      pay('Acconto 40%', 3168, day(-20), true), pay('Saldo', 4752, day(-3), false),
    ]),
    cost('demo-p-1', 'demo-s-serramenti', 'Serramenti in legno-alluminio', 'serramenti', 12400, 10, [
      pay('Acconto 50%', 6820, day(-15), true),
    ]),
    cost('demo-p-1', 'demo-s-idraulico', 'Impianto idraulico e bagni', 'idraulico', 9800, 10),
    cost('demo-p-1', 'demo-s-arredi', 'Cucina su misura e arredi', 'cucina', 15800, 22),

    cost('demo-p-2', 'demo-s-geometra', 'Rilievo e progetto architettonico', 'progetto', 9500, 22, [
      pay('Acconto 30%', 3477, day(-5), true),
    ]),
    cost('demo-p-2', 'demo-s-impresa', 'Ristrutturazione completa', 'opere-edili', 96000, 10),

    cost('demo-p-3', 'demo-s-impresa', 'Ristrutturazione completa', 'opere-edili', 34000, 10, [
      pay('Acconto', 11220, day(-200), true), pay('SAL', 14960, day(-150), true), pay('Saldo', 11220, day(-110), true),
    ], { data: day(-230) }),
    cost('demo-p-3', 'demo-s-arredi', 'Arredi e cucina', 'arredi', 4200, 22, [
      pay('Saldo', 5124, day(-95), true),
    ], { data: day(-130) }),
  ];

  const update = (propertyId, offset, titolo, testo) => ({ id: id('u'), propertyId, data: day(offset), titolo, testo, photoIds: [], visibile: true });

  const updates = [
    update('demo-p-1', -45, 'Demolizioni completate', 'Rimossi tramezzi e vecchi impianti. Il locale è pronto per i nuovi impianti.'),
    update('demo-p-1', -20, 'Impianti in corso', 'Tracce e tubazioni elettriche e idrauliche posate. Prossimo passo: massetti e intonaci.'),
    update('demo-p-1', -4, 'Serramenti ordinati', 'Confermato l’ordine dei serramenti, consegna prevista tra circa tre settimane.'),
    update('demo-p-2', -3, 'Progetto in fase di rilievo', 'Concluso il rilievo dell’edificio, si parte con il progetto architettonico.'),
  ];

  return { properties, suppliers, costs, updates, nextN: 4 };
}
