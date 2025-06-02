import React, { useState, useEffect, useMemo } from 'react';
import { reportService } from '../services/reportService';
import { format, subDays, startOfYear, endOfYear, eachDayOfInterval, getDay } from 'date-fns';
import Card from './Card';
import Button from './Button';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import ExportManager from './ExportManager';

const AdherenceDashboard = () => {
  const [adherenceData, setAdherenceData] = useState(null);
  const [calendarData, setCalendarData] = useState([]);
  const [weeklyTrends, setWeeklyTrends] = useState([]);
  const [mostMissedMeds, setMostMissedMeds] = useState([]);
  const [selectedYear, setSelectedYear] = useState(2024);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedYear]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [calendar, trends, missed] = await Promise.all([
        reportService.getCalendarHeatmap(selectedYear),
        reportService.getWeeklyTrends(12),
        reportService.getMostMissedMedications()
      ]);

      setCalendarData(calendar || []);
      setWeeklyTrends(trends || []);
      setMostMissedMeds(missed || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError('Failed to load dashboard data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };
  const getHeatmapColor = (adherenceRate) => {
    if (adherenceRate === undefined || adherenceRate === null) return '#f3f4f6'; // gray-100 for no data
    if (adherenceRate >= 95) return '#22c55e'; // green-500
    if (adherenceRate >= 85) return '#84cc16'; // lime-500  
    if (adherenceRate >= 70) return '#eab308'; // yellow-500
    if (adherenceRate >= 50) return '#f97316'; // orange-500
    return '#ef4444'; // red-500
  };

  const getHeatmapIntensity = (adherenceRate) => {
    if (adherenceRate === undefined || adherenceRate === null) return 0;
    if (adherenceRate >= 95) return 1;
    if (adherenceRate >= 85) return 0.8;
    if (adherenceRate >= 70) return 0.6;
    if (adherenceRate >= 50) return 0.4;
    return 0.2;
  };
  // Generate calendar heatmap
  const generateCalendarHeatmap = () => {
    const startDate = startOfYear(new Date(selectedYear, 0, 1));
    const endDate = endOfYear(new Date(selectedYear, 0, 1));
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    // Create a map for quick lookup
    const adherenceMap = new Map();
    calendarData.forEach(item => {
      adherenceMap.set(item.date, item.adherenceRate);
    });

    // Group days by weeks
    const weeks = [];
    let currentWeek = [];
    
    days.forEach((day, index) => {
      const dayOfWeek = getDay(day);
      
      // Start new week on Sunday (0)
      if (dayOfWeek === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      
      const dateKey = format(day, 'yyyy-MM-dd');
      const adherenceRate = adherenceMap.get(dateKey);
      
      currentWeek.push({
        date: day,
        dateKey,
        adherenceRate,
        dayOfWeek,
        color: getHeatmapColor(adherenceRate),
        opacity: getHeatmapIntensity(adherenceRate)
      });
    });
      // Add the last week if it has days
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }
    return weeks;
  };
  // Enhanced chart data with better styling
  const getWeeklyTrendsChartData = () => {
    if (!weeklyTrends.length) return null;

    return {
      labels: weeklyTrends.map(week => week.weekLabel || `Week ${week._id.week}`),
      datasets: [
        {
          label: 'Weekly Adherence %',
          data: weeklyTrends.map(week => Math.round(week.adherencePercentage || 0)),
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#3B82F6',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverBackgroundColor: '#2563EB',
          pointHoverBorderColor: '#FFFFFF',
          pointHoverBorderWidth: 3,
          pointHoverRadius: 8
        }
      ]
    };
  };
  // Hook to track screen size for responsive behavior with throttling
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  
  useEffect(() => {
    let timeoutId;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsMobile(window.innerWidth < 640);
      }, 150); // Throttle resize events
    };
    
    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);// Chart configuration optimized for all screen sizes
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 14
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        titleFont: {
          size: 14,
          weight: 'bold'
        },
        bodyFont: {
          size: 13
        },
        padding: 12
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: function(value) {
            return value + '%';
          },
          font: {
            size: 12
          },
          color: '#6B7280'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          lineWidth: 1
        },
        border: {
          color: '#E5E7EB'
        }
      },
      x: {
        ticks: {
          font: {
            size: 12
          },
          color: '#6B7280',
          maxRotation: 45,
          minRotation: 0
        },
        grid: {
          display: false
        },
        border: {
          color: '#E5E7EB'
        }
      }
    },
    elements: {
      point: {
        radius: 5,
        hoverRadius: 8,
        backgroundColor: '#3B82F6',
        borderColor: '#FFFFFF',
        borderWidth: 2
      },
      line: {
        tension: 0.4
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  }), []);

  // Mobile-optimized chart options
  const mobileChartOptions = useMemo(() => ({
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      legend: {
        ...chartOptions.plugins.legend,
        labels: {
          ...chartOptions.plugins.legend.labels,
          font: {
            size: 12
          },
          padding: 15
        }
      }
    },
    scales: {
      ...chartOptions.scales,
      y: {
        ...chartOptions.scales.y,
        ticks: {
          ...chartOptions.scales.y.ticks,
          font: {
            size: 10
          }
        }
      },
      x: {
        ...chartOptions.scales.x,
        ticks: {
          ...chartOptions.scales.x.ticks,
          font: {
            size: 10
          },
          maxRotation: 45
        }
      }
    },
    elements: {
      ...chartOptions.elements,
      point: {
        ...chartOptions.elements.point,
        radius: 3,
        hoverRadius: 6
      }
    }
  }), [chartOptions]);
  const calendarWeeks = generateCalendarHeatmap();
  // Professional loading component  
  const LoadingScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-medical-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-8 max-w-sm w-full">
        <div className="text-center">
          <div className="relative mb-8 mx-auto w-24 h-24">
            <div className="absolute inset-0 bg-gradient-to-r from-medical-500 to-medical-600 rounded-full animate-ping opacity-20"></div>
            <div className="relative flex items-center justify-center w-24 h-24">
              <div className="w-16 h-16 border-4 border-medical-200 rounded-full animate-spin"></div>
              <div className="w-16 h-16 border-4 border-medical-600 border-t-transparent rounded-full animate-spin absolute"></div>
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-xl font-bold bg-gradient-to-r from-medical-800 to-medical-600 bg-clip-text text-transparent">
              Loading Dashboard
            </h3>
            <p className="text-sm text-gray-600 font-medium">
              Analyzing your adherence data...
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // Professional error component
  const ErrorScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md w-full">
        <div className="mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Dashboard</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button 
            onClick={fetchDashboardData}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
          >
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="space-y-6 lg:space-y-8">
            {/* Enhanced Header Section with improved mobile responsiveness */}
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border border-gray-200/50 p-4 sm:p-6 lg:p-8 backdrop-blur-sm">
            <div className="flex flex-col gap-4 sm:gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-medical-600 to-medical-700 rounded-xl flex items-center justify-center shadow-xl">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h1 className="text-xl sm:text-2xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 via-medical-800 to-medical-600 bg-clip-text text-transparent">
                      Adherence Analytics
                    </h1>
                  </div>
                  
                  {/* Burger Menu Button - Only visible on mobile */}
                  <button 
                    className="block sm:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    onClick={() => setIsSidebarOpen(true)}
                  >
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                </div>
                
                <p className="text-sm sm:text-base text-gray-600 max-w-2xl font-medium">
                  Track your medication adherence patterns and insights to maintain optimal health outcomes.
                </p>
              </div>
              
              {/* Year selector and refresh button - Hidden on mobile when sidebar is used */}
              <div className="hidden sm:flex sm:flex-row gap-3 sm:gap-4">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-3 sm:px-4 py-2 sm:py-3 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-medical-300 transition-all duration-200 w-full sm:w-auto font-medium text-gray-700 text-sm sm:text-base shadow-sm hover:shadow-md"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                
                <Button
                  onClick={fetchDashboardData}
                  className="bg-gradient-to-r from-medical-600 to-medical-700 hover:from-medical-700 hover:to-medical-800 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-medium transition-all duration-300 shadow-md hover:shadow-lg w-full sm:w-auto text-sm sm:text-base group"
                >
                  <svg className="w-4 h-4 mr-2 inline transform group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Data
                </Button>
                <Button
                  onClick={() => setIsExportModalOpen(true)}
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-medium transition-all duration-300 shadow-md hover:shadow-lg w-full sm:w-auto text-sm sm:text-base group"
                >
                  <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export Data
                </Button>
              </div>            </div>
          </div>

          {/* Mobile Sidebar */}<div 
            className={`fixed inset-y-0 right-0 w-64 bg-white shadow-2xl z-[60] transform transition-transform duration-300 ease-in-out sm:hidden ${
              isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="p-4 h-full overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
                <button 
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Select Year</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-medical-500"
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                
                <Button
                  onClick={() => {
                    fetchDashboardData();
                    setIsSidebarOpen(false);
                  }}
                  className="w-full bg-gradient-to-r from-medical-600 to-medical-700 hover:from-medical-700 hover:to-medical-800 text-white"
                >
                  <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Data
                </Button>
              </div>
            </div>
          </div>

          {/* Backdrop - Only show when sidebar is open */}
          {isSidebarOpen && (            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-[50] sm:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* Responsive Grid Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
            
            {/* Calendar Heatmap - Full width on mobile, 2 columns on desktop */}
            <div className="xl:col-span-2">              <Card className="h-full bg-gradient-to-br from-white to-gray-50 shadow-xl hover:shadow-2xl transition-all duration-300 border-0 rounded-2xl overflow-hidden backdrop-blur-sm">
                <div className="p-6 lg:p-8">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 lg:mb-10 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-medical-500 to-medical-600 rounded-lg flex items-center justify-center shadow-lg">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2h2a2 2 0 002-2z" />
                          </svg>
                        </div>
                        <h2 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                          Adherence Calendar
                        </h2>
                      </div>
                      <p className="text-sm text-gray-600 font-medium">
                        Daily adherence tracking for {selectedYear}
                      </p>
                    </div>
                    <div className="flex items-center space-x-3 bg-white/80 px-4 py-2 rounded-lg border border-gray-200/50 shadow-sm">
                      <span className="text-xs sm:text-sm font-medium text-gray-600">Less</span>
                      <div className="flex space-x-1.5">
                        {[0, 50, 70, 85, 95].map((value, index) => (
                          <div
                            key={index}
                            className="w-3 h-3 rounded-md shadow-sm hover:scale-110 transition-transform duration-200 cursor-help"
                            style={{ backgroundColor: getHeatmapColor(value) }}
                            title={`${value}% adherence`}
                          />
                        ))}
                      </div>
                      <span>More</span>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <div className="min-w-full">
                      {/* Month labels - responsive */}
                      <div className="hidden md:flex mb-3">
                        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, index) => (
                          <div key={month} className="text-xs font-medium text-gray-500 text-center flex-1">
                            {month}
                          </div>
                        ))}
                      </div>
                      
                      {/* Calendar grid with enhanced responsiveness */}
                      <div className="grid gap-1">
                        {calendarWeeks.map((week, weekIndex) => (
                          <div key={weekIndex} className="flex items-center gap-1">
                            {/* Week label */}
                            <div className="w-8 lg:w-10 text-xs font-medium text-gray-500 flex items-center">
                              {weekIndex % 4 === 0 && week[0] ? format(week[0].date, 'MMM') : ''}
                            </div>
                            
                            {/* Week days */}
                            <div className="flex gap-1 flex-1">
                              {week.map((day) => (
                                <div
                                  key={day.dateKey}
                                  className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 rounded-sm cursor-pointer hover:ring-2 hover:ring-blue-400 hover:ring-opacity-50 transition-all duration-200 transform hover:scale-110"
                                  style={{ 
                                    backgroundColor: day.color, 
                                    opacity: day.opacity || 0.1
                                  }}
                                  title={`${format(day.date, 'MMM dd, yyyy')}: ${day.adherenceRate ? Math.round(day.adherenceRate) : 0}% adherence`}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Most Missed Medications - Side panel on desktop */}
            <div className="xl:col-span-1">              <Card className="h-full bg-gradient-to-br from-white to-rose-50 shadow-xl hover:shadow-2xl transition-all duration-300 border-0 rounded-2xl overflow-hidden backdrop-blur-sm">
                <div className="p-6 lg:p-8">
                  <div className="space-y-2 mb-8">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center shadow-lg">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h2 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-gray-900 to-red-800 bg-clip-text text-transparent">
                        Most Missed
                      </h2>
                    </div>
                    <p className="text-sm text-gray-600 font-medium ml-13">
                      Medications requiring attention
                    </p>
                  </div>
                  
                  {mostMissedMeds.length === 0 ? (
                    <div className="text-center py-8 lg:py-12">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Excellent!</h3>
                      <p className="text-sm text-gray-600">
                        No frequently missed medications detected.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 lg:space-y-4">
                      {mostMissedMeds.slice(0, 5).map((med, index) => (
                        <div 
                          key={med._id} 
                          className="group bg-gradient-to-r from-gray-50 to-white p-4 lg:p-5 rounded-lg border border-gray-200 hover:border-red-300 hover:shadow-md transition-all duration-300"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start space-x-3 min-w-0 flex-1">
                              <div className="flex-shrink-0">
                                <span className="inline-flex items-center justify-center w-8 h-8 bg-red-100 text-red-600 text-sm font-bold rounded-full">
                                  {index + 1}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-gray-900 text-sm lg:text-base truncate group-hover:text-red-700 transition-colors">
                                  {med.medicationName}
                                </h3>
                                <p className="text-xs lg:text-sm text-gray-600 mt-1">
                                  {typeof med.dosage === 'object' 
                                    ? `${med.dosage.amount} ${med.dosage.unit}` 
                                    : med.dosage}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {med.frequency}
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-lg lg:text-xl font-bold text-red-600">
                                {med.totalMissedPercentage?.toFixed(1) || 0}%
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {med.totalMissedAndSkipped || 0} missed
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>

          {/* Weekly Trends Chart - Full width */}          <Card className="bg-gradient-to-br from-white to-blue-50 shadow-xl hover:shadow-2xl transition-all duration-300 border-0 rounded-2xl overflow-hidden backdrop-blur-sm">
            <div className="p-6 lg:p-8">
              <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-gray-900 to-blue-800 bg-clip-text text-transparent">
                      Weekly Adherence Trends
                    </h2>
                    <p className="text-sm text-gray-600 font-medium mt-1">
                      Track your adherence patterns over the past 12 weeks
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 bg-white/80 px-4 py-2 rounded-lg border border-gray-200/50 shadow-sm">
                  <span className="text-sm font-medium text-gray-700">Last 12 Weeks</span>
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                </div>
              </div>
              
              <div className="h-64 sm:h-80 lg:h-96">
                {getWeeklyTrendsChartData() ? (
                  <Line 
                    data={getWeeklyTrendsChartData()} 
                    options={isMobile ? mobileChartOptions : chartOptions} 
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Data Available</h3>
                      <p className="text-sm text-gray-600">
                        Start tracking your medications to see weekly trends
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>        </div>
      </div>

      {/* Export Manager Modal - Moved outside of content area to ensure proper stacking */}
      <ExportManager 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
      />
    </div>
  );
};

export default AdherenceDashboard;
