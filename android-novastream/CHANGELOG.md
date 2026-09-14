# NovaStream — Changelog

## 1.2.6

### Italiano

**Novità**

- **Descrizione dei film e delle serie.** Aprendo un titolo in Film o Serie ora
  compaiono la trama, i generi, il cast, il regista, la durata, l'anno di uscita e
  il voto, quando il provider li fornisce. Le trame lunghe si aprono con "Leggi
  tutto" e l'immagine di copertina usa lo sfondo panoramico quando disponibile.
- **Controllo genitori completo.** Nelle Impostazioni trovi ora una sezione con
  una riga per Live, Film e Serie: da ognuna scegli quali categorie nascondere
  dietro al PIN. L'elenco è a tutta altezza, con ricerca e i pulsanti "Blocca
  tutte" / "Sblocca tutte". Dalla Home il pulsante "Sblocca" chiede il PIN e
  rivela le categorie protette fino alla chiusura dell'app.
- **Picture-in-picture.** Sul telefono il player ha un nuovo pulsante che riduce
  il video a una finestrella in un angolo dello schermo: puoi rispondere a un
  messaggio o usare un'altra app continuando a guardare.
- **Cancella e riscarica tutto.** Nelle Impostazioni, sotto "Aggiorna la lista",
  c'è un nuovo pulsante che elimina canali, film e serie salvati sul dispositivo
  e riscarica la lista del provider da zero. Serve quando il provider aggiunge
  canali nuovi che non comparivano. Preferiti, cronologia e licenza non si toccano.
- **Tema scuro come impostazione predefinita** su tutti i dispositivi. Resta
  modificabile in Impostazioni → Aspetto (Automatico, Chiaro, Scuro).
- **Home rinnovata e più colorata.** Nuova intestazione con sfumatura, stato della
  playlist in evidenza e schede Live / Film / Serie con il colore della sezione.
- **Valutazione dell'app.** NovaStream usa ora la finestra ufficiale di Google
  Play, mostrata solo dopo alcuni giorni di utilizzo e mai più di una volta ogni
  quattro mesi. Nessuna domanda preventiva e nessun invito insistente.
- **Cancellazione dei dati dal sito.** Su novastream.rork.app/assistenza c'è una
  nuova sezione per chiedere la cancellazione di licenza, ordini, email e richieste
  di assistenza, con avviso chiaro e conferma esplicita.

**Correzioni**

- **Finestra delle categorie vuota nella sezione Live.** Il pannello si apriva
  senza alcuna categoria: ora l'elenco viene sempre mostrato e scorre fino
  all'ultima voce.
- **Frecce del telecomando che sparivano aprendo le categorie.** Non serve più
  premere OK sulla prima categoria per poter scorrere: il fuoco entra subito
  nell'elenco e le frecce funzionano dalla prima pressione.
- **Canali nuovi mancanti dopo un aggiornamento della lista** — risolto con la
  nuova funzione "Cancella e riscarica tutto".

**Sotto il cofano**

- Migrazione alle API moderne per la visualizzazione a tutto schermo (edge-to-edge):
  rimossi `Window.setStatusBarColor`, `Window.setNavigationBarColor` e la modalità
  ritaglio deprecata, segnalati da Android 15.
- Attivata l'ottimizzazione avanzata delle risorse di R8: pacchetto più leggero,
  meno memoria occupata e avvio più rapido.
- Versione applicazione aggiornata a 1.2.6.

### English

**New**

- **Film and series descriptions.** Opening a title in Movies or Series now shows
  the plot, genres, cast, director, running time, release year and rating whenever
  the provider supplies them. Long synopses expand with "Read more", and the cover
  uses the wide backdrop artwork when available.
- **Full parental control.** Settings now has a row for Live, Movies and Series;
  each opens the categories of that section so you choose exactly what sits behind
  the PIN. The list is full height, searchable, with "Block all" / "Unblock all".
  On Home, "Unlock" asks for the PIN and reveals the protected categories until the
  app is closed.
- **Picture-in-picture.** On a phone the player has a new button that shrinks the
  video into a small window in the corner of the screen, so you can reply to a
  message or use another app while still watching.
- **Erase and download again.** Under "Update the list" in Settings there is a new
  button that deletes every channel, film and series saved on the device and
  imports the provider list from scratch — the fix for new channels that never
  appeared. Favourites, history and your licence are untouched.
- **Dark theme by default** on every device, still switchable in Settings →
  Appearance (Automatic, Light, Dark).
- **Reworked, more colourful Home** with a new gradient header, the playlist status
  in plain view and Live / Movies / Series cards tinted with their own colour.
- **App rating.** NovaStream now uses Google Play's official prompt, shown only
  after a few days of real use and never more than once every four months. No
  leading question beforehand, no nagging.
- **Data deletion on the website.** novastream.rork.app/assistenza has a new
  section to request erasure of your licence, orders, email address and support
  requests, with a clear warning and an explicit confirmation.

**Fixes**

- **Empty category sheet on the Live screen.** The panel opened with no categories
  at all; the list is now always shown and scrolls to the last entry.
