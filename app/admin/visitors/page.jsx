import Link from 'next/link';
import { requireAdmin } from '../../../lib/admin/auth';
import { fmtDay, fmtDate } from '../../../lib/admin/format';
import Shell from '../_components/Shell';

export const dynamic = 'force-dynamic';

const RANGES = [[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days']];
const SOURCE_LABELS = { direct: 'Direct (typed the address, or a bookmark)', google: 'Google', bing: 'Bing', duckduckgo: 'DuckDuckGo', yahoo: 'Yahoo', 'other search': 'Other search engines', instagram: 'Instagram', facebook: 'Facebook', x: 'X (Twitter)', whatsapp: 'WhatsApp', linkedin: 'LinkedIn', youtube: 'YouTube', tiktok: 'TikTok', pinterest: 'Pinterest', 'other websites': 'Other websites' };
const DEVICE_LABELS = { mobile: 'Phone', desktop: 'Computer', tablet: 'Tablet' };
const COUNTRIES = typeof Intl !== 'undefined' && Intl.DisplayNames ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
const num = (n) => Number(n || 0).toLocaleString('en-US');
const countryName = (c) => { try { return (COUNTRIES && COUNTRIES.of(c)) || c; } catch { return c; } };
const pageName = (p) => (p === '/' ? 'Homepage' : p);

// A row of horizontal bars (plain CSS, no chart library).
function Bars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="ad-bars">
      {rows.map((r) => (
        <div className="ad-barrow" key={r.label} style={{ gridTemplateColumns: 'minmax(120px,220px) minmax(0,1fr) 70px' }}>
          <span className="ad-barlabel" style={{ color: 'inherit' }}>{r.label}</span>
          <span className="ad-bartrack"><span className="ad-barfill" style={{ width: `${Math.max(r.value ? 2 : 0, (r.value / max) * 100)}%` }} /></span>
          <span className="ad-barvalue">{num(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

// One column per day: the pale bar is page views, the solid bar inside it is visitors.
function DayChart({ days }) {
  const max = Math.max(1, ...days.map((d) => d.views));
  const step = Math.ceil(days.length / 8);
  return (
    <div role="img" aria-label="Page views and visitors for each day" style={{ display: 'flex', alignItems: 'flex-end', gap: days.length > 45 ? 1 : 3, height: 170, borderBottom: '1px solid var(--line)' }}>
      {days.map((d) => (
        <div key={d.day} title={`${fmtDay(d.day)}: ${num(d.visitors)} visitor${d.visitors === 1 ? '' : 's'}, ${num(d.views)} page view${d.views === 1 ? '' : 's'}`} style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', alignItems: 'flex-end', position: 'relative' }}>
          <div style={{ width: '100%', height: `${(d.views / max) * 100}%`, minHeight: d.views ? 2 : 0, background: 'var(--beige-deep)', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: d.views ? `${(d.visitors / d.views) * 100}%` : 0, background: 'var(--rust)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// How many people have looked at the website: counted anonymously by the website itself (see the note at the bottom).
export default async function Visitors({ searchParams }) {
  const ctx = await requireAdmin();
  const sp = (await searchParams) || {};
  const days = RANGES.some(([d]) => d === Number(sp.days)) ? Number(sp.days) : 30;
  const { data: s, error } = await ctx.supabase.rpc('visitor_stats', { p_days: days });
  const none = !error && s && !s.first_view;
  const range = RANGES.find(([d]) => d === days)[1];
  const dayRows = (s && s.daily) || [];
  const labelDays = dayRows.length ? `${fmtDay(dayRows[0].day)} to ${fmtDay(dayRows[dayRows.length - 1].day)}` : '';

  return (
    <Shell ctx={ctx} current="visitors">
      <h1>Website visitors</h1>
      <p className="ad-sub">How many people have looked at finderskeeperssafaris.com. Counted anonymously: no names, no IP addresses and no cookies.</p>

      {error ? <p className="ad-err" role="alert">Could not load the figures. Please reload the page.</p> : null}
      {none ? (
        <div className="ad-empty">No visits have been counted yet. Counting starts as soon as this update is live on the website, and the first numbers appear here within minutes.</div>
      ) : null}

      {s && s.first_view ? (
        <>
          <div className="ad-toolbar">
            {RANGES.map(([d, label]) => <Link key={d} className={`ad-btn ${d === days ? '' : 'ghost'}`} href={`/admin/visitors?days=${d}`}>{label}</Link>)}
            <span className="ad-sub" style={{ margin: 0 }}>Right now: <strong>{num(s.live.visitors)}</strong> {s.live.visitors === 1 ? 'person' : 'people'} on the site in the last 30 minutes</span>
          </div>

          <div className="ad-grid">
            {[['today', 'Today'], ['yesterday', 'Yesterday'], ['d7', 'Last 7 days'], ['d30', 'Last 30 days']].map(([k, label]) => (
              <div className="ad-card" key={k}>
                <div className="n">{num(s.summary[k].visitors)}</div>
                <div className="l">{label}: visitors</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>{num(s.summary[k].views)} page view{s.summary[k].views === 1 ? '' : 's'}</div>
              </div>
            ))}
          </div>

          <section className="ad-panel">
            <h2>{range}</h2>
            <p className="ad-sub" style={{ marginBottom: 14 }}>{labelDays}. <strong>{num(s.period.visitors)}</strong> visitors, <strong>{num(s.period.views)}</strong> page views. The solid part of each bar is visitors; the pale part is all page views that day. Hover a bar for the exact numbers.</p>
            <DayChart days={dayRows} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
              <span>{fmtDay(dayRows[0].day)}</span><span>{fmtDay(dayRows[dayRows.length - 1].day)}</span>
            </div>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 26, alignItems: 'start' }}>
            <section className="ad-panel">
              <h2>Where visitors come from</h2>
              {s.sources.length ? <Bars rows={s.sources.map((x) => ({ label: SOURCE_LABELS[x.source] || x.source, value: x.views }))} /> : <p className="ad-sub">Nothing yet.</p>}
              {s.referrers.length ? (
                <>
                  <h3 style={{ margin: '22px 0 8px', fontSize: 18 }}>Websites that sent people</h3>
                  <div className="ad-tablewrap"><table className="ad-table"><tbody>
                    {s.referrers.map((r) => <tr key={r.host}><td>{r.host}</td><td style={{ textAlign: 'right' }}>{num(r.views)}</td></tr>)}
                  </tbody></table></div>
                </>
              ) : null}
            </section>

            <section className="ad-panel">
              <h2>What they use</h2>
              <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>Device</h3>
              <Bars rows={s.devices.map((x) => ({ label: DEVICE_LABELS[x.device] || x.device, value: x.views }))} />
              <h3 style={{ margin: '22px 0 8px', fontSize: 18 }}>Browser</h3>
              <Bars rows={s.browsers.map((x) => ({ label: x.browser, value: x.views }))} />
              <h3 style={{ margin: '22px 0 8px', fontSize: 18 }}>Country</h3>
              {s.countries.length
                ? <Bars rows={s.countries.map((x) => ({ label: countryName(x.country), value: x.views }))} />
                : <p className="ad-sub" style={{ marginBottom: 0 }}>The hosting does not report visitors&rsquo; countries yet, so none are shown.</p>}
            </section>
          </div>

          <section className="ad-panel">
            <h2>Most viewed pages</h2>
            <div className="ad-tablewrap">
              <table className="ad-table">
                <thead><tr><th>Page</th><th style={{ textAlign: 'right' }}>Page views</th><th style={{ textAlign: 'right' }}>Visitors</th></tr></thead>
                <tbody>
                  {s.pages.map((p) => (
                    <tr key={p.path}>
                      <td><a href={p.path} target="_blank" rel="noopener">{pageName(p.path)}</a></td>
                      <td style={{ textAlign: 'right' }}>{num(p.views)}</td>
                      <td style={{ textAlign: 'right' }}>{num(p.visitors)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="ad-sub" style={{ fontSize: 13 }}>
            <strong>How to read this.</strong> A <em>visitor</em> is one device in one day, so the same person coming back on another day counts again. A <em>page view</em> is one page opened.
            Search-engine robots, link previews and people signed in to this dashboard are not counted, and neither are visitors who have &ldquo;Do Not Track&rdquo; switched on in their browser.
            Counting began on {fmtDate(s.first_view)}. Figures are for the Nairobi day (midnight to midnight).
          </p>
        </>
      ) : null}
    </Shell>
  );
}
