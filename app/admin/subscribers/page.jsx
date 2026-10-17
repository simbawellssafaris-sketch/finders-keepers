import ListPage from '../_components/ListPage';

export const dynamic = 'force-dynamic';

export default function Page({ searchParams }) {
  return <ListPage table="newsletter_subscribers" searchParams={searchParams} />;
}
