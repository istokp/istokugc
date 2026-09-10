'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ImageCropper from '@/components/ImageCropper';
import CityAutocomplete, { City, cityLabel } from '@/components/CityAutocomplete';
import { createClient } from '@/lib/supabase/client';
import { useDemo } from '@/context/DemoContext';
import { PAYMENTS_REQUIRED } from '@/lib/payments-config';

export default function RegisterBusinessPage() {
  const router = useRouter();
  const { loginAsNewBusiness } = useDemo();
  const [step, setStep] = useState<'info' | 'plan'>('info');
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly' | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmittingFree, setIsSubmittingFree] = useState(false);
  const [freeRegError, setFreeRegError] = useState<string | null>(null);
  
  // Logo upload state
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    companyName: '',
    email: '',
    password: '',
    phone: '',
    website: '',
    industry: '',
    description: '',
  });
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  
  // Handle logo file select
  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Slika mora biti manja od 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        setCropImage(e.target?.result as string);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Handle crop complete
  const handleCropComplete = (croppedImage: string) => {
    setLogoPreview(croppedImage);
    setShowCropper(false);
    setCropImage(null);
  };

  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validacija
    if (!formData.companyName.trim()) {
      alert('Molimo unesite naziv firme');
      return;
    }
    if (!formData.email.trim()) {
      alert('Molimo unesite email adresu');
      return;
    }
    if (!formData.email.includes('@')) {
      alert('Molimo unesite validnu email adresu');
      return;
    }
    if (!formData.password || formData.password.length < 8) {
      alert('Lozinka mora imati najmanje 8 karaktera');
      return;
    }
    if (!formData.phone.trim()) {
      alert('Molimo unesite broj telefona');
      return;
    }
    if (!selectedCity) {
      alert('Molimo izaberite grad iz liste');
      return;
    }
    if (!acceptTerms) {
      alert('Morate prihvatiti uslove korišćenja i politiku privatnosti');
      return;
    }

    // Dok je PAYMENTS_REQUIRED isključeno (privremeno, do daljnjeg): registruj
    // nalog odmah, bez Stripe checkout koraka. Vidi src/lib/payments-config.ts.
    if (!PAYMENTS_REQUIRED) {
      await registerFree();
      return;
    }

    setStep('plan');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const registerFree = async () => {
    setFreeRegError(null);
    setIsSubmittingFree(true);
    try {
      const response = await fetch('/api/auth/register/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          companyName: formData.companyName,
          phone: formData.phone || null,
          website: formData.website || null,
          industry: formData.industry || null,
          description: formData.description || null,
          cityId: selectedCity?.id ?? null,
          lat: selectedCity?.lat ?? null,
          lng: selectedCity?.lng ?? null,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Greška pri registraciji');
      }

      const supabase = createClient();
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      if (loginError) {
        console.error('Auto-login error:', loginError);
      }

      if (data.businessId) {
        loginAsNewBusiness(data.businessId, formData.companyName, 'none', undefined, logoPreview || undefined);
      }

      if (logoPreview && data.businessId) {
        try {
          await fetch(`/api/business/${data.businessId}/logo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logo: logoPreview }),
          });
        } catch (logoErr) {
          console.error('Error uploading logo:', logoErr);
        }
      }

      router.refresh();
      router.push('/dashboard');
    } catch (err) {
      setFreeRegError(err instanceof Error ? err.message : 'Greška pri registraciji');
      setIsSubmittingFree(false);
    }
  };

  const handlePlanSelect = (plan: 'monthly' | 'yearly') => {
    setSelectedPlan(plan);
    // Store form data in localStorage for checkout (survives redirect to Stripe)
    localStorage.setItem('businessRegistration', JSON.stringify({
      ...formData,
      cityId: selectedCity?.id ?? null,
      lat: selectedCity?.lat ?? null,
      lng: selectedCity?.lng ?? null,
      location: selectedCity ? cityLabel(selectedCity) : '',
      plan,
      logo: logoPreview, // Include logo if uploaded
      couponCode: couponCode.trim() || null,
    }));
    router.push(`/checkout?plan=${plan}`);
  };

  if (step === 'plan') {
    return (
      <div className="min-h-[calc(100vh-80px)] py-12 lg:py-16 bg-gradient-to-b from-secondary/30 to-white">
        <div className="max-w-4xl mx-auto px-6">
          {/* Back button */}
          <button 
            onClick={() => { setStep('info'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="flex items-center gap-2 text-muted hover:text-foreground mb-8 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Nazad
          </button>

          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm mb-6">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
              Korak 2 od 2
            </div>
            <h1 className="text-4xl font-light mb-4">Izaberi svoj plan</h1>
            <p className="text-muted text-lg max-w-xl mx-auto">
              Dobij pristup svim kreatorima i kontakt informacijama. Otkaži kad god želiš.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Monthly Plan */}
            <div 
              onClick={() => handlePlanSelect('monthly')}
              className={`bg-white rounded-3xl p-8 border-2 cursor-pointer transition-all hover:shadow-lg ${
                selectedPlan === 'monthly' ? 'border-primary shadow-lg' : 'border-border hover:border-muted'
              }`}
            >
              <div className="text-sm uppercase tracking-wider text-muted mb-4">Mesečno</div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-5xl font-light">$99</span>
                <span className="text-muted">/mesec</span>
              </div>
              <p className="text-muted mb-8">Fleksibilno, bez obaveza</p>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-sm">
                  <span className="w-5 h-5 rounded-full bg-success/10 text-success flex items-center justify-center text-xs">✓</span>
                  Pristup svim kreatorima
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <span className="w-5 h-5 rounded-full bg-success/10 text-success flex items-center justify-center text-xs">✓</span>
                  Kontakt informacije
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <span className="w-5 h-5 rounded-full bg-success/10 text-success flex items-center justify-center text-xs">✓</span>
                  Neograničena pretraga
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <span className="w-5 h-5 rounded-full bg-success/10 text-success flex items-center justify-center text-xs">✓</span>
                  Email podrška
                </li>
              </ul>

              <button 
                className="w-full py-4 border-2 border-border rounded-xl font-medium hover:bg-secondary transition-colors"
              >
                Izaberi mesečno
              </button>
            </div>

            {/* Yearly Plan */}
            <div 
              onClick={() => handlePlanSelect('yearly')}
              className={`bg-white rounded-3xl p-8 border-2 cursor-pointer transition-all hover:shadow-lg relative ${
                selectedPlan === 'yearly' ? 'border-primary shadow-lg' : 'border-primary'
              }`}
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white text-sm px-4 py-1.5 rounded-full font-medium">
                🔥 Najpopularnije
              </div>
              
              <div className="text-sm uppercase tracking-wider text-muted mb-4">Godišnje</div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-5xl font-light">$948</span>
                <span className="text-muted">/godina</span>
              </div>
              <div className="flex items-center gap-2 mb-8">
                <span className="text-sm line-through text-muted">$1188</span>
                <span className="text-sm text-success font-medium">Uštedi $240 (20%)</span>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-sm">
                  <span className="w-5 h-5 rounded-full bg-success/10 text-success flex items-center justify-center text-xs">✓</span>
                  Sve od mesečnog plana
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <span className="w-5 h-5 rounded-full bg-success/10 text-success flex items-center justify-center text-xs">✓</span>
                  <strong>$79/mesec umesto $99</strong>
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <span className="w-5 h-5 rounded-full bg-success/10 text-success flex items-center justify-center text-xs">✓</span>
                  Prioritetna podrška
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <span className="w-5 h-5 rounded-full bg-success/10 text-success flex items-center justify-center text-xs">✓</span>
                  Rani pristup novim funkcijama
                </li>
              </ul>

              <button 
                className="w-full py-4 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
              >
                Izaberi godišnje
              </button>
            </div>
          </div>

          <div className="max-w-sm mx-auto mt-8">
            <label className="text-sm text-muted mb-2 block text-center">Imaš kod za popust? (opciono)</label>
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="Unesi kod"
              className="w-full px-5 py-3 border border-border rounded-xl focus:outline-none focus:border-primary transition-colors text-center"
            />
          </div>

          <div className="text-center mt-12 space-y-4">
            <div className="flex items-center justify-center gap-6 text-sm text-muted">
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                </svg>
                Sigurno plaćanje
              </span>
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
                </svg>
                Stripe zaštita
              </span>
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
                Otkaži kad želiš
              </span>
            </div>
            <p className="text-sm text-muted">
              Prihvatamo Visa, Mastercard, American Express i druge kartice
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] py-12 lg:py-16">
      <div className="max-w-xl mx-auto px-6">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm mb-6">
            <span className="w-2 h-2 bg-primary rounded-full"></span>
            {PAYMENTS_REQUIRED ? 'Korak 1 od 2' : 'Registracija'}
          </div>
          <h1 className="text-3xl font-light mb-3">Registruj se kao brend</h1>
          <p className="text-muted">Pronađi savršene UGC kreatore za tvoj brend</p>
        </div>

        <form onSubmit={handleInfoSubmit} noValidate className="bg-white border border-border rounded-3xl p-8 space-y-6">
          {/* Logo upload */}
          <div>
            <label className="text-sm text-muted mb-3 block">Logo kompanije <span className="text-muted font-normal">(opciono)</span></label>
            <div className="flex items-center gap-4">
              {/* Logo preview */}
              <div 
                onClick={() => logoInputRef.current?.click()}
                className="w-20 h-20 rounded-full border-2 border-dashed border-border hover:border-primary cursor-pointer transition-colors flex items-center justify-center overflow-hidden bg-secondary/30 group"
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <svg className="w-6 h-6 text-muted group-hover:text-primary transition-colors mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  {logoPreview ? 'Promeni logo' : 'Dodaj logo'}
                </button>
                <p className="text-xs text-muted mt-1">PNG, JPG do 5MB. Preporučeno: 200x200px</p>
                {logoPreview && (
                  <button
                    type="button"
                    onClick={() => setLogoPreview(null)}
                    className="text-xs text-error hover:underline mt-1"
                  >
                    Ukloni logo
                  </button>
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoSelect}
                className="hidden"
              />
            </div>
          </div>
          
          <div>
            <label className="text-sm text-muted mb-2 block">Ime kompanije *</label>
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              placeholder="Ime tvoje firme"
              className="w-full px-5 py-4 border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
              required
            />
          </div>

          <div>
            <label className="text-sm text-muted mb-2 block">Email adresa *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="firma@email.com"
              className="w-full px-5 py-4 border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
              required
            />
          </div>

          <div>
            <label className="text-sm text-muted mb-2 block">Lozinka *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Minimum 8 karaktera"
                className="w-full px-5 py-4 pr-12 border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm text-muted mb-2 block">Broj telefona *</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+381 61 123 4567"
              className="w-full px-5 py-4 border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
              required
            />
          </div>

          <div>
            <label className="text-sm text-muted mb-2 block">Website</label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://www.tvojsajt.com"
              className="w-full px-5 py-4 border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="text-sm text-muted mb-2 block">Grad *</label>
            <CityAutocomplete
              value={selectedCity}
              onChange={setSelectedCity}
              placeholder="Beograd, Novi Sad, Zagreb..."
              className="w-full px-5 py-4 border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
            />
            <p className="text-xs text-muted mt-1">Da ti prikažemo kreatore u blizini.</p>
          </div>

          <div>
            <label className="text-sm text-muted mb-2 block">Industrija</label>
            <select
              value={formData.industry}
              onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              className="w-full px-5 py-4 border border-border rounded-xl focus:outline-none focus:border-primary transition-colors bg-white"
            >
              <option value="">Izaberi industriju</option>
              <option value="beauty">Beauty & Kozmetika</option>
              <option value="fashion">Moda</option>
              <option value="tech">Tehnologija</option>
              <option value="food">Hrana & Piće</option>
              <option value="fitness">Fitness & Zdravlje</option>
              <option value="travel">Putovanja</option>
              <option value="finance">Finansije</option>
              <option value="other">Drugo</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-muted mb-2 block">O kompaniji <span className="text-muted font-normal">(opciono)</span></label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Napiši nešto o svojoj kompaniji..."
              rows={4}
              className="w-full px-5 py-4 border border-border rounded-xl focus:outline-none focus:border-primary transition-colors resize-none"
            />
            <p className="text-xs text-muted mt-1 text-right">{formData.description.length} karaktera</p>
          </div>

          <label className="flex items-start gap-3 mt-6 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-border accent-primary" 
            />
            <span className="text-sm text-muted">
              Slažem se sa{' '}
              <Link href="/uslovi-koriscenja" className="underline hover:text-foreground" target="_blank">uslovima korišćenja</Link>
              {' '}i{' '}
              <Link href="/politika-privatnosti" className="underline hover:text-foreground" target="_blank">politikom privatnosti</Link>
              <span className="text-error ml-1">*</span>
            </span>
          </label>

          {freeRegError && (
            <div className="bg-error/10 border border-error/20 rounded-xl p-4">
              <p className="text-sm text-error">{freeRegError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmittingFree}
            className="w-full py-4 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSubmittingFree ? (
              'Kreiram nalog...'
            ) : PAYMENTS_REQUIRED ? (
              <>
                Nastavi na izbor plana
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </>
            ) : (
              'Registruj se'
            )}
          </button>
        </form>

        <p className="text-center text-sm text-muted mt-10">
          Već imaš nalog?{' '}
          <Link href="/login" className="text-foreground hover:underline font-medium">
            Prijavi se
          </Link>
        </p>

        <p className="text-center text-sm text-muted mt-4">
          Želiš da se registruješ kao kreator?{' '}
          <Link href="/register/kreator" className="text-foreground hover:underline font-medium">
            Registruj se kao kreator
          </Link>
        </p>
      </div>
      
      {/* Image Cropper Modal */}
      {showCropper && cropImage && (
        <ImageCropper
          image={cropImage}
          onCropComplete={handleCropComplete}
          onCancel={() => {
            setShowCropper(false);
            setCropImage(null);
          }}
          aspectRatio={1}
          cropShape="round"
        />
      )}
    </div>
  );
}
