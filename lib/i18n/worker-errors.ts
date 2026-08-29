import type { AppLocale } from "./app-locales";

/**
 * Työntekijänäkymän palvelinviestit.
 *
 * ERILLÄÄN NÄKYMÄN TEKSTEISTÄ.
 *
 * Näitä käytetään vain server actioneissa. Jos ne olisivat samassa
 * sanakirjassa kuin otsikot, ne lähtisivät selaimeen jokaisen sivun
 * mukana vaikka niitä ei useimmiten näytetä koskaan.
 *
 * VIRHE ON SE TEKSTI JOKA LUETAAN TARKIMMIN.
 *
 * Otsikon voi arvata kuvasta, mutta "miksi leimaus ei mennyt läpi" on
 * luettava. Siksi nämä käännetään samalla huolella kuin näkymä — ja
 * siksi ne on käännetty kokonaisiksi lauseiksi eikä koodeiksi.
 */

const fi = {
  unknownClockType: "Tuntematon leimaustyyppi.",
  noActiveShift:
    "Sinulla ei ole juuri nyt voimassa olevaa työvuoroa. Leimaus avautuu vuoron alkaessa.",
  badState:
    "Leimaus ei käy nykyisessä tilassa. Tilanne on päivitetty — se on saattanut muuttua toisessa välilehdessä.",
  clockFailed: "Leimaus epäonnistui",
  clockedIn: "Sisäänleimaus kirjattu.",
  breakStarted: "Tauko alkoi.",
  backAtWork: "Takaisin töissä.",
  clockedOut: "Uloskirjaus kirjattu.",

  checkDate: "Tarkista päivämäärä.",
  checkEndDate: "Tarkista loppupäivä.",
  endBeforeStart: "Poissaolo ei voi päättyä ennen kuin se alkaa.",
  absenceSaveFailed: "Ilmoituksen tallennus epäonnistui",
  absenceReported: "Poissaolo ilmoitettu.",

  nameMissing: "Nimi puuttuu.",
  nameSaveFailed: "Nimen tallennus epäonnistui",
  nameSaved: "Nimi tallennettu.",

  passwordMin: "Salasanassa on oltava vähintään 8 merkkiä.",
  passwordsDiffer: "Salasanat eivät täsmää.",
  samePassword: "Uusi salasana ei voi olla sama kuin vanha.",
  passwordChangeFailed:
    "Salasanan vaihto ei onnistunut. Kirjaudu ulos ja takaisin sisään, ja yritä uudelleen.",
  passwordChanged: "Salasana vaihdettu.",

  migrationsMissing: "Tietokannan rakenteet puuttuvat. Aja migraatiot ensin.",
  noPermission: "Sinulla ei ole oikeutta tähän toimintoon.",
  sessionExpired: "Istunto on vanhentunut. Kirjaudu uudelleen sisään.",
  onlyManagerTimes: "Vuoron aikoja voi muuttaa vain esihenkilö.",

  birthdaySaveFailed: "Syntymäpäivän tallennus epäonnistui",
  birthdayRemoved: "Syntymäpäivä poistettu.",
  birthdaySaved: "Syntymäpäivä tallennettu.",

  unknownShift: "Tuntematon työvuoro.",
  someoneFirst: "Joku ehti ensin — vuoro on jo otettu.",
  overlappingShift: "Sinulla on jo työvuoro samaan aikaan. Kysy esihenkilöltä.",
  shiftEnded: "Työvuoro on jo päättynyt.",
  otherPosition: "Työvuoro on toiselle asemalle.",
  claimingDisabled: "Vuorojen ottaminen ei ole käytössä tässä ravintolassa.",
  claimFailed: "Vuoron ottaminen epäonnistui",
  shiftIsYours: "Työvuoro on nyt sinun.",
};

export type WorkerErrors = typeof fi;

