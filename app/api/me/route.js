import { meResponse, requireUser } from '../../../lib/auth';

export const runtime = 'nodejs';

export async function GET(request) {
  const result = requireUser(request);
  if (result.error) return result.error;
  return meResponse(result.user);
}
