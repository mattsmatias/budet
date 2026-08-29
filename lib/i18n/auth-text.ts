import type { AppLocale } from "./app-locales";

/**
 * Kirjautumisen tekstit.
 *
 * ENSIMMÄINEN KÄÄNNETTY OSA SOVELLUSTA.
 *
 * Kielivalitsin oli olemassa ennen käännöksiä: kielen valitseminen
 * vaihtoi numeroiden muodon ja Matin vastauskielen, mutta näkymä jäi
 * suomeksi. Kirjautuminen on ensimmäinen osa joka oikeasti kääntyy,
 * ja se on oikea järjestys — kirjautumaton ei voi vaihtaa kieltä
 * profiilistaan, joten jos hän ei ymmärrä lomaketta, hän ei pääse
 * sisään vaihtamaan sitä.
 *
 * TYYPPI JOHDETAAN SUOMESTA.
 *
 * Puuttuva käännös on käännösvirhe eikä ajonaikainen yllätys:
 * kääntämätön avain ei mene läpi tyypintarkistuksesta. Sama kuvio kuin
 * julkisten sivujen dictionary.ts:ssä.
 *
 * VIRHEET OVAT MYÖS TEKSTEJÄ.
 *
 * Lomakkeen validointi ja palvelimen vastaukset ovat täällä samassa
 * paikassa kuin otsikot. Kääntämätön virheilmoitus on se jonka
 * käyttäjä näkee juuri silloin kun hän on jo pulassa.
 */

const fi = {
  kentat: {
    email: "Sähköposti",
    password: "Salasana",
    newPassword: "Uusi salasana",
    newPasswordAgain: "Uusi salasana uudelleen",
    name: "Nimi",
    min8: "Vähintään 8 merkkiä.",
  },

  kirjaudu: {
    metaTitle: "Kirjaudu",
    title: "Kirjaudu sisään",
    noAccount: "Ei vielä tunnusta?",
    createAccount: "Luo tunnus",
    gotCode: "Saitko kutsukoodin?",
    joinRestaurant: "Liity ravintolaan",
    forgot: "Unohtuiko salasana?",
    idle: "Kirjaudu",
    busy: "Kirjaudutaan…",
    notConfiguredTitle: "Kirjautumista ei ole otettu käyttöön",
    notConfiguredBody:
      "Ympäristömuuttujat NEXT_PUBLIC_SUPABASE_URL ja NEXT_PUBLIC_SUPABASE_ANON_KEY puuttuvat tästä ympäristöstä.",
  },

  liity: {
    metaTitle: "Liity ravintolaan",
    title: "Liity ravintolaan",
    body: "Sait kutsukoodin esihenkilöltäsi. Syötä se tähän, niin näet mihin olet liittymässä.",
    codeLabel: "Kutsukoodi",
    idle: "Jatka",
    busy: "Tarkistetaan…",
    haveAccount: "Onko sinulla jo tunnus?",
    signIn: "Kirjaudu",
    ownRestaurant: "Perustatko oman ravintolan?",
  },

  rekisteroidy: {
    metaTitle: "Luo tunnus",
    title: "Luo tunnus",
    haveAccount: "Onko sinulla jo tunnus?",
    signIn: "Kirjaudu",
    joiningLabel: "Liityt ravintolaan",
    joiningNote:
      "Luo tunnus, niin liittäminen tapahtuu automaattisesti. Koodia ei tarvitse syöttää uudelleen.",
    inviteMissing: "Kutsukoodi puuttuu tai on vanhentunut.",
    enterCodeAgain: "Syötä koodi uudelleen",
    notConfigured: "Rekisteröitymistä ei ole otettu käyttöön tässä ympäristössä.",
    idle: "Luo tunnus",
    busy: "Luodaan…",
  },

  unohtui: {
    metaTitle: "Unohtuiko salasana",
    title: "Unohtuiko salasana?",
    body: "Anna sähköpostiosoitteesi, niin lähetämme linkin jolla asetat uuden salasanan.",
    idle: "Lähetä palautuslinkki",
    busy: "Lähetetään…",
    privacyNote:
      "Vastaus on sama riippumatta siitä onko osoitteella tiliä. Näin kukaan ei voi selvittää kokeilemalla kenellä on tunnus.",
    remembered: "Muistitkin sen?",
    signIn: "Kirjaudu sisään",
  },

  uusiSalasana: {
    metaTitle: "Uusi salasana",
    title: "Uusi salasana",
    forAccount: "Asetat salasanan tunnukselle {email}.",
    idle: "Aseta salasana",
    busy: "Tallennetaan…",
    invalidTitle: "Linkki ei kelpaa",
    invalidBody:
      "Palautuslinkki on vanhentunut tai se on jo käytetty. Linkki toimii kerran ja on voimassa tunnin.",
    requestNew: "Pyydä uusi linkki",
  },

  virheet: {
    checkEmail: "Tarkista sähköpostiosoite.",
    passwordMin: "Salasanassa on oltava vähintään 8 merkkiä.",
    nameMissing: "Nimi puuttuu.",
    badCredentials: "Sähköposti tai salasana ei täsmää.",
    alreadyRegistered: "Tällä sähköpostilla on jo tunnus. Kirjaudu sisään.",
    passwordWeak: "Salasana ei täytä vaatimuksia. Käytä vähintään 8 merkkiä.",
    rateLimit: "Liian monta yritystä. Odota hetki ja yritä uudelleen.",
    signUpFailed: "Rekisteröityminen epäonnistui: {syy}",
    confirmSent:
      "Lähetimme vahvistuslinkin sähköpostiisi. Avaa se ja palaa tänne kirjautumaan.",
    resetSent:
      "Jos osoitteella on tili, lähetimme sinne palautuslinkin. Linkki on voimassa tunnin.",
    passwordsDiffer: "Salasanat eivät täsmää.",
    resetExpired: "Palautuslinkki on vanhentunut tai jo käytetty. Pyydä uusi linkki.",
    samePassword: "Uusi salasana ei voi olla sama kuin vanha.",
    changeFailed: "Salasanan vaihto ei onnistunut. Yritä uudelleen.",
    enterCode: "Syötä kutsukoodi.",
    badCode:
      "Koodi ei kelpaa. Tarkista se esihenkilöltäsi — koodi voi olla myös jo käytetty tai vanhentunut.",
  },
};

