const mongoose = require('mongoose');

// Import existing schemas
const locationSchema = new mongoose.Schema({
  city: String,
  country: String,
  latitude: Number,
  longitude: Number,
  street: String,
  zip: String
});

const postSchema = new mongoose.Schema({
  postId: String,
  message: String,
  created_time: Date,
  permalink_url: String
});

const leadFieldSchema = new mongoose.Schema({
  name: String,
  values: [String]
});

const leadSchema = new mongoose.Schema({
  leadId: String,
  created_time: Date,
  platform: String,
  field_data: [leadFieldSchema]
});

const leadFormSchema = new mongoose.Schema({
  formId: String,
  locale: String,
  name: String,
  status: String,
  leads: [leadSchema]
});

const pageSchema = new mongoose.Schema({
  pageId: String,
  name: String,
  fan_count: Number,
  link: String,
  location: locationSchema,
  phone: String,
  website: String,
  category: String,
  posts: [postSchema],
  leadForms: [leadFormSchema],
  lastUpdated: { type: Date, default: Date.now }
});

const Page = mongoose.model('Page', pageSchema);

module.exports = Page;
