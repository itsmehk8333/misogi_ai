import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, LoadingSpinner, Alert } from '../components';
import ExportManager from '../components/ExportManager';
import { reportService } from '../services/reportService';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

const AdherenceReports = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [calendarData, setCalendarData] = useState(null);
  const [weeklyTrends, setWeeklyTrends] = useState(null);
  const [mostMissedMeds, setMostMissedMeds] = useState(null);
  const [selectedYear, setSelectedYear] = useState(2024);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  useEffect(() => {
    fetchReportData();
  }, [selectedYear]);

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all three features data in parallel
      const [calendarHeatmap, weeklyData, missedMeds] = await Promise.all([
        reportService.getCalendarHeatmap(selectedYear),
        reportService.getWeeklyTrends(12),
        reportService.getMostMissedMedications()
      ]);
      
      setCalendarData(calendarHeatmap);
      setWeeklyTrends(weeklyData);
      setMostMissedMeds(missedMeds);
    } catch (err) {
      console.error('Failed to fetch report data:', err);
      setError('Unable to load adherence reports. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Calendar heatmap helper functions
  const getHeatmapColor = (adherenceRate) => {
    if (adherenceRate >= 90) return 'bg-green-500';
    if (adherenceRate >= 75) return 'bg-green-400';
    if (adherenceRate >= 50) return 'bg-yellow-400';
    if (adherenceRate >= 25) return 'bg-orange-400';
    if (adherenceRate > 0) return 'bg-red-400';
    return 'bg-gray-200 dark:bg-gray-600';
  };

  const getDaysInYear = (year) => {
    const days = [];
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      days.push(new Date(date));
    }
    return days;
  };

  // Weekly trends chart configuration
  const getWeeklyTrendsConfig = () => {
    if (!weeklyTrends) return null;

    return {
      labels: weeklyTrends.map(week => week.weekLabel),
      datasets: [
        {
          label: 'Adherence %',
          data: weeklyTrends.map(week => Math.round(week.adherencePercentage * 10) / 10),
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
        }
      ]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Weekly Adherence Trends',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: function(value) {
            return value + '%';
          }
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-medical-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-medical-600 dark:text-medical-400 font-medium">Loading adherence reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-medical-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Adherence Reports</h1>
              <p className="text-gray-600 dark:text-gray-300 mt-2">Track your medication adherence with detailed analytics</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setIsExportModalOpen(true)}
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300 shadow-md hover:shadow-lg flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Reports
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/dashboard')}
                className="flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>

        {error ? (
          <Alert type="error" className="mb-6">
            {error}
            <button 
              onClick={fetchReportData}
              className="ml-4 text-red-700 dark:text-red-400 underline hover:text-red-800 dark:hover:text-red-300"
            >
              Try Again
            </button>
          </Alert>
        ) : (
          <div className="space-y-8">
            {/* Calendar Heatmap */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                    📅 Yearly Adherence Calendar
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Interactive view of your daily medication adherence patterns throughout {selectedYear}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {calendarData ? `${calendarData.filter(d => d.adherenceRate > 0).length} days tracked` : 'Loading...'}
                    </div>
                    <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                      {calendarData ? `${Math.round(calendarData.reduce((acc, d) => acc + (d.adherenceRate || 0), 0) / calendarData.length)}% avg` : ''}
                    </div>
                  </div>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-medical-500 dark:bg-gray-700 dark:text-white text-sm"
                  >
                    <option value={2024}>2024</option>
                    <option value={2023}>2023</option>
                    <option value={2025}>2025</option>
                  </select>
                </div>
              </div>
              
              {calendarData && calendarData.length > 0 ? (
                <div className="space-y-6">
                  {/* Month Labels */}
                  <div className="grid grid-cols-12 gap-2 mb-2">
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(month => (
                      <div key={month} className="text-xs font-medium text-gray-600 dark:text-gray-400 text-center">{month}</div>
                    ))}
                  </div>

                  {/* Day Labels and Calendar Grid */}
                  <div className="flex gap-2">
                    {/* Day of week labels */}
                    <div className="flex flex-col gap-1 mr-2">
                      <div className="h-3"></div> {/* Spacer for month labels */}
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                        <div key={i} className="text-xs text-gray-500 dark:text-gray-400 h-3 flex items-center justify-center w-3">
                          {i % 2 === 1 ? day : ''}
                        </div>
                      ))}
                    </div>

                    {/* Calendar grid */}
                    <div className="flex-1 overflow-x-auto">
                      <div className="grid grid-cols-53 gap-1 min-w-max">
                        {getDaysInYear(selectedYear).map((date, index) => {
                          const dateStr = date.toISOString().split('T')[0];
                          const dayData = calendarData.find(d => d.date === dateStr);
                          const adherenceRate = dayData?.adherenceRate || 0;
                          const adherencePercent = Math.round(adherenceRate);
                          const isToday = date.toDateString() === new Date().toDateString();
                          
                          return (
                            <div
                              key={index}
                              className={`
                                w-3 h-3 rounded-sm cursor-pointer transition-all duration-200 hover:scale-125 hover:z-10 relative group
                                ${adherenceRate === 0 
                                  ? 'bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600' 
                                  : adherenceRate >= 90 
                                  ? 'bg-emerald-500 hover:bg-emerald-600' 
                                  : adherenceRate >= 75 
                                  ? 'bg-green-400 hover:bg-green-500' 
                                  : adherenceRate >= 50 
                                  ? 'bg-yellow-400 hover:bg-yellow-500' 
                                  : adherenceRate >= 25 
                                  ? 'bg-orange-400 hover:bg-orange-500' 
                                  : 'bg-red-400 hover:bg-red-500'
                                }
                                ${isToday ? 'ring-2 ring-blue-400 ring-offset-1 dark:ring-blue-300' : ''}
                              `}
                              title={`${date.toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}\n${adherencePercent}% adherence${dayData ? `\n${dayData.takenDoses || 0}/${dayData.totalDoses || 0} medications taken` : ''}`}
                            >
                              {/* Enhanced tooltip */}
                              <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg whitespace-nowrap z-50 transition-opacity duration-200 pointer-events-none">
                                <div className="font-semibold">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                                <div>{adherencePercent}% adherence</div>
                                {dayData && <div className="text-gray-300">{dayData.takenDoses || 0}/{dayData.totalDoses || 0} doses</div>}
                                {/* Tooltip arrow */}
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Legend and Stats */}
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center space-x-4">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Adherence Level:</span>
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-1">
                            <div className="w-3 h-3 bg-gray-200 dark:bg-gray-600 rounded-sm border border-gray-300 dark:border-gray-500"></div>
                            <span className="text-xs text-gray-600 dark:text-gray-400">No data</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <div className="w-3 h-3 bg-red-400 rounded-sm"></div>
                            <span className="text-xs text-gray-600 dark:text-gray-400">1-25%</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <div className="w-3 h-3 bg-orange-400 rounded-sm"></div>
                            <span className="text-xs text-gray-600 dark:text-gray-400">26-50%</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <div className="w-3 h-3 bg-yellow-400 rounded-sm"></div>
                            <span className="text-xs text-gray-600 dark:text-gray-400">51-75%</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <div className="w-3 h-3 bg-green-400 rounded-sm"></div>
                            <span className="text-xs text-gray-600 dark:text-gray-400">76-90%</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
                            <span className="text-xs text-gray-600 dark:text-gray-400">91-100%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Stats Row */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="grid grid-cols-4 gap-6 text-sm">
                        <div className="text-center">
                          <div className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">
                            {calendarData.filter(d => d.adherenceRate >= 90).length}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Perfect Days</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-green-600 dark:text-green-400 text-lg">
                            {calendarData.filter(d => d.adherenceRate >= 75 && d.adherenceRate < 90).length}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Good Days</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-yellow-600 dark:text-yellow-400 text-lg">
                            {calendarData.filter(d => d.adherenceRate >= 50 && d.adherenceRate < 75).length}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Fair Days</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-red-600 dark:text-red-400 text-lg">
                            {calendarData.filter(d => d.adherenceRate < 50 && d.adherenceRate > 0).length}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Poor Days</div>
                        </div>
                      </div>

                      {/* Current Streak */}
                      <div className="text-center bg-gradient-to-r from-blue-100 to-green-100 dark:from-blue-900 dark:to-green-900 px-4 py-2 rounded-lg">
                        <div className="text-xl font-bold text-green-600 dark:text-green-400">
                          {(() => {
                            let streak = 0;
                            const sortedDays = [...calendarData].reverse();
                            for (const day of sortedDays) {
                              if (day.adherenceRate >= 75) streak++;
                              else break;
                            }
                            return streak;
                          })()}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">🔥 Current Streak</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Calendar Data</h4>
                  <p>Start taking your medications to see the calendar heatmap</p>
                </div>
              )}
            </Card>

            {/* Weekly Trends Chart */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-6">
                Weekly Adherence Trends
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Track your adherence percentage over the last 12 weeks
              </p>
              
              {weeklyTrends && weeklyTrends.length > 0 ? (
                <div className="h-80">
                  <Line data={getWeeklyTrendsConfig()} options={chartOptions} />
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Trend Data</h4>
                  <p>Take medications consistently to see weekly trends</p>
                </div>
              )}
            </Card>

            {/* Most Missed Medications */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-6">
                Most Commonly Missed Medications
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Medications with the highest miss rates in the last 30 days
              </p>
              
              {mostMissedMeds && mostMissedMeds.length > 0 ? (
                <div className="space-y-4">
                  {mostMissedMeds.slice(0, 5).map((med, index) => (
                    <div 
                      key={med._id}
                      className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <span className="flex items-center justify-center w-8 h-8 bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 rounded-full font-bold text-sm">
                            {index + 1}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                            {med.medicationName}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {med.dosage?.amount && med.dosage?.unit ? `${med.dosage.amount} ${med.dosage.unit}` : med.dosage} • {med.frequency}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {Math.round(med.totalMissedPercentage)}%
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {med.totalMissedAndSkipped} of {med.totalDoses} doses missed
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-green-600 dark:text-green-400">
                  <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Excellent Adherence!</h4>
                  <p>No frequently missed medications. Keep up the great work!</p>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Export Modal */}
        <ExportManager 
          isOpen={isExportModalOpen} 
          onClose={() => setIsExportModalOpen(false)} 
        />
      </div>
    </div>
  );
};

export default AdherenceReports;
