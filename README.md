# Distinta

Configuratore di prodotto su misura: scegli misure e opzioni, il disegno tecnico si
ridisegna con le quote, le combinazioni che non si possono fabbricare si spengono
**dicendo perché**, e il prezzo si scompone voce per voce.

Terzo caso studio del laboratorio di [17Labs](https://17labs.it).

## Il problema

È la cosa che le PMI manifatturiere italiane chiedono più spesso e trovano meno. Chi
vende serramenti, cancelli o arredo su misura passa le giornate a rifare a mano lo
stesso preventivo, e ogni combinazione impossibile scoperta tardi è un ordine che
torna indietro dall'officina.

I configuratori che si trovano hanno due difetti ricorrenti, e sono gli stessi due
che questo progetto affronta.

## Le due idee

**Le incompatibilità sono simmetriche.** Se scegli prima il vetro triplo sparisce il
profilo da 60; se scegli prima il profilo da 60 sparisce il vetro triplo. Un
configuratore che ne gestisce una direzione sola ti costringe a tornare indietro e
indovinare quale scelta ti ha bloccato.

**Ogni opzione spenta dice il motivo.** *«Il vetro triplo è spesso 44 mm: il
fermavetro del profilo da 60 arriva a 34.»* Un'opzione grigia senza spiegazione viene
letta come un guasto del sito, e chi sta comprando se ne va.

Con un corollario che sembra un dettaglio e non lo è: **un accessorio non blocca mai
una scelta principale.** Se hai messo la zanzariera e poi vuoi il serramento fisso, è
la zanzariera che se ne va — e la pagina lo dice. Il contrario significherebbe
mettere un optional davanti al prodotto.

## I numeri

| | |
|---|---|
| Combinazioni di opzioni, **enumerate tutte** | 2.560 |
| Valide secondo le regole | 664 |
| Stati raggiungibili cliccando | 664 |
| **Stati impossibili raggiungibili** | **0** |
| Mosse esplorate nella visita | 10.616 |
| Controlli superati | 3.291 / 3.291 |

## La verifica, su tre livelli

```bash
npm test
```

**1. Attese scritte a mano.** Diciannove casi di regola e sei di prezzo, calcolati con
la calcolatrice leggendo il catalogo. È il solo oracolo vero: dice cosa *deve*
succedere, non cosa succede.

**2. Enumerazione esaustiva.** Tutte le 2.560 combinazioni, confrontate con un
controllore scritto a parte che applica le regole del catalogo direttamente. Non è un
oracolo indipendente — se avessi capito male una regola sbaglierei due volte — ma
prende gli errori di programmazione, che sono la maggioranza.

**3. Raggiungibilità.** Si visita tutto lo spazio partendo dalla configurazione
iniziale e muovendosi **solo** sulle opzioni che il motore dichiara disponibili, poi si
verifica che nessuno stato raggiunto sia invalido.

È il livello che conta. Non dice "ho provato qualche caso": dimostra che **nessuno,
cliccando, può comporre un prodotto che non si fabbrica**. E vale perché le opzioni
spente le decide `disponibilita()`, cioè esattamente la funzione che la visita
percorre: se lo decidesse l'interfaccia, il numero non varrebbe niente.

### Cosa ha trovato

Alla prima esecuzione, prima ancora che esistesse un'interfaccia: **la configurazione
predefinita del catalogo violava un vincolo del catalogo stesso** — 1200 mm di
larghezza con un'anta singola, che ne ammette 1000. Il configuratore si sarebbe aperto
su un prodotto non fabbricabile, e il primo prezzo mostrato sarebbe stato di quello.

## Il prodotto non è nel codice

Opzioni, prezzi, incompatibilità e vincoli dimensionali stanno in `catalogo.json`. Per
configurare un cancello invece di una finestra si riscrive quel file e il motore non
si tocca. Anche le tinte del disegno e lo spessore del telaio sono dati.

```
catalogo.json       il prodotto: opzioni, regole, prezzi, vincoli
configuratore.js    disponibilita, validita, prezzo, riparazione  (condiviso)
verifica.mjs        i tre livelli di verifica                     (Node)
prove.json          25 attese calcolate a mano
index.html          la pagina
stile.css           il tema, autonomo
app.js              comandi, disegno tecnico, distinta, collegamento
```

**`configuratore.js` è un file solo**, usato da Node durante le prove e dal browser a
ogni clic. Se la logica fosse scritta due volte, le due versioni divergerebbero senza
che niente fallisca — cambierebbe solo il prezzo mostrato.

## Il disegno

Le unità del sistema di coordinate sono **millimetri veri**: il disegno è in scala,
non è una figura simbolica. Una finestra stretta e alta si vede stretta e alta, che è
il primo controllo che fa chiunque guardi un preventivo. Il vertice del triangolo sta
sul lato della cerniera, come nei disegni di serramenti.

I tratti usano `non-scaling-stroke`: lo spessore resta costante in pixel qualunque sia
la misura, altrimenti su un serramento da 2400 mm le linee sparirebbero.

## Il collegamento condivisibile

Ogni configurazione ha il suo indirizzo. In una trattativa la frase che si dice è
«mandami il link di quella configurazione», e senza si finisce a descriverla a parole.
Sta nel frammento e non nella query, così non viene inviato a nessun server nemmeno
per sbaglio. Un collegamento che descrive una configurazione non più possibile — perché
il catalogo è cambiato — non viene caricato a forza: si riparte dai predefiniti e lo si
dice.

## Autonomo

Nessun percorso esce dalla cartella, nessun file condiviso con il sito di 17Labs,
nessuna richiesta a domini esterni. I caratteri sono quelli di sistema.

Il tema è il quarto di fila e non somiglia agli altri tre: il sito è inchiostro e
ottone, Norma è carta calda e amaranto in graziato, Estratto è ardesia e verde
contabile tabulare, qui è **cemento e arancio segnaletico**, da banco di lavoro.

Sull'arancio, una nota: l'arancio vivo `#e2600d` su fondo chiaro dà 3,57:1, sotto la
soglia per il testo. Perciò ce ne sono due — uno vivo per le campiture e il disegno,
uno bruciato `#b04405` per testo e bordi. Contrasto verificato: **121 elementi, nessuno
sotto la soglia WCAG AA nei due temi**, minimo 4,76.

## Provare

Doppio click su **`anteprima.cmd`** (server locale sulla porta 8183). Serve un server:
da `file://` il browser blocca i moduli JavaScript e la lettura del catalogo. La pagina
se ne accorge e lo spiega, invece di restare muta.

## Cosa non è

I prezzi sono **inventati e verosimili**, non un listino reale, e il preventivo che
esce non impegna nessuno. È una dimostrazione di come funziona la logica, non un
prodotto in vendita.

Manca la parte che in un impianto vero verrebbe dopo: l'invio del preventivo, la
persistenza delle configurazioni e il collegamento al gestionale per giacenze e ordini.
Sono le cose che richiedono un server, ed è esattamente il confine di questa
dimostrazione.

## Licenza

Il codice è sotto licenza **MIT** (vedi `LICENSE`).
