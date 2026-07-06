// Exchange rate service - fetches VND/USD rate from Fixer API

const API_KEY = import.meta.env.VITE_EXCHANGE_RATE_API_KEY || '';
const DEFAULT_EXCHANGE_RATE = Number(import.meta.env.VITE_DEFAULT_EXCHANGE_RATE || 24000);
// Fixer API: base EUR, get VND rate, then convert to USD rate
const API_URL = API_KEY
  ? `https://data.fixer.io/api/latest?access_key=${API_KEY}&base=EUR&symbols=VND,USD`
  : null;

// Cache key for localStorage
const CACHE_KEY = 'exchange_rate_vnd_usd';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Get cached exchange rate
const getCachedRate = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const { rate, timestamp } = JSON.parse(cached);
    const now = Date.now();
    
    // Return cached rate if not expired
    if (now - timestamp < CACHE_DURATION) {
      return rate;
    }
    
    // Clear expired cache
    localStorage.removeItem(CACHE_KEY);
    return null;
  } catch {
    return null;
  }
};

// Save exchange rate to cache
const saveRateToCache = (rate) => {
  try {
    const cacheData = {
      rate,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch {
    // Ignore cache errors
  }
};

// Fetch exchange rate from API
export const fetchExchangeRate = async () => {
  // Return cached rate if available
  const cachedRate = getCachedRate();
  if (cachedRate) {
    return cachedRate;
  }

  if (!API_URL) {
    return DEFAULT_EXCHANGE_RATE;
  }

  try {
    const response = await fetch(API_URL);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Fixer API returns rates with base EUR
    // rates.VND = 1 EUR = X VND
    // rates.USD = 1 EUR = X USD
    // To get USD to VND rate: VND_rate / USD_rate = 1 USD = X VND
    const vndRate = data?.rates?.VND;
    const usdRate = data?.rates?.USD;
    
    if (vndRate && usdRate && typeof vndRate === 'number' && typeof usdRate === 'number' && usdRate > 0) {
      const usdToVndRate = vndRate / usdRate;
      saveRateToCache(usdToVndRate);
      return usdToVndRate;
    }
    
    throw new Error('Invalid rate data from API');
  } catch (error) {
    console.error('Failed to fetch exchange rate:', error);
    // Return the configured fallback rate when the remote API is unavailable
    return DEFAULT_EXCHANGE_RATE;
  }
};

// Convert price from VND to target currency
export const convertPrice = (priceVND, targetCurrency, exchangeRate) => {
  if (targetCurrency === 'VND') {
    return priceVND;
  }
  
  if (targetCurrency === 'USD' && exchangeRate > 0) {
    return priceVND / exchangeRate;
  }
  
  return priceVND;
};

export default { fetchExchangeRate, convertPrice };