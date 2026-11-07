#!/usr/bin/env python3
"""Adds the 1.3.5 strings (category column, filters, private host) to MoreStrings.kt."""
import pathlib
import re

path = pathlib.Path(__file__).resolve().parent.parent / "app/src/main/java/com/rork/novastream/ui/i18n/MoreStrings.kt"
text = path.read_text(encoding="utf-8")

KEYS = ["searchCategories", "sortAndFilter", "filterYearSection", "tabPrivateHost", "fieldHostNumber", "privateHostHint"]

VALUES = {
    "en": ["Search in categories", "Sort and filter", "Year", "Private host", "Host number",
           "Enter the host number you received, then your username and password."],
    "it": ["Cerca nelle categorie", "Ordina e filtra", "Anno", "Host privato", "Numero host",
           "Inserisci il numero host che hai ricevuto, poi username e password."],
    "es": ["Buscar en categorías", "Ordenar y filtrar", "Año", "Host privado", "Número de host",
           "Introduce el número de host que recibiste y luego tu usuario y contraseña."],
    "fr": ["Rechercher dans les catégories", "Trier et filtrer", "Année", "Hôte privé", "Numéro d'hôte",
           "Saisissez le numéro d'hôte reçu, puis votre identifiant et votre mot de passe."],
    "de": ["In Kategorien suchen", "Sortieren und filtern", "Jahr", "Privater Host", "Host-Nummer",
           "Gib die erhaltene Host-Nummer ein, dann Benutzername und Passwort."],
    "pt": ["Pesquisar nas categorias", "Ordenar e filtrar", "Ano", "Host privado", "Número do host",
           "Introduza o número de host que recebeu e depois o utilizador e a palavra-passe."],
    "ro": ["Caută în categorii", "Sortează și filtrează", "An", "Host privat", "Număr host",
           "Introdu numărul de host primit, apoi numele de utilizator și parola."],
    "tr": ["Kategorilerde ara", "Sırala ve filtrele", "Yıl", "Özel host", "Host numarası",
           "Aldığınız host numarasını, ardından kullanıcı adınızı ve şifrenizi girin."],
}

BLOCKS = {"it": "MoreItalian", "es": "MoreSpanish", "fr": "MoreFrench", "de": "MoreGerman",
          "pt": "MorePortuguese", "ro": "MoreRomanian", "tr": "MoreTurkish"}

if "searchCategories" in text:
    raise SystemExit("already applied")


def esc(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"').replace("$", "\\$")


# Defaults (English) in the class declaration.
decl = "".join(f'    val {k}: String = "{esc(v)}",\n' for k, v in zip(KEYS, VALUES["en"]))
text = text.replace("\n)\n\ninternal val MoreItalian", "\n" + decl.rstrip("\n") + "\n)\n\ninternal val MoreItalian", 1)

for lang, name in BLOCKS.items():
    start = text.index(f"internal val {name} = MoreStrings(")
    end = text.index("\n)\n", start)
    block = "".join(f'    {k} = "{esc(v)}",\n' for k, v in zip(KEYS, VALUES[lang]))
    text = text[:end] + "\n" + block.rstrip("\n") + text[end:]

path.write_text(text, encoding="utf-8")
print("ok")