/*
 * Ei "as const".
 *
 * Sen kanssa jokaisesta merkkijonosta tulisi oma kirjaimellinen
 * tyyppinsä, ja käännös kaatuisi tyypintarkistukseen: "Sign in" ei ole
 * tyyppiä "Kirjaudu". Rakenne halutaan lukita, arvot eivät.
 */
export type AuthText = typeof fi;

const en: AuthText = {
  kentat: {
    email: "Email",
    password: "Password",
    newPassword: "New password",
    newPasswordAgain: "New password again",
    name: "Name",
    min8: "At least 8 characters.",
  },
  kirjaudu: {
    metaTitle: "Sign in",
    title: "Sign in",
    noAccount: "No account yet?",
    createAccount: "Create an account",
    gotCode: "Got an invite code?",
    joinRestaurant: "Join a restaurant",
    forgot: "Forgot your password?",
    idle: "Sign in",
    busy: "Signing in…",
    notConfiguredTitle: "Sign-in is not enabled",
    notConfiguredBody:
      "The environment variables NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are missing from this environment.",
  },
  liity: {
    metaTitle: "Join a restaurant",
    title: "Join a restaurant",
    body: "Your manager gave you an invite code. Enter it here to see what you are joining.",
    codeLabel: "Invite code",
    idle: "Continue",
    busy: "Checking…",
    haveAccount: "Already have an account?",
    signIn: "Sign in",
    ownRestaurant: "Starting your own restaurant?",
  },
  rekisteroidy: {
    metaTitle: "Create an account",
    title: "Create an account",
    haveAccount: "Already have an account?",
    signIn: "Sign in",
    joiningLabel: "You are joining",
    joiningNote:
      "Create your account and you will be added automatically. You do not need to enter the code again.",
    inviteMissing: "The invite code is missing or has expired.",
    enterCodeAgain: "Enter the code again",
    notConfigured: "Sign-up is not enabled in this environment.",
    idle: "Create account",
    busy: "Creating…",
  },
  unohtui: {
    metaTitle: "Forgot your password",
    title: "Forgot your password?",
    body: "Enter your email address and we will send you a link for setting a new password.",
    idle: "Send reset link",
    busy: "Sending…",
    privacyNote:
      "The response is the same whether or not the address has an account. That way nobody can find out who has one by guessing.",
    remembered: "Remembered it after all?",
    signIn: "Sign in",
  },
  uusiSalasana: {
    metaTitle: "New password",
    title: "New password",
    forAccount: "You are setting the password for {email}.",
    idle: "Set password",
    busy: "Saving…",
    invalidTitle: "This link is not valid",
    invalidBody:
      "The reset link has expired or has already been used. A link works once and is valid for an hour.",
    requestNew: "Request a new link",
  },
  virheet: {
    checkEmail: "Check the email address.",
    passwordMin: "The password must be at least 8 characters.",
    nameMissing: "Name is missing.",
    badCredentials: "Email or password does not match.",
    alreadyRegistered: "This email already has an account. Sign in instead.",
    passwordWeak: "The password does not meet the requirements. Use at least 8 characters.",
    rateLimit: "Too many attempts. Wait a moment and try again.",
    signUpFailed: "Sign-up failed: {syy}",
    confirmSent:
      "We sent a confirmation link to your email. Open it and come back here to sign in.",
    resetSent:
      "If the address has an account, we sent a reset link to it. The link is valid for an hour.",
    passwordsDiffer: "The passwords do not match.",
    resetExpired: "The reset link has expired or has already been used. Request a new one.",
    samePassword: "The new password cannot be the same as the old one.",
    changeFailed: "Changing the password did not work. Try again.",
    enterCode: "Enter the invite code.",
    badCode:
      "That code is not valid. Check it with your manager — it may also have been used already or expired.",
  },
};

