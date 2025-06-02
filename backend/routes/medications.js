const express = require('express');
const { body, query } = require('express-validator');
const Medication = require('../models/Medication');
const auth = require('../middleware/auth');
const validateRequest = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/medications
// @desc    Get all medications with search and filter
// @access  Private
router.get('/', auth, [
  query('search').optional().trim(),
  query('category').optional().isIn([
    'Heart & Blood Pressure', 'Diabetes', 'Pain & Inflammation', 
    'Mental Health', 'Antibiotics', 'Vitamins & Supplements',
    'Respiratory', 'Digestive', 'Hormonal', 'Other'
  ]),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], validateRequest, async (req, res) => {
  try {
    const { search, category, page = 1, limit = 20 } = req.query;
    
    let query = {};
    
    // Search by name or generic name
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { genericName: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Filter by category
    if (category) {
      query.category = category;
    }
    
    const skip = (page - 1) * limit;
    
    const [medications, total] = await Promise.all([
      Medication.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Medication.countDocuments(query)
    ]);
    
    res.json({
      medications,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Get medications error:', error);
    res.status(500).json({ message: 'Server error while fetching medications' });
  }
});

// @route   GET /api/medications/categories
// @desc    Get all medication categories
// @access  Private
router.get('/categories', auth, async (req, res) => {
  try {
    const categories = [
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
    ];
    
    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error while fetching categories' });
  }
});

// @route   GET /api/medications/:id
// @desc    Get single medication
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const medication = await Medication.findById(req.params.id);
    
    if (!medication) {
      return res.status(404).json({ message: 'Medication not found' });
    }
    
    res.json({ medication });
  } catch (error) {
    console.error('Get medication error:', error);
    res.status(500).json({ message: 'Server error while fetching medication' });
  }
});

// @route   POST /api/medications
// @desc    Create new medication
// @access  Private
router.post('/', auth, [
  body('name')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Medication name is required'),
  body('category')
    .isIn([
      'Heart & Blood Pressure', 'Diabetes', 'Pain & Inflammation', 
      'Mental Health', 'Antibiotics', 'Vitamins & Supplements',
      'Respiratory', 'Digestive', 'Hormonal', 'Other'
    ])
    .withMessage('Valid category is required'),
  body('form')
    .isIn(['tablet', 'capsule', 'liquid', 'injection', 'topical', 'inhaler', 'drops', 'patch'])
    .withMessage('Valid form is required'),
  body('strength.amount')
    .isNumeric()
    .withMessage('Strength amount must be a number'),
  body('strength.unit')
    .isIn(['mg', 'g', 'ml', 'mcg', 'IU', 'units'])
    .withMessage('Valid strength unit is required')
], validateRequest, async (req, res) => {
  try {
    const medication = new Medication(req.body);
    await medication.save();
    
    res.status(201).json({
      message: 'Medication created successfully',
      medication
    });
  } catch (error) {
    console.error('Create medication error:', error);
    res.status(500).json({ message: 'Server error while creating medication' });
  }
});

// @route   PUT /api/medications/:id
// @desc    Update medication
// @access  Private
router.put('/:id', auth, [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Medication name cannot be empty'),
  body('category')
    .optional()
    .isIn([
      'Heart & Blood Pressure', 'Diabetes', 'Pain & Inflammation', 
      'Mental Health', 'Antibiotics', 'Vitamins & Supplements',
      'Respiratory', 'Digestive', 'Hormonal', 'Other'
    ])
    .withMessage('Valid category is required'),
  body('form')
    .optional()
    .isIn(['tablet', 'capsule', 'liquid', 'injection', 'topical', 'inhaler', 'drops', 'patch'])
    .withMessage('Valid form is required'),
  body('strength.amount')
    .optional()
    .isNumeric()
    .withMessage('Strength amount must be a number'),
  body('strength.unit')
    .optional()
    .isIn(['mg', 'g', 'ml', 'mcg', 'IU', 'units'])
    .withMessage('Valid strength unit is required')
], validateRequest, async (req, res) => {
  try {
    const medication = await Medication.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!medication) {
      return res.status(404).json({ message: 'Medication not found' });
    }
    
    res.json({
      message: 'Medication updated successfully',
      medication
    });
  } catch (error) {
    console.error('Update medication error:', error);
    res.status(500).json({ message: 'Server error while updating medication' });
  }
});

// @route   DELETE /api/medications/:id
// @desc    Delete medication
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const medication = await Medication.findByIdAndDelete(req.params.id);
    
    if (!medication) {
      return res.status(404).json({ message: 'Medication not found' });
    }
    
    res.json({ message: 'Medication deleted successfully' });
  } catch (error) {
    console.error('Delete medication error:', error);
    res.status(500).json({ message: 'Server error while deleting medication' });
  }
});

module.exports = router;
