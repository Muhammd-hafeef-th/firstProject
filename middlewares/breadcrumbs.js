

const breadcrumbsMiddleware = (req, res, next) => {
    const path = req.path;
    const breadcrumbs = [];
    
    // Reset breadcrumb history when returning to home page
    if (path === '/') {
        req.session.breadcrumbHistory = [];
    }
    
    // Define main navigation categories
    const mainCategories = [
        'featured', 'products', 'newArrivals', 'mensWatch', 'ladiesWatch', 'couplesWatch',
        'profile', 'cart', 'wishlist', 'orders', 'wallet', 'referrals'
    ];
    
    // Check if current path is a main category
    const currentSegments = path.split('/').filter(segment => segment !== '');
    const isMainCategory = currentSegments.length === 1 && mainCategories.includes(currentSegments[0]);
    
    // If navigating to a main category, reset the history to avoid accumulation
    if (isMainCategory) {
        req.session.breadcrumbHistory = [];
    }
    
    // Store current path in history for sub-pages
    if (path !== '/' && !isMainCategory && req.headers.referer) {
        req.session.breadcrumbHistory = req.session.breadcrumbHistory || [];
        
        // Parse the referer URL to get the path
        const refererUrl = new URL(req.headers.referer);
        const refererPath = refererUrl.pathname;
        
        // Only add to history if it's a different page and it's a relevant page for breadcrumbs
        if (refererPath !== path && isRelevantForBreadcrumbs(refererPath)) {
            // Get the label for the referer path
            const refererSegments = refererPath.split('/').filter(segment => segment !== '');
            let refererLabel = '';
            
            if (refererSegments.length > 0) {
                const lastSegment = refererSegments[refererSegments.length - 1];
                refererLabel = formatLabel(lastSegment);
            } else {
                refererLabel = 'Home';
            }
            
            // Check if this path is already in history
            const existingIndex = req.session.breadcrumbHistory.findIndex(item => item.path === refererPath);
            
            if (existingIndex >= 0) {
                // Remove the existing entry to avoid duplication
                req.session.breadcrumbHistory.splice(existingIndex, 1);
            }
            
            // Add to history
            req.session.breadcrumbHistory.push({
                path: refererPath,
                label: refererLabel,
                query: refererUrl.search
            });
            
            // Keep only the last 3 entries to prevent excessive history
            if (req.session.breadcrumbHistory.length > 3) {
                req.session.breadcrumbHistory.shift();
            }
        }
    }
    
    // Always add Home as the first breadcrumb
    breadcrumbs.push({
        label: 'Home',
        url: '/'
    });
    
    // Skip additional breadcrumbs for home page
    if (path === '/') {
        res.locals.breadcrumbs = breadcrumbs;
        return next();
    }

    const segments = path.split('/').filter(segment => segment !== '');
    
    // Define navigation flows
    const checkoutFlow = ['cart', 'checkout', 'proceed-payment', 'paymentSuccess'];
    const profileFlow = ['profile', 'orders', 'order-details', 'wallet', 'referrals', 'wishlist', 'profile-edit'];
    
    // Check if current path is part of a defined flow
    const isCheckoutFlow = checkoutFlow.includes(segments[0]);
    const isProfileFlow = profileFlow.includes(segments[0]);
    
    // Handle checkout flow
    if (isCheckoutFlow) {
        handleCheckoutFlow(breadcrumbs, segments, checkoutFlow, req);
    } 
    // Handle profile flow
    else if (isProfileFlow) {
        handleProfileFlow(breadcrumbs, segments, req);
    } 
    // Handle regular navigation using history
    else if (req.session.breadcrumbHistory && req.session.breadcrumbHistory.length > 0) {
        handleHistoryBasedNavigation(breadcrumbs, segments, req, path);
    }
    // Fallback to simple path-based breadcrumbs
    else {
        handleSimpleNavigation(breadcrumbs, segments, req);
    }
    
    res.locals.breadcrumbs = breadcrumbs;
    next();
};

