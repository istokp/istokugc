'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { geoMercator, geoPath } from 'd3-geo';
import balkanGeo from '@/data/balkan-geo.json';

interface LocationStat {
  city_id: number;
  name: string;
  country_code: string;
  lat: number;
  lng: number;
  count: number;
}

const W = 800;
const H = 580;

// Srpska pluralizacija (paukal): 1 -> one, 2-4 -> few, 5+ -> many
function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
}

// Gradovi u blizini (npr. Beograd + okolina) se projektuju skoro na istu tačku,
// pa se krugovi preklapaju. Ova relaksacija ih razmiče (kolizija) dok ih blaga
// "opruga" drži blizu stvarne geografske pozicije, umesto da se čitaju kao gomila.
function declutter<T extends { x: number; y: number; r: number }>(points: T[]): T[] {
  const nodes = points.map((p) => ({ ...p, ox: p.x, oy: p.y }));
  const padding = 3;

  for (let iter = 0; iter < 300; iter++) {
    for (const n of nodes) {
      n.x += (n.ox - n.x) * 0.02;
      n.y += (n.oy - n.y) * 0.02;
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const minDist = a.r + b.r + padding;
        if (dist < minDist) {
          const overlap = (minDist - dist) / 2;
          dx /= dist;
          dy /= dist;
          a.x -= dx * overlap;
          a.y -= dy * overlap;
          b.x += dx * overlap;
          b.y += dy * overlap;
        }
      }
    }
  }

  return nodes as unknown as T[];
}

export default function CreatorsMap() {
  const router = useRouter();
  const [locations, setLocations] = useState<LocationStat[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/stats/locations')
      .then((r) => r.json())
      .then((d) => setLocations(d.locations || []))
      .catch(() => setLocations([]))
      .finally(() => setLoaded(true));
  }, []);

  // Projekcija prilagođena Balkanu (fitExtent na lokalni GeoJSON)
  const { countryPaths, project } = useMemo(() => {
    const projection = geoMercator().fitExtent(
      [[28, 28], [W - 28, H - 28]],
      balkanGeo as any
    );
    const path = geoPath(projection);
    return {
      countryPaths: (balkanGeo as any).features.map((f: any) => path(f) || ''),
      project: (lng: number, lat: number) => projection([lng, lat]) || [0, 0],
    };
  }, []);

  const maxCount = useMemo(
    () => locations.reduce((m, l) => Math.max(m, l.count), 0) || 1,
    [locations]
  );

  const points = useMemo(() => {
    const raw = locations.map((loc) => {
      const [x, y] = project(loc.lng, loc.lat);
      const minR = 14, maxR = 34;
      const r = minR + (Math.sqrt(loc.count) / Math.sqrt(maxCount)) * (maxR - minR);
      return { ...loc, x, y, r };
    });
    return declutter(raw);
  }, [locations, project, maxCount]);

  const total = useMemo(() => locations.reduce((s, l) => s + l.count, 0), [locations]);

  const go = (cityId: number) => router.push(`/kreatori?cityId=${cityId}`);

  return (
    <div className="relative w-full">
      <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 w-full h-full"
          role="img"
          aria-label="Mapa kreatora na Balkanu"
        >
          <defs>
            <radialGradient id="bubbleGrad" cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#3a3a3a" />
              <stop offset="100%" stopColor="#0a0a0a" />
            </radialGradient>
            <filter id="bubbleShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Zemlje */}
          <g>
            {countryPaths.map((d: string, i: number) => (
              <path key={i} d={d} fill="#e9ebee" stroke="#ffffff" strokeWidth={1.2} />
            ))}
          </g>

          {/* Markeri */}
          <g>
            {points.map((p, i) => {
              const isActive = active === i;
              return (
                <g
                  key={p.city_id}
                  transform={`translate(${p.x},${p.y})`}
                  className="cursor-pointer"
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onClick={() => go(p.city_id)}
                >
                  {/* radar puls */}
                  <circle r={p.r} fill="#0a0a0a" opacity={0.18}>
                    <animate attributeName="r" values={`${p.r};${p.r + 16}`} dur="2.4s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.3;0" dur="2.4s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
                  </circle>
                  <g style={{ transition: 'transform 0.2s ease', transform: `scale(${isActive ? 1.1 : 1})`, transformBox: 'fill-box', transformOrigin: 'center' }}>
                    {/* obruč */}
                    <circle r={p.r + 4} fill="none" stroke="#0a0a0a" strokeOpacity={0.15} strokeWidth={1.5} />
                    {/* glavni balon */}
                    <circle r={p.r} fill="url(#bubbleGrad)" filter="url(#bubbleShadow)" />
                    <text textAnchor="middle" dy="0.36em" fontSize={Math.max(15, p.r * 0.85)} fontWeight={700} fill="#fff" pointerEvents="none">
                      {p.count}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Tooltip samo za aktivni balon (bez preklapanja) */}
        <div className="absolute inset-0 pointer-events-none">
          {points.map((p, i) =>
            active === i ? (
              <div
                key={p.city_id}
                className="absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-white shadow-lg"
                style={{
                  left: `${(p.x / W) * 100}%`,
                  top: `calc(${(p.y / H) * 100}% - ${p.r + 6}px)`,
                }}
              >
                {p.name} · {p.count}
              </div>
            ) : null
          )}
        </div>
      </div>

      {/* Legenda: gradovi kao dugmići — uvek čitljivo, bez preklapanja (i na mobu) */}
      {loaded && locations.length > 0 && (
        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {points.map((p, i) => (
              <button
                key={p.city_id}
                type="button"
                onClick={() => go(p.city_id)}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all ${
                  active === i
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-white text-foreground hover:border-primary'
                }`}
              >
                <span className="font-medium">{p.name}</span>
                <span className={`text-xs ${active === i ? 'text-white/80' : 'text-muted'}`}>{p.count}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-sm text-muted">
            <strong className="font-medium text-foreground">{total}</strong>{' '}
            {plural(total, 'kreator', 'kreatora', 'kreatora')} u {locations.length}{' '}
            {plural(locations.length, 'gradu', 'grada', 'gradova')} · klikni na grad da vidiš ko je dostupan
          </p>
        </div>
      )}

      {loaded && locations.length === 0 && (
        <p className="mt-3 text-center text-sm text-muted">
          Uskoro — kreatori se upravo pridružuju širom regiona.
        </p>
      )}
    </div>
  );
}
