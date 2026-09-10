import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { businessRegistrationSchema, validate } from '@/lib/validations';
import { stripe, resolvePlanFromSubscription, getSubscriptionPeriodEnd } from '@/lib/stripe';
import { PAYMENTS_REQUIRED } from '@/lib/payments-config';

// POST /api/auth/register/business
// Registracija novog biznisa.
//
// Kad je PAYMENTS_REQUIRED uključen (podrazumevano): registracija je NAKON
// uspesnog Stripe placanja. Klijent salje samo `sessionId` Stripe Checkout
// session-a. Server zatim:
//   1. Retrieve session iz Stripe API-ja (live)
//   2. Validira `payment_status === 'paid'` i `mode === 'subscription'`
//   3. Validira da je Subscription `active` ili `trialing`
//   4. Cita customer_id, subscription_id, plan i `current_period_end` IZ Stripe-a
// Klijent NIKAD ne moze da postavi `subscription_status: 'active'` bez naplate.
//
// Kad je PAYMENTS_REQUIRED iskljucen (privremeno, do daljnjeg): ceo Stripe
// blok se preskace i biznis se kreira odmah sa subscription_status: 'none'.
export async function POST(request: NextRequest) {
  try {
    const rateLimited = await checkRateLimit(getAuthLimiter(), getClientIp(request));
    if (rateLimited) return rateLimited;

    const body = await request.json();

    const { data: validated, error: validationError } = validate(businessRegistrationSchema, body);
    if (validationError || !validated) {
      return NextResponse.json({ error: validationError || 'Nevažeći podaci' }, { status: 400 });
    }

    const {
      email,
      password,
      companyName,
      phone,
      website,
      industry,
      description,
      cityId,
      lat,
      lng,
      sessionId,
    } = validated;

    let plan: 'monthly' | 'yearly' | null = null;
    let subscriptionStatus: 'active' | 'trialing' | 'none' = 'none';
    let periodEnd: Date | null = null;
    let stripeCustomerId: string | null = null;
    let stripeSubscriptionId: string | null = null;
    let stripeEmail: string | null = null;

    if (PAYMENTS_REQUIRED) {
      if (!sessionId) {
        return NextResponse.json({ error: 'Stripe session ID je obavezan' }, { status: 400 });
      }

      // 1. KLJUCNA PROVERA: Validiraj Stripe Checkout session na serveru
      let session;
      try {
        session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ['subscription', 'customer'],
        });
      } catch {
        return NextResponse.json(
          { error: 'Plaćanje nije pronađeno. Molimo pokušajte ponovo ili pišite na hello@ugcexecutive.com.' },
          { status: 400 }
        );
      }

      if (session.mode !== 'subscription') {
        return NextResponse.json(
          { error: 'Nevažeća sesija plaćanja.' },
          { status: 400 }
        );
      }

      if (session.payment_status !== 'paid') {
        return NextResponse.json(
          { error: 'Plaćanje nije potvrđeno. Molimo sačekajte i pokušajte ponovo.' },
          { status: 402 }
        );
      }

      const subscription = typeof session.subscription === 'object' ? session.subscription : null;
      if (!subscription || (subscription.status !== 'active' && subscription.status !== 'trialing')) {
        return NextResponse.json(
          { error: 'Pretplata nije aktivna. Pišite nam na hello@ugcexecutive.com.' },
          { status: 402 }
        );
      }

      // Plan se IZVODI iz Stripe price-a, ne iz klijenta
      const priceId = subscription.items.data[0]?.price?.id;
      plan = resolvePlanFromSubscription(subscription, priceId);
      if (!plan) {
        return NextResponse.json(
          { error: 'Nepoznat plan pretplate.' },
          { status: 400 }
        );
      }

      // expires_at iz Stripe period-a (ne iz Node Date kalendara)
      periodEnd = getSubscriptionPeriodEnd(subscription);
      if (!periodEnd) {
        return NextResponse.json(
          { error: 'Greška pri čitanju trajanja pretplate.' },
          { status: 500 }
        );
      }

      stripeCustomerId = typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id || null;
      stripeSubscriptionId = subscription.id;

      if (!stripeCustomerId) {
        return NextResponse.json(
          { error: 'Greška pri čitanju Stripe podataka.' },
          { status: 500 }
        );
      }

      subscriptionStatus = subscription.status === 'trialing' ? 'trialing' : 'active';
      stripeEmail = session.customer_email || session.customer_details?.email || null;
    }

    // 2. Kreiraj Supabase admin client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 3. Idempotentnost: ako je za ovaj subscription_id vec napravljen biznis,
    // vrati ga. Sprecava duplikat ako se success page osvezi. (Samo kad ima
    // stripeSubscriptionId - besplatna registracija nema sta da deduplicira ovde.)
    if (stripeSubscriptionId) {
      const { data: existingBusiness } = await supabaseAdmin
        .from('businesses')
        .select('id, user_id, company_name')
        .eq('stripe_subscription_id', stripeSubscriptionId)
        .maybeSingle();

      if (existingBusiness) {
        return NextResponse.json({
          success: true,
          message: 'Nalog već postoji za ovo plaćanje.',
          userId: existingBusiness.user_id,
          businessId: existingBusiness.id,
          companyName: existingBusiness.company_name,
          alreadyExisted: true,
        });
      }
    }

    // 4. Proveri da li email vec postoji u Auth-u
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(u => u.email === email);

    if (emailExists) {
      return NextResponse.json(
        { error: 'Email adresa je već registrovana. Molimo pišite na hello@ugcexecutive.com da povežemo plaćanje sa postojećim nalogom.' },
        { status: 400 }
      );
    }

    if (PAYMENTS_REQUIRED) {
      // Email iz Stripe-a MORA postojati i odgovarati emailu iz forme.
      // Bez obaveznog poklapanja, procureli session_id sa praznim email-om bi
      // dozvolio registraciju pod bilo kojim email-om (krađa tuđe pretplate).
      if (!stripeEmail || stripeEmail.toLowerCase() !== email.toLowerCase()) {
        return NextResponse.json(
          { error: 'Email iz plaćanja ne odgovara email-u iz registracije.' },
          { status: 400 }
        );
      }
    }

    // 5. Kreiraj korisnika u Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'business',
        companyName,
      },
    });

    if (authError) {
      console.error('Supabase Auth error:', authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Greška pri kreiranju korisnika' },
        { status: 500 }
      );
    }

    // 6. Kreiraj user record u nasoj tabeli
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        role: 'business',
      });

    if (userError) {
      console.error('User insert error:', userError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: 'Greška pri kreiranju korisnika u bazi' },
        { status: 500 }
      );
    }

    // 7. Kreiraj business profil (sa Stripe-validiranim podacima kad plaćanje
    // postoji, ili bez njih dok je PAYMENTS_REQUIRED iskljucen)
    const { data: businessData, error: businessError } = await supabaseAdmin
      .from('businesses')
      .insert({
        user_id: authData.user.id,
        company_name: companyName,
        email,
        phone: phone || null,
        website: website || null,
        industry: industry || null,
        description: description || null,
        city_id: cityId || null,
        lat: lat ?? null,
        lng: lng ?? null,
        subscription_type: plan,
        subscription_status: subscriptionStatus,
        subscribed_at: PAYMENTS_REQUIRED ? new Date().toISOString() : null,
        expires_at: periodEnd ? periodEnd.toISOString() : null,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
      })
      .select()
      .single();

    if (businessError) {
      console.error('Business insert error:', businessError);
      await supabaseAdmin.from('users').delete().eq('id', authData.user.id);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: 'Greška pri kreiranju poslovnog profila' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Registracija uspešna!',
      userId: authData.user.id,
      businessId: businessData.id,
      companyName: businessData.company_name,
      plan,
      expiresAt: periodEnd ? periodEnd.toISOString() : null,
    });

  } catch (error) {
    console.error('Business registration error:', error);
    return NextResponse.json(
      { error: 'Greška na serveru' },
      { status: 500 }
    );
  }
}
