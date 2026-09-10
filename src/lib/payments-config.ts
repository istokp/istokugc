/**
 * Privremeni prekidač za obavezno plaćanje biznisa.
 *
 * Dok je isključen (NEXT_PUBLIC_PAYMENTS_REQUIRED=false u env-u), firme se
 * registruju i koriste platformu (kontakti kreatora, kreiranje poslova,
 * dashboard) BEZ Stripe plaćanja. Vrati na 'true' (ili obriši env varijablu)
 * kad plaćanje treba ponovo da bude obavezno - sve iza ove zastavice se vraća
 * na prethodno ponašanje bez daljih izmena koda.
 *
 * NEXT_PUBLIC_ prefiks jer se ista vrednost čita i na klijentu
 * (src/app/register/biznis/page.tsx bira da li ide na Stripe checkout ili
 * direktno registruje nalog) i na serveru (API rute, auth-helper).
 */
export const PAYMENTS_REQUIRED = process.env.NEXT_PUBLIC_PAYMENTS_REQUIRED !== 'false';
