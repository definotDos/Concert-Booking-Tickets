import { useState } from 'react';
import { api } from '../services/api';
import { Notice } from './UI';
export function ConcertForm({ item, artists, venues, onSaved, onClose }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const initial =
    item?.categories ||
    ['VIP', 'Lower Box', 'Upper Box'].map((name, i) => ({
      name,
      price: [15000, 9000, 5000][i],
      rows: 3,
      seatsPerRow: 10,
    }));
  const localDate = item
    ? new Date(
        new Date(item.startsAt).getTime() - new Date(item.startsAt).getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16)
    : '';
  async function save(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      const body = {
        title: form.get('title'),
        description: form.get('description'),
        artist: form.get('artist'),
        venue: form.get('venue'),
        startsAt: new Date(form.get('startsAt')).toISOString(),
        genre: form.get('genre'),
        image: form.get('image'),
        currency: form.get('currency'),
        serviceFee: Math.round(Number(form.get('fee')) * 100),
        categories: initial.map((c, i) => ({
          name: c.name,
          price: Math.round(Number(form.get(`price${i}`)) * 100),
          rows: Number(form.get(`rows${i}`)),
          seatsPerRow: Number(form.get(`seats${i}`)),
        })),
      };
      await api(`/admin/concerts${item ? `/${item._id}` : ''}`, {
        method: item ? 'PUT' : 'POST',
        body,
      });
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel admin-form" onSubmit={save}>
      <div className="section-title">
        <h2>{item ? 'Edit concert' : 'Create a concert'}</h2>
        <button type="button" className="secondary" onClick={onClose}>
          Close
        </button>
      </div>
      <Notice error={error} />
      <div className="form-grid">
        <label>
          Title
          <input name="title" required minLength={3} defaultValue={item?.title} />
        </label>
        <label>
          Genre
          <input name="genre" required defaultValue={item?.genre || 'Pop'} />
        </label>
        <label>
          Artist
          <select name="artist" required defaultValue={item?.artist?._id || ''}>
            <option value="">Choose artist</option>
            {['band', 'solo'].map((type) => (
              <optgroup key={type} label={type === 'band' ? 'Bands' : 'Solo artists'}>
                {artists.filter((a) => (a.type || 'band') === type)
                  .sort((a, b) => a.name.localeCompare(b.name)).map((a) => (
                    <option key={a._id} value={a._id}>{a.name}</option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label>
          Venue
          <select name="venue" required defaultValue={item?.venue?._id || ''}>
            <option value="">Choose venue</option>
            {venues.map((v) => (
              <option key={v._id} value={v._id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date & time (your device timezone)
          <input name="startsAt" type="datetime-local" required defaultValue={localDate} />
        </label>
        <label>
          Currency
          <select name="currency" defaultValue={item?.currency || 'sgd'}>
            <option value="sgd">SGD</option>
            <option value="usd">USD</option>
            <option value="php">PHP</option>
          </select>
        </label>
        <label>
          Booking fee (major units)
          <input
            type="number"
            name="fee"
            min="0"
            max="1000"
            step="0.01"
            defaultValue={(item?.serviceFee || 0) / 100}
          />
        </label>
        <label>
          Image URL (HTTPS)
          <input type="url" name="image" defaultValue={item?.image} />
        </label>
      </div>
      <label>
        Description
        <textarea name="description" rows={3} defaultValue={item?.description} />
      </label>
      <h3>Seating & pricing</h3>
      <p className="muted">
        Prices are in the selected currency. Layout and event details lock after the first
        reservation.
      </p>
      {initial.map((c, i) => (
        <fieldset key={c.name}>
          <legend>{c.name}</legend>
          <div className="form-grid three">
            <label>
              Price
              <input
                name={`price${i}`}
                type="number"
                required
                min="0.01"
                max="100000"
                step="0.01"
                defaultValue={c.price / 100}
              />
            </label>
            <label>
              Rows
              <input
                name={`rows${i}`}
                type="number"
                required
                min="1"
                max="20"
                defaultValue={c.rows}
              />
            </label>
            <label>
              Seats per row
              <input
                name={`seats${i}`}
                type="number"
                required
                min="1"
                max="30"
                defaultValue={c.seatsPerRow}
              />
            </label>
          </div>
        </fieldset>
      ))}
      <button disabled={busy}>{busy ? 'Saving…' : 'Save concert'}</button>
    </form>
  );
}
