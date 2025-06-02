import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, LoadingSpinner } from './';
import { reportService } from '../services/reportService';
import { Doughnut } from 'react-chartjs-2';

const AdherenceStats = ({ className = '' }) => {
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [error, setError] = useState(null);

  const fetchAdherenceStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await reportService.getAdherenceStats(period);
      setStatsData(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch adherence stats:', err);
      setError('Failed to load adherence statistics');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAdherenceStats();
  }, [fetchAdherenceStats]);
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.raw || 0;
            return `${label}: ${value}%`;
          }
        }
      }
    },
    elements: {
      arc: {
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    }
  }), []);
  const getChartData = useMemo(() => {
    if (!statsData) return null;
    
    return {
      labels: ['Taken', 'Missed', 'Skipped'],
      datasets: [{
        data: [
          statsData.takenPercentage || 0,
          statsData.missedPercentage || 0,
          statsData.skippedPercentage || 0
        ],
        backgroundColor: [
          '#22c55e', // green-500
          '#ef4444', // red-500
          '#eab308'  // yellow-500
        ],
        borderColor: '#ffffff',
        borderWidth: 2,
      }]
    };
  }, [statsData]);
  const getTrendIcon = useCallback((trend) => {
    if (!trend) return '→';
    return trend > 0 ? '↑' : '↓';
  }, []);

  const getTrendColor = useCallback((trend, positive = true) => {
    if (!trend) return 'text-gray-500';
    if (positive) {
      return trend > 0 ? 'text-green-600' : 'text-red-600';
    }
    return trend > 0 ? 'text-red-600' : 'text-green-600';
  }, []);

  return (
    <div className={`overflow-hidden ${className}`}>
      {/* Header with period selector */}
      <div className="p-8 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6">
          <div className="flex items-center space-x-5">
            <div className="w-16 h-16 bg-gradient-to-br from-medical-500 to-medical-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                Adherence Statistics
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 font-medium mt-2">
                Your medication adherence overview
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {['week', 'month', 'year'].map((p) => (
              <button 
                key={p}
                className={`px-6 py-3 text-base font-semibold rounded-xl transition-all duration-200 ${
                  period === p 
                    ? 'bg-gradient-to-r from-medical-600 to-medical-700 text-white shadow-lg shadow-medical-500/25' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                }`}
                onClick={() => setPeriod(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-8">
        {loading ? (
          <div className="flex flex-col justify-center items-center h-64">
            <LoadingSpinner size="lg" className="text-medical-600" />
            <p className="mt-4 text-base text-medical-700 dark:text-medical-300 font-medium">Loading adherence data...</p>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-64 text-red-500 text-center">
            <div>
              <div className="mb-4 text-4xl">⚠️</div>
              <div className="text-base font-medium">{error}</div>
            </div>
          </div>
        ) : statsData ? (
          <div className="space-y-8">
            {/* Main Content Grid - Responsive layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Stats Cards - Left Column */}
              <div className="space-y-6">
                {/* Overall Adherence Card */}
                <div className="bg-gradient-to-br from-medical-50 via-white to-blue-50 dark:from-medical-900/20 dark:via-gray-800 dark:to-blue-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-700/50 shadow-sm hover:shadow-md transition-shadow duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Overall Adherence</h3>
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-4xl lg:text-5xl font-bold text-blue-700 dark:text-blue-400 mb-3">
                    {statsData.overallAdherence || 0}%
                  </p>
                  <p className={`text-sm ${getTrendColor(statsData.adherenceTrend)} flex items-center font-medium`}>
                    <span className="mr-2 text-lg">{getTrendIcon(statsData.adherenceTrend)}</span>
                    {Math.abs(statsData.adherenceTrend || 0)}% from previous {period}
                  </p>
                </div>

                {/* Taken On Time Card */}
                <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-2xl p-5 border border-green-200 dark:border-green-700/50">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-green-700 dark:text-green-400">Taken On Time</h3>
                    <div className="w-3 h-3 bg-green-500 rounded-full shadow-sm"></div>
                  </div>
                  <p className="text-3xl lg:text-4xl font-bold text-green-700 dark:text-green-400 mb-2">
                    {statsData.takenOnTimePercentage || 0}%
                  </p>
                  <p className={`text-sm ${getTrendColor(statsData.takenOnTimeTrend)} flex items-center font-medium`}>
                    <span className="mr-2">{getTrendIcon(statsData.takenOnTimeTrend)}</span>
                    {Math.abs(statsData.takenOnTimeTrend || 0)}% from previous {period}
                  </p>
                </div>

                {/* Missed and Late Doses */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-xl p-4 border border-red-200 dark:border-red-700/50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Missed Doses</h3>
                      <div className="w-3 h-3 bg-red-500 rounded-full shadow-sm"></div>
                    </div>
                    <p className="text-2xl lg:text-3xl font-bold text-red-700 dark:text-red-400 mb-2">
                      {statsData.missedPercentage || 0}%
                    </p>
                    <p className={`text-sm ${getTrendColor(statsData.missedTrend, false)} flex items-center font-medium`}>
                      <span className="mr-1">{getTrendIcon(statsData.missedTrend)}</span>
                      {Math.abs(statsData.missedTrend || 0)}% from previous {period}
                    </p>
                  </div>
                  
                  <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-700/50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">Taken Late</h3>
                      <div className="w-3 h-3 bg-yellow-500 rounded-full shadow-sm"></div>
                    </div>
                    <p className="text-2xl lg:text-3xl font-bold text-yellow-700 dark:text-yellow-400 mb-2">
                      {statsData.takenLatePercentage || 0}%
                    </p>
                    <p className={`text-sm ${getTrendColor(statsData.takenLateTrend, false)} flex items-center font-medium`}>
                      <span className="mr-1">{getTrendIcon(statsData.takenLateTrend)}</span>
                      {Math.abs(statsData.takenLateTrend || 0)}% from previous {period}
                    </p>
                  </div>
                </div>
              </div>

              {/* Chart Section - Right Column */}
              <div className="flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-800 dark:via-gray-800 dark:to-gray-700 rounded-2xl p-8 min-h-[320px] border border-gray-200 dark:border-gray-600 shadow-sm">                {getChartData && (
                  <div className="relative w-full max-w-[260px] aspect-square">
                    <Doughnut 
                      key={`chart-${period}-${Date.now()}`}
                      data={getChartData} 
                      options={chartOptions} 
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <p className="text-3xl lg:text-4xl font-bold text-gray-800 dark:text-white">
                          {statsData.overallAdherence || 0}%
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Overall</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Chart Legend */}
                <div className="flex flex-wrap justify-center gap-6 mt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-green-500 rounded-full shadow-sm"></div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Taken</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-red-500 rounded-full shadow-sm"></div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Missed</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-yellow-500 rounded-full shadow-sm"></div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Skipped</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Streak Information */}
            {statsData && statsData.streakInfo && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="text-center p-6 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-2xl border border-blue-200 dark:border-blue-700/50">
                    <h3 className="text-base font-semibold text-blue-700 dark:text-blue-400 mb-3">Current Streak</h3>
                    <p className="text-3xl lg:text-4xl font-bold text-blue-700 dark:text-blue-400">
                      {statsData.streakInfo.currentStreak || 0}
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mt-1">days</p>
                  </div>
                  
                  <div className="text-center p-6 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-2xl border border-green-200 dark:border-green-700/50">
                    <h3 className="text-base font-semibold text-green-700 dark:text-green-400 mb-3">Best Streak</h3>
                    <p className="text-3xl lg:text-4xl font-bold text-green-700 dark:text-green-400">
                      {statsData.streakInfo.bestStreak || 0}
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium mt-1">days</p>
                  </div>
                  
                  <div className="text-center p-6 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-2xl border border-purple-200 dark:border-purple-700/50">
                    <h3 className="text-base font-semibold text-purple-700 dark:text-purple-400 mb-3">Perfect Days</h3>
                    <p className="text-3xl lg:text-4xl font-bold text-purple-700 dark:text-purple-400">
                      {statsData.streakInfo.totalPerfectDays || 0}
                    </p>
                    <p className="text-sm text-purple-600 dark:text-purple-400 font-medium mt-1">total</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col justify-center items-center h-64 text-gray-500 dark:text-gray-400">
            <div className="text-6xl mb-6">📊</div>
            <div className="text-center">
              <p className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">No data available</p>
              <p className="text-base text-gray-600 dark:text-gray-400">Start taking your medications to see adherence statistics</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdherenceStats;
