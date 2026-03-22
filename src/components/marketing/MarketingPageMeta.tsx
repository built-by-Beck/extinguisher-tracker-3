import { useEffect } from 'react';

export type MarketingPageMetaProps = {
  title: string;
  description: string;
  /** Path only, e.g. `/pricing` — combined with `VITE_PUBLIC_SITE_URL` or `window.location.origin` */
  path: string;
};

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    el.setAttribute('data-et-marketing', '1');
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function absoluteUrl(path: string): string {
  const base =
    (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.replace(/\/$/, '') ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  if (!base) {
    return path;
  }
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Sets document title, description, and basic Open Graph / Twitter tags for public marketing routes.
 * Cleans up injected tags on unmount.
 */
export function MarketingPageMeta({ title, description, path }: MarketingPageMetaProps) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:url', absoluteUrl(path));
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);

    return () => {
      document.title = previousTitle;
      document.querySelectorAll('meta[data-et-marketing="1"]').forEach((node) => node.remove());
    };
  }, [title, description, path]);

  return null;
}
