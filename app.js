/* ============================================================
   Distinta — l'interfaccia

   Tutta la logica sta in configuratore.js, che e' lo stesso file
   usato da verifica.mjs sotto Node. Qui dentro c'e' solo:
   leggere il catalogo, disegnare i comandi, disegnare il
   serramento, mostrare la distinta.

   Il numero che la pagina dichiara — nessuno stato impossibile
   raggiungibile cliccando — vale perche' le opzioni spente le
   decide `disponibilita()`, cioe' esattamente la funzione che la
   verifica visita in lungo e in largo. Se lo decidesse questo
   file, quel numero non varrebbe niente.
   ============================================================ */
import { creaConfiguratore } from './configuratore.js';

const $ = s => document.querySelector(s);
const SVGNS = 'http://www.w3.org/2000/svg';

let cat = null, cfg = null, config = null;

const euro = n => (n ?? 0).toLocaleString('it-IT',
  { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mm = n => n.toLocaleString('it-IT');

const el = (tag, classe, testo) => {
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  if (testo != null) n.textContent = testo;
  return n;
};
const svg = (tag, attributi = {}) => {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attributi)) n.setAttribute(k, v);
  return n;
};
const tinta = nome => getComputedStyle(document.documentElement)
  .getPropertyValue(nome).trim() || '#000';

/* ------------------------------------------------------------
   Collegamento condivisibile.

   Serve davvero: in una trattativa la frase che si dice e'
   "mandami il link di quella configurazione". Senza, l'unico modo
   di condividere una configurazione e' descriverla a parole, e a
   quel punto si sbaglia.

   Sta nel frammento e non nella query perche' cosi' non viene
   inviato a nessun server nemmeno per sbaglio.
   ------------------------------------------------------------ */
function scriviCollegamento() {
  const p = new URLSearchParams();
  p.set('l', config.larghezza); p.set('h', config.altezza);
  for (const g of cat.gruppi) {
    p.set(g.id, g.scelta === 'multipla' ? config[g.id].join(',') : config[g.id]);
  }
  p.set('q', config.quantita);
  p.set('srv', config.servizi.join(','));
  p.set('iva', config.iva);
  history.replaceState(null, '', '#' + p.toString());
}

function leggiCollegamento() {
  const base = cfg.predefinita();
  if (!location.hash || location.hash.length < 3) return base;
  const p = new URLSearchParams(location.hash.slice(1));
  const c = { ...base };

  const numero = (chiave, attuale, min, max) => {
    const v = Number(p.get(chiave));
    return Number.isFinite(v) && v >= min && v <= max ? v : attuale;
  };
  c.larghezza = numero('l', base.larghezza, cat.misure.larghezza.min, cat.misure.larghezza.max);
  c.altezza = numero('h', base.altezza, cat.misure.altezza.min, cat.misure.altezza.max);
  c.quantita = numero('q', 1, 1, 200);

  for (const g of cat.gruppi) {
    const grezzo = p.get(g.id);
    if (grezzo == null) continue;
    const ammessi = new Set(g.opzioni.map(o => o.id));
    if (g.scelta === 'multipla') {
      c[g.id] = grezzo.split(',').filter(x => ammessi.has(x));
    } else if (ammessi.has(grezzo)) {
      c[g.id] = grezzo;
    }
  }
  const srv = p.get('srv');
  if (srv != null) {
    const ammessi = new Set(cat.servizi.map(s => s.id));
    c.servizi = srv.split(',').filter(x => ammessi.has(x));
  }
  if (cat.iva.some(i => i.id === p.get('iva'))) c.iva = p.get('iva');

  /* Un collegamento vecchio puo' descrivere una configurazione che
     oggi non e' piu' valida, perche' il catalogo e' cambiato. Non
     si carica a forza: si torna ai predefiniti e lo si dice. */
  if (!cfg.valida(c).ok) {
    avvisa('Il collegamento descrive una configurazione che oggi non e\' piu\' possibile: '
      + 'sono ripartito dai valori predefiniti.');
    return base;
  }
  return c;
}

let avvisoTimer = null;
function avvisa(testo) {
  const box = $('#avviso');
  box.textContent = testo || '';
  clearTimeout(avvisoTimer);
  if (testo) avvisoTimer = setTimeout(() => { box.textContent = ''; }, 9000);
}

/* ------------------------------------------------------------
   Il disegno tecnico.

   Le unita' del sistema di coordinate sono millimetri veri: il
   disegno e' in scala, non e' una figura simbolica. Quindi una
   finestra stretta e alta si vede stretta e alta, che e' il primo
   controllo che fa chiunque guardi un preventivo.

   I tratti usano non-scaling-stroke: lo spessore resta costante
   in pixel qualunque sia la misura, altrimenti su un serramento
   da 2400 mm le linee sparirebbero.
   ------------------------------------------------------------ */
