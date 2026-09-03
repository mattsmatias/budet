# Kate — koko rakenne

Tämä kuvaa sovelluksen sellaisena kuin se on, ei sellaisena kuin se oli
tarkoitus. Kaikki alla oleva on luettu koodista ja tuotantokannasta.

Voit antaa tämän sellaisenaan promptina toiselle mallille tai
kehittäjälle: se riittää sovelluksen ymmärtämiseen ja jatkamiseen.

---

## 1. Mitä sovellus on

Ravintolan **kulujen, kuittien, työvuorojen ja työajan** hallinta.
Kaksi käyttöliittymää samassa sovelluksessa:

- **`/admin`** — esihenkilön näkymä, toimii työpöydällä ja puhelimessa
- **`/app`** — työntekijän näkymä, suunniteltu puhelimelle

### Rajaus, joka on tarkoituksellinen

Sovellus **ei**:

- lue kassajärjestelmää eikä myyntiä
- ota yhteyttä pankkitiliin
- hallitse varastoa tai tilauksia
- tee kanta-asiakkuuksia tai CRM:ää

**Pöytävaraukset kuuluvat sovellukseen** ja ovat käytössä: salinäkymä,
kalenteri raahauksineen, pöytäkartta, varauslista hakuineen,
aukioloajat myös keskiyön yli, keittiön kapasiteetti, analytiikka,
julkinen varaussivu ja upotettava widget sekä tuonti toisesta
järjestelmästä. Tämä rivi luki aiemmin toisin, ja se oli väärin.

Tästä seuraa sääntö jota noudatetaan kaikkialla: **jokainen euromäärä
tarkoittaa järjestelmään kirjattua kulua, ei ravintolan tulosta.**
Kannattavuutta ei lasketa, koska myyntiä ei tunneta. Yleiskuvassa on
kortti joka sanoo tämän ääneen.

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

| Oikeus | Owner | Manager | Employee | Accountant |
|---|:-:|:-:|:-:|:-:|
| `receipts.view` | ✓ | ✓ | | ✓ |
| `receipts.add` | ✓ | ✓ | | |
| `receipts.edit` | ✓ | ✓ | | |
| `expenses.view` | ✓ | ✓ | | ✓ |
| `suppliers.view` | ✓ | ✓ | | ✓ |
| `budgets.view` | ✓ | ✓ | | ✓ |
| `budgets.edit` | ✓ | | | |
| `shifts.view.own` | ✓ | ✓ | ✓ | |
| `shifts.view.all` | ✓ | ✓ | | |
| `shifts.manage` | ✓ | ✓ | | |
| `time.track.own` | ✓ | ✓ | ✓ | |
| `time.view.all` | ✓ | ✓ | | ✓ |
| `staff.view` | ✓ | ✓ | | |
| `staff.rates.view` | ✓ | ✓ | | |
| `staff.manage` | ✓ | | | |
| `reports.view` | ✓ | ✓ | | ✓ |
| `reports.export` | ✓ | ✓ | | ✓ |
| `alerts.view` | ✓ | ✓ | | ✓ |
| `settings.view` | ✓ | ✓ | | |
| `settings.edit` | ✓ | | | |

Kaksi kohtaa jotka eivät ole vahinkoja:

- **Kirjanpitäjä ei näe tuntipalkkoja.** Hän tarvitsee kulut, ALV:t ja
  raportit, ei henkilöstön henkilötietoja. Työaika näkyy hänelle
  kokonaistunteina.
- **Työntekijä ei lisää kuitteja.** Kuitti on ravintolan
  kirjanpitoaineistoa, ei työntekijän ilmoitus: kuka tahansa vuorossa
  oleva ei saa synnyttää kulukirjausta jota kukaan ei ole hyväksynyt.

---

## 4. Tietomalli

14 taulua. Kaikilla RLS päällä, yhteensä **39 politiikkaa** ja
**4 liipaisinta**.

```
profiles ─┬─ memberships ─── restaurants
          │                      │
          │     ┌────────────────┼────────────────┬──────────────┐
          │     │                │                │              │
          │  suppliers        receipts         shifts       clock_events
          │     │                │                │
          │  supplier_       receipt_items    absences
          │  category_
          │  overrides
          │
          └── restaurant_invitations, budgets, closed_months,
              expense_categories
```

### Enumit

```sql
app_role         owner | manager | employee | accountant
staff_position   waiter | kitchen | manager | cleaning
expense_category food | alcohol | soft_drinks | cleaning |
                 kitchen_supplies | packaging | staff | transport | other
payment_method   card | cash | invoice | unknown
receipt_status   confirmed | needs_review
shift_status     draft | pending | accepted | declined | changed
clock_event_type in | break_start | break_end | out
absence_kind     sick | other | cannot_attend
```

