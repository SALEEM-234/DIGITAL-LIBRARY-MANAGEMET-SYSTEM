const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const fs = require('fs');
const bcrypt = require("bcryptjs");
const multer = require('multer'); 
 // 🔥 ONCE ONLY


const app = express();


// 🔥 MODELS - TOP LO IMPORT
const User = require("./models/User");
const Book = require("./models/Book");
const IssuedBook = require("./models/IssuedBook");
const Request = require("./models/Request");




// MIDDLEWARE
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname,"uploads")));


// UPLOADS
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
// MULTER
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });


// MONGO
mongoose.connect("mongodb://127.0.0.1:27017/libraryDB")
  .then(()=>console.log("✅ DB OK"))
  .catch(e=>console.log("❌ DB ERROR"));


// 🔥 ALL ROUTES - NO EXTERNAL IMPORTS


// 1. BOOKS - GET ALL
app.get("/api/books", async (req, res) => {
  try {
    const books = await Book.find({});
    const issued = await IssuedBook.find({
      status: { $in: ["Issued", "Overdue"] }
    });

    const now = new Date();

    const result = books.map(book => {
      const issuedList = issued.filter(
        i => i.bookId.toString() === book._id.toString()
      );

      let fine = 0;
      let userEmail = null;
      let issueDate = null;
      let returnDate = null;
      let status = book.availableCopies > 0 ? "Available" : "Issued";

      if (issuedList.length > 0) {
        const latest = issuedList[issuedList.length - 1];
        userEmail = latest.userEmail || null;
        issueDate = latest.issueDate || null;
        returnDate = latest.returnDate || null;

        issuedList.forEach(i => {
          if (i.returnDate) {
            const due = new Date(i.returnDate);
            if (now > due) {
              const days = Math.floor((now - due) / (1000 * 60 * 60 * 24));
              if (days > 0) {
                fine += days * 5;
                status = "Overdue";
              }
            }
          }
        });
      }

      return {
        ...book.toObject(),
        issuedCount: issuedList.length,
        availableCopies: book.availableCopies,
        userEmail,
        issueDate,
        returnDate,
        fine,
        status
      };
    });

    res.json(result);
  } catch (err) {
    console.log(err);
    res.json([]);
  }
});

