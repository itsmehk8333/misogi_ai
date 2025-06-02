// Schedule generation utilities
export const generateTodaySchedule = (regimens, todayDoses) => {
  const today = new Date();
  const schedule = [];

  // Generate scheduled doses from active regimens
  regimens
    .filter(regimen => regimen.isActive && isRegimenActiveToday(regimen))
    .forEach(regimen => {
      const times = getScheduleTimes(regimen);
      times.forEach(time => {
        const [hours, minutes] = time.split(':');
        const scheduledTime = new Date(today);
        scheduledTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);        // Check if this dose is already logged
        const existingDose = todayDoses.find(dose => {
          const doseRegimenId = dose.regimen?._id || dose.regimen;
          return doseRegimenId === regimen._id && 
            Math.abs(new Date(dose.scheduledTime || dose.timestamp) - scheduledTime) < 30 * 60 * 1000; // 30 min tolerance
        });
        
        if (!existingDose) {
          schedule.push({
            _id: `pending-${regimen._id}-${time}`,
            regimen: regimen, // Store full regimen object
            medication: regimen.medication,
            scheduledTime,
            status: 'pending',
            timeString: time,
            isOverdue: scheduledTime < new Date(),
            minutesLate: scheduledTime < new Date() ? 
              Math.floor((new Date() - scheduledTime) / (1000 * 60)) : 0,
            dosage: `${regimen.dosage?.amount} ${regimen.dosage?.unit}`
          });
        }
      });
    });
    // Combine scheduled doses with logged doses
  return [...schedule, ...todayDoses].sort((a, b) => 
    new Date(a.scheduledTime || a.timestamp) - new Date(b.scheduledTime || b.timestamp)
  );
};

export const isRegimenActiveToday = (regimen) => {
  const today = new Date();
  const startDate = new Date(regimen.startDate);
  const endDate = regimen.endDate ? new Date(regimen.endDate) : null;
  
  return today >= startDate && (!endDate || today <= endDate);
};

export const getScheduleTimes = (regimen) => {
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
};

export const shouldTakeToday = (regimen) => {
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
};

export const getScheduleStats = (schedule) => {
  const taken = schedule.filter(dose => dose.status === 'taken');
  const missed = schedule.filter(dose => dose.status === 'missed');
  const overdue = schedule.filter(dose => dose.status === 'pending' && dose.isOverdue);
  const total = schedule.length;
  
  return {
    taken: taken.length,
    missed: missed.length + overdue.length, // Include overdue as missed
    total,
    adherenceRate: total > 0 ? (taken.length / total) * 100 : 0
  };
};