const en: WorkerErrors = {
  unknownClockType: "Unknown clock-in type.",
  noActiveShift:
    "You do not have an active shift right now. Clocking in opens when the shift starts.",
  badState:
    "That does not work in the current state. The situation has been refreshed — it may have changed in another tab.",
  clockFailed: "Clocking in failed",
  clockedIn: "Clock-in recorded.",
  breakStarted: "Break started.",
  backAtWork: "Back at work.",
  clockedOut: "Clock-out recorded.",
  checkDate: "Check the date.",
  checkEndDate: "Check the end date.",
  endBeforeStart: "An absence cannot end before it begins.",
  absenceSaveFailed: "Saving the report failed",
  absenceReported: "Absence reported.",
  nameMissing: "Name is missing.",
  nameSaveFailed: "Saving the name failed",
  nameSaved: "Name saved.",
  passwordMin: "The password must be at least 8 characters.",
  passwordsDiffer: "The passwords do not match.",
  samePassword: "The new password cannot be the same as the old one.",
  passwordChangeFailed:
    "Changing the password did not work. Sign out and back in, then try again.",
  passwordChanged: "Password changed.",
  migrationsMissing: "The database structures are missing. Run the migrations first.",
  noPermission: "You do not have permission for this action.",
  sessionExpired: "Your session has expired. Sign in again.",
  onlyManagerTimes: "Only a manager can change the times of a shift.",
  birthdaySaveFailed: "Saving the birthday failed",
  birthdayRemoved: "Birthday removed.",
  birthdaySaved: "Birthday saved.",
  unknownShift: "Unknown shift.",
  someoneFirst: "Someone was first — the shift is already taken.",
  overlappingShift: "You already have a shift at the same time. Ask your manager.",
  shiftEnded: "The shift has already ended.",
  otherPosition: "The shift is for a different position.",
  claimingDisabled: "Taking shifts is not enabled at this restaurant.",
  claimFailed: "Taking the shift failed",
  shiftIsYours: "The shift is yours now.",
};

const sv: WorkerErrors = {
  unknownClockType: "Okänd stämplingstyp.",
  noActiveShift:
    "Du har inget pågående pass just nu. Instämpling öppnar när passet börjar.",
  badState:
    "Det går inte i nuvarande läge. Läget har uppdaterats — det kan ha ändrats i en annan flik.",
  clockFailed: "Stämplingen misslyckades",
  clockedIn: "Instämpling registrerad.",
  breakStarted: "Rasten började.",
  backAtWork: "Tillbaka på jobbet.",
  clockedOut: "Utstämpling registrerad.",
  checkDate: "Kontrollera datumet.",
  checkEndDate: "Kontrollera slutdatumet.",
  endBeforeStart: "En frånvaro kan inte sluta innan den börjar.",
  absenceSaveFailed: "Anmälan kunde inte sparas",
  absenceReported: "Frånvaron anmäld.",
  nameMissing: "Namnet saknas.",
  nameSaveFailed: "Namnet kunde inte sparas",
  nameSaved: "Namnet sparat.",
  passwordMin: "Lösenordet måste vara minst 8 tecken.",
  passwordsDiffer: "Lösenorden stämmer inte överens.",
  samePassword: "Det nya lösenordet kan inte vara samma som det gamla.",
  passwordChangeFailed:
    "Lösenordet kunde inte bytas. Logga ut och in igen, och försök på nytt.",
  passwordChanged: "Lösenordet bytt.",
  migrationsMissing: "Databasens strukturer saknas. Kör migrationerna först.",
  noPermission: "Du har inte behörighet till den här åtgärden.",
  sessionExpired: "Sessionen har gått ut. Logga in igen.",
  onlyManagerTimes: "Bara en chef kan ändra tiderna för ett pass.",
  birthdaySaveFailed: "Födelsedagen kunde inte sparas",
  birthdayRemoved: "Födelsedagen borttagen.",
  birthdaySaved: "Födelsedagen sparad.",
  unknownShift: "Okänt pass.",
  someoneFirst: "Någon hann före — passet är redan taget.",
  overlappingShift: "Du har redan ett pass samtidigt. Fråga din chef.",
  shiftEnded: "Passet har redan slutat.",
  otherPosition: "Passet gäller en annan befattning.",
  claimingDisabled: "Att ta pass är inte aktiverat på den här restaurangen.",
  claimFailed: "Passet kunde inte tas",
  shiftIsYours: "Passet är ditt nu.",
};

