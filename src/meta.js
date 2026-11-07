import { useEffect } from 'react';
import { LIGHT_LABEL } from './data/products.js';

const SITE = 'Fernhouse Plant Co.';
export const DEFAULT_TITLE = `${SITE} - Houseplants for the light you have`;
export const DEFAULT_DESCRIPTION =
  'Fernhouse Plant Co. - houseplants matched to the light you actually have. Filter by light, size and pet safety.';

function setMeta(selector, attr, key, value) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

/** Sets the title, description and Open Graph tags for the current page. */
export function useDocumentMeta({ title, description = DEFAULT_DESCRIPTION, noindex = false }) {
  useEffect(() => {
    document.title = title;
    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    setMeta('meta[property="og:url"]', 'property', 'og:url', window.location.origin + window.location.pathname);
    let robots = document.head.querySelector('meta[name="robots"]');
    if (noindex) {
      if (!robots) {
        robots = document.createElement('meta');
        robots.setAttribute('name', 'robots');
        document.head.appendChild(robots);
      }
      robots.setAttribute('content', 'noindex, nofollow');
    } else if (robots) {
      robots.remove();
    }
  }, [title, description, noindex]);
}

/** schema.org Product data for the catalog, so search engines can show prices and availability. */
export function useProductJsonLd(products) {
  useEffect(() => {
    if (!products.length) return undefined;
    const base = window.location.origin + import.meta.env.BASE_URL;
    const data = {
      '@context': 'https://schema.org',
      '@graph': products.map((p) => ({
        '@type': 'Product',
        '@id': `${base}#${p.id}`,
        name: p.name,
        description: p.description,
        image: p.image,
        sku: p.id,
        brand: { '@type': 'Brand', name: SITE },
        additionalProperty: [
          { '@type': 'PropertyValue', name: 'Light', value: LIGHT_LABEL[p.light] || p.light },
          { '@type': 'PropertyValue', name: 'Pet safe', value: p.petSafe ? 'Yes' : 'No' },
        ],
        ...(p.reviews > 0 && p.rating > 0
          ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating, reviewCount: p.reviews } }
          : {}),
        offers: {
          '@type': 'Offer',
          url: base,
          priceCurrency: 'USD',
          price: p.price.toFixed(2),
          availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
          seller: { '@type': 'Organization', name: SITE },
        },
      })),
    };
    let el = document.getElementById('ld-products');
    if (!el) {
      el = document.createElement('script');
      el.id = 'ld-products';
      el.type = 'application/ld+json';
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
    return undefined;
  }, [products]);
}
