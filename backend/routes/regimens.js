const express = require('express');
const { body, query } = require('express-validator');
const Regimen = require('../models/Regimen');
const Medication = require('../models/Medication');
const auth = require('../middleware/auth');
const validateRequest = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/regimens
// @desc    Get user's regimens
// @access  Private
router.get('/', auth, [
  query('active').optional().isBoolean(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], validateRequest, async (req, res) => {
  try {
    const { active, page = 1, limit = 20 } = req.query;
    
    let query = { user: req.user._id };
    
    if (active !== undefined) {
      query.isActive = active === 'true';
    }
    
    const skip = (page - 1) * limit;
    
    const [regimens, total] = await Promise.all([
      Regimen.find(query)
        .populate('medication', 'name genericName category form strength')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Regimen.countDocuments(query)
    ]);
    
    // Add virtual fields
    const regimensWithVirtuals = regimens.map(regimen => ({
      ...regimen.toObject(),
      scheduleTimes: regimen.scheduleTimes,
      isCurrentlyActive: regimen.isCurrentlyActive(),
      nextDoseTime: regimen.getNextDoseTime()
    }));
    
    res.json({
      regimens: regimensWithVirtuals,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Get regimens error:', error);
    res.status(500).json({ message: 'Server error while fetching regimens' });
  }
});

// @route   GET /api/regimens/:id
// @desc    Get single regimen
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const regimen = await Regimen.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('medication');
    
    if (!regimen) {
      return res.status(404).json({ message: 'Regimen not found' });
    }
    
    res.json({
      regimen: {
        ...regimen.toObject(),
        scheduleTimes: regimen.scheduleTimes,
        isCurrentlyActive: regimen.isCurrentlyActive(),
        nextDoseTime: regimen.getNextDoseTime()
      }
    });
  } catch (error) {
    console.error('Get regimen error:', error);
    res.status(500).json({ message: 'Server error while fetching regimen' });
  }
});

// @route   POST /api/regimens
// @desc    Create new regimen
// @access  Private
router.post('/', auth, [
  body('medication')
    .isMongoId()
    .withMessage('Valid medication ID is required'),
  body('dosage.amount')
    .isNumeric()
    .withMessage('Dosage amount must be a number'),
  body('dosage.unit')
    .isIn(['tablet', 'capsule', 'ml', 'mg', 'g', 'tsp', 'tbsp', 'puff', 'drop', 'patch'])
    .withMessage('Valid dosage unit is required'),
  body('frequency')
    .isIn(['once_daily', 'twice_daily', 'three_times_daily', 'four_times_daily', 'every_other_day', 'weekly', 'as_needed', 'custom'])
    .withMessage('Valid frequency is required'),
  body('startDate')
    .isISO8601()
    .withMessage('Valid start date is required'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('Valid end date is required'),
  body('customSchedule')
    .if(body('frequency').equals('custom'))
    .isArray({ min: 1 })
    .withMessage('Custom schedule is required when frequency is custom'),
  body('customSchedule.*.time')
    .if(body('frequency').equals('custom'))
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Valid time format (HH:MM) is required for custom schedule')
], validateRequest, async (req, res) => {
  try {
    // Verify medication exists
    const medication = await Medication.findById(req.body.medication);
    if (!medication) {
      return res.status(404).json({ message: 'Medication not found' });
    }
    
    // Validate end date is after start date
    if (req.body.endDate && new Date(req.body.endDate) <= new Date(req.body.startDate)) {
      return res.status(400).json({ message: 'End date must be after start date' });
    }
    
    const regimen = new Regimen({
      ...req.body,
      user: req.user._id
    });
    
    await regimen.save();
    await regimen.populate('medication');
    
    res.status(201).json({
      message: 'Regimen created successfully',
      regimen: {
        ...regimen.toObject(),
        scheduleTimes: regimen.scheduleTimes,
        isCurrentlyActive: regimen.isCurrentlyActive(),
        nextDoseTime: regimen.getNextDoseTime()
      }
    });
  } catch (error) {
    console.error('Create regimen error:', error);
    res.status(500).json({ message: 'Server error while creating regimen' });
  }
});

// @route   PUT /api/regimens/:id
// @desc    Update regimen
// @access  Private
router.put('/:id', auth, [
  body('medication')
    .optional()
    .isMongoId()
    .withMessage('Valid medication ID is required'),
  body('dosage.amount')
    .optional()
    .isNumeric()
    .withMessage('Dosage amount must be a number'),
  body('dosage.unit')
    .optional()
    .isIn(['tablet', 'capsule', 'ml', 'mg', 'g', 'tsp', 'tbsp', 'puff', 'drop', 'patch'])
    .withMessage('Valid dosage unit is required'),
  body('frequency')
    .optional()
    .isIn(['once_daily', 'twice_daily', 'three_times_daily', 'four_times_daily', 'every_other_day', 'weekly', 'as_needed', 'custom'])
    .withMessage('Valid frequency is required'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Valid start date is required'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('Valid end date is required')
], validateRequest, async (req, res) => {
  try {
    // Find regimen
    const regimen = await Regimen.findOne({
      _id: req.params.id,
      user: req.user._id
    });
    
    if (!regimen) {
      return res.status(404).json({ message: 'Regimen not found' });
    }
    
    // Verify medication exists if being updated
    if (req.body.medication) {
      const medication = await Medication.findById(req.body.medication);
      if (!medication) {
        return res.status(404).json({ message: 'Medication not found' });
      }
    }
    
    // Validate end date is after start date
    const startDate = req.body.startDate || regimen.startDate;
    if (req.body.endDate && new Date(req.body.endDate) <= new Date(startDate)) {
      return res.status(400).json({ message: 'End date must be after start date' });
    }
    
    // Update regimen
    Object.assign(regimen, req.body);
    await regimen.save();
    await regimen.populate('medication');
    
    res.json({
      message: 'Regimen updated successfully',
      regimen: {
        ...regimen.toObject(),
        scheduleTimes: regimen.scheduleTimes,
        isCurrentlyActive: regimen.isCurrentlyActive(),
        nextDoseTime: regimen.getNextDoseTime()
      }
    });
  } catch (error) {
    console.error('Update regimen error:', error);
    res.status(500).json({ message: 'Server error while updating regimen' });
  }
});

// @route   DELETE /api/regimens/:id
// @desc    Delete regimen
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const regimen = await Regimen.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });
    
    if (!regimen) {
      return res.status(404).json({ message: 'Regimen not found' });
    }
    
    res.json({ message: 'Regimen deleted successfully' });
  } catch (error) {
    console.error('Delete regimen error:', error);
    res.status(500).json({ message: 'Server error while deleting regimen' });
  }
});

