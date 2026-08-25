"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { signOut } from "@/app/(auth)/actions";
import { ROLE_LABELS, type Alert, type Role } from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";
import { personInitials } from "@/lib/restoflow/initials";
import { severityColor } from "@/components/restoflow/ui";
import { alertIcon } from "@/lib/restoflow/alert-icons";
import { useDismiss } from "@/components/restoflow/use-dismiss";

/**
 * Yläpalkin valikot.
 *
 * Kello ja tunnus ovat vierekkäin ja käyttäytyvät samoin, joten ne
 * jakavat saman pudotusmekaniikan. Kaksi kopiota sulkemislogiikasta
 * ajautuisi erilleen: toinen sulkeutuisi Esc-näppäimestä ja toinen ei,
 * eikä kukaan huomaisi ennen kuin käyttäjä kokeilee.
 *
 * Avoin valikko on yhteistä tilaa eikä kummankaan omaa. Ensin kokeilin
 * kahta itsenäistä valikkoa, jotka sulkisivat toisensa ulkoklikkauksen
 * kautta — mutta näppäimistöllä avattu valikko ei saa
 * mousedown-tapahtumaa, ja molemmat jäivät auki. Tila ratkaisee sen
 * rakenteella: kun vain yksi tunniste voi olla auki, kahta ei voi olla.
 */

// ---------------------------------------------------------------------------

/**
 * Pudotusvalikon kuori.
 *
 * Sulkeminen tulee jaetusta useDismiss-hookista, jota myös
 * kuukausivalitsin käyttää.
 */
