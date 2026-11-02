# Adds the second round of 1.3.4 fixes to changelogs/1.3.4.md (all 8 languages).
import pathlib
p = pathlib.Path(__file__).resolve().parent.parent / "changelogs" / "1.3.4.md"
t = p.read_text(encoding="utf-8")
rep = [
 ("la scheda si ingrandisce, si colora,", "la scheda si illumina nel suo colore scuro (testo bianco sempre leggibile), resta dentro lo schermo,"),
 ("the card grows, fills with colour,", "the card lights up in a deep shade of its colour (white text always readable), stays inside the screen,"),
 ("la tarjeta crece, se colorea", "la tarjeta se ilumina en un tono oscuro de su color (texto blanco siempre legible), sin salirse de la pantalla,"),
 ("la carte grandit, se colore", "la carte s'illumine dans une teinte sombre de sa couleur (texte blanc toujours lisible), sans sortir de l'écran,"),
 ("Die Kachel wird größer, farbig", "Die Kachel leuchtet in einem dunklen Ton ihrer Farbe (weißer Text stets lesbar), bleibt im Bild"),
 ("o cartão aumenta, ganha cor,", "o cartão ilumina-se num tom escuro da sua cor (texto branco sempre legível), sem sair do ecrã,"),
 ("cardul se mărește, se colorează,", "cardul se luminează într-o nuanță închisă a culorii sale (text alb mereu lizibil), fără să iasă din ecran,"),
 ("kart büyüyor, renkleniyor,", "kart kendi renginin koyu tonunda parlıyor (beyaz yazı her zaman okunur), ekranın dışına taşmıyor,"),
]
for a, b in rep:
    assert a in t, a
    t = t.replace(a, b, 1)
extra = [
 ("  invece di tornare indietro.\n", "- Account (TV): il codice QR per gestire le playlist dal sito è affiancato ai dati del\n  dispositivo e resta sempre visibile per intero.\n- Film e Serie TV: rimossi canali, liste di canali (es. \"Canali tematici\", \"Movie Select\n  1 4K\") e copertine che il fornitore mette per errore tra film e serie; tolti gli anni\n  impossibili dai filtri (es. \"Anno: 2087\"). Vale anche per il catalogo già salvato.\n"),
 ("  going back in time.\n", "- Accounts (TV): the QR code for managing playlists on the website sits beside the device\n  details and is always fully visible.\n- Movies and TV Series: channels, channel lists (e.g. \"Canali tematici\", \"Movie Select\n  1 4K\") and covers the provider files among films and series by mistake are removed;\n  impossible years are gone from the filters (e.g. \"Year: 2087\"). Applies to the saved\n  catalog too.\n"),
 ("  lugar de retroceder.\n", "- Cuentas (TV): el código QR para gestionar las listas desde la web está junto a los datos\n  del dispositivo y siempre se ve entero.\n- Películas y Series: se eliminan canales, listas de canales y portadas que el proveedor\n  coloca por error entre películas y series; fuera los años imposibles de los filtros.\n"),
 ("  revenir en arrière.\n", "- Comptes (TV) : le code QR pour gérer les playlists sur le site est à côté des infos de\n  l'appareil et toujours visible en entier.\n- Films et Séries : les chaînes, listes de chaînes et vignettes rangées par erreur parmi\n  les films et séries sont retirées ; les années impossibles disparaissent des filtres.\n"),
 ("  zurückzuspulen.\n", "- Konten (TV): Der QR-Code zur Playlist-Verwaltung auf der Website steht neben den\n  Gerätedaten und ist immer vollständig sichtbar.\n- Filme und Serien: Sender, Senderlisten und Cover, die der Anbieter fälschlich unter\n  Filme und Serien einordnet, werden entfernt; unmögliche Jahre verschwinden aus den Filtern.\n"),
 ("  recuar.\n", "- Contas (TV): o código QR para gerir as listas no site fica ao lado dos dados do\n  dispositivo e vê-se sempre inteiro.\n- Filmes e Séries: removidos canais, listas de canais e capas que o fornecedor coloca\n  por engano entre filmes e séries; anos impossíveis retirados dos filtros.\n"),
 ("  loc să dea înapoi.\n", "- Conturi (TV): codul QR pentru gestionarea playlisturilor pe site stă lângă datele\n  dispozitivului și se vede mereu întreg.\n- Filme și Seriale: sunt eliminate canalele, listele de canale și copertele puse din\n  greșeală de furnizor printre filme și seriale; anii imposibili dispar din filtre.\n"),
 ("yayına yeniden bağlanır.\n", "yayına yeniden bağlanır.\n- Hesaplar (TV): web sitesinden liste yönetimi için QR kodu cihaz bilgilerinin yanında\n  ve her zaman tamamen görünür.\n- Filmler ve Diziler: sağlayıcının yanlışlıkla film ve diziler arasına koyduğu kanallar,\n  kanal listeleri ve kapaklar kaldırıldı; imkânsız yıllar filtrelerden çıkarıldı.\n"),
]
for a, b in extra:
    assert a in t, a
    t = t.replace(a, b if b.startswith(a.strip()) or not a.startswith("  ") else a + b, 1)
p.write_text(t, encoding="utf-8")
