import axios from "axios";
import { useEffect, useState, useMemo, useRef, useCallback, memo } from "react";
import './App.css';

// ── Type color palette ───────────────────────────────────────────────────────
const TYPE_COLORS = {
  normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C',
  grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1',
  ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
  rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', dark: '#705746',
  steel: '#B7B7CE', fairy: '#D685AD',
};


// Static type weakness/resistance chart for defensive calculations
const TYPE_CHART = {
  normal: { weak: ['fighting'], immune: ['ghost'], resist: [] },
  fire: { weak: ['water', 'ground', 'rock'], resist: ['fire', 'grass', 'ice', 'bug', 'steel', 'fairy'], immune: [] },
  water: { weak: ['electric', 'grass'], resist: ['fire', 'water', 'ice', 'steel'], immune: [] },
  electric: { weak: ['ground'], resist: ['electric', 'flying', 'steel'], immune: [] },
  grass: { weak: ['fire', 'ice', 'poison', 'flying', 'bug'], resist: ['water', 'electric', 'grass', 'ground'], immune: [] },
  ice: { weak: ['fire', 'fighting', 'rock', 'steel'], resist: ['ice'], immune: [] },
  fighting: { weak: ['flying', 'psychic', 'fairy'], resist: ['bug', 'rock', 'dark'], immune: [] },
  poison: { weak: ['ground', 'psychic'], resist: ['fighting', 'poison', 'bug', 'grass', 'fairy'], immune: [] },
  ground: { weak: ['water', 'grass', 'ice'], resist: ['poison', 'rock'], immune: ['electric'] },
  flying: { weak: ['electric', 'ice', 'rock'], resist: ['fighting', 'bug', 'grass'], immune: ['ground'] },
  psychic: { weak: ['bug', 'ghost', 'dark'], resist: ['fighting', 'psychic'], immune: [] },
  bug: { weak: ['fire', 'flying', 'rock'], resist: ['fighting', 'ground', 'grass'], immune: [] },
  rock: { weak: ['water', 'grass', 'fighting', 'ground', 'steel'], resist: ['normal', 'fire', 'poison', 'flying'], immune: [] },
  ghost: { weak: ['ghost', 'dark'], resist: ['poison', 'bug'], immune: ['normal', 'fighting'] },
  dragon: { weak: ['ice', 'dragon', 'fairy'], resist: ['fire', 'water', 'electric', 'grass'], immune: [] },
  dark: { weak: ['fighting', 'bug', 'fairy'], resist: ['ghost', 'dark'], immune: ['psychic'] },
  steel: { weak: ['fire', 'fighting', 'ground'], resist: ['normal', 'grass', 'ice', 'flying', 'psychic', 'bug', 'rock', 'dragon', 'steel', 'fairy'], immune: ['poison'] },
  fairy: { weak: ['poison', 'steel'], resist: ['fighting', 'bug', 'dark'], immune: ['dragon'] },
};

/** Calculate defensive type multipliers */
function calcTypeRelations(typeNames) {
  const mult = {};
  Object.keys(TYPE_COLORS).forEach(atkType => { mult[atkType] = 1; });
  typeNames.forEach(defType => {
    const chart = TYPE_CHART[defType];
    if (!chart) return;
    chart.weak.forEach(t => { mult[t] *= 2; });
    chart.resist.forEach(t => { mult[t] *= 0.5; });
    chart.immune.forEach(t => { mult[t] = 0; });
  });
  return mult;
}

// ── sessionStorage cache helpers ─────────────────────────────────────────────
const cache = {
  get: (k) => { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { } },
};

// ── Debounce hook ────────────────────────────────────────────────────────────
function useDebounce(v, ms) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

// ── Stat bar (compact) ───────────────────────────────────────────────────────
const StatBar = ({ label, value, color }) => (
  <div className="stat-row">
    <span className="stat-label">{label}</span>
    <div className="stat-track">
      <div className="stat-fill" style={{ width: `${Math.min((value / 255) * 100, 100)}%`, background: color }}></div>
    </div>
    <span className="stat-val">{value}</span>
  </div>
);

