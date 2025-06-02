const PDFDocument = require('pdfkit');
const { format } = require('date-fns');

class PDFService {
  constructor() {
    this.pageMargin = 50;
    this.lineHeight = 20;
  }

  // Create a new PDF document with standard settings
  createDocument() {
    return new PDFDocument({
      size: 'A4',
      margins: {
        top: this.pageMargin,
        bottom: this.pageMargin,
        left: this.pageMargin,
        right: this.pageMargin
      },
      bufferPages: true,
      info: {
        Title: 'Medication Management Report',
        Author: 'MedTracker System',
        Subject: 'Health Report',
        Keywords: 'medication, adherence, health, tracking'
      }
    });
  }

  // Add header to PDF
  addHeader(doc, title, subtitle = null) {
    const pageWidth = doc.page.width;
    
    // Main title
    doc.font('Helvetica-Bold')
       .fontSize(26)
       .fillColor('#2563eb')
       .text(title, this.pageMargin, this.pageMargin, { 
         width: pageWidth - 2 * this.pageMargin,
         align: 'center' 
       });

    let yPos = doc.y + 15;

    // Subtitle
    if (subtitle) {
      doc.fontSize(16)
         .fillColor('#374151')
         .text(subtitle, this.pageMargin, yPos, { 
           width: pageWidth - 2 * this.pageMargin,
           align: 'center' 
         });
      yPos = doc.y + 10;
    }

    // Horizontal line
    doc.strokeColor('#e5e7eb')
       .lineWidth(1)
       .moveTo(this.pageMargin, yPos + 10)
       .lineTo(pageWidth - this.pageMargin, yPos + 10)
       .stroke();

    // Generated timestamp
    doc.fontSize(11)
       .font('Helvetica')
       .fillColor('#6b7280')
       .text(`Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, 
             pageWidth - 150, yPos + 20, { align: 'right' });

    return yPos + 45;
  }

  // Add section header
  addSectionHeader(doc, title, yPosition = null) {
    if (yPosition) doc.y = yPosition;
    
    doc.font('Helvetica-Bold')
       .fontSize(16)
       .text(title, this.pageMargin, doc.y + 15);
    
    return doc.y + 10;
  }

  // Add table with headers and data
  addTable(doc, headers, data, yPosition = null) {
    if (yPosition) doc.y = yPosition;

    const startY = doc.y;
    const pageWidth = doc.page.width - 2 * this.pageMargin;
    const columnWidth = pageWidth / headers.length;
    
    // Check if we need a new page
    if (doc.y > doc.page.height - 150) {
      doc.addPage();
      doc.y = this.pageMargin;
    }

    // Draw header background
    doc.rect(this.pageMargin, doc.y - 5, pageWidth, 20)
       .fillAndStroke('#f3f4f6', '#e5e7eb');

    // Draw headers
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .fillColor('#374151');
    
    headers.forEach((header, index) => {
      const x = this.pageMargin + (index * columnWidth);
      doc.text(header, x + 5, doc.y, { 
        width: columnWidth - 10, 
        align: 'left',
        lineBreak: false 
      });
    });

    let tableY = doc.y + 20;

    // Draw data rows
    doc.font('Helvetica').fontSize(9).fillColor('#000000');
    data.forEach((row, rowIndex) => {
      // Check if we need a new page
      if (tableY > doc.page.height - 100) {
        doc.addPage();
        tableY = this.pageMargin;
        
        // Redraw header background
        doc.rect(this.pageMargin, tableY - 5, pageWidth, 20)
           .fillAndStroke('#f3f4f6', '#e5e7eb');
        
        // Redraw headers on new page
        doc.font('Helvetica-Bold')
           .fontSize(10)
           .fillColor('#374151');
        headers.forEach((header, index) => {
          const x = this.pageMargin + (index * columnWidth);
          doc.text(header, x + 5, tableY, { 
            width: columnWidth - 10, 
            align: 'left',
            lineBreak: false 
          });
        });
        tableY += 20;
        doc.font('Helvetica').fontSize(9).fillColor('#000000');
      }

      // Alternate row background
      if (rowIndex % 2 === 0) {
        doc.rect(this.pageMargin, tableY - 2, pageWidth, 16)
           .fill('#fafafa');
      }

      headers.forEach((header, colIndex) => {
        const x = this.pageMargin + (colIndex * columnWidth);
        const value = row[header] || '';
        doc.text(String(value), x + 5, tableY, { 
          width: columnWidth - 10, 
          align: 'left',
          lineBreak: false 
        });
      });
      tableY += 16;
    });

    doc.y = tableY + 10;
    return doc.y;
  }

  // Add key-value pairs section
  addKeyValueSection(doc, data, yPosition = null) {
    if (yPosition) doc.y = yPosition;

    const pageWidth = doc.page.width - 2 * this.pageMargin;
    const columnWidth = pageWidth / 2;

    doc.font('Helvetica').fontSize(11);
    
    const entries = Object.entries(data);
    entries.forEach(([key, value], index) => {
      if (doc.y > doc.page.height - 100) {
        doc.addPage();
        doc.y = this.pageMargin;
      }

      // Calculate position for two-column layout
      const isLeftColumn = index % 2 === 0;
      const x = isLeftColumn ? this.pageMargin : this.pageMargin + columnWidth;
      const currentY = isLeftColumn ? doc.y : doc.y;

      // Draw background for key-value pair
      doc.rect(x, currentY - 2, columnWidth - 10, 18)
         .fill('#f8fafc');

      doc.font('Helvetica-Bold')
         .fillColor('#374151')
         .text(`${key}:`, x + 5, currentY + 2, { 
           width: columnWidth * 0.4, 
           align: 'left' 
         });
         
      doc.font('Helvetica')
         .fillColor('#000000')
         .text(String(value), x + (columnWidth * 0.4) + 10, currentY + 2, { 
           width: columnWidth * 0.5, 
           align: 'left' 
         });

      // Move to next row after every two items
      if (!isLeftColumn || index === entries.length - 1) {
        doc.y = currentY + 20;
      }
    });

    return doc.y + 10;
  }

  // Generate adherence report PDF
  async generateAdherenceReport(data) {
    const doc = this.createDocument();
    
    // Header
    let yPos = this.addHeader(doc, 'Medication Adherence Report', 
      `Period: ${format(new Date(data.reportPeriod.startDate), 'MMM dd, yyyy')} - ${format(new Date(data.reportPeriod.endDate), 'MMM dd, yyyy')}`);

    // Overall statistics
    yPos = this.addSectionHeader(doc, 'Summary Statistics', yPos);
    
    const stats = {
      'Overall Adherence': `${data.overallAdherence?.toFixed(1) || 0}%`,
      'Total Doses Scheduled': data.totalDoses || 0,
      'Doses Taken': data.takenDoses || 0,
      'Doses Missed': data.missedDoses || 0,
      'Current Streak': `${data.currentStreak || 0} days`,
      'Best Streak': `${data.bestStreak || 0} days`
    };

    yPos = this.addKeyValueSection(doc, stats, yPos);

    // Weekly trends table
    if (data.weeklyTrends && data.weeklyTrends.length > 0) {
      yPos = this.addSectionHeader(doc, 'Weekly Adherence Trends', yPos + 20);
      
      const headers = ['Week Starting', 'Adherence %', 'Doses Taken', 'Doses Missed', 'Total Doses'];
      const weeklyData = data.weeklyTrends.slice(0, 12).map(week => ({
        'Week Starting': format(new Date(week.weekStart), 'MMM dd, yyyy'),
        'Adherence %': `${week.adherenceRate?.toFixed(1) || 0}%`,
        'Doses Taken': week.dosesTaken || 0,
        'Doses Missed': week.dossesMissed || 0,
        'Total Doses': week.totalDoses || 0
      }));

      this.addTable(doc, headers, weeklyData, yPos);
    }

    // Medication breakdown
    if (data.medicationBreakdown && data.medicationBreakdown.length > 0) {
      yPos = this.addSectionHeader(doc, 'Medication Adherence Breakdown', doc.y + 20);
      
      const headers = ['Medication', 'Adherence %', 'Taken', 'Missed', 'Total'];
      const medData = data.medicationBreakdown.map(med => ({
        'Medication': med.medicationName || 'Unknown',
        'Adherence %': `${med.adherenceRate?.toFixed(1) || 0}%`,
        'Taken': med.dosesTaken || 0,
        'Missed': med.dossesMissed || 0,
        'Total': med.totalDoses || 0
      }));

      this.addTable(doc, headers, medData, doc.y);
    }

    // Finalize the document and return buffer
    doc.end();
    return new Promise((resolve, reject) => {
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  }

  // Generate dose logs report PDF
  async generateDoseLogsReport(data) {
    const doc = this.createDocument();
    
    // Header
    let yPos = this.addHeader(doc, 'Dose Logs Report',
      `Period: ${format(new Date(data.reportPeriod.startDate), 'MMM dd, yyyy')} - ${format(new Date(data.reportPeriod.endDate), 'MMM dd, yyyy')}`);

    if (data.doses && data.doses.length > 0) {
      yPos = this.addSectionHeader(doc, 'Dose History', yPos);
      
      const headers = ['Date', 'Time', 'Medication', 'Dosage', 'Status', 'Notes'];
      const doseData = data.doses.map(dose => ({
        'Date': format(new Date(dose.timestamp || dose.scheduledTime), 'MMM dd, yyyy'),
        'Time': format(new Date(dose.timestamp || dose.scheduledTime), 'HH:mm'),
        'Medication': dose.medication?.name || dose.regimen?.medication?.name || 'Unknown',
        'Dosage': dose.dosage || `${dose.regimen?.dosage?.amount || ''} ${dose.regimen?.dosage?.unit || ''}`.trim() || 'N/A',
        'Status': dose.status || 'pending',
        'Notes': (dose.notes || '').substring(0, 30) + (dose.notes?.length > 30 ? '...' : '')
      }));

      this.addTable(doc, headers, doseData, yPos);
    } else {
      doc.fontSize(12)
         .text('No dose logs found for the selected period.', this.pageMargin, yPos);
    }

    // Finalize the document and return buffer
    doc.end();
    return new Promise((resolve, reject) => {
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  }

  // Generate medication list report PDF
  async generateMedicationListReport(data) {
    const doc = this.createDocument();
    
    // Header
    let yPos = this.addHeader(doc, 'Current Medications', 'Active Medication List');

    if (data.medications && data.medications.length > 0) {
      data.medications.forEach((med, index) => {
        if (doc.y > doc.page.height - 150) {
          doc.addPage();
          doc.y = this.pageMargin;
        }

        // Medication header
        doc.font('Helvetica-Bold')
           .fontSize(14)
           .fillColor('#2563eb')
           .text(`${index + 1}. ${med.name}`, this.pageMargin, doc.y);

        doc.y += 20;

        // Medication details
        const medDetails = {
          'Generic Name': med.genericName || 'N/A',
          'Strength': med.strength ? `${med.strength.amount} ${med.strength.unit}` : 'N/A',
          'Category': med.category || 'N/A',
          'Form': med.form || 'N/A',
          'Purpose': med.purpose || 'N/A',
          'Manufacturer': med.manufacturer || 'N/A'
        };

        this.addKeyValueSection(doc, medDetails, doc.y);
        doc.y += 15;

        // Add separator line
        if (index < data.medications.length - 1) {
          doc.strokeColor('#e5e7eb')
             .lineWidth(1)
             .moveTo(this.pageMargin, doc.y)
             .lineTo(doc.page.width - this.pageMargin, doc.y)
             .stroke();
          doc.y += 20;
        }
      });
    } else {
      doc.fontSize(12)
         .text('No medications found.', this.pageMargin, yPos);
    }

    return doc;
  }

  // Generate missed doses report PDF
  async generateMissedDosesReport(data) {
    const doc = this.createDocument();
    
    // Header
    let yPos = this.addHeader(doc, 'Missed Doses Report',
      `Period: ${format(new Date(data.reportPeriod.startDate), 'MMM dd, yyyy')} - ${format(new Date(data.reportPeriod.endDate), 'MMM dd, yyyy')}`);

    // Summary statistics
    if (data.summary) {
      yPos = this.addSectionHeader(doc, 'Summary', yPos);
      
      const summary = {
        'Total Missed Doses': data.summary.totalMissed || 0,
        'Most Missed Medication': data.summary.mostMissedMedication || 'N/A',
        'Average Missed Per Day': data.summary.avgMissedPerDay?.toFixed(1) || '0.0',
        'Missed Dose Rate': `${data.summary.missedRate?.toFixed(1) || 0}%`
      };

      yPos = this.addKeyValueSection(doc, summary, yPos);
    }

    // Missed doses table
    if (data.missedDoses && data.missedDoses.length > 0) {
      yPos = this.addSectionHeader(doc, 'Missed Dose Details', yPos + 20);
      
      const headers = ['Date', 'Medication', 'Scheduled Time', 'Reason', 'Impact'];
      const missedData = data.missedDoses.map(dose => ({
        'Date': format(new Date(dose.scheduledTime), 'MMM dd, yyyy'),
        'Medication': dose.medication?.name || dose.regimen?.medication?.name || 'Unknown',
        'Scheduled Time': format(new Date(dose.scheduledTime), 'HH:mm'),
        'Reason': (dose.notes || 'Not specified').substring(0, 25) + (dose.notes?.length > 25 ? '...' : ''),
        'Impact': dose.criticality || 'Low'
      }));

      this.addTable(doc, headers, missedData, yPos);
    } else {
      doc.fontSize(12)
         .text('No missed doses found for the selected period.', this.pageMargin, yPos);
    }

    return doc;
  }

  // Generate calendar data report PDF
  async generateCalendarDataReport(data) {
    const doc = this.createDocument();
    
    // Header
    let yPos = this.addHeader(doc, 'Calendar & Schedule Report',
      `Period: ${format(new Date(data.reportPeriod.startDate), 'MMM dd, yyyy')} - ${format(new Date(data.reportPeriod.endDate), 'MMM dd, yyyy')}`);

    // Daily schedule summary
    if (data.dailySchedule && data.dailySchedule.length > 0) {
      yPos = this.addSectionHeader(doc, 'Daily Schedule Summary', yPos);
      
      const headers = ['Date', 'Scheduled Doses', 'Completed', 'Missed', 'Adherence %'];
      const scheduleData = data.dailySchedule.map(day => ({
        'Date': format(new Date(day.date), 'MMM dd, yyyy'),
        'Scheduled Doses': day.scheduledDoses || 0,
        'Completed': day.completedDoses || 0,
        'Missed': day.missedDoses || 0,
        'Adherence %': `${day.adherenceRate?.toFixed(1) || 0}%`
      }));

      this.addTable(doc, headers, scheduleData, yPos);
    }

    // Time-based patterns
    if (data.timePatterns) {
      yPos = this.addSectionHeader(doc, 'Adherence by Time of Day', doc.y + 20);
      
      const timeStats = {
        'Morning (6AM-12PM)': `${data.timePatterns.morning?.toFixed(1) || 0}%`,
        'Afternoon (12PM-6PM)': `${data.timePatterns.afternoon?.toFixed(1) || 0}%`,
        'Evening (6PM-10PM)': `${data.timePatterns.evening?.toFixed(1) || 0}%`,
        'Night (10PM-6AM)': `${data.timePatterns.night?.toFixed(1) || 0}%`
      };

      this.addKeyValueSection(doc, timeStats, doc.y);
    }

    return doc;
  }

  // Generate dose logs report PDF
  async generateDoseLogsReport(data) {
    const doc = this.createDocument();
    
    let yPos = this.addHeader(doc, 'Dose Logs Report');

    if (data.doses && data.doses.length > 0) {
      yPos = this.addSectionHeader(doc, 'Dose History', yPos);
      
      const headers = ['Date', 'Time', 'Medication', 'Status', 'Notes'];
      const tableData = data.doses.slice(0, 50).map(dose => ({
        'Date': format(new Date(dose.scheduledTime), 'MM/dd/yyyy'),
        'Time': format(new Date(dose.scheduledTime), 'HH:mm'),
        'Medication': dose.medication?.name || dose.regimen?.medication?.name || 'Unknown',
        'Status': dose.status || 'pending',
        'Notes': (dose.notes || '').substring(0, 30)
      }));

      this.addTable(doc, headers, tableData, yPos);
    } else {
      doc.font('Helvetica').fontSize(12)
         .text('No dose logs found for the selected period.', this.pageMargin, yPos + 20);
    }

    return this.finalizePDF(doc);
  }

  // Generate medication list report PDF
  async generateMedicationListReport(data) {
    const doc = this.createDocument();
    
    let yPos = this.addHeader(doc, 'Current Medications');

    if (data.medications && data.medications.length > 0) {
      yPos = this.addSectionHeader(doc, 'Active Medications', yPos);

      data.medications.forEach((med, index) => {
        if (doc.y > doc.page.height - 150) {
          doc.addPage();
          doc.y = this.pageMargin;
        }

        doc.font('Helvetica-Bold').fontSize(12)
           .text(`${index + 1}. ${med.name}`, this.pageMargin, doc.y + 10);

        doc.font('Helvetica').fontSize(10);
        const details = [
          med.strength ? `Strength: ${med.strength.amount} ${med.strength.unit}` : null,
          `Category: ${med.category}`,
          `Form: ${med.form}`,
          med.genericName ? `Generic: ${med.genericName}` : null,
          med.purpose ? `Purpose: ${med.purpose}` : null
        ].filter(Boolean);

        details.forEach(detail => {
          doc.text(detail, this.pageMargin + 20, doc.y + 8);
        });

        doc.y += 20;
      });
    } else {
      doc.font('Helvetica').fontSize(12)
         .text('No medications found.', this.pageMargin, yPos + 20);
    }

    return this.finalizePDF(doc);
  }

  // Generate missed doses report PDF
  async generateMissedDosesReport(data) {
    const doc = this.createDocument();
    
    let yPos = this.addHeader(doc, 'Missed Doses Report');

    if (data.missedDoses && data.missedDoses.length > 0) {
      yPos = this.addSectionHeader(doc, 'Missed Dose History', yPos);
      
      const headers = ['Date', 'Medication', 'Scheduled Time', 'Reason'];
      const tableData = data.missedDoses.slice(0, 30).map(dose => ({
        'Date': format(new Date(dose.scheduledTime), 'MM/dd/yyyy'),
        'Medication': dose.medication?.name || dose.regimen?.medication?.name || 'Unknown',
        'Scheduled Time': format(new Date(dose.scheduledTime), 'HH:mm'),
        'Reason': (dose.notes || 'Not specified').substring(0, 25)
      }));

      this.addTable(doc, headers, tableData, yPos);
    } else {
      doc.font('Helvetica').fontSize(12)
         .text('No missed doses found for the selected period.', this.pageMargin, yPos + 20);
    }

    return this.finalizePDF(doc);
  }

  // Generate calendar data report PDF
  async generateCalendarReport(data) {
    const doc = this.createDocument();
    
    let yPos = this.addHeader(doc, 'Calendar Adherence Data');

    if (data && data.length > 0) {
      yPos = this.addSectionHeader(doc, 'Daily Adherence Summary', yPos);
      
      const headers = ['Date', 'Total Doses', 'Taken', 'Adherence %'];
      const tableData = data.slice(0, 40).map(day => ({
        'Date': format(new Date(day.date), 'MM/dd/yyyy'),
        'Total Doses': day.totalDoses,
        'Taken': day.takenDoses,
        'Adherence %': `${day.adherenceRate?.toFixed(1) || 0}%`
      }));

      this.addTable(doc, headers, tableData, yPos);
    } else {
      doc.font('Helvetica').fontSize(12)
         .text('No calendar data found for the selected period.', this.pageMargin, yPos + 20);
    }

    return this.finalizePDF(doc);
  }

  // Finalize PDF and return buffer
  async finalizePDF(doc) {
    // Add page numbers
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(8)
         .text(`Page ${i + 1} of ${pages.count}`, 
               doc.page.width - 100, doc.page.height - 30, 
               { align: 'center' });
    }

    return new Promise((resolve, reject) => {
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }
}

module.exports = new PDFService();
