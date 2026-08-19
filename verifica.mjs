/* ============================================================
   Distinta — verifica del motore

   Tre livelli, e servono tutti e tre a cose diverse.

   1. ATTESE A MANO — diciannove casi di regola e sei di prezzo,
      calcolati con la calcolatrice leggendo il catalogo. E' il
      solo oracolo vero: dice cosa DEVE succedere, non cosa
      succede.

   2. ENUMERAZIONE ESAUSTIVA — tutte le combinazioni di opzioni,
      confrontate con un controllore scritto a parte che applica
      le regole del catalogo direttamente. Non e' un oracolo
      indipendente (se avessi capito male una regola sbaglierei
      due volte) ma prende gli errori di programmazione, che sono
      la maggioranza.

   3. RAGGIUNGIBILITA' — si visita tutto lo spazio partendo dalla
      configurazione iniziale e muovendosi SOLO sulle opzioni che
      il motore dichiara disponibili. E' la prova che conta
      davvero: dimostra che nessuno, cliccando, puo' arrivare a
      una configurazione invalida. Un configuratore che permette
      di comporre l'impossibile manda in produzione un ordine che
      non si puo' fabbricare.

   Uso:
     node verifica.mjs
     node verifica.mjs --dettagli
   ============================================================ */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { creaConfiguratore } from './configuratore.js';

const QUI = dirname(fileURLToPath(import.meta.url));
const DETTAGLI = process.argv.includes('--dettagli');
const leggi = f => JSON.parse(readFileSync(join(QUI, f), 'utf8'));

const catalogo = leggi('catalogo.json');
const prove = leggi('prove.json');
const cfg = creaConfiguratore(catalogo);

let fatte = 0, cadute = 0;
const guasti = [];

function verifica(nome, condizione, dettaglio) {
  fatte++;
  if (!condizione) { cadute++; guasti.push(`${nome}\n        ${dettaglio}`); }
  else if (DETTAGLI) console.log(`      ok  ${nome}`);
}

const completa = parziale => {
  const base = cfg.predefinita();
  return { ...base, ...parziale, accessori: parziale.accessori ?? base.accessori };
};

/* ============================================================
   1 — Attese scritte a mano
   ============================================================ */
console.log('\n  1. Attese scritte a mano\n');

for (const c of prove.regole) {
  const config = completa(c.config);
  const esito = cfg.valida(config);
  verifica(`regola · ${c.caso}`, esito.ok === c.valida,
    `atteso ${c.valida ? 'valida' : 'invalida'}, ottenuto ${esito.ok ? 'valida' : 'invalida'}`
    + (esito.problemi.length ? ` (${esito.problemi.map(p => p.id).join(', ')})` : ''));
  if (c.regola) {
    verifica(`regola · ${c.caso} · quale regola`,
      esito.problemi.some(p => p.id === c.regola),
      `attesa la regola "${c.regola}", ottenute [${esito.problemi.map(p => p.id).join(', ')}]`);
  }
}

for (const c of prove.prezzi) {
  const p = cfg.prezzo(completa(c.config));
  for (const [campo, atteso] of Object.entries(c.atteso)) {
    const ottenuto = p[campo];
    const ok = typeof atteso === 'number'
      ? Math.abs(ottenuto - atteso) < 0.005
      : ottenuto === atteso;
    verifica(`prezzo · ${c.caso} · ${campo}`, ok, `atteso ${atteso}, ottenuto ${ottenuto}`);
  }
}
console.log(`     ${fatte - cadute}/${fatte} verifiche superate`);

/* ============================================================
   2 — Enumerazione esaustiva
   ============================================================ */
console.log('\n  2. Enumerazione di tutte le combinazioni\n');

const singoli = catalogo.gruppi.filter(g => g.scelta !== 'multipla');
const multipli = catalogo.gruppi.filter(g => g.scelta === 'multipla');

/* sottoinsiemi degli accessori */
function sottoinsiemi(elenco) {
  return elenco.reduce((acc, x) => acc.concat(acc.map(s => [...s, x])), [[]]);
}