const sv: AuthText = {
  kentat: {
    email: "E-post",
    password: "Lösenord",
    newPassword: "Nytt lösenord",
    newPasswordAgain: "Nytt lösenord igen",
    name: "Namn",
    min8: "Minst 8 tecken.",
  },
  kirjaudu: {
    metaTitle: "Logga in",
    title: "Logga in",
    noAccount: "Inget konto än?",
    createAccount: "Skapa konto",
    gotCode: "Fick du en inbjudningskod?",
    joinRestaurant: "Gå med i en restaurang",
    forgot: "Glömt lösenordet?",
    idle: "Logga in",
    busy: "Loggar in…",
    notConfiguredTitle: "Inloggning är inte aktiverad",
    notConfiguredBody:
      "Miljövariablerna NEXT_PUBLIC_SUPABASE_URL och NEXT_PUBLIC_SUPABASE_ANON_KEY saknas i den här miljön.",
  },
  liity: {
    metaTitle: "Gå med i en restaurang",
    title: "Gå med i en restaurang",
    body: "Din chef gav dig en inbjudningskod. Ange den här så ser du vad du går med i.",
    codeLabel: "Inbjudningskod",
    idle: "Fortsätt",
    busy: "Kontrollerar…",
    haveAccount: "Har du redan ett konto?",
    signIn: "Logga in",
    ownRestaurant: "Startar du en egen restaurang?",
  },
  rekisteroidy: {
    metaTitle: "Skapa konto",
    title: "Skapa konto",
    haveAccount: "Har du redan ett konto?",
    signIn: "Logga in",
    joiningLabel: "Du går med i",
    joiningNote:
      "Skapa kontot så läggs du till automatiskt. Du behöver inte ange koden igen.",
    inviteMissing: "Inbjudningskoden saknas eller har gått ut.",
    enterCodeAgain: "Ange koden igen",
    notConfigured: "Registrering är inte aktiverad i den här miljön.",
    idle: "Skapa konto",
    busy: "Skapar…",
  },
  unohtui: {
    metaTitle: "Glömt lösenordet",
    title: "Glömt lösenordet?",
    body: "Ange din e-postadress så skickar vi en länk där du kan ange ett nytt lösenord.",
    idle: "Skicka återställningslänk",
    busy: "Skickar…",
    privacyNote:
      "Svaret är detsamma oavsett om adressen har ett konto. Så kan ingen ta reda på vem som har ett genom att gissa.",
    remembered: "Kom du på det ändå?",
    signIn: "Logga in",
  },
  uusiSalasana: {
    metaTitle: "Nytt lösenord",
    title: "Nytt lösenord",
    forAccount: "Du anger lösenordet för {email}.",
    idle: "Spara lösenord",
    busy: "Sparar…",
    invalidTitle: "Länken gäller inte",
    invalidBody:
      "Återställningslänken har gått ut eller redan använts. En länk fungerar en gång och gäller i en timme.",
    requestNew: "Begär en ny länk",
  },
  virheet: {
    checkEmail: "Kontrollera e-postadressen.",
    passwordMin: "Lösenordet måste vara minst 8 tecken.",
    nameMissing: "Namnet saknas.",
    badCredentials: "E-post eller lösenord stämmer inte.",
    alreadyRegistered: "Den här e-postadressen har redan ett konto. Logga in i stället.",
    passwordWeak: "Lösenordet uppfyller inte kraven. Använd minst 8 tecken.",
    rateLimit: "För många försök. Vänta en stund och försök igen.",
    signUpFailed: "Registreringen misslyckades: {syy}",
    confirmSent:
      "Vi skickade en bekräftelselänk till din e-post. Öppna den och kom tillbaka hit för att logga in.",
    resetSent:
      "Om adressen har ett konto skickade vi en återställningslänk dit. Länken gäller i en timme.",
    passwordsDiffer: "Lösenorden stämmer inte överens.",
    resetExpired: "Återställningslänken har gått ut eller redan använts. Begär en ny.",
    samePassword: "Det nya lösenordet kan inte vara samma som det gamla.",
    changeFailed: "Lösenordet kunde inte bytas. Försök igen.",
    enterCode: "Ange inbjudningskoden.",
    badCode:
      "Koden gäller inte. Kontrollera den med din chef — den kan också redan vara använd eller ha gått ut.",
  },
};

