// The public "unsubscribe" pages that the link at the bottom of every newsletter opens. Own page shell, never indexed.
export const metadata = {
  title: 'Unsubscribe | Finders & Keepers Safaris',
  robots: { index: false, follow: false, nocache: true },
};

const CSS = `
*{box-sizing:border-box}
body{margin:0;background:#EDE3CE;color:#1a1209;font-family:Raleway,Arial,sans-serif;font-size:16px;line-height:1.6}
.box{max-width:460px;margin:12vh auto 0;background:#fff;border-top:3px solid #8B3A2A;padding:34px 32px 30px}
h1{font-family:'EB Garamond',Georgia,serif;font-weight:500;font-size:30px;margin:0 0 10px}
p{margin:0 0 16px;color:#4a4136}
button,a.btn{display:inline-block;background:#8B3A2A;color:#fff;border:0;padding:12px 24px;font:inherit;font-size:13px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;text-decoration:none}
a{color:#8B3A2A}
`;

export default function UnsubscribeLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500&family=Raleway:wght@400;500;600&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
