const User=require('../../models/userSchema')
const Wallet=require('../../models/walletSchema')

const getWallet=async(req,res,next)=>{
    try {
        let userData = null;
        if (req.session.user) {
            userData = await User.findOne({
                $or: [
                    { _id: req.session.user._id },
                    { _id: req.session.user }
                ]
            });
        }
        
        if (!userData) {
            return res.redirect('/login');
        }
        
        const wallet = await Wallet.findOne({ 'user.email': userData.email });
    
        if (!wallet) {
            const newWallet = new Wallet({
                user: {
                  username: userData.firstname,
                  email: userData.email,
                  password: userData.password || ''
                },
                balance: 0.00
            });
            await newWallet.save();
            return res.render('wallet', {
                userDatas: userData, 
                wallet: newWallet, 
                showAllTransactions: false,
                totalTransactions: 0,
                recentTransactions: [],
                hasMoreTransactions: false
            });
        }
        
        const walletData = wallet.toObject();
        
        if (walletData.transactions && walletData.transactions.length > 0) {
            walletData.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        } else {
            walletData.transactions = [];
        }
        
        const totalTransactions = walletData.transactions.length;
        
        walletData.recentTransactions = walletData.transactions.slice(0, 5);
        walletData.hasMoreTransactions = walletData.transactions.length > 5;

        res.render('wallet', {
            userDatas: userData, 
            wallet: walletData, 
            showAllTransactions: false,
            totalTransactions: totalTransactions
        });
    } catch (error) {
        next(error)
    }
}

const getAllTransactions = async(req, res, next) => {
    try {
        let userData = null;
        if (req.session.user) {
            userData = await User.findOne({
                $or: [
                    { _id: req.session.user._id },
                    { _id: req.session.user }
                ]
            });
        }
        
        if (!userData) {
            return res.redirect('/login');
        }
        
        const wallet = await Wallet.findOne({ 'user.email': userData.email });
        
        if (!wallet) {
            return res.redirect('/wallet');
        }
        
        const walletData = wallet.toObject();
        
        if (walletData.transactions && walletData.transactions.length > 0) {
            walletData.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        } else {
            walletData.transactions = [];
        }
        
        const totalTransactions = walletData.transactions.length;

        res.render('wallet', {
            userDatas: userData,
            wallet: walletData,
            showAllTransactions: true,
            totalTransactions: totalTransactions
        });
    } catch (error) {
        next(error);
    }
}

module.exports={
    getWallet,
    getAllTransactions
}