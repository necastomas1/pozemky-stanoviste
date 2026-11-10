# Pozemky obce Stanoviště

Webová aplikace (PWA) s mapou pozemků ve vlastnictví obce Stanoviště (k.ú. Stanoviště na Moravě, LV 1).

- letecký snímek (ortofoto ČÚZK) a hranice všech parcel v katastrálním území
- obecní pozemky barevně podle druhu, podle inventurního soupisu k 30. 9. 2026
- **Moje poloha**: ukáže, kde stojíš a na čí parcele
- **Poznámky k parcelám**: sdílené mezi zastupiteli, ukládají se do Google tabulky
- jde přidat na plochu telefonu a otevře se i bez signálu (už prohlédnuté části mapy)

## Zapnutí poznámek (jednou)

1. Na Google Disku obce vytvoř novou tabulku, např. „Poznámky k pozemkům“.
2. V tabulce: **Rozšíření → Apps Script**. Smaž ukázkový kód a vlož obsah souboru `apps-script/Poznamky.gs`. Ulož.
3. **Nastavení projektu** (ozubené kolo vlevo) → **Vlastnosti skriptu** → přidej vlastnost `HESLO` s heslem pro zastupitele.
4. **Nasadit → Nové nasazení** → typ **Webová aplikace**, *Spustit jako: Já*, *Kdo má přístup: Kdokoli* → Nasadit, povol přístup.
5. Zkopíruj adresu webové aplikace (končí `/exec`) a vlož ji do souboru `config.js` místo prázdných uvozovek.
6. Každý zastupitel si v appce v menu ☰ vyplní své jméno a heslo.

Poznámky bez hesla nikdo nepřečte ani nezapíše. Tabulku máš v Google Disku a můžeš ji kdykoli otevřít.

## Zdroje dat

Hranice parcel a ortofoto © ČÚZK (stav k 9. 11. 2026), seznam obecních pozemků z inventurního soupisu k 30. 9. 2026.
Mapa má informativní charakter a nenahrazuje výpis z katastru nemovitostí.
