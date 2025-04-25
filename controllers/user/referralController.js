const User = require('../../models/userSchema');
const Wallet = require('../../models/walletSchema');

const generateReferralCode = (firstName) => {
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    const namePrefix = firstName.substring(0, Math.min(3, firstName.length)).toUpperCase();
    return `${namePrefix}${randomPart}`;
};

const addReferralBonus = async (userId, amount, description) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            console.error('User not found for referral bonus');
            return false;
        }

        let wallet = await Wallet.findOne({ 'user.email': user.email });
        
        if (!wallet) {
            wallet = new Wallet({
                user: {
                    username: user.firstname,
                    email: user.email,
                    password: user.password
                },
                balance: amount
            });
        } else {
            wallet.balance += amount;
        }

        wallet.transactions.push({
            amount: amount,
            type: 'referal', 
            description: description,
            status: 'completed',
            date: new Date()
        });

        await wallet.save();
        return true;
    } catch (error) {
        console.error('Error adding referral bonus:', error);
        return false;
    }
};

const getUserReferralDetails = async (req, res, next) => {
    try {
        let userData = null;
        if (req.session.user) {
            userData = await User.findOne({
                $or: [
                    { _id: req.session.user._id },
                    { _id: req.session.user }
                ]
            }).populate('redeemedUsers');
        }
        
        if (!userData) {
            return res.redirect('/login');
        }
        
        res.render('referrals', {
            userDatas: userData,
            referralCode: userData.referalCode || 'No referral code found',
            referralCount: userData.redeemedUsers ? userData.redeemedUsers.length : 0,
            referredUsers: userData.redeemedUsers || []
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    generateReferralCode,
    addReferralBonus,
    getUserReferralDetails
}; 