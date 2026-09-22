import type { AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";

/**
 * Kutsuviesti kopioitavaksi.
 *
 * Sama teksti kahdessa paikassa: asetusten kutsulomakkeessa ja
 * työntekijän kortilla. Kaksi kopiota ajautuisi erilleen ensimmäisellä
 * muutoksella, ja toinen niistä neuvoisi väärään osoitteeseen.
 *
 * Koodi on viestissä selvänä, koska juuri se on lähetettävä. Sitä ei
 * voi hakea myöhemmin: kannassa on vain tiiviste.
 */
export function inviteMessage(input: {
  t: AdminText;
  /** Sovelluksen osoite, esimerkiksi https://kateapp.fi. */
  origin: string;
  code: string;
  /** Roolin nimi käyttäjän kielellä. */
  roleName: string;
}): string {
  const { t, origin, code, roleName } = input;

  return [
    fill(t.tiimi.inviteLine1, { rooli: roleName.toLowerCase() }),
    "",
    fill(t.tiimi.inviteLine2, { osoite: origin }),
    fill(t.tiimi.inviteLine5, { koodi: code }),
    t.tiimi.inviteLine3,
    "",
    t.tiimi.inviteLine6,
  ].join("\n");
}
