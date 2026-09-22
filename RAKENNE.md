# Kate — koko rakenne

Tämä kuvaa sovelluksen sellaisena kuin se on, ei sellaisena kuin se oli
tarkoitus. Kaikki alla oleva on luettu koodista ja tuotantokannasta.

Voit antaa tämän sellaisenaan promptina toiselle mallille tai
kehittäjälle: se riittää sovelluksen ymmärtämiseen ja jatkamiseen.

---

## 1. Mitä sovellus on

Kate näyttää ravintolalle **paljonko rahaa tuli, mihin se meni ja miten
se jakautui**: myynti, kuitit ja kulut, toimittajat, budjetit,
kirjanpito ja raportit. Lisäksi tehtävät, tiedostot, matkakulut ja
Matti-avustaja. Käyttöliittymä on `/admin`, ja se toimii työpöydällä ja
puhelimessa.

### Toimialat

Kate palvelee ravintoloita, kahviloita ja parturi-kampaamoja
(`restaurants.business_type`: `restaurant`, `cafe`, `barber`). Toimialan
valitsee ylläpitäjä Developer Consolessa yritystä luodessa, ja sen voi
vaihtaa vain siellä. Toimiala ratkaisee:

- mitkä kulukategoriat tarjotaan (`lib/restoflow/business.ts`): parturilla
  hoitotuotteet, laitteet ja toimitilat, ei ruokaa eikä alkoholia;
  kahvilalla ei alkoholia
- millä myyntiryhmillä ja ALV-kannoilla yritys aloittaa ja miten
  tilikartan myyntitilit nimetään (migraatio `0099_toimialat.sql`)
- miten kuitinluvun tekoäly ja Matti puhuvat yrityksestä

Toimiala rajaa valintoja, ei dataa: vaihdon jälkeen vanhat kuitit
pysyvät kategorioissaan ja näkyvät raporteissa.

### Rajaus, joka on tarkoituksellinen

Sovellus **ei**:

- ota yhteyttä pankkitiliin eikä lue kassajärjestelmää suoraan
  (kassan päiväraportti kirjataan tai kuvataan)
- hallitse varastoa tai tilauksia
- suunnittele työvuoroja, seuraa työaikaa eikä laske palkkoja
- ota pöytävarauksia eikä julkaise lounaslistoja

Pöytävaraukset, lounaslista ja some-julkaisut, työvuorot, leimaukset,
poissaolot, palkanlaskenta ja verokortit poistettiin kokonaan
migraatiossa `0096_kate_rajaus.sql`. Palkat maksetaan palkkapalvelussa;
Katessa **palkkakulu kirjataan kuluksi Henkilöstö-kategoriaan**
(`staff`), esimerkiksi palkkapalvelun kuukausiyhteenvedosta. Yleiskuva
näyttää henkilöstökulut ja niiden osuuden myynnistä.

Karkea tulos on **myynti miinus kulut**. Henkilöstökulua ei lisätä
erikseen, koska se on jo kuluissa.

---

## 2. Teknologia

| | |
|---|---|
| Next.js | 16.3.1, App Router, Turbopack |
| React | 19.2.8 |
| TypeScript | 5, strict |
| Tailwind | v4 |
| Tietokanta | Supabase (Postgres 17), RLS päällä kaikilla tauluilla |
| Auth | Supabase Auth, `@supabase/ssr` |
| Validointi | Zod 4 |
| Kuittien luku | `@anthropic-ai/sdk`, `claude-opus-5` |
| Testit | Vitest, 1255 testiä |

`proxy.ts` on Next 16:n uusi nimi `middleware.ts`:lle. Se virkistää
istunnon jokaisella pyynnöllä.

**Käyttämättömät riippuvuudet** (telineestä jääneitä, voi poistaa):
`lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`,
`date-fns`.

---

## 3. Roolit ja oikeudet

Neljä roolia. Yksi taulukko `lib/restoflow/permissions.ts`:ssä ohjaa
sekä navigaatiota että pääsytarkistusta — jos ne lukisivat eri listaa,
ne ajautuisivat eri linjalle ja piilotettu linkki näyttäisi
turvatoimelta olematta sellainen.

- **Owner** — kaikki, myös käyttäjien kutsuminen ja roolit
  (Asetukset → Käyttäjät), budjetit ja kuukauden sulkeminen.
- **Manager** — päivittäinen työ: kuitit, myynti, tehtävät, tiedostot.
- **Accountant** — lukee talouden: kulut, raportit, kirjanpito.
- **Employee** — näkee vain hänelle osoitetut tehtävät. Roolia ei
  enää tarjota kutsuissa, mutta arvo on `app_role`-enumissa.

