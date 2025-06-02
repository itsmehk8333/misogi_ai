import React, { useState } from 'react';
import { reportService } from '../services/reportService';
import { doseService } from '../services/doseService';
import { medicationService } from '../services/medicationService';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import Button from './Button';
import Modal from './Modal';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const ExportManager = ({ onClose, isOpen }) => {
  const [exportType, setExportType] = useState('adherence');
  const [exportFormat, setExportFormat] = useState('pdf');
  const [dateRange, setDateRange] = useState('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [selectedMedications, setSelectedMedications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const exportTypes = [
    { value: 'adherence', label: 'Adherence Report', description: 'Comprehensive medication adherence analysis' },
    { value: 'dose_logs', label: 'Dose Logs', description: 'Detailed log of all dose activities' },
    { value: 'medication_list', label: 'Medication List', description: 'Current medications and regimens' },
    { value: 'calendar_data', label: 'Calendar Data', description: 'Schedule and adherence calendar view' },
    { value: 'missed_doses', label: 'Missed Doses Report', description: 'Analysis of missed medications' }
  ];

  const dateRanges = [
    { value: 'week', label: 'Last 7 days' },
    { value: 'month', label: 'Last 30 days' },
    { value: 'quarter', label: 'Last 3 months' },
    { value: 'year', label: 'Last 12 months' },
    { value: 'custom', label: 'Custom range' }
  ];

  const getDateRangeParams = () => {
    const now = new Date();
    let startDate, endDate;

    switch (dateRange) {
      case 'week':
        startDate = subDays(now, 7);
        endDate = now;
        break;
      case 'month':
        startDate = subDays(now, 30);
        endDate = now;
        break;
      case 'quarter':
        startDate = subDays(now, 90);
        endDate = now;
        break;
      case 'year':
        startDate = subDays(now, 365);
        endDate = now;
        break;
      case 'custom':
        startDate = customStartDate ? new Date(customStartDate) : subDays(now, 30);
        endDate = customEndDate ? new Date(customEndDate) : now;
        break;
      default:
        startDate = subDays(now, 30);
        endDate = now;
    }

    return { startDate, endDate };
  };

  // Utility function to sanitize text for PDF
  const sanitizeText = (text) => {
    if (!text) return '';
    // Remove non-printable and non-ASCII characters
    return text
      .replace(/[^\x20-\x7E]/g, '') // Remove non-ASCII characters
      .replace(/[^\S\r\n]+/g, ' ') // Normalize whitespace
      .trim();
  };

  const generatePDFReport = async (data, reportType) => {
    // Initialize PDF with proper encoding and compression
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      putOnlyUsedFonts: true,
      compress: true,
      floatPrecision: 16,
      hotfixes: ["px_scaling"]
    });

    // Set up default font and encoding
    pdf.setFont('helvetica');
    pdf.setLanguage("en-US");

    let yPosition = 20;
    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;

    // Header with sanitized text
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    const title = sanitizeText('Medication Management Report');
    pdf.text(title, 20, yPosition);
    yPosition += 15;

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    const reportTypeText = sanitizeText(`Report Type: ${exportTypes.find(t => t.value === reportType)?.label}`);
    pdf.text(reportTypeText, 20, yPosition);
    yPosition += 10;

    const { startDate, endDate } = getDateRangeParams();
    const dateRangeText = sanitizeText(
      `Period: ${format(startDate, 'MMM dd, yyyy')} - ${format(endDate, 'MMM dd, yyyy')}`
    );
    pdf.text(dateRangeText, 20, yPosition);
    yPosition += 10;

    const generatedText = sanitizeText(
      `Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`
    );
    pdf.text(generatedText, 20, yPosition);
    yPosition += 20;

    // Content based on report type
    switch (reportType) {
      case 'adherence':
        await generateAdherencePDF(pdf, data, yPosition);
        break;
      case 'dose_logs':
        await generateDoseLogsPDF(pdf, data, yPosition);
        break;
      case 'medication_list':
        await generateMedicationListPDF(pdf, data, yPosition);
        break;
      case 'missed_doses':
        await generateMissedDosesPDF(pdf, data, yPosition);
        break;
      default:
        pdf.text(sanitizeText('Report data not available'), 20, yPosition);
    }

    pdf.setProperties({
      title: `Medication Report - ${reportType}`,
      subject: 'Medication Management Report',
      creator: 'MedTracker',
      author: 'MedTracker System',
      keywords: 'medications, adherence, health',
      producer: 'jsPDF'
    });

    return pdf;
  };

  const generateAdherencePDF = async (pdf, data, yPos) => {
    let yPosition = yPos;

    // Summary statistics
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(sanitizeText('Adherence Summary'), 20, yPosition);
    yPosition += 15;

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    
    const stats = [
      `Overall Adherence: ${data.overallAdherence?.toFixed(1) || 0}%`,
      `Total Doses Scheduled: ${data.totalDoses || 0}`,
      `Doses Taken: ${data.takenDoses || 0}`,
      `Doses Missed: ${data.missedDoses || 0}`,
      `Current Streak: ${data.currentStreak || 0} days`,
      `Best Streak: ${data.bestStreak || 0} days`
    ];

    stats.forEach(stat => {
      const safeText = sanitizeText(stat);
      pdf.text(safeText, 20, yPosition);
      yPosition += 8;
    });
    yPosition += 10;

    // Weekly trends
    if (data.weeklyTrends && data.weeklyTrends.length > 0) {
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(sanitizeText('Weekly Adherence Trends'), 20, yPosition);
      yPosition += 15;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      
      // Table headers
      pdf.text('Week', 20, yPosition);
      pdf.text('Adherence %', 80, yPosition);
      pdf.text('Doses Taken', 140, yPosition);
      yPosition += 8;

      data.weeklyTrends.slice(0, 10).forEach(week => {
        const weekDate = sanitizeText(format(new Date(week.weekStart), 'MMM dd'));
        pdf.text(weekDate, 20, yPosition);
        pdf.text(`${week.adherenceRate.toFixed(1)}%`, 80, yPosition);
        pdf.text(week.dosesTaken.toString(), 140, yPosition);
        yPosition += 6;
      });
    }
  };

  const generateDoseLogsPDF = async (pdf, data, yPos) => {
    let yPosition = yPos;

    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('Dose Logs', 20, yPosition);
    yPosition += 15;

    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');

    // Table headers
    pdf.text('Date & Time', 20, yPosition);
    pdf.text('Medication', 70, yPosition);
    pdf.text('Status', 130, yPosition);
    pdf.text('Notes', 160, yPosition);
    yPosition += 8;

    if (data.doses && data.doses.length > 0) {
      data.doses.slice(0, 30).forEach(dose => {
        const dateTime = format(new Date(dose.timestamp || dose.scheduledTime), 'MM/dd HH:mm');
        const medication = dose.medication?.name || dose.regimen?.medication?.name || 'Unknown';
        const status = dose.status || 'pending';
        const notes = dose.notes || '';

        pdf.text(dateTime, 20, yPosition);
        pdf.text(medication.substring(0, 15), 70, yPosition);
        pdf.text(status, 130, yPosition);
        pdf.text(notes.substring(0, 20), 160, yPosition);
        yPosition += 6;

        // Add new page if needed
        if (yPosition > 250) {
          pdf.addPage();
          yPosition = 20;
        }
      });
    } else {
      pdf.text('No dose logs found for the selected period', 20, yPosition);
    }
  };

  const generateMedicationListPDF = async (pdf, data, yPos) => {
    let yPosition = yPos;

    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('Current Medications', 20, yPosition);
    yPosition += 15;

    if (data.medications && data.medications.length > 0) {
      data.medications.forEach((med, index) => {
        pdf.setFontSize(12);
        pdf.setFont(undefined, 'bold');
        pdf.text(`${index + 1}. ${med.name}`, 20, yPosition);
        yPosition += 8;

        pdf.setFontSize(10);
        pdf.setFont(undefined, 'normal');
        
        const details = [
          `Strength: ${med.strength?.amount} ${med.strength?.unit}`,
          `Category: ${med.category}`,
          `Form: ${med.form}`,
          med.genericName ? `Generic: ${med.genericName}` : null,
          med.purpose ? `Purpose: ${med.purpose}` : null
        ].filter(Boolean);

        details.forEach(detail => {
          pdf.text(detail, 25, yPosition);
          yPosition += 6;
        });

        yPosition += 5;

        // Add new page if needed
        if (yPosition > 240) {
          pdf.addPage();
          yPosition = 20;
        }
      });
    } else {
      pdf.text('No medications found', 20, yPosition);
    }
  };

  const generateMissedDosesPDF = async (pdf, data, yPos) => {
    let yPosition = yPos;

    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('Missed Doses Analysis', 20, yPosition);
    yPosition += 15;

    if (data.missedDoses && data.missedDoses.length > 0) {
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');

      // Table headers
      pdf.text('Date', 20, yPosition);
      pdf.text('Medication', 60, yPosition);
      pdf.text('Scheduled Time', 120, yPosition);
      pdf.text('Reason', 170, yPosition);
      yPosition += 8;

      data.missedDoses.slice(0, 25).forEach(dose => {
        const date = format(new Date(dose.scheduledTime), 'MM/dd/yyyy');
        const medication = dose.medication?.name || dose.regimen?.medication?.name || 'Unknown';
        const time = format(new Date(dose.scheduledTime), 'HH:mm');
        const reason = dose.notes || 'Not specified';

        pdf.text(date, 20, yPosition);
        pdf.text(medication.substring(0, 15), 60, yPosition);
        pdf.text(time, 120, yPosition);
        pdf.text(reason.substring(0, 15), 170, yPosition);
        yPosition += 6;

        // Add new page if needed
        if (yPosition > 250) {
          pdf.addPage();
          yPosition = 20;
        }
      });
    } else {
      pdf.text('No missed doses found for the selected period', 20, yPosition);
    }
  };

  const generateCSVData = (data, reportType) => {
    switch (reportType) {
      case 'adherence':
        return generateAdherenceCSV(data);
      case 'dose_logs':
        return generateDoseLogsCSV(data);
      case 'medication_list':
        return generateMedicationListCSV(data);
      case 'missed_doses':
        return generateMissedDosesCSV(data);
      default:
        return 'No data available';
    }
  };

  const generateAdherenceCSV = (data) => {
    let csv = 'Date,Adherence Rate,Doses Taken,Doses Missed,Total Doses\n';
    
    if (data.dailyAdherence) {
      data.dailyAdherence.forEach(day => {
        csv += `${day.date},${day.adherenceRate.toFixed(2)},${day.dosesTaken},${day.dossesMissed},${day.totalDoses}\n`;
      });
    }
    
    return csv;
  };

  const generateDoseLogsCSV = (data) => {
    let csv = 'Date,Time,Medication,Dosage,Status,Notes\n';
    
    if (data.doses) {
      data.doses.forEach(dose => {
        const date = format(new Date(dose.timestamp || dose.scheduledTime), 'yyyy-MM-dd');
        const time = format(new Date(dose.timestamp || dose.scheduledTime), 'HH:mm');
        const medication = dose.medication?.name || dose.regimen?.medication?.name || 'Unknown';
        const dosage = dose.dosage || `${dose.regimen?.dosage?.amount} ${dose.regimen?.dosage?.unit}`;
        const status = dose.status || 'pending';
        const notes = dose.notes || '';
        
        csv += `${date},${time},"${medication}","${dosage}",${status},"${notes}"\n`;
      });
    }
    
    return csv;
  };

  const generateMedicationListCSV = (data) => {
    let csv = 'Name,Generic Name,Strength,Unit,Category,Form,Purpose\n';
    
    if (data.medications) {
      data.medications.forEach(med => {
        csv += `"${med.name}","${med.genericName || ''}","${med.strength?.amount || ''}","${med.strength?.unit || ''}","${med.category}","${med.form}","${med.purpose || ''}"\n`;
      });
    }
    
    return csv;
  };

  const generateMissedDosesCSV = (data) => {
    let csv = 'Date,Medication,Scheduled Time,Minutes Late,Reason\n';
    
    if (data.missedDoses) {
      data.missedDoses.forEach(dose => {
        const date = format(new Date(dose.scheduledTime), 'yyyy-MM-dd');
        const medication = dose.medication?.name || dose.regimen?.medication?.name || 'Unknown';
        const time = format(new Date(dose.scheduledTime), 'HH:mm');
        const minutesLate = dose.minutesLate || 0;
        const reason = dose.notes || 'Not specified';
        
        csv += `${date},"${medication}",${time},${minutesLate},"${reason}"\n`;
      });
    }
    
    return csv;
  };

  const downloadCSV = (csvContent, filename) => {
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const downloadPDF = (pdf, filename) => {
    try {
      // Get PDF as base64 string
      const pdfOutput = pdf.output('datauristring');
      
      // Create blob from base64
      const byteCharacters = atob(pdfOutput.split(',')[1]);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF download error:', error);
      throw new Error('Failed to download PDF. Please try again.');
    }
  };
  const handleExport = async () => {
    setIsLoading(true);
    
    try {
      const { startDate, endDate } = getDateRangeParams();
      const timeStamp = format(new Date(), 'yyyy-MM-dd-HHmm');
      const exportTypeLabel = exportTypes.find(t => t.value === exportType)?.label.replace(/\s+/g, '-').toLowerCase();
      const fileExtension = exportFormat === 'pdf' ? 'pdf' : 'csv';
      const filename = `${exportTypeLabel}-${timeStamp}.${fileExtension}`;

      // Prepare report data
      const reportData = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        includeCharts: includeCharts
      };      try {
        console.log('Export Type:', exportType);
        console.log('Export Format:', exportFormat);
        console.log('Report Data:', reportData);
        console.log('Filename:', filename);
        
        if (exportFormat === 'pdf') {
          await reportService.exportToPDF(exportType, reportData, filename);
        } else if (exportFormat === 'csv') {
          await reportService.exportToCSV(exportType, reportData, filename);
        }
        
        // Success message
        alert(`${exportFormat.toUpperCase()} exported successfully!`);
      } catch (error) {
        console.error('Export service error:', error);
        throw new Error(`Failed to generate ${exportFormat.toUpperCase()} from server. Please try again.`);
      }

      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Reports">
      <div className="space-y-3 max-w-lg">
        {/* Export Type Selection */}
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-3 rounded-lg border border-gray-100">
          <label className="flex items-center text-sm font-semibold text-gray-800 mb-2">
            <svg className="w-3 h-3 mr-1 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Report Type
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            {exportTypes.map((type) => (
              <div
                key={type.value}
                className={`group p-2 border rounded-md cursor-pointer transition-all duration-200 ${
                  exportType === type.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300 bg-white hover:bg-blue-50'
                }`}
                onClick={() => setExportType(type.value)}
              >
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="exportType"
                    value={type.value}
                    checked={exportType === type.value}
                    onChange={(e) => setExportType(e.target.value)}
                    className="h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <div className="ml-2 flex-1">
                    <div className="text-xs font-medium text-gray-900">{type.label}</div>
                    <div className="text-xs text-gray-600">{type.description}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Format Selection */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-3 rounded-lg border border-purple-100">
          <label className="flex items-center text-sm font-semibold text-gray-800 mb-2">
            <svg className="w-3 h-3 mr-1 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Format
          </label>
          <div className="flex space-x-2">
            <label className={`flex-1 p-2 border rounded-md cursor-pointer transition-all duration-200 ${
              exportFormat === 'pdf' 
                ? 'border-purple-500 bg-purple-50' 
                : 'border-gray-200 hover:border-purple-300 bg-white hover:bg-purple-50'
            }`}>
              <div className="flex items-center justify-center">
                <input
                  type="radio"
                  name="format"
                  value="pdf"
                  checked={exportFormat === 'pdf'}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="h-3 w-3 text-purple-600 focus:ring-purple-500 border-gray-300 mr-1"
                />
                <span className="text-xs font-medium">📄 PDF</span>
              </div>
            </label>
            <label className={`flex-1 p-2 border rounded-md cursor-pointer transition-all duration-200 ${
              exportFormat === 'csv' 
                ? 'border-purple-500 bg-purple-50' 
                : 'border-gray-200 hover:border-purple-300 bg-white hover:bg-purple-50'
            }`}>
              <div className="flex items-center justify-center">
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={exportFormat === 'csv'}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="h-3 w-3 text-purple-600 focus:ring-purple-500 border-gray-300 mr-1"
                />
                <span className="text-xs font-medium">📊 CSV</span>
              </div>
            </label>
          </div>
        </div>

        {/* Date Range Selection */}
        <div className="bg-gradient-to-r from-green-50 to-teal-50 p-3 rounded-lg border border-green-100">
          <label className="flex items-center text-sm font-semibold text-gray-800 mb-2">
            <svg className="w-3 h-3 mr-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Date Range
          </label>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="w-full px-2 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 bg-white text-gray-700 text-sm"
          >
            {dateRanges.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>

          {dateRange === 'custom' && (
            <div className="grid grid-cols-2 gap-2 mt-2 p-2 bg-white rounded-md border border-green-200">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Start</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">End</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Additional Options */}
        {exportFormat === 'pdf' && (exportType === 'adherence' || exportType === 'calendar_data') && (
          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 p-3 rounded-lg border border-orange-100">
            <label className="flex items-center p-2 border rounded-md cursor-pointer transition-all duration-200 hover:shadow-sm bg-white">
              <input
                type="checkbox"
                checked={includeCharts}
                onChange={(e) => setIncludeCharts(e.target.checked)}
                className="h-3 w-3 text-orange-600 focus:ring-orange-500 border-gray-300 rounded mr-2"
              />
              <span className="text-xs font-medium text-gray-700">📈 Include charts</span>
            </label>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-2 pt-3 border-t border-gray-200">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 hover:border-gray-400 hover:bg-gray-50 rounded-md text-sm font-medium transition-all duration-200"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleExport}
            disabled={isLoading}
            className={`px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-md shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 text-sm ${
              isLoading ? 'animate-pulse' : ''
            }`}
          >
            {isLoading ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exporting...
              </div>
            ) : (
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export
              </div>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ExportManager;
