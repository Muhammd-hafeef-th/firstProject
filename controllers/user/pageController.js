const loadAboutUs = async (req, res, next) => {
    try {
        let userData = null;
        if (req.session.user) {
            userData = req.session.user;
        }
        
        res.render('aboutus', {
            user: userData,
            messages: '',
            cartCount: req.cartCount || 0,
            wishlistCount: req.wishlistCount || 0
        });
    } catch (error) {
        error.message = "Server error " + error.message;
        next(error);
    }
};

const loadContactUs = async (req, res, next) => {
    try {
        let userData = null;
        if (req.session.user) {
            userData = req.session.user;
        }
        
        res.render('contactus', {
            user: userData,
            messages: '',
            cartCount: req.cartCount || 0,
            wishlistCount: req.wishlistCount || 0,
            formSubmitted: false
        });
    } catch (error) {
        error.message = "Server error " + error.message;
        next(error);
    }
};

const submitContactForm = async (req, res, next) => {
    try {
        const { name, email, subject, message } = req.body;
        
      
        
        let userData = null;
        if (req.session.user) {
            userData = req.session.user;
        }
        
        res.render('contactus', {
            user: userData,
            messages: 'Your message has been sent successfully!',
            cartCount: req.cartCount || 0,
            wishlistCount: req.wishlistCount || 0,
            formSubmitted: true
        });
    } catch (error) {
        error.message = "Server error " + error.message;
        next(error);
    }
};

module.exports = {
    loadAboutUs,
    loadContactUs,
    submitContactForm
};
