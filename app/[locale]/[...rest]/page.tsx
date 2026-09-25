import { notFound } from 'next/navigation';

/** Any unknown path under a locale → localized 404 */
export default function CatchAll() {
  notFound();
}
