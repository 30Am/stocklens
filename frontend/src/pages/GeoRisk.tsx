import 'leaflet/dist/leaflet.css';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, GeoJSON as LeafletGeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Feature, FeatureCollection } from 'geojson';
import * as topojson from 'topojson-client';
import { getStockDetail } from '../api/client';

// ── Fix Leaflet default icon paths for bundlers ────────────────────────────
// (needed so no console errors even though we use custom divIcons)
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;

// ── Tile layer ────────────────────────────────────────────────────────────────
const TILE_URL   = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR  = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>';
const GEO_URL    = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// ── Severity palette ──────────────────────────────────────────────────────────
const SEV = {
  critical:   { hex: '#ef4444', rgb: '239,68,68',   label: 'CRITICAL',  dot: 'bg-red-500',    badge: 'bg-red-500/15 text-red-400 border-red-500/30',    bar: 'bg-red-500',    barW: 'w-full'    },
  high:       { hex: '#f97316', rgb: '249,115,22',  label: 'HIGH',      dot: 'bg-orange-500', badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30', bar: 'bg-orange-500', barW: 'w-3/4'  },
  medium:     { hex: '#eab308', rgb: '234,179,8',   label: 'MEDIUM',    dot: 'bg-yellow-500', badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', bar: 'bg-yellow-500', barW: 'w-1/2'  },
  monitoring: { hex: '#3b82f6', rgb: '59,130,246',  label: 'MONITOR',   dot: 'bg-blue-500',   badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',   bar: 'bg-blue-500',   barW: 'w-1/4'  },
} as const;
type Severity = keyof typeof SEV;

// ── Types ─────────────────────────────────────────────────────────────────────
interface ConflictStock {
  ticker: string;
  name: string;
  sector: string;
  direction: 'up' | 'down' | 'volatile' | 'neutral';
  reason: string;
}
interface ConflictZone {
  id: string;
  name: string;
  region: string;
  coordinates: [number, number];   // [lng, lat]
  zoom: number;                     // suggested zoom on select
  severity: Severity;
  status: string;
  description: string;
  detail: string;
  directCountries: string[];        // numeric ISO-3166-1 as strings
  affectedCountries: string[];      // economically / politically impacted
  stocks: ConflictStock[];
  marketImpact: string;
  tradeRoutes: string[];
  startDate: string;
  casualties: string;
  displaced: string;
}
interface StockPrice { price: number; change: number; changePercent: number; loading: boolean; }

// ── Conflict zone data ────────────────────────────────────────────────────────
const CONFLICT_ZONES: ConflictZone[] = [
  {
    id: 'ukraine',
    name: 'Russia–Ukraine War',
    region: 'Eastern Europe',
    coordinates: [32.0, 49.0],
    zoom: 5,
    severity: 'critical',
    status: 'Active Combat',
    description: 'Full-scale Russian invasion since Feb 2022. The largest land war in Europe since WWII with 500K+ casualties.',
    detail: 'Drone warfare escalating on both sides. Russia occupying ~18% of Ukrainian territory. Zaporizhzhia nuclear plant at risk. NATO arms deliveries ongoing.',
    directCountries: ['804','643'],
    affectedCountries: ['276','616','246','642','498','112','440','428','233','703','348','100','268','031','398','792','528','040','056','208','250','380','724','752'],
    stocks: [
      { ticker: 'LMT',  name: 'Lockheed Martin',  sector: 'Defense',     direction: 'up',       reason: 'HIMARS, F-35 orders surging. NATO members re-arming.' },
      { ticker: 'RTX',  name: 'Raytheon',          sector: 'Defense',     direction: 'up',       reason: 'Patriot missile systems in high demand globally.' },
      { ticker: 'NOC',  name: 'Northrop Grumman',  sector: 'Defense',     direction: 'up',       reason: 'B-21 production + drone systems demand elevated.' },
      { ticker: 'BA',   name: 'Boeing',            sector: 'Aerospace',   direction: 'up',       reason: 'Military aircraft orders from European allies.' },
      { ticker: 'XOM',  name: 'ExxonMobil',        sector: 'Energy',      direction: 'volatile', reason: 'European LNG demand replacing Russian gas supply.' },
      { ticker: 'BP',   name: 'BP plc',            sector: 'Energy',      direction: 'down',     reason: 'Wrote off $25B+ in Russian assets. Long-term impact.' },
    ],
    marketImpact: 'European defense spending at 2%+ of GDP for the first time. LNG exports from US to EU at record highs. Russian energy sanctions reshaping global oil trade flows.',
    tradeRoutes: ['Black Sea grain corridor', 'Baltic Sea energy routes', 'Trans-Siberian pipeline network'],
    startDate: 'Feb 2022',
    casualties: '500,000+',
    displaced: '14 million',
  },
  {
    id: 'middleeast',
    name: 'Israel–Hamas War',
    region: 'Middle East',
    coordinates: [34.8, 31.5],
    zoom: 6,
    severity: 'critical',
    status: 'Active Combat',
    description: 'Conflict in Gaza following Oct 7, 2023 Hamas attack. Regional multi-front war with Hezbollah, Iran, and Houthi forces.',
    detail: 'Iran launched direct missile and drone attacks on Israel. Hezbollah fighting on northern front. Houthis targeting Red Sea shipping. Ceasefire negotiations ongoing.',
    directCountries: ['376','275'],
    affectedCountries: ['422','760','400','818','364','682','887','368','784','048','414','512','706','262'],
    stocks: [
      { ticker: 'LMT',  name: 'Lockheed Martin',  sector: 'Defense',   direction: 'up',       reason: 'Iron Dome, F-35 parts, and THAAD in high demand.' },
      { ticker: 'RTX',  name: 'Raytheon',          sector: 'Defense',   direction: 'up',       reason: 'Iron Dome interception systems. Israeli defense contracts.' },
      { ticker: 'CVX',  name: 'Chevron',           sector: 'Energy',    direction: 'up',       reason: 'Middle East risk premium elevated on crude prices.' },
      { ticker: 'XOM',  name: 'ExxonMobil',        sector: 'Energy',    direction: 'up',       reason: 'Strait of Hormuz risk; oil risk premium elevated.' },
      { ticker: 'ZIM',  name: 'ZIM Shipping',      sector: 'Shipping',  direction: 'volatile', reason: 'Red Sea rerouting added $1M+ per voyage cost.' },
    ],
    marketImpact: 'Oil risk premium ~$5-8/barrel. Suez Canal traffic down 40%. European supply chain inflation. Regional airline disruptions.',
    tradeRoutes: ['Suez Canal', 'Strait of Hormuz', 'Red Sea shipping lanes'],
    startDate: 'Oct 2023',
    casualties: '50,000+',
    displaced: '1.9 million',
  },
  {
    id: 'taiwan',
    name: 'Taiwan Strait Tensions',
    region: 'East Asia',
    coordinates: [120.9, 23.6],
    zoom: 6,
    severity: 'medium',
    status: 'Elevated Tension',
    description: 'Escalating PLA military exercises around Taiwan. China\'s largest exercises since 1996. Critical global semiconductor supply at risk.',
    detail: 'Taiwan produces ~90% of world\'s most advanced semiconductors (TSMC). Any blockade would cause supply shock 10x worse than 2021 chip shortage.',
    directCountries: ['158','156'],
    affectedCountries: ['840','392','410','036','528','276','704','608','360','458','096'],
    stocks: [
      { ticker: 'TSM',  name: 'TSMC',             sector: 'Semiconductors', direction: 'volatile', reason: '90% of cutting-edge chips. Existential supply risk.' },
      { ticker: 'NVDA', name: 'NVIDIA',            sector: 'AI/Chips',       direction: 'down',     reason: 'Depends entirely on TSMC for A100/H100 production.' },
      { ticker: 'AMD',  name: 'AMD',               sector: 'Semiconductors', direction: 'down',     reason: 'All 5nm/7nm chips fabbed at TSMC Taiwan.' },
      { ticker: 'AAPL', name: 'Apple',             sector: 'Technology',     direction: 'down',     reason: 'iPhone chips and Mac SoC all made by TSMC.' },
      { ticker: 'INTC', name: 'Intel',             sector: 'Semiconductors', direction: 'volatile', reason: 'Both at risk and potential beneficiary of reshoring.' },
    ],
    marketImpact: '~$10T global GDP at risk from Taiwan conflict. Semiconductor supply chain cannot be replicated for 5-10 years. CHIPS Act trying to reduce dependency.',
    tradeRoutes: ['Taiwan Strait shipping lane', 'Pacific trade routes', 'Asia-US tech supply chain'],
    startDate: 'Ongoing',
    casualties: 'N/A',
    displaced: 'N/A',
  },
  {
    id: 'sudan',
    name: 'Sudan Civil War',
    region: 'East Africa',
    coordinates: [30.2, 15.5],
    zoom: 5,
    severity: 'high',
    status: 'Active Combat',
    description: 'War between Sudanese Armed Forces and Rapid Support Forces. World\'s largest displacement crisis. Mass atrocities in Darfur.',
    detail: 'RSF controls Khartoum and gold-rich Darfur region. UAE accused of supplying RSF via Libya. Over 25 million people facing starvation.',
    directCountries: ['729'],
    affectedCountries: ['818','231','148','434','728','800','404'],
    stocks: [
      { ticker: 'GLD',  name: 'SPDR Gold ETF',   sector: 'Gold',    direction: 'up',       reason: 'Sudan produces ~100 tonnes/year; RSF controls gold mines.' },
      { ticker: 'GOLD', name: 'Barrick Gold',     sector: 'Mining',  direction: 'up',       reason: 'African gold supply disruption drives prices.' },
      { ticker: 'NEM',  name: 'Newmont Corp',     sector: 'Mining',  direction: 'up',       reason: 'Global gold supply tightness benefits producers.' },
    ],
    marketImpact: 'Gold supply disruption from conflict zones. Nile water agreements at risk between Sudan and Egypt. 8M+ displaced creating regional refugee crisis.',
    tradeRoutes: ['Nile River trade corridor', 'Port Sudan Red Sea access', 'Trans-Saharan routes'],
    startDate: 'Apr 2023',
    casualties: '150,000+',
    displaced: '8 million',
  },
  {
    id: 'myanmar',
    name: 'Myanmar Civil War',
    region: 'Southeast Asia',
    coordinates: [95.9, 21.0],
    zoom: 5,
    severity: 'high',
    status: 'Active Combat',
    description: 'Armed resistance against military junta following Feb 2021 coup. Resistance forces now control 60%+ of territory.',
    detail: 'Major ethnic armed organizations formed unified opposition. Junta losing control of key border towns and trade corridors with China, India, and Thailand.',
    directCountries: ['104'],
    affectedCountries: ['764','050','356','156','418'],
    stocks: [
      { ticker: 'TTE',  name: 'TotalEnergies',   sector: 'Energy',   direction: 'down',     reason: 'Withdrew from Yadana gas pipeline due to sanctions risk.' },
      { ticker: 'ONGC', name: 'ONGC Videsh',     sector: 'Energy',   direction: 'down',     reason: 'Indian state oil co. has Myanmar gas field exposure.' },
    ],
    marketImpact: 'Foreign investment exodus. Thailand gas supply (Yadana pipeline) threatened. Garment/electronics manufacturing disrupted. Drug trade surging through ungoverned zones.',
    tradeRoutes: ['Thailand–Myanmar gas pipeline', 'China–Myanmar Economic Corridor', 'Mekong River trade route'],
    startDate: 'Feb 2021',
    casualties: '50,000+',
    displaced: '2.6 million',
  },
  {
    id: 'yemen',
    name: 'Yemen & Houthi Campaign',
    region: 'Middle East',
    coordinates: [47.5, 15.5],
    zoom: 5,
    severity: 'high',
    status: 'Active Combat',
    description: 'Houthi forces attacking commercial shipping in Red Sea in response to Gaza war. Civil war in 10th year continues.',
    detail: '100+ ships attacked since Nov 2023. US Navy conducting Operation Prosperity Guardian. Container ships rerouting via Cape of Good Hope adding 14 days and $1M+ per voyage.',
    directCountries: ['887'],
    affectedCountries: ['682','512','818','262','706','356','840'],
    stocks: [
      { ticker: 'ZIM',  name: 'ZIM Shipping',    sector: 'Shipping',  direction: 'volatile', reason: 'Rerouting all vessels; massive cost and time increases.' },
      { ticker: 'RTX',  name: 'Raytheon',        sector: 'Defense',   direction: 'up',       reason: 'Navy intercepting Houthi drones/missiles via Tomahawks.' },
      { ticker: 'CVX',  name: 'Chevron',         sector: 'Energy',    direction: 'up',       reason: 'Tanker disruption = higher oil prices globally.' },
    ],
    marketImpact: 'Container shipping costs surged 300%. Global supply chains re-routing. Suez Canal revenue collapsed. European inflation re-elevated by shipping costs.',
    tradeRoutes: ['Red Sea / Suez Canal (15% of global trade)', 'Bab-el-Mandeb Strait', 'Persian Gulf oil tanker routes'],
    startDate: 'Nov 2023 (Houthis)',
    casualties: '20,000+',
    displaced: '4.5 million',
  },
  {
    id: 'sahel',
    name: 'Sahel Insurgency',
    region: 'West Africa',
    coordinates: [-1.5, 13.0],
    zoom: 5,
    severity: 'high',
    status: 'Active Combat',
    description: 'Jihadist insurgencies across Mali, Burkina Faso, Niger. Wagner Group (Africa Corps) entrenched. French forces expelled from all three countries.',
    detail: 'AES Alliance (Mali+BF+Niger) formed mutual defense pact, left ECOWAS. Al-Qaeda (JNIM) and ISIS affiliates control large rural territories. 2,000+ attacks in 2024.',
    directCountries: ['466','854','562'],
    affectedCountries: ['566','686','288','148','012','504','324','788'],
    stocks: [
      { ticker: 'GOLD', name: 'Barrick Gold',     sector: 'Mining',      direction: 'volatile', reason: 'Loulo-Gounkoto mine in Mali (600Koz/yr) seized by junta.' },
      { ticker: 'NEM',  name: 'Newmont Corp',     sector: 'Mining',      direction: 'volatile', reason: 'Ahafo North (Ghana) and Sahel exposure.' },
      { ticker: 'GLD',  name: 'SPDR Gold ETF',   sector: 'Gold',        direction: 'up',       reason: 'West African gold supply disruption; safe haven demand.' },
    ],
    marketImpact: 'West African gold production severely disrupted. Niger provides 20% of EU uranium supply — now blocked. Trans-Saharan migration routes weaponized.',
    tradeRoutes: ['Trans-Saharan highway', 'Niger uranium export routes', 'West Africa–Europe migration corridors'],
    startDate: '2012',
    casualties: '40,000+',
    displaced: '6 million',
  },
  {
    id: 'drc',
    name: 'DR Congo — M23 War',
    region: 'Central Africa',
    coordinates: [25.9, -0.7],
    zoom: 5,
    severity: 'high',
    status: 'Active Combat',
    description: 'Rwanda-backed M23 rebels have captured Goma, capital of North Kivu. DRC holds 70% of global cobalt reserves.',
    detail: 'M23 advancing toward Bukavu. AU and SADC intervention forces deployed. DRC broke off diplomatic relations with Rwanda. Critical minerals region at stake.',
    directCountries: ['180','646'],
    affectedCountries: ['800','108','834','894','710','716','404'],
    stocks: [
      { ticker: 'TSLA', name: 'Tesla',            sector: 'EV / Cobalt', direction: 'down',     reason: 'DRC = 70% of cobalt; battery supply chain at severe risk.' },
      { ticker: 'VALE', name: 'Vale SA',          sector: 'Mining',      direction: 'volatile', reason: 'Cobalt and copper mines in eastern DRC threatened.' },
      { ticker: 'ALB',  name: 'Albemarle',        sector: 'Lithium',     direction: 'down',     reason: 'EV battery materials chain disruption hits margins.' },
    ],
    marketImpact: 'Cobalt spot prices +40% since M23 offensive began. EV manufacturers seeking alternative suppliers. Entire green energy supply chain at risk.',
    tradeRoutes: ['Congo River basin trade route', 'Dar es Salaam corridor', 'South African mineral export lines'],
    startDate: '2022',
    casualties: '10,000+',
    displaced: '7 million',
  },
  {
    id: 'iran',
    name: 'Iran — Nuclear & Proxy Tensions',
    region: 'Middle East',
    coordinates: [53.6, 32.4],
    zoom: 5,
    severity: 'medium',
    status: 'High Alert',
    description: 'Iran approaching nuclear threshold (~90% enrichment). Direct missile exchanges with Israel in 2024. Proxy network spanning 7 countries active.',
    detail: 'JCPOA dead. Iran 2 weeks from bomb-grade uranium. IRGC operating Hezbollah, Hamas, Houthis, and Iraqi PMF simultaneously. Sanctions evasion via China oil sales.',
    directCountries: ['364'],
    affectedCountries: ['376','682','368','784','048','414','512','760','887'],
    stocks: [
      { ticker: 'CVX',  name: 'Chevron',          sector: 'Energy',   direction: 'up',   reason: 'Strait of Hormuz holds 20% of global oil supply.' },
      { ticker: 'XOM',  name: 'ExxonMobil',       sector: 'Energy',   direction: 'up',   reason: 'Iran nuclear risk adds $10+/barrel risk premium.' },
      { ticker: 'LMT',  name: 'Lockheed Martin',  sector: 'Defense',  direction: 'up',   reason: 'F-35 upgrades for Israel; Iron Dome components.' },
    ],
    marketImpact: 'Oil market risk premium from potential Hormuz closure ($20/barrel spike estimated). Israeli defense tech exports surging. Gulf states accelerating nuclear programs.',
    tradeRoutes: ['Strait of Hormuz (20% global oil)', 'Persian Gulf oil export infrastructure', 'Iran–China oil trade routes'],
    startDate: 'Escalated 2023',
    casualties: 'N/A',
    displaced: 'N/A',
  },
  {
    id: 'southchinasea',
    name: 'South China Sea Disputes',
    region: 'Pacific / SE Asia',
    coordinates: [114.0, 12.0],
    zoom: 5,
    severity: 'medium',
    status: 'Elevated Tension',
    description: 'China seizing Philippine-claimed reefs. Water cannon and ramming incidents weekly. US-Philippines Mutual Defense Treaty invoked.',
    detail: 'China controls 7 artificial islands with military installations. ASEAN unity fracturing. $3 trillion in annual trade at risk. US carrier groups deployed.',
    directCountries: ['156','608'],
    affectedCountries: ['704','458','096','360','158','392','410','840'],
    stocks: [
      { ticker: 'LMT',  name: 'Lockheed Martin',  sector: 'Defense',  direction: 'up',      reason: 'F-16 and frigate sales to SE Asian nations surging.' },
      { ticker: 'HII',  name: 'Huntington Ingalls', sector: 'Defense', direction: 'up',     reason: 'Submarine and carrier building for US Navy.' },
      { ticker: 'NVDA', name: 'NVIDIA',            sector: 'Tech',     direction: 'neutral', reason: 'Chip export controls to China tightening.' },
    ],
    marketImpact: '$3T in annual trade at risk. 30% of global shipping through contested waters. Regional defense budgets at record highs. US-China decoupling accelerating.',
    tradeRoutes: ['South China Sea shipping lane (30% of global trade)', 'Strait of Malacca', 'Asia-Pacific supply chains'],
    startDate: 'Ongoing (escalated 2023)',
    casualties: 'N/A',
    displaced: 'N/A',
  },
  {
    id: 'ethiopia',
    name: 'Ethiopia — Amhara & Oromia',
    region: 'East Africa',
    coordinates: [39.5, 9.0],
    zoom: 5,
    severity: 'medium',
    status: 'Fragile Ceasefire',
    description: 'New Amhara region conflict following 2022 Tigray ceasefire. Oromia (OLA) insurgency ongoing. Ethiopia fragmentation risk.',
    detail: 'Amhara Fano militias fighting federal forces in strategic corridor. OLA controlling parts of Oromia. 3M+ displaced since 2023 escalation. AU mediation stalled.',
    directCountries: ['231'],
    affectedCountries: ['706','729','404','818','232'],
    stocks: [
      { ticker: 'GLD',  name: 'SPDR Gold ETF',   sector: 'Commodities', direction: 'up',      reason: 'Regional instability drives safe-haven flows.' },
    ],
    marketImpact: 'Ethiopian Airlines (largest African carrier) operations at risk. Horn of Africa trade hub status threatened. Nile dam dispute with Egypt worsening.',
    tradeRoutes: ['Ethiopian Airlines hub connections', 'Horn of Africa trade routes', 'Blue Nile water corridor'],
    startDate: '2023',
    casualties: '300,000+',
    displaced: '3 million',
  },
  {
    id: 'haiti',
    name: 'Haiti State Collapse',
    region: 'Caribbean',
    coordinates: [-72.5, 18.9],
    zoom: 7,
    severity: 'monitoring',
    status: 'State Collapse',
    description: 'Armed gangs control 90% of Port-au-Prince. Government authority collapsed. Kenyan-led multinational force deployed.',
    detail: 'G9 and Viv Ansanm gang coalitions control capital. Prison breaks freed 4,000+ criminals. US evacuated non-emergency staff. UN Security Council authorizing broader intervention.',
    directCountries: ['332'],
    affectedCountries: ['214','840','388'],
    stocks: [
      { ticker: 'ILF',  name: 'iShares Latin ETF', sector: 'Emerging Mkts', direction: 'down',   reason: 'Caribbean instability affects EM risk sentiment.' },
    ],
    marketImpact: 'Sovereign debt near default. Caribbean tourism sector impacted. US migration pressure increasing significantly. Remittance flows to Haiti ($3.8B/yr) at risk.',
    tradeRoutes: ['Caribbean Sea trade routes', 'Haiti–Dominican Republic border commerce'],
    startDate: '2021',
    casualties: '5,000+',
    displaced: '1.5 million',
  },
];

// ── Fly-to effect ──────────────────────────────────────────────────────────────
function FlyToZone({ zone }: { zone: ConflictZone | null }) {
  const map = useMap();
  const prevRef = useRef<ConflictZone | null>(null);

  useEffect(() => {
    // Guard: don't fly on initial mount with no zone
    if (!zone && prevRef.current === null) return;
    try {
      if (!zone) {
        map.flyTo([15, 10], 2, { duration: 1.5 });
      } else {
        const [lng, lat] = zone.coordinates;
        if (isFinite(lat) && isFinite(lng)) {
          map.flyTo([lat, lng], zone.zoom, { duration: 1.8, easeLinearity: 0.25 });
        }
      }
    } catch (_) { /* map not ready yet */ }
    prevRef.current = zone;
  }, [zone, map]);
  return null;
}

// ── Custom pulsing marker icon ─────────────────────────────────────────────────
function createMarkerIcon(zone: ConflictZone, selected: boolean): L.DivIcon {
  const { hex, rgb } = SEV[zone.severity];
  const base = zone.severity === 'critical' ? 44 : zone.severity === 'high' ? 38 : zone.severity === 'medium' ? 34 : 30;
  const sz = selected ? base + 10 : base;
  const coreSize = selected ? 13 : zone.severity === 'critical' ? 10 : zone.severity === 'high' ? 8 : 7;
  const coreOff = (sz - coreSize) / 2;

  const selectedRing = selected
    ? `<div style="position:absolute;inset:-8px;border-radius:50%;border:1.5px dashed ${hex};opacity:0.7;animation:conflict-glow 1.5s ease-in-out infinite;"></div>`
    : '';

  return L.divIcon({
    className: '',
    iconSize: [sz, sz],
    iconAnchor: [sz / 2, sz / 2],
    html: `
      <div class="geo-marker" style="width:${sz}px;height:${sz}px;position:relative;">
        ${selectedRing}
        <div class="geo-ring" style="position:absolute;inset:0;border-radius:50%;background:rgba(${rgb},0.08);border:1px solid rgba(${rgb},0.25);"></div>
        <div class="geo-ring-2" style="position:absolute;inset:${sz * 0.2}px;border-radius:50%;background:rgba(${rgb},0.14);border:1px solid rgba(${rgb},0.4);"></div>
        <div class="geo-core" style="position:absolute;top:${coreOff}px;left:${coreOff}px;width:${coreSize}px;height:${coreSize}px;border-radius:50%;background:${hex};box-shadow:0 0 ${selected ? 12 : 8}px rgba(${rgb},0.8);border:${selected ? 2 : 1.5}px solid rgba(255,255,255,0.85);"></div>
      </div>
    `,
  });
}

// ── GeoJSON country layer ──────────────────────────────────────────────────────
function CountryLayer({
  geoJSON,
  zones,
  selected,
}: {
  geoJSON: FeatureCollection | null;
  zones: ConflictZone[];
  selected: ConflictZone | null;
}) {
  const layerKey = selected?.id ?? 'none';

  const buildMaps = useMemo(() => {
    const direct: Record<string, ConflictZone> = {};
    const affected: Record<string, ConflictZone> = {};
    zones.forEach((z) => {
      z.directCountries.forEach((id) => { direct[id] = z; });
      z.affectedCountries.forEach((id) => { if (!direct[id]) affected[id] = z; });
    });
    return { direct, affected };
  }, [zones]);

  const styleFunc = useCallback((feature?: Feature) => {
    const id = String(feature?.id ?? '');
    const { direct, affected } = buildMaps;

    if (direct[id]) {
      const { hex } = SEV[direct[id].severity];
      const isSelected = selected?.id === direct[id].id;
      return {
        fillColor: hex,
        fillOpacity: isSelected ? 0.42 : 0.22,
        color: hex,
        weight: isSelected ? 2 : 1.2,
        opacity: isSelected ? 0.9 : 0.6,
        dashArray: undefined as string | undefined,
      };
    }
    if (affected[id]) {
      const { hex } = SEV[affected[id].severity];
      const isSelected = selected?.id === affected[id].id;
      return {
        fillColor: hex,
        fillOpacity: isSelected ? 0.14 : 0.07,
        color: hex,
        weight: isSelected ? 1 : 0.5,
        opacity: isSelected ? 0.5 : 0.25,
        dashArray: '5,5',
      };
    }
    return { fillColor: 'transparent', fillOpacity: 0, color: 'transparent', weight: 0, opacity: 0 };
  }, [buildMaps, selected]);

  if (!geoJSON) return null;
  return (
    <LeafletGeoJSON
      key={layerKey}
      data={geoJSON}
      style={styleFunc}
    />
  );
}

// ── Direction badge ────────────────────────────────────────────────────────────
function DirBadge({ d }: { d: ConflictStock['direction'] }) {
  const cfg = {
    up:       { icon: '↑', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    down:     { icon: '↓', cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
    volatile: { icon: '⚡', cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
    neutral:  { icon: '→', cls: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20' },
  }[d];
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold shrink-0 ${cfg.cls}`}>{cfg.icon}</span>;
}

// ── Stock row ──────────────────────────────────────────────────────────────────
function StockRow({ stock, price }: { stock: ConflictStock; price?: StockPrice }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/stock/${stock.ticker}`)}
      className="w-full text-left px-3 py-2.5 rounded-xl border border-border bg-surface-2/40 hover:bg-surface-2 hover:border-zinc-600 transition-all duration-150 group"
    >
      <div className="flex items-start gap-2.5">
        <DirBadge d={stock.direction} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-bold text-white font-mono group-hover:text-violet-400 transition-colors">{stock.ticker}</span>
              <span className="text-[9px] text-zinc-600 border border-border rounded px-1 hidden sm:block">{stock.sector}</span>
            </div>
            {/* Live price */}
            <div className="text-right shrink-0">
              {price?.loading ? (
                <div className="h-3 w-12 bg-zinc-700 rounded animate-pulse" />
              ) : price && price.price > 0 ? (
                <div>
                  <div className="text-[11px] font-bold text-white">${price.price.toFixed(2)}</div>
                  <div className={`text-[9px] font-semibold ${price.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {price.changePercent >= 0 ? '+' : ''}{price.changePercent.toFixed(2)}%
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug line-clamp-1">{stock.reason}</p>
        </div>
      </div>
    </button>
  );
}

// ── Zone list item ─────────────────────────────────────────────────────────────
function ZoneListItem({ zone, isSelected, onClick }: { zone: ConflictZone; isSelected: boolean; onClick: () => void }) {
  const s = SEV[zone.severity];
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 rounded-xl border transition-all duration-150 group ${
        isSelected
          ? 'bg-surface-2 border-zinc-600'
          : 'border-border bg-surface-1 hover:bg-surface-2 hover:border-zinc-700'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
          <div className={`absolute inset-0 w-2.5 h-2.5 rounded-full ${s.dot} animate-ping opacity-40`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors truncate">{zone.name}</div>
          <div className="text-[9px] text-zinc-600 mt-0.5">{zone.region} · {zone.status}</div>
        </div>
        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold shrink-0 ${s.badge}`}>{s.label}</span>
      </div>
    </button>
  );
}

// ── Detail panel ───────────────────────────────────────────────────────────────
function DetailPanel({
  zone,
  onBack,
  stockPrices,
}: {
  zone: ConflictZone;
  onBack: () => void;
  stockPrices: Record<string, StockPrice>;
}) {
  const s = SEV[zone.severity];
  return (
    <div className="flex flex-col h-full overflow-hidden animate-sweep-in">
      {/* Header */}
      <div className="px-4 pt-3 pb-3 border-b border-border shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 mb-2 transition-colors">
          ← All conflicts
        </button>
        <h2 className="text-sm font-bold text-white leading-tight">{zone.name}</h2>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${s.badge}`}>{s.label}</span>
          <span className="text-[10px] text-zinc-500 bg-surface-2 px-2 py-0.5 rounded border border-border">{zone.status}</span>
          <span className="text-[10px] text-zinc-700">{zone.region}</span>
        </div>

        {/* Risk bar */}
        <div className="mt-2.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-zinc-600 uppercase tracking-wider">Risk Level</span>
            <span className="text-[9px] text-zinc-500">Since {zone.startDate}</span>
          </div>
          <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${s.bar} ${s.barW} transition-all duration-500`} />
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

        {/* Description */}
        <p className="text-xs text-zinc-300 leading-relaxed">{zone.description}</p>
        <p className="text-[11px] text-zinc-500 leading-relaxed">{zone.detail}</p>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Casualties', value: zone.casualties, color: zone.casualties === 'N/A' ? 'text-zinc-500' : 'text-red-400' },
            { label: 'Displaced', value: zone.displaced, color: zone.displaced === 'N/A' ? 'text-zinc-500' : 'text-orange-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-surface-2 rounded-xl border border-border p-3 text-center">
              <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">{label}</div>
              <div className={`text-sm font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Affected countries */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              Direct ({zone.directCountries.length}) · Affected ({zone.affectedCountries.length})
            </span>
          </div>
          <div className="text-[10px] text-zinc-600 bg-surface-2 rounded-xl border border-border px-3 py-2 leading-relaxed">
            Shaded on map · <span className="text-zinc-500">Solid = direct combat zone · Dashed = economic/political impact</span>
          </div>
        </div>

        {/* Market impact */}
        <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full bg-violet-400" />
            <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">Market Impact</span>
          </div>
          <p className="text-[11px] text-zinc-300 leading-relaxed">{zone.marketImpact}</p>
        </div>

        {/* Trade routes */}
        {zone.tradeRoutes.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold">Trade Routes at Risk</span>
            {zone.tradeRoutes.map((r) => (
              <div key={r} className="flex items-start gap-2 text-[11px] text-zinc-400">
                <span className="text-zinc-700 mt-0.5 shrink-0">▸</span>
                {r}
              </div>
            ))}
          </div>
        )}

        {/* Stocks */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-semibold">Affected Stocks</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-1.5">
            {zone.stocks.map((s) => (
              <StockRow key={s.ticker} stock={s} price={stockPrices[s.ticker]} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export function GeoRisk() {
  const [selected, setSelected]       = useState<ConflictZone | null>(null);
  const [stockPrices, setStockPrices] = useState<Record<string, StockPrice>>({});
  const [worldGeo, setWorldGeo]       = useState<FeatureCollection | null>(null);
  const fetchedRef = useRef<Set<string>>(new Set());

  // Load world topology once
  useEffect(() => {
    fetch(GEO_URL)
      .then((r) => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((topo: any) => {
        const key = Object.keys(topo.objects)[0];
        const geo = topojson.feature(topo, topo.objects[key]) as unknown as FeatureCollection;
        setWorldGeo(geo);
      })
      .catch(console.error);
  }, []);

  // Fetch stock prices when zone selected
  useEffect(() => {
    if (!selected) return;
    selected.stocks.forEach(({ ticker }) => {
      if (fetchedRef.current.has(ticker)) return;
      fetchedRef.current.add(ticker);
      setStockPrices((p) => ({ ...p, [ticker]: { price: 0, change: 0, changePercent: 0, loading: true } }));
      getStockDetail(ticker)
        .then((raw: unknown) => {
          const d = raw as Record<string, number>;
          setStockPrices((p) => ({
            ...p,
            [ticker]: { price: d?.price ?? d?.current_price ?? 0, change: d?.change ?? 0, changePercent: d?.change_pct ?? d?.changePercent ?? 0, loading: false },
          }));
        })
        .catch(() => setStockPrices((p) => ({ ...p, [ticker]: { price: 0, change: 0, changePercent: 0, loading: false } })));
    });
  }, [selected]);

  const handleSelect   = useCallback((z: ConflictZone) => setSelected((prev) => prev?.id === z.id ? null : z), []);
  const handleDeselect = useCallback(() => setSelected(null), []);

  const criticalCount = CONFLICT_ZONES.filter(z => z.severity === 'critical').length;
  const highCount     = CONFLICT_ZONES.filter(z => z.severity === 'high').length;
  const mediumCount   = CONFLICT_ZONES.filter(z => z.severity === 'medium').length;
  const monitorCount  = CONFLICT_ZONES.filter(z => z.severity === 'monitoring').length;

  // ── Single unified layout: flex-col on mobile, flex-row on desktop ──────────
  // ONE MapContainer — never duplicated. Layout adapts via CSS only.
  return (
    <div className="flex-1 overflow-hidden flex flex-col lg:flex-row" style={{ height: 'calc(100vh - 56px)' }}>

      {/* ── Map column ── */}
      {/* Mobile: 45% height. Desktop: fills remaining width at full height */}
      <div
        className="relative overflow-hidden flex-shrink-0 lg:flex-1 lg:min-w-0"
        style={{ height: '45%' }}
        // Override height on desktop via inline style + class combo
        ref={(el) => {
          if (el) {
            const applyHeight = () => {
              el.style.height = window.innerWidth >= 1024 ? '100%' : '45%';
            };
            applyHeight();
            window.addEventListener('resize', applyHeight);
            // store cleanup on element for GC
            (el as HTMLElement & { _resizeCleanup?: () => void })._resizeCleanup?.();
            (el as HTMLElement & { _resizeCleanup?: () => void })._resizeCleanup = () =>
              window.removeEventListener('resize', applyHeight);
          }
        }}
      >
        {/* Status bar */}
        <div className="absolute top-0 left-0 right-0 z-[500] pointer-events-none flex items-center justify-between px-3 lg:px-4 py-2 lg:py-2.5 bg-gradient-to-b from-[#06060f]/95 via-[#06060f]/60 to-transparent">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] lg:text-[11px] font-bold text-red-400 tracking-wider">LIVE</span>
            </div>
            <span className="hidden lg:block text-[10px] text-zinc-600">Global Conflict &amp; Geo-Risk Monitor</span>
          </div>
          <div className="flex items-center gap-2 lg:gap-3">
            {([
              ['critical', criticalCount, 'text-red-400'],
              ['high',     highCount,     'text-orange-400'],
              ['medium',   mediumCount,   'text-yellow-400'],
              ['monitoring', monitorCount, 'text-blue-400'],
            ] as const).filter(([, c]) => c > 0).map(([sev, count, cls]) => (
              <div key={sev} className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${SEV[sev].dot}`} />
                <span className={`text-[10px] font-semibold ${cls}`}>{count}</span>
                <span className="hidden lg:block text-[10px] text-zinc-700 capitalize">{sev}</span>
              </div>
            ))}
          </div>
        </div>

        {/* THE single Leaflet map */}
        <MapContainer
          center={[15, 10]}
          zoom={2}
          minZoom={2}
          maxZoom={18}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
          attributionControl={true}
          worldCopyJump={true}
        >
          <TileLayer url={TILE_URL} attribution={TILE_ATTR} maxZoom={19} subdomains="abcd" />
          <FlyToZone zone={selected} />
          <CountryLayer geoJSON={worldGeo} zones={CONFLICT_ZONES} selected={selected} />
          {CONFLICT_ZONES.map((z) => (
            <Marker
              key={z.id}
              position={[z.coordinates[1], z.coordinates[0]]}
              icon={createMarkerIcon(z, selected?.id === z.id)}
              eventHandlers={{ click: () => handleSelect(z) }}
              zIndexOffset={selected?.id === z.id ? 1000 : 0}
            >
              <Popup>
                <div className="px-3 py-2.5 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${SEV[z.severity].dot}`} />
                    <span className="text-xs font-bold text-white">{z.name}</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-snug">{z.description.slice(0, 110)}…</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${SEV[z.severity].badge}`}>{SEV[z.severity].label}</span>
                    <span className="text-[9px] text-zinc-600">{z.status}</span>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Bottom hint — desktop only */}
        <div className="hidden lg:block absolute bottom-4 left-4 z-[500] pointer-events-none">
          <div className="flex items-center gap-3 text-[9px] text-zinc-700 bg-black/40 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-white/5">
            <span>🔍 Scroll to zoom</span>
            <span>✋ Drag to pan</span>
            <span>📍 Click marker</span>
          </div>
        </div>

        {/* Selected zone floating tag */}
        {selected && (
          <div className="absolute bottom-2 lg:bottom-4 left-2 right-2 lg:left-auto lg:right-4 lg:w-auto z-[500] animate-sweep-in">
            <div className="flex items-center gap-2 bg-surface-1/90 backdrop-blur-sm border border-border rounded-xl px-3 py-2">
              <div className={`w-2 h-2 rounded-full ${SEV[selected.severity].dot}`} />
              <span className="text-xs font-semibold text-white truncate">{selected.name}</span>
              <button onClick={handleDeselect} className="text-zinc-600 hover:text-zinc-400 text-xs ml-auto shrink-0 transition-colors">✕</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Side panel column ── */}
      {/* Mobile: flex-1 (remaining height). Desktop: fixed width sidebar */}
      <div className="flex-1 lg:flex-none lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-border bg-surface-0 flex flex-col overflow-hidden">
        {/* Panel header */}
        <div className="px-4 py-2.5 lg:py-3 border-b border-border bg-surface-1 flex items-center gap-2 shrink-0">
          <div className="w-5 h-5 rounded-md bg-red-500/15 border border-red-500/25 flex items-center justify-center text-[10px]">⚔</div>
          <span className="text-xs font-bold text-white">Geo-Risk Intel</span>
          {selected ? (
            <button onClick={handleDeselect} className="ml-auto text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors">← All</button>
          ) : (
            <div className="ml-auto flex items-center gap-1.5 bg-surface-2 rounded-full px-2 py-0.5 border border-border">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[9px] text-zinc-500">{CONFLICT_ZONES.length} zones</span>
            </div>
          )}
        </div>

        {selected ? (
          <DetailPanel zone={selected} onBack={handleDeselect} stockPrices={stockPrices} />
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {CONFLICT_ZONES.map((z) => (
                <ZoneListItem key={z.id} zone={z} isSelected={false} onClick={() => handleSelect(z)} />
              ))}
            </div>
            {/* Legend — desktop only (saves space on mobile) */}
            <div className="hidden lg:block px-4 py-3 border-t border-border bg-surface-1 shrink-0">
              <div className="text-[9px] text-zinc-700 uppercase tracking-widest font-semibold mb-2">Legend</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {(Object.entries(SEV) as [Severity, typeof SEV[Severity]][]).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${v.dot}`} />
                    <span className="text-[10px] text-zinc-500">{v.label}</span>
                  </div>
                ))}
                <div className="col-span-2 mt-1 pt-1.5 border-t border-border flex items-center gap-4 text-[9px] text-zinc-700">
                  <span>▬ Direct conflict</span>
                  <span>╌ Economically affected</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