const da: WorkerErrors = {
  unknownClockType: "Ukendt stemplingstype.",
  noActiveShift:
    "Du har ingen aktiv vagt lige nu. Indstempling åbner, når vagten begynder.",
  badState:
    "Det kan ikke lade sig gøre i den nuværende tilstand. Situationen er opdateret — den kan være ændret i en anden fane.",
  clockFailed: "Stemplingen mislykkedes",
  clockedIn: "Indstempling registreret.",
  breakStarted: "Pausen begyndte.",
  backAtWork: "Tilbage på arbejde.",
  clockedOut: "Udstempling registreret.",
  checkDate: "Kontrollér datoen.",
  checkEndDate: "Kontrollér slutdatoen.",
  endBeforeStart: "Et fravær kan ikke slutte, før det begynder.",
  absenceSaveFailed: "Meldingen kunne ikke gemmes",
  absenceReported: "Fraværet er meldt.",
  nameMissing: "Navnet mangler.",
  nameSaveFailed: "Navnet kunne ikke gemmes",
  nameSaved: "Navnet er gemt.",
  passwordMin: "Adgangskoden skal være mindst 8 tegn.",
  passwordsDiffer: "Adgangskoderne er ikke ens.",
  samePassword: "Den nye adgangskode må ikke være den samme som den gamle.",
  passwordChangeFailed:
    "Adgangskoden kunne ikke skiftes. Log ud og ind igen, og prøv så igen.",
  passwordChanged: "Adgangskoden er skiftet.",
  migrationsMissing: "Databasens strukturer mangler. Kør migrationerne først.",
  noPermission: "Du har ikke rettigheder til denne handling.",
  sessionExpired: "Din session er udløbet. Log ind igen.",
  onlyManagerTimes: "Kun en leder kan ændre tiderne på en vagt.",
  birthdaySaveFailed: "Fødselsdagen kunne ikke gemmes",
  birthdayRemoved: "Fødselsdagen er fjernet.",
  birthdaySaved: "Fødselsdagen er gemt.",
  unknownShift: "Ukendt vagt.",
  someoneFirst: "Nogen nåede først — vagten er allerede taget.",
  overlappingShift: "Du har allerede en vagt på samme tid. Spørg din leder.",
  shiftEnded: "Vagten er allerede slut.",
  otherPosition: "Vagten er til en anden stilling.",
  claimingDisabled: "At tage vagter er ikke slået til på denne restaurant.",
  claimFailed: "Vagten kunne ikke tages",
  shiftIsYours: "Vagten er din nu.",
};

const tr: WorkerErrors = {
  unknownClockType: "Bilinmeyen kayıt türü.",
  noActiveShift:
    "Şu anda geçerli bir vardiyan yok. Giriş kaydı vardiya başlayınca açılır.",
  badState:
    "Bu, mevcut durumda yapılamaz. Durum yenilendi — başka bir sekmede değişmiş olabilir.",
  clockFailed: "Kayıt başarısız",
  clockedIn: "Giriş kaydedildi.",
  breakStarted: "Mola başladı.",
  backAtWork: "İş başına dönüldü.",
  clockedOut: "Çıkış kaydedildi.",
  checkDate: "Tarihi kontrol et.",
  checkEndDate: "Bitiş tarihini kontrol et.",
  endBeforeStart: "Devamsızlık başlamadan bitemez.",
  absenceSaveFailed: "Bildirim kaydedilemedi",
  absenceReported: "Devamsızlık bildirildi.",
  nameMissing: "Ad eksik.",
  nameSaveFailed: "Ad kaydedilemedi",
  nameSaved: "Ad kaydedildi.",
  passwordMin: "Parola en az 8 karakter olmalı.",
  passwordsDiffer: "Parolalar eşleşmiyor.",
  samePassword: "Yeni parola eskisiyle aynı olamaz.",
  passwordChangeFailed:
    "Parola değiştirilemedi. Çıkış yapıp tekrar giriş yap, sonra yeniden dene.",
  passwordChanged: "Parola değiştirildi.",
  migrationsMissing: "Veritabanı yapıları eksik. Önce geçişleri çalıştır.",
  noPermission: "Bu işlem için yetkin yok.",
  sessionExpired: "Oturumun sona erdi. Tekrar giriş yap.",
  onlyManagerTimes: "Vardiya saatlerini yalnızca yönetici değiştirebilir.",
  birthdaySaveFailed: "Doğum günü kaydedilemedi",
  birthdayRemoved: "Doğum günü kaldırıldı.",
  birthdaySaved: "Doğum günü kaydedildi.",
  unknownShift: "Bilinmeyen vardiya.",
  someoneFirst: "Biri önce davrandı — vardiya alınmış.",
  overlappingShift: "Aynı saatte zaten bir vardiyan var. Yöneticine sor.",
  shiftEnded: "Vardiya çoktan bitti.",
  otherPosition: "Vardiya başka bir pozisyon için.",
  claimingDisabled: "Bu restoranda vardiya alma özelliği açık değil.",
  claimFailed: "Vardiya alınamadı",
  shiftIsYours: "Vardiya artık senin.",
};