- **Remote arrows stopped working when the categories opened.** You no longer have
  to press OK on the first category before you can scroll: focus lands inside the
  list and the arrows work on the first press.
- **New channels missing after a list update** — addressed by the new "Erase and
  download again" action.

**Under the hood**

- Migrated to the modern edge-to-edge APIs: removed `Window.setStatusBarColor`,
  `Window.setNavigationBarColor` and the deprecated display-cutout mode flagged by
  Android 15.
- Enabled R8 optimized resource shrinking: smaller download, lower memory use and
  a faster start.
- App version updated to 1.2.6.

### Español

**Novedades**

- **Descripción de películas y series:** sinopsis, géneros, reparto, dirección,
  duración, año y valoración cuando el proveedor los envía.
- **Control parental completo:** una fila para Directo, Películas y Series; en cada
  una eliges las categorías que quedan tras el PIN, con buscador y acciones
  "Bloquear todas" / "Desbloquear todas". Desde el inicio, "Desbloquear" pide el
  PIN y muestra las categorías protegidas hasta cerrar la app.
- **Imagen en imagen** en el móvil: el vídeo sigue en una ventanita mientras usas
  otra aplicación.
- **Borrar y descargar de nuevo:** elimina la lista guardada e importa la del
  proveedor desde cero, para recuperar los canales nuevos que no aparecían.
  Favoritos, historial y licencia no se tocan.
- **Tema oscuro por defecto**, modificable en Ajustes → Apariencia.
- **Inicio renovado y más colorido.**
- **Valoración de la app** con la ventana oficial de Google Play, solo tras varios
  días de uso.
- **Eliminación de datos** desde novastream.rork.app/assistenza.

**Correcciones**

- La ventana de categorías de Directo salía vacía.
- Las flechas del mando dejaban de funcionar al abrir las categorías.
- Canales nuevos que faltaban tras actualizar la lista.

**Además:** migración a las API modernas de pantalla completa (edge-to-edge),
optimización avanzada de recursos con R8 y versión actualizada a 1.2.6.

### Français

**Nouveautés**

- **Description des films et des séries :** synopsis, genres, casting, réalisation,
  durée, année et note lorsque le fournisseur les transmet.
- **Contrôle parental complet :** une ligne pour Direct, Films et Séries ; dans
  chacune vous choisissez les catégories protégées par le code PIN, avec recherche
  et boutons « Tout bloquer » / « Tout débloquer ». Depuis l'accueil, «
  Déverrouiller » demande le code et révèle les catégories jusqu'à la fermeture.
- **Image dans l'image** sur téléphone : la vidéo continue dans une petite fenêtre
  pendant que vous utilisez une autre application.
- **Effacer et retélécharger :** supprime la liste enregistrée et réimporte celle
  du fournisseur de zéro, pour récupérer les chaînes récentes manquantes. Favoris,
  historique et licence sont préservés.
- **Thème sombre par défaut**, modifiable dans Réglages → Apparence.
- **Accueil repensé et plus coloré.**
- **Évaluation de l'application** via la fenêtre officielle de Google Play,
  proposée seulement après quelques jours d'utilisation.
- **Suppression des données** depuis novastream.rork.app/assistenza.

**Corrections**

- La fenêtre des catégories du Direct s'ouvrait vide.
- Les flèches de la télécommande ne répondaient plus à l'ouverture des catégories.
- Chaînes récentes absentes après une mise à jour de la liste.

**Par ailleurs :** migration vers les API modernes plein écran (edge-to-edge),
optimisation avancée des ressources avec R8, version portée à 1.2.6.

### Deutsch

**Neu**

- **Beschreibungen für Filme und Serien:** Handlung, Genres, Besetzung, Regie,
  Laufzeit, Jahr und Bewertung, sofern der Anbieter sie liefert.
- **Vollständige Kindersicherung:** je eine Zeile für Live, Filme und Serien; dort
  wählen Sie die Kategorien hinter der PIN, mit Suche und „Alle sperren" / „Alle
  freigeben". Auf der Startseite fragt „Entsperren" die PIN ab und zeigt die
  geschützten Kategorien, bis die App geschlossen wird.
- **Bild-in-Bild** auf dem Smartphone: Das Video läuft in einem kleinen Fenster
  weiter, während Sie eine andere App nutzen.
- **Löschen und neu laden:** verwirft die gespeicherte Liste und importiert die des
  Anbieters komplett neu — die Lösung für fehlende neue Sender. Favoriten, Verlauf
  und Lizenz bleiben erhalten.
- **Dunkles Design als Standard**, änderbar unter Einstellungen → Darstellung.
- **Neu gestaltete, farbigere Startseite.**
- **App-Bewertung** über das offizielle Google-Play-Fenster, erst nach einigen
  Tagen Nutzung.
- **Datenlöschung** über novastream.rork.app/assistenza.

**Behoben**

