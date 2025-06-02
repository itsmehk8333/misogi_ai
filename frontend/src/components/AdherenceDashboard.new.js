import React, { useState, useEffect, useMemo } from 'react';
import { reportService } from '../services/reportService';
import { format, startOfYear, endOfYear, eachDayOfInterval, getDay } from 'date-fns';
import Card from './Card';
import Button from './Button';
import { Line } from 'react-chartjs-2';

const AdherenceDashboard = () => {
  const [adherenceData, setAdherenceData] = useState(null);
  const [calendarData, setCalendarData] = useState([]);
  const [weeklyTrends, setWeeklyTrends] = useState([]);
  const [mostMissedMeds, setMostMissedMeds] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    if (adherenceRate === undefined || adherenceRate === null) return '#f3f4f6';
    if (adherenceRate >= 95) return '#22c55e';
    if (adherenceRate >= 85) return '#84cc16';
    if (adherenceRate >= 70) return '#eab308';
    if (adherenceRate >= 50) return '#f97316';
    return '#ef4444';
  };

  const getHeatmapIntensity = (adherenceRate) => {
    if (adherenceRate === undefined || adherenceRate === null) return 0;
    if (adherenceRate >= 95) return 1;
    if (adherenceRate >= 85) return 0.8;
    if (adherenceRate >= 70) return 0.6;
    if (adherenceRate >= 50) return 0.4;
    return 0.2;
  };

  const generateCalendarHeatmap = () => {
    const startDate = startOfYear(new Date(selectedYear, 0, 1));
    const endDate = endOfYear(new Date(selectedYear, 0, 1));
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const adherenceMap = new Map();
    calendarData.forEach(item => {
      adherenceMap.set(item.date, item.adherenceRate);
    });

    const weeks = [];
    let currentWeek = [];
    
    days.forEach((day) => {
      const dayOfWeek = getDay(day);
      
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

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }
    return weeks;
  };

  const getWeeklyTrendsChartData = () => {
    if (!weeklyTrends.length) return null;

    return {
      labels: weeklyTrends.map(week => week.weekLabel || `Week ${week._id.week}`),
      datasets: [
        {
          label: 'Weekly Adherence %',
          data: weeklyTrends.map(week => Math.round(week.adherencePercentage || 0)),
          borderColor: 'rgb(99, 102, 241)', // indigo-500
          backgroundColor: (context) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, context.chart.height);
            gradient.addColorStop(0, 'rgba(99, 102, 241, 0.2)');
            gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
            return gradient;
          },
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: 'rgb(99, 102, 241)',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverBackgroundColor: 'rgb(79, 70, 229)', // indigo-600
          pointHoverBorderColor: '#FFFFFF',
          pointHoverBorderWidth: 3,
          pointHoverRadius: 8,
          cubicInterpolationMode: 'monotone'
        }
      ]
    };
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: { size: isMobile ? 12 : 14, weight: 500 },
          color: '#4B5563'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)', // gray-900 with opacity
        titleColor: 'white',
        bodyColor: 'white',
        padding: 12,
        titleFont: { size: isMobile ? 12 : 14, weight: 'bold' },
        bodyFont: { size: isMobile ? 11 : 13 },
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          title: (items) => `Week ${items[0].label}`,
          label: (item) => `Adherence: ${item.raw}%`
        },
        animation: {
          duration: 150
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        grid: {
          color: 'rgba(243, 244, 246, 0.8)', // gray-100
          drawBorder: false,
          lineWidth: 1
        },
        border: {
          display: false
        },
        ticks: {
          callback: value => `${value}%`,
          font: { 
            size: isMobile ? 10 : 12,
            weight: 500
          },
          color: '#6B7280', // gray-500
          padding: 8
        }
      },
      x: {
        grid: {
          display: false
        },
        border: {
          display: false
        },
        ticks: {
          font: { 
            size: isMobile ? 10 : 12,
            weight: 500
          },
          color: '#6B7280', // gray-500
          padding: 8,
          maxRotation: isMobile ? 45 : 0
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'nearest',
      axis: 'x'
    },
    animation: {
      duration: 750,
      easing: 'easeInOutQuart'
    },
    elements: {
      line: {
        tension: 0.4
      },
      point: {
        hitRadius: 8
      }
    }
  }), [isMobile]);

  const mobileChartOptions = useMemo(() => ({
    ...chartOptions,
    scales: {
      ...chartOptions.scales,
      y: {
        ...chartOptions.scales.y,
        ticks: {
          ...chartOptions.scales.y.ticks,
          font: { size: 10 }
        }
      },
      x: {
        ...chartOptions.scales.x,
        ticks: {
          ...chartOptions.scales.x.ticks,
          font: { size: 10 }
        }
      }
    }
  }), [chartOptions]);

  const calendarWeeks = generateCalendarHeatmap();

  const LoadingScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-medical-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="relative bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl p-8 max-w-sm w-full border border-medical-100">
        <div className="text-center space-y-6">
          <div className="relative mb-2">
            <div className="absolute inset-0 bg-gradient-to-r from-medical-500 to-medical-600 rounded-full animate-pulse opacity-20"></div>
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-medical-500/20 to-medical-600/20 animate-ping"></div>
              <div className="relative flex items-center justify-center w-24 h-24">
                <div className="w-20 h-20 border-4 border-medical-200 rounded-full animate-spin duration-1000"></div>
                <div className="w-20 h-20 border-4 border-medical-600 border-t-transparent rounded-full animate-spin duration-700 absolute"></div>
              </div>
            </div>
            <div className="mt-8 space-y-4">
              <div className="animate-pulse flex space-x-4">
                <div className="flex-1 space-y-3">
                  <div className="h-3 bg-medical-200 rounded w-3/4 mx-auto"></div>
                  <div className="h-3 bg-medical-200 rounded w-1/2 mx-auto"></div>
                </div>
              </div>
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

  const ErrorScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50 flex items-center justify-center p-4">
      <div className="relative bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl p-8 max-w-md w-full border border-red-100">
        <div className="text-center space-y-6">
          <div className="relative mb-6">
            <div className="w-20 h-20 mx-auto relative">
              <div className="absolute inset-0 bg-red-100 rounded-full animate-pulse"></div>
              <div className="relative w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-red-600 transform transition-transform duration-500 hover:scale-110" 
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="absolute inset-0 bg-red-400/20 rounded-full animate-ping"></div>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-gray-900">Unable to Load Dashboard</h3>
            <p className="text-gray-600 max-w-sm mx-auto">{error}</p>
          </div>
          <Button 
            onClick={fetchDashboardData}
            className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-8 py-3 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
          >
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Try Again</span>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-medical-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="space-y-6 lg:space-y-8">
          {/* Header Section */}
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border border-gray-200/50 p-6 lg:p-8 backdrop-blur-sm">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6 lg:gap-8">
              <div className="space-y-3">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-medical-600 to-medical-700 rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 via-medical-800 to-medical-600 bg-clip-text text-transparent">
                    Adherence Analytics
                  </h1>
                </div>
                <p className="text-sm sm:text-base text-gray-600 font-medium">
                  Track your medication adherence patterns and insights to maintain optimal health outcomes.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-4 py-3 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-medical-300 transition-all duration-200 w-full sm:w-auto font-medium text-gray-700 shadow-sm hover:shadow-md"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <Button
                  onClick={fetchDashboardData}
                  className="bg-gradient-to-r from-medical-600 to-medical-700 hover:from-medical-700 hover:to-medical-800 text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 shadow-md hover:shadow-lg w-full sm:w-auto group"
                >
                  <svg className="w-4 h-4 mr-2 inline transform group-hover:rotate-180 transition-transform duration-500" 
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Data
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
            {/* Calendar Heatmap */}
            <div className="xl:col-span-2">
              <Card className="h-full bg-gradient-to-br from-white to-gray-50 shadow-xl hover:shadow-2xl transition-all duration-300 border-0 rounded-2xl overflow-hidden backdrop-blur-sm">
                <div className="p-6 lg:p-8">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 lg:mb-10 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-medical-500 to-medical-600 rounded-lg flex items-center justify-center shadow-lg">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2h2a2 2 0 002-2z" />
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
                      <span className="text-xs sm:text-sm font-medium text-gray-600">More</span>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <div className="min-w-full">
                      {/* Month labels */}
                      <div className="hidden md:flex mb-3">
                        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(month => (
                          <div key={month} className="text-xs font-medium text-gray-500 text-center flex-1">
                            {month}
                          </div>
                        ))}
                      </div>
                      
                      {/* Calendar grid */}
                      <div className="grid gap-1">
                        {calendarWeeks.map((week, weekIndex) => (
                          <div key={weekIndex} className="flex items-center gap-1">
                            <div className="w-8 lg:w-10 text-xs font-medium text-gray-500 flex items-center">
                              {weekIndex % 4 === 0 && week[0] ? format(week[0].date, 'MMM') : ''}
                            </div>
                            <div className="flex gap-1 flex-1">
                              {week.map((day) => (
                                <div
                                  key={day.dateKey}
                                  className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 rounded-md cursor-pointer hover:ring-2 hover:ring-medical-400 hover:ring-opacity-50 transition-all duration-200 transform hover:scale-110 shadow-sm"
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

            {/* Most Missed Medications */}
            <div className="xl:col-span-1">
              <Card className="h-full bg-gradient-to-br from-white to-rose-50 shadow-xl hover:shadow-2xl transition-all duration-300 border-0 rounded-2xl overflow-hidden backdrop-blur-sm">
                <div className="p-6 lg:p-8">
                  <div className="space-y-2 mb-8">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center shadow-lg">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Perfect Adherence!</h3>
                      <p className="text-sm text-gray-600">
                        No frequently missed medications detected.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 lg:space-y-4">
                      {mostMissedMeds.slice(0, 5).map((med, index) => (
                        <div 
                          key={med._id} 
                          className="group bg-white/60 backdrop-blur-sm p-4 lg:p-5 rounded-xl border border-gray-200 hover:border-red-300 hover:shadow-lg transition-all duration-300"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start space-x-3 min-w-0 flex-1">
                              <div className="flex-shrink-0">
                                <span className="inline-flex items-center justify-center w-8 h-8 bg-red-100 text-red-600 text-sm font-bold rounded-full shadow-sm">
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

          {/* Weekly Trends Chart */}
          <Card className="bg-gradient-to-br from-white to-blue-50 shadow-xl hover:shadow-2xl transition-all duration-300 border-0 rounded-2xl overflow-hidden backdrop-blur-sm">
            <div className="p-6 lg:p-8">
              <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-gray-900 to-indigo-800 bg-clip-text text-transparent">
                      Weekly Adherence Trends
                    </h2>
                    <p className="text-sm text-gray-600 font-medium mt-1">
                      Track your adherence patterns over the past 12 weeks
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 bg-white/80 px-4 py-2 rounded-lg border border-gray-200/50 shadow-sm">
                  <span className="text-sm font-medium text-gray-700">Last 12 Weeks</span>
                  <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                </div>
              </div>
              
              <div className="h-64 sm:h-80 lg:h-96 bg-white/60 backdrop-blur-sm rounded-xl p-4">
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdherenceDashboard;