// Format label from segment
function formatLabel(segment) {
    let label = segment
        .replace(/-/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
    
    // Special cases for specific routes
    switch (segment) {
        case 'productDetails':
            label = 'Product Details';
            break;
        case 'newArrivals':
            label = 'New Arrivals';
            break;
        case 'mensWatch':
            label = 'Men\'s Watches';
            break;
        case 'ladiesWatch':
            label = 'Ladies Watches';
            break;
        case 'couplesWatch':
            label = 'Couples Watches';
            break;
        case 'editAddress':
        case 'editAddress-checkout':
            label = 'Edit Address';
            break;
        case 'addAddress':
        case 'addAddressCheckout':
            label = 'Add Address';
            break;
        case 'profileNewPassword':
            label = 'Set New Password';
            break;
        case 'forgot-password':
            label = 'Forgot Password';
            break;
        case 'reset-password':
            label = 'Reset Password';
            break;
        case 'paymentSuccess':
            label = 'Payment Success';
            break;
        case 'aboutus':
            label = 'About Us';
            break;
        case 'contactus':
            label = 'Contact Us';
            break;
        case 'order-details':
            label = 'Order Details';
            break;
        case 'orders':
            label = 'My Orders';
            break;
        case 'profile':
            label = 'My Profile';
            break;
        case 'profile-edit':
            label = 'Edit Profile';
            break;
        case 'wishlist':
            label = 'My Wishlist';
            break;
        case 'wallet':
            label = 'My Wallet';
            break;
        case 'referrals':
            label = 'My Referrals';
            break;
        case 'cart':
            label = 'Shopping Cart';
            break;
        case 'checkout':
            label = 'Checkout';
            break;
        case 'proceed-payment':
            label = 'Payment';
            break;
    }
    
    return label;
}

// Handle checkout flow breadcrumbs
function handleCheckoutFlow(breadcrumbs, segments, checkoutFlow, req) {
    const currentSegmentIndex = checkoutFlow.indexOf(segments[0]);
    let currentPath = '';
    
    // Add all previous steps in the checkout flow
    for (let i = 0; i <= currentSegmentIndex; i++) {
        const segment = checkoutFlow[i];
        currentPath = `/${segment}`;
        
        // Format the label
        let label = formatLabel(segment);
        
        // Add to breadcrumbs
        breadcrumbs.push({
            label,
            url: currentPath + (segment === 'paymentSuccess' && req.params.orderId ? `/${req.params.orderId}` : '')
        });
    }
}

// Handle profile flow breadcrumbs
function handleProfileFlow(breadcrumbs, segments, req) {
    // Always add Profile as the second breadcrumb for profile flow
    if (segments[0] !== 'profile') {
        breadcrumbs.push({
            label: 'My Profile',
            url: '/profile'
        });
    }
    
    // For order details, add Orders as an intermediate breadcrumb
    if (segments[0] === 'order-details') {
        breadcrumbs.push({
            label: 'My Orders',
            url: '/orders'
        });
    }
    
    // Add the current page
    let currentPath = '';
    segments.forEach((segment, index) => {
        currentPath += `/${segment}`;
        
        // Only add the current segment if it's not already added
        if ((segment === 'profile' && index === 0) || 
            (segment !== 'profile')) {
            
            const label = formatLabel(segment);
            
            // Handle query parameters
            if (segment === 'order-details' && req.query.id) {
                breadcrumbs.push({
                    label,
                    url: `${currentPath}?id=${req.query.id}`
                });
            } else {
                breadcrumbs.push({
                    label,
                    url: currentPath
                });
            }
        }
    });
}

// Handle navigation based on session history
function handleHistoryBasedNavigation(breadcrumbs, segments, req, currentPath) {
    // Add relevant history items as breadcrumbs
    let historyAdded = new Set();
    
    for (const historyItem of req.session.breadcrumbHistory) {
        // Skip home since it's already added
        if (historyItem.path === '/') continue;
        
        // Skip the current path
        if (historyItem.path === currentPath) continue;
        
        // Get the first segment of the history item
        const historySegments = historyItem.path.split('/').filter(segment => segment !== '');
        if (historySegments.length === 0) continue;
        
        const firstSegment = historySegments[0];
        
        // Add history item if not already added
        if (!historyAdded.has(firstSegment)) {
            breadcrumbs.push({
                label: historyItem.label,
                url: historyItem.path + (historyItem.query || '')
            });
            historyAdded.add(firstSegment);
        }
    }
    
    // Add the current page
    handleSimpleNavigation(breadcrumbs, segments, req);
}

// Handle simple path-based breadcrumbs
// Check if a path is relevant for breadcrumbs
function isRelevantForBreadcrumbs(path) {
    // Skip irrelevant paths that shouldn't be in breadcrumbs
    const irrelevantPaths = [
        '/login', '/signup', '/logout', '/verify-otp', '/resend-otp',
        '/forgot-password', '/reset-password'
    ];
    
    if (irrelevantPaths.includes(path)) {
        return false;
    }
    
    // Get the first segment of the path
    const segments = path.split('/').filter(segment => segment !== '');
    if (segments.length === 0) return false; // Skip home page
    
    return true;
}

function handleSimpleNavigation(breadcrumbs, segments, req) {
    let currentPath = '';
    
    segments.forEach((segment, index) => {
        currentPath += `/${segment}`;
        
        const label = formatLabel(segment);
        
        // Handle query parameters
        if (segment === 'productDetails' && req.query.id) {
            breadcrumbs.push({
                label,
                url: `${currentPath}?id=${req.query.id}`
            });
        } else if (segment === 'order-details' && req.query.id) {
            breadcrumbs.push({
                label,
                url: `${currentPath}?id=${req.query.id}`
            });
        } else {
            breadcrumbs.push({
                label,
                url: currentPath
            });
        }
    });
}

module.exports = breadcrumbsMiddleware;
