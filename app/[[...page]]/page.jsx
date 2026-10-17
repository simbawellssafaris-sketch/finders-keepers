import { listPages, loadPage, pageName } from '../../lib/pages';

export const dynamicParams = false;

// Production export emits <name>.html for every page (so existing .html links keep working on any host);
// "/" is the home page. In `npm run dev`, URLs ending in .html are accepted too.
export function generateStaticParams() {
  const names = listPages();
  const params = [{ page: [] }, ...names.map((n) => ({ page: [n] }))];
  if (process.env.NODE_ENV === 'development') names.forEach((n) => params.push({ page: [`${n}.html`] }));
  return params;
}

// The page body goes inside a custom <fs-page> element (not a <div>): browsers recover from stray end tags such as
// an extra </div> in the old markup by closing the nearest matching element, and a <div> wrapper would get closed by
// mistake. Nothing can close <fs-page>, so every page is parsed exactly as it was before. display:contents keeps
// the wrapper out of the layout.
export default async function Page({ params }) {
  const { page } = await params;
  const { bodyHtml } = loadPage(pageName(page));
  return <fs-page id="fs-page" suppressHydrationWarning style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: bodyHtml }} />;
}
