

const loadHomepage=async (req,res)=>{
    try {
        return res.render('home');
    } catch (error) {
        console.log('Home page is not found');
        res.status(500).send('Server error')
    }
}

const pageNotFound=async(req,res)=>{
    try {
        res.render('page-404')
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}

module.exports={
    loadHomepage,
    pageNotFound,
}