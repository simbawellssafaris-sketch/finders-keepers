import DetailPage from '../../_components/DetailPage';

export const dynamic = 'force-dynamic';

export default function Page({ params }) {
  return <DetailPage table="service_requests" params={params} />;
}
