import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ComposableMap, Geographies, Geography,
  Marker, ZoomableGroup, Sphere, Graticule,
} from 'react-simple-maps';
import { getStockDetail } from '../api/client';

// ── World topology ─────────────────────────────────────────────────────────────
const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// ── Severity palette ──────────────────────────────────────────────────────────
const SEV = {
  critical:   { color: '#ef4444', glow: 'rgba(239,68,68,0.4)',   label: 'CRITICAL',   dot: 'bg-red-500',    badge: 'bg-red-500/15 text-red-400 border-red-500/30' },
  high:       { color: '#f97316', glow: 'rgba(249,115,22,0.4)',  label: 'HIGH',        dot: 'bg-orange-500', badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  medium:     { color: '#eab308', glow: 'rgba(234,179,8,0.4)',   label: 'MEDIUM',      dot: 'bg-yellow-500', badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  monitoring: { color: '#3b82f6', glow: 'rgba(59,130,246,0.4)',  label: 'MONITOR',     dot: 'bg-blue-500',   badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
} as const;
type Severity = keyof typeof SEV;

// ── Conflict zone data ────────────────────────────────────────────────────────
interface ConflictStock {
  ticker: string;
  name: string;
  sector: string;
  direction: 'up' | 'down' | 'volatile' | 'neutral';
}

interface ConflictZone {
  id: string;
  name: string;
  region: string;
  coordinates: [number, number];
  severity: Severity;
  status: string;
  description: string;
  detail: string;
  affectedCountries: string[];   // numeric ISO 3166-1 as strings
  stocks: ConflictStock[];
  marketImpact: string;
  startDate: string;
  casualties: string;
}

const CONFLICT_ZONES: ConflictZone[] = [
  {
    id: 'ukraine',
    name: 'Russia–Ukraine War',
    region: 'Eastern Europe',
    coordinates: [32.0, 49.0],
    severity: 'critical',
    status: 'Active Combat',
    description: 'Full-scale Russian invasion since Feb 2022. The largest land war in Europe since WWII.',
    detail: 'Ongoing frontline fighting across eastern and southern Ukraine. Drone warfare escalating. Nuclear threats remain.',
    affectedCountries: ['804', '643'],
    stocks: [
      { ticker: 'LMT',  name: 'Lockheed Martin',  sector: 'Defense',       direction: 'up' },
      { ticker: 'RTX',  name: 'Raytheon',          sector: 'Defense',       direction: 'up' },
      { ticker: 'NOC',  name: 'Northrop Grumman',  sector: 'Defense',       direction: 'up' },
      { ticker: 'XOM',  name: 'ExxonMobil',        sector: 'Energy',        direction: 'volatile' },
      { ticker: 'BP',   name: 'BP plc',            sector: 'Energy',        direction: 'down' },
      { ticker: 'BA',   name: 'Boeing',            sector: 'Aerospace',     direction: 'up' },
    ],
    marketImpact: 'Defense stocks at multi-year highs. European energy crisis persists. Grain & wheat futures elevated. Russian energy sanctions reshaping global oil flows.',
    startDate: 'Feb 2022',
    casualties: '500,000+',
  },
  {
    id: 'middleeast',
    name: 'Israel–Hamas War',
    region: 'Middle East',
    coordinates: [34.8, 31.5],
    severity: 'critical',
    status: 'Active Combat',
    description: 'Conflict in Gaza following Oct 7, 2023 Hamas attack. Regional escalation with Hezbollah, Iran, and Houthi forces.',
    detail: 'Houthi attacks on Red Sea shipping have disrupted global trade. Iran missile exchanges have raised fears of wider war.',
    affectedCountries: ['376', '275'],
    stocks: [
      { ticker: 'LMT',  name: 'Lockheed Martin',  sector: 'Defense',       direction: 'up' },
      { ticker: 'RTX',  name: 'Raytheon',          sector: 'Defense',       direction: 'up' },
      { ticker: 'CVX',  name: 'Chevron',           sector: 'Energy',        direction: 'up' },
      { ticker: 'XOM',  name: 'ExxonMobil',        sector: 'Energy',        direction: 'up' },
      { ticker: 'ZIM',  name: 'ZIM Shipping',      sector: 'Shipping',      direction: 'volatile' },
    ],
    marketImpact: 'Oil price risk premium elevated. Suez Canal traffic down ~40%. Defense procurement surge. Regional airline stocks impacted.',
    startDate: 'Oct 2023',
    casualties: '50,000+',
  },
  {
    id: 'taiwan',
    name: 'Taiwan Strait Tensions',
    region: 'East Asia',
    coordinates: [120.9, 23.6],
    severity: 'medium',
    status: 'Elevated Tension',
    description: 'Escalating PLA military exercises. China claims Taiwan as its territory; US commits to Taiwan\'s defense.',
    detail: 'Any blockade or invasion scenario would devastate global semiconductor supply chains — ~90% of advanced chips are fabbed in Taiwan.',
    affectedCountries: ['158', '156'],
    stocks: [
      { ticker: 'TSM',  name: 'TSMC',             sector: 'Semiconductors', direction: 'volatile' },
      { ticker: 'NVDA', name: 'NVIDIA',            sector: 'Semiconductors', direction: 'down' },
      { ticker: 'AMD',  name: 'AMD',              sector: 'Semiconductors', direction: 'down' },
      { ticker: 'INTC', name: 'Intel',             sector: 'Semiconductors', direction: 'down' },
      { ticker: 'AAPL', name: 'Apple',             sector: 'Technology',     direction: 'down' },
    ],
    marketImpact: '~$10T GDP at risk from a Taiwan conflict. Chip shortage would be 10× worse than 2021. US-China tech decoupling accelerating.',
    startDate: 'Ongoing',
    casualties: 'N/A',
  },
  {
    id: 'sudan',
    name: 'Sudan Civil War',
    region: 'East Africa',
    coordinates: [30.2, 15.5],
    severity: 'high',
    status: 'Active Combat',
    description: 'War between Sudanese Armed Forces and Rapid Support Forces. World\'s largest humanitarian crisis.',
    detail: 'Mass atrocities reported in Darfur. Over 8M displaced. Gold-rich regions under RSF control.',
    affectedCountries: ['729'],
    stocks: [
      { ticker: 'GLD',  name: 'SPDR Gold ETF',   sector: 'Commodities',   direction: 'up' },
      { ticker: 'GOLD', name: 'Barrick Gold',     sector: 'Mining',        direction: 'up' },
      { ticker: 'AEM',  name: 'Agnico Eagle',     sector: 'Mining',        direction: 'up' },
    ],
    marketImpact: 'Gold production disrupted. Nile water agreements at risk. Refugee crisis destabilizing Egypt and Chad.',
    startDate: 'Apr 2023',
    casualties: '150,000+',
  },
  {
    id: 'myanmar',
    name: 'Myanmar Civil War',
    region: 'Southeast Asia',
    coordinates: [95.9, 21.0],
    severity: 'high',
    status: 'Active Combat',
    description: 'Armed resistance against military junta following 2021 coup. Resistance forces control 60%+ of territory.',
    detail: 'Major offensive gains by ethnic armed organizations. Junta losing control of key border regions and trade routes.',
    affectedCountries: ['104'],
    stocks: [
      { ticker: 'TOTF', name: 'TotalEnergies',   sector: 'Energy',        direction: 'down' },
      { ticker: 'PTT',  name: 'PTT Exploration',  sector: 'Energy',        direction: 'down' },
    ],
    marketImpact: 'Foreign investment exodus. Gas pipeline to Thailand threatened. Manufacturing supply chains (garments, electronics) disrupted.',
    startDate: 'Feb 2021',
    casualties: '50,000+',
  },
  {
    id: 'yemen',
    name: 'Yemen & Houthi Campaign',
    region: 'Middle East',
    coordinates: [47.5, 15.5],
    severity: 'high',
    status: 'Active Combat',
    description: 'Houthi forces attacking commercial shipping in Red Sea in solidarity with Gaza. Civil war continues in background.',
    detail: 'Over 100 ships attacked since Nov 2023. Global shipping rerouting via Cape of Good Hope adds 10-14 days and $1M+ per voyage.',
    affectedCountries: ['887'],
    stocks: [
      { ticker: 'ZIM',  name: 'ZIM Shipping',    sector: 'Shipping',      direction: 'volatile' },
      { ticker: 'MAERSK', name: 'Maersk',        sector: 'Shipping',      direction: 'volatile' },
      { ticker: 'RTX',  name: 'Raytheon',        sector: 'Defense',       direction: 'up' },
      { ticker: 'XOM',  name: 'ExxonMobil',      sector: 'Energy',        direction: 'up' },
    ],
    marketImpact: 'Container shipping costs +300%. Suez Canal revenue down sharply. European inflation pressure from longer supply routes.',
    startDate: 'Nov 2023',
    casualties: '20,000+',
  },
  {
    id: 'sahel',
    name: 'Sahel Insurgency',
    region: 'West Africa',
    coordinates: [-1.5, 13.0],
    severity: 'high',
    status: 'Active Combat',
    description: 'Jihadist insurgencies across Mali, Burkina Faso, and Niger. Wagner Group (Africa Corps) presence. French forces expelled.',
    detail: 'Three military juntas formed a mutual defense alliance. Al-Qaeda and ISIS affiliates controlling rural territory.',
    affectedCountries: ['466', '854', '562'],
    stocks: [
      { ticker: 'GOLD', name: 'Barrick Gold',     sector: 'Mining',        direction: 'volatile' },
      { ticker: 'GLD',  name: 'SPDR Gold ETF',   sector: 'Commodities',   direction: 'up' },
      { ticker: 'NEM',  name: 'Newmont Corp',     sector: 'Mining',        direction: 'volatile' },
    ],
    marketImpact: 'Major gold mining disruptions. Uranium supply from Niger under pressure (20% of EU uranium). French strategic influence collapsing.',
    startDate: '2012',
    casualties: '40,000+',
  },
  {
    id: 'drc',
    name: 'DR Congo — M23 War',
    region: 'Central Africa',
    coordinates: [25.9, -0.7],
    severity: 'high',
    status: 'Active Combat',
    description: 'M23 rebel offensive backed by Rwanda. Rapid advance toward Goma. World\'s richest mineral region at stake.',
    detail: 'DRC holds 70% of global cobalt reserves, essential for EV batteries. Conflict threatens entire EV supply chain.',
    affectedCountries: ['180'],
    stocks: [
      { ticker: 'TSLA', name: 'Tesla',            sector: 'EV / Cobalt',   direction: 'down' },
      { ticker: 'VALE', name: 'Vale SA',          sector: 'Mining',        direction: 'volatile' },
      { ticker: 'GLENCORE', name: 'Glencore',     sector: 'Mining',        direction: 'volatile' },
      { ticker: 'GLD',  name: 'SPDR Gold ETF',   sector: 'Commodities',   direction: 'up' },
    ],
    marketImpact: 'Cobalt prices volatile. EV manufacturers securing alternative supply. Humanitarian crisis worsening with 7M+ displaced.',
    startDate: '2022',
    casualties: '10,000+',
  },
  {
    id: 'southchinasea',
    name: 'South China Sea',
    region: 'Pacific',
    coordinates: [114.0, 12.0],
    severity: 'medium',
    status: 'Elevated Tension',
    description: 'China asserting control over disputed waters. Philippine Coast Guard confrontations. US naval patrols increasing.',
    detail: '$3 trillion in trade transits the South China Sea annually. China\'s island-building and "cabbage strategy" against Philippines escalating.',
    affectedCountries: ['156', '608'],
    stocks: [
      { ticker: 'LMT',  name: 'Lockheed Martin',  sector: 'Defense',       direction: 'up' },
      { ticker: 'HII',  name: 'Huntington Ingalls', sector: 'Defense',     direction: 'up' },
      { ticker: 'NVDA', name: 'NVIDIA',            sector: 'Tech',          direction: 'neutral' },
    ],
    marketImpact: '30% of global trade at risk. US-Philippines alliance strengthening. Regional defense spending at record highs.',
    startDate: 'Ongoing',
    casualties: 'N/A',
  },
  {
    id: 'ethiopia',
    name: 'Ethiopia — Amhara Crisis',
    region: 'East Africa',
    coordinates: [39.5, 9.0],
    severity: 'medium',
    status: 'Fragile Ceasefire',
    description: 'New conflict in Amhara region following 2022 Tigray ceasefire. Oromia insurgency ongoing.',
    detail: 'Amhara militias (Fano) fighting federal forces. Strategic implications for Horn of Africa stability and Red Sea access.',
    affectedCountries: ['231'],
    stocks: [
      { ticker: 'GLD',  name: 'SPDR Gold ETF',   sector: 'Commodities',   direction: 'up' },
    ],
    marketImpact: 'Ethiopian airline and trade disrupted. Aid corridor to Somalia at risk. Broader Horn of Africa stability concerns.',
    startDate: '2023',
    casualties: '300,000+',
  },
  {
    id: 'iran',
    name: 'Iran — Nuclear & Proxy Tensions',
    region: 'Middle East',
    coordinates: [53.6, 32.4],
    severity: 'medium',
    status: 'High Alert',
    description: 'Iran approaching nuclear threshold. Proxy network (Hezbollah, Hamas, Houthis, PMF) active across region.',
    detail: 'Direct missile exchanges with Israel in 2024. Nuclear deal collapsed. IRGC conducting shadow war in multiple theaters.',
    affectedCountries: ['364'],
    stocks: [
      { ticker: 'CVX',  name: 'Chevron',          sector: 'Energy',        direction: 'up' },
      { ticker: 'XOM',  name: 'ExxonMobil',       sector: 'Energy',        direction: 'up' },
      { ticker: 'LMT',  name: 'Lockheed Martin',  sector: 'Defense',       direction: 'up' },
    ],
    marketImpact: 'Strait of Hormuz risk premium on oil (20% of global supply transits). Israeli defense tech sector surging.',
    startDate: 'Escalated 2023',
    casualties: 'N/A',
  },
  {
    id: 'haiti',
    name: 'Haiti Gang Crisis',
    region: 'Caribbean',
    coordinates: [-72.5, 18.9],
    severity: 'monitoring',
    status: 'State Collapse',
    description: 'Armed gangs control 85% of Port-au-Prince. Government has effectively lost authority over the capital.',
    detail: 'International security force deployed. US evacuations. Economic collapse worsening. Political vacuum after presidential assassination.',
    affectedCountries: ['332'],
    stocks: [
      { ticker: 'MS',   name: 'Morgan Stanley',   sector: 'Emerging Mkts', direction: 'neutral' },
    ],
    marketImpact: 'Sovereign debt at risk. Regional security implications for Caribbean. US migration pressure increasing.',
    startDate: '2021',
    casualties: '5,000+',
  },
];

// ── Stock price type ──────────────────────────────────────────────────────────
interface StockPrice {
  price: number;
  change: number;
  changePercent: number;
  loading: boolean;
}

// ── Direction indicator ───────────────────────────────────────────────────────
function DirectionBadge({ direction }: { direction: ConflictStock['direction'] }) {
  const map = {
    up:       { icon: '↑', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    down:     { icon: '↓', cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
    volatile: { icon: '⚡', cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
    neutral:  { icon: '→', cls: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20' },
  };
  const { icon, cls } = map[direction];
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${cls}`}>{icon}</span>
  );
}

// ── Conflict marker ───────────────────────────────────────────────────────────
function ConflictMarker({
  zone,
  selected,
  onClick,
}: {
  zone: ConflictZone;
  selected: boolean;
  onClick: () => void;
}) {
  const { color } = SEV[zone.severity];
  const outerR = selected ? 22 : zone.severity === 'critical' ? 18 : zone.severity === 'high' ? 14 : 11;
  const coreR  = selected ? 7  : zone.severity === 'critical' ? 5.5 : zone.severity === 'high' ? 4.5 : 3.5;

  return (
    <Marker coordinates={zone.coordinates} onClick={onClick}>
      <g style={{ cursor: 'pointer' }}>
        {/* Outer pulse ring */}
        <circle
          r={outerR}
          fill={color}
          fillOpacity={0.08}
          stroke={color}
          strokeWidth={0.5}
          strokeOpacity={0.2}
          className="conflict-ring-1"
        />
        {/* Middle pulse ring */}
        <circle
          r={outerR * 0.6}
          fill={color}
          fillOpacity={0.12}
          stroke={color}
          strokeWidth={0.8}
          strokeOpacity={0.35}
          className="conflict-ring-2"
        />
        {/* Core dot */}
        <circle
          r={coreR}
          fill={color}
          fillOpacity={selected ? 1 : 0.9}
          stroke="#fff"
          strokeWidth={selected ? 1.2 : 0.6}
          strokeOpacity={0.8}
          className="conflict-core"
        />
        {/* Selected outer glow ring */}
        {selected && (
          <circle
            r={outerR + 6}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeOpacity={0.5}
            strokeDasharray="4 3"
          />
        )}
      </g>
    </Marker>
  );
}

// ── Stock row ─────────────────────────────────────────────────────────────────
function StockRow({
  stock,
  price,
}: {
  stock: ConflictStock;
  price?: StockPrice;
}) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/stock/${stock.ticker}`)}
      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-surface-2/50 hover:bg-surface-2 border border-border hover:border-zinc-600 transition-all duration-150 group"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <DirectionBadge direction={stock.direction} />
        <div className="min-w-0 text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-white font-mono group-hover:text-violet-400 transition-colors">
              {stock.ticker}
            </span>
            <span className="text-[9px] text-zinc-600 bg-surface-3 px-1.5 py-0.5 rounded border border-border hidden sm:block">
              {stock.sector}
            </span>
          </div>
          <div className="text-[10px] text-zinc-500 truncate mt-0.5">{stock.name}</div>
        </div>
      </div>

      <div className="text-right shrink-0">
        {price?.loading ? (
          <div className="space-y-1">
            <div className="h-3 w-14 bg-zinc-700 rounded animate-pulse" />
            <div className="h-2.5 w-10 bg-zinc-800 rounded animate-pulse ml-auto" />
          </div>
        ) : price && price.price > 0 ? (
          <>
            <div className="text-xs font-bold text-white">
              ${price.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className={`text-[10px] font-semibold ${price.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {price.changePercent >= 0 ? '+' : ''}{price.changePercent.toFixed(2)}%
            </div>
          </>
        ) : (
          <span className="text-[10px] text-zinc-700">—</span>
        )}
      </div>
    </button>
  );
}

// ── Conflict detail panel ─────────────────────────────────────────────────────
function ConflictPanel({
  zones,
  selected,
  onSelect,
  stockPrices,
}: {
  zones: ConflictZone[];
  selected: ConflictZone | null;
  onSelect: (z: ConflictZone) => void;
  stockPrices: Record<string, StockPrice>;
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {selected ? (
        /* ── Detail view ── */
        <div className="flex flex-col h-full overflow-hidden animate-sweep-in">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-white leading-tight">{selected.name}</h2>
                <div className="text-[10px] text-zinc-500 mt-0.5">{selected.region}</div>
              </div>
              <button
                onClick={() => onSelect(selected)} // will be overridden by parent
                className="text-zinc-600 hover:text-zinc-400 text-lg leading-none shrink-0 transition-colors"
                style={{ display: 'none' }}
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold tracking-wide ${SEV[selected.severity].badge}`}>
                {SEV[selected.severity].label}
              </span>
              <span className="text-[10px] text-zinc-400 bg-surface-2 px-2 py-0.5 rounded border border-border">
                {selected.status}
              </span>
              <span className="text-[10px] text-zinc-600">Since {selected.startDate}</span>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {/* Description */}
            <div className="space-y-2">
              <p className="text-xs text-zinc-300 leading-relaxed">{selected.description}</p>
              <p className="text-[11px] text-zinc-500 leading-relaxed">{selected.detail}</p>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface-2 rounded-lg border border-border p-2.5 text-center">
                <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">Casualties</div>
                <div className={`text-sm font-bold ${selected.casualties === 'N/A' ? 'text-zinc-500' : 'text-red-400'}`}>
                  {selected.casualties}
                </div>
              </div>
              <div className="bg-surface-2 rounded-lg border border-border p-2.5 text-center">
                <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">Countries</div>
                <div className="text-sm font-bold text-white">{selected.affectedCountries.length}</div>
              </div>
            </div>

            {/* Market impact */}
            <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-violet-400" />
                <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">Market Impact</span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">{selected.marketImpact}</p>
            </div>

            {/* Stocks */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-semibold">
                  Affected Stocks
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-1.5">
                {selected.stocks.map((s) => (
                  <StockRow
                    key={s.ticker}
                    stock={s}
                    price={stockPrices[s.ticker]}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── List view ── */
        <div className="flex flex-col h-full overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
            <h2 className="text-sm font-bold text-white">Active Conflict Zones</h2>
            <p className="text-[10px] text-zinc-600 mt-0.5">Click a zone on the map or list below</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {zones.map((z) => (
              <button
                key={z.id}
                onClick={() => onSelect(z)}
                className="w-full text-left px-3 py-2.5 rounded-xl border border-border bg-surface-1 hover:bg-surface-2 hover:border-zinc-600 transition-all duration-150 group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="relative shrink-0">
                    <div className={`w-2.5 h-2.5 rounded-full ${SEV[z.severity].dot}`} />
                    <div className={`absolute inset-0 w-2.5 h-2.5 rounded-full ${SEV[z.severity].dot} animate-ping opacity-50`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors truncate">
                        {z.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] text-zinc-600">{z.region}</span>
                      <span className="text-[9px] text-zinc-700">·</span>
                      <span className="text-[9px] text-zinc-600">{z.status}</span>
                    </div>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold shrink-0 ${SEV[z.severity].badge}`}>
                    {SEV[z.severity].label}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="px-4 py-3 border-t border-border shrink-0 space-y-1.5">
            <div className="text-[9px] text-zinc-700 uppercase tracking-widest font-semibold mb-2">Severity Legend</div>
            {(Object.entries(SEV) as [Severity, typeof SEV[Severity]][]).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${val.dot}`} />
                <span className="text-[10px] text-zinc-500">{val.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main GeoRisk page ─────────────────────────────────────────────────────────
export function GeoRisk() {
  const [selected, setSelected] = useState<ConflictZone | null>(null);
  const [stockPrices, setStockPrices] = useState<Record<string, StockPrice>>({});
  const [mapPosition, setMapPosition] = useState<{ coordinates: [number, number]; zoom: number }>({
    coordinates: [10, 15],
    zoom: 1,
  });
  const [_showPanel, setShowPanel] = useState(false);
  const fetchedRef = useRef<Set<string>>(new Set());

  // Fetch stock prices when a zone is selected
  useEffect(() => {
    if (!selected) return;
    selected.stocks.forEach(({ ticker }) => {
      if (fetchedRef.current.has(ticker)) return;
      fetchedRef.current.add(ticker);
      setStockPrices((prev) => ({
        ...prev,
        [ticker]: { price: 0, change: 0, changePercent: 0, loading: true },
      }));
      getStockDetail(ticker)
        .then((raw: unknown) => {
          const d = raw as Record<string, number>;
          setStockPrices((prev) => ({
            ...prev,
            [ticker]: {
              price: d?.price ?? d?.current_price ?? 0,
              change: d?.change ?? 0,
              changePercent: d?.change_pct ?? d?.changePercent ?? 0,
              loading: false,
            },
          }));
        })
        .catch(() => {
          setStockPrices((prev) => ({
            ...prev,
            [ticker]: { price: 0, change: 0, changePercent: 0, loading: false },
          }));
        });
    });
  }, [selected]);

  const handleSelectZone = useCallback((zone: ConflictZone) => {
    setSelected((prev) => (prev?.id === zone.id ? null : zone));
    setShowPanel(true);
  }, []);

  const handleDeselect = useCallback(() => {
    setSelected(null);
  }, []);

  // Country fill color
  const getCountryFill = useCallback((geoId: string | number | undefined) => {
    if (!geoId) return '#161622';
    const id = String(geoId);
    // Check if this country is in ANY conflict zone
    for (const zone of CONFLICT_ZONES) {
      if (zone.affectedCountries.includes(id)) {
        const isSelected = selected?.id === zone.id;
        const { color } = SEV[zone.severity];
        return isSelected
          ? `${color}55`   // ~33% opacity when selected
          : `${color}18`;  // ~10% opacity always
      }
    }
    return selected ? '#12121e' : '#161622';
  }, [selected]);

  const criticalCount  = CONFLICT_ZONES.filter(z => z.severity === 'critical').length;
  const highCount      = CONFLICT_ZONES.filter(z => z.severity === 'high').length;
  const mediumCount    = CONFLICT_ZONES.filter(z => z.severity === 'medium').length;
  const monitorCount   = CONFLICT_ZONES.filter(z => z.severity === 'monitoring').length;

  return (
    <div className="flex-1 overflow-hidden" style={{ height: 'calc(100vh - 56px)' }}>

      {/* ── Desktop: side-by-side ── */}
      <div className="hidden lg:flex h-full">

        {/* Map area */}
        <div className="flex-1 min-w-0 relative overflow-hidden bg-[#06060f]">

          {/* Top status bar */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 py-3 bg-gradient-to-b from-[#06060f] via-[#06060f]/80 to-transparent pointer-events-none">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[11px] font-bold text-red-400 tracking-wider">LIVE</span>
              </div>
              <span className="text-[11px] text-zinc-500">Global Conflict Risk Monitor</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-[10px] text-zinc-600">{criticalCount} Critical</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                <span className="text-[10px] text-zinc-600">{highCount} High</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                <span className="text-[10px] text-zinc-600">{mediumCount} Medium</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span className="text-[10px] text-zinc-600">{monitorCount} Monitor</span>
              </div>
            </div>
          </div>

          {/* SVG Map */}
          <ComposableMap
            projection="geoNaturalEarth1"
            projectionConfig={{ scale: 165, center: [10, 15] }}
            style={{ width: '100%', height: '100%' }}
            className="animate-map-fade"
          >
            <ZoomableGroup
              center={mapPosition.coordinates}
              zoom={mapPosition.zoom}
              minZoom={1}
              maxZoom={6}
              onMoveEnd={setMapPosition}
            >
              {/* Ocean */}
              <Sphere
                id="rsm-sphere"
                fill="#080814"
                stroke="#1a1a2e"
                strokeWidth={0.3}
              />

              {/* Lat/lng grid */}
              <Graticule
                id="rsm-graticule"
                stroke="#1a1a2e"
                strokeWidth={0.3}
                fill="none"
              />

              {/* Countries */}
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={getCountryFill(geo.id)}
                      stroke="#1e1e30"
                      strokeWidth={0.4}
                      style={{
                        default:  { outline: 'none', transition: 'fill 0.3s ease' },
                        hover:    { outline: 'none', fill: '#222234' },
                        pressed:  { outline: 'none' },
                      }}
                    />
                  ))
                }
              </Geographies>

              {/* Conflict markers */}
              {CONFLICT_ZONES.map((zone) => (
                <ConflictMarker
                  key={zone.id}
                  zone={zone}
                  selected={selected?.id === zone.id}
                  onClick={() => handleSelectZone(zone)}
                />
              ))}
            </ZoomableGroup>
          </ComposableMap>

          {/* Bottom hint */}
          <div className="absolute bottom-4 left-4 text-[10px] text-zinc-700 pointer-events-none">
            Scroll to zoom · Drag to pan · Click marker for analysis
          </div>

          {/* Selected zone badge on map */}
          {selected && (
            <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-surface-1/90 backdrop-blur-sm border border-border rounded-xl px-3 py-2 animate-sweep-in">
              <div className={`w-2 h-2 rounded-full ${SEV[selected.severity].dot}`} />
              <span className="text-xs font-semibold text-white">{selected.name}</span>
              <button onClick={handleDeselect} className="text-zinc-600 hover:text-zinc-400 text-xs ml-1 transition-colors">✕</button>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="w-80 xl:w-96 shrink-0 border-l border-border bg-surface-0 flex flex-col overflow-hidden">
          {/* Panel header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0 bg-surface-1">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <span className="text-[9px]">⚔</span>
              </div>
              <span className="text-xs font-bold text-white">Geo-Risk Intel</span>
            </div>
            {selected && (
              <button
                onClick={handleDeselect}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
              >
                ← All zones
              </button>
            )}
          </div>

          <ConflictPanel
            zones={CONFLICT_ZONES}
            selected={selected}
            onSelect={handleSelectZone}
            stockPrices={stockPrices}
          />
        </div>
      </div>

      {/* ── Mobile layout ── */}
      <div className="lg:hidden flex flex-col h-full overflow-hidden">

        {/* Map (top half) */}
        <div className="relative overflow-hidden bg-[#06060f]" style={{ height: '45%' }}>
          {/* Status bar */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-[#06060f] to-transparent pointer-events-none">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[9px] font-bold text-red-400">LIVE</span>
            </div>
            <div className="flex items-center gap-2">
              {([['critical', criticalCount], ['high', highCount], ['medium', mediumCount]] as const).map(([sev, count]) => (
                <div key={sev} className="flex items-center gap-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${SEV[sev].dot}`} />
                  <span className="text-[9px] text-zinc-600">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <ComposableMap
            projection="geoNaturalEarth1"
            projectionConfig={{ scale: 140, center: [10, 15] }}
            style={{ width: '100%', height: '100%' }}
          >
            <ZoomableGroup center={[10, 15]} zoom={1} minZoom={1} maxZoom={4}>
              <Sphere id="rsm-sphere-m" fill="#080814" stroke="#1a1a2e" strokeWidth={0.3} />
              <Graticule id="rsm-graticule-m" stroke="#1a1a2e" strokeWidth={0.3} fill="none" />
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={getCountryFill(geo.id)}
                      stroke="#1e1e30"
                      strokeWidth={0.4}
                      style={{ default: { outline: 'none' }, hover: { outline: 'none' }, pressed: { outline: 'none' } }}
                    />
                  ))
                }
              </Geographies>
              {CONFLICT_ZONES.map((zone) => (
                <ConflictMarker
                  key={zone.id}
                  zone={zone}
                  selected={selected?.id === zone.id}
                  onClick={() => { handleSelectZone(zone); setShowPanel(true); }}
                />
              ))}
            </ZoomableGroup>
          </ComposableMap>

          {selected && (
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2 bg-surface-1/90 backdrop-blur-sm border border-border rounded-xl px-3 py-2">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${SEV[selected.severity].dot}`} />
                <span className="text-xs font-semibold text-white truncate">{selected.name}</span>
              </div>
              <button onClick={handleDeselect} className="text-zinc-600 text-xs shrink-0">✕</button>
            </div>
          )}
        </div>

        {/* Panel (bottom half) */}
        <div className="flex-1 overflow-hidden border-t border-border bg-surface-0 flex flex-col">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between shrink-0 bg-surface-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">⚔ Geo-Risk Intel</span>
            </div>
            {selected && (
              <button
                onClick={handleDeselect}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                ← All zones
              </button>
            )}
          </div>

          <ConflictPanel
            zones={CONFLICT_ZONES}
            selected={selected}
            onSelect={handleSelectZone}
            stockPrices={stockPrices}
          />
        </div>
      </div>
    </div>
  );
}
