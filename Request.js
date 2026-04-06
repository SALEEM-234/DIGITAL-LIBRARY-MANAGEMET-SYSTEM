const mongoose = require('mongoose');

const RequestSchema = new mongoose.Schema({
  bookId: String,
  userEmail: String,
  status: {
    type: String,
    enum: ["Pending","Approved"],
    default: "Pending"
  }
});

module.exports = mongoose.model("Request", RequestSchema);