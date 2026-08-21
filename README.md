# RestoFlow

Ravintolan kuitit, kulut, työvuorot ja työaika yhdessä näkymässä.

Next.js 16 (App Router, TypeScript, Tailwind) · Vercel.

Live: https://budet-app.vercel.app

---

## Mitä RestoFlow tekee

Vastaa kolmeen kysymykseen:

1. Mihin ravintolan rahat menevät?
2. Kuinka paljon työntekijät tekevät työtunteja?
3. Mitä kuluissa ja työvuoroissa tapahtuu juuri nyt?

## Mitä se ei tee

Ei kassajärjestelmää, ei myynnin seurantaa, ei pankkiyhteyttä, ei
varastonhallintaa, ei asiakasvarauksia, ei CRM:ää, ei tilauksia.

Rajaus on pakotettu tietomallissa: **myynnille ei ole kenttää missään**.
Yksikään näkymä ei voi esittää kuluja ravintolan taloudellisena tuloksena.
Jokainen summa tarkoittaa *kirjattuja kuluja* — järjestelmään lisättyjen
kuittien summaa.

---

## Kaksi käyttöliittymää

| Polku | Kenelle | Mitä |
| --- | --- | --- |
| `/` | — | Sisääntulo, valitaan näkymä |
| `/app` | Työntekijä | Mobiilinäkymä: oma työaika, vuorot, kuittien lisäys |
| `/admin` | Manager | Työpöytänäkymä: kulut, kuitit, työtunnit, raportit |

Ne eivät ole saman näkymän kokovariantteja. Työntekijän ei kuulu nähdä
ravintolan kulujen kokonaisuutta, eikä managerin leimata itseään töihin
puhelimen levyisestä sarakkeesta.

---

## Käyttöönotto

```bash
npm install
```

```bash
npm run dev
```

Avaa http://localhost:3000. Sovellus toimii ilman tietokantaa ja ilman
ympäristömuuttujia — aineisto on demo-aineistoa.

---

## Komennot

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run lint
```

---

## Rakenne

| Polku | Vastuu |
| --- | --- |
| `lib/restoflow/types.ts` | Domain-tyypit. Rahat aina sentteinä. |
| `lib/restoflow/timeclock.ts` | Työajan laskenta tapahtumista |
| `lib/restoflow/expenses.ts` | Kulujen koonti, haku, suodatus |
| `lib/restoflow/receipt-ai.ts` | Kuittipoiminnan rajapinta + mock |
| `lib/restoflow/data.ts` | Demo-aineisto |
| `lib/money.ts` | Rahan muotoilu ja laskenta |
| `components/restoflow/ui.tsx` | Jaetut esityskomponentit |
| `app/theme.css` | Visuaalinen kieli |

Liiketoimintalogiikka on `lib/`-hakemistossa. React-komponentit eivät laske
työaikaa eivätkä summaa kuluja.

---

## Työajan laskenta

Tila **johdetaan tapahtumista**, ei tallenneta erikseen. Jos tila
tallennettaisiin, se voisi ajautua eri linjalle kuin tapahtumaloki — ja
ristiriidassa työntekijän palkka on väärin.

- Vain sallitut siirtymät tarjotaan painikkeina
- Tauko ei kerrytä työaikaa
- Keskeneräinen jakso lasketaan annettuun hetkeen asti
- Palkka pyöristetään kerran lopussa, ei minuuteittain
- Nykyhetki annetaan parametrina, ei lueta kellosta — muuten funktiota ei
  voisi testata

---

## Kuittien poiminta

Poiminta palauttaa jokaisesta kentästä **arvon ja luottamuksen**, ei paljasta
arvoa. Alle korkean luottamuksen kentät merkitään, ovat muokattavissa, eikä
mitään tallennu ennen kuin käyttäjä vahvistaa. Väärä kulukirjaus on kalliimpi
kuin ylimääräinen klikkaus.

Nykyinen toteutus on **paikallinen mock**, joka on deterministinen
tiedostonimen perusteella. Käyttöliittymä sanoo tämän ääneen. Oikea palvelu
(OpenAI, Anthropic, Google, Azure, erikoistunut OCR) kytketään toteuttamalla
`ReceiptExtractor`-rajapinta — käyttöliittymä ei muutu.

Kokeile tiedostonimeä joka sisältää `metro`, `kespro`, `wolt` tai `juoma`.
Muut nimet tuottavat tarkoituksella epävarman tuloksen.

---

## Raportit

Viisi raporttia, kaikki lataavat oikean CSV-tiedoston:

- Kuluraportti
- Kulut kategorioittain
- Kuitit
- Työaikaraportti
- Henkilöstökulut

CSV käyttää puolipistettä erottimena ja UTF-8-tunnistetta, joten
suomalainen Excel avaa sen suoraan oikein. PDF- ja Excel-vienti on merkitty
**ei vielä** eikä esitetä painikkeena joka ei tee mitään.

---

## Mitä ei ole toteutettu

Tietokantayhteyttä ei ole kytketty, joten kuitit ja leimaukset eivät tallennu
pysyvästi. Jokainen näkymä sanoo sen. Samoin kirjautuminen, ilmoitusten
kuittaus, asetusten muokkaus, vuorojen luonti ja PDF/Excel-vienti lukevat
näkymissä **ei vielä**.

---

## Julkaisu

Vercel rakentaa `main`-haaran automaattisesti. Ympäristömuuttujia ei tarvita.

---

## Aiempi tuote

Tämä repo sisälsi aiemmin Verran, verotuksen compliance-alustan. Se
poistettiin kun tuote vaihdettiin RestoFlow'ksi. Historia on tallessa:

```bash
git checkout c64c4dc -- app lib components utils supabase proxy.ts
```
