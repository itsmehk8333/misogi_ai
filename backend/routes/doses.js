const express = require('express');
const { body, query } = require('express-validator');
const DoseLog = require('../models/DoseLog');
const Regimen = require('../models/Regimen');
const User = require('../models/User');
const auth = require('../middleware/auth');
const validateRequest = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/doses
// @desc    Get dose logs with filters
// @access  Private
router.get('/', auth, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('status').optional().isIn(['taken', 'missed', 'skipped', 'delayed']),
  query('regimen').optional().isMongoId(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], validateRequest, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      status, 
      regimen, 
      page = 1, 
      limit = 20 
    } = req.query;
    
    let query = { user: req.user._id };
    
    // Date range filter
    if (startDate || endDate) {
      query.scheduledTime = {};
      if (startDate) query.scheduledTime.$gte = new Date(startDate);
      if (endDate) query.scheduledTime.$lte = new Date(endDate);
    }
    
    // Status filter
    if (status) {
      query.status = status;
    }
    
    // Regimen filter
    if (regimen) {
      query.regimen = regimen;
    }
    
    const skip = (page - 1) * limit;
    
    const [doses, total] = await Promise.all([
      DoseLog.find(query)
        .populate('medication', 'name genericName category form strength')
        .populate('regimen', 'frequency dosage')
        .sort({ scheduledTime: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      DoseLog.countDocuments(query)
    ]);
    
    res.json({
      doses,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Get doses error:', error);
    res.status(500).json({ message: 'Server error while fetching dose logs' });
  }
});

// @route   GET /api/doses/today
// @desc    Get today's dose logs
// @access  Private
router.get('/today', auth, async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    const todayDoses = await DoseLog.find({
      user: req.user._id,
      scheduledTime: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    })
    .populate('medication', 'name genericName category form strength')
    .populate('regimen', 'frequency dosage')
    .sort({ scheduledTime: 1 });
    
    res.json({ doses: todayDoses });
  } catch (error) {
    console.error('Get today doses error:', error);
    res.status(500).json({ message: 'Server error while fetching today\'s doses' });
  }
});

