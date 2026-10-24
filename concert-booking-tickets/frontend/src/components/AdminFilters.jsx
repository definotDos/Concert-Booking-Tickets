import { useState } from 'react';
export function AdminFilters({ filters, statuses, onChange }) {
  const [search, setSearch] = useState(filters.q);
  return (
    <form
      className="admin-filters"
      onSubmit={(event) => {
        event.preventDefault();
        onChange({ ...filters, q: search.trim() });
      }}
    >
      <label>
        Search records
        <input
          type="search"
          value={search}
          maxLength={100}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Name, email, booking reference…"
        />
      </label>
      <label>
        Status
        <select
          aria-label="Filter status"
          value={filters.status}
          onChange={(event) => onChange({ ...filters, status: event.target.value })}
        >
          <option value="">All statuses</option>
          {statuses.map((status) => (
            <option value={status} key={status}>
              {status.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </label>
      <label>
        Sort
        <select
          aria-label="Sort records"
          value={filters.sort}
          onChange={(event) => onChange({ ...filters, sort: event.target.value })}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name / reference A–Z</option>
        </select>
      </label>
      <button type="submit">Search</button>
      <button
        className="secondary"
        type="button"
        onClick={() => {
          setSearch('');
          onChange({ q: '', status: '', sort: 'newest' });
        }}
      >
        Reset
      </button>
    </form>
  );
}