### Keskeiset ratkaisut

**Raha on aina kokonaisluku senttejä.** Pyöristys tehdään kerran,
lopussa. Liukuluku euroina tuottaisi sentin virheitä jotka kertyvät
raportissa.

**Työajan tila johdetaan tapahtumista, ei tallenneta.** `clock_events`
on tapahtumaloki; "onko töissä" lasketaan siitä joka kerta. Tallennettu
tila ajautuisi erilleen tapahtumista ensimmäisen keskeytyksen kohdalla.

**Omat kulukategoriat kartoittuvat yhdeksään perusluokkaan.**
`expense_categories` antaa ravintolan nimetä "Viinit", mutta se kuuluu
yhä `alcohol`-perusluokkaan. Perusluokka ratkaisee ALV-odotuksen ja
budjetin — vapaalle luokalle ei ole odotettua ALV-kantaa.

**Kuvan polku talletetaan, ei vain tieto olemassaolosta.** `image_path`
osoittaa yksityiseen `receipts`-buckettiin; näkymä hakee sille
allekirjoitetun osoitteen joka vanhenee tunnissa.

---

## 5. Tietokantafunktiot ja turvakerrokset

27 funktiota. Kaikki kirjoittavat toiminnot kulkevat funktion kautta,
joka tarkistaa oikeuden itse.

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
| `upsert_shift` / `delete_shift` | `is_manager` |
| `record_clock_event` | jäsenyys + siirtymän kelvollisuus |
| `update_restaurant` | `is_owner` + aikavyöhykkeen olemassaolo |
| `close_month` / `reopen_month` | `is_owner` |
| `upsert_expense_category` / `delete_expense_category` | `is_owner` |

### Liipaisimet

- `handle_new_user` — luo profiilin rekisteröityessä
- `guard_shift_response` — työntekijä saa muuttaa vuoron **tilaa** muttei aikoja
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

### Esihenkilö

```
/admin                 yleiskuva
/admin/kuitit          kuittilista, suodattimet, duplikaattivaroitus
/admin/kuitit/[id]     kuitin yksityiskohdat + kuva
/admin/kuitit/uusi     kuitin lisäys
/admin/kulut           kulut kategorioittain, kuukausiselain
/admin/toimittajat     toimittajalista
/admin/toimittajat/[id] yhden toimittajan kulut ja trendi
/admin/budjetit        budjettien asetus
/admin/tyovuorot       vuorot, poissaolot, toteutumavertailu
/admin/tyontekijat     jäsenet, kutsut, roolit, tuntipalkat
/admin/havainnot       trendit ja poikkeamat
/admin/ilmoitukset     hälytykset
/admin/raportit        CSV, Excel, PDF
/admin/raportit/csv    CSV-vienti (reitti)
/admin/raportit/xlsx   Excel-vienti (reitti)
/admin/raportit/tulosta tulostettava kuukausiraportti
/admin/asetukset       ravintola, kategoriat, kuukauden sulkeminen
/admin/lisaa           puhelimen ylivuotovalikko
```

### Työntekijä

```
/app                   koti: työaika, seuraava vuoro
/app/tyoaika           leimaus
/app/vuorot            omat vuorot, poissaoloilmoitus
/app/ilmoitukset       omat ilmoitukset
/app/asetukset         nimi, salasana
/app/lisaa             valikko
```

### API

```
POST /api/kuitit/poiminta   kuitin luku kuvasta
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
| `timeclock.ts` | työajan tila ja kesto tapahtumista |
| `shifts.ts` | suunniteltu vs. toteutunut, poikkeamakuviot |
| `expenses.ts` | kulujen summat, kategoriat, kuukausisarjat |
| `budgets.ts` | budjettien toteuma ja tila |
| `suppliers.ts` | toimittajakohtaiset summat ja trendit |
| `vat.ts` | ALV-tarkistus |
| `duplicates.ts` | kaksoiskappaleiden tunnistus |
| `alerts.ts` | esihenkilön hälytykset |
| `employee-alerts.ts` | työntekijän ilmoitukset |
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
- Henkilöstökulun osuutta ei lasketa jos kuluja on nolla → nollalla
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
prosentti ja sana ("Kriittinen"). Vuoron tilalla on oma muotonsa, ei
vain väri.

### Aika lasketaan ravintolan aikavyöhykkeellä

Palvelin käy UTC:ssä. Väärä vyöhyke siirtäisi yövuorot väärälle
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
                    vuorot, oikeudet, hälytykset, poiminta
dashboard.test.ts   arvioitavuus, vertailut, budjettien tila
insights.test.ts    havainnot ja niiden perustelut
expenses.test.ts    summat ja kuukausirajat
timeclock.test.ts   työajan tila ja kesto
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

---

## 14. Pöytävaraukset

Tämä osa on kirjoitettu myöhemmin kuin luvut 1–13, ja ne eivät vielä
tunne sitä: luvun 4 tietomalli listaa 14 taulua, joista puuttuvat
kaikki alla olevat. Varausmoduuli on silti tuotannossa, joten se
kuvataan tässä kokonaisuudessaan.

### 14.1 Taulut

```
restaurants ─┬─ reservation_settings      verkkovaraus, kestot, rajat
             ├─ reservation_hours         viikonpäivän aukiolo
             ├─ reservation_exceptions    poikkeuspäivä (voittaa viikon)
             ├─ reservation_durations     kesto seurueen koon mukaan
             ├─ dining_areas ── restaurant_tables ─┬─ table_combinations
             │                                     └─ floor_elements
             ├─ floor_plan_images         salin pohjapiirros kuvana
             └─ reservations ──┬── reservation_table_assignments
                               └── reservation_status_history