const da: AuthText = {
  kentat: {
    email: "E-mail",
    password: "Adgangskode",
    newPassword: "Ny adgangskode",
    newPasswordAgain: "Ny adgangskode igen",
    name: "Navn",
    min8: "Mindst 8 tegn.",
  },
  kirjaudu: {
    metaTitle: "Log ind",
    title: "Log ind",
    noAccount: "Har du ikke en konto endnu?",
    createAccount: "Opret konto",
    gotCode: "Har du fået en invitationskode?",
    joinRestaurant: "Tilslut dig en restaurant",
    forgot: "Glemt adgangskoden?",
    idle: "Log ind",
    busy: "Logger ind…",
    notConfiguredTitle: "Login er ikke slået til",
    notConfiguredBody:
      "Miljøvariablerne NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_ANON_KEY mangler i dette miljø.",
  },
  liity: {
    metaTitle: "Tilslut dig en restaurant",
    title: "Tilslut dig en restaurant",
    body: "Din leder har givet dig en invitationskode. Indtast den her, så ser du hvad du tilslutter dig.",
    codeLabel: "Invitationskode",
    idle: "Fortsæt",
    busy: "Kontrollerer…",
    haveAccount: "Har du allerede en konto?",
    signIn: "Log ind",
    ownRestaurant: "Starter du din egen restaurant?",
  },
  rekisteroidy: {
    metaTitle: "Opret konto",
    title: "Opret konto",
    haveAccount: "Har du allerede en konto?",
    signIn: "Log ind",
    joiningLabel: "Du tilslutter dig",
    joiningNote:
      "Opret kontoen, så bliver du tilføjet automatisk. Du skal ikke indtaste koden igen.",
    inviteMissing: "Invitationskoden mangler eller er udløbet.",
    enterCodeAgain: "Indtast koden igen",
    notConfigured: "Oprettelse er ikke slået til i dette miljø.",
    idle: "Opret konto",
    busy: "Opretter…",
  },
  unohtui: {
    metaTitle: "Glemt adgangskoden",
    title: "Glemt adgangskoden?",
    body: "Indtast din e-mailadresse, så sender vi et link hvor du kan vælge en ny adgangskode.",
    idle: "Send nulstillingslink",
    busy: "Sender…",
    privacyNote:
      "Svaret er det samme, uanset om adressen har en konto. Sådan kan ingen gætte sig frem til hvem der har en.",
    remembered: "Kom du i tanke om den alligevel?",
    signIn: "Log ind",
  },
  uusiSalasana: {
    metaTitle: "Ny adgangskode",
    title: "Ny adgangskode",
    forAccount: "Du vælger adgangskode for {email}.",
    idle: "Gem adgangskode",
    busy: "Gemmer…",
    invalidTitle: "Linket gælder ikke",
    invalidBody:
      "Nulstillingslinket er udløbet eller allerede brugt. Et link virker én gang og gælder i en time.",
    requestNew: "Bed om et nyt link",
  },
  virheet: {
    checkEmail: "Kontrollér e-mailadressen.",
    passwordMin: "Adgangskoden skal være mindst 8 tegn.",
    nameMissing: "Navnet mangler.",
    badCredentials: "E-mail eller adgangskode passer ikke.",
    alreadyRegistered: "Denne e-mail har allerede en konto. Log ind i stedet.",
    passwordWeak: "Adgangskoden opfylder ikke kravene. Brug mindst 8 tegn.",
    rateLimit: "For mange forsøg. Vent lidt, og prøv igen.",
    signUpFailed: "Oprettelsen mislykkedes: {syy}",
    confirmSent:
      "Vi sendte et bekræftelseslink til din e-mail. Åbn det, og kom tilbage hertil for at logge ind.",
    resetSent:
      "Hvis adressen har en konto, sendte vi et nulstillingslink dertil. Linket gælder i en time.",
    passwordsDiffer: "Adgangskoderne er ikke ens.",
    resetExpired: "Nulstillingslinket er udløbet eller allerede brugt. Bed om et nyt.",
    samePassword: "Den nye adgangskode må ikke være den samme som den gamle.",
    changeFailed: "Adgangskoden kunne ikke skiftes. Prøv igen.",
    enterCode: "Indtast invitationskoden.",
    badCode:
      "Koden gælder ikke. Tjek den med din leder — den kan også allerede være brugt eller udløbet.",
  },
};