const et: WorkerErrors = {
  unknownClockType: "Tundmatu registreerimise tüüp.",
  noActiveShift:
    "Sul ei ole praegu kehtivat vahetust. Sisseregistreerimine avaneb vahetuse alguses.",
  badState:
    "Praeguses olekus see ei õnnestu. Olukord on värskendatud — see võis muutuda teises kaardil.",
  clockFailed: "Registreerimine ebaõnnestus",
  clockedIn: "Sisseregistreerimine salvestatud.",
  breakStarted: "Paus algas.",
  backAtWork: "Tagasi tööl.",
  clockedOut: "Väljaregistreerimine salvestatud.",
  checkDate: "Kontrolli kuupäeva.",
  checkEndDate: "Kontrolli lõppkuupäeva.",
  endBeforeStart: "Puudumine ei saa lõppeda enne, kui see algab.",
  absenceSaveFailed: "Teate salvestamine ebaõnnestus",
  absenceReported: "Puudumisest on teatatud.",
  nameMissing: "Nimi puudub.",
  nameSaveFailed: "Nime salvestamine ebaõnnestus",
  nameSaved: "Nimi salvestatud.",
  passwordMin: "Parool peab olema vähemalt 8 märki.",
  passwordsDiffer: "Paroolid ei klapi.",
  samePassword: "Uus parool ei tohi olla sama mis vana.",
  passwordChangeFailed:
    "Parooli vahetamine ebaõnnestus. Logi välja ja uuesti sisse ning proovi siis uuesti.",
  passwordChanged: "Parool vahetatud.",
  migrationsMissing: "Andmebaasi struktuurid puuduvad. Käivita esmalt migratsioonid.",
  noPermission: "Sul ei ole selleks toiminguks õigust.",
  sessionExpired: "Sinu sessioon on aegunud. Logi uuesti sisse.",
  onlyManagerTimes: "Vahetuse aegu saab muuta ainult juhataja.",
  birthdaySaveFailed: "Sünnipäeva salvestamine ebaõnnestus",
  birthdayRemoved: "Sünnipäev eemaldatud.",
  birthdaySaved: "Sünnipäev salvestatud.",
  unknownShift: "Tundmatu vahetus.",
  someoneFirst: "Keegi jõudis ette — vahetus on juba võetud.",
  overlappingShift: "Sul on samal ajal juba vahetus. Küsi juhatajalt.",
  shiftEnded: "Vahetus on juba lõppenud.",
  otherPosition: "Vahetus on mõne teise ametikoha jaoks.",
  claimingDisabled: "Selles restoranis ei ole vahetuste võtmine sisse lülitatud.",
  claimFailed: "Vahetuse võtmine ebaõnnestus",
  shiftIsYours: "Vahetus on nüüd sinu.",
};

const KAIKKI: Record<AppLocale, WorkerErrors> = { fi, en, sv, da, tr, et };

/** Viestit valitulla kielellä; tuntematon kieli saa suomen. */
export function workerErrors(locale: AppLocale): WorkerErrors {
  return KAIKKI[locale] ?? fi;
}
