'use client';

import dynamic from 'next/dynamic';

/** keeps "Xoá tin" (menu + dialog) out of the listing page's first load */
export const ListingDeleteMenuLazy = dynamic(() => import('./ListingDeleteMenu').then((m) => m.ListingDeleteMenu), { ssr: false });
