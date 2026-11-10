#!/usr/bin/env bash
# Regenera o modelo .pot e atualiza os .po existentes.
set -euo pipefail
cd "$(dirname "$0")"

xgettext --from-code=UTF-8 --language=JavaScript \
  --keyword=_ --keyword=ngettext:1,2 --keyword=pgettext:1c,2 --add-comments=Translators: \
  --package-name="Luma Dock" \
  -o po/luma-dock.pot extension.js prefs.js $(find src -name "*.js") 2>/dev/null

for po in po/*.po; do
  msgmerge --update --backup=none "$po" po/luma-dock.pot
  echo "$(basename "$po"): $(msgfmt --statistics -o /dev/null "$po" 2>&1)"
done