- Das Kategorienfenster im Live-Bereich war leer.
- Die Fernbedienungstasten reagierten beim Öffnen der Kategorien nicht.
- Neue Sender fehlten nach einer Listenaktualisierung.

**Außerdem:** Umstellung auf die modernen Edge-to-Edge-APIs, optimiertes
R8-Ressourcen-Shrinking und Version 1.2.6.

### Português

**Novidades**

- **Descrição de filmes e séries:** sinopse, géneros, elenco, realização, duração,
  ano e classificação quando o fornecedor os envia.
- **Controlo parental completo:** uma linha para Direto, Filmes e Séries; em cada
  uma escolhe as categorias protegidas pelo PIN, com pesquisa e botões "Bloquear
  todas" / "Desbloquear todas". No início, "Desbloquear" pede o PIN e mostra as
  categorias protegidas até fechar a app.
- **Imagem na imagem** no telemóvel: o vídeo continua numa janela pequena enquanto
  usa outra aplicação.
- **Apagar e transferir de novo:** elimina a lista guardada e importa a do
  fornecedor de raiz, para recuperar os canais novos em falta. Favoritos, histórico
  e licença ficam intactos.
- **Tema escuro por predefinição**, alterável em Definições → Aspeto.
- **Início renovado e mais colorido.**
- **Avaliação da app** através da janela oficial do Google Play, só após alguns
  dias de utilização.
- **Eliminação de dados** em novastream.rork.app/assistenza.

**Correções**

- A janela de categorias do Direto abria vazia.
- As setas do comando deixavam de funcionar ao abrir as categorias.
- Canais novos em falta após atualizar a lista.

**Além disso:** migração para as APIs modernas de ecrã inteiro (edge-to-edge),
otimização avançada de recursos com R8 e versão 1.2.6.

### Română

**Noutăți**

- **Descrierea filmelor și serialelor:** subiect, genuri, distribuție, regie,
  durată, an și notă, atunci când furnizorul le trimite.
- **Control parental complet:** câte un rând pentru Live, Filme și Seriale; în
  fiecare alegi categoriile ascunse în spatele PIN-ului, cu căutare și butoanele
  „Blochează tot" / „Deblochează tot". Din ecranul principal, „Deblochează" cere
  PIN-ul și arată categoriile protejate până la închiderea aplicației.
- **Imagine în imagine** pe telefon: filmul continuă într-o fereastră mică în timp
  ce folosești altă aplicație.
- **Șterge și descarcă din nou:** elimină lista salvată și importă de la zero lista
  furnizorului, pentru canalele noi care lipseau. Favoritele, istoricul și licența
  rămân neatinse.
- **Temă întunecată implicit**, schimbabilă din Setări → Aspect.
- **Ecran principal reînnoit și mai colorat.**
- **Evaluarea aplicației** prin fereastra oficială Google Play, doar după câteva
  zile de utilizare.
- **Ștergerea datelor** de pe novastream.rork.app/assistenza.

**Remedieri**

- Fereastra de categorii din secțiunea Live se deschidea goală.
- Săgețile telecomenzii nu mai răspundeau la deschiderea categoriilor.
- Canale noi lipsă după actualizarea listei.

**În plus:** trecerea la API-urile moderne edge-to-edge, optimizarea avansată a
resurselor cu R8 și versiunea 1.2.6.

### Türkçe

**Yenilikler**

- **Film ve dizi açıklamaları:** sağlayıcı gönderdiğinde konu, türler, oyuncular,
  yönetmen, süre, yıl ve puan.
- **Eksiksiz ebeveyn kontrolü:** Canlı, Filmler ve Diziler için ayrı satırlar; her
  birinde PIN'in arkasına gizlenecek kategorileri seçersiniz; arama ve „Tümünü
  engelle" / „Tüm engelleri kaldır" düğmeleriyle. Ana ekranda „Kilidi aç" PIN
  sorar ve korunan kategorileri uygulama kapanana kadar gösterir.
- **Resim içinde resim:** telefonda video köşedeki küçük bir pencerede devam eder,
  siz başka bir uygulamayı kullanırken.
- **Sil ve yeniden indir:** kayıtlı listeyi siler ve sağlayıcının listesini
  sıfırdan indirir — görünmeyen yeni kanalların çözümü. Favoriler, geçmiş ve
  lisansınız etkilenmez.
- **Varsayılan koyu tema**, Ayarlar → Görünüm'den değiştirilebilir.
- **Yenilenmiş, daha renkli ana ekran.**
- **Uygulama değerlendirmesi** resmî Google Play penceresiyle, yalnızca birkaç
  günlük kullanımdan sonra.
- **Veri silme** novastream.rork.app/assistenza üzerinden.

**Düzeltmeler**

- Canlı bölümünde kategori penceresi boş açılıyordu.
- Kategoriler açıldığında kumanda okları çalışmayı bırakıyordu.
- Liste güncellemesinden sonra eksik kalan yeni kanallar.

**Ayrıca:** modern edge-to-edge API'lerine geçiş, R8 ile gelişmiş kaynak
optimizasyonu ve 1.2.6 sürümü.

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