function Dropdown({
  label,
  badge,
  width,
  open,
  onToggle,
  onClose,
  trigger,
  children,
}: {
  label: string;
  /**
   * Lukumäärä merkkinä. Nolla piilottaa merkin.
   *
   * Piste kertoi että jotain on. Luku kertoo paljonko, ja se ratkaisee
   * avaako käyttäjä valikon nyt vai illalla.
   */
  badge?: number;
  width: number;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  trigger: (open: boolean) => ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const container = useDismiss<HTMLDivElement>(open, onClose);

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="rf-press rf-icon-btn relative flex h-10 w-10 items-center justify-center"
        style={{ borderRadius: "50%" }}
      >
        {trigger(open)}

        {badge ? (
          <span
            aria-hidden="true"
            className="rf-tabular absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center px-1 text-[10.5px] font-bold leading-none"
            style={{
              background: "var(--rf-red)",
              color: "#fff",
              borderRadius: 980,
              border: "2px solid var(--rf-bg)",
            }}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={label}
          className="rf-enter absolute right-0 z-40 mt-2 overflow-hidden"
          style={{
            width,
            maxWidth: "calc(100vw - 2rem)",
            background: "var(--rf-card)",
            border: "1px solid var(--rf-line)",
            borderRadius: "var(--rf-r-card)",
            boxShadow: "var(--rf-shadow-lg)",
          }}
        >
          {children(onClose)}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Ilmoitukset.
 *
 * Näyttää viisi kiireellisintä. Koko lista on omalla sivullaan, koska
 * pudotusvalikko jota pitää vierittää on huonompi kuin sivu joka on
 * tehty listaa varten.
 *
 * Ilmoituksia ei merkitä luetuiksi eikä voidakaan: ne johdetaan
 * aineiston tilasta joka latauksella eikä niitä tallenneta. Hoidettu
 * asia katoaa listalta itsestään — lukukuittaus antaisi vaikutelman
 * että jokin on tehty, vaikka kuitti olisi yhä tarkistamatta.
 */
function NotificationMenu({
  alerts,
  open,
  onToggle,
  onClose,
}: {
  alerts: Alert[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const shown = alerts.slice(0, 5);
  const critical = alerts.filter((a) => a.severity === "critical").length;

  return (
    <Dropdown
      label={alerts.length > 0 ? `Huomiot, ${alerts.length} uutta` : "Huomiot"}
      badge={alerts.length}
      width={380}
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      trigger={() => <RfIcon name="bell" size={17} />}
    >
      {(close) => (
        <>
          <div
            className="border-b px-[18px] pb-2.5 pt-3"
            style={{ borderColor: "var(--rf-line)" }}
          >
            <p className="text-[15px] font-bold tracking-[-0.0075em]">
              Huomiot{alerts.length > 0 ? ` · ${alerts.length}` : ""}
            </p>

            {/*
              Jakauma otsikon alle.

              Pelkkä luku kertoo montako mutta ei sitä kannattaako
              avata nyt. Yksi kiireellinen kahdeksan joukossa on eri
              tilanne kuin kahdeksan tarkistettavaa, ja ero ratkaisee
              keskeyttääkö käyttäjä sen mitä on tekemässä.
            */}
            {alerts.length > 0 ? (
              <p className="mt-[3px] text-[12.5px]" style={{ color: "var(--rf-text-2)" }}>
                {critical > 0 ? (
                  <>
                    <strong className="font-bold" style={{ color: "var(--rf-red-text)" }}>
                      {critical} kiireellinen
                    </strong>
                    {alerts.length > critical ? ` · ${alerts.length - critical} muuta` : ""}
                  </>
                ) : (
                  "Ei kiireellisiä"
                )}
              </p>
            ) : null}
          </div>

          {alerts.length === 0 ? (
            <div className="flex items-start gap-2.5 px-[18px] py-5">
              <span className="mt-px shrink-0" style={{ color: "var(--rf-green-text)" }}>
                <RfIcon name="check" size={16} />
              </span>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
                Ei huomioita juuri nyt. Ne ilmestyvät tänne itsestään kun
                aineistossa on jotain tarkistettavaa.
              </p>
            </div>
          ) : (
            /*
              Rivit ovat samat kuin yleiskuvan huomiokortissa: ikoni,
              värillinen vasen reuna, otsikko ja selitys. Sama asia
              näytti kahdessa paikassa kahdelta eri asialta — täällä
              vakavuus oli pallo, siellä ikoni ja reuna.
            */
            <ul className="max-h-[24rem] space-y-1.5 overflow-y-auto p-2">
              {shown.map((alert) => (
                <li key={alert.id}>
                  <Link
                    href={alert.href}
                    role="menuitem"
                    onClick={close}
                    className="rf-press rf-alert-row flex items-start gap-[11px] py-[11px] pl-[11px] pr-[13px]"
                    style={{
                      background: "var(--rf-inset)",
                      borderRadius: "var(--rf-r-control)",
                      borderLeft: `2.5px solid ${severityColor(alert.severity)}`,
                    }}
                  >
                    <span
                      className="mt-px shrink-0"
                      style={{ color: severityColor(alert.severity) }}
                    >
                      <RfIcon name={alertIcon(alert.kind)} size={15} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold leading-snug">
                        {alert.title}
                      </span>
                      <span
                        className="mt-0.5 block text-[12.5px] leading-snug"
                        style={{ color: "var(--rf-text-2)" }}
                      >
                        {alert.detail}
                      </span>
                    </span>

                    {/* Nuoli kertoo että rivi vie jonnekin. Ilman sitä
                        koko lista näytti tekstiltä eikä linkeiltä. */}
                    <span className="mt-0.5 shrink-0" style={{ color: "var(--rf-text-3)" }}>
                      <RfIcon name="chevron" size={14} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/*
            Yksi polku koko listaan, aina samassa paikassa.

            Otsikossa oli "Näytä kaikki" ja pohjalla "Ja N muuta" —
            kaksi punaista linkkiä samaan osoitteeseen, ja
            jälkimmäinen katosi kun huomioita oli viisi tai vähemmän.
          */}
          {alerts.length > 0 ? (
            <Link
              href="/admin/ilmoitukset"
              onClick={close}
              className="rf-press block border-t px-[18px] py-2.5 text-center text-[12.5px] font-bold"
              style={{ borderColor: "var(--rf-line)", color: "var(--rf-accent)" }}
            >
              {alerts.length > shown.length
                ? `Näytä kaikki ${alerts.length} huomiota`
                : "Avaa huomiot"}{" "}
              <span aria-hidden="true">→</span>
            </Link>
          ) : null}
        </>
      )}
    </Dropdown>
  );
}

// ---------------------------------------------------------------------------

/**
 * Tunnusvalikko.
 *
 * Asetukset ja uloskirjautuminen eivät ole päivittäisiä tehtäviä eivätkä
 * kuulu samaan listaan kuin Kuitit ja Työvuorot — ne ovat tilin
 * hallintaa, ja tilin hallinta löytyy tunnuksen takaa.
 *
 * TÄSSÄ OLI MYÖS LINKKI TYÖNTEKIJÄNÄKYMÄÄN.
 *
 * Se vei hallinnasta ulos toiseen sovellukseen saman tunnuksen
 * alla, eikä valikosta käynyt ilmi että paluu on eri paikassa.
 * Ravintoloitsijan työpöytä ja työntekijän näkymä ovat eri
 * työkaluja; tämä valikko koskee vain tätä.
 */
function UserMenu({
  userName,
  restaurantName,
  role,
  canOpenSettings,
  open,
  onToggle,
  onClose,
}: {
  userName: string;
  restaurantName: string;
  role: Role;
  canOpenSettings: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  return (
    <Dropdown
      label={`Tunnus: ${userName}`}
      width={240}
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      trigger={() => (
        <span className="rf-initial text-[13px] font-bold tracking-[-0.01em]">
          {personInitials(userName)}
        </span>
      )}
    >
      {(close) => (
        <>
          <div className="border-b px-4 py-3" style={{ borderColor: "var(--rf-line)" }}>
            <p className="truncate text-[14px] font-semibold">{userName}</p>
            <p className="truncate text-[12px]" style={{ color: "var(--rf-text-2)" }}>
              {ROLE_LABELS[role]} · {restaurantName}
            </p>
          </div>

          <div className="p-1.5">
            {canOpenSettings ? (
              <Link
                href="/admin/asetukset"
                role="menuitem"
                onClick={close}
                className="rf-press flex items-center gap-2.5 rounded-[9px] px-2.5 py-2.5 text-[14px]"
                style={{ color: "var(--rf-text)" }}
              >
                <span style={{ color: "var(--rf-text-3)" }}>
                  <RfIcon name="settings" size={17} />
                </span>
                Asetukset
              </Link>
            ) : null}

            <form action={signOut}>
              <button
                type="submit"
                role="menuitem"
                className="rf-press flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2.5 text-left text-[14px]"
                style={{ color: "var(--rf-red-text)" }}
              >
                <RfIcon name="logout" size={17} />
                Kirjaudu ulos
              </button>
            </form>
          </div>
        </>
      )}
    </Dropdown>
  );
}

// ---------------------------------------------------------------------------

/**
 * Yläpalkin valikot yhtenä ryhmänä.
 *
 * Avoin valikko on yhteistä tilaa: kun vain yksi tunniste voi olla
 * auki kerrallaan, kahta ei voi olla auki yhtä aikaa millään
 * syöttötavalla.
 */
export function HeaderMenus({
  alerts,
  userName,
  restaurantName,
  role,
  canOpenSettings,
  showUser = true,
}: {
  alerts: Alert[];
  userName: string;
  restaurantName: string;
  role: Role;
  canOpenSettings: boolean;
  /**
   * Näytetäänkö tunnusvalikko?
   *
   * Työpöydällä ei: käyttäjäkortti on sivupalkin pohjalla. Puhelimessa
   * kyllä, koska siellä ei ole sivupalkkia.
   */
  showUser?: boolean;
}) {
  const [openMenu, setOpenMenu] = useState<"alerts" | "user" | null>(null);

  const close = useCallback(() => setOpenMenu(null), []);

  return (
    <div className="flex shrink-0 items-center gap-2">
      <NotificationMenu
        alerts={alerts}
        open={openMenu === "alerts"}
        onToggle={() =>
          setOpenMenu((current) => (current === "alerts" ? null : "alerts"))
        }
        onClose={close}
      />

      {showUser ? (
      <UserMenu
        userName={userName}
        restaurantName={restaurantName}
        role={role}
        canOpenSettings={canOpenSettings}
        open={openMenu === "user"}
        onToggle={() =>
          setOpenMenu((current) => (current === "user" ? null : "user"))
        }
        onClose={close}
      />
      ) : null}
    </div>
  );
}
