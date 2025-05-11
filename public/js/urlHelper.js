/**
 * Frontend URL Helper
 * Detects the current environment and provides the appropriate base URL
 */

// Function to determine if we're in production or development
function isProduction() {
  // Check if the current hostname is the production domain
  return window.location.hostname === 'lb-lybros.shop' || 
         window.location.hostname.includes('lb-lybros.shop');
}

// Get the base URL based on the environment
function getBaseUrl() {
  if (isProduction()) {
    return 'https://lb-lybros.shop';
  } else {
    return 'http://localhost:3000';
  }
}

// Get a full URL for a path
function getFullUrl(path) {
  const baseUrl = getBaseUrl();
  // Ensure path starts with a slash
  const formattedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${formattedPath}`;
}