Käyttäjä kutsutaan kutsukoodilla (`create_invitation`), ja koodi
hyväksytään kirjautuneena (`accept_invitation`).

---

## 4. Tietomalli

Kaikilla tauluilla RLS päällä. Ydin:

```
profiles ─┬─ memberships ─── restaurants
          │                      │
          │     ┌────────────────┼──────────────┬──────────────┐
          │     │                │              │              │
          │  suppliers        receipts      daily_sales      tasks
          │                      │
          │                  receipt_items
          │
          └── restaurant_invitations, budgets, closed_months,
              expense_categories, sales_groups, files, folders
```

### Enumit

```sql
app_role         owner | manager | employee | accountant
expense_category food | alcohol | soft_drinks | cleaning |
                 kitchen_supplies | packaging | staff | transport | other
payment_method   card | cash | invoice | unknown
receipt_status   confirmed | needs_review
```

### Keskeiset ratkaisut

**Raha on aina kokonaisluku senttejä.** Pyöristys tehdään kerran,
lopussa. Liukuluku euroina tuottaisi sentin virheitä jotka kertyvät
raportissa.

**Omat kulukategoriat kartoittuvat yhdeksään perusluokkaan.**
`expense_categories` antaa ravintolan nimetä "Viinit", mutta se kuuluu
yhä `alcohol`-perusluokkaan. Perusluokka ratkaisee ALV-odotuksen ja
budjetin — vapaalle luokalle ei ole odotettua ALV-kantaa.

**Kuvan polku talletetaan, ei vain tieto olemassaolosta.** `image_path`
osoittaa yksityiseen `receipts`-buckettiin; näkymä hakee sille
allekirjoitetun osoitteen joka vanhenee tunnissa.

---

## 5. Tietokantafunktiot ja turvakerrokset

Kaikki kirjoittavat toiminnot kulkevat funktion kautta, joka tarkistaa
oikeuden itse.

### Apufunktiot (`security definer`, katkaisevat politiikkarekursion)

`my_restaurant_ids`, `my_role_in`, `is_owner`, `is_manager`,
`can_read_finance`, `is_month_closed`

### Kirjoittavat funktiot

| Funktio | Vartija |
|---|---|
| `create_restaurant` | kirjautuminen |
| `create_invitation` | `is_owner` |
| `accept_invitation` | koodi + voimassaolo |
| `preview_invitation` | koodi |
| `update_membership` | `is_owner` |
| `create_receipt` | `is_manager` |
| `review_receipt` | `is_manager` |
| `delete_receipt` | `is_manager` |
| `set_budget` | `is_owner` |
| `update_restaurant` | `is_owner` + aikavyöhykkeen olemassaolo |
| `close_month` / `reopen_month` | `is_owner` |
| `upsert_expense_category` / `delete_expense_category` | `is_owner` |

### Liipaisimet

- `handle_new_user` — luo profiilin rekisteröityessä
- `guard_closed_month` — suljetun kuukauden kuittia ei lisätä, muuteta eikä poisteta
- `touch_updated_at`

### Kolme kerrosta, koska yksikään ei yksin riitä

Esimerkkinä kuitin lisäys:

1. **Funktio** on `security definer` ja ohittaa RLS:n → tarkistus funktion sisään
2. **Suora taulukirjoitus** PostgREST:n läpi ohittaa funktion → tarkistus `receipts_insert`-politiikkaan
3. **Kuva** ladataan selaimesta suoraan storageen → tarkistus storage-politiikkaan

Käyttöliittymän piilotettu painike ei ole tässä listassa, koska se ei
ole pääsynhallintaa.

---

## 6. Reitit

### Julkiset

```
/                      markkinointisivu
/kirjaudu              kirjautuminen
/rekisteroidy          tunnuksen luonti
/unohtui               salasanan palautuksen pyyntö
/uusi-salasana         uuden salasanan asetus
/auth/callback         sähköpostilinkkien paluureitti
/aloitus               ravintolan perustus tai liittyminen koodilla
```

### Hallinta

```
/admin                 yleiskuva: myynti, kulut, tulos, henkilöstökulut
/admin/myynti          myyntipäivät ja kassan täsmäytys
/admin/myynti/[paiva]  yhden päivän myynti
/admin/kuitit          kuittilista, suodattimet, duplikaattivaroitus
/admin/kuitit/[id]     kuitin yksityiskohdat + kuva
/admin/kuitit/uusi     kuitin lisäys
/admin/kulut           kulut kategorioittain, kuukausiselain
/admin/toimittajat     toimittajalista
/admin/toimittajat/[id] yhden toimittajan kulut ja trendi
/admin/budjetit        budjettien asetus
/admin/kirjanpito      kirjaukset, ALV, kuukauden sulkeminen
/admin/tehtavat        tehtävät lista- ja kalenterinäkymänä
/admin/tiedostot       yksityiset tiedostot kansioissa
/admin/havainnot       trendit ja poikkeamat
/admin/ilmoitukset     hälytykset
/admin/loki            toimintaloki
/admin/raportit        CSV, Excel, PDF
/admin/raportit/csv    CSV-vienti (reitti)
/admin/raportit/xlsx   Excel-vienti (reitti)
/admin/raportit/tulosta tulostettava kuukausiraportti
/admin/asetukset       ravintola, kategoriat, käyttäjät, oma tili
/admin/lisaa           puhelimen ylivuotovalikko
```

