import { DesignShowcase } from '../components/DesignShowcase';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useResource } from '../hooks/useResource';
import { ConcertCard } from '../components/ConcertCard';
import { Icon } from '../components/Icon';
import { Empty, Loading, Notice, Pager } from '../components/UI';
import { date } from '../services/api';

export function Discover() {
  const [filters, setFilters] = useSearchParams();
  const [view, setView] = useState('grid');
  const q = filters.get('q') || '';
  const genre = filters.get('genre') || '';
  const artistType = ['band', 'solo'].includes(filters.get('artistType')) ? filters.get('artistType') : '';
  const city = filters.get('city') || '';
  const sort = ['soonest', 'latest', 'title'].includes(filters.get('sort')) ? filters.get('sort') : 'soonest';
  const rawPage = Number(filters.get('page'));
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const params = new URLSearchParams({ q, genre, artistType, city, sort, page, limit: 12 });
  const { data, loading, error, refresh } = useResource(`/concerts?${params}`);
  const { data: upcoming } = useResource('/concerts?sort=soonest&limit=1');
  const spotlight = upcoming?.items?.[0];
  const genres = upcoming?.genres || data?.genres || [];
  const hasFilters = Boolean(q || genre || artistType || city || sort !== 'soonest');
  function updateFilters(values) {
    setFilters((current) => {
      const next = new URLSearchParams(current);
      next.delete('page');
      Object.entries(values).forEach(([key, value]) => {
        if (value && !(key === 'sort' && value === 'soonest')) next.set(key, value);
        else next.delete(key);
      });
      return next;
    });
  }
  function resetFilters() { setFilters({}); }
  return (
    <div className="discover-page">
      <section className="hero" aria-label="Discover live music">
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> YOUR NEXT UNFORGETTABLE NIGHT</div>
          <h1>Concert Booking<br /><em>Tickets</em></h1>
          <p>Your favorite artists. A new discovery.<br />Find the live moment you’ll talk about tomorrow.</p>
          <div className="hero-actions">
            <a href="#discover" className="button">Explore concerts <Icon name="arrow" /></a>
            <a href="#how-it-works" className="hero-secondary">How it works <Icon name="arrowUpRight" size={18} /></a>
          </div>
        </div>
        {spotlight && (
          <Link to={`/concerts/${spotlight._id}`} className="hero-spotlight">
            <div className="spotlight-label"><span className="live-dot" /> NEXT ON STAGE <Icon name="arrow" size={18} /></div>
            <span className="spotlight-artist">{spotlight.artist?.name}</span>
            <strong>{spotlight.title}</strong>
            <span className="spotlight-details">{date(spotlight.startsAt, spotlight.venue?.timezone)}</span>
            <span className="spotlight-venue"><Icon name="pin" size={15} />{spotlight.venue?.name} · {spotlight.venue?.city}</span>
            <span className="spotlight-action">Discover the show <Icon name="arrowUpRight" size={18} /></span>
          </Link>
        )}
        <div className="hero-bottom">
          <span>LIVE MUSIC, CLOSER TO YOU</span>
          <span>Choose your seat <b>·</b> Book online <b>·</b> Bring your digital ticket</span>
        </div>
      </section>
      <section id="discover" aria-labelledby="discover-title">
        <div className="discovery-controls">
          <div className="search-heading">
            <h2 id="discover-title">Find your next night out<span>.</span></h2>
            <span>Search by artist, event or city</span>
          </div>
          <form className="search-bar" key={`${q}:${city}`} role="search" onSubmit={(event) => {
            event.preventDefault();
            const values = new FormData(event.currentTarget);
            updateFilters({ q: values.get('q').trim(), city: values.get('city').trim() });
          }}>
            <label className="search-input">
              <span className="field-caption"><Icon name="search" size={16} /> ARTIST OR EVENT</span>
              <input name="q" aria-label="Search concerts or artists" placeholder="Who do you want to see?" defaultValue={q} />
            </label>
            <label className="city-input">
              <span className="field-caption"><Icon name="pin" size={16} /> PHILIPPINES</span>
              <input name="city" aria-label="Filter by city" placeholder="Any city in the Philippines" defaultValue={city} />
            </label>
            <button type="submit">Find a show <Icon name="arrow" size={18} /></button>
          </form>
          <div className="genre-browser">
            <span className="genre-caption">Browse by artist</span>
            <div className="chips" role="group" aria-label="Filter by artist type">
              {[['', 'All artists'], ['band', 'Bands'], ['solo', 'Solo artists']].map(([value, label]) => (
                <button key={value} aria-pressed={artistType === value} className={`chip ${artistType === value ? 'selected' : ''}`} onClick={() => updateFilters({ artistType: value })}>{label}</button>
              ))}
            </div>
          </div>
          <div className="genre-browser">
            <span className="genre-caption">Browse by genre</span>
            <div className="chips" role="group" aria-label="Filter by music genre">
              {['', ...genres].map((g) => (
                <button key={g} aria-pressed={genre === g} className={`chip ${genre === g ? 'selected' : ''}`} onClick={() => updateFilters({ genre: g })}>{g || 'All music'}</button>
              ))}
            </div>
          </div>
          {hasFilters && (
            <div className="active-filters">
              <div className="filter-tags">
                {artistType && <button className="secondary filter-tag" onClick={() => updateFilters({ artistType: '' })} aria-label="Remove artist type filter">{artistType === 'band' ? 'Bands' : 'Solo artists'}<Icon name="close" size={14} /></button>}
                {[[ 'q', q, 'Search' ], [ 'city', city, 'City' ], [ 'genre', genre, 'Genre' ]].filter(([, value]) => value).map(([key, value, label]) => (
                  <button className="secondary filter-tag" key={key} aria-label={`Remove ${label.toLowerCase()} filter: ${value}`} onClick={() => updateFilters({ [key]: '' })}>{label}: {value}<Icon name="close" size={14} /></button>
                ))}
                {sort !== 'soonest' && <span>Custom sort applied</span>}
              </div>
              <button type="button" className="text-button" onClick={resetFilters}>Clear filters</button>
            </div>
          )}
        </div>
        <div className="results-heading">
          <div>
            <div className="eyebrow">YOUR NEXT LIVE MOMENT</div>
            <h3>{hasFilters ? 'Your search results' : 'Upcoming concerts'}<span className="count-pill" aria-live="polite">{loading ? '…' : data?.total ?? 0}</span></h3>
            <p>{hasFilters ? 'A little closer to your kind of music.' : 'Explore the lineup and find your place in the crowd.'}</p>
          </div>
          <div className="results-tools">
            <label className="sort-label">Sort by
              <select aria-label="Sort concerts" value={sort} onChange={(e) => updateFilters({ sort: e.target.value })}>
                <option value="soonest">Soonest first</option><option value="latest">Latest first</option><option value="title">Title A–Z</option>
              </select>
            </label>
            <div className="view-switch" role="group" aria-label="Concert display">
              {['grid', 'list'].map((mode) => <button key={mode} className="secondary" aria-label={`${mode === 'grid' ? 'Grid' : 'List'} view`} aria-pressed={view === mode} onClick={() => setView(mode)}><Icon name={mode} size={18} /></button>)}
            </div>
          </div>
        </div>
        <Notice error={error} />
        {error && <button className="secondary" onClick={refresh}>Try again</button>}
        <div aria-busy={loading}>
          {loading ? <Loading /> : data?.items.length ? (
            <>
              <div className={`concert-grid ${view === 'list' ? 'concert-list' : ''}`}>{data.items.map((c, i) => <ConcertCard concert={c} index={i} key={c._id} />)}</div>
              <Pager page={page} pages={data.pages} onChange={(next) => {
                updateFilters({ page: next });
                document.getElementById('discover')?.scrollIntoView({ block: 'start' });
              }} />
            </>
          ) : !error && (
            <Empty>
              <span className="empty-icon"><Icon name="search" size={28} /></span>
              <h3>{hasFilters ? 'No shows match just yet' : 'The next lineup is on its way'}</h3>
              <p>{hasFilters ? 'Try a different artist, a nearby city, or explore all music.' : 'Check back soon to discover upcoming concerts.'}</p>
              {hasFilters && <button className="secondary" onClick={resetFilters}>Explore all concerts <Icon name="arrow" size={18} /></button>}
            </Empty>
          )}
        </div>
      </section>
      <section id="how-it-works" className="booking-guide" aria-labelledby="booking-guide-title">
        <div className="section-heading">
          <div className="eyebrow">LESS PLANNING. MORE LIVING.</div>
          <h2 id="booking-guide-title">From browsing to singing along<span>.</span></h2>
          <p>Your next night out, in three simple steps.</p>
        </div>
        <div className="promise-strip">
          <div><span><Icon name="search" /></span><h3>Find your sound</h3><p>Explore artists, genres and shows in your city.</p></div>
          <div><span><Icon name="ticket" /></span><h3>Make it your seat</h3><p>Choose your view and complete your booking.</p></div>
          <div><span><Icon name="scan" /></span><h3>You’re ready for the door</h3><p>Open your digital ticket and get ready for the music.</p></div>
        </div>
      </section>
      <DesignShowcase />
    </div>
  );
}

