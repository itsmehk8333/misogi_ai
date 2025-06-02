const express = require('express');
const { query } = require('express-validator');
const DoseLog = require('../models/DoseLog');
const Regimen = require('../models/Regimen');
const auth = require('../middleware/auth');
const validateRequest = require('../middleware/validation');
const pdfService = require('../services/pdfService');
const memoryManager = require('../utils/memoryManager');

const router = express.Router();

// @route   GET /api/reports/adherence-stats
// @desc    Get adherence statistics for dashboard
// @access  Private
router.get('/adherence-stats', auth, [
  query('period').optional().isIn(['week', 'month', 'year'])
], validateRequest, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    // Calculate date ranges based on period
    const today = new Date();
    let startDate, previousStartDate, previousEndDate;
    
    switch (period) {
      case 'week':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
        previousStartDate = new Date(startDate);
        previousStartDate.setDate(startDate.getDate() - 7);
        previousEndDate = new Date(startDate);
        previousEndDate.setDate(previousEndDate.getDate() - 1);
        break;
      case 'year':
        startDate = new Date(today);
        startDate.setFullYear(today.getFullYear() - 1);
        previousStartDate = new Date(startDate);
        previousStartDate.setFullYear(startDate.getFullYear() - 1);
        previousEndDate = new Date(startDate);
        previousEndDate.setDate(previousEndDate.getDate() - 1);
        break;
      default: // month
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 1);
        previousStartDate = new Date(startDate);
        previousStartDate.setMonth(startDate.getMonth() - 1);
        previousEndDate = new Date(startDate);
        previousEndDate.setDate(previousEndDate.getDate() - 1);
        break;
    }
    
    // Get current period stats
    const currentStats = await DoseLog.getAdherenceStats(req.user._id, startDate, today);
    
    // Get previous period stats for comparison
    const previousStats = await DoseLog.getAdherenceStats(req.user._id, previousStartDate, previousEndDate);
    
    // Calculate trends (change from previous period)
    const adherenceTrend = Math.round((currentStats.adherenceRate - previousStats.adherenceRate) * 10) / 10;
    const takenOnTimeTrend = Math.round((currentStats.takenOnTimeRate - previousStats.takenOnTimeRate) * 10) / 10;
    const missedTrend = Math.round((currentStats.missedRate - previousStats.missedRate) * 10) / 10;
    const takenLateTrend = Math.round((currentStats.takenLateRate - previousStats.takenLateRate) * 10) / 10;
    
    // Get streak information
    const streakInfo = await DoseLog.getStreakInfo(req.user._id);
    
    // Format the response
    const responseData = {
      overallAdherence: Math.round(currentStats.adherenceRate * 10) / 10,
      takenPercentage: Math.round(currentStats.takenRate * 10) / 10,
      takenOnTimePercentage: Math.round(currentStats.takenOnTimeRate * 10) / 10,
      takenLatePercentage: Math.round(currentStats.takenLateRate * 10) / 10,
      missedPercentage: Math.round(currentStats.missedRate * 10) / 10,
      skippedPercentage: Math.round(currentStats.skippedRate * 10) / 10,
      adherenceTrend,
      takenOnTimeTrend,
      missedTrend,
      takenLateTrend,
      streakInfo
    };
    
    return res.json(responseData);
  } catch (error) {
    console.error('Error fetching adherence stats:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/reports/adherence
// @desc    Get detailed adherence report
// @access  Private
router.get('/adherence', auth, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('format').isIn(['json', 'csv', 'pdf']).withMessage('Valid format is required')
], validateRequest, async (req, res) => {
  try {
    // Calculate tomorrow's date as the maximum allowed end date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);
    
    const { 
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      endDate = new Date(),
      format = 'json' 
    } = req.query;
    
    const start = new Date(startDate);
    let end = new Date(endDate);
    
    // Ensure end date doesn't exceed tomorrow
    if (end > tomorrow) {
      end = tomorrow;
    }
      // Get overall stats with memory monitoring
    memoryManager.logMemoryUsage('before adherence stats query');
    const overallStats = await DoseLog.getAdherenceStats(req.user._id, start, end);
    memoryManager.logMemoryUsage('after adherence stats query');
    
    // Get medication-specific stats using memory-safe aggregation
    const medicationStatsPipeline = [
      {
        $match: {
          user: req.user._id,
          scheduledTime: { $gte: start, $lte: end }
        }      },
      {
        $lookup: {
          from: 'medications',
          localField: 'medication',
          foreignField: '_id',
          as: 'medicationInfo'
        }
      },
      {
        $unwind: '$medicationInfo'
      },
      {
        $group: {
          _id: '$medication',
          medicationName: { $first: '$medicationInfo.name' },
          category: { $first: '$medicationInfo.category' },
          totalDoses: { $sum: 1 },
          takenDoses: {
            $sum: { $cond: [{ $eq: ['$status', 'taken'] }, 1, 0] }
          },
          missedDoses: {
            $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] }
          },
          skippedDoses: {
            $sum: { $cond: [{ $eq: ['$status', 'skipped'] }, 1, 0] }
          },
          averageMinutesLate: { $avg: '$minutesLate' },
          totalPoints: { $sum: '$rewards.points' }
        }
      },
      {
        $addFields: {
          adherencePercentage: {
            $multiply: [{ $divide: ['$takenDoses', '$totalDoses'] }, 100]
          }
        }
      },
      {
        $sort: { adherencePercentage: -1 }
      }
    ];
    
    const medicationStats = await memoryManager.safeAggregate(DoseLog, medicationStatsPipeline, {
      maxResults: 100,  // Limit results to prevent memory issues
      chunkSize: 50
    });
      // Get daily adherence data for chart using memory-safe aggregation
    const dailyAdherencePipeline = [
      {
        $match: {
          user: req.user._id,
          scheduledTime: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$scheduledTime' },
            month: { $month: '$scheduledTime' },
            day: { $dayOfMonth: '$scheduledTime' }
          },
          date: { $first: { $dateToString: { format: "%Y-%m-%d", date: "$scheduledTime" } } },
          totalDoses: { $sum: 1 },
          takenDoses: {
            $sum: { $cond: [{ $eq: ['$status', 'taken'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          adherencePercentage: {
            $multiply: [{ $divide: ['$takenDoses', '$totalDoses'] }, 100]
          }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ];
    
    const dailyAdherence = await memoryManager.safeAggregate(DoseLog, dailyAdherencePipeline, {
      maxResults: 365,  // Limit to 1 year of data
      chunkSize: 30
    });    // Get most commonly missed medications using memory-safe aggregation
    const missedMedicationsPipeline = [
      {
        $match: {
          user: req.user._id,
          status: 'missed',
          scheduledTime: { $gte: start, $lte: end }
        }
      },
      {
        $lookup: {
          from: 'medications',
          localField: 'medication',
          foreignField: '_id',
          as: 'medicationInfo'
        }
      },
      {
        $unwind: '$medicationInfo'
      },
      {
        $group: {
          _id: '$medication',
          medicationName: { $first: '$medicationInfo.name' },
          category: { $first: '$medicationInfo.category' },
          missedCount: { $sum: 1 }
        }
      },
      {
        $sort: { missedCount: -1 }
      },
      {
        $limit: 5
      }
    ];
    
    const missedMedications = await memoryManager.safeAggregate(DoseLog, missedMedicationsPipeline, {
      maxResults: 20,
      chunkSize: 10
    });
    
    // Force garbage collection after heavy aggregations
    memoryManager.forceGC();
    
    const report = {
      reportPeriod: {
        startDate: start,
        endDate: end,
        daysIncluded: Math.ceil((end - start) / (1000 * 60 * 60 * 24))
      },
      overallStats,
      medicationStats,
      dailyAdherence,
      missedMedications,
      generatedAt: new Date()
    };
    
    if (format === 'csv') {
      // Convert to CSV format
      let csv = 'Date,Total Doses,Adherence Percentage\n';
      dailyAdherence.forEach(day => {
        csv += `${day.date},${day.totalDoses},${day.adherencePercentage.toFixed(2)}\n`;
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=adherence-report.csv');      return res.send(csv);
    } else if (format === 'pdf') {
      // Transform data to match PDFService expectations
      const pdfData = {
        reportPeriod: report.reportPeriod,
        
        // Map overallStats to top-level properties
        overallAdherence: report.overallStats?.adherenceRate || 0,
        totalDoses: report.overallStats?.totalDoses || 0,
        takenDoses: report.overallStats?.takenDoses || 0,
        missedDoses: report.overallStats?.missedDoses || 0,
        skippedDoses: report.overallStats?.skippedDoses || 0,
        
        // Add streak information (placeholder for now)
        currentStreak: 0,
        bestStreak: 0,
        
        // Map medication stats to medicationBreakdown
        medicationBreakdown: report.medicationStats?.map(med => ({
          medicationName: med.medicationName,
          adherenceRate: med.adherencePercentage,
          dosesTaken: med.takenDoses,
          dossesMissed: med.missedDoses,
          totalDoses: med.totalDoses
        })) || [],
        
        // Add daily adherence as weeklyTrends for now
        weeklyTrends: report.dailyAdherence?.slice(0, 12).map((day, index) => ({
          weekStart: day.date,
          adherenceRate: day.adherencePercentage,
          dosesTaken: day.takenDoses,
          dossesMissed: day.totalDoses - day.takenDoses,
          totalDoses: day.totalDoses
        })) || []
      };
      
      // Generate PDF report
      const pdfBuffer = await pdfService.generateAdherenceReport(pdfData);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=adherence-report.pdf');
      return res.end(pdfBuffer);
    }
    
    res.json(report);
  } catch (error) {
    console.error('Get adherence report error:', error);
    res.status(500).json({ message: 'Server error while generating adherence report' });
  }
});

// @route   GET /api/reports/calendar
// @desc    Get calendar heatmap data
// @access  Private
router.get('/calendar', auth, [
  query('year').optional().isInt({ min: 2020, max: 2030 }),
  query('month').optional().isInt({ min: 1, max: 12 })
], validateRequest, async (req, res) => {
  try {
    const { 
      year = new Date().getFullYear(),
      month 
    } = req.query;
    
    let start, end;
    
    if (month) {
      // Get specific month
      start = new Date(year, month - 1, 1);
      end = new Date(year, month, 0);
    } else {
      // Get entire year
      start = new Date(year, 0, 1);
      end = new Date(year, 11, 31);
    }
    
    const calendarData = await DoseLog.aggregate([
      {
        $match: {
          user: req.user._id,
          scheduledTime: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$scheduledTime' },
            month: { $month: '$scheduledTime' },
            day: { $dayOfMonth: '$scheduledTime' }
          },
          date: { $first: { $dateToString: { format: "%Y-%m-%d", date: "$scheduledTime" } } },
          totalDoses: { $sum: 1 },
          takenDoses: {
            $sum: { $cond: [{ $eq: ['$status', 'taken'] }, 1, 0] }
          },
          missedDoses: {
            $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] }
          },
          skippedDoses: {
            $sum: { $cond: [{ $eq: ['$status', 'skipped'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          adherencePercentage: {
            $multiply: [{ $divide: ['$takenDoses', '$totalDoses'] }, 100]
          },
          level: {
            $switch: {
              branches: [
                { case: { $eq: ['$totalDoses', 0] }, then: 0 },
                { case: { $gte: [{ $divide: ['$takenDoses', '$totalDoses'] }, 0.9] }, then: 4 },
                { case: { $gte: [{ $divide: ['$takenDoses', '$totalDoses'] }, 0.7] }, then: 3 },
                { case: { $gte: [{ $divide: ['$takenDoses', '$totalDoses'] }, 0.5] }, then: 2 },
                { case: { $gt: [{ $divide: ['$takenDoses', '$totalDoses'] }, 0] }, then: 1 }
              ],
              default: 0
            }
          }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);
    
    res.json({
      period: { start, end, year, month },
      calendarData
    });
  } catch (error) {
    console.error('Get calendar data error:', error);
    res.status(500).json({ message: 'Server error while generating calendar data' });
  }
});

// @route   GET /api/reports/trends
// @desc    Get adherence trends and insights
// @access  Private
router.get('/trends', auth, [
  query('period').optional().isIn(['week', 'month', 'quarter', 'year'])
], validateRequest, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    let start = new Date();
    
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
    
    // Get trends by time of day
    const timeOfDayTrends = await DoseLog.aggregate([
      {
        $match: {
          user: req.user._id,
          scheduledTime: { $gte: start }
        }
      },
      {
        $addFields: {
          hour: { $hour: '$scheduledTime' }
        }
      },
      {
        $group: {
          _id: '$hour',
          totalDoses: { $sum: 1 },
          takenDoses: {
            $sum: { $cond: [{ $eq: ['$status', 'taken'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          adherencePercentage: {
            $multiply: [{ $divide: ['$takenDoses', '$totalDoses'] }, 100]
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // Get trends by day of week
    const dayOfWeekTrends = await DoseLog.aggregate([
      {
        $match: {
          user: req.user._id,
          scheduledTime: { $gte: start }
        }
      },
      {
        $addFields: {
          dayOfWeek: { $dayOfWeek: '$scheduledTime' }
        }
      },
      {
        $group: {
          _id: '$dayOfWeek',
          totalDoses: { $sum: 1 },
          takenDoses: {
            $sum: { $cond: [{ $eq: ['$status', 'taken'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          adherencePercentage: {
            $multiply: [{ $divide: ['$takenDoses', '$totalDoses'] }, 100]
          },
          dayName: {
            $switch: {
              branches: [
                { case: { $eq: ['$_id', 1] }, then: 'Sunday' },
                { case: { $eq: ['$_id', 2] }, then: 'Monday' },
                { case: { $eq: ['$_id', 3] }, then: 'Tuesday' },
                { case: { $eq: ['$_id', 4] }, then: 'Wednesday' },
                { case: { $eq: ['$_id', 5] }, then: 'Thursday' },
                { case: { $eq: ['$_id', 6] }, then: 'Friday' },
                { case: { $eq: ['$_id', 7] }, then: 'Saturday' }
              ]
            }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // Calculate streak information
    const recentDoses = await DoseLog.find({
      user: req.user._id,
      scheduledTime: { $gte: start }
    }).sort({ scheduledTime: -1 }).limit(30);
    
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    const dailyAdherence = {};
    recentDoses.forEach(dose => {
      const dateKey = dose.scheduledTime.toISOString().split('T')[0];
      if (!dailyAdherence[dateKey]) {
        dailyAdherence[dateKey] = { taken: 0, total: 0 };
      }
      dailyAdherence[dateKey].total++;
      if (dose.status === 'taken') {
        dailyAdherence[dateKey].taken++;
      }
    });
    
    const sortedDates = Object.keys(dailyAdherence).sort().reverse();
    
    for (const date of sortedDates) {
      const adherenceRate = dailyAdherence[date].taken / dailyAdherence[date].total;
      if (adherenceRate >= 0.8) { // 80% or better considered a "good" day
        tempStreak++;
        if (date === sortedDates[0]) { // Most recent date
          currentStreak = tempStreak;
        }
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        if (date === sortedDates[0]) {
          currentStreak = 0;
        }
        tempStreak = 0;
      }
    }
    
    res.json({
      period: { start, end: new Date(), type: period },
      timeOfDayTrends,
      dayOfWeekTrends,
      streakInfo: {
        currentStreak,
        longestStreak
      },
      insights: {
        bestTimeOfDay: timeOfDayTrends.reduce((best, current) => 
          current.adherencePercentage > best.adherencePercentage ? current : best, 
          { adherencePercentage: 0, _id: null }
        ),
        bestDayOfWeek: dayOfWeekTrends.reduce((best, current) => 
          current.adherencePercentage > best.adherencePercentage ? current : best,
          { adherencePercentage: 0, dayName: null }
        )
      }
    });
  } catch (error) {
    console.error('Get trends error:', error);
    res.status(500).json({ message: 'Server error while generating trends report' });
  }
});

// @route   GET /api/reports/calendar-heatmap
// @desc    Get calendar heatmap data for adherence visualization
// @access  Private
router.get('/calendar-heatmap', auth, [
  query('year').optional().isInt({ min: 2020, max: 2030 })
], validateRequest, async (req, res) => {
  try {
    let { year } = req.query;
    
    // If no year provided, find the most recent year with data
    if (!year) {
      const latestYear = await DoseLog.aggregate([
        { $match: { user: req.user._id } },
        { $group: { _id: { $year: '$scheduledTime' } } },
        { $sort: { _id: -1 } },
        { $limit: 1 }
      ]);
      
      year = latestYear.length > 0 ? latestYear[0]._id : new Date().getFullYear();
    }
    
    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year}-12-31`);
    
    // Get daily adherence data for the year
    const dailyAdherence = await DoseLog.aggregate([
      {
        $match: {
          user: req.user._id,
          scheduledTime: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$scheduledTime' }
          },
          totalDoses: { $sum: 1 },
          takenDoses: {
            $sum: { $cond: [{ $eq: ['$status', 'taken'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          date: '$_id',
          adherenceRate: {
            $multiply: [{ $divide: ['$takenDoses', '$totalDoses'] }, 100]
          }
        }
      },
      {
        $project: {
          _id: 0,
          date: 1,
          adherenceRate: 1,
          totalDoses: 1,
          takenDoses: 1
        }
      },
      {
        $sort: { date: 1 }
      }
    ]);
    
    res.json(dailyAdherence);
  } catch (error) {
    console.error('Get calendar heatmap error:', error);
    res.status(500).json({ message: 'Server error while generating calendar heatmap' });
  }
});

// @route   GET /api/reports/weekly-trends
// @desc    Get weekly adherence trends
// @access  Private
router.get('/weekly-trends', auth, [
  query('weeks').optional().isInt({ min: 1, max: 52 })
], validateRequest, async (req, res) => {
  try {
    const { weeks = 12 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (weeks * 7));
    
    // Get weekly adherence data
    const weeklyData = await DoseLog.aggregate([
      {
        $match: {
          user: req.user._id,
          scheduledTime: { $gte: startDate }
        }
      },
      {
        $addFields: {
          year: { $year: '$scheduledTime' },
          week: { $week: '$scheduledTime' }
        }
      },
      {
        $group: {
          _id: { year: '$year', week: '$week' },
          totalDoses: { $sum: 1 },
          takenDoses: {
            $sum: { $cond: [{ $eq: ['$status', 'taken'] }, 1, 0] }
          },
          firstDayOfWeek: { $min: '$scheduledTime' }
        }
      },
      {
        $addFields: {
          adherencePercentage: {
            $multiply: [{ $divide: ['$takenDoses', '$totalDoses'] }, 100]
          },
          weekLabel: {
            $dateToString: { format: '%b %d', date: '$firstDayOfWeek' }
          }
        }
      },
      {
        $sort: { firstDayOfWeek: 1 }
      }
    ]);
    
    res.json(weeklyData);
  } catch (error) {
    console.error('Get weekly trends error:', error);
    res.status(500).json({ message: 'Server error while generating weekly trends' });
  }
});

// @route   GET /api/reports/most-missed-medications
// @desc    Get most commonly missed medications
// @access  Private
router.get('/most-missed-medications', auth, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Get medication miss rates
    const missedMedications = await DoseLog.aggregate([
      {
        $match: {
          user: req.user._id,
          scheduledTime: { $gte: thirtyDaysAgo }
        }
      },
      {
        $lookup: {
          from: 'regimens',
          localField: 'regimen',
          foreignField: '_id',
          as: 'regimenInfo'
        }
      },
      {
        $unwind: '$regimenInfo'
      },
      {
        $lookup: {
          from: 'medications',
          localField: 'regimenInfo.medication',
          foreignField: '_id',
          as: 'medicationInfo'
        }
      },
      {
        $unwind: '$medicationInfo'
      },
      {
        $group: {
          _id: '$medicationInfo._id',
          medicationName: { $first: '$medicationInfo.name' },
          dosage: { $first: '$regimenInfo.dosage' },
          frequency: { $first: '$regimenInfo.frequency' },
          totalDoses: { $sum: 1 },
          missedDoses: {
            $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] }
          },
          skippedDoses: {
            $sum: { $cond: [{ $eq: ['$status', 'skipped'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          missedPercentage: {
            $multiply: [{ $divide: ['$missedDoses', '$totalDoses'] }, 100]
          },
          skippedPercentage: {
            $multiply: [{ $divide: ['$skippedDoses', '$totalDoses'] }, 100]
          },
          totalMissedAndSkipped: { $add: ['$missedDoses', '$skippedDoses'] },
          totalMissedPercentage: {
            $multiply: [
              { $divide: [{ $add: ['$missedDoses', '$skippedDoses'] }, '$totalDoses'] }, 
              100
            ]
          }
        }
      },
      {
        $match: {
          totalMissedAndSkipped: { $gt: 0 }
        }
      },
      {
        $sort: { totalMissedPercentage: -1 }
      },
      {
        $limit: 10
      }
    ]);
    
    res.json(missedMedications);
  } catch (error) {
    console.error('Get most missed medications error:', error);
    res.status(500).json({ message: 'Server error while getting most missed medications' });
  }
});

// @route   GET /api/reports/dose-logs/export
// @desc    Export dose logs as PDF or CSV
// @access  Private
router.get('/dose-logs/export', auth, [
  query('format').isIn(['pdf', 'csv']).withMessage('Valid format is required'),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], validateRequest, async (req, res) => {
  try {
    const { 
      format,
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date()
    } = req.query;

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get dose logs
    const doses = await DoseLog.find({
      user: req.user._id,
      scheduledTime: { $gte: start, $lte: end }
    })
    .populate('medication')
    .populate('regimen')
    .sort({ scheduledTime: -1 })
    .limit(200);

    if (format === 'pdf') {
      const pdfBuffer = await pdfService.generateDoseLogsReport({ doses });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=dose-logs.pdf');
      return res.send(pdfBuffer);
    }

    if (format === 'csv') {
      let csv = 'Date,Time,Medication,Status,Notes\n';
      doses.forEach(dose => {
        const date = dose.scheduledTime.toISOString().split('T')[0];
        const time = dose.scheduledTime.toISOString().split('T')[1].substring(0, 5);
        const medication = dose.medication?.name || dose.regimen?.medication?.name || 'Unknown';
        const status = dose.status || 'pending';
        const notes = (dose.notes || '').replace(/"/g, '""');
        csv += `"${date}","${time}","${medication}","${status}","${notes}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=dose-logs.csv');
      return res.send(csv);
    }

    res.status(400).json({ message: 'Invalid format' });
  } catch (error) {
    console.error('Export dose logs error:', error);
    res.status(500).json({ message: 'Server error while exporting dose logs' });
  }
});

// @route   GET /api/reports/medication-list/export
// @desc    Export medication list as PDF or CSV
// @access  Private
router.get('/medication-list/export', auth, [
  query('format').isIn(['pdf', 'csv']).withMessage('Valid format is required')
], validateRequest, async (req, res) => {
  try {
    const { format } = req.query;

    // Get user's active medications
    const Medication = require('../models/Medication');
    const medications = await Medication.find({ user: req.user._id, isActive: true });

    if (format === 'pdf') {
      const pdfBuffer = await pdfService.generateMedicationListReport({ medications });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=medication-list.pdf');
      return res.send(pdfBuffer);
    }

    if (format === 'csv') {
      let csv = 'Name,Generic Name,Strength,Unit,Category,Form,Purpose\n';
      medications.forEach(med => {
        const name = (med.name || '').replace(/"/g, '""');
        const genericName = (med.genericName || '').replace(/"/g, '""');
        const strength = med.strength?.amount || '';
        const unit = med.strength?.unit || '';
        const category = (med.category || '').replace(/"/g, '""');
        const form = (med.form || '').replace(/"/g, '""');
        const purpose = (med.purpose || '').replace(/"/g, '""');
        
        csv += `"${name}","${genericName}","${strength}","${unit}","${category}","${form}","${purpose}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=medication-list.csv');
      return res.send(csv);
    }

    res.status(400).json({ message: 'Invalid format' });
  } catch (error) {
    console.error('Export medication list error:', error);
    res.status(500).json({ message: 'Server error while exporting medication list' });
  }
});

// @route   GET /api/reports/missed-doses/export
// @desc    Export missed doses as PDF or CSV
// @access  Private
router.get('/missed-doses/export', auth, [
  query('format').isIn(['pdf', 'csv']).withMessage('Valid format is required'),
  query('days').optional().isInt({ min: 1, max: 365 })
], validateRequest, async (req, res) => {
  try {
    const { format, days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get missed doses
    const missedDoses = await DoseLog.find({
      user: req.user._id,
      status: 'missed',
      scheduledTime: { $gte: startDate }
    })
    .populate('medication')
    .populate('regimen')
    .sort({ scheduledTime: -1 })
    .limit(100);

    if (format === 'pdf') {
      const pdfBuffer = await pdfService.generateMissedDosesReport({ missedDoses });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=missed-doses.pdf');
      return res.send(pdfBuffer);
    }

    if (format === 'csv') {
      let csv = 'Date,Medication,Scheduled Time,Minutes Late,Reason\n';
      missedDoses.forEach(dose => {
        const date = dose.scheduledTime.toISOString().split('T')[0];
        const medication = (dose.medication?.name || dose.regimen?.medication?.name || 'Unknown').replace(/"/g, '""');
        const time = dose.scheduledTime.toISOString().split('T')[1].substring(0, 5);
        const minutesLate = dose.minutesLate || 0;
        const reason = (dose.notes || 'Not specified').replace(/"/g, '""');
        
        csv += `"${date}","${medication}","${time}","${minutesLate}","${reason}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=missed-doses.csv');
      return res.send(csv);
    }

    res.status(400).json({ message: 'Invalid format' });
  } catch (error) {
    console.error('Export missed doses error:', error);
    res.status(500).json({ message: 'Server error while exporting missed doses' });
  }
});

// @route   GET /api/reports/calendar-data/export
// @desc    Export calendar data as PDF or CSV
// @access  Private
router.get('/calendar-data/export', auth, [
  query('format').isIn(['pdf', 'csv']).withMessage('Valid format is required'),
  query('year').optional().isInt({ min: 2020, max: 2030 })
], validateRequest, async (req, res) => {
  try {
    const { format, year = new Date().getFullYear() } = req.query;

    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year}-12-31`);

    // Get calendar data
    const calendarData = await DoseLog.aggregate([
      {
        $match: {
          user: req.user._id,
          scheduledTime: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$scheduledTime' }
          },
          totalDoses: { $sum: 1 },
          takenDoses: {
            $sum: { $cond: [{ $eq: ['$status', 'taken'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          date: '$_id',
          adherenceRate: {
            $multiply: [{ $divide: ['$takenDoses', '$totalDoses'] }, 100]
          }
        }
      },
      {
        $sort: { date: 1 }
      }
    ]);

    if (format === 'pdf') {
      const pdfBuffer = await pdfService.generateCalendarReport(calendarData);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=calendar-data.pdf');
      return res.send(pdfBuffer);
    }

    if (format === 'csv') {
      let csv = 'Date,Total Doses,Taken Doses,Adherence Rate\n';
      calendarData.forEach(day => {
        csv += `${day.date},${day.totalDoses},${day.takenDoses},${day.adherenceRate.toFixed(2)}\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=calendar-data.csv');
      return res.send(csv);
    }

    res.status(400).json({ message: 'Invalid format' });
  } catch (error) {
    console.error('Export calendar data error:', error);
    res.status(500).json({ message: 'Server error while exporting calendar data' });
  }
});

module.exports = router;