// @route   PUT /api/regimens/:id/toggle
// @desc    Toggle regimen active status
// @access  Private
router.put('/:id/toggle', auth, async (req, res) => {
  try {
    const regimen = await Regimen.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('medication');
    
    if (!regimen) {
      return res.status(404).json({ message: 'Regimen not found' });
    }
    
    regimen.isActive = !regimen.isActive;
    await regimen.save();
    
    res.json({
      message: `Regimen ${regimen.isActive ? 'activated' : 'deactivated'} successfully`,
      regimen: {
        ...regimen.toObject(),
        scheduleTimes: regimen.scheduleTimes,
        isCurrentlyActive: regimen.isCurrentlyActive(),
        nextDoseTime: regimen.getNextDoseTime()
      }
    });
  } catch (error) {
    console.error('Toggle regimen error:', error);
    res.status(500).json({ message: 'Server error while toggling regimen' });
  }
});

// @route   GET /api/regimens/today/schedule
// @desc    Get today's medication schedule
// @access  Private
router.get('/today/schedule', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const regimens = await Regimen.find({
      user: req.user._id,
      isActive: true,
      startDate: { $lte: today },
      $or: [
        { endDate: { $exists: false } },
        { endDate: null },
        { endDate: { $gte: today } }
      ]
    }).populate('medication', 'name genericName category form strength');
    
    const schedule = [];
    
    regimens.forEach(regimen => {
      const times = regimen.scheduleTimes;
      times.forEach(time => {
        const [hours, minutes] = time.split(':');
        const scheduledTime = new Date(today);
        scheduledTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        schedule.push({
          regimen: regimen._id,
          medication: regimen.medication,
          dosage: regimen.dosage,
          scheduledTime,
          time,
          label: regimen.frequency === 'custom' ? 
            regimen.customSchedule.find(cs => cs.time === time)?.label : 
            null
        });
      });
    });
    
    // Sort by scheduled time
    schedule.sort((a, b) => a.scheduledTime - b.scheduledTime);
    
    res.json({ schedule });
  } catch (error) {
    console.error('Get today schedule error:', error);
    res.status(500).json({ message: 'Server error while fetching today\'s schedule' });
  }
});

module.exports = router;
