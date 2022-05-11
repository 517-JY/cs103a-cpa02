"use strict";
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;
const Mixed = Schema.Types.Mixed;

var prizeSchema = Schema({
  year: String,
  category: String,
  laureates: Mixed,
});

module.exports = mongoose.model("Prize", prizeSchema);
