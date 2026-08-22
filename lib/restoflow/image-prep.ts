/**
 * Kuvan valmistelu poimintaa varten.
 *
 * Kaksi ongelmaa, yksi ratkaisu.
 *
 * 1. HEIC. iPhone tallentaa kuvat oletuksena HEIC-muodossa, jota
 *    poimintarajapinta ei lue. Selain osaa kuitenkin purkaa sen
 *    näytölle, joten canvas-kierros tuottaa siitä JPEG:n.
 *
 * 2. Koko. Nykypuhelimen kuva on 3–8 Mt ja base64 kasvattaa sitä
 *    kolmanneksella. Kuitin tekstin lukemiseen ei tarvita kahdeksaa
 *    megapikseliä — pidempi sivu 2000 pikselissä riittää, ja pienempi
 *    kuva myös vastaa nopeammin.
 *
 * Alkuperäinen tiedosto tallennetaan silti sellaisenaan: pienennetty
 * versio on poiminnan syöte, ei arkistokappale.
 */

/** Pidemmän sivun enimmäispituus. Kuitin teksti erottuu tällä hyvin. */
const MAX_EDGE = 2000;

/** JPEG-laatu. 0.85 on raja jonka alla pieni präntti alkaa sotkeutua. */
const QUALITY = 0.85;

export interface PreparedImage {
  file: File;
  /** Muunnettiinko kuva, vai lähetetäänkö alkuperäinen? */
  converted: boolean;
}

/**
 * Muuntaa kuvan poimintakelpoiseksi JPEG:ksi.
 *
 * PDF menee läpi koskemattomana — rajapinta lukee sen sellaisenaan, ja
 * canvas-kierros tuhoaisi tekstin.
 *
 * Jos muunnos ei onnistu (selain ei osaa purkaa muotoa), palautetaan
 * alkuperäinen. Palvelin kertoo silloin selvästi mitä muotoa ei tueta —
 * se on parempi kuin hiljainen epäonnistuminen täällä.
 */
export async function prepareForExtraction(file: File): Promise<PreparedImage> {
  if (file.type === "application/pdf") return { file, converted: false };

  // Pieni JPEG on jo valmis. Turha kierros heikentäisi laatua.
  if (file.type === "image/jpeg" && file.size < 1_500_000) {
    return { file, converted: false };
  }

  try {
    const bitmap = await decode(file);

    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return { file, converted: false };

    context.drawImage(bitmap, 0, 0, width, height);
    if ("close" in bitmap) bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", QUALITY);
    });

    if (!blob) return { file, converted: false };

    const name = file.name.replace(/\.[^.]+$/, "") || "kuitti";

    return {
      file: new File([blob], `${name}.jpg`, { type: "image/jpeg" }),
      converted: true,
    };
  } catch {
    return { file, converted: false };
  }
}

/**
 * Purkaa kuvan piirrettävään muotoon.
 *
 * createImageBitmap on nopein ja purkaa HEIC:n siellä missä selain sen
 * tuntee. Safari vanhemmissa versioissa ei tue sitä tiedostoista, joten
 * varalla on tavallinen img-elementti.
 */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Varareitille.
    }
  }

  const url = URL.createObjectURL(file);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Kuvaa ei voitu purkaa"));
      image.src = url;
    });
  } finally {
    // Vapautetaan vasta kun kuva on ladattu tai epäonnistunut.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
