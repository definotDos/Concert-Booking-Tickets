export function BookingProgress({ active = 1 }) {
  return <ol className="booking-progress" aria-label="Booking progress">{['Details', 'Seats', 'Payment', 'Confirm'].map((label, index) => <li key={label} className={index <= active ? 'is-current' : ''} aria-current={index === active ? 'step' : undefined}><span>{index < active ? '✓' : index + 1}</span>{label}</li>)}</ol>;
}
