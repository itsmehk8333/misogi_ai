import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Button, Alert, LoadingSpinner } from '../components';
import ExportManager from '../components/ExportManager';
import useDoseStore from '../store/doseStore';
import useRegimenStore from '../store/regimenStore';
import useAuthStore from '../store/authStore';
import { doseService } from '../services/doseService';
import { formatDate } from '../utils';

const DoseLogging = () => {
  const { user } = useAuthStore();
  const { 
    logDoseAPI, 
    todayDoses, 
    fetchTodaysDoses,
    loading: doseLoading,
    error: doseError 
  } = useDoseStore();
  
  const { 
    regimens, 
    fetchRegimens,
    loading: regimenLoading 
  } = useRegimenStore();

  const [selectedDose, setSelectedDose] = useState(null);
  const [showLateWarning, setShowLateWarning] = useState(false);
  const [doseForm, setDoseForm] = useState({
    status: 'taken',
    notes: '',
    sideEffects: [],
    effectiveness: { rating: 3, notes: '' },
    withFood: null,
    mood: '',
    symptoms: [], // Ensure this is always an empty array
    location: ''
  });
  
  const [newSideEffect, setNewSideEffect] = useState('');
  const [newSymptom, setNewSymptom] = useState({ name: '', severity: 5 });
  const [showRewards, setShowRewards] = useState(false);
  const [earnedRewards, setEarnedRewards] = useState(null);

  const [viewMode, setViewMode] = useState('list');
  const [showFilters, setShowFilters] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    status: 'all', // all, pending, taken, missed, skipped
    medication: 'all',
    timeRange: 'today' // today, week, month
  });  useEffect(() => {
    fetchRegimens();
    fetchTodaysDoses();
  }, [fetchRegimens, fetchTodaysDoses]);

  // Helper functions defined before generateTodaySchedule
  const isRegimenActiveToday = useCallback((regimen) => {
    const today = new Date();
    const startDate = new Date(regimen.startDate);
    const endDate = regimen.endDate ? new Date(regimen.endDate) : null;
    
    return today >= startDate && (!endDate || today <= endDate);
  }, []);

  const shouldTakeToday = useCallback((regimen) => {
    const today = new Date();
    const startDate = new Date(regimen.startDate);
    const daysDiff = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
    
    if (regimen.frequency === 'every_other_day') {
      return daysDiff % 2 === 0;
    }
    
    if (regimen.frequency === 'weekly') {
      return daysDiff % 7 === 0;
    }
    
    return true;
  }, []);

  const getScheduleTimes = useCallback((regimen) => {
    if (regimen.frequency === 'custom') {
      return regimen.customSchedule?.map(item => item.time) || [];
    }
    
    const schedules = {
      'once_daily': ['08:00'],
      'twice_daily': ['08:00', '20:00'],
      'three_times_daily': ['08:00', '14:00', '20:00'],
      'four_times_daily': ['08:00', '12:00', '16:00', '20:00'],
      'every_other_day': shouldTakeToday(regimen) ? ['08:00'] : [],
      'weekly': shouldTakeToday(regimen) ? ['08:00'] : [],
      'as_needed': []
    };
    
    return schedules[regimen.frequency] || [];
  }, [shouldTakeToday]);

  // Generate today's dose schedule with memoization
  const generateTodaySchedule = useMemo(() => {
    const today = new Date();
    const schedule = [];
    
    // Only proceed if regimens is an array
    if (!Array.isArray(regimens)) {
      return [...(Array.isArray(todayDoses) ? todayDoses : [])];
    }
    
    regimens
      .filter(regimen => regimen && regimen.isActive && isRegimenActiveToday(regimen))
      .forEach(regimen => {
        const times = getScheduleTimes(regimen);
        times.forEach(time => {
          const [hours, minutes] = time.split(':');
          const scheduledTime = new Date(today);
          scheduledTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          
          // Check if this dose is already logged (more flexible matching)
          const existingDose = todayDoses.find(dose => {
            if (!dose) return false;
            const doseRegimenId = dose.regimen?._id || dose.regimen;
            return doseRegimenId === regimen._id && 
              Math.abs(new Date(dose.scheduledTime) - scheduledTime) < 30 * 60 * 1000; // 30 min tolerance
          });
          
          if (!existingDose) {
            schedule.push({
              regimen,
              scheduledTime,
              status: 'pending',
              timeString: time,
              isOverdue: scheduledTime < new Date(),
              minutesLate: scheduledTime < new Date() ? 
                Math.floor((new Date() - scheduledTime) / (1000 * 60)) : 0
            });
          }
        });
      });
    
    // Ensure todayDoses is an array and filter out invalid entries
    const validTodayDoses = (Array.isArray(todayDoses) ? todayDoses : [])
      .filter(dose => dose && dose.regimen);
      return [...schedule, ...validTodayDoses].sort((a, b) => 
      new Date(a.scheduledTime) - new Date(b.scheduledTime)
    );
  }, [regimens, todayDoses, isRegimenActiveToday, getScheduleTimes]);

  // Helper function to safely get medication name
  const getMedicationName = (dose) => {
    if (dose.regimen?.medication?.name) {
      return dose.regimen.medication.name;
    }
    if (dose.medication?.name) {
      return dose.medication.name;
    }
    return 'Unknown Medication';
  };

  // Helper function to safely get dosage
  const getDosage = (dose) => {
    const dosage = dose.regimen?.dosage || dose.dosage;
    if (dosage?.amount && dosage?.unit) {
      return `${dosage.amount} ${dosage.unit}`;
    }
    return 'Standard dose';
  };

  // Helper function to safely format dosage
  const formatDosage = (dose) => {
    if (dose.dosage && typeof dose.dosage === 'string') {
      return dose.dosage;
    }
    if (dose.regimen?.dosage) {
      const dosage = dose.regimen.dosage;
      if (typeof dosage === 'object' && dosage.amount && dosage.unit) {
        return `${dosage.amount} ${dosage.unit}`;
      }
      if (typeof dosage === 'string') {
        return dosage;
      }
    }
    return 'Standard dose';
  };

  // Filter doses based on current filter settings
  const getFilteredDoses = () => {
    let filtered = [...todaySchedule];
    
    // Filter by status
    if (filters.status !== 'all') {
      filtered = filtered.filter(dose => {
        if (filters.status === 'pending') {
          return dose.status === 'pending' || !dose.status;
        }
        return dose.status === filters.status;
      });
    }
    
    // Filter by medication
    if (filters.medication !== 'all') {
      filtered = filtered.filter(dose => {
        const medName = getMedicationName(dose);
        return medName === filters.medication;
      });
    }
    
    // Filter by time range
    if (filters.timeRange !== 'today') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(dose => {
        const doseDate = new Date(dose.scheduledTime || dose.timestamp);
        
        if (filters.timeRange === 'week') {
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6); // End of week (Saturday)
          weekEnd.setHours(23, 59, 59, 999);
          return doseDate >= weekStart && doseDate <= weekEnd;
        }
        
        if (filters.timeRange === 'month') {
          const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
          const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          monthEnd.setHours(23, 59, 59, 999);
          return doseDate >= monthStart && doseDate <= monthEnd;
        }
        
        return true;
      });
    }
    
    return filtered;
  };

  const handleLogDose = (dose) => {
    if (!dose) return;
    
    const now = new Date();
    const scheduledTime = new Date(dose.scheduledTime);
    
    // If status is skipped, bypass late checks and log immediately
    if (doseForm.status === 'skipped') {
      setSelectedDose(dose);
      submitDoseLog();
      return;
    }

    const minutesLate = Math.floor((now - scheduledTime) / (1000 * 60));
    const maxLateMinutes = user?.preferences?.lateLoggingWindow || 240; // 4 hours
    
    // Check if logging is too late
    if (minutesLate > maxLateMinutes) {
      setShowLateWarning(true);
      setSelectedDose({ ...dose, minutesLate, isOutsideWindow: true });
      return;
    }
    
    // Show warning if late but within window
    if (minutesLate > 60) {
      setShowLateWarning(true);
      setSelectedDose({ ...dose, minutesLate, isOutsideWindow: false });
      return;
    }
    
    // Proceed with normal logging
    setSelectedDose(dose);
    if (!doseForm.status) {
      setDoseForm({
        status: 'taken',
        notes: '',
        sideEffects: [],
        effectiveness: { rating: 3, notes: '' },
        withFood: null,
        mood: '',
        symptoms: [],
        location: ''
      });
    }
  };  const submitDoseLog = async () => {
    if (!selectedDose) return;
    
    try {
      let loggedDose;
      
      // Ensure scheduledTime is properly formatted
      const scheduledTimeISO = selectedDose.scheduledTime instanceof Date 
        ? selectedDose.scheduledTime.toISOString()
        : new Date(selectedDose.scheduledTime).toISOString();
      
      if (doseForm.status === 'skipped') {
        // Use the specific skip endpoint
        loggedDose = await doseService.markDoseSkipped(
          selectedDose.regimen._id || selectedDose.regimen,
          scheduledTimeISO,
          doseForm.notes
        );
      } else {        // For other statuses, use the general log endpoint
        const doseData = {
          regimen: selectedDose.regimen._id || selectedDose.regimen,
          scheduledTime: scheduledTimeISO,
          status: doseForm.status
        };
        
        // For taken doses, include all fields
        if (doseForm.status === 'taken') {
          doseData.actualTime = new Date().toISOString();
          doseData.notes = doseForm.notes;
          doseData.sideEffects = doseForm.sideEffects;
          doseData.effectiveness = doseForm.effectiveness;
          doseData.withFood = doseForm.withFood;
          doseData.mood = doseForm.mood;
          doseData.symptoms = doseForm.symptoms;
          doseData.location = doseForm.location;
        } else if (doseForm.status === 'missed' && doseForm.notes) {
          // Include notes for missed doses if provided
          doseData.notes = doseForm.notes;
        }
        
        loggedDose = await logDoseAPI(doseData);
      }
      
      // Calculate and show rewards
      if (loggedDose.rewards) {
        setEarnedRewards(loggedDose.rewards);
        setShowRewards(true);
      }
      
      // Close modal and refresh
      setSelectedDose(null);
      setShowLateWarning(false);
      await fetchTodaysDoses();
    } catch (error) {
      console.error('Failed to log dose:', error.message || error);
    }
  };

  const addSideEffect = () => {
    if (newSideEffect.trim()) {
      setDoseForm(prev => ({
        ...prev,
        sideEffects: [...prev.sideEffects, newSideEffect.trim()]
      }));
      setNewSideEffect('');
    }
  };

  const removeSideEffect = (index) => {
    setDoseForm(prev => ({
      ...prev,
      sideEffects: prev.sideEffects.filter((_, i) => i !== index)
    }));
  };

  const addSymptom = () => {
    if (newSymptom.name && newSymptom.name.trim() && newSymptom.severity) {
      setDoseForm(prev => ({
        ...prev,
        symptoms: [...prev.symptoms, { 
          name: newSymptom.name.trim(),
          severity: parseInt(newSymptom.severity) || 5 
        }]
      }));
      setNewSymptom({ name: '', severity: 5 });
    }
  };

  const removeSymptom = (index) => {
    setDoseForm(prev => {
      // Filter out invalid symptoms first, then remove by index
      const validSymptoms = prev.symptoms.filter(symptom => symptom && symptom.name);
      return {
        ...prev,
        symptoms: validSymptoms.filter((_, i) => i !== index)
      };
    });
  };

  const getStatusColor = (status, isOverdue) => {
    if (status === 'taken') return 'bg-green-100 text-green-800';
    if (status === 'missed') return 'bg-red-100 text-red-800';
    if (status === 'skipped') return 'bg-yellow-100 text-yellow-800';
  if (isOverdue) return 'bg-orange-100 text-orange-800';
    return 'bg-gray-100 text-gray-800';
  };

  const todaySchedule = generateTodaySchedule;
  const isLoading = doseLoading || regimenLoading;

  // Format time helper function
  const formatTime = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };  // Handle dose actions
  const handleDoseAction = async (dose, action) => {
    console.log('handleDoseAction called:', { dose, action });
    
    // For skipped and more complex actions, open the modal
    if (action === 'skipped') {
      setSelectedDose(dose);
      setDoseForm(prev => ({ ...prev, status: 'skipped' }));
      return;
    }
    
    // For late doses, show warning and open modal
    if (dose.isOverdue && action === 'taken') {
      setSelectedDose(dose);
      setDoseForm(prev => ({ ...prev, status: 'taken' }));
      setShowLateWarning(true);
      return;
    }
    
    // For simple taken/missed actions, call API directly
    try {
      const regimenId = dose.regimen?._id || dose.regimen;
      
      // Ensure timestamp is a proper Date object
      let timestamp;
      if (dose.scheduledTime instanceof Date) {
        timestamp = dose.scheduledTime;
      } else if (typeof dose.scheduledTime === 'string') {
        timestamp = new Date(dose.scheduledTime);
      } else {
        timestamp = new Date();
      }
      
      console.log('Calling dose action with:', { regimenId, timestamp: timestamp.toISOString(), action });

      if (action === 'taken') {
        console.log('Marking dose as taken...');
        await useDoseStore.getState().markDoseTaken(regimenId, timestamp, '');
        console.log('Dose marked as taken successfully');
      } else if (action === 'missed') {
        console.log('Marking dose as missed...');
        await useDoseStore.getState().markDoseMissed(regimenId, timestamp, '');
        console.log('Dose marked as missed successfully');
      }

      // Refresh today's doses after logging
      console.log('Refreshing today\'s doses...');
      await fetchTodaysDoses();
      console.log('Today\'s doses refreshed successfully');

    } catch (error) {
      console.error('Failed to log dose:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
  };

  // Calendar view implementation
  const renderCalendarView = () => {
    const filteredDoses = getFilteredDoses();
    const today = new Date();
    
    // Group doses by hour for calendar view
    const dosesByHour = {};
    filteredDoses.forEach(dose => {
      const hour = new Date(dose.scheduledTime || dose.timestamp).getHours();
      if (!dosesByHour[hour]) {
        dosesByHour[hour] = [];
      }
      dosesByHour[hour].push(dose);
    });

    // Generate hours from 6 AM to 11 PM
    const hours = Array.from({ length: 18 }, (_, i) => i + 6);

    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {formatDate(today)} - Daily Schedule
            </h3>
          </div>
          
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {hours.map(hour => {
              const hourDoses = dosesByHour[hour] || [];
              const timeString = `${hour.toString().padStart(2, '0')}:00`;
              
              return (
                <div key={hour} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-16">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {hour === 0 ? '12 AM' : hour <= 12 ? `${hour} AM` : `${hour - 12} PM`}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {timeString}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      {hourDoses.length === 0 ? (
                        <div className="text-sm text-gray-400 dark:text-gray-500 italic">
                          No medications scheduled
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {hourDoses.map((dose, index) => (
                            <div 
                              key={dose._id || `pending-${index}`}
                              className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm"
                            >
                              <div className="flex items-center space-x-3">
                                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${getStatusColor(dose.status, dose.isOverdue)}`} />
                                <div>
                                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                                    {getMedicationName(dose)}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {formatDosage(dose)} • {formatTime(dose.scheduledTime)}
                                  </div>
                                  {dose.status === 'taken' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 mt-1">
                                      Taken {dose.takenLate ? '(Late)' : ''}
                                    </span>
                                  )}
                                  {dose.status === 'missed' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 mt-1">
                                      Missed
                                    </span>
                                  )}
                                  {dose.status === 'pending' && dose.isOverdue && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 mt-1">
                                      {dose.minutesLate} min overdue
                                    </span>
                                  )}
                                </div>
                              </div>
                                {dose.status === 'pending' && (
                                <div className="flex items-center space-x-2">
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handleDoseAction(dose, 'taken')}
                                    className="min-w-[80px]"
                                  >
                                    Take
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDoseAction(dose, 'skipped')}
                                    className="min-w-[80px]"
                                  >
                                    Skip
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDoseAction(dose, 'missed')}
                                    className="min-w-[80px]"
                                  >
                                    Missed
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header Section with improved styling */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="mb-4 md:mb-0">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Today's Schedule</h1>
              <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
                Track your medication doses for today
              </p>
            </div>
            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                className="flex items-center space-x-2 px-4"
                onClick={() => setShowFilters(prev => !prev)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
                <span>Filter</span>
              </Button>
              <Button 
                variant="outline"
                className="flex items-center space-x-2 px-4"
                onClick={() => setViewMode(prev => prev === 'list' ? 'calendar' : 'list')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 012 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>View</span>
              </Button>
              <Button 
                variant="primary"
                className="flex items-center space-x-2 px-4"
                onClick={() => setIsExportModalOpen(true)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Export</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">        {/* Filter Panel */}
        {showFilters && (
          <div className="mb-6">
            <Card className="p-6 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-700 border border-gray-200 dark:border-gray-600">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Filter Doses</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Status
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-medical-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="taken">Taken</option>
                    <option value="missed">Missed</option>
                    <option value="skipped">Skipped</option>
                  </select>
                </div>

                {/* Medication Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Medication
                  </label>
                  <select
                    value={filters.medication}
                    onChange={(e) => setFilters(prev => ({ ...prev, medication: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-medical-500"
                  >
                    <option value="all">All Medications</option>
                    {[...new Set(todaySchedule.map(dose => dose.regimen?.medication?.name || dose.medication?.name).filter(Boolean))].map(medName => (
                      <option key={medName} value={medName}>{medName}</option>
                    ))}
                  </select>
                </div>

                {/* Time Range Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Time Range
                  </label>
                  <select
                    value={filters.timeRange}
                    onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-medical-500"
                  >
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                  </select>
                </div>
              </div>
              
              {/* Clear Filters Button */}
              <div className="mt-4 flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setFilters({ status: 'all', medication: 'all', timeRange: 'today' })}
                  className="text-sm"
                >
                  Clear Filters
                </Button>
              </div>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Doses List */}          <div className="lg:col-span-8">
            <div className="space-y-6">              {isLoading ? (
                <Card className="p-8">
                  <div className="flex justify-center">
                    <LoadingSpinner size="lg" />
                  </div>
                </Card>
              ) : getFilteredDoses().length === 0 ? (
                <Card className="p-8 text-center">
                  <div className="flex flex-col items-center space-y-4">
                    <svg className="w-16 h-16 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">No doses found</h3>
                    <p className="text-gray-600 dark:text-gray-400">Try adjusting your filters or add medications to start tracking.</p>
                  </div>
                </Card>
              ) : viewMode === 'calendar' ? (
                renderCalendarView()
              ) : (
                getFilteredDoses().map((dose, index) => (
                  <Card 
                    key={dose._id || `pending-${index}`}
                    className="transform transition-all duration-200 hover:shadow-md"
                  >
                    <div className="p-6 flex items-start space-x-4">
                      {/* Status Indicator */}
                      <div className={`w-3 h-3 mt-2 rounded-full flex-shrink-0 ${getStatusColor(dose.status, dose.isOverdue)}`} />
                      
                      {/* Dose Information */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {dose.regimen?.medication?.name || 'Medication'}
                          </h3>
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            {formatTime(dose.scheduledTime)}
                          </span>
                        </div>
                        
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          {dose.regimen?.dosage?.amount} {dose.regimen?.dosage?.unit}
                        </p>
                        
                        {dose.status === 'taken' && (
                          <div className="mt-2 flex items-center space-x-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              Taken
                            </span>
                            {dose.takenLate && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                                Late
                              </span>
                            )}
                          </div>
                        )}
                        
                        {dose.status === 'missed' && (
                          <span className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            Missed
                          </span>
                        )}
                        
                        {dose.status === 'pending' && dose.isOverdue && (
                          <span className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                            {dose.minutesLate} minutes overdue
                          </span>
                        )}
                      </div>
                      
                      {/* Action Buttons */}
                      {dose.status === 'pending' && (
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleDoseAction(dose, 'taken')}
                            className="min-w-[100px]"
                          >
                            Take Now
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDoseAction(dose, 'missed')}
                            className="min-w-[100px]"
                          >
                            Skip
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* Quick Stats */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Today's Progress</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Doses Taken</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {todaySchedule.filter(d => d.status === 'taken').length} / {todaySchedule.length}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-medical-500 dark:bg-medical-600 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${(todaySchedule.filter(d => d.status === 'taken').length / todaySchedule.length) * 100}%` 
                      }}
                    />                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Late Warning Modal */}
      {showLateWarning && selectedDose && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-orange-100 mb-4">
                <svg className="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {selectedDose.isOutsideWindow ? 'Too Late to Log' : 'Late Dose Warning'}
              </h3>
              
              <p className="text-sm text-gray-500 mb-4">
                {selectedDose.isOutsideWindow ? 
                  `This dose was scheduled ${selectedDose.minutesLate} minutes ago, which is outside the 4-hour logging window. You can still log it as missed.` :
                  `This dose was scheduled ${selectedDose.minutesLate} minutes ago. You can still log it, but it will be marked as late.`
                }
              </p>
              
              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowLateWarning(false);
                    setSelectedDose(null);
                  }}
                >
                  Cancel
                </Button>
                
                {selectedDose.isOutsideWindow ? (
                  <Button
                    onClick={() => {
                      setDoseForm(prev => ({ ...prev, status: 'missed' }));
                      setShowLateWarning(false);
                    }}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Mark as Missed
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setShowLateWarning(false);
                    }}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    Log as Late
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Dose Logging Modal */}
      {selectedDose && !showLateWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <Card className="max-w-2xl w-full p-6 max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-gray-900">
                Log Dose: {getMedicationName(selectedDose)}
              </h3>
              <button
                onClick={() => setSelectedDose(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['taken', 'missed', 'skipped'].map(status => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setDoseForm(prev => ({ ...prev, status }))}
                      className={`p-3 rounded-lg border text-center ${
                        doseForm.status === status
                          ? 'border-medical-500 bg-medical-50 text-medical-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {doseForm.status === 'taken' && (
                <>
                  {/* Effectiveness */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      How effective was this dose? (1-5)
                    </label>
                    <div className="flex space-x-2">
                      {[1, 2, 3, 4, 5].map(rating => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => setDoseForm(prev => ({
                            ...prev,
                            effectiveness: { ...prev.effectiveness, rating }
                          }))}
                          className={`w-10 h-10 rounded-full border ${
                            doseForm.effectiveness.rating === rating
                              ? 'border-medical-500 bg-medical-500 text-white'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          {rating}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mood */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mood
                    </label>
                    <select
                      value={doseForm.mood}
                      onChange={(e) => setDoseForm(prev => ({ ...prev, mood: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-medical-500"
                    >
                      <option value="">Select mood</option>
                      <option value="excellent">Excellent</option>
                      <option value="good">Good</option>
                      <option value="okay">Okay</option>
                      <option value="poor">Poor</option>
                      <option value="terrible">Terrible</option>
                    </select>
                  </div>

                  {/* With Food */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Taken with food?
                    </label>
                    <div className="flex space-x-4">
                      <button
                        type="button"
                        onClick={() => setDoseForm(prev => ({ ...prev, withFood: true }))}
                        className={`px-4 py-2 rounded-md border ${
                          doseForm.withFood === true
                            ? 'border-medical-500 bg-medical-50 text-medical-700'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setDoseForm(prev => ({ ...prev, withFood: false }))}
                        className={`px-4 py-2 rounded-md border ${
                          doseForm.withFood === false
                            ? 'border-medical-500 bg-medical-50 text-medical-700'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>

                  {/* Side Effects */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Side Effects
                    </label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newSideEffect}
                          onChange={(e) => setNewSideEffect(e.target.value)}
                          placeholder="Add a side effect"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-medical-500"
                        />
                        <Button 
                          type="button" 
                          onClick={addSideEffect}
                          variant="outline"
                          size="sm"
                        >
                          Add
                        </Button>
                      </div>
                      
                      {doseForm.sideEffects.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {doseForm.sideEffects.map((effect, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-100 text-red-800"
                            >
                              {effect}
                              <button
                                type="button"
                                onClick={() => removeSideEffect(index)}
                                className="ml-2 text-red-600 hover:text-red-800"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Symptoms */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Symptoms
                    </label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newSymptom.name}
                          onChange={(e) => setNewSymptom(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Symptom name"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-medical-500"
                        />
                        <select
                          value={newSymptom.severity}
                          onChange={(e) => setNewSymptom(prev => ({ ...prev, severity: parseInt(e.target.value) }))}
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-medical-500"
                        >
                          {[1,2,3,4,5,6,7,8,9,10].map(i => (
                            <option key={i} value={i}>{i}</option>
                          ))}
                        </select>
                        <Button 
                          type="button" 
                          onClick={addSymptom}
                          variant="outline"
                          size="sm"
                        >
                          Add
                        </Button>
                      </div>
                      
                      {/* FIXED: Safe rendering of symptoms with proper filtering */}
                      {(() => {
                        const symptoms = Array.isArray(doseForm.symptoms) ? doseForm.symptoms : [];
                        const validSymptoms = symptoms.filter(symptom => 
                          symptom && 
                          typeof symptom === 'object' && 
                          symptom.name && 
                          typeof symptom.name === 'string' && 
                          symptom.name.trim() !== ''
                        );
                        
                        return validSymptoms.length > 0 ? (
                          <div className="space-y-2">
                            {validSymptoms.map((symptom, index) => (
                              <div
                                key={`symptom-${index}-${symptom.name}`}
                                className="flex items-center justify-between p-2 bg-gray-50 rounded"
                              >
                                <span>{symptom.name} (Severity: {symptom.severity}/10)</span>
                                <button
                                  type="button"
                                  onClick={() => removeSymptom(index)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={doseForm.notes}
                  onChange={(e) => setDoseForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any additional notes..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-medical-500"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-3 mt-6 pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => setSelectedDose(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={submitDoseLog}
                disabled={doseLoading}
              >
                {doseLoading ? <LoadingSpinner size="sm" /> : 'Log Dose'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Rewards Modal */}
      {showRewards && earnedRewards && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full p-6 text-center">
            <div className="mb-4">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">Great Job!</h3>
            <p className="text-sm text-gray-500 mb-4">You earned {earnedRewards.points} points!</p>
            
            {earnedRewards.bonusPoints > 0 && (
              <div className="bg-yellow-50 p-3 rounded-lg mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>Bonus:</strong> +{earnedRewards.bonusPoints} points for {earnedRewards.reasonForBonus}
                </p>
              </div>
            )}
            
            {earnedRewards.streak > 0 && (
              <p className="text-sm text-gray-600 mb-4">
                Current streak: {earnedRewards.streak} days
              </p>
            )}
            
            <Button
              onClick={() => {
                setShowRewards(false);
                setEarnedRewards(null);
              }}
            >
              Continue
            </Button>
          </Card>
        </div>
      )}

      {/* Export Modal */}
      <ExportManager
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
};

export default React.memo(DoseLogging);
