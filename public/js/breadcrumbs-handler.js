/**
 * Breadcrumbs Handler Script
 * 
 * This script automatically inserts breadcrumbs after any header element
 * if breadcrumbs are not already present on the page.
 */

document.addEventListener('DOMContentLoaded', function() {
    // Check if breadcrumbs already exist on the page
    const existingBreadcrumbs = document.querySelector('[aria-label="Breadcrumb"]');
    
    if (!existingBreadcrumbs) {
        // Find the header element
        const header = document.querySelector('header');
        
        if (header) {
            // Create sticky wrapper for breadcrumbs
            const stickyWrapper = document.createElement('div');
            stickyWrapper.className = 'sticky top-[80px] z-40';
            
            // Create breadcrumbs container
            const breadcrumbsContainer = document.createElement('nav');
            breadcrumbsContainer.setAttribute('aria-label', 'Breadcrumb');
            breadcrumbsContainer.className = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 bg-[#252525] border-b border-gray-800 shadow-sm';
            
            // Get current path
            const path = window.location.pathname;
            
            // Skip for home page
            if (path === '/') {
                return;
            }
            
            // Build breadcrumbs HTML
            let breadcrumbsHTML = `
                <ol class="flex flex-wrap items-center space-x-1 text-sm">
                    <li>
                        <a href="/" class="flex items-center text-gray-300 hover:text-[#FFB568] transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                        </a>
                    </li>
            `;
            
            // Split the path into segments
            const segments = path.split('/').filter(segment => segment !== '');
            
            // Define checkout flow paths and their order
            const checkoutFlow = ['cart', 'checkout', 'proceed-payment', 'paymentSuccess'];
            
            // Check if current path is part of the checkout flow
            const isCheckoutFlow = checkoutFlow.includes(segments[0]);
            
            if (isCheckoutFlow) {
                // For checkout flow, show the complete path
                const currentSegmentIndex = checkoutFlow.indexOf(segments[0]);
                
                // Add all previous steps in the checkout flow
                for (let i = 0; i <= currentSegmentIndex; i++) {
                    const segment = checkoutFlow[i];
                    const currentPath = `/${segment}`;
                    
                    // Format the label
                    let label = segment
                        .replace(/-/g, ' ')
                        .replace(/\b\w/g, char => char.toUpperCase());
                        
                    // Special cases
                    if (segment === 'proceed-payment') {
                        label = 'Payment';
                    } else if (segment === 'paymentSuccess') {
                        label = 'Success';
                    }
                    
                    // Add to breadcrumbs
                    const isLast = i === currentSegmentIndex;
                    
                    breadcrumbsHTML += `
                        <li class="flex items-center">
                            <span class="text-gray-500 mx-1">/</span>
                            ${isLast 
                                ? `<span class="text-[#FFB568] font-medium">${label}</span>` 
                                : `<a href="${currentPath}" class="text-gray-300 hover:text-[#FFB568] transition-colors">${label}</a>`
                            }
                        </li>
                    `;
                }
            } else {
                // For regular navigation, build breadcrumbs based on current path
                let currentPath = '';
                
                segments.forEach((segment, index) => {
                    currentPath += `/${segment}`;
                    
                    // Format the label (capitalize and replace hyphens with spaces)
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
                    }
                    
                    const isLast = index === segments.length - 1;
                    
                    // Add to breadcrumbs
                    breadcrumbsHTML += `
                        <li class="flex items-center">
                            <span class="text-gray-500 mx-1">/</span>
                            ${isLast 
                                ? `<span class="text-[#FFB568] font-medium">${label}</span>` 
                                : `<a href="${currentPath}" class="text-gray-300 hover:text-[#FFB568] transition-colors">${label}</a>`
                            }
                        </li>
                    `;
                });
            }
            
            breadcrumbsHTML += '</ol>';
            
            // Set the HTML content
            breadcrumbsContainer.innerHTML = breadcrumbsHTML;
            
            // Add breadcrumbs to sticky wrapper
            stickyWrapper.appendChild(breadcrumbsContainer);
            
            // Insert sticky wrapper with breadcrumbs after header
            header.insertAdjacentElement('afterend', stickyWrapper);
        }
    }
});
