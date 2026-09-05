# NovaStream — Changelog

## 1.2.2 (versionCode 5)

### Italiano

**Novità**

- **Codice QR per l'acquisto in modalità TV.** Nelle Impostazioni e nel banner del
  periodo di prova, il pulsante per acquistare la licenza ora apre una finestra con
  un codice QR grande da inquadrare col telefono: il link contiene già l'ID di
  questo dispositivo. Sul telefono il pulsante continua ad aprire direttamente il
  sito, come prima.
- **Guida TV dentro il player live.** Mentre guardi un canale vedi il programma in
  onda, l'orario di inizio e fine, la barra di avanzamento e cosa va in onda dopo.
  Le informazioni restano visibili quando metti in pausa e si aggiornano subito
  quando cambi canale. Se il canale non ha guida, viene detto chiaramente.
- **Categorie anche sui canali live.** Il pulsante con le tre linee nella schermata
  Live apre l'elenco delle categorie del provider, come già succede su Film e Serie.

**Correzioni**

- **Dati persi dopo uno stacco di corrente sul TV Box.** Al riavvio l'app poteva
  ripartire senza credenziali, senza lista canali e con la licenza a vita sostituita
  dai 7 giorni di prova. Tre cause risolte:
  - la chiave di cifratura di sistema veniva svuotata dallo spegnimento improvviso:
    ora è custodita con un secondo lucchetto legato a questa installazione su questo
    hardware, e viene ricostruita da sola;
  - le scritture restavano in sospeso nella memoria di sistema: credenziali, licenza,
    impostazioni, identità del dispositivo e catalogo vengono ora forzate su disco e
    lo scambio del file è reso definitivo prima di dichiarare il salvataggio riuscito;
  - l'identità del dispositivo, a cui è legata la licenza, poteva sparire: ora è
    salvata in modo durevole e ricostruibile dall'indirizzo di rete del box.
- **Orologio del TV Box non impostato.** Un box acceso con una data sbagliata non fa
  più scadere né "non verificare" una licenza valida.
- **Scorrimento dell'elenco categorie.** Le categorie oltre il bordo dello schermo
  non si raggiungevano: la finestra ora si apre a tutta altezza e l'elenco scorre
  fino all'ultima voce, con il conteggio delle categorie in cima.
- **Tastiera che si apriva da sola in modalità TV.** Passando con le frecce sulla
  barra di ricerca la tastiera non compare più: si apre solo premendo OK e si chiude
  con INDIETRO. Sotto il campo compare il suggerimento "Premi OK per scrivere".
- **Fuoco del telecomando più visibile** su barra di ricerca, pulsante filtro e voci
  delle categorie.

**Altro**

- Versione applicazione aggiornata a 1.2.2 (Impostazioni e configurazione di build).

### English

**New**

- **QR code purchase on TV.** In Settings and in the trial banner, the buy-licence
  button now opens a dialog with a large QR code to scan with your phone; the link
  already carries this device's ID. On a phone the button still opens the website
  directly, as before.
- **TV guide inside the live player.** While watching a channel you see the
  programme on air, its start and end time, a progress bar and what comes next. The
  information stays on screen while paused and refreshes as soon as you change
  channel. Channels without guide data say so plainly.
- **Categories for live channels.** The three-line button on the Live screen now
  opens the provider's category list, exactly like Movies and Series.

**Fixes**

- **Data lost after a power cut on a TV box.** The app could restart with no
  credentials, no channel list and a lifetime licence replaced by a 7-day trial.
  Three causes fixed:
  - the system encryption key was wiped by the abrupt shutdown: it is now held under
    a second lock tied to this installation on this hardware and rebuilds itself;
  - writes were left pending in the system cache: credentials, licence, settings,
    device identity and catalogue are now forced to disk, and the file swap is made
    permanent before a save is considered done;
  - the device identity the licence is bound to could disappear: it is now stored
    durably and can be rebuilt from the box's network address.
- **Unset clock on a TV box.** A box starting with the wrong date can no longer
  expire a valid licence or mark it as unverified.
- **Category list scrolling.** Categories past the bottom of the screen could not be
  reached: the sheet now opens full height and scrolls to the last entry, with the
  category count shown at the top.
- **Keyboard opening by itself on TV.** Moving the highlight onto the search bar no
  longer opens the on-screen keyboard: it opens only on OK and closes with BACK, and
  the field shows a "Press OK to type" hint.
- **Clearer remote-control focus** on the search bar, the filter button and the
  category rows.

**Other**

- App version updated to 1.2.2 (Settings screen and build configuration).
