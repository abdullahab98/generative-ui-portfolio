import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { timingSafeEqual, createHash } from 'node:crypto';

export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const given = req.headers.get('x-revalidate-secret');
  if (!secret || !given) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(secret).digest();
  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  revalidateTag('portfolio', 'max');
  return NextResponse.json({ revalidated: true, tag: 'portfolio' });
}
