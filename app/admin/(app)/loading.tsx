/** Shown instantly on navigation (and prefetched by sidebar links) while the page's data streams in. */
export default function AdminLoading() {
  return (
    <div className="a-page" aria-busy="true" aria-live="polite">
      <span className="a-sr">Đang tải…</span>
      <div className="a-skel" style={{ width: 220, height: 30, marginBottom: 10 }} />
      <div className="a-skel" style={{ width: 320, height: 16, marginBottom: 24 }} />
      <div className="a-card">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="a-skel" style={{ height: 18, margin: i ? '14px 0 0' : 0, width: `${90 - (i % 3) * 12}%` }} />
        ))}
      </div>
    </div>
  );
}
