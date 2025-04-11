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
        const wallet = await Wallet.findOne({ 'user.email': userData.email });
    
    if (!wallet) {
    
      const newWallet = new Wallet({
        user: {
          username: req.user.firstname,
          email: req.user.email,
          password: req.user.password 
        },
        balance: 0.00
      });
      await newWallet.save();
      return res.render('wallet',{userDatas:userData,wallet:newWallet})
    }


        res.render('wallet',{userDatas:userData,wallet:wallet});
    } catch (error) {
        next(error)
    }
}

module.exports={
    getWallet
}