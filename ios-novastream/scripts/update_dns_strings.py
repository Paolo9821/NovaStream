#!/usr/bin/env python3
"""Adds the automatic encrypted DNS strings and rewords the credential notes
("only on this iPhone" instead of the Keychain) in every language table."""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent / "NovaStreamIPTV" / "Localization"

OLD_FOOTER = "iOS plays video with the iPhone's own DNS. Use this check to see whether your network hides the playlist server; to change the DNS of the whole iPhone, open Settings > Wi-Fi > (i) > Configure DNS."
FOOTER = "System default uses the iPhone's DNS and switches by itself to encrypted DNS (DNS-over-HTTPS) when your operator hides the playlist server. The other choices use encrypted DNS for playlists, TV guide and covers from the start."
NOTICE = "Your operator's DNS hides the playlist server: the app is using encrypted DNS."
OLD_ONBOARD = "Add m3u links or Xtream Codes accounts. Credentials stay in this iPhone's Keychain."
ONBOARD = "Add m3u links, Xtream Codes accounts or a private host. Credentials stay only on this iPhone."
OLD_STORED = "Credentials are stored only in this iPhone's Keychain."
STORED = "Credentials are stored only on this iPhone."

T = {
    "it": (
        "Predefinito di sistema usa il DNS dell'iPhone e passa da solo al DNS cifrato (DNS-over-HTTPS) se il tuo operatore nasconde il server della playlist. Le altre scelte usano subito il DNS cifrato per playlist, guida TV e copertine.",
        "Il DNS del tuo operatore nasconde il server della playlist: l'app sta usando il DNS cifrato.",
        "Aggiungi link m3u, account Xtream Codes o un host privato. Le credenziali restano solo su questo iPhone.",
        "Le credenziali sono salvate solo su questo iPhone.",
    ),
    "es": (
        "Predeterminado del sistema usa el DNS del iPhone y cambia solo al DNS cifrado (DNS-over-HTTPS) si tu operador oculta el servidor de la lista. Las demás opciones usan DNS cifrado desde el principio para listas, guía TV y carátulas.",
        "El DNS de tu operador oculta el servidor de la lista: la app está usando DNS cifrado.",
        "Añade enlaces m3u, cuentas Xtream Codes o un host privado. Las credenciales se quedan solo en este iPhone.",
        "Las credenciales se guardan solo en este iPhone.",
    ),
    "fr": (
        "Par défaut du système utilise le DNS de l'iPhone et passe de lui-même au DNS chiffré (DNS-over-HTTPS) si votre opérateur masque le serveur de la playlist. Les autres choix utilisent le DNS chiffré dès le départ pour les playlists, le guide TV et les affiches.",
        "Le DNS de votre opérateur masque le serveur de la playlist : l'app utilise le DNS chiffré.",
        "Ajoutez des liens m3u, des comptes Xtream Codes ou un hôte privé. Les identifiants restent uniquement sur cet iPhone.",
        "Les identifiants sont enregistrés uniquement sur cet iPhone.",
    ),
    "de": (
        "Systemstandard nutzt das DNS des iPhones und wechselt selbst zu verschlüsseltem DNS (DNS-over-HTTPS), wenn dein Anbieter den Playlist-Server verbirgt. Die anderen Optionen nutzen von Anfang an verschlüsseltes DNS für Playlists, Programmführer und Cover.",
        "Das DNS deines Anbieters verbirgt den Playlist-Server: Die App nutzt verschlüsseltes DNS.",
        "Füge m3u-Links, Xtream-Codes-Konten oder einen privaten Host hinzu. Die Zugangsdaten bleiben nur auf diesem iPhone.",
        "Die Zugangsdaten werden nur auf diesem iPhone gespeichert.",
    ),
    "pt": (
        "Predefinição do sistema usa o DNS do iPhone e muda sozinha para DNS cifrado (DNS-over-HTTPS) se o operador esconder o servidor da lista. As outras opções usam DNS cifrado desde o início para listas, guia TV e capas.",
        "O DNS do seu operador esconde o servidor da lista: a app está a usar DNS cifrado.",
        "Adiciona links m3u, contas Xtream Codes ou um host privado. As credenciais ficam apenas neste iPhone.",
        "As credenciais são guardadas apenas neste iPhone.",
    ),
    "ro": (
        "Implicit sistem folosește DNS-ul iPhone-ului și trece singur la DNS criptat (DNS-over-HTTPS) dacă operatorul ascunde serverul playlistului. Celelalte opțiuni folosesc DNS criptat de la început pentru playlisturi, ghid TV și coperți.",
        "DNS-ul operatorului ascunde serverul playlistului: aplicația folosește DNS criptat.",
        "Adaugă linkuri m3u, conturi Xtream Codes sau un host privat. Datele de acces rămân doar pe acest iPhone.",
        "Datele de acces sunt salvate doar pe acest iPhone.",
    ),
    "tr": (
        "Sistem varsayılanı iPhone'un DNS'ini kullanır ve operatör liste sunucusunu gizlerse kendiliğinden şifreli DNS'e (DNS-over-HTTPS) geçer. Diğer seçenekler listeler, TV rehberi ve kapaklar için baştan şifreli DNS kullanır.",
        "Operatörünüzün DNS'i liste sunucusunu gizliyor: uygulama şifreli DNS kullanıyor.",
        "m3u bağlantıları, Xtream Codes hesapları veya özel bir host ekle. Giriş bilgileri yalnızca bu iPhone'da kalır.",
        "Giriş bilgileri yalnızca bu iPhone'da saklanır.",
    ),
}


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def replace_entry(text: str, old_key: str, new_key: str, value: str) -> str:
    pattern = re.compile(r'^(\s*)"' + re.escape(esc(old_key)) + r'": ".*",$', re.M)
    if not pattern.search(text):
        raise SystemExit(f"missing key: {old_key}")
    return pattern.sub(lambda m: f'{m.group(1)}"{esc(new_key)}": "{esc(value)}",', text)


for lang, (footer, notice, onboard, stored) in T.items():
    path = ROOT / f"Strings_{lang}.swift"
    text = path.read_text()
    if esc(NOTICE) in text:
        continue
    text = replace_entry(text, OLD_FOOTER, FOOTER, footer)
    text = replace_entry(text, OLD_ONBOARD, ONBOARD, onboard)
    text = replace_entry(text, OLD_STORED, STORED, stored)
    # The notice goes right after the new footer entry.
    marker = f'"{esc(FOOTER)}": "{esc(footer)}",'
    text = text.replace(marker, marker + f'\n        "{esc(NOTICE)}": "{esc(notice)}",', 1)
    path.write_text(text)
    print("updated", path.name)
