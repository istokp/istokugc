/**
 * Auth Helper - Funkcije za proveru autentifikacije u API rutama
 * 
 * Koristi se za zaštitu API endpointa od neovlašćenog pristupa
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { PAYMENTS_REQUIRED } from '@/lib/payments-config';

export interface AuthUser {
  id: string;
  email: string;
  role: 'creator' | 'business' | 'admin';
  creatorId?: string;
  businessId?: string;
}

export interface AuthResult {
  user: AuthUser | null;
  error: NextResponse | null;
}

/**
 * Proverava da li je korisnik ulogovan i vraća njegove podatke
 * Koristi se na početku svake zaštićene API rute
 * 
 * Primer korišćenja:
 * ```
 * const { user, error } = await getAuthUser();
 * if (error) return error;
 * // user je sada dostupan i verificiran
 * ```
 */
export async function getAuthUser(): Promise<AuthResult> {
  try {
    const supabase = await createClient();
    
    // Dohvati trenutnu sesiju
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Niste prijavljeni. Molimo prijavite se.' },
          { status: 401 }
        )
      };
    }
    
    // Dohvati korisnikovu ulogu iz baze
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single();
    
    if (userError || !userData) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Korisnički profil nije pronađen.' },
          { status: 404 }
        )
      };
    }
    
    const result: AuthUser = {
      id: authUser.id,
      email: authUser.email || '',
      role: userData.role as 'creator' | 'business' | 'admin',
    };
    
    // Ako je kreator, dohvati creator ID
    if (userData.role === 'creator') {
      const { data: creatorData } = await supabase
        .from('creators')
        .select('id')
        .eq('user_id', authUser.id)
        .single();
      
      if (creatorData) {
        result.creatorId = creatorData.id;
      }
    }
    
    // Ako je biznis, dohvati business ID
    if (userData.role === 'business') {
      const { data: businessData } = await supabase
        .from('businesses')
        .select('id')
        .eq('user_id', authUser.id)
        .single();
      
      if (businessData) {
        result.businessId = businessData.id;
      }
    }

    // Postavi Sentry user kontekst za server-side greske (samo id + role, BEZ email)
    Sentry.setUser({ id: result.id, role: result.role });

    return { user: result, error: null };
    
  } catch (error) {
    console.error('Auth helper error:', error);
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Greška pri proveri autentifikacije.' },
        { status: 500 }
      )
    };
  }
}

/**
 * Kao getAuthUser, ali za JAVNE rute: vraća korisnika ako je ulogovan,
 * ili null ako nije (BEZ 401 odgovora). Koristi se kad endpoint sme da
 * posluži i anonimne korisnike, ali menja odgovor za ulogovane/vlasnike.
 */
export async function getOptionalAuthUser(): Promise<AuthUser | null> {
  const { user } = await getAuthUser();
  return user;
}

/**
 * Proverava da li biznis (po user_id) ima aktivnu, neistekli pretplatu.
 * Jedinstveno pravilo za pristup kontakt podacima kreatora.
 * `supabaseAdmin` mora biti service-role klijent.
 */
export async function businessHasActiveSubscription(
  supabaseAdmin: { from: (t: string) => any },
  businessUserId: string
): Promise<boolean> {
  if (!PAYMENTS_REQUIRED) return true;
  const { data } = await supabaseAdmin
    .from('businesses')
    .select('subscription_status, expires_at')
    .eq('user_id', businessUserId)
    .maybeSingle();
  if (!data || data.subscription_status !== 'active') return false;
  return !data.expires_at || new Date(data.expires_at as string) > new Date();
}

/**
 * Proverava da li korisnik ima određenu ulogu
 */
export function hasRole(user: AuthUser, roles: ('creator' | 'business' | 'admin')[]): boolean {
  return roles.includes(user.role);
}

/**
 * Proverava da li je korisnik admin
 */
export function isAdmin(user: AuthUser): boolean {
  return user.role === 'admin';
}

/**
 * Proverava da li je korisnik kreator
 */
export function isCreator(user: AuthUser): boolean {
  return user.role === 'creator';
}

/**
 * Proverava da li je korisnik biznis
 */
export function isBusiness(user: AuthUser): boolean {
  return user.role === 'business';
}



