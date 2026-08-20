/**
 * Suomen ALV-säännöt, demo-tasoisina.
 *
 * VAROITUS: nämä versiot ovat statukseltaan 'demo'. Niitä ei ole tarkistettu
 * virallista lähdettä vasten, eikä niitä saa esittää oikeudellisena totuutena
 * (§50). Moottori merkitsee jokaisen demo-säännöllä tehdyn päätöksen
 * tarkistettavaksi.
 *
 * Kun sääntö validoidaan, luodaan UUSI versio jolla on legalReference ja
 * status 'validated'. Vanhaa versiota ei muokata eikä poisteta — historiallisen
 * päätöksen on pysyttävä toistettavana (§12, §14).
 *
 * Tämä tiedosto on peilikuva migraatiosta 0006_seed_reference.sql. Kanta on
 * ajonaikainen totuus; tämä mahdollistaa moottorin ajamisen ja testaamisen
 * ilman tietokantayhteyttä.
 */

import type { RuleVersion } from "../types";

const base = {
  jurisdiction: "FI" as const,
  status: "demo" as const,
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
};

export const FI_RULES: RuleVersion[] = [
  {
    ...base,
    ruleId: "vat-fi-rc-eu-b2b",
    version: "2026.1",
    priority: 5,
    name: "EU B2B käännetty verovelvollisuus",
    description:
      "Myynti toisen EU-maan yritykselle, jonka ALV-tunniste on vahvistettu.",
    conditions: {
      jurisdiction: "FI",
      crossBorder: true,
      buyerInEu: true,
      buyerType: "business",
      buyerVatIdValid: true,
    },
    actions: { vatCode: "FI-RC-EU", vatRate: 0, reverseCharge: true, deductible: true },
    notes:
      "Vahvistettu VIES-tarkistus on ehto, ei seuraus. Pelkkä muodollisesti oikea tunniste ei riitä.",
  },
  {
    ...base,
    ruleId: "vat-fi-export-non-eu",
    version: "2026.1",
    priority: 6,
    name: "Vienti EU:n ulkopuolelle",
    conditions: { jurisdiction: "FI", crossBorder: true, buyerInEu: false },
    actions: { vatCode: "FI-EXP", vatRate: 0, deductible: true },
    notes: "Vientinäyttö on osoitettava erikseen.",
  },
  {
    ...base,
    ruleId: "vat-fi-oss-distance",
    version: "2026.1",
    priority: 7,
    name: "OSS-etämyynti kuluttajalle",
    conditions: {
      jurisdiction: "FI",
      crossBorder: true,
      buyerInEu: true,
      buyerType: "consumer",
    },
    actions: { vatCode: "FI-OSS", requiresReview: true },
    notes: "Ostajan maan verokanta ratkaisee. Vaatii aina tarkistuksen.",
  },
  {
    ...base,
    ruleId: "vat-fi-alcohol",
    version: "2026.1",
    priority: 10,
    name: "Alkoholi",
    conditions: { jurisdiction: "FI", category: ["alcohol"], crossBorder: false },
    actions: { vatCode: "FI-STD", vatRate: 0.255, deductible: true },
    notes: "Alkoholi ei kuulu ruoan alennettuun kantaan.",
  },
  {
    ...base,
    ruleId: "vat-fi-tips",
    version: "2026.1",
    priority: 15,
    name: "Tippi",
    conditions: { jurisdiction: "FI", category: ["tip"] },
    actions: { vatCode: "FI-EXPT", requiresReview: true },
    notes:
      "Käsittely riippuu siitä onko tippi vapaaehtoinen ja päätyykö se työntekijälle vai yritykselle.",
  },
  {
    ...base,
    ruleId: "vat-fi-giftcard",
    version: "2026.1",
    priority: 16,
    name: "Lahjakortti",
    conditions: { jurisdiction: "FI", category: ["gift_card"] },
    actions: { vatCode: "FI-EXPT", requiresReview: true },
    notes: "Monikäyttöinen ja yksikäyttöinen lahjakortti käsitellään eri tavoin.",
  },
  {
    ...base,
    ruleId: "vat-fi-deposit",
    version: "2026.1",
    priority: 17,
    name: "Pantti",
    conditions: { jurisdiction: "FI", category: ["deposit"] },
    actions: { vatCode: "FI-EXPT", requiresReview: true },
  },
  {
    ...base,
    ruleId: "vat-fi-food",
    version: "2026.1",
    priority: 20,
    name: "Elintarvikkeet ja ravintolaruoka",
    conditions: {
      jurisdiction: "FI",
      category: ["food", "groceries", "restaurant_food"],
      crossBorder: false,
    },
    actions: { vatCode: "FI-RED1", vatRate: 0.135, deductible: true },
    notes: "Verokanta vahvistettava virallisesta lähteestä ennen tuotantokäyttöä.",
  },
  {
    ...base,
    ruleId: "vat-fi-reduced-transport",
    version: "2026.1",
    priority: 25,
    name: "Henkilökuljetus, kirjat ja lääkkeet",
    conditions: {
      jurisdiction: "FI",
      category: ["passenger_transport", "books", "medicine"],
      crossBorder: false,
    },
    actions: { vatCode: "FI-RED2", vatRate: 0.1, deductible: true },
  },
  {
    ...base,
    ruleId: "vat-fi-packaging",
    version: "2026.1",
    priority: 30,
    name: "Pakkaus- ja toimitusmaksu",
    conditions: {
      jurisdiction: "FI",
      category: ["packaging", "delivery_fee"],
      crossBorder: false,
    },
    actions: {
      vatCode: "FI-STD",
      vatRate: 0.255,
      deductible: true,
      requiresReview: true,
    },
    notes: "Liitännäiskulu seuraa usein pääsuoritteen kantaa — vaatii tarkistuksen.",
  },
  {
    ...base,
    ruleId: "ded-fi-entertainment",
    version: "2026.1",
    priority: 40,
    name: "Edustuskulu",
    conditions: { jurisdiction: "FI", category: ["business_entertainment"] },
    actions: { vatCode: "FI-ND", deductible: false, requiresReview: true },
    notes: "Edustuskulujen vähennysoikeus on rajoitettu.",
  },
  {
    ...base,
    ruleId: "ded-fi-employee-meal",
    version: "2026.1",
    priority: 41,
    name: "Henkilökunnan ateria",
    conditions: { jurisdiction: "FI", category: ["employee_meal"] },
    actions: { vatCode: "FI-RED1", vatRate: 0.135, requiresReview: true },
  },
  {
    ...base,
    ruleId: "vat-fi-service",
    version: "2026.1",
    priority: 60,
    name: "Kotimainen palvelu",
    conditions: { jurisdiction: "FI", supplyType: "service", crossBorder: false },
    actions: { vatCode: "FI-STD", vatRate: 0.255, deductible: true },
  },
  {
    ...base,
    ruleId: "vat-fi-goods",
    version: "2026.1",
    priority: 61,
    name: "Kotimainen tavara",
    conditions: { jurisdiction: "FI", supplyType: "goods", crossBorder: false },
    actions: { vatCode: "FI-STD", vatRate: 0.255, deductible: true },
  },
];

/** Kaikki tunnetut sääntöjoukot jurisdiktioittain. */
export const RULE_SETS: Record<string, RuleVersion[]> = {
  FI: FI_RULES,
};

export function rulesFor(jurisdiction: string): RuleVersion[] {
  return RULE_SETS[jurisdiction] ?? [];
}
