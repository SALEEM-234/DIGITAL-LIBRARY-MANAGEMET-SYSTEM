const mongoose = require('mongoose');

const IssuedBookSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book" },
  userEmail: String,
  issueDate: Date,
  returnDate: Date,
  fine: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ["Issued","Returned","Overdue"],
    default: "Issued"
  }
});

module.exports = mongoose.model("IssuedBook", IssuedBookSchema);