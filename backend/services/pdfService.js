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
    try {
      const doc = this.createDocument();
      
      // Validate required data
      if (!data || !data.reportPeriod) {
        throw new Error('Invalid report data: missing reportPeriod');
      }

      // Safely format dates with error handling
      let periodText;
      try {
        const startDate = data.reportPeriod.startDate ? new Date(data.reportPeriod.startDate) : new Date();
        const endDate = data.reportPeriod.endDate ? new Date(data.reportPeriod.endDate) : new Date();
        periodText = `Period: ${format(startDate, 'MMM dd, yyyy')} - ${format(endDate, 'MMM dd, yyyy')}`;
      } catch (dateError) {
        console.warn('Date formatting error in PDF generation:', dateError);
        periodText = 'Period: Current Report';
      }
      
      // Header
      let yPos = this.addHeader(doc, 'Medication Adherence Report', periodText);

      // Overall statistics with enhanced validation
      yPos = this.addSectionHeader(doc, 'Summary Statistics', yPos);
      
      // Ensure numeric values are properly handled
      const overallAdherence = typeof data.overallAdherence === 'number' ? data.overallAdherence : 0;
      const totalDoses = typeof data.totalDoses === 'number' ? data.totalDoses : 0;
      const takenDoses = typeof data.takenDoses === 'number' ? data.takenDoses : 0;
      const missedDoses = typeof data.missedDoses === 'number' ? data.missedDoses : 0;
      const currentStreak = typeof data.currentStreak === 'number' ? data.currentStreak : 0;
      const bestStreak = typeof data.bestStreak === 'number' ? data.bestStreak : 0;
      
      const stats = {
        'Overall Adherence': `${overallAdherence.toFixed(1)}%`,
        'Total Doses Scheduled': totalDoses.toString(),
        'Doses Taken': takenDoses.toString(),
        'Doses Missed': missedDoses.toString(),
        'Current Streak': `${currentStreak} days`,
        'Best Streak': `${bestStreak} days`
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
    return this.finalizePDF(doc);
    } catch (error) {
      console.error('Error generating adherence PDF report:', error);
      throw new Error(`PDF generation failed: ${error.message}`);
    }
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
    return this.finalizePDF(doc);
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

    return this.finalizePDF(doc);
  }

  // Generate missed doses report PDF
  async generateMissedDosesReport(data) {
    try {
      const doc = this.createDocument();
      
      // Validate data
      if (!data) {
        throw new Error('Invalid report data provided');
      }

      // Safely format dates with fallback
      let periodText = 'Missed Doses Report';
      if (data.reportPeriod && data.reportPeriod.startDate && data.reportPeriod.endDate) {
        try {
          const startDate = new Date(data.reportPeriod.startDate);
          const endDate = new Date(data.reportPeriod.endDate);
          periodText = `Period: ${format(startDate, 'MMM dd, yyyy')} - ${format(endDate, 'MMM dd, yyyy')}`;
        } catch (dateError) {
          console.warn('Date formatting error in missed doses PDF:', dateError);
        }
      }
      
      // Header
      let yPos = this.addHeader(doc, 'Missed Doses Report', periodText);

      // Summary statistics with validation
      if (data.summary && typeof data.summary === 'object') {
        yPos = this.addSectionHeader(doc, 'Summary', yPos);
        
        const summary = {
          'Total Missed Doses': (data.summary.totalMissed || 0).toString(),
          'Most Missed Medication': data.summary.mostMissedMedication || 'N/A',
          'Average Missed Per Day': (data.summary.avgMissedPerDay || 0).toFixed(1),
          'Missed Dose Rate': `${(data.summary.missedRate || 0).toFixed(1)}%`
        };

        yPos = this.addKeyValueSection(doc, summary, yPos);
      }

      // Missed doses table with enhanced validation
      if (data.missedDoses && Array.isArray(data.missedDoses) && data.missedDoses.length > 0) {
        yPos = this.addSectionHeader(doc, 'Missed Dose Details', yPos + 20);
        
        const headers = ['Date', 'Medication', 'Scheduled Time', 'Reason', 'Impact'];
        const missedData = data.missedDoses.map(dose => {
          // Validate dose object
          if (!dose || !dose.scheduledTime) {
            console.warn('Invalid dose data in missed doses report:', dose);
            return null;
          }

          try {
            return {
              'Date': format(new Date(dose.scheduledTime), 'MMM dd, yyyy'),
              'Medication': dose.medication?.name || dose.regimen?.medication?.name || 'Unknown',
              'Scheduled Time': format(new Date(dose.scheduledTime), 'HH:mm'),
              'Reason': (dose.notes || 'Not specified').substring(0, 25) + (dose.notes?.length > 25 ? '...' : ''),
              'Impact': dose.criticality || 'Low'
            };
          } catch (error) {
            console.warn('Error processing dose data:', error);
            return null;
          }
        }).filter(Boolean); // Remove null entries

        if (missedData.length > 0) {
          this.addTable(doc, headers, missedData, yPos);
        } else {
          doc.fontSize(12)
             .text('No valid missed dose data available.', this.pageMargin, yPos);
        }
      } else {
        doc.fontSize(12)
           .text('No missed doses found for the selected period.', this.pageMargin, yPos);
      }

      return this.finalizePDF(doc);
    } catch (error) {
      console.error('Error generating missed doses PDF report:', error);
      throw new Error(`Missed doses PDF generation failed: ${error.message}`);
    }
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



  // Generate calendar data report PDF
  async generateCalendarReport(data) {
    try {
      const doc = this.createDocument();
      
      let yPos = this.addHeader(doc, 'Calendar Adherence Data');

      if (data && Array.isArray(data) && data.length > 0) {
        yPos = this.addSectionHeader(doc, 'Daily Adherence Summary', yPos);
        
        const headers = ['Date', 'Total Doses', 'Taken', 'Adherence %'];
        const tableData = data.slice(0, 40).map(day => {
          // Validate day object
          if (!day || !day.date) {
            console.warn('Invalid calendar day data:', day);
            return null;
          }

          try {
            return {
              'Date': format(new Date(day.date), 'MM/dd/yyyy'),
              'Total Doses': (day.totalDoses || 0).toString(),
              'Taken': (day.takenDoses || 0).toString(),
              'Adherence %': `${(day.adherenceRate || 0).toFixed(1)}%`
            };
          } catch (error) {
            console.warn('Error processing calendar day:', error);
            return null;
          }
        }).filter(Boolean); // Remove null entries

        if (tableData.length > 0) {
          this.addTable(doc, headers, tableData, yPos);
        } else {
          doc.font('Helvetica').fontSize(12)
             .text('No valid calendar data available.', this.pageMargin, yPos + 20);
        }
      } else {
        doc.font('Helvetica').fontSize(12)
           .text('No calendar data found for the selected period.', this.pageMargin, yPos + 20);
      }

      return this.finalizePDF(doc);
    } catch (error) {
      console.error('Error generating calendar PDF report:', error);
      throw new Error(`Calendar PDF generation failed: ${error.message}`);
    }
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
