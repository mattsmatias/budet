/**
 * Poimintaan lähetetyt tiedostot.
 *
 * Kuitit, kassaraportit ja laskut lukevat kaikki kuvan tai PDF:n ja
 * lähettävät sen mallille. Tiedoston tarkistus ja muunnos on joka
 * kerta sama: koko, tyyppi, yhteiskoko, base64.
 *
 * Kaksi kopiota oli jo olemassa. Kolmas olisi ollut se määrä jolla
 * korjaus muistetaan tehdä kahteen paikkaan kolmesta — ja HEIC-viesti
 * on juuri sellainen jota myöhemmin tarkennetaan.
 *
 * Viestit annetaan parametrina eikä kirjoiteta tänne: "kuvaa se
 * uudelleen" on kuitille oikea neuvo, laskulle ei.
 */

const MAX_BYTES = 20 * 1024 * 1024;

/*
 * Yhteiskoko rajataan, sivumäärää ei.
 *
 * Raja on fysiikkaa eikä politiikkaa: yksi pyyntö ei voi olla
 * mielivaltaisen suuri. Sanotaan se selvästi sen sijaan että pyyntö
 * epäonnistuisi tuntemattomaan virheeseen rajapinnassa.
 */
const MAX_TOTAL_BYTES = 28 * 1024 * 1024;

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const PDF_TYPE = "application/pdf";

export { MAX_BYTES, MAX_TOTAL_BYTES, PDF_TYPE };

/**
 * Tiedostot lomakkeesta.
 *
 * Useampi kenttänimi, koska vanha kutsu käyttää "file" ja uusi
 * "pages". Yksi vanha kutsupaikka ei saa hajota nimen vaihtuessa.
 */
export function filesFrom(form: FormData, ...names: string[]): File[] {
  return names
    .flatMap((name) => form.getAll(name))
    .filter((entry): entry is File => entry instanceof File);
}

export interface UploadTexts {
  missing: string;
  tooLarge: string;
  /** Saa sisältää {mb}: yhteiskoko megatavuina. */
  tooLargeTotal: string;
  heic: string;
  unsupported: string;
}

export interface UploadProblem {
  error: string;
  status: number;
}

/**
 * Tarkistaa tiedostot ennen mallikutsua.
 *
 * Palauttaa ongelman tai null. Tarkistus on tässä eikä mallissa,
 * koska kutsu maksaa: väärää tiedostomuotoa ei kannata lähettää
 * ensin ja saada siitä kieltäytyminen takaisin.
 */
export function checkUploads(
  files: File[],
  texts: UploadTexts,
): UploadProblem | null {
  if (files.length === 0) return { error: texts.missing, status: 400 };

  let total = 0;

  for (const file of files) {
    if (file.size > MAX_BYTES) return { error: texts.tooLarge, status: 413 };

    total += file.size;

    if (!IMAGE_TYPES.has(file.type) && file.type !== PDF_TYPE) {
      /*
       * HEIC saa oman viestinsä.
       *
       * Se on iPhonen oletusmuoto, joten se ei ole harvinainen
       * käyttövirhe vaan tavallisin. Yleinen "väärä tiedostomuoto"
       * jättäisi käyttäjän arvaamaan mitä tehdä.
       */
      return {
        error:
          file.type === "image/heic" || file.type === "image/heif"
            ? texts.heic
            : texts.unsupported,
        status: 415,
      };
    }
  }

  if (total > MAX_TOTAL_BYTES) {
    return {
      error: texts.tooLargeTotal.replace(
        "{mb}",
        String(Math.round(total / 1024 / 1024)),
      ),
      status: 413,
    };
  }

  return null;
}

type ImageMedia = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export type ContentBlock =
  | {
      type: "document";
      source: { type: "base64"; media_type: "application/pdf"; data: string };
    }
  | {
      type: "image";
      source: { type: "base64"; media_type: ImageMedia; data: string };
    };

/** Tiedostot mallille kelpaaviksi sisältölohkoiksi, järjestys säilyttäen. */
export async function toContentBlocks(files: File[]): Promise<ContentBlock[]> {
  return Promise.all(
    files.map(async (file) => {
      const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

      return file.type === PDF_TYPE
        ? {
            type: "document" as const,
            source: {
              type: "base64" as const,
              media_type: "application/pdf" as const,
              data: base64,
            },
          }
        : {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: file.type as ImageMedia,
              data: base64,
            },
          };
    }),
  );
}
