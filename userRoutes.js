const router = require("express").Router();
const mongoose = require("mongoose");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

/* REGISTER */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    let user = await User.findOne({ email });
    if (user) return res.json({ success: false, message: "User already exists" });
    const hashed = await bcrypt.hash(password, 10);
    await User.create({ name, email, password: hashed, role });
    res.json({ success: true, message: "Registered Successfully" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ success: false, message: "Server error during registration" });
  }
});

/* LOGIN */
/* LOGIN - FIXED VERSION */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('🔐 Login attempt:', email); // DEBUG
    
    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(400).json({ success: false, message: "User not found" });
    }
    
    console.log('✅ User found:', user.email, 'Hashed?', !!user.password); // DEBUG
    
    // 🔥 TEMPORARY BYPASS - hashed password lekapothe plain password check
    let isMatch;
    try {
      if (user.password.startsWith('$2b$')) {
        // Hashed password undi
        isMatch = await bcrypt.compare(password, user.password);
      } else {
        // Plain password (old users)
        isMatch = user.password === password;
      }
    } catch(e) {
      isMatch = false;
    }
    
    if (!isMatch) {
      console.log('❌ Invalid password for:', email);
      return res.status(400).json({ success: false, message: "Invalid password" });
    }
    
    console.log('✅ Login success:', user.name);
    res.json({ 
      success: true, 
      user: { 
        _id: user._id,
        name: user.name, 
        email: user.email, 
        role: user.role 
      } 
    });
  } catch(err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


/* GET ALL USERS */
router.get("/all", async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Error fetching users" });
  }
});

// 🔥 NEW COUNT ROUTE
router.get("/count", async (req, res) => {
  try {
    const count = await User.countDocuments({ role: "user" });
    res.json({ count });
  } catch (err) {
    console.error("Error counting users:", err);
    res.status(500).json({ message: "Server Error" });
  }
});




router.delete("/:id", async (req, res) => {
  const id = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(400).json({ message: "Invalid User ID" });

  try {
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "User Not Found" });

    res.json({ success: true, message: "User Deleted Successfully" });
  } catch (err) {
    res.status(500).json({ message: "Delete Failed", error: err.message });
  }
});

module.exports = router;