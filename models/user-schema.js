const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  name: String,
  email: String,
  accessToken: { 
    type: String, 
    required: true 
  },
  tokenExpiry: Date,
  pages: [{
    pageId: String,
    pageName: String,
    accessToken: String,
    isSubscribed: { type: Boolean, default: false }
  }],
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  lastLogin: { 
    type: Date, 
    default: Date.now 
  }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
