import { site } from '../lib/site.mjs';

export const metadata = { title: `Page not found | ${site.brandShort}`, robots: { index: false } };

// Shown for any address that does not exist. Self-contained, so it looks right wherever the file is served from.
export default function GlobalNotFound() {
  const css = `
    *{box-sizing:border-box}body{margin:0;background:#EDE3CE;color:#2C2A26;font-family:'Raleway',system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:40px 20px}
    .nf{max-width:640px;text-align:center}.nf img{width:64px;height:auto;margin:0 auto 22px;display:block}
    .nf small{display:block;font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:#B5572F;margin-bottom:18px}
    .nf h1{font-family:'Fraunces','EB Garamond',Georgia,serif;font-weight:400;font-size:clamp(34px,6vw,54px);line-height:1.1;margin:0 0 16px}
    .nf p{font-size:17px;line-height:1.7;color:#5C5750;margin:0 0 30px}
    .nf .row{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}
    .nf a{display:inline-block;padding:14px 26px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;text-decoration:none;border:1.5px solid #2C2A26;color:#2C2A26}
    .nf a.solid{background:#B5572F;border-color:#B5572F;color:#fff}.nf a:hover{opacity:.85}
    .nf .brand{margin-top:44px;font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#8a8377}`;
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400&family=Raleway:wght@400;500&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        <main className="nf">
          <img src="/assets/img/logo/lion-mark.png" alt="" width="64" height="76" />
          <small>Error 404</small>
          <h1>This trail has gone cold.</h1>
          <p>The page you were looking for has moved, or never existed. Let&rsquo;s get you back to somewhere worth going.</p>
          <div className="row">
            <a className="solid" href="/">Back to the home page</a>
            <a href="/destinations.html">Destinations</a>
            <a href="/journey-finder.html">Our Journeys</a>
          </div>
          <div className="brand">{site.brand}</div>
        </main>
      </body>
    </html>
  );
}