const tr: AuthText = {
  kentat: {
    email: "E-posta",
    password: "Parola",
    newPassword: "Yeni parola",
    newPasswordAgain: "Yeni parola tekrar",
    name: "Ad",
    min8: "En az 8 karakter.",
  },
  kirjaudu: {
    metaTitle: "Giriş yap",
    title: "Giriş yap",
    noAccount: "Henüz hesabın yok mu?",
    createAccount: "Hesap oluştur",
    gotCode: "Davet kodun var mı?",
    joinRestaurant: "Bir restorana katıl",
    forgot: "Parolanı mı unuttun?",
    idle: "Giriş yap",
    busy: "Giriş yapılıyor…",
    notConfiguredTitle: "Giriş etkin değil",
    notConfiguredBody:
      "NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY ortam değişkenleri bu ortamda eksik.",
  },
  liity: {
    metaTitle: "Bir restorana katıl",
    title: "Bir restorana katıl",
    body: "Yöneticin sana bir davet kodu verdi. Kodu buraya gir, neye katıldığını gör.",
    codeLabel: "Davet kodu",
    idle: "Devam",
    busy: "Kontrol ediliyor…",
    haveAccount: "Zaten hesabın var mı?",
    signIn: "Giriş yap",
    ownRestaurant: "Kendi restoranını mı kuruyorsun?",
  },
  rekisteroidy: {
    metaTitle: "Hesap oluştur",
    title: "Hesap oluştur",
    haveAccount: "Zaten hesabın var mı?",
    signIn: "Giriş yap",
    joiningLabel: "Katıldığın restoran",
    joiningNote:
      "Hesabını oluştur, ekleme otomatik yapılır. Kodu tekrar girmene gerek yok.",
    inviteMissing: "Davet kodu eksik veya süresi dolmuş.",
    enterCodeAgain: "Kodu tekrar gir",
    notConfigured: "Kayıt bu ortamda etkin değil.",
    idle: "Hesap oluştur",
    busy: "Oluşturuluyor…",
  },
  unohtui: {
    metaTitle: "Parolanı mı unuttun",
    title: "Parolanı mı unuttun?",
    body: "E-posta adresini gir, yeni parola belirlemen için bir bağlantı gönderelim.",
    idle: "Sıfırlama bağlantısı gönder",
    busy: "Gönderiliyor…",
    privacyNote:
      "Adresin hesabı olsa da olmasa da yanıt aynıdır. Böylece kimse deneyerek kimin hesabı olduğunu öğrenemez.",
    remembered: "Yine de hatırladın mı?",
    signIn: "Giriş yap",
  },
  uusiSalasana: {
    metaTitle: "Yeni parola",
    title: "Yeni parola",
    forAccount: "{email} hesabı için parola belirliyorsun.",
    idle: "Parolayı kaydet",
    busy: "Kaydediliyor…",
    invalidTitle: "Bağlantı geçerli değil",
    invalidBody:
      "Sıfırlama bağlantısının süresi dolmuş ya da bağlantı kullanılmış. Bağlantı bir kez çalışır ve bir saat geçerlidir.",
    requestNew: "Yeni bağlantı iste",
  },
  virheet: {
    checkEmail: "E-posta adresini kontrol et.",
    passwordMin: "Parola en az 8 karakter olmalı.",
    nameMissing: "Ad eksik.",
    badCredentials: "E-posta veya parola eşleşmiyor.",
    alreadyRegistered: "Bu e-posta ile zaten bir hesap var. Giriş yap.",
    passwordWeak: "Parola gereksinimleri karşılamıyor. En az 8 karakter kullan.",
    rateLimit: "Çok fazla deneme. Biraz bekleyip tekrar dene.",
    signUpFailed: "Kayıt başarısız: {syy}",
    confirmSent:
      "E-postana bir doğrulama bağlantısı gönderdik. Bağlantıyı aç ve giriş yapmak için buraya dön.",
    resetSent:
      "Adresin bir hesabı varsa oraya sıfırlama bağlantısı gönderdik. Bağlantı bir saat geçerli.",
    passwordsDiffer: "Parolalar eşleşmiyor.",
    resetExpired: "Sıfırlama bağlantısı süresi dolmuş ya da kullanılmış. Yenisini iste.",
    samePassword: "Yeni parola eskisiyle aynı olamaz.",
    changeFailed: "Parola değiştirilemedi. Tekrar dene.",
    enterCode: "Davet kodunu gir.",
    badCode:
      "Kod geçerli değil. Yöneticinle kontrol et — kod kullanılmış ya da süresi dolmuş da olabilir.",
  },
};

