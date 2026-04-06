const router = require("express").Router();
const Book = require("../models/Book");
const multer = require("multer");

const storage = multer.diskStorage({
 destination:"uploads/",
 filename:(req,file,cb)=>{
   cb(null,Date.now()+"-"+file.originalname);
 }
});

const upload = multer({storage});

// GET ALL
router.get("/", async (req,res)=>{
 const books = await Book.find();
 res.json(books);
});

// ADD BOOK
router.post("/", upload.single("pdf"), async (req,res)=>{

 try{

 const book = await Book.create({
   title:req.body.title,
   author:req.body.author,
   pdf:req.file.path,
   status:"Available"
 });

 res.json({success:true,message:"Book Added",book});

 }catch(err){
   res.json({success:false,message:err.message});
 }

});

// DELETE
router.delete("/:id", async (req,res)=>{
 try{
   const book = await Book.findByIdAndDelete(req.params.id);

   if(!book){
     return res.status(404).json({message:"Book not found"});
   }

   res.json({success:true,message:"Deleted"});

 }catch(e){
   res.status(500).json({message:"Server error"});
 }
});

module.exports = router;