### API

```
POST /api/kuitit/poiminta   kuitin luku kuvasta
POST /api/myynti/poiminta   kassaraportin luku kuvasta
POST /api/tehtavat/poiminta tehtävien luku tekstistä
POST /api/matti             Matti-avustaja
GET  /api/tiedostot/[id]    yksityisen tiedoston avaus (kirjautuminen + jäsenyys)
POST /api/tiedostot/ehdotus tiedoston kansioehdotus
```

---

## 7. Sovelluslogiikka

Kaikki päättely on `lib/restoflow/`-kansiossa, erillään näkymistä ja
testattavissa ilman selainta tai tietokantaa.

| Moduuli | Vastuu |
|---|---|
| `types.ts` | koko tietomalli ja suomenkieliset otsikot |
| `permissions.ts` | roolit, oikeudet, navigaatio, polkujen vaatimukset |
| `session.ts` | istunto, aktiivinen ravintola, `requireContext` |
| `page-context.ts` | sivujen yhteinen konteksti + **rooliportti** |
| `queries.ts` | tietokanta → domain-mallit |
| `expenses.ts` | kulujen summat, kategoriat, kuukausisarjat |
| `budgets.ts` | budjettien toteuma ja tila |
| `suppliers.ts` | toimittajakohtaiset summat ja trendit |
| `vat.ts` | ALV-tarkistus |
| `duplicates.ts` | kaksoiskappaleiden tunnistus |
| `alerts.ts` | esihenkilön hälytykset |
| `dashboard.ts` | yleiskuvan päättely, arvioitavuus |
| `insights.ts` | trendit ja havainnot |
| `receipt-ai.ts` | poiminnan rajapinta, jäljitelmä, palvelinpoimija |
| `image-prep.ts` | HEIC → JPEG, pienennys ennen lähetystä |
| `report-rows.ts` | raporttien rivit (yksi lähde CSV:lle ja Excelille) |
| `money.ts` | senttien muotoilu |
| `xlsx.ts` | oma .xlsx-kirjoitin ilman riippuvuutta |

---

## 8. Säännöt joita ei rikota

Nämä ovat sovelluksen selkäranka. Jos muutat jotain, älä muuta näitä.

### Älä koskaan keksi lukua

- Vertailuprosenttia ei näytetä ilman vertailujaksoa → **"Ei vertailukohtaa"**
- Henkilöstökulun osuutta ei lasketa jos myyntiä ei ole → nollalla
  jakaminen antaisi luvun joka näyttäisi tiedolta
- ALV:tä ei lasketa jos sitä ei ole kuitissa
- Kuvan laatua ei arvioida jos kuvaa ei ole katsottu

### "Kaikki kunnossa" vaatii että jotain on tarkastettu

Kolme tilaa, ei kahta:

| Tila | Milloin |
|---|---|
| **Ei vielä arvioitavaa** | aineistoa ei ole tarpeeksi mihinkään tarkastukseen |
| **Vaatii huomiota** | hälytyksiä löytyi |
| **Kaikki kunnossa** | tarkastuksia tehtiin eikä löytynyt mitään |

Tyhjä tietokanta ei ole hyvä uutinen. `dashboard.ts` laskee mitkä
tarkastukset aineisto ylipäätään mahdollisti.

### Hälytyksiä ei tallenneta

Ne lasketaan tilasta joka latauksella. Tallennettu hälytys jäisi
roikkumaan senkin jälkeen kun asia on hoidettu, ja "lue tämä" joka ei
enää päde opettaa käyttäjän ohittamaan koko listan. Siksi
lukukuittausta ei ole eikä voi olla.

### Kone ehdottaa, ihminen vahvistaa

Poiminta palauttaa aina **arvon ja luottamuksen**, ei pelkkää arvoa.
Epävarmat kentät merkitään, kaikki on muokattavissa ennen tallennusta,
eikä mitään sovelleta automaattisesti. Kategoriaehdotus opitusta
korjaushistoriasta näytetään — käyttäjä painaa "Käytä".

### Väri ei koskaan yksin

Tila luetaan aina myös sanoina ja lukuna. Budjettipalkin vieressä on
prosentti ja sana ("Kriittinen").