const et: AuthText = {
  kentat: {
    email: "E-post",
    password: "Parool",
    newPassword: "Uus parool",
    newPasswordAgain: "Uus parool uuesti",
    name: "Nimi",
    min8: "Vähemalt 8 märki.",
  },
  kirjaudu: {
    metaTitle: "Logi sisse",
    title: "Logi sisse",
    noAccount: "Kontot veel pole?",
    createAccount: "Loo konto",
    gotCode: "Kas said kutsekoodi?",
    joinRestaurant: "Liitu restoraniga",
    forgot: "Unustasid parooli?",
    idle: "Logi sisse",
    busy: "Sisselogimine…",
    notConfiguredTitle: "Sisselogimine ei ole sisse lülitatud",
    notConfiguredBody:
      "Keskkonnamuutujad NEXT_PUBLIC_SUPABASE_URL ja NEXT_PUBLIC_SUPABASE_ANON_KEY puuduvad selles keskkonnas.",
  },
  liity: {
    metaTitle: "Liitu restoraniga",
    title: "Liitu restoraniga",
    body: "Juhataja andis sulle kutsekoodi. Sisesta see siia, siis näed, millega liitud.",
    codeLabel: "Kutsekood",
    idle: "Edasi",
    busy: "Kontrollime…",
    haveAccount: "Kas sul on juba konto?",
    signIn: "Logi sisse",
    ownRestaurant: "Kas asutad oma restorani?",
  },
  rekisteroidy: {
    metaTitle: "Loo konto",
    title: "Loo konto",
    haveAccount: "Kas sul on juba konto?",
    signIn: "Logi sisse",
    joiningLabel: "Liitud restoraniga",
    joiningNote:
      "Loo konto ja liitmine toimub automaatselt. Koodi ei pea uuesti sisestama.",
    inviteMissing: "Kutsekood puudub või on aegunud.",
    enterCodeAgain: "Sisesta kood uuesti",
    notConfigured: "Registreerimine ei ole selles keskkonnas sisse lülitatud.",
    idle: "Loo konto",
    busy: "Loome…",
  },
  unohtui: {
    metaTitle: "Unustasid parooli",
    title: "Unustasid parooli?",
    body: "Sisesta oma e-posti aadress, siis saadame lingi, millega saad uue parooli määrata.",
    idle: "Saada lähtestuslink",
    busy: "Saadame…",
    privacyNote:
      "Vastus on sama olenemata sellest, kas aadressil on konto. Nii ei saa keegi proovimise teel teada, kellel konto on.",
    remembered: "Tuli siiski meelde?",
    signIn: "Logi sisse",
  },
  uusiSalasana: {
    metaTitle: "Uus parool",
    title: "Uus parool",
    forAccount: "Määrad parooli kontole {email}.",
    idle: "Salvesta parool",
    busy: "Salvestame…",
    invalidTitle: "Link ei kehti",
    invalidBody:
      "Lähtestuslink on aegunud või juba kasutatud. Link toimib ühe korra ja kehtib tunni aja.",
    requestNew: "Küsi uus link",
  },
  virheet: {
    checkEmail: "Kontrolli e-posti aadressi.",
    passwordMin: "Parool peab olema vähemalt 8 märki.",
    nameMissing: "Nimi puudub.",
    badCredentials: "E-post või parool ei klapi.",
    alreadyRegistered: "Sellel e-postil on juba konto. Logi sisse.",
    passwordWeak: "Parool ei vasta nõuetele. Kasuta vähemalt 8 märki.",
    rateLimit: "Liiga palju katseid. Oota hetk ja proovi uuesti.",
    signUpFailed: "Registreerimine ebaõnnestus: {syy}",
    confirmSent:
      "Saatsime sinu e-postile kinnituslingi. Ava see ja tule siia tagasi sisse logima.",
    resetSent:
      "Kui aadressil on konto, saatsime sinna lähtestuslingi. Link kehtib tunni aja.",
    passwordsDiffer: "Paroolid ei klapi.",
    resetExpired: "Lähtestuslink on aegunud või juba kasutatud. Küsi uus.",
    samePassword: "Uus parool ei tohi olla sama mis vana.",
    changeFailed: "Parooli vahetamine ebaõnnestus. Proovi uuesti.",
    enterCode: "Sisesta kutsekood.",
    badCode:
      "Kood ei kehti. Kontrolli seda juhatajalt — kood võib olla ka juba kasutatud või aegunud.",
  },
};

