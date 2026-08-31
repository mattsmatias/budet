/**
 * Kohteeseen liitetyt tiedostot.
 *
 * Sopimus kuuluu toimittajalle ja tosite kuitille. Ilman tätä ne
 * olisivat vain kaapissa, ja kaapista etsiminen edellyttää muistamista
 * — juuri sitä mitä kaapin oli tarkoitus poistaa.
 *
 * ---------------------------------------------------------------------
 * OSOITTEET LUODAAN TÄSSÄ
 * ---------------------------------------------------------------------
 *
 * Palvelinkomponentti, joten allekirjoitetut osoitteet syntyvät
 * piirron yhteydessä. Se on kannattavaa vain koska liitettyjä
 * tiedostoja on muutama: kaapin oma lista tekee saman vasta
 * klikattaessa, koska siellä niitä on satoja.
 */

import Link from "next/link";
import type { AdminText } from "@/lib/i18n/admin-text";
import { signedUrl } from "@/lib/restoflow/file-queries";
import { fileKind, formatFileSize, type FileRow } from "@/lib/restoflow/files";
import { RfIcon, type IconName } from "./icons";

const KIND_ICONS: Record<string, IconName> = {
  pdf: "file",
  doc: "file",
  sheet: "sales",
  image: "image",
  text: "file",
  other: "file",
};

export async function LinkedFiles({
  t,
  tag,
  files,
}: {
  t: AdminText;
  /** Intl-tunniste kokojen muotoiluun. */
  tag: string;
  files: FileRow[];
}) {
  /*
   * Tyhjää ei näytetä lainkaan.
   *
   * "Ei liitettyjä tiedostoja" olisi rivi joka kertoo ettei mitään
   * ole — sivulla jolla on jo paljon kerrottavaa. Kaappi on
   * navigaatiossa, ja sinne pääsee sieltä.
   */
  if (files.length === 0) return null;

  const urls = await Promise.all(files.map((file) => signedUrl(file.storagePath)));

  return (
    <section>
      <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide"
        style={{ color: "var(--rf-text-3)" }}
      >
        {t.tiedosto.linkedFiles}
      </h3>

      <ul
        style={{
          border: "1px solid var(--rf-line)",
          borderRadius: "var(--rf-r-card)",
        }}
      >
        {files.map((file, index) => {
          const url = urls[index];

          return (
            <li
              key={file.id}
              className="flex items-center gap-3 px-3 py-2.5"
              style={{
                borderBottom:
                  index === files.length - 1
                    ? "none"
                    : "1px solid var(--rf-line)",
              }}
            >
              <span style={{ color: "var(--rf-text-3)" }}>
                <RfIcon
                  name={KIND_ICONS[fileKind(file.type, file.name)] ?? "file"}
                  size={18}
                />
              </span>

              <span className="min-w-0 flex-1">
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-[14px] font-medium"
                  >
                    {file.name}
                  </a>
                ) : (
                  <span className="block truncate text-[14px] font-medium">
                    {file.name}
                  </span>
                )}

                <span
                  className="text-[12px]"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  {formatFileSize(file.size, tag)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-1.5 text-[12px]">
        <Link href="/admin/tiedostot" style={{ color: "var(--rf-text-2)" }}>
          {t.tiedosto.title}
        </Link>
      </p>
    </section>
  );
}