// ── Lazy-loaded Pokémon Card ─────────────────────────────────────────────────
const PokemonCard = memo(({ basic, onCardClick, favorites, toggleFavorite }) => {
  const [data, setData] = useState(null);
  const ref = useRef(null);
  const loaded = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (entry.isIntersecting && !loaded.current) {
          loaded.current = true;
          const c = cache.get(`poke-${basic.id}`);
          if (c) { setData(c); return; }
          try {
            const res = await axios.get(`https://pokeapi.co/api/v2/pokemon/${basic.id}`);
            cache.set(`poke-${basic.id}`, res.data);
            setData(res.data);
          } catch (e) { console.error(e); }
        }
      },
      { rootMargin: '300px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [basic.id]);

  const accent = data ? (TYPE_COLORS[data.types[0].type.name] || '#888') : '#444';
  const sprite = data
    ? (data.sprites.other['official-artwork'].front_default || data.sprites.front_default)
    : null;
  const isFav = favorites.includes(basic.id);

  const total = data
    ? data.stats.reduce((sum, s) => sum + s.base_stat, 0)
    : 0;

  return (
    <div
      ref={ref}
      className="card"
      style={{ '--accent': accent }}
      onClick={() => data && onCardClick(data)} 
    >
      <div className="card-top">
        <span className="card-num">#{basic.id.toString().padStart(3, '0')}</span>
        <button
          className={`card-fav ${isFav ? 'liked' : ''}`}
          onClick={e => toggleFavorite(e, basic.id)}
        >♥</button>
      </div>

      <div className="card-img">
        {sprite
          ? <img src={sprite} alt={basic.name} loading="lazy" />
          : <div className="card-img-ph"></div>
        }
      </div>

      <h2 className="card-name">{basic.name}</h2>

      {data ? (
        <>
          <div className="card-types">
            {data.types.map(t => (
              <span key={t.type.name} className="pill" style={{ background: TYPE_COLORS[t.type.name] }}>
                {t.type.name}
              </span>
            ))}
          </div>

          <div className="card-stats">
            {[
              { key: 'hp', lbl: 'HP' },
              { key: 'attack', lbl: 'ATT' },
              { key: 'defense', lbl: 'DEF' },
              { key: 'speed', lbl: 'SPE' },
            ].map(({ key, lbl }) => {
              const s = data.stats.find(st => st.stat.name === key);
              return <StatBar key={key} label={lbl} value={s?.base_stat ?? 0} color={accent} />;
            })}
            <div className="stat-row stat-total">
              <span className="stat-label">Total</span>
              <span className="stat-val">{total}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="card-skeleton">
          <div className="sk"></div><div className="sk w60"></div><div className="sk"></div>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.basic.id === nextProps.basic.id &&
    prevProps.favorites.includes(prevProps.basic.id) === nextProps.favorites.includes(nextProps.basic.id)
  );
});


// ── Evolution Chain (centered, with images) ──────────────────────────────────
const EvolutionChain = ({ chainUrl, currentName }) => {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chainUrl) return;
    (async () => {
      try {
        const c = cache.get(`evo-${chainUrl}`);
        if (c) { setStages(c); setLoading(false); return; }
        const res = await axios.get(chainUrl);
        const arr = [];
        let node = res.data.chain;
        while (node) {
          const id = Number(node.species.url.split('/').filter(Boolean).pop());
          arr.push({ name: node.species.name, id });
          node = node.evolves_to[0];
        }
        cache.set(`evo-${chainUrl}`, arr);
        setStages(arr);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [chainUrl]);

  if (loading) return <p className="muted-text">Loading evolution chain…</p>;
  if (!stages.length) return null;

  return (
    <div className="evo-chain">
      <h3>Evolution Chain</h3>
      <div className="evo-row">
        {stages.map((s, i) => (
          <div key={s.id} className="evo-cell">
            <div className={`evo-sprite ${s.name === currentName ? 'current' : ''}`}>
              <img
                src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${s.id}.png`}
                alt={s.name}
              />
            </div>
            <span className={s.name === currentName ? 'current' : ''}>{s.name}</span>
            {i < stages.length - 1 && <span className="arrow">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Pokemon Name Cards (TCG) ─────────────────────────────────────────────────
const PokemonCards = ({ name }) => {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const c = cache.get(`tcg-${name}`);
        if (c) { setCards(c); setLoading(false); return; }
        const res = await axios.get(`https://api.pokemontcg.io/v2/cards?q=name:"${name}"&pageSize=6`);
        const data = res.data.data || [];
        cache.set(`tcg-${name}`, data);
        setCards(data);
      } catch { setCards([]); }
      setLoading(false);
    })();
  }, [name]);

  const displayName = name.charAt(0).toUpperCase() + name.slice(1);

  if (loading) return <p className="muted-text">Loading cards…</p>;
  if (!cards.length) return null;
  return (
    <div className="tcg-block">
      <h3>{displayName} Cards</h3>
      <div className="tcg-row">
        {cards.map(c => (
          <div key={c.id} className="tcg-item">
            <img src={c.images.small} alt={c.name} />
            <span>{c.set.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  Main App
// ══════════════════════════════════════════════════════════════════════════════
function App() {
  const [pokemonList, setPokemonList] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 250);
  const [filterType, setFilterType] = useState('All');
  const [sortBy, setSortBy] = useState('id');
  const [selectedPokemon, setSelectedPokemon] = useState(null);
  const [visibleCount, setVisibleCount] = useState(15);
  const [selectedSpecies, setSelectedSpecies] = useState(null);
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem('favorites')) || []);

  useEffect(() => { localStorage.setItem('favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => {
    setVisibleCount(15);
  }, [debouncedSearch, filterType, sortBy]);
  // Load lightweight list (id + name only)
  useEffect(() => {
    (async () => {
      const c = cache.get('list-151');
      if (c) { setPokemonList(c); setLoadingList(false); return; }
      try {
        const res = await axios.get('https://pokeapi.co/api/v2/pokemon?limit=151');
        const list = res.data.results.map(p => {
          const id = Number(p.url.split('/').filter(Boolean).pop());
          return { id, name: p.name };
        });
        cache.set('list-151', list);
        setPokemonList(list);
      } catch (e) { console.error(e); }
      setLoadingList(false);
    })();
  }, []);

  // Open modal & fetch species info
  const handleCardClick = useCallback(async (pokemon) => {
    setSelectedPokemon(pokemon);
    setSelectedSpecies(null);
    try {
      const key = `species-${pokemon.id}`;
      const c = cache.get(key);
      if (c) { setSelectedSpecies(c); return; }
      const res = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${pokemon.id}/`);
      cache.set(key, res.data);
      setSelectedSpecies(res.data);
    } catch (e) { console.error(e); }
  }, []);

  const toggleFavorite = useCallback((e, id) => {
    e.stopPropagation();
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  }, []);

  const playCry = () => {
    if (selectedPokemon?.cries?.latest) new Audio(selectedPokemon.cries.latest).play();
  };

  // Filter + sort
  const filteredList = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    let list = pokemonList;
    if (term) {
      const num = term.replace(/^#?0*/, '');
      list = list.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.id.toString() === num ||
        p.id.toString().includes(num)
      );
    }
    if (sortBy === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [pokemonList, debouncedSearch, sortBy]);
  const visibleList = filteredList.slice(0, visibleCount);

  const allTypes = ['All', ...Object.keys(TYPE_COLORS)];

  // Modal derived data
  const accent = selectedPokemon ? (TYPE_COLORS[selectedPokemon.types[0].type.name] || '#fff') : '#fff';
  const weaknesses = selectedPokemon ? calcTypeRelations(selectedPokemon.types.map(t => t.type.name)) : {};
  const flavor = selectedSpecies?.flavor_text_entries?.find(e => e.language.name === 'en')?.flavor_text.replace(/[\n\f]/g, ' ') ?? '';
  const category = selectedSpecies?.genera?.find(g => g.language.name === 'en')?.genus ?? '';
  const gender = selectedSpecies?.gender_rate === -1
    ? 'Genderless'
    : selectedSpecies
      ? `${(100 - selectedSpecies.gender_rate * 12.5).toFixed(0)}% ♂ / ${(selectedSpecies.gender_rate * 12.5).toFixed(0)}% ♀`
      : '—';
  const totalStats = selectedPokemon
    ? selectedPokemon.stats.reduce((s, c) => s + c.base_stat, 0)
    : 0;

  return (
    <div className="app">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="hdr">
        <h1 className="hdr-title">POKÉDEX</h1>
        <div className="hdr-controls">
          <div className="search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Filter By Name or ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="sel">
            {allTypes.map(t => <option key={t} value={t}>{t === 'All' ? 'All Type' : t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="sel">
            <option value="id">Sort By ID</option>
            <option value="name">Sort By Name</option>
          </select>
        </div>
      </header>

      {/* ── Grid ────────────────────────────────────────────────────── */}
      <main className="grid">
        {loadingList
          ? <div className="spinner"></div>
          : filteredList.length > 0
            ? visibleList.map(p => (
              <PokemonCard key={p.id} basic={p} onCardClick={handleCardClick} favorites={favorites} toggleFavorite={toggleFavorite} />
            ))
            : <div className="empty">No Pokémon found for "{searchTerm}"</div>
        }

      </main>
      {!loadingList && visibleCount < filteredList.length && (
        <div className="load-more-wrap">
          <button className="load-more-btn" onClick={() => setVisibleCount(prev => prev + 20)}>
            Load More
          </button>
        </div>
      )}
      {/* ── Modal ───────────────────────────────────────────────────── */}
      {selectedPokemon && (
        <div className="overlay" onClick={() => setSelectedPokemon(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ '--accent': accent }}>
            <button className="modal-x" onClick={() => setSelectedPokemon(null)}>✕</button>
            <div className="modal-inner">

              {/* Hero */}
              <div className="m-hero">
                <div className="m-hero-img">
                  <div className="m-glow" style={{ background: accent }}></div>
                  <img
                    src={selectedPokemon.sprites.other['official-artwork'].front_default || selectedPokemon.sprites.front_default}
                    alt={selectedPokemon.name}
                  />
                </div>
                <div className="m-hero-info">
                  <span className="m-id">#{selectedPokemon.id.toString().padStart(3, '0')}</span>
                  <h2 className="m-name">{selectedPokemon.name}</h2>
                  <div className="m-types">
                    {selectedPokemon.types.map(t => (
                      <span key={t.type.name} className="pill" style={{ background: TYPE_COLORS[t.type.name] }}>{t.type.name}</span>
                    ))}
                  </div>
                  {flavor && <p className="m-desc">{flavor}</p>}
                  <button className="cry" onClick={playCry}>🔊 Play Cry</button>
                </div>
              </div>

              {/* Info Grid */}
              <div className="m-section">
                <div className="info-bar">
                  <div><label>Height</label><span>{(selectedPokemon.height / 10).toFixed(1)} m</span></div>
                  <div><label>Weight</label><span>{(selectedPokemon.weight / 10).toFixed(1)} kg</span></div>
                  <div><label>Category</label><span>{category || '—'}</span></div>
                  <div><label>Gender</label><span>{gender}</span></div>
                </div>
              </div>

              {/* Abilities */}
              <div className="m-section">
                <h3>Abilities</h3>
                <div className="ab-chips">
                  {selectedPokemon.abilities.map(a => (
                    <span key={a.ability.name} className={`ab ${a.is_hidden ? 'hid' : ''}`}>
                      {a.ability.name.replace(/-/g, ' ')}{a.is_hidden ? ' ★' : ''}
                    </span>
                  ))}
                </div>
              </div>

              {/* Type & Weaknesses */}
              <div className="m-section">
                <h3>Type Effectiveness</h3>
                <div className="eff-grid">
                  {Object.entries(weaknesses)
                    .filter(([, m]) => m !== 1)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, mult]) => (
                      <div key={type} className="eff-badge" style={{ background: `${TYPE_COLORS[type]}30`, borderColor: TYPE_COLORS[type] }}>
                        <span className="eff-name">{type}</span>
                        <span className={`eff-x ${mult > 1 ? 'w' : mult === 0 ? 'im' : 'r'}`}>
                          {mult === 0 ? '0×' : `${mult}×`}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Base Stats */}
              <div className="m-section">
                <h3>Base Stats</h3>
                <div className="m-stats">
                  {selectedPokemon.stats.map(s => (
                    <StatBar
                      key={s.stat.name}
                      label={s.stat.name.replace(/-/g, ' ').replace(/special /g, 'Sp. ').toUpperCase()}
                      value={s.base_stat}
                      color={accent}
                    />
                  ))}
                  <div className="stat-row stat-total">
                    <span className="stat-label">TOTAL</span>
                    <span className="stat-val">{totalStats}</span>
                  </div>
                </div>
              </div>

              {/* Evolution Chain */}
              {selectedSpecies?.evolution_chain?.url && (
                <div className="m-section">
                  <EvolutionChain chainUrl={selectedSpecies.evolution_chain.url} currentName={selectedPokemon.name} />
                </div>
              )}

              {/* Pokemon Name Cards */}
              <div className="m-section">
                <PokemonCards name={selectedPokemon.name} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;