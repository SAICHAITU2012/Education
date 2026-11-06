export function Waveform({ active, tone = 'student' }: { active: boolean; tone?: 'student' | 'teacher' }) {
  return (
    <div className={`waveform ${active ? 'active' : ''} tone-${tone}`} aria-hidden="true">
      {Array.from({ length: 7 }).map((_, i) => (
        <span key={i} style={{ animationDelay: `${i * 90}ms` }} />
      ))}
    </div>
  );
}
