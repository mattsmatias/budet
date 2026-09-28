import { describe, expect, it } from "vitest";
import { jasennaYtj } from "../ytj";

/*
 * Aineisto on lyhennetty oikeasta PRH:n vastauksesta.
 *
 * Keksityllä rakenteella testi todistaisi vain että jäsennys vastaa
 * omaa arvaustani rajapinnasta. Kentät, tyypit ja kielikoodit ovat
 * täältä: avoindata.prh.fi/opendata-ytj-api/v3/companies.
 *
 * Kesko on mukana juuri siksi että se on hankala tapaus: päänimen
 * lisäksi 60 aputoiminimeä, päättynyt vanha nimi, vieraskielisiä
 * rinnakkaisnimiä ja postilokero-osoite.
 */
const KESKO = {
  totalResults: 1,
  companies: [
    {
      businessId: { value: "0109862-8", registrationDate: "1940-01-01" },
      names: [
        { name: "Kesko Oyj", type: "1", registrationDate: "1998-04-30" },
        {
          name: "Kesko Oy",
          type: "1",
          registrationDate: "1960-04-29",
          endDate: "1998-04-29",
        },
        { name: "Kespro", type: "3", registrationDate: "2017-02-28" },
        { name: "Kesko Corporation", type: "2", registrationDate: "1998-04-30" },
      ],
      addresses: [
        {
          type: 1,
          street: "Työpajankatu",
          postCode: "00580",
          buildingNumber: "12",
          co: "",
          postOffices: [
            { city: "HELSINGFORS", languageCode: "2", municipalityCode: "091" },
            { city: "HELSINKI", languageCode: "1", municipalityCode: "091" },
          ],
        },
        {
          type: 2,
          street: "",
          postCode: "00016",
          postOfficeBox: "1",
          buildingNumber: "",
          co: "",
          postOffices: [
            { city: "KESKO", languageCode: "1", municipalityCode: "091" },
            { city: "KESKO", languageCode: "2", municipalityCode: "091" },
          ],
        },
      ],
    },
  ],
};

describe("YTJ-vastauksen jasennys", () => {
  const osumat = jasennaYtj(KESKO);

  it("poimii voimassa olevan paanimen", () => {
    /*
     * Ei "Kesko Oy" (paattynyt), ei "Kespro" (aputoiminimi) eika
     * "Kesko Corporation" (rinnakkaisnimi).
     */
    expect(osumat).toHaveLength(1);
    expect(osumat[0].name).toBe("Kesko Oyj");
    expect(osumat[0].businessId).toBe("0109862-8");
  });

  it("valitsee postiosoitteen kayntiosoitteen sijaan", () => {
    /* Postilokero, ei Tyopajankatu 12. */
    expect(osumat[0].street).toBe("PL 1");
    expect(osumat[0].postalCode).toBe("00016");
  });

  it("ottaa suomenkielisen postitoimipaikan ja siistii versaalit", () => {
    expect(osumat[0].city).toBe("Kesko");
  });

  it("yhdistaa kadun ja numeron kun postilokeroa ei ole", () => {
    const vain = jasennaYtj({
      companies: [
        {
          businessId: { value: "1041090-0" },
          names: [{ name: "Esimerkki Oy", type: "1" }],
          addresses: [
            {
              type: 1,
              street: "Työpajankatu",
              buildingNumber: "12",
              postCode: "00580",
              postOffices: [{ city: "HELSINKI", languageCode: "1" }],
            },
          ],
        },
      ],
    });

    expect(vain[0].street).toBe("Työpajankatu 12");
    expect(vain[0].city).toBe("Helsinki");
  });

  it("kestaa puuttuvan osoitteen ja nimen", () => {
    const vajaa = jasennaYtj({
      companies: [
        { businessId: { value: "1041090-0" }, names: [{ name: "Vain Nimi Oy", type: "1" }] },
        { businessId: { value: "1041090-0" } },
        { names: [{ name: "Ei tunnusta", type: "1" }] },
        null,
      ],
    });

    expect(vajaa).toHaveLength(1);
    expect(vajaa[0].name).toBe("Vain Nimi Oy");
    expect(vajaa[0].street).toBeNull();
    expect(vajaa[0].city).toBeNull();
  });

  it("kestaa roskan", () => {
    expect(jasennaYtj(null)).toEqual([]);
    expect(jasennaYtj({})).toEqual([]);
    expect(jasennaYtj({ companies: "ei taulukko" })).toEqual([]);
    expect(jasennaYtj("teksti")).toEqual([]);
  });
});
