import { env } from 'cloudflare:workers';
import { handleBoardRequest } from '../../../lib/board-api.mjs';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
 return handleBoardRequest(request,env.DB);
}

export function POST(request: Request) {
 return handleBoardRequest(request,env.DB);
}