// @route   POST /api/doses/log
// @desc    Log a dose (taken, missed, skipped)
// @access  Private
router.post('/log', auth, [
  body('regimen')
    .isMongoId()
    .withMessage('Valid regimen ID is required'),
  body('scheduledTime')
    .isISO8601()
    .withMessage('Valid scheduled time is required'),
  body('status')
    .isIn(['taken', 'missed', 'skipped', 'delayed'])
    .withMessage('Valid status is required'),
  body('actualTime')
    .optional()
    .isISO8601()
    .withMessage('Valid actual time is required'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
  body('sideEffects')
    .optional()
    .isArray()
    .withMessage('Side effects must be an array'),
  body('effectiveness.rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Effectiveness rating must be between 1 and 5'),
  body('withFood')
    .optional()
    .isBoolean()
    .withMessage('With food must be a boolean')
], validateRequest, async (req, res) => {
  try {
    const {
      regimen: regimenId,
      scheduledTime,
      status,
      actualTime,
      notes,
      sideEffects = [],
      effectiveness,
      withFood,
      mood,
      symptoms = [],
      location
    } = req.body;
    
    // Verify regimen belongs to user
    const regimen = await Regimen.findOne({
      _id: regimenId,
      user: req.user._id
    }).populate('medication');
    
    if (!regimen) {
      return res.status(404).json({ message: 'Regimen not found' });
    }
    
    // Check if dose already logged
    const existingLog = await DoseLog.findOne({
      user: req.user._id,
      regimen: regimenId,
      scheduledTime: new Date(scheduledTime)
    });
    
    if (existingLog) {
      return res.status(400).json({ message: 'Dose already logged for this time' });
    }
    
    // Create dose log
    const doseLog = new DoseLog({
      user: req.user._id,
      regimen: regimenId,
      medication: regimen.medication._id,
      scheduledTime: new Date(scheduledTime),
      actualTime: actualTime ? new Date(actualTime) : (status === 'taken' ? new Date() : null),
      status,
      dosage: regimen.dosage,
      notes,
      sideEffects,
      effectiveness,
      withFood,
      mood,
      symptoms,
      location
    });
    
    await doseLog.save();
    await doseLog.populate(['medication', 'regimen']);
    
    // Update user adherence stats
    const takenCount = status === 'taken' ? 1 : 0;
    const missedCount = status === 'missed' ? 1 : 0;
    await req.user.updateAdherenceStats(takenCount, missedCount);
    
    res.status(201).json({
      message: 'Dose logged successfully',
      doseLog,
      points: doseLog.rewards.points
    });
  } catch (error) {
    console.error('Log dose error:', error);
    res.status(500).json({ message: 'Server error while logging dose' });
  }
});

// @route   PUT /api/doses/:id
// @desc    Update dose log
// @access  Private
router.put('/:id', auth, [
  body('status')
    .optional()
    .isIn(['taken', 'missed', 'skipped', 'delayed'])
    .withMessage('Valid status is required'),
  body('actualTime')
    .optional()
    .isISO8601()
    .withMessage('Valid actual time is required'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
  body('effectiveness.rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Effectiveness rating must be between 1 and 5')
], validateRequest, async (req, res) => {
  try {
    const doseLog = await DoseLog.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate(['medication', 'regimen']);
    
    if (!doseLog) {
      return res.status(404).json({ message: 'Dose log not found' });
    }
    
    // Store old status for adherence stats update
    const oldStatus = doseLog.status;
    
    // Update dose log
    Object.assign(doseLog, req.body);
    
    // Update actual time if status changed to taken
    if (req.body.status === 'taken' && !req.body.actualTime) {
      doseLog.actualTime = new Date();
    }
    
    await doseLog.save();
    
    // Update user adherence stats if status changed
    if (oldStatus !== doseLog.status) {
      const oldTaken = oldStatus === 'taken' ? -1 : 0;
      const oldMissed = oldStatus === 'missed' ? -1 : 0;
      const newTaken = doseLog.status === 'taken' ? 1 : 0;
      const newMissed = doseLog.status === 'missed' ? 1 : 0;
      
      await req.user.updateAdherenceStats(
        oldTaken + newTaken,
        oldMissed + newMissed
      );
    }
    
    res.json({
      message: 'Dose log updated successfully',
      doseLog
    });
  } catch (error) {
    console.error('Update dose error:', error);
    res.status(500).json({ message: 'Server error while updating dose log' });
  }
});

// @route   DELETE /api/doses/:id
// @desc    Delete dose log
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const doseLog = await DoseLog.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });
    
    if (!doseLog) {
      return res.status(404).json({ message: 'Dose log not found' });
    }
    
    // Update user adherence stats
    const takenCount = doseLog.status === 'taken' ? -1 : 0;
    const missedCount = doseLog.status === 'missed' ? -1 : 0;
    await req.user.updateAdherenceStats(takenCount, missedCount);
    
    res.json({ message: 'Dose log deleted successfully' });
  } catch (error) {
    console.error('Delete dose error:', error);
    res.status(500).json({ message: 'Server error while deleting dose log' });
  }
});

// @route   GET /api/doses/pending
// @desc    Get pending doses (due now or overdue)
// @access  Private
router.get('/pending', auth, async (req, res) => {
  try {
    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    
    // Get active regimens
    const regimens = await Regimen.find({
      user: req.user._id,
      isActive: true,
      startDate: { $lte: now },
      $or: [
        { endDate: { $exists: false } },
        { endDate: null },
        { endDate: { $gte: now } }
      ]
    }).populate('medication');
    
    const pendingDoses = [];
    
    for (const regimen of regimens) {
      const times = regimen.scheduleTimes;
      
      for (const time of times) {
        const [hours, minutes] = time.split(':');
        
        // Check today's doses
        const today = new Date(now);
        today.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        if (today <= now && today >= fourHoursAgo) {
          // Check if already logged
          const existingLog = await DoseLog.findOne({
            user: req.user._id,
            regimen: regimen._id,
            scheduledTime: today
          });
          
          if (!existingLog) {
            pendingDoses.push({
              regimen: regimen._id,
              medication: regimen.medication,
              dosage: regimen.dosage,
              scheduledTime: today,
              isOverdue: today < now - 30 * 60 * 1000, // 30 minutes grace period
              minutesOverdue: Math.max(0, Math.floor((now - today) / (1000 * 60)))
            });
          }
        }
      }
    }
    
    // Sort by scheduled time
    pendingDoses.sort((a, b) => a.scheduledTime - b.scheduledTime);
    
    res.json({ pendingDoses });
  } catch (error) {
    console.error('Get pending doses error:', error);
    res.status(500).json({ message: 'Server error while fetching pending doses' });
  }
});

