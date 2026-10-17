import { buildIndex } from '../../lib/search-index.mjs';

export const dynamic = 'force-static';

export function GET() {
  return Response.json(buildIndex());
}