function* tutteLeCombinazioni() {
  const assi = singoli.map(g => g.opzioni.map(o => [g.id, o.id]));
  const accessori = sottoinsiemi(multipli[0].opzioni.map(o => o.id));
  const ricorsione = function* (i, parziale) {
    if (i === assi.length) {
      for (const acc of accessori) yield { ...parziale, accessori: acc };
      return;
    }
    for (const [g, o] of assi[i]) yield* ricorsione(i + 1, { ...parziale, [g]: o });
  };
  yield* ricorsione(0, {});
}

/* Controllore scritto a parte: legge le regole dal catalogo e le
   applica direttamente, senza passare dal motore. */
function controlloIndipendente(config) {
  const violate = [];
  for (const r of catalogo.regole) {
    const tuttiSoddisfatti = r.incompatibili.every(lato => {
      const scelto = config[lato.gruppo];
      return Array.isArray(scelto)
        ? lato.opzioni.some(o => scelto.includes(o))
        : lato.opzioni.includes(scelto);
    });
    if (tuttiSoddisfatti) violate.push(r.id);
  }
  for (const v of catalogo.vincoliMisura) {
    const scelto = config[v.quando.gruppo];
    const attivo = Array.isArray(scelto)
      ? v.quando.opzioni.some(o => scelto.includes(o))
      : v.quando.opzioni.includes(scelto);
    if (!attivo) continue;
    if (v.min != null && config[v.misura] < v.min) violate.push(v.id);
    if (v.max != null && config[v.misura] > v.max) violate.push(v.id);
  }
  return violate;
}

let combinazioni = 0, valide = 0, discordi = 0;
for (const parziale of tutteLeCombinazioni()) {
  combinazioni++;
  const config = completa(parziale);
  const motore = cfg.valida(config);
  const atteso = controlloIndipendente(config);
  if (motore.ok !== (atteso.length === 0)) {
    discordi++;
    if (discordi <= 3) {
      guasti.push(`enumerazione · discordanza\n        ${JSON.stringify(parziale)}\n`
        + `        motore: ${motore.ok ? 'valida' : motore.problemi.map(p => p.id).join(',')}`
        + ` · controllo: ${atteso.length ? atteso.join(',') : 'valida'}`);
    }
  }
  if (motore.ok) valide++;
}
fatte += combinazioni; cadute += discordi;
console.log(`     ${combinazioni} combinazioni di opzioni`);
console.log(`     ${valide} valide, ${combinazioni - valide} escluse dalle regole`);
console.log(`     ${discordi} discordanze fra motore e controllo indipendente`);

/* ============================================================
   3 — Raggiungibilita': cliccando, si puo' rompere qualcosa?
   ============================================================ */
console.log('\n  3. Visita dello spazio raggiungibile\n');

const chiave = c => [...singoli.map(g => c[g.id]), [...c.accessori].sort().join('+')].join('|');

const partenza = cfg.predefinita();
if (!cfg.valida(partenza).ok) {
  guasti.push('raggiungibilita · la configurazione iniziale del catalogo non e\' valida');
  cadute++; fatte++;
}

const visti = new Set([chiave(partenza)]);
const coda = [partenza];
let stati = 0, invalidi = 0, mosse = 0;

while (coda.length) {
  const corrente = coda.shift();
  stati++;
  if (!cfg.valida(corrente).ok) {
    invalidi++;
    if (invalidi <= 3) guasti.push(`raggiungibilita · stato invalido raggiungibile\n        ${chiave(corrente)}`);
  }
  const disp = cfg.disponibilita(corrente);
  for (const g of catalogo.gruppi) {
    for (const o of g.opzioni) {
      if (!disp[g.id][o.id].disponibile) continue;
      mosse++;
      const { config: prossima } = cfg.applica(corrente, g.id, o.id);
      const k = chiave(prossima);
      if (!visti.has(k)) { visti.add(k); coda.push(prossima); }
    }
  }
}
fatte += stati; cadute += invalidi;
console.log(`     ${stati} stati raggiungibili partendo dai predefiniti`);
console.log(`     ${mosse} mosse possibili esplorate`);
console.log(`     ${invalidi} stati invalidi raggiunti`);

/* ============================================================
   Esito
   ============================================================ */
console.log(`\n  ${fatte - cadute} controlli superati su ${fatte}`);
if (cadute) {
  console.error(`\n  ${cadute} falliti:\n`);
  for (const g of guasti.slice(0, 12)) console.error(`    ${g}\n`);
  process.exit(1);
}
console.log('  Tutto a posto.\n');
