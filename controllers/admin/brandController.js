const Brand=require('../../models/brandSchema')



const brandInfo=async (req,res)=>{
    try {
        const page=parseInt(req.query.page)||1
        const limit=5 ;
        const skip=(page-1)*limit;

        const  brandData=await Brand.find({})
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit);

        const totalBrand=await Brand.countDocuments();
        const totalPages=Math.ceil(totalBrand/limit);
        res.render('brand',{
            brands:brandData,
            currentPage:page,
            totalPages:totalPages,
            totalBrands:totalBrand
        });
    } catch (error) {
        console.log("Something error in brandinfo",error)
        res.redirect("/pageError")
    }
}

const addBrand=async (req,res)=>{

    const {image,name,description}=req.body;
        try {
            const existionBrand=await Brand.findOne({name});
            if(existionBrand){
                return res.status(400).json({error:"Brand Already exists"})
            }
            const newBrand=new Brand({
                image,
                name,
                description
            })
            await newBrand.save();
            res.json({message:"Brand added succesfully"})
            res.redirect('/bran')
        } catch (error) {
            res.status(500).json({error:"Internal Server error"})

        }
   
}
const addBrandItem=async (req,res)=>{
    try {
        res.render("addBrand")
    } catch (error) {
        console.log("something error in adding brand")
    }
}

module.exports={
    brandInfo,
    addBrand,
    addBrandItem
}