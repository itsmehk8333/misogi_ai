const cron = require('node-cron');
const notificationService = require('./notificationService');

class SchedulerService {
  constructor() {
    this.jobs = [];
  }

  // Start all scheduled tasks
  start() {
    console.log('Starting notification scheduler...');

    // Check for upcoming doses every 5 minutes
    const upcomingJob = cron.schedule('*/5 * * * *', async () => {
      console.log('Checking for upcoming doses...');
      try {
        await notificationService.checkUpcomingDoses();
      } catch (error) {
        console.error('Error checking upcoming doses:', error);
      }
    }, {
      scheduled: false
    });

    // Check for overdue doses every 15 minutes
    const overdueJob = cron.schedule('*/15 * * * *', async () => {
      console.log('Checking for overdue doses...');
      try {
        await notificationService.checkOverdueDoses();
      } catch (error) {
        console.error('Error checking overdue doses:', error);
      }
    }, {
      scheduled: false
    });

    // Start the jobs
    upcomingJob.start();
    overdueJob.start();

    // Store references to jobs for later management
    this.jobs.push(
      { name: 'upcoming-doses', job: upcomingJob },
      { name: 'overdue-doses', job: overdueJob }
    );

    console.log('Notification scheduler started with the following jobs:');
    console.log('- Upcoming doses check: every 5 minutes');
    console.log('- Overdue doses check: every 15 minutes');
  }

  // Stop all scheduled tasks
  stop() {
    console.log('Stopping notification scheduler...');
    this.jobs.forEach(({ name, job }) => {
      job.stop();
      console.log(`Stopped job: ${name}`);
    });
    this.jobs = [];
  }

  // Get status of all jobs
  getStatus() {
    return this.jobs.map(({ name, job }) => ({
      name,
      running: job.running
    }));
  }

  // Manually trigger upcoming doses check
  async triggerUpcomingCheck() {
    console.log('Manually triggering upcoming doses check...');
    try {
      await notificationService.checkUpcomingDoses();
      return { success: true, message: 'Upcoming doses check completed' };
    } catch (error) {
      console.error('Manual upcoming check failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Manually trigger overdue doses check
  async triggerOverdueCheck() {
    console.log('Manually triggering overdue doses check...');
    try {
      await notificationService.checkOverdueDoses();
      return { success: true, message: 'Overdue doses check completed' };
    } catch (error) {
      console.error('Manual overdue check failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const schedulerService = new SchedulerService();

module.exports = schedulerService;
