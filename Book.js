// models/Book.js
const mongoose = require("mongoose");

const BookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    author: {
      type: String,
      required: true,
      trim: true
    },
    pdf: {
      type: String,
      default: null
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
      min: 1
    },
    availableCopies: {
      type: Number,
      required: true,
      default: 1,
      min: 0
    },
    status: {
      type: String,
      enum: ["Available", "Issued"],
      default: "Available"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Book", BookSchema);