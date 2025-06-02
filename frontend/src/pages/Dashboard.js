import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, LoadingSpinner, Alert, AdherenceStats, AdherenceDashboard } from '../components';
import ExportManager from '../components/ExportManager';
import useAuthStore from '../store/authStore';
import useDoseStore from '../store/doseStore';
import useRegimenStore from '../store/regimenStore';
import { formatDate, generateTodaySchedule, getScheduleStats } from '../utils';
import doseService from '../services/doseService';
import { notificationService } from '../services/notificationService';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [actionLoading, setActionLoading] = useState({});
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);  const { 
    todayDoses, 
    getTodayTakenDoses, 
    getTodayMissedDoses,
    fetchTodaysDoses,
    logDoseAPI,
    loading: doseLoading,
    error: doseError 
  } = useDoseStore();
  const { 
    regimens, 
    fetchRegimens, 
    loading: regimenLoading,
    error: regimenError 
  } = useRegimenStore();

  useEffect(() => {
    // Initialize data on component mount
    const initializeData = async () => {
      try {
        await Promise.all([
          fetchRegimens(),
          fetchTodaysDoses()
        ]);
      } catch (error) {
        console.error('Failed to fetch data:', error.message || error);
      }
    };
      initializeData();
  }, [fetchRegimens, fetchTodaysDoses]);
  // Handler functions for dose actions
  const handleDoseAction = useCallback(async (dose, action) => {
    const doseKey = dose._id || `${dose.regimen?._id}-${dose.scheduledTime}`;
    setActionLoading(prev => ({ ...prev, [doseKey]: true }));

    try {
      const regimenId = dose.regimen?._id || dose.regimen;
      const timestamp = dose.scheduledTime || new Date();

      switch (action) {
        case 'taken':
          await doseService.markDoseTaken(regimenId, timestamp);
          notificationService.showToast('success', 'Dose marked as taken!');
          break;
        case 'skipped':
          await doseService.markDoseSkipped(regimenId, timestamp);
          notificationService.showToast('info', 'Dose marked as skipped');
          break;        case 'late':
          // Use logDoseAPI for late doses to properly track timing
          const lateDoseData = {
            regimen: regimenId,
            medication: dose.regimen?.medication,
            scheduledTime: timestamp instanceof Date ? timestamp.toISOString() : new Date(timestamp).toISOString(),
            actualTime: new Date().toISOString(),
            status: 'taken',
            notes: 'Taken late'
          };
          await logDoseAPI(lateDoseData);
          notificationService.showToast('success', 'Late dose logged successfully!');
          break;
        default:
          break;
      }
      
      // Refresh today's doses after action
      await fetchTodaysDoses();
    } catch (error) {
      console.error('Failed to perform dose action:', error);
      notificationService.showToast('error', 'Failed to update dose status');
    } finally {
      setActionLoading(prev => ({ ...prev, [doseKey]: false }));
    }
  }, [logDoseAPI, fetchTodaysDoses]);
  const handleViewAll = useCallback(() => {
    navigate('/dose-logging');
  }, [navigate]);
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

  // Helper function to safely format regimen dosage
  const formatRegimenDosage = (regimen) => {
    if (regimen.dosage) {
      const dosage = regimen.dosage;
      if (typeof dosage === 'object' && dosage.amount && dosage.unit) {
        return `${dosage.amount} ${dosage.unit}`;
      }
      if (typeof dosage === 'string') {
        return dosage;
      }
    }
    return 'Standard dose';
  };

  // Generate complete schedule including pending doses from regimens
  const todaySchedule = generateTodaySchedule(regimens, todayDoses);
  const scheduleStats = getScheduleStats(todaySchedule);
  
  const takenToday = scheduleStats.taken;
  const missedToday = scheduleStats.missed; // Includes overdue doses
  const totalToday = scheduleStats.total;
  const adherenceRate = scheduleStats.adherenceRate;

  const getAdherenceColor = (rate) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAdherenceBgColor = (rate) => {
    if (rate >= 90) return 'bg-gradient-to-br from-green-500 to-green-600';
    if (rate >= 70) return 'bg-gradient-to-br from-yellow-500 to-yellow-600';
    return 'bg-gradient-to-br from-red-500 to-red-600';
  };
  if (doseLoading || regimenLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-medical-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-medical-600 font-medium">Loading your medication dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome Back{user?.firstName ? `, ${user.firstName}` : ''}!
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Track your medications and stay on top of your health.
          </p>
        </div>        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
          {/* Today's Schedule */}
          <Card className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">            <div className="p-4 sm:p-6 lg:p-8">
              {/* Header Section */}
              <div className="flex items-center justify-between mb-4 sm:mb-6 lg:mb-8">
                <div className="flex items-center space-x-3 lg:space-x-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-medical-500 to-medical-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white truncate">Today's Schedule</h2>
                    <p className="text-xs sm:text-sm lg:text-base text-gray-600 dark:text-gray-400 font-medium mt-1">
                      Track your medication doses for today
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setIsExportModalOpen(true)}
                  variant="outline"
                  size="sm"
                  className="bg-white/80 hover:bg-white border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md transition-all duration-200 flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export
                </Button>
              </div>

              {/* Schedule Content */}
              <div className="space-y-5">
                {todaySchedule.length === 0 ? (                  <div className="text-center py-12 sm:py-16 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-700 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-600">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-medical-100 to-medical-200 dark:from-medical-900/20 dark:to-medical-800/20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 transform hover:rotate-12 transition-transform duration-300">
                      <svg className="w-10 h-10 sm:w-12 sm:h-12 text-medical-600 dark:text-medical-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-medical-800 to-medical-600 dark:from-medical-400 dark:to-medical-300 bg-clip-text text-transparent mb-2 sm:mb-3">
                      All caught up!
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6 sm:mb-8 max-w-xs mx-auto text-sm sm:text-base leading-relaxed px-4">
                      No medication doses scheduled for today.
                    </p>
                    <Button 
                      onClick={() => navigate('/add-medication')}
                      className="bg-gradient-to-r from-medical-600 to-medical-700 hover:from-medical-700 hover:to-medical-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl group px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base"
                    >
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 inline-block transform group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                      Add Medication
                    </Button>
                  </div>
                ) : (                  <div className="space-y-3 lg:space-y-4">
                    {todaySchedule.slice(0, 5).map((dose) => (
                      <div 
                        key={dose._id} 
                        className="group p-4 lg:p-5 bg-gradient-to-r from-gray-50 to-white dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl lg:rounded-2xl border border-gray-200 dark:border-gray-600 hover:border-medical-300 dark:hover:border-medical-500 hover:shadow-md transition-all duration-300"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          {/* Left Section - Status & Info */}
                          <div className="flex items-center space-x-3 lg:space-x-4 flex-1 min-w-0">
                            {/* Status Indicator */}
                            <div className={`w-3 h-3 lg:w-4 lg:h-4 rounded-full shadow-sm flex-shrink-0 ${
                              dose.status === 'taken' && dose.takenLate ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' :
                              dose.status === 'taken' ? 'bg-gradient-to-r from-green-400 to-green-500' : 
                              dose.status === 'missed' ? 'bg-gradient-to-r from-red-400 to-red-500' :
                              dose.status === 'pending' && dose.isOverdue ? 'bg-gradient-to-r from-orange-400 to-orange-500' :
                              'bg-gray-300 dark:bg-gray-600'
                            }`} />
                            
                            {/* Medication Info */}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
                                <h3 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-white truncate group-hover:text-medical-700 dark:group-hover:text-medical-300 transition-colors">
                                  {dose.regimen?.medication?.name || dose.medication?.name || 'Unknown Medication'}
                                </h3>
                                <span className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400 flex-shrink-0">
                                  {formatDate(dose.scheduledTime || dose.timestamp, 'h:mm a')}
                                </span>
                              </div>
                              
                              <div className="flex items-center text-xs lg:text-sm text-gray-600 dark:text-gray-400 mt-2">
                                <svg className="w-3 h-3 lg:w-4 lg:h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 8.172V5L8 4z" />
                                </svg>
                                <span className="truncate">
                                  {formatDosage(dose)}
                                  {dose.isOverdue && dose.status === 'pending' && (
                                    <span className="ml-2 lg:ml-3 text-orange-600 dark:text-orange-400 font-medium animate-pulse">
                                      {dose.minutesLate} min late
                                    </span>
                                  )}
                                </span>
                              </div>
                              
                              {/* Status Badge */}
                              <div className="mt-2 lg:mt-3">
                                {dose.status === 'taken' && !dose.takenLate && (
                                  <span className="inline-flex items-center px-2 lg:px-3 py-1 rounded-full text-xs lg:text-sm font-medium bg-gradient-to-r from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-700">
                                    ✓ Taken
                                  </span>
                                )}
                                {dose.status === 'taken' && dose.takenLate && (
                                  <span className="inline-flex items-center px-2 lg:px-3 py-1 rounded-full text-xs lg:text-sm font-medium bg-gradient-to-r from-yellow-100 to-yellow-200 dark:from-yellow-900/30 dark:to-yellow-800/30 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700">
                                    ⏰ Taken Late
                                  </span>
                                )}
                                {dose.status === 'missed' && (
                                  <span className="inline-flex items-center px-2 lg:px-3 py-1 rounded-full text-xs lg:text-sm font-medium bg-gradient-to-r from-red-100 to-red-200 dark:from-red-900/30 dark:to-red-800/30 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-700">
                                    ⚠ Missed
                                  </span>
                                )}
                                {dose.status === 'skipped' && (
                                  <span className="inline-flex items-center px-2 lg:px-3 py-1 rounded-full text-xs lg:text-sm font-medium bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 text-gray-800 dark:text-gray-300 border border-gray-300 dark:border-gray-600">
                                    ⊘ Skipped
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Right Section - Action Buttons */}
                          {dose.status === 'pending' && (
                            <div className="flex items-center space-x-2 lg:space-x-3 flex-shrink-0 self-start sm:self-center">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleDoseAction(dose, 'skipped')}
                                disabled={actionLoading[dose._id || `${dose.regimen?._id}-${dose.scheduledTime}`]}
                                className={`min-w-[70px] lg:min-w-[80px] px-3 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm ${
                                  dose.isOverdue 
                                    ? 'border-orange-300 dark:border-orange-600 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20' 
                                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                              >
                                {actionLoading[dose._id || `${dose.regimen?._id}-${dose.scheduledTime}`] ? 'Skipping...' : 'Skip'}
                              </Button>
                              <Button 
                                size="sm"
                                onClick={() => handleDoseAction(dose, dose.isOverdue ? 'late' : 'taken')}
                                disabled={actionLoading[dose._id || `${dose.regimen?._id}-${dose.scheduledTime}`]}
                                className={`min-w-[85px] lg:min-w-[100px] px-3 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm ${
                                  dose.isOverdue 
                                    ? 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white' 
                                    : 'bg-gradient-to-r from-medical-600 to-medical-700 hover:from-medical-700 hover:to-medical-800 text-white'
                                }`}
                              >
                                {actionLoading[dose._id || `${dose.regimen?._id}-${dose.scheduledTime}`] 
                                  ? (dose.isOverdue ? 'Logging...' : 'Taking...') 
                                  : (dose.isOverdue ? 'Log Late' : 'Take Now')
                                }
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {todaySchedule.length > 5 && (
                      <div className="text-center pt-4 lg:pt-6">
                        <Button 
                          variant="ghost" 
                          onClick={handleViewAll}
                          className="text-medical-600 dark:text-medical-400 hover:text-medical-700 dark:hover:text-medical-300 font-medium group px-4 lg:px-6 py-2 lg:py-3 text-sm lg:text-base"
                        >
                          View {todaySchedule.length - 5} more doses
                          <svg className="w-4 h-4 lg:w-5 lg:h-5 ml-2 inline-block transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>          {/* Active Medications */}
          <Card className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
            <div className="p-4 sm:p-6 lg:p-8">
              {/* Header Section */}
              <div className="flex items-center justify-between mb-4 sm:mb-6 lg:mb-8">
                <div className="flex items-center space-x-3 lg:space-x-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 8.172V5L8 4z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white truncate">Active Medications</h2>
                    <p className="text-xs sm:text-sm lg:text-base text-gray-600 dark:text-gray-400 font-medium mt-1">
                      Your current medication regimens
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={() => navigate('/add-medication')}
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0 hidden sm:flex"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden md:inline">Add</span>
                </Button>
              </div>              {/* Active Medications Content */}
              <div className="space-y-3 sm:space-y-4">
                {regimens && regimens.length > 0 ? (
                  regimens.filter(regimen => regimen.isActive).slice(0, 4).map((regimen) => (
                    <div 
                      key={regimen._id} 
                      className="group p-3 sm:p-4 bg-gradient-to-r from-gray-50 to-white dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md transition-all duration-300"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                            {regimen.medication?.name || 'Unknown Medication'}
                          </h3>
                          <div className="flex items-center text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                            <span className="truncate">
                              {formatRegimenDosage(regimen)} • {regimen.frequency?.replace('_', ' ') || 'As needed'}
                            </span>
                          </div>
                          {regimen.purpose && (
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 truncate">
                              For: {regimen.purpose}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-start sm:justify-end">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-700">
                            Active
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 sm:py-12 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-700 rounded-xl border border-gray-100 dark:border-gray-600">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/20 dark:to-blue-800/20 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <svg className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 8.172V5L8 4z" />
                      </svg>
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2">No Active Medications</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm max-w-xs mx-auto mb-4 sm:mb-0">
                      Add your first medication to start tracking.
                    </p>
                    <Button 
                      onClick={() => navigate('/add-medication')}
                      size="sm"
                      className="mt-4 sm:hidden bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                      Add Medication
                    </Button>
                  </div>
                )}
                
                {regimens && regimens.filter(r => r.isActive).length > 4 && (
                  <div className="text-center pt-2">
                    <Button 
                      variant="ghost" 
                      onClick={() => navigate('/medications')}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm"
                    >
                      View {regimens.filter(r => r.isActive).length - 4} more medications
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Adherence Statistics Section */}
        <div className="mt-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Adherence Statistics</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Track your medication adherence over time
            </p>
          </div>
          <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
            <AdherenceStats className="border-0 shadow-none bg-transparent" />
          </div>
        </div>

        {/* Reports and Charts */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Additional cards with same styling */}
          {/* ...existing code for reports and charts... */}
        </div>
      </div>

      {/* Export Manager Modal */}
      <ExportManager 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
      />
    </div>
  );
};

export default React.memo(Dashboard);
