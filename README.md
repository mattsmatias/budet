# Verra

> Veropäätöksiä, jotka kone tekee ja tilintarkastaja voi toistaa.

AI-avusteinen verotuksen compliance-alusta eurooppalaisille yrityksille.
Dokumentti sisään, rivikohtainen ALV-kohtelu ulos — jokainen päätös
perusteltuna, versioituna ja uudelleen ajettavana.

Next.js 16 (App Router, TypeScript, Tailwind) · Supabase/PostgreSQL · Vercel.

Live: https://budet-app.vercel.app

---

## Tilanne

Tämä on rakenteilla oleva tuote. Alla oleva jako kertoo mikä on toteutettu ja
mikä on arkkitehtuuria odottamassa kytkentää — ei ole olemassa painikkeita
jotka näyttävät toimivilta mutta eivät tee mitään.

**Toteutettu ja testattu**

- Deterministinen, versioitu verosääntömoottori (`lib/tax/`) — 82 testiä
- Rivikohtainen ALV: yksi dokumentti, monta käsittelyä
- Rahalaskenta kokonaislukuina, ei liukulukuja
- Tietokantaskeema ja RLS-politiikat (`supabase/migrations/`)
- Palvelurajapinnat mock-toteutuksin: OCR, VIES, vienti, käyttöoikeudet
- Viennin estologiikka täsmällisine syineen
- Laskeutumissivu, yleiskuva, saapuneet, dokumenttinäkymä

**Arkkitehtuuri valmiina, kytkentä auki**

- Autentikointi ja istunnot (skeema ja politiikat valmiina)
- Tiedostojen lataus ja tallennus
- Taustakäsittelyn jono (`processing_jobs`)
- Stripe-laskutus (`plans`, `plan_entitlements`, `subscriptions`)
- Timo, matkat, tilitoimistoportaali, admin, raportit

Sivupalkin kohdat joiden vieressä lukee **pian** eivät ole toiminnassa.

---

## Käyttöönotto

```bash
npm install
```

```bash
cp .env.example .env.local
```

Täytä `.env.local` Supabasen dashboardista (Project Settings → API Keys).
Käytä **julkaistavaa** avainta (`sb_publishable_...`) — älä koskaan salaista
avainta, koska `NEXT_PUBLIC_`-muuttujat lähetetään selaimeen.

```bash
npm run dev
```

Sovellus avautuu osoitteeseen http://localhost:3000. Demo-aineisto toimii
ilman tietokantayhteyttä.

### Migraatiot

Migraatiot ajetaan järjestyksessä `supabase/migrations/`-hakemistosta joko
Supabasen SQL Editorissa tai CLI:llä:

```bash
supabase db push
```

| Tiedosto | Sisältö |
| --- | --- |
| `0001_foundation.sql` | Organisaatiot, roolit, jäsenyydet, RLS-apufunktiot |
| `0002_documents.sql` | Dokumentit, tiedostot, poimitut kentät, rivit |
| `0003_tax_engine.sql` | Säännöt, versiot, päätökset, VIES, audit trail, vienti |
| `0004_billing.sql` | Suunnitelmat, rajat, tilaukset, integraatiot, jono |
| `0005_rls.sql` | Row Level Security -politiikat |
| `0006_seed_reference.sql` | Jurisdiktiot, ALV-koodit, hinnasto, demo-säännöt |

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
| `lib/tax/engine.ts` | Sääntömoottori. Ei verkkoa, ei kielimallia, ei kelloa. |
| `lib/tax/rules/fi.ts` | Suomen säännöt, demo-statuksella |
| `lib/tax/document.ts` | Dokumenttitason luokittelu, monta käsittelyä |
| `lib/money.ts` | Rahalaskenta sentteinä |
| `lib/services/ocr/` | Poiminnan rajapinta + mock |
| `lib/services/vies/` | VIES-rajapinta + mock |
| `lib/services/export/` | Vientirivit ja estotarkistukset |
| `lib/services/entitlements.ts` | Suunnitelmarajat, palvelinpuolen validointi |
| `lib/demo/data.ts` | Demo-aineisto, luokiteltu oikealla moottorilla |
| `components/ui.tsx` | Jaetut esityskomponentit |
| `app/page.tsx` | Laskeutumissivu |
| `app/(app)/` | Sovellus: yleiskuva, saapuneet, dokumentti |

Liiketoimintalogiikka on `lib/`-hakemistossa. React-komponentit eivät laske
veroa eivätkä kutsu palveluita.

---

## Verosäännöistä

**Kaikki mukana olevat säännöt ovat statukseltaan `demo`.** Niitä ei ole
validoitu virallista lähdettä vasten, eikä niitä saa esittää oikeudellisena
kannanottona. Moottori merkitsee jokaisen demo-säännöllä tehdyn päätöksen
tarkistettavaksi — tämä on tarkoituksellista, ei keskeneräisyyttä.

Kun sääntö validoidaan, sille luodaan **uusi versio** jolla on
`legal_reference` ja status `validated`. Vanhaa versiota ei muokata eikä
poisteta: historiallisen päätöksen on pysyttävä toistettavana.

Sääntöstatukset: `demo` → `draft` → `review` → `validated` → `active` →
`deprecated`.

---

## Julkaisu

Vercel rakentaa `main`-haaran automaattisesti. Ympäristömuuttujat on
asetettava erikseen Vercelin projektiasetuksissa (Production, Preview ja
Development) — `.env.local` ei mene repoon eikä buildiin.

Vähintään tarvitaan:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Palvelinpuolen ominaisuudet vaativat lisäksi `SUPABASE_SERVICE_ROLE_KEY`:n.
Framework Preset on oltava **Next.js**.

---

## Periaatteet

1. **Jäljitettävä** — jokaisella päätöksellä on syy, sääntötunnus ja versio.
2. **Deterministinen** — sama syöte ja sääntöversio tuottavat saman päätöksen.
3. **Versioitu** — säännöt muuttuvat, historia säilyy.
4. **Ihmisen hallinnassa** — hyväksyntä, muokkaus ja hylkäys ovat käyttäjän.
5. **Vietävissä** — data lähtee ulos milloin vain.

Verra ei koskaan luo tekaistua varmuutta, ei keksi verosääntöä eikä muuta
hiljaisesti aiemmin hyväksyttyä kirjanpitopäätöstä.