// 2. ADD BOOK
// ADD BOOK
app.post("/api/books", upload.single("pdf"), async (req, res) => {
  try {
    const { title, author, quantity } = req.body;

    const qty = Math.max(1, Number(quantity) || 1);

    const book = new Book({
      title: title.trim(),
      author: author.trim(),
      quantity: qty,
      availableCopies: qty,
      status: "Available",
      pdf: req.file ? req.file.path.replace(/\\/g, "/") : null
    });

    await book.save();

    res.json({
      success: true,
      message: "✅ Book added successfully",
      book
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});


// 3. DELETE BOOK
app.delete('/api/books/:id', async (req, res) => {
  try {
    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book) return res.json({ success: false, message: 'Book not found' });
    if (book.pdf && fs.existsSync(book.pdf)) fs.unlinkSync(book.pdf);
    res.json({ success: true, message: '✅ Book deleted!' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});


// ISSUE BOOK
app.post("/api/books/:id/issue", async (req, res) => {
  try {
    const { userEmail, issueDate, returnDate } = req.body;

    if (!userEmail || !issueDate || !returnDate) {
      return res.json({ success: false, message: "All fields are required" });
    }

    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.json({ success: false, message: "Book not found" });
    }

    if (book.availableCopies <= 0) {
      return res.json({ success: false, message: "No copies available" });
    }

    const alreadyIssued = await IssuedBook.findOne({
      bookId: book._id,
      userEmail,
      status: { $in: ["Issued", "Overdue"] }
    });

    if (alreadyIssued) {
      return res.json({ success: false, message: "This user already has this book" });
    }

    await IssuedBook.create({
      bookId: book._id,
      userEmail,
      issueDate: new Date(issueDate),
      returnDate: new Date(returnDate),
      status: "Issued",
      fine: 0
    });

    book.availableCopies -= 1;
    book.status = book.availableCopies > 0 ? "Available" : "Issued";
    await book.save();

    res.json({ success: true, message: "✅ Book issued successfully" });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});// 5. RETURN BOOK - Updated for returnDate
// RETURN BOOK
app.put("/api/books/:id/return", async (req, res) => {
  try {
    const { userEmail } = req.body || {};

    if (!userEmail) {
      return res.json({ success: false, message: "User email is required" });
    }

    const issue = await IssuedBook.findOne({
      bookId: req.params.id,
      userEmail,
      status: { $in: ["Issued", "Overdue"] }
    }).sort({ createdAt: -1 });

    if (!issue) {
      return res.json({ success: false, message: "No issued record found" });
    }

    issue.status = "Returned";
    issue.fine = 0;
    await issue.save();

    const book = await Book.findById(req.params.id);
    if (book) {
      book.availableCopies = Math.min(book.availableCopies + 1, book.quantity);
      book.status = book.availableCopies > 0 ? "Available" : "Issued";
      await book.save();
    }

    res.json({ success: true, message: "✅ Returned successfully" });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});
// 7. USER LOGIN
app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
   
    if (!user) return res.json({ success: false, message: "User not found" });
   
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.json({ success: false, message: "Wrong password" });
   
    res.json({
      success: true,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.json({ success: false, message: "Server error" });
  }
});
// USER MY BOOKS
app.get("/api/users/:email/books", async (req,res)=>{
  try{
    const now = new Date();

    // 🔹 only books issued to this user
    const issued = await IssuedBook.find({
      userEmail:req.params.email,
      status: { $in: ["Issued","Overdue"] }
    });

    const books = await Book.find({
      _id: { $in: issued.map(i => i.bookId) }
    });

    const result = books.map(b=>{
      const i = issued.find(x => x.bookId.toString() === b._id.toString());

      let fine = 0;
      let status = i.status;

      // 🔹 check overdue
      if(i.returnDate){
        const returnDate = new Date(i.returnDate);
        if(now > returnDate){
          const days = Math.floor((now - returnDate)/(1000*60*60*24));
          fine = days * 5;
          status = "Overdue";
        }
      } 

      return {
        ...b.toObject(),
        issueDate: i.issueDate,
        returnDate: i.returnDate,
        status,
        fine
      };
    });

    res.json(result);

  }catch(err){
    res.json([]);
  }
});
// 8. USERS COUNT
app.get('/api/users/count', async (req, res) => {
  try {
    const count = await User.countDocuments({ role: "user" });
    res.json({ count });
  } catch (error) {
    res.json({ count: 0 });
  }
});


// 9. ALL USERS (Admin)
app.get('/api/users/all', async (req, res) => {
  try {
    const users = await User.find({ role: "user" });
    res.json(users);
  } catch (error) {
    res.json([]);
  }
});


// 10. DELETE USER
app.delete('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.json({ success: false, message: "User not found" });
    res.json({ success: true, message: "✅ User deleted!" });
  } catch (error) {
    res.json({ success: false, message: "Delete failed" });
  }
});


// 11. CHANGE PASSWORD
app.put('/api/users/change-password', async (req, res) => {
  try {
    const { email, oldPassword, newPassword } = req.body;
    const user = await User.findOne({ email });
   
    if (!user) return res.json({ success: false, message: 'User not found' });
    const isMatch = await bcrypt.compare(oldPassword, user.password);
   
    if (!isMatch) return res.json({ success: false, message: 'Wrong password' });
   
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ success: true, message: '✅ Password changed!' });
  } catch (error) {
    res.json({ success: false, message: 'Server error' });
  }
});
// PAY FINE
// PAY FINE
app.put("/api/books/:id/pay-fine", async (req, res) => {
  try {
    const { userEmail } = req.body || {};

    const issue = await IssuedBook.findOne({
      bookId: req.params.id,
      userEmail,
      status: { $in: ["Issued", "Overdue"] }
    }).sort({ createdAt: -1 });

    if (!issue) {
      return res.json({ success: false, message: "No fine pending" });
    }

    issue.fine = 0;
    issue.status = "Returned";
    await issue.save();

    const book = await Book.findById(req.params.id);
    if (book) {
      book.availableCopies = Math.min(book.availableCopies + 1, book.quantity);
      book.status = book.availableCopies > 0 ? "Available" : "Issued";
      await book.save();
    }

    res.json({ success: true, message: "✅ Fine paid and book returned" });
  } catch (error) {
    res.json({ success: false, message: "Payment failed" });
  }
});
// 🔥 REQUEST BOOK
app.post("/api/request", async (req,res)=>{
 try{
   const {bookId, userEmail} = req.body;

   const exists = await Request.findOne({
     bookId,
     userEmail,
     status:"Pending"
   });

   if(exists){
     return res.json({success:false,message:"Already requested"});
   }

   await Request.create({bookId,userEmail});

   res.json({success:true,message:"✅ Request sent"});
 }catch(err){
   res.json({success:false,message:err.message});
 }
});

// 🔥 GET REQUESTS (ADMIN)
app.get("/api/request", async (req,res)=>{
 try{
   const data = await Request.find({status:"Pending"});
   res.json(data);
 }catch{
   res.json([]);
 }
});

// 🔥 APPROVE REQUEST
// APPROVE REQUEST
app.put("/api/request/:id", async (req, res) => {
  try {
    const r = await Request.findById(req.params.id);
    if (!r) {
      return res.json({ success: false, message: "Request not found" });
    }

    if (r.status === "Approved") {
      return res.json({ success: false, message: "Request already approved" });
    }

    const book = await Book.findById(r.bookId);
    if (!book) {
      return res.json({ success: false, message: "Book not found" });
    }

    if (book.availableCopies <= 0) {
      return res.json({ success: false, message: "No copies available" });
    }

    const alreadyIssued = await IssuedBook.findOne({
      bookId: r.bookId,
      userEmail: r.userEmail,
      status: { $in: ["Issued", "Overdue"] }
    });

    if (alreadyIssued) {
      return res.json({ success: false, message: "User already has this book" });
    }

    const now = new Date();
    const due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await IssuedBook.create({
      bookId: r.bookId,
      userEmail: r.userEmail,
      issueDate: now,
      returnDate: due,
      status: "Issued",
      fine: 0
    });

    book.availableCopies -= 1;
    book.status = book.availableCopies > 0 ? "Available" : "Issued";
    await book.save();

    r.status = "Approved";
    await r.save();

    res.json({ success: true, message: "✅ Request approved and book issued" });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});
// ✅ USER REGISTER (ADD THIS)
app.post('/api/users/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Force role = "user" - ignore frontend role
    await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: await bcrypt.hash(password, 10),
      role: "user"  // ← HARD CODED - safe
    });
    
    res.json({ success: true, message: "✅ Registered Successfully!" });
  } catch (error) {
    res.json({ success: false, message: "Server error" });
  }
});
// ALL ISSUED BOOKS LIST
app.get("/api/issued-books", async (req, res) => {
  try {
    const issued = await IssuedBook.find({
      status: { $in: ["Issued", "Overdue"] }
    }).sort({ issueDate: -1 });

    const result = [];

    for (const item of issued) {
      const book = await Book.findById(item.bookId);

      if (!book) continue;

      const now = new Date();
      let fine = 0;
      let status = item.status;

      if (item.returnDate) {
        const due = new Date(item.returnDate);
        if (now > due) {
          const days = Math.floor((now - due) / (1000 * 60 * 60 * 24));
          if (days > 0) {
            fine = days * 5;
            status = "Overdue";
          }
        }
      }

      result.push({
        issueId: item._id,
        bookId: book._id,
        title: book.title,
        author: book.author,
        userEmail: item.userEmail,
        issueDate: item.issueDate,
        returnDate: item.returnDate,
        status,
        fine
      });
    }

    res.json(result);
  } catch (err) {
    res.json([]);
  }
});
// SERVE HTML
app.get("/", (req,res)=>{
  res.sendFile(path.join(__dirname, "public", "mern.html"));
});


app.listen(5000, ()=>console.log("✅ Server: http://localhost:5000")); 