```

### 14.2 Aukiolo saa ylittää keskiyön

Viimeinen istumisaika joka on avaamista pienempi tarkoittaa seuraavaa
päivää: 18:00–02:00 on kahdeksan tuntia. Pituus on johdettu tieto ja
johdetaan yhdessä paikassa, `reservation_span_minutes`.

Tästä seuraa kaksi sääntöä joita ei saa rikkoa:

1. **Kellonaika muutetaan hetkeksi vain `reservation_start_at`-funktiolla.**
   Kello 00:30 kuuluu siihen iltaan joka avautui edellisenä päivänä.
   Jokainen muu muunnos (`(p_date + p_time) at time zone tz`) on väärä
   heti kun ravintola on auki keskiyön yli.

2. **Ilta kuuluu avauspäiväänsä.** Salinäkymän ja varauslistan
   päivärajaus tulee `reservation_night_range`-funktiosta, ei
   kalenterivuorokaudesta. Analytiikka on tästä poikkeus ja käyttää
   kalenteripäivää, koska sen kaikkien lukujen on oltava samalla
   säännöllä laskettuja; se on kirjattu migraatioon 0094.

### 14.3 Funktiot

| Funktio | Tehtävä |
|---|---|
| `reservation_pick_tables` | pienin sopiva pöytä, sitten pienin yhdistelmä |
| `reservation_book` | ainoa kirjoituspolku; lukko, keittiöraja, liitosrivit |
| `reservation_slots` | päivän vapaat ajat paikallisina aikaleimoina |
| `reservation_day` | salinäkymän aineisto, yhteystiedot roolin mukaan |
| `reservation_search` | lista ja haku yli päivärajojen |
| `reservation_stats` | jakson luvut, päivittäinen kehitys, edellinen jakso |
| `kitchen_check` | keittiön kuorma; estää verkossa, varoittaa salissa |
| `reservation_import_*` | tuonti rivi kerrallaan, virhe ei kaada muita |
| `public_*` | asiakkaan pinta: asetukset, ajat, luonti, haku, peruutus |

### 14.4 Varausnumero ja allergiat

Varausnumero on kuusi merkkiä aakkosista joista puuttuvat sekoittuvat
(0/O, 1/I, 8/B). Se syntyy liipaisimessa `reservations_reference`, ei
sovelluksessa — varaus voi syntyä neljästä paikasta.

Allergiat ovat oma sarakkeensa eivätkä osa toivekenttää. Ero on siinä,
että toive on toive ja allergia on ainoa rivi jonka lukematta
jättämisellä on peruuttamaton seuraus. Siksi se myös näkyy salissa
varoituksena eikä muistiinpanona.

### 14.5 Peruutusraja

`reservation_settings.cancel_cutoff_hours` (oletus 24) koskee **vain**
asiakkaan omaa peruutuslinkkiä. Sali peruu varauksen milloin tahansa:
tieto siitä ettei seurue tule on ravintolalle arvokas myös kymmenen
minuuttia ennen. Nolla tarkoittaa "alkuhetkeen asti".

### 14.6 Reitit

| Reitti | Kuka |
|---|---|
| `/admin/varaukset` | sali: ilta, kalenteri, pöytäkartta |
| `/admin/varaukset/lista` | varauslista ja haku |
| `/admin/varaukset/analytiikka` | esihenkilö: viikko, kuukausi, vuosi |
| `/admin/varaukset/asetukset` | pöydät, aukiolo, widget |
| `/admin/varaukset/tuonti` | CSV toisesta järjestelmästä |
| `/varaa/[slug]` | asiakas: varaussivu (sama widget kuin upotus) |
| `/varaus/[token]` | asiakas: oma varaus ja peruutus |
| `/api/varaus` | widgetin koko rajapinta, neljä toimintoa |
