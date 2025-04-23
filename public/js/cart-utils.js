// Function to show toast notification
function showToast(message, type = 'success', duration = 3000) {
    // Create toast container if it doesn't exist
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.style.minWidth = '250px';
    toast.style.margin = '0 0 10px 0';
    toast.style.padding = '12px 20px';
    toast.style.color = 'white';
    toast.style.borderRadius = '4px';
    toast.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.justifyContent = 'space-between';
    toast.style.transform = 'translateX(120%)';
    toast.style.transition = 'transform 0.3s ease';
    
    // Set background color based on type
    if (type === 'success') {
        toast.style.backgroundColor = '#10b981';
    } else if (type === 'error') {
        toast.style.backgroundColor = '#ef4444';
    } else {
        toast.style.backgroundColor = '#f59e0b';
    }
    
    // Set content
    toast.innerHTML = `
        <div style="display: flex; align-items: center;">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'exclamation-circle'}" style="margin-right: 10px;"></i>
            <span>${message}</span>
        </div>
        <button style="background: none; border: none; color: white; cursor: pointer; margin-left: 10px;">
            &times;
        </button>
    `;
    
    // Add to container
    container.appendChild(toast);
    
    // Show toast with animation
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 10);
    
    // Add click event to close button
    toast.querySelector('button').addEventListener('click', () => {
        toast.style.transform = 'translateX(120%)';
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 300);
    });
    
    // Auto-remove after duration
    setTimeout(() => {
        if (document.body.contains(toast)) {
            toast.style.transform = 'translateX(120%)';
            setTimeout(() => {
                if (container.contains(toast)) {
                    container.removeChild(toast);
                }
            }, 300);
        }
    }, duration);
}

// Function to show loading overlay
function showLoading() {
    let loadingOverlay = document.getElementById('loadingOverlay');
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loadingOverlay';
        loadingOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        loadingOverlay.innerHTML = `
            <div class="bg-[#252525] p-6 rounded-lg shadow-xl flex flex-col items-center">
                <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#E8B888] mb-4"></div>
                <p class="text-white">Processing...</p>
            </div>
        `;
        document.body.appendChild(loadingOverlay);
    } else {
        loadingOverlay.classList.remove('hidden');
    }
}

// Function to hide loading overlay
function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
    }
}

// Function to add product to cart
function addToCart(productId, quantity = 1) {
    showLoading();
    
    fetch('/addToCart', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({ productId, quantity })
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        
        if (data.success) {
            // Update cart count in navbar if available
            const cartCountElements = document.querySelectorAll('.cart-badge');
            if (cartCountElements.length > 1 && data.cartCount !== undefined) {
                cartCountElements[1].textContent = data.cartCount;
            }
            
            showToast(data.message, 'success');
        } else {
            throw new Error(data.message);
        }
    })
    .catch(err => {
        hideLoading();
        showToast(err.message || 'Unable to add to cart', 'error');
    });
    
    return false; // Prevent default link behavior
} 