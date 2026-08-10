# Identità AM — archivio di progetto

Agosto 2026. Rifacimento del marchio, da monogramma monolinea a marchio unico.
**Niente qui dentro serve al sito**: è l'archivio della ricerca più i generatori
degli asset. Gli asset veri stanno in `assets/` e sono *generati*, non scritti a
mano — vedi "Rigenerare".

## La direzione

Tre scelte fatte all'inizio, che spiegano perché il marchio è così:

| Domanda | Risposta |
|---|---|
| Personalità | Solido e istituzionale |
| Focus | Le iniziali AM |
| Riferimento | HashiCorp / Terraform — geometria modulare, monocromatico, forte a 16px |

Poi una correzione in corsa, importante: la prima tornata (`c1`…`c5`) metteva A e M
**affiancate**. Non era quello che serviva — la richiesta era *«che si intreccino,
che non siano solo le due iniziali una di fianco all'altra, che crei proprio un
logo unico»*. Da lì la seconda tornata (`n1`…`n3`), tutta su marchi in cui le due
lettere condividono le stesse aste.

## Il marchio consegnato

Uno **zigzag a due picchi** — due picchi con una valle in mezzo si leggono come M —
**spezzato da una luce di 1.6 sulla valle centrale**. Il picco sinistro porta la
traversa e diventa A. Non c'è una A e poi una M: c'è una forma sola letta due volte.

Sistema geometrico (viewBox `0 0 64 64`):

- riquadro del marchio: x 8..56, y 14..50 — 8 di margine per lato, i picchi
  arrivano a 14, i piedi a 50
- pendenza unica: 10 orizzontali su 36 verticali (≈15.5° dalla verticale), la
  stessa per tutti e quattro i tratti
- spessore dei moduli: 8 in orizzontale
- vertice della A (incrocio dei bordi interni): y 28.4, cioè al 40% dell'altezza
- traversa: y 36.5..43, a filo del bordo esterno sinistro (x 11.75) e della luce (x 31.2)
- luce sulla valle: 1.6, da y 32.72 al piede
- tutti i tagli sono piatti, nessuna curva, nessun raccordo

**La luce sta solo sulla valle, non sui picchi.** La versione con la luce su tutti
e tre gli incroci (`n3-moduli.svg`) è quella scelta in prima battuta, ma a 200px
faceva leggere quattro barre parallele invece di due picchi: la M spariva. I picchi
pieni la restituiscono e il carattere "assemblato" resta comunque. Non riaprire
quella strada senza rivedere prima `n3-moduli.svg` a dimensione piena.

A 16px la luce si chiude e il marchio degrada su una sagoma piena: è il
comportamento voluto, non un difetto.

## Il wordmark

Maiuscole geometriche disegnate apposta sulle regole del marchio: tagli piatti,
nessuna curva — **la O è un ottagono con smusso 4**, non un cerchio. Definite in
uno spazio normalizzato con altezza maiuscola 20 e asta 4, poi scalate da `K`
attorno all'asse orizzontale del marchio. Con `K = 1.2` l'altezza finale è 24.

Per cambiare la dimensione del wordmark si tocca **solo `K`** in `build/build_logo.py`.
Gli avanzamenti in `LAYOUT` sono calibrati a occhio sulle coppie critiche: AN
stretta (la A apre in alto e va recuperata), I ariosa da entrambi i lati, spazio
di parola 10.

## Rigenerare

Gli asset in `assets/` non vanno modificati a mano: si rigenerano.

```bash
python3 logo-explore/build/build_logo.py && python3 logo-explore/build/build_raster.py
```

- `build_logo.py` → `assets/logo.svg`, `favicon.svg`, `logo-mark.svg` (in
  `currentColor`, quello usato inline nell'header), `logo-lockup.svg` e
  `logo-lockup-dark.svg`
- `build_raster.py` → `favicon.ico` (16/32/48, payload PNG) e
  `assets/apple-touch-icon.png` (180px, **al vivo e opaco**: iOS applica già la sua
  maschera, un raccordo nostro darebbe un doppio arrotondamento; marchio all'88%
  per stare nella safe area)

Solo stdlib, nessuna dipendenza. Il marchio è definito una volta sola in
`MARK` dentro `build_logo.py` — e ripetuto come poligoni in `build_raster.py`,
che è l'unico punto di duplicazione: se cambi la geometria, cambiala in tutti e due.

Il marchio è inline in 11 pagine HTML (non caricato da file): se cambia la
geometria vanno riallineate. Si trovano con `grep -rn "M8 50 L18 14" --include=*.html .`

## Vedere il risultato

Su questa macchina **non c'è un rasterizzatore** (niente rsvg, inkscape, PIL,
cairosvg, chrome). I tool in `build/` risolvono il problema in stdlib pura, e sono
il motivo per cui i problemi di leggibilità sono venuti fuori prima della consegna:

```bash
python3 logo-explore/build/svgview.py assets/logo.svg 64    # anteprima ASCII nel terminale
python3 logo-explore/build/svgview.py assets/logo.svg 20    # controllo a misura favicon
python3 logo-explore/build/svg2png.py assets/logo.svg out.png 256 --bg=ffffff
python3 logo-explore/build/strip.py cmp.png a.png b.png c.png   # affianca per confronto
```

`svgview.py` disegna anche i tratti (approssimati a giunzioni tonde: un `butt`/`miter`
reale verrà più squadrato di quel che mostra). `svg2png.py` gestisce solo i
riempimenti, che è quello che serve qui.

`preview.html` + `variants.js` mostrano tutte le varianti a più dimensioni e in
contesto (tab del browser, header chiaro e scuro); si ricaricano da sole ogni 3
secondi mentre lavori. Si apre con `xdg-open logo-explore/preview.html`.

## Cosa è stato scartato, e perché

| File | Cos'è | Perché no |
|---|---|---|
| `c1-grafite.svg` | A e M affiancate, costruzione modulare | Due lettere accostate, non un marchio unico |
| `c2-innesto.svg` | Legatura a montante condiviso | La A con la gamba destra verticale ha la controforma troppo stretta |
| `c3-sigillo.svg` | Figura-fondo invertito su piastra smeraldo | Cambia il colore dominante dell'header, oggi tile grafite |
| `c4-basamento.svg` | Monogramma su base piena | Bello grande, ma la base a 16px diventa una riga sporca |
| `c5-modulo.svg` | Evoluzione monolinea del marchio vecchio | Troppo vicino al punto di partenza |
| `n1-intreccio.svg` | M canonica con la A ricavata dentro | La M si legge benissimo, la A resta un dettaglio interno |
| `n2-catena.svg` | Lo zigzag senza nessuna luce | Lettura ottima ma perde il carattere "assemblato" |
| `n3-moduli.svg` | Zigzag con luce su tutti e tre gli incroci | Vedi sopra: a dimensione piena la M sparisce |
| `n3a-luce-fine.svg` | Come n3 ma luce 1.0 | Attenua poco: a 200px legge quasi come n3 |
| `n3b-luce-valle.svg` | **Il consegnato** | — |
