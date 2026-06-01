import { useState, useEffect } from 'react';

/**
 * Detects the user's location via IP geolocation and resolves to INR for India, USD otherwise.
 * Caches the result in sessionStorage to avoid repeated API calls within the same browser session.
 * Falls back silently to INR on any error (network, rate limit, etc.) to keep India users unbroken.
 */
export function useGeoLocation(): { currency: 'INR' | 'USD'; isLoading: boolean } {
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Effects don't run under SSR but guard anyway in case this hook is called from
    // a code path that does any pre-render-side state seeding.
    if (typeof window === 'undefined') return;

    // Check sessionStorage first — avoid repeated geo calls within the same session
    const cached = sessionStorage.getItem('geo_currency');
    if (cached === 'INR' || cached === 'USD') {
      setCurrency(cached);
      setIsLoading(false);
      return;
    }

    // Fetch geolocation from ip-api.com. HTTP endpoint has no server-side rate limit from browser IPs.
    // CORS is allowed with Access-Control-Allow-Origin: *
    const fetchGeo = async () => {
      try {
        const response = await fetch('http://ip-api.com/json/?fields=countryCode', {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as { countryCode: string };
        const detected = data.countryCode === 'IN' ? 'INR' : 'USD';
        sessionStorage.setItem('geo_currency', detected);
        setCurrency(detected);
      } catch (error) {
        // Silent fallback to INR on any error — network, DNS, timeout, CORS, etc.
        // This keeps India users (the main audience) unbroken even if the geo service fails.
        console.warn('Geo-detection failed, defaulting to INR:', error);
        sessionStorage.setItem('geo_currency', 'INR');
        setCurrency('INR');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGeo();
  }, []);

  return { currency, isLoading };
}