// @route   GET /api/doses/stats
// @desc    Get adherence statistics
// @access  Private
router.get('/stats', auth, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('period').optional().isIn(['week', 'month', 'quarter', 'year'])
], validateRequest, async (req, res) => {
  try {
    const { startDate, endDate, period = 'month' } = req.query;
    
    let start, end;
    
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      // Calculate date range based on period
      end = new Date();
      start = new Date();
      
      switch (period) {
        case 'week':
          start.setDate(start.getDate() - 7);
          break;
        case 'month':
          start.setMonth(start.getMonth() - 1);
          break;
        case 'quarter':
          start.setMonth(start.getMonth() - 3);
          break;
        case 'year':
          start.setFullYear(start.getFullYear() - 1);
          break;
      }
    }
    
    const stats = await DoseLog.getAdherenceStats(req.user._id, start, end);
    const weeklyStats = await DoseLog.getWeeklyAdherence(req.user._id, 4);
    
    res.json({
      stats,
      weeklyStats,
      period: {
        start,
        end,
        type: period
      }
    });
  } catch (error) {
    console.error('Get dose stats error:', error);
    res.status(500).json({ message: 'Server error while fetching dose statistics' });
  }
});

// @route   POST /api/doses/mark-taken
// @desc    Mark a dose as taken (quick action)
// @access  Private
router.post('/mark-taken', auth, [
  body('regimen')
    .isMongoId()
    .withMessage('Valid regimen ID is required'),
  body('timestamp')
    .optional()
    .isISO8601()
    .withMessage('Valid timestamp is required'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
], validateRequest, async (req, res) => {
  try {
    const { regimen: regimenId, timestamp = new Date(), notes = '' } = req.body;
    
    // Verify regimen belongs to user
    const regimen = await Regimen.findOne({
      _id: regimenId,
      user: req.user._id
    }).populate('medication');
    
    if (!regimen) {
      return res.status(404).json({ message: 'Regimen not found' });
    }
    
    // Create dose log
    const doseLog = new DoseLog({
      user: req.user._id,
      regimen: regimenId,
      medication: regimen.medication._id,
      scheduledTime: new Date(timestamp),
      actualTime: new Date(),
      status: 'taken',
      dosage: regimen.dosage,
      notes
    });
    
    await doseLog.save();
    await doseLog.populate(['medication', 'regimen']);
    
    res.status(201).json({
      message: 'Dose marked as taken successfully',
      dose: doseLog
    });
  } catch (error) {
    console.error('Mark dose taken error:', error);
    res.status(500).json({ message: 'Server error while marking dose as taken' });
  }
});

// @route   POST /api/doses/mark-missed
// @desc    Mark a dose as missed
// @access  Private
router.post('/mark-missed', auth, [
  body('regimen')
    .isMongoId()
    .withMessage('Valid regimen ID is required'),
  body('timestamp')
    .optional()
    .isISO8601()
    .withMessage('Valid timestamp is required'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters')
], validateRequest, async (req, res) => {
  try {
    const { regimen: regimenId, timestamp = new Date(), reason = '' } = req.body;
    
    // Verify regimen belongs to user
    const regimen = await Regimen.findOne({
      _id: regimenId,
      user: req.user._id
    }).populate('medication');
    
    if (!regimen) {
      return res.status(404).json({ message: 'Regimen not found' });
    }
    
    // Create dose log
    const doseLog = new DoseLog({
      user: req.user._id,
      regimen: regimenId,
      medication: regimen.medication._id,
      scheduledTime: new Date(timestamp),
      actualTime: null,
      status: 'missed',
      dosage: regimen.dosage,
      notes: reason
    });
    
    await doseLog.save();
    await doseLog.populate(['medication', 'regimen']);
    
    res.status(201).json({
      message: 'Dose marked as missed',
      dose: doseLog
    });
  } catch (error) {
    console.error('Mark dose missed error:', error);
    res.status(500).json({ message: 'Server error while marking dose as missed' });
  }
});

// @route   POST /api/doses/mark-skipped
// @desc    Mark a dose as skipped
// @access  Private
router.post('/mark-skipped', auth, [
  body('regimen')
    .isMongoId()
    .withMessage('Valid regimen ID is required'),
  body('timestamp')
    .optional()
    .isISO8601()
    .withMessage('Valid timestamp is required'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters')
], validateRequest, async (req, res) => {
  try {
    const { regimen: regimenId, timestamp = new Date(), reason = '' } = req.body;
    
    // Verify regimen belongs to user
    const regimen = await Regimen.findOne({
      _id: regimenId,
      user: req.user._id
    }).populate('medication');
    
    if (!regimen) {
      return res.status(404).json({ message: 'Regimen not found' });
    }
    
    // Create dose log
    const doseLog = new DoseLog({
      user: req.user._id,
      regimen: regimenId,
      medication: regimen.medication._id,
      scheduledTime: new Date(timestamp),
      actualTime: null,
      status: 'skipped',
      dosage: regimen.dosage,
      notes: reason
    });
    
    await doseLog.save();
    await doseLog.populate(['medication', 'regimen']);
    
    res.status(201).json({
      message: 'Dose marked as skipped',
      dose: doseLog
    });
  } catch (error) {
    console.error('Mark dose skipped error:', error);
    res.status(500).json({ message: 'Server error while marking dose as skipped' });
  }
});

// @route   GET /api/doses/missed
// @desc    Get missed doses in the last X days
// @access  Private
router.get('/missed', auth, [
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365')
], validateRequest, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const missedDoses = await DoseLog.find({
      user: req.user._id,
      status: 'missed',
      scheduledTime: { $gte: startDate }
    })
    .populate('medication', 'name genericName category form strength')
    .populate('regimen', 'frequency dosage')
    .sort({ scheduledTime: -1 });
    
    // Group by medication
    const groupedMissedDoses = missedDoses.reduce((acc, dose) => {
      const medId = dose.medication._id.toString();
      if (!acc[medId]) {
        acc[medId] = {
          medication: dose.medication,
          doses: [],
          totalMissed: 0
        };
      }
      acc[medId].doses.push(dose);
      acc[medId].totalMissed++;
      return acc;
    }, {});

    const result = Object.values(groupedMissedDoses)
      .sort((a, b) => b.totalMissed - a.totalMissed);
    
    res.json({ 
      missedDoses: result,
      total: missedDoses.length,
      period: {
        start: startDate,
        end: new Date(),
        days
      }
    });
  } catch (error) {
    console.error('Get missed doses error:', error);
    res.status(500).json({ message: 'Server error while fetching missed doses' });
  }
});

// @route   GET /api/doses/export
// @desc    Export dose logs in PDF or CSV format
// @access  Private
router.get('/export', auth, [
  query('format')
    .isIn(['pdf', 'csv', 'json'])
    .withMessage('Valid format is required (pdf, csv, or json)'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Valid start date is required'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Valid end date is required'),
  query('status')
    .optional()
    .isIn(['taken', 'missed', 'skipped', 'delayed'])
    .withMessage('Valid status is required')
], validateRequest, async (req, res) => {
  try {
    const { format, startDate, endDate, status } = req.query;
    let query = { user: req.user._id };
    
    // Apply date filters
    if (startDate || endDate) {
      query.scheduledTime = {};
      if (startDate) query.scheduledTime.$gte = new Date(startDate);
      if (endDate) query.scheduledTime.$lte = new Date(endDate);
    }
    
    // Apply status filter
    if (status) {
      query.status = status;
    }
    
    const doses = await DoseLog.find(query)
      .populate('medication', 'name genericName category form strength')
      .populate('regimen', 'frequency dosage')
      .sort({ scheduledTime: -1 });
    
    if (format === 'json') {
      return res.json({ doses });
    }
    
    if (format === 'csv') {
      const csvData = doses.map(dose => ({
        date: dose.scheduledTime.toISOString().split('T')[0],
        time: dose.scheduledTime.toISOString().split('T')[1].substring(0, 5),
        medication: dose.medication.name,
        dosage: `${dose.dosage.amount} ${dose.dosage.unit}`,
        status: dose.status,
        actualTime: dose.actualTime ? dose.actualTime.toISOString().split('T')[1].substring(0, 5) : '',
        minutesLate: dose.minutesLate || 0,
        notes: dose.notes || ''
      }));
      
      const fields = [
        { label: 'Date', value: 'date' },
        { label: 'Scheduled Time', value: 'time' },
        { label: 'Medication', value: 'medication' },
        { label: 'Dosage', value: 'dosage' },
        { label: 'Status', value: 'status' },
        { label: 'Actual Time', value: 'actualTime' },
        { label: 'Minutes Late', value: 'minutesLate' },
        { label: 'Notes', value: 'notes' }
      ];
      
      const csv = generateCSV(csvData, fields);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=dose_logs_${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(csv);
    }
    
    if (format === 'pdf') {
      const pdfDoc = await generatePDFReport(doses);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=dose_logs_${new Date().toISOString().split('T')[0]}.pdf`);
      return res.send(pdfDoc);
    }
    
    res.status(400).json({ message: 'Invalid export format' });
  } catch (error) {
    console.error('Export doses error:', error);
    res.status(500).json({ message: 'Server error while exporting dose logs' });
  }
});

// Utility function to generate CSV data
function generateCSV(data, fields) {
  const header = fields.map(f => f.label).join(',') + '\n';
  const rows = data.map(row => {
    return fields.map(field => {
      const value = row[field.value]?.toString()?.replace(/"/g, '""') || '';
      return `"${value}"`;
    }).join(',');
  }).join('\n');
  
  return header + rows;
}

// Utility function to generate PDF report
async function generatePDFReport(doses) {
  const PDFDocument = require('pdfkit');
  
  // Create a document
  const doc = new PDFDocument({
    size: 'A4',
    margins: {
      top: 50,
      bottom: 50,
      left: 72,
      right: 72
    },
    bufferPages: true
  });
  
  // Set up fonts and styling
  doc.font('Helvetica');
  doc.fontSize(20).text('Medication Dose Log Report', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'right' });
  doc.moveDown();
  
  // Group doses by date
  const dosesByDate = doses.reduce((acc, dose) => {
    const date = dose.scheduledTime.toISOString().split('T')[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(dose);
    return acc;
  }, {});
  
  // Generate content
  Object.entries(dosesByDate).forEach(([date, dailyDoses]) => {
    doc.fontSize(16).text(new Date(date).toLocaleDateString(), { underline: true });
    doc.moveDown(0.5);
    
    dailyDoses.forEach(dose => {
      const scheduledTime = dose.scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const status = dose.status.charAt(0).toUpperCase() + dose.status.slice(1);
      const medication = dose.medication.name;
      const dosage = `${dose.dosage.amount} ${dose.dosage.unit}`;
      
      doc.fontSize(12).text([
        `Time: ${scheduledTime}`,
        `Medication: ${medication}`,
        `Dosage: ${dosage}`,
        `Status: ${status}`,
        dose.notes ? `Notes: ${dose.notes}` : ''
      ].filter(Boolean).join(' | '));
      
      doc.moveDown(0.5);
    });
    
    doc.moveDown();
  });
  
  // Add page numbers
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(10).text(
      `Page ${i + 1} of ${pages.count}`,
      72,
      doc.page.height - 50,
      { align: 'center' }
    );
  }
  
  // Get the PDF as a Buffer
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

module.exports = router;
