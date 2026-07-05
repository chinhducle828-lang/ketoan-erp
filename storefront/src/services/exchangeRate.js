// Exchange rate service - fetches VND/USD rate from Fixer API
// API key: bc2dab9568cd48d859d8e803c4be6f30

const API_KEY = import.meta.env.VITE_EXCHANGE_RATE_API_KEY || 'bc2dab9568cd48d859d8e803c4be6f30';
// Fixer API: base EUR, get VND rate, then convert to USD rate
const API_URL = `https://data.fixer.io/api/latest?access_key=${API_KEY}&base=EUR&symbols=VND,USD`;

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
    // Return default rate (1 USD = 24000 VND) as fallback
    return 24000;
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