"""Adds the "private host" strings of the playlist editor to src/lib/i18n.tsx (8 languages)."""
import pathlib, re

T = {
 "it": ("Host privato", "Numero host, nome utente e password", "Numero host", "Il numero che ti ha dato il tuo fornitore, ad es. 0016.", "Inserisci il numero dell'host."),
 "en": ("Private host", "Host number, username and password", "Host number", "The number your provider gave you, e.g. 0016.", "Enter the host number."),
 "es": ("Host privado", "Número de host, usuario y contraseña", "Número de host", "El número que te dio tu proveedor, p. ej. 0016.", "Introduce el número del host."),
 "fr": ("Hôte privé", "Numéro d'hôte, identifiant et mot de passe", "Numéro d'hôte", "Le numéro fourni par votre fournisseur, ex. 0016.", "Saisissez le numéro de l'hôte."),
 "de": ("Privater Host", "Host-Nummer, Benutzername und Passwort", "Host-Nummer", "Die Nummer deines Anbieters, z. B. 0016.", "Gib die Host-Nummer ein."),
 "pt": ("Host privado", "Número do host, utilizador e palavra-passe", "Número do host", "O número dado pelo seu fornecedor, ex. 0016.", "Introduza o número do host."),
 "ro": ("Host privat", "Număr host, utilizator și parolă", "Număr host", "Numărul primit de la furnizor, ex. 0016.", "Introdu numărul hostului."),
 "tr": ("Özel host", "Host numarası, kullanıcı adı ve şifre", "Host numarası", "Sağlayıcınızın verdiği numara, örn. 0016.", "Host numarasını gir."),
}
KEYS = ["pl.typeHost", "pl.typeHostHint", "pl.hostNumber", "pl.hostNumberHelp", "pl.errHost"]

path = pathlib.Path(__file__).resolve().parent.parent / "src/lib/i18n.tsx"
src = path.read_text(encoding="utf-8")
if '"pl.typeHost"' in src:
    raise SystemExit("already applied")
# Dictionaries appear in this order; the first one (it) defines the keys.
order = ["it", "en", "es", "fr", "de", "pt", "ro", "tr"]
parts = src.split('  "pl.typeXtreamHint": ')
assert len(parts) == 9, len(parts)
out = parts[0]
for lang, rest in zip(order, parts[1:]):
    line_end = rest.index("\n") + 1
    vals = T[lang]
    extra = "".join('  "%s": "%s",\n' % (k, v.replace('"', '\\"')) for k, v in zip(KEYS, vals))
    out += '  "pl.typeXtreamHint": ' + rest[:line_end] + extra + rest[line_end:]
path.write_text(out, encoding="utf-8")
print("ok")
