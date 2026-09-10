'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import CreatorsMap from '@/components/CreatorsMap';
import CategoryIcon from '@/components/CategoryIcon';
import { useSupabaseUser } from '@/hooks/useSupabaseUser';

export default function Home() {
  const [categories, setCategories] = useState<string[]>([]);
  const [featuredCreators, setFeaturedCreators] = useState<any[]>([]);
  const { userData } = useSupabaseUser();
  const isAdmin = userData?.role === 'admin';
  
  // Fetch categories and featured creators from database
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch categories
        const catResponse = await fetch('/api/categories');
        if (catResponse.ok) {
          const catData = await catResponse.json();
          setCategories(catData.categories || []);
        }
        
        // Fetch featured creators (first 4 approved)
        const creatorsResponse = await fetch('/api/creators?limit=4');
        if (creatorsResponse.ok) {
          const creatorsData = await creatorsResponse.json();
          setFeaturedCreators(creatorsData.creators || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    
    fetchData();
  }, []);

  return (
    <div>
      {/* Hero Section */}
      <section className="relative min-h-[600px] lg:min-h-[700px] 2xl:min-h-[800px] flex items-center">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-secondary via-white to-white" />
        
        <div className="relative max-w-7xl 2xl:max-w-[1400px] mx-auto px-6 lg:px-12 py-16 lg:py-20 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left content */}
            <div className="animate-fadeIn">
              <h1 className="text-5xl lg:text-7xl font-light leading-tight mb-8">
                Pronađi savršene
                <span className="block font-medium">UGC kreatore</span>
              </h1>
              <p className="text-lg text-muted max-w-lg mb-10 leading-relaxed">
                Platforma koja povezuje brendove sa talentovanim kreatorima. Autentičan sadržaj, jednostavna saradnja.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link 
                  href="/kreatori"
                  className="px-8 py-4 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Pretraži kreatore
                </Link>
                <Link 
                  href="/register/kreator"
                  className="px-8 py-4 border border-border rounded-full text-sm font-medium hover:bg-secondary transition-colors"
                >
                  Postani kreator
                </Link>
              </div>

              {/* Stats */}
              <div className="flex gap-12 mt-16">
                <div>
                  <div className="text-4xl font-light">500+</div>
                  <div className="text-sm text-muted mt-1">Kreatora</div>
                </div>
                <div>
                  <div className="text-4xl font-light">120+</div>
                  <div className="text-sm text-muted mt-1">Brendova</div>
                </div>
                <div>
                  <div className="text-4xl font-light">12</div>
                  <div className="text-sm text-muted mt-1">Kategorija</div>
                </div>
              </div>
            </div>

            {/* Right - Featured creators grid */}
            <div className="hidden lg:grid grid-cols-2 gap-4 animate-fadeIn animate-delay-200">
              {featuredCreators.map((creator, index) => (
                <div 
                  key={creator.id}
                  className={`relative rounded-2xl overflow-hidden ${
                    index === 0 ? 'row-span-2' : ''
                  }`}
                  style={{ aspectRatio: index === 0 ? '3/4' : '1/1' }}
                >
                  {creator.photo ? (
                    <Image
                      src={creator.photo}
                      alt={creator.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      <span className="text-4xl font-light text-primary/40">{creator.name?.charAt(0) || '?'}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-4 left-4 text-white">
                    <div className="font-medium">{creator.name}</div>
                    <div className="text-sm opacity-80">{creator.categories[0]}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl 2xl:max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-light mb-4">Istraži po kategorijama</h2>
            <p className="text-muted max-w-xl mx-auto">
              Pronađi kreatore specijalizovane za tvoju industriju
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-4">
            {categories.map((category) => (
              <Link 
                key={category}
                href={`/kreatori?category=${category}`}
                className="group p-8 bg-secondary rounded-2xl text-center hover:bg-primary hover:text-white transition-all"
              >
                <div className="w-12 h-12 mx-auto mb-4 text-primary group-hover:text-white transition-colors">
                  <CategoryIcon name={category} className="w-full h-full" />
                </div>
                <div className="font-medium">{category}</div>
                <div className="text-sm text-muted group-hover:text-white/70 mt-1">
                  Pregledaj →
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Kreatori širom regiona (mapa) — samo za admina dok baza kreatora ne naraste */}
      {isAdmin && (
        <section className="py-16 lg:py-24 bg-secondary">
          <div className="max-w-5xl mx-auto px-6 lg:px-12">
            <div className="text-center mb-10">
              <h2 className="text-3xl lg:text-4xl font-light mb-4">Kreatori širom regiona</h2>
              <p className="text-muted max-w-xl mx-auto">
                Pogledaj odakle su naši kreatori. Klikni na grad da vidiš ko je dostupan.
              </p>
            </div>
            <div className="bg-white border border-border rounded-3xl p-4 sm:p-6 shadow-sm">
              <CreatorsMap />
            </div>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl 2xl:max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-light mb-4">Kako funkcioniše</h2>
            <p className="text-muted max-w-xl mx-auto">
              Jednostavan proces za brendove i kreatore
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-16">
            {/* For Brands */}
            <div className="bg-white rounded-3xl p-10">
              <div className="text-sm uppercase tracking-wider text-muted mb-6">Za brendove</div>
              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center flex-shrink-0 font-medium">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Registruj se</h4>
                    <p className="text-sm text-muted">Napravi nalog za tvoj brend ili kompaniju</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center flex-shrink-0 font-medium">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Izaberi plan</h4>
                    <p className="text-sm text-muted">Mesečna ili godišnja pretplata za pristup</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center flex-shrink-0 font-medium">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Pronađi kreatore</h4>
                    <p className="text-sm text-muted">Pretraži po kategoriji, ceni, jeziku i platformi</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center flex-shrink-0 font-medium">
                    4
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Kontaktiraj</h4>
                    <p className="text-sm text-muted">Direktno kontaktiraj kreatore i dogovori saradnju</p>
                  </div>
                </div>
              </div>
              <Link 
                href="/register/biznis"
                className="inline-block mt-10 px-8 py-4 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Registruj se kao brend
              </Link>
            </div>

            {/* For Creators */}
            <div className="bg-white rounded-3xl p-10">
              <div className="text-sm uppercase tracking-wider text-muted mb-6">Za kreatore</div>
              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center flex-shrink-0 font-medium">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Napravi profil</h4>
                    <p className="text-sm text-muted">Registruj se besplatno i popuni svoj profil</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center flex-shrink-0 font-medium">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Dodaj portfolio</h4>
                    <p className="text-sm text-muted">Prikaži svoje najbolje radove</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center flex-shrink-0 font-medium">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Čekaj odobrenje</h4>
                    <p className="text-sm text-muted">Naš tim će pregledati tvoj profil</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center flex-shrink-0 font-medium">
                    4
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Primi ponude</h4>
                    <p className="text-sm text-muted">Brendovi te kontaktiraju za saradnju</p>
                  </div>
                </div>
              </div>
              <Link 
                href="/register/kreator"
                className="inline-block mt-10 px-8 py-4 border border-border rounded-full text-sm font-medium hover:bg-secondary transition-colors"
              >
                Postani kreator — besplatno
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Creators */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl 2xl:max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl lg:text-4xl font-light mb-4">Istaknuti kreatori</h2>
              <p className="text-muted">Otkrij neke od naših najboljih talenata</p>
            </div>
            <Link 
              href="/kreatori"
              className="hidden md:block text-sm text-muted hover:text-foreground transition-colors"
            >
              Vidi sve →
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {featuredCreators.map((creator) => (
              <Link key={creator.id} href={`/kreator/${creator.id}`}>
                <div className="group">
                  <div className="aspect-[3/4] sm:aspect-[4/5] relative rounded-xl sm:rounded-2xl overflow-hidden mb-2 sm:mb-4 bg-secondary">
                    {creator.photo ? (
                      <Image
                        src={creator.photo}
                        alt={creator.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                        <span className="text-4xl font-light text-primary/40">{creator.name?.charAt(0) || '?'}</span>
                      </div>
                    )}
                  </div>
                  <h3 className="font-medium text-sm sm:text-base truncate">{creator.name}</h3>
                  <p className="text-xs sm:text-sm text-muted truncate">{creator.categories[0]} • {creator.location}</p>
                  <p className="text-xs sm:text-sm mt-0.5 sm:mt-1">od €{creator.priceFrom}</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center mt-10 md:hidden">
            <Link 
              href="/kreatori"
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              Vidi sve →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 lg:py-24 bg-primary text-white">
        <div className="max-w-4xl 2xl:max-w-5xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-3xl lg:text-5xl font-light mb-6">
            Spreman da pronađeš savršenog kreatora?
          </h2>
          <p className="text-white/70 max-w-xl mx-auto mb-10">
            Pridruži se stotinama brendova koji već koriste UGC Executive 
            za pronalazak autentičnog sadržaja.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link 
              href="/register/biznis"
              className="px-8 py-4 bg-white text-primary rounded-full text-sm font-medium hover:bg-white/90 transition-colors"
            >
              Registruj se kao brend
            </Link>
            <Link 
              href="/kreatori"
              className="px-8 py-4 border border-white/30 rounded-full text-sm font-medium hover:bg-white/10 transition-colors"
            >
              Pretraži kreatore
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