function disegna() {
  const L = config.larghezza, H = config.altezza;
  const s = cat.misure.spessoreTelaioDisegno || 70;
  const q = 110;                       // spazio per le quote
  const vb = { x: -q - 40, y: -40, w: L + q + 80, h: H + q + 80 };

  const profiloTinta = cfg.opzioneDi('colore', config.colore)?.tinta || '#eee';
  const vetroTinta = cfg.opzioneDi('vetro', config.vetro)?.tinta || '#cde';
  const linea = tinta('--testo-1');
  const accento = tinta('--accento');
  const debole = tinta('--testo-3');
  const corpo = Math.max(8, (L + q) / 30);   // corpo del testo delle quote

  const d = svg('svg', {
    viewBox: `${vb.x} ${vb.y} ${vb.w} ${vb.h}`,
    xmlns: SVGNS, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
  });
  const tratto = (attr) => svg('path', { fill: 'none', stroke: linea,
    'stroke-width': 1.4, 'vector-effect': 'non-scaling-stroke', ...attr });

  // telaio e vetro
  d.append(svg('rect', { x: 0, y: 0, width: L, height: H, fill: profiloTinta,
    stroke: linea, 'stroke-width': 1.8, 'vector-effect': 'non-scaling-stroke' }));
  const gx = s, gy = s, gw = L - 2 * s, gh = H - 2 * s;
  d.append(svg('rect', { x: gx, y: gy, width: gw, height: gh, fill: vetroTinta,
    stroke: linea, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));

  /* Simbolo di apertura: il vertice del triangolo sta sul lato
     della cerniera. E' la convenzione dei disegni di serramenti,
     e chi lavora nel settore la legge senza legenda. */
  const simboloBattente = (x1, y1, x2, y2, verso) => {
    const ym = (y1 + y2) / 2, xm = (x1 + x2) / 2;
    if (verso === 'sinistra') return `M ${x2} ${y1} L ${x1} ${ym} L ${x2} ${y2}`;
    if (verso === 'destra')   return `M ${x1} ${y1} L ${x2} ${ym} L ${x1} ${y2}`;
    return `M ${x1} ${y1} L ${xm} ${y2} L ${x2} ${y1}`;   // vasistas: vertice in basso
  };

  const ap = config.apertura;
  if (ap === 'battente1') {
    d.append(tratto({ d: simboloBattente(gx, gy, gx + gw, gy + gh, 'sinistra'),
      stroke: accento, 'stroke-width': 1.2 }));
  } else if (ap === 'battente2') {
    const mezzo = gx + gw / 2;
    d.append(tratto({ d: `M ${mezzo} ${gy} L ${mezzo} ${gy + gh}` }));
    d.append(tratto({ d: simboloBattente(gx, gy, mezzo, gy + gh, 'sinistra'),
      stroke: accento, 'stroke-width': 1.2 }));
    d.append(tratto({ d: simboloBattente(mezzo, gy, gx + gw, gy + gh, 'destra'),
      stroke: accento, 'stroke-width': 1.2 }));
  } else if (ap === 'vasistas') {
    d.append(tratto({ d: simboloBattente(gx, gy, gx + gw, gy + gh, 'basso'),
      stroke: accento, 'stroke-width': 1.2 }));
  } else if (ap === 'scorrevole') {
    const mezzo = gx + gw / 2;
    d.append(tratto({ d: `M ${mezzo} ${gy} L ${mezzo} ${gy + gh}` }));
    const yf = gy + gh / 2, dx = gw / 5;
    d.append(tratto({ d: `M ${mezzo - dx * 1.5} ${yf} L ${mezzo - dx * 0.3} ${yf}`,
      stroke: accento, 'stroke-width': 1.4 }));
    d.append(tratto({ d: `M ${mezzo - dx * 0.6} ${yf - dx * 0.18} L ${mezzo - dx * 0.3} ${yf} `
      + `L ${mezzo - dx * 0.6} ${yf + dx * 0.18}`, stroke: accento, 'stroke-width': 1.4 }));
  }

  /* quote: linea, trattini agli estremi, misura in chiaro */
  const testo = (x, y, contenuto, ruota) => {
    const t = svg('text', { x, y, fill: debole, 'font-size': corpo,
      'font-family': 'ui-monospace, monospace', 'text-anchor': 'middle' });
    if (ruota) t.setAttribute('transform', `rotate(-90 ${x} ${y})`);
    t.textContent = contenuto;
    return t;
  };
  const yq = H + q * 0.62;
  d.append(tratto({ d: `M 0 ${yq} L ${L} ${yq}`, stroke: debole, 'stroke-width': 1 }));
  d.append(tratto({ d: `M 0 ${yq - 18} L 0 ${yq + 18} M ${L} ${yq - 18} L ${L} ${yq + 18}`,
    stroke: debole, 'stroke-width': 1 }));
  d.append(tratto({ d: `M 0 ${H} L 0 ${yq + 10} M ${L} ${H} L ${L} ${yq + 10}`,
    stroke: debole, 'stroke-width': 0.6, 'stroke-dasharray': '6 6' }));
  d.append(testo(L / 2, yq - 14, `${mm(L)} mm`));

  const xq = -q * 0.62;
  d.append(tratto({ d: `M ${xq} 0 L ${xq} ${H}`, stroke: debole, 'stroke-width': 1 }));
  d.append(tratto({ d: `M ${xq - 18} 0 L ${xq + 18} 0 M ${xq - 18} ${H} L ${xq + 18} ${H}`,
    stroke: debole, 'stroke-width': 1 }));
  d.append(tratto({ d: `M 0 0 L ${xq - 10} 0 M 0 ${H} L ${xq - 10} ${H}`,
    stroke: debole, 'stroke-width': 0.6, 'stroke-dasharray': '6 6' }));
  d.append(testo(xq - 14, H / 2, `${mm(H)} mm`, true));

  $('#disegno').replaceChildren(d);

  const p = cfg.prezzo(config);
  const area = n => n.toLocaleString('it-IT',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  $('#disegno-nota').textContent =
    `${mm(L)} × ${mm(H)} mm · ${area(p.areaReale)} m²`
    + (p.areaMinimaApplicata ? ` · fatturati ${area(p.area)} m² (minimo)` : '');
}

/* ------------------------------------------------------------
   Comandi
   ------------------------------------------------------------ */
function disegnaGruppi() {
  const casa = $('#gruppi');
  casa.replaceChildren();
  const disp = cfg.disponibilita(config);

  for (const g of cat.gruppi) {
    const sez = el('section', 'blocco');
    sez.append(el('span', 'targhetta', g.etichetta));
    const griglia = el('div', 'opzioni');

    for (const o of g.opzioni) {
      const stato = disp[g.id][o.id];
      const b = el('button', 'opzione');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(stato.selezionato));
      if (!stato.disponibile) b.disabled = true;

      b.append(el('b', null, o.etichetta));
      b.append(el('small', null, stato.disponibile ? o.dettaglio : stato.perche));

      const prezzo =
        o.prezzoMq != null ? (o.prezzoMq ? `${o.prezzoMq} €/m²` : 'incluso')
        : o.rincaro != null ? (o.rincaro ? `+${Math.round(o.rincaro * 100)}%` : 'incluso')
        : o.prezzo ? `${o.prezzo} €` : 'incluso';
      b.append(el('span', 'opzione__prezzo q', prezzo));

      b.addEventListener('click', () => {
        const { config: nuova, rimossi } = cfg.applica(config, g.id, o.id);
        config = nuova;
        if (rimossi.length) {
          const nomi = rimossi.map(r => r.etichetta.toLowerCase()).join(' e ');
          avvisa(`Ho tolto ${nomi}. ${rimossi[0].perche}`);
        }
        aggiorna();
      });
      griglia.append(b);
    }
    sez.append(griglia);
    casa.append(sez);
  }
}

function disegnaMisure() {
  for (const misura of ['larghezza', 'altezza']) {
    const { min, max, passo, motivi } = cfg.intervallo(config, misura);
    const campo = $('#' + misura);
    const cursore = $('#' + misura + '-cursore');
    for (const c of [campo, cursore]) {
      c.min = min; c.max = max; c.step = passo; c.value = config[misura];
    }
    const nota = $('#limiti-' + misura);
    nota.replaceChildren();
    nota.append(document.createTextNode(`da ${mm(min)} a ${mm(max)} mm`));
    if (motivi.length) {
      nota.append(document.createTextNode(' — '));
      nota.append(el('b', null, motivi[0].perche));
    }
  }
}

function disegnaDistinta() {
  const p = cfg.prezzo(config);
  const corpo = $('#distinta tbody');
  corpo.replaceChildren();

  const riga = (voce, dettaglio, importo, classe) => {
    const tr = el('tr', classe);
    const td = el('td', 'voce');
    td.append(document.createTextNode(voce));
    if (dettaglio) td.append(el('span', 'dett', dettaglio));
    tr.append(td);
    tr.append(el('td', 'imp', importo));
    corpo.append(tr);
  };

  for (const r of p.righe) riga(r.voce, r.dettaglio, euro(r.importo) + ' €');

  if (p.quantita > 1) {
    riga('Prezzo unitario', null, euro(p.perPezzo) + ' €', 'somma');
    riga(`${p.quantita} pezzi`, null, euro(p.totalePezzi) + ' €');
  }
  if (p.sconto) riga(`Sconto quantità — ${p.fascia.etichetta}`,
    `−${Math.round(p.fascia.sconto * 100)}%`, '−' + euro(p.sconto) + ' €', 'sconto');
  for (const r of p.righeServizi) riga(r.voce, r.dettaglio, euro(r.importo) + ' €');

  riga('Imponibile', null, euro(p.imponibile) + ' €', 'somma');
  riga(p.regimeIva.etichetta, null, euro(p.iva) + ' €');
  riga('Totale', null, euro(p.totale) + ' €', 'totale');
}

function disegnaServizi() {
  const casa = $('#servizi');
  casa.replaceChildren();
  for (const s of cat.servizi) {
    const l = el('label', 'spunta');
    const i = el('input');
    i.type = 'checkbox';
    i.checked = config.servizi.includes(s.id);
    i.addEventListener('change', () => {
      config.servizi = i.checked
        ? [...config.servizi, s.id]
        : config.servizi.filter(x => x !== s.id);
      aggiorna();
    });
    const testo = el('span');
    testo.append(document.createTextNode(`${s.etichetta} — ${s.prezzoPezzo} € a pezzo`));
    testo.append(el('small', null, s.dettaglio));
    l.append(i, testo);
    casa.append(l);
  }
}

function aggiorna() {
  disegnaMisure();
  disegnaGruppi();
  disegnaDistinta();
  disegna();
  const regime = cat.iva.find(i => i.id === config.iva);
  $('#nota-iva').textContent = regime?.nota || '';
  scriviCollegamento();
}

/* ------------------------------------------------------------
   Avvio
   ------------------------------------------------------------ */
async function avvia() {
  try {
    cat = await fetch('catalogo.json').then(r => {
      if (!r.ok) throw new Error('catalogo.json non trovato');
      return r.json();
    });
  } catch (e) {
    $('#avviso').textContent = 'Non sono riuscito a caricare il catalogo. '
      + 'Se hai aperto il file con un doppio click serve un server.';
    return;
  }
  cfg = creaConfiguratore(cat);
  config = leggiCollegamento();

  const scelta = $('#iva');
  for (const i of cat.iva) {
    const o = el('option', null, i.etichetta);
    o.value = i.id;
    scelta.append(o);
  }
  scelta.value = config.iva;
  scelta.addEventListener('change', () => { config.iva = scelta.value; aggiorna(); });

  for (const misura of ['larghezza', 'altezza']) {
    const campo = $('#' + misura), cursore = $('#' + misura + '-cursore');
    const cambia = valore => {
      const { min, max } = cfg.intervallo(config, misura);
      const v = Math.min(max, Math.max(min, Math.round(Number(valore) / 10) * 10));
      if (!Number.isFinite(v)) return;
      config[misura] = v;
      aggiorna();
    };
    cursore.addEventListener('input', () => cambia(cursore.value));
    campo.addEventListener('change', () => cambia(campo.value));
  }

  const quantita = $('#quantita');
  quantita.value = config.quantita;
  quantita.addEventListener('change', () => {
    const v = Math.min(200, Math.max(1, Math.round(Number(quantita.value) || 1)));
    quantita.value = v; config.quantita = v; aggiorna();
  });

  disegnaServizi();
  aggiorna();

  $('#stampa').addEventListener('click', () => window.print());
  $('#azzera').addEventListener('click', () => {
    config = cfg.predefinita();
    $('#quantita').value = config.quantita;
    $('#iva').value = config.iva;
    disegnaServizi();
    aggiorna();
    avvisa('Configurazione riportata ai valori di partenza.');
  });
  $('#collega').addEventListener('click', async () => {
    scriviCollegamento();
    try {
      await navigator.clipboard.writeText(location.href);
      avvisa('Collegamento copiato: descrive esattamente questa configurazione.');
    } catch (e) {
      avvisa('Non riesco a copiare da solo: il collegamento e\' nella barra degli indirizzi.');
    }
  });
  $('#tema').addEventListener('click', () => {
    const d = document.documentElement;
    const prossimo = d.getAttribute('data-tema') === 'chiaro' ? 'scuro' : 'chiaro';
    d.setAttribute('data-tema', prossimo);
    try { localStorage.setItem('distinta-tema', prossimo); } catch (e) {}
    disegna();     // il disegno prende i colori dal tema: va rifatto
  });

  window.__distintaPronta = true;
}

avvia();
