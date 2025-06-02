const mongoose = require('mongoose');

const medicationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Medication name is required'],
    trim: true
  },
  genericName: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'Heart & Blood Pressure',
      'Diabetes',
      'Pain & Inflammation', 
      'Mental Health',
      'Antibiotics',
      'Vitamins & Supplements',
      'Respiratory',
      'Digestive',
      'Hormonal',
      'Other'
    ]
  },
  form: {
    type: String,
    required: [true, 'Medication form is required'],
    enum: ['tablet', 'capsule', 'liquid', 'injection', 'topical', 'inhaler', 'drops', 'patch']
  },
  strength: {
    amount: {
      type: Number,
      required: [true, 'Strength amount is required']
    },
    unit: {
      type: String,
      required: [true, 'Strength unit is required'],
      enum: ['mg', 'g', 'ml', 'mcg', 'IU', 'units']
    }
  },
  color: String,
  shape: String,
  imprint: String,
  manufacturer: String,
  ndc: String, // National Drug Code
  sideEffects: [String],
  contraindications: [String],
  instructions: {
    withFood: {
      type: String,
      enum: ['required', 'optional', 'avoid', 'not_specified'],
      default: 'not_specified'
    },
    specialInstructions: String
  },
  cost: {
    amount: Number,
    currency: { type: String, default: 'USD' },
    per: { type: String, default: 'bottle' }
  }
}, {
  timestamps: true
});

// Index for efficient searching
medicationSchema.index({ name: 'text', genericName: 'text' });
medicationSchema.index({ category: 1 });

module.exports = mongoose.model('Medication', medicationSchema);