### Aika lasketaan ravintolan aikavyöhykkeellä

Palvelin käy UTC:ssä. Väärä vyöhyke siirtäisi illan myynnin väärälle
päivälle ja laskisi kuukauden rajat väärin. `nowIso` on aina
parametri, ei `Date.now()` funktion sisällä — muuten testejä ei voi
kirjoittaa.

### Virhe kerrotaan, ei niellä

Yleinen "yritä uudelleen" piilottaa syyn. Jokainen action kääntää
tietokannan virheen toimintakelpoiseksi, ja tuntematon virhe näytetään
sellaisenaan.

---

## 9. Visuaalinen kieli

Apple- ja Linear-henkinen: erittäin vaalea tausta, valkoiset kortit,
hienovaraiset rajat, paljon tyhjää tilaa.

```
--rf-bg          #f5f6f8    tausta
--rf-card        #ffffff    kortit
--rf-text        #111318    ensisijainen teksti
--rf-text-2      #6b7280    toissijainen
--rf-text-3      #9ca3af    vaimennettu
--rf-line        #e7e9ee    rajat
--rf-accent      #315bff    toiminta: CTA, valinta, aktiivinen kohta
--rf-accent-2    #6c5ce7    toissijainen aksentti
--rf-green/amber/red        vain tilan merkitsemiseen
```

**Sininen tarkoittaa toimintaa**: ensisijainen painike, valittu
suodatin, aktiivinen navigointikohta. Se ei ole brändipinta eikä
otsikon väri.

**Vihreä, oranssi ja punainen merkitsevät tilaa** — eivät koskaan
yksin: vieressä on aina luku tai sana.

Painikkeilla on nimetty hierarkia (`Button`-komponentti): yksi
`primary` per näkymä, muut `secondary` tai `ghost`.

Ikonit ovat omia, 24×24, 1.6px viiva, ei täyttöjä. **Ei emojeita.**

Mobiili: kentät 16px (muuten iOS zoomaa), `viewport-fit=cover`
(muuten kotipalkki peittää alanavigaation), alapalkissa neljä kohtaa
ja loput "Lisää"-sivulla.

---

## 10. Testit ja tarkistukset

1255 testiä, 59 tiedostoa. Ne kohdistuvat päättelyyn, eivät
näkymiin.

```
analysis.test.ts    ALV, duplikaatit, toimittajat, budjetit,
                    oikeudet, hälytykset, poiminta
dashboard.test.ts   arvioitavuus, vertailut, budjettien tila
insights.test.ts    havainnot ja niiden perustelut
expenses.test.ts    summat ja kuukausirajat
money.test.ts       senttien muotoilu
xlsx.test.ts        ZIP-rakenne ja lukujen tyypit
```

Ennen committia: `npx tsc --noEmit`, `npx eslint .`, `npx vitest run`,
`npm run build`.

`npm run bundle:sql` kokoaa migraatiot tiedostoksi
`supabase/migrations/ALL_IN_ONE.sql`. Se on **generoitu** — älä muokkaa
käsin.

---

## 11. Ympäristömuuttujat

```bash
NEXT_PUBLIC_SUPABASE_URL=          # pakollinen
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # pakollinen, julkaistava avain

ANTHROPIC_API_KEY=                 # ilman tätä kuitit täytetään käsin
RECEIPT_MODEL=                     # valinnainen, oletus claude-opus-5

NEXT_PUBLIC_SITE_URL=              # valinnainen, palautuslinkkejä varten
```

`ANTHROPIC_API_KEY` **ei koskaan** `NEXT_PUBLIC`-etuliitteellä — se
päätyisi sivun lähdekoodiin.

---

## 12. Tunnetut puutteet

| Puute | Tila |
|---|---|
| Kuvasta lukeminen | koodi valmis, odottaa `ANTHROPIC_API_KEY`:tä |
| Ravintolan vaihtaminen | jätetty tekemättä; useampi jäsenyys jää ensimmäiseen |
| Käyttämättömät riippuvuudet | 5 kpl telineestä jäänyttä |
| Verran jäänteet kannassa | vanhoja tauluja samassa Supabase-projektissa |

---

## 13. Jos jatkat tästä

Lue ensin `lib/restoflow/permissions.ts` ja `lib/restoflow/types.ts` —
niistä selviää mitä sovellus tekee ja kuka saa tehdä mitä. Sen jälkeen
`lib/restoflow/dashboard.ts`, jossa on se sääntö jonka takia tämä
sovellus on erilainen kuin useimmat taloushallinnon näkymät:
**tyhjä aineisto ei ole hyvä uutinen, ja sen sanominen ääneen on
tärkeämpää kuin näyttää siistiltä.**

