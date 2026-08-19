/* ============================================================
   Distinta — il motore di configurazione

   Un file solo, usato da due parti:
     verifica.mjs   (Node)     enumera e controlla
     app.js         (browser)  configura e disegna

   Il prodotto non e' qui dentro: sta in catalogo.json. Opzioni,
   prezzi, incompatibilita' e vincoli dimensionali sono dati.
   Per configurare un altro prodotto si riscrive quel file.

   Le due idee che reggono tutto
   -----------------------------
   1. Le incompatibilita' sono SIMMETRICHE. Una regola lega due
      insiemi di opzioni e vale in entrambe le direzioni: se
      prendi prima il vetro triplo sparisce il profilo da 60, se
      prendi prima il profilo da 60 sparisce il vetro triplo. Un
      configuratore che ne gestisce una sola costringe a tornare
      indietro e indovinare.

   2. Ogni indisponibilita' porta il suo motivo. "Non
      selezionabile" senza spiegazione viene letto come un guasto
      del sito, e chi sta comprando se ne va.
   ============================================================ */

const arrotonda = n => Math.round(n * 100) / 100;

export function creaConfiguratore(catalogo) {
  const gruppi = new Map(catalogo.gruppi.map(g => [g.id, g]));
  const opzioneDi = (idGruppo, idOpzione) =>
    gruppi.get(idGruppo)?.opzioni.find(o => o.id === idOpzione) || null;

  /* --------------------------------------------------------
     Configurazione di partenza: i predefiniti del catalogo.
     -------------------------------------------------------- */
  function predefinita() {
    const c = {
      larghezza: catalogo.misure.larghezza.predefinito,
      altezza: catalogo.misure.altezza.predefinito,
      quantita: 1,
      servizi: [],
      iva: (catalogo.iva.find(i => i.predefinita) || catalogo.iva[0]).id
    };
    for (const g of catalogo.gruppi) {
      c[g.id] = g.scelta === 'multipla' ? [...(g.predefinito || [])] : g.predefinito;
    }
    return c;
  }

  /* --------------------------------------------------------
     Una regola e' "attiva" quando TUTTI i suoi lati sono
     soddisfatti dalla configurazione. Se lo e', la
     configurazione viola quella regola.
     -------------------------------------------------------- */
  const latoSoddisfatto = (config, lato) => {
    const scelto = config[lato.gruppo];
    if (Array.isArray(scelto)) return lato.opzioni.some(o => scelto.includes(o));
    return lato.opzioni.includes(scelto);
  };

  const regoleViolate = config =>
    catalogo.regole.filter(r => r.incompatibili.every(l => latoSoddisfatto(config, l)));

  /* --------------------------------------------------------
     Vincoli dimensionali: valgono solo quando l'opzione che li
     porta e' selezionata.
     -------------------------------------------------------- */
  function vincoliViolati(config) {
    const fuori = [];
    for (const v of catalogo.vincoliMisura) {
      if (!latoSoddisfatto(config, v.quando)) continue;
      const valore = config[v.misura];
      if (v.min != null && valore < v.min) fuori.push({ vincolo: v, valore, verso: 'min' });
      if (v.max != null && valore > v.max) fuori.push({ vincolo: v, valore, verso: 'max' });
    }
    return fuori;
  }

  /* --------------------------------------------------------
     Disponibilita': per ogni opzione, dice se e' selezionabile
     nello stato attuale e perche' no.

     Si simula la scelta e si guarda se la configurazione
     risultante viola qualcosa. E' il modo piu' semplice per
     essere sicuri che quello che l'interfaccia mostra e quello
     che il motore accetta siano la stessa cosa: e' letteralmente
     lo stesso controllo.
     -------------------------------------------------------- */
  function conScelta(config, idGruppo, idOpzione) {
    const g = gruppi.get(idGruppo);
    const copia = { ...config, accessori: [...(config.accessori || [])] };
    if (g.scelta === 'multipla') {
      const dentro = copia[idGruppo].includes(idOpzione);
      copia[idGruppo] = dentro
        ? copia[idGruppo].filter(x => x !== idOpzione)
        : [...copia[idGruppo], idOpzione];
    } else {
      copia[idGruppo] = idOpzione;
    }
    return copia;
  }

  function disponibilita(config) {
    const esito = {};
    for (const g of catalogo.gruppi) {
      esito[g.id] = {};
      for (const o of g.opzioni) {
        const selezionato = g.scelta === 'multipla'
          ? config[g.id].includes(o.id)
          : config[g.id] === o.id;

        // togliere un accessorio non puo' mai creare un problema
        if (g.scelta === 'multipla' && selezionato) {
          esito[g.id][o.id] = { disponibile: true, selezionato };
          continue;
        }

        const ipotesi = conScelta(config, g.id, o.id);
        const regole = regoleViolate(ipotesi);
        const misure = vincoliViolati(ipotesi);

        if (!regole.length && !misure.length) {
          esito[g.id][o.id] = { disponibile: true, selezionato };
        } else if (regole.length) {
          esito[g.id][o.id] = {
            disponibile: false, selezionato,
            perche: regole[0].perche, regola: regole[0].id
          };
        } else {
          const { vincolo, valore, verso } = misure[0];
          const limite = verso === 'min' ? vincolo.min : vincolo.max;
          const misura = catalogo.misure[vincolo.misura].etichetta.toLowerCase();
          esito[g.id][o.id] = {
            disponibile: false, selezionato, regola: vincolo.id,
            perche: `${vincolo.perche} Richiede ${misura} `
              + `${verso === 'min' ? 'almeno' : 'al massimo'} ${limite} mm, ora e' ${valore}.`
          };
        }
      }
    }
    return esito;
  }

  /* --------------------------------------------------------
     Intervallo ammesso per una misura nello stato attuale.
     Serve all'interfaccia per limitare i cursori invece di
     lasciar comporre una misura impossibile e bocciarla dopo.
     -------------------------------------------------------- */
  function intervallo(config, misura) {
    const base = catalogo.misure[misura];
    let min = base.min, max = base.max;
    const motivi = [];
    for (const v of catalogo.vincoliMisura) {
      if (v.misura !== misura) continue;
      if (!latoSoddisfatto(config, v.quando)) continue;
      if (v.min != null && v.min > min) { min = v.min; motivi.push(v); }
      if (v.max != null && v.max < max) { max = v.max; motivi.push(v); }
    }
    return { min, max, passo: base.passo, motivi };
  }

  function valida(config) {
    const regole = regoleViolate(config);
    const misure = vincoliViolati(config);
    const problemi = [
      ...regole.map(r => ({ tipo: 'regola', id: r.id, testo: r.perche })),
      ...misure.map(({ vincolo, valore, verso }) => ({
        tipo: 'misura', id: vincolo.id,
        testo: `${vincolo.perche} (${vincolo.misura} ${valore} mm, limite `
          + `${verso === 'min' ? '>=' : '<='} ${verso === 'min' ? vincolo.min : vincolo.max})`
      }))
    ];
    return { ok: problemi.length === 0, problemi };
  }

  /* --------------------------------------------------------
     Prezzo, riga per riga.

     La distinta esiste perche' un totale secco non si discute:
     un cliente che vede "1.240 euro" chiede lo sconto, uno che
     vede da cosa e' composto chiede di togliere il cassonetto.

     Due dettagli che sembrano cavilli e non lo sono:
     - l'area minima fatturabile e' prassi del settore, e va
       detta prima, non scoperta in fattura;
     - il rincaro della finitura si applica al solo profilo, non
       al vetro ne' agli accessori: la pellicola sta li'.
     -------------------------------------------------------- */
  function prezzo(config) {
    const areaReale = (config.larghezza * config.altezza) / 1e6;
    const area = Math.max(areaReale, catalogo.misure.areaMinimaFatturabile);
    const areaMinimaApplicata = area > areaReale + 1e-9;

    const profilo = opzioneDi('profilo', config.profilo);
    const vetro = opzioneDi('vetro', config.vetro);
    const apertura = opzioneDi('apertura', config.apertura);
    const colore = opzioneDi('colore', config.colore);

    const righe = [];
    const base = arrotonda(profilo.prezzoMq * area);
    righe.push({ voce: `${profilo.etichetta}`, dettaglio: `${profilo.prezzoMq} €/m² × ${area.toFixed(2)} m²`, importo: base });

    const rincaro = arrotonda(base * (colore.rincaro || 0));
    if (rincaro) righe.push({ voce: colore.etichetta, dettaglio: `+${Math.round(colore.rincaro * 100)}% sul profilo`, importo: rincaro });

    const costoVetro = arrotonda((vetro.prezzoMq || 0) * area);
    if (costoVetro) righe.push({ voce: vetro.etichetta, dettaglio: `${vetro.prezzoMq} €/m² × ${area.toFixed(2)} m²`, importo: costoVetro });

    const costoApertura = apertura.prezzo || 0;
    if (costoApertura) righe.push({ voce: apertura.etichetta, dettaglio: 'ferramenta e montaggio anta', importo: costoApertura });

    let costoAccessori = 0;
    for (const idAcc of config.accessori) {
      const a = opzioneDi('accessori', idAcc);
      if (!a) continue;
      costoAccessori += a.prezzo;
      righe.push({ voce: a.etichetta, dettaglio: a.dettaglio, importo: a.prezzo });
    }

    const perPezzo = arrotonda(base + rincaro + costoVetro + costoApertura + costoAccessori);
    const totalePezzi = arrotonda(perPezzo * config.quantita);

    const fascia = [...catalogo.sconti].filter(s => config.quantita >= s.da).pop() || null;
    const sconto = fascia ? arrotonda(totalePezzi * fascia.sconto) : 0;

    let costoServizi = 0;
    const righeServizi = [];
    for (const idServizio of config.servizi) {
      const s = catalogo.servizi.find(x => x.id === idServizio);
      if (!s) continue;
      const importo = arrotonda(s.prezzoPezzo * config.quantita);
      costoServizi += importo;
      righeServizi.push({ voce: s.etichetta, dettaglio: `${s.prezzoPezzo} € × ${config.quantita}`, importo });
    }

    const imponibile = arrotonda(totalePezzi - sconto + costoServizi);
    const regimeIva = catalogo.iva.find(i => i.id === config.iva) || catalogo.iva[0];
    const iva = arrotonda(imponibile * regimeIva.aliquota);

    return {
      area, areaReale, areaMinimaApplicata,
      righe, righeServizi,
      perPezzo, quantita: config.quantita, totalePezzi,
      fascia, sconto, costoServizi,
      imponibile, regimeIva, iva,
      totale: arrotonda(imponibile + iva)
    };
  }

  /* --------------------------------------------------------
     Applica una scelta e ripara.

     Le scelte singole incompatibili sono gia' bloccate da
     disponibilita(), quindi non arrivano qui. Gli accessori no:
     se uno passa a "fisso" con la zanzariera selezionata,
     bloccare l'apertura sarebbe assurdo — si toglie l'accessorio
     e si dice che e' stato tolto. Un cambiamento silenzioso al
     carrello e' il modo piu' rapido di perdere la fiducia di chi
     sta guardando il prezzo.
     -------------------------------------------------------- */
  function applica(config, idGruppo, idOpzione) {
    const nuova = conScelta(config, idGruppo, idOpzione);
    const rimossi = [];

    if (gruppi.get(idGruppo)?.scelta !== 'multipla') {
      for (const idAcc of [...nuova.accessori]) {
        const prova = { ...nuova, accessori: [idAcc] };
        if (regoleViolate(prova).length) {
          nuova.accessori = nuova.accessori.filter(x => x !== idAcc);
          const acc = opzioneDi('accessori', idAcc);
          const regola = regoleViolate(prova)[0];
          rimossi.push({ etichetta: acc.etichetta, perche: regola.perche });
        }
      }
    }
    return { config: nuova, rimossi };
  }

  return {
    catalogo, predefinita, disponibilita, intervallo, valida, prezzo, applica,
    opzioneDi, regoleViolate, vincoliViolati
  };
}