const KAIKKI: Record<AppLocale, AuthText> = { fi, en, sv, da, tr, et };

/**
 * Sijoittaa arvot paikkamerkkeihin.
 *
 * EI FUNKTIOITA SANAKIRJASSA.
 *
 * Nämä kaksi tekstiä olivat ensin funktioita, jotka rakensivat
 * lauseen argumentista. Se kaatui ajossa heti kun sanakirja
 * välitettiin selainkomponentille: React ei voi sarjallistaa
 * funktiota palvelimelta selaimeen. Tyypintarkistus ei huomaa sitä,
 * vaan selain — ja vasta kun sivu avataan.
 *
 * Paikkamerkki on sarjallistuva ja kääntäjälle helpompi: hän näkee
 * lauseen kokonaisena eikä palasina.
 */
export function fill(teksti: string, arvot: Record<string, string>): string {
  return Object.entries(arvot).reduce(
    (ulos, [avain, arvo]) => ulos.split(`{${avain}}`).join(arvo),
    teksti,
  );
}

/**
 * Tekstit valitulla kielellä.
 *
 * Tuntematon kieli ei ole mahdollinen tyypin puolesta, mutta arvo voi
 * tulla evästeestä tai kannasta — silloin suomi on oikea vastaus, koska
 * se on ainoa kieli jolla kaikki merkkijonot varmasti ovat.
 */
export function authText(locale: AppLocale): AuthText {
  return KAIKKI[locale] ?? fi;
}
