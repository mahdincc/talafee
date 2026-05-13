/**
 * Talafee Gold Price API Client
 * Connects to the crawler-service API for real-time gold prices
 */

const TalafeeAPI = (function () {
  'use strict';

  function resolveDefaultBaseUrl() {
    if (typeof window === 'undefined') return '/api/v1';
    const { protocol, hostname } = window.location;
    if (protocol === 'file:') return 'http://localhost:3001/api/v1';
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3001/api/v1';
    }
    // Production / any other host: same-origin path (nginx-proxied)
    return '/api/v1';
  }

  const DEFAULT_CONFIG = {
    baseUrl: resolveDefaultBaseUrl(),
    timeout: 10000,
    retryAttempts: 3,
    retryDelay: 1000,
    pollInterval: 30000,
  };

  let config = { ...DEFAULT_CONFIG };
  let pollTimer = null;
  let listeners = {
    prices: [],
    error: [],
    health: [],
  };

  /**
   * Initialize the API client
   * @param {Object} options - Configuration options
   */
  function init(options = {}) {
    config = { ...DEFAULT_CONFIG, ...options };
    console.log('[TalafeeAPI] Initialized with config:', config);
  }

  /**
   * Make an API request with retry logic
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} - API response
   */
  async function request(endpoint, options = {}) {
    const url = `${config.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    const fetchOptions = {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    let lastError;

    for (let attempt = 1; attempt <= config.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.success && data.error) {
          throw new Error(data.error);
        }

        return data;
      } catch (error) {
        lastError = error;

        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }

        if (attempt < config.retryAttempts) {
          console.warn(`[TalafeeAPI] Retry ${attempt}/${config.retryAttempts}:`, error.message);
          await sleep(config.retryDelay * attempt);
        }
      }
    }

    throw lastError;
  }

  /**
   * Sleep for a given number of milliseconds
   * @param {number} ms - Milliseconds to sleep
   */
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get all current prices
   * @returns {Promise<Array>} - Array of prices
   */
  async function getAllPrices() {
    const response = await request('/prices');
    return response.data;
  }

  /**
   * Get prices grouped by product
   * @returns {Promise<Object>} - Prices grouped by product ID
   */
  async function getPricesByProduct() {
    const response = await request('/prices/by-product');
    return response.data;
  }

  /**
   * Get prices grouped by provider
   * @returns {Promise<Object>} - Prices grouped by provider ID
   */
  async function getPricesByProvider() {
    const response = await request('/prices/by-provider');
    return response.data;
  }

  /**
   * Get prices for a specific product
   * @param {string} productId - Product ID (e.g., '18k-gold', 'emami-coin')
   * @returns {Promise<Object>} - Product prices with best price info
   */
  async function getProductPrices(productId) {
    const response = await request(`/prices/${productId}`);
    return response;
  }

  /**
   * Get price comparison for a product
   * @param {string} productId - Product ID
   * @returns {Promise<Object>} - Detailed comparison with spreads
   */
  async function compareProductPrices(productId) {
    const response = await request(`/prices/compare/${productId}`);
    return response;
  }

  /**
   * Get prices from a specific provider
   * @param {string} providerId - Provider ID
   * @returns {Promise<Array>} - Provider's prices
   */
  async function getProviderPrices(providerId) {
    const response = await request(`/prices/provider/${providerId}`);
    return response.data;
  }

  /**
   * Get price history
   * @param {string} providerId - Provider ID
   * @param {string} productId - Product ID
   * @param {number} hours - Hours of history (default: 24)
   * @returns {Promise<Object>} - Price history with stats
   */
  async function getPriceHistory(providerId, productId, hours = 24) {
    const response = await request(`/history/${providerId}/${productId}?hours=${hours}`);
    return response;
  }

  /**
   * Get system health status
   * @returns {Promise<Object>} - Health status
   */
  async function getHealth() {
    const response = await request('/health');
    return response;
  }

  /**
   * Get provider health status
   * @returns {Promise<Array>} - Provider health statuses
   */
  async function getProvidersHealth() {
    const response = await request('/health/providers');
    return response.providers;
  }

  /**
   * Get trust ranking of all providers
   * @returns {Promise<Object>} - Trust ranking data
   */
  async function getTrustRanking() {
    const response = await request('/trust/ranking');
    return response;
  }

  /**
   * Get trust score for a specific provider
   * @param {string} providerId - Provider ID
   * @returns {Promise<Object>} - Provider trust score
   */
  async function getTrustScore(providerId) {
    const response = await request(`/trust/scores/${providerId}`);
    return response;
  }

  /**
   * Get badges for a provider
   * @param {string} providerId - Provider ID
   * @returns {Promise<Object>} - Provider badges
   */
  async function getProviderBadges(providerId) {
    const response = await request(`/trust/badges/${providerId}`);
    return response;
  }

  /**
   * Trigger a manual price crawl
   * @returns {Promise<Object>} - Crawl status
   */
  async function triggerCrawl() {
    const response = await request('/health/crawl', { method: 'POST' });
    return response;
  }

  /**
   * Start polling for price updates
   * @param {Function} callback - Callback function for price updates
   * @param {number} interval - Poll interval in ms (optional)
   */
  function startPolling(callback, interval) {
    if (pollTimer) {
      stopPolling();
    }

    const pollInterval = interval || config.pollInterval;

    async function poll() {
      try {
        const prices = await getPricesByProduct();
        callback(prices, null);
        notifyListeners('prices', prices);
      } catch (error) {
        callback(null, error);
        notifyListeners('error', error);
      }
    }

    poll();
    pollTimer = setInterval(poll, pollInterval);

    console.log(`[TalafeeAPI] Started polling every ${pollInterval}ms`);
  }

  /**
   * Stop polling for price updates
   */
  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
      console.log('[TalafeeAPI] Stopped polling');
    }
  }

  /**
   * Add event listener
   * @param {string} event - Event type ('prices', 'error', 'health')
   * @param {Function} callback - Callback function
   */
  function on(event, callback) {
    if (listeners[event]) {
      listeners[event].push(callback);
    }
  }

  /**
   * Remove event listener
   * @param {string} event - Event type
   * @param {Function} callback - Callback function
   */
  function off(event, callback) {
    if (listeners[event]) {
      listeners[event] = listeners[event].filter((cb) => cb !== callback);
    }
  }

  /**
   * Notify event listeners
   * @param {string} event - Event type
   * @param {*} data - Event data
   */
  function notifyListeners(event, data) {
    if (listeners[event]) {
      listeners[event].forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[TalafeeAPI] Listener error for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Format price for display
   * @param {number} price - Price in Rials
   * @param {string} locale - Locale (default: 'fa-IR')
   * @returns {string} - Formatted price
   */
  function formatPrice(price, locale = 'fa-IR') {
    return new Intl.NumberFormat(locale, {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  }

  /**
   * Format price with Toman conversion
   * @param {number} priceInRials - Price in Rials
   * @param {string} locale - Locale
   * @returns {string} - Formatted price in Tomans
   */
  function formatPriceToman(priceInRials, locale = 'fa-IR') {
    const tomans = Math.round(priceInRials / 10);
    return formatPrice(tomans, locale);
  }

  /**
   * Get best price for a product
   * @param {Array} prices - Array of prices
   * @param {string} type - 'buy' or 'sell' (default: 'sell')
   * @returns {Object|null} - Best price object
   */
  function getBestPrice(prices, type = 'sell') {
    if (!prices || prices.length === 0) return null;

    return prices.reduce((best, current) => {
      const currentPrice = type === 'buy' ? current.buyPrice : current.sellPrice;
      const bestPrice = type === 'buy' ? best.buyPrice : best.sellPrice;

      return type === 'buy'
        ? currentPrice < bestPrice ? current : best
        : currentPrice < bestPrice ? current : best;
    });
  }

  /**
   * Calculate price spread
   * @param {Object} price - Price object
   * @returns {Object} - Spread info
   */
  function calculateSpread(price) {
    const spread = price.buyPrice - price.sellPrice;
    const spreadPercent = (spread / price.sellPrice) * 100;

    return {
      spread,
      spreadPercent,
      spreadFormatted: formatPrice(spread),
      spreadPercentFormatted: spreadPercent.toFixed(2) + '%',
    };
  }

  return {
    init,
    getAllPrices,
    getPricesByProduct,
    getPricesByProvider,
    getProductPrices,
    compareProductPrices,
    getProviderPrices,
    getPriceHistory,
    getHealth,
    getProvidersHealth,
    getTrustRanking,
    getTrustScore,
    getProviderBadges,
    triggerCrawl,
    startPolling,
    stopPolling,
    on,
    off,
    formatPrice,
    formatPriceToman,
    getBestPrice,
    calculateSpread,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TalafeeAPI;
}
