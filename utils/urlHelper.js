/**
 * URL Helper utility to determine the correct base URL based on environment
 */

// Configuration for different environments
const config = {
  production: {
    baseUrl: "https://lb-lybros.shop"
  },
  development: {
    baseUrl: "http://localhost:3000"
  }
};

/**
 * Get the appropriate base URL based on environment
 * @returns {string} The base URL for the current environment
 */
const getBaseUrl = () => {
  // Check if we're in production by looking at environment variables or hostname
  const isProduction = process.env.NODE_ENV === 'production' || 
                       process.env.FORCE_PRODUCTION === 'true';
  
  return isProduction ? config.production.baseUrl : config.development.baseUrl;
};

/**
 * Get the full URL for a path based on current environment
 * @param {string} path - The path to append to the base URL
 * @returns {string} The full URL
 */
const getFullUrl = (path) => {
  const baseUrl = getBaseUrl();
  // Ensure path starts with a slash
  const formattedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${formattedPath}`;
};

module.exports = {
  getBaseUrl,
  getFullUrl
};
