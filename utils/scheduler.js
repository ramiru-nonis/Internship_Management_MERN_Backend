const cron = require('node-cron');
const PlacementForm = require('../models/PlacementForm');
const Notification = require('../models/Notification');
const User = require('../models/User');

const initScheduler = () => {
    // Run every day at midnight (00:00)
    cron.schedule('0 0 * * *', async () => {
        console.log('Running Internship Expiry Check...');
        try {
            const today = new Date();
            const oneMonthFromNow = new Date();
            oneMonthFromNow.setMonth(today.getMonth() + 1);

            // Find placements ending exactly one month from today (ignoring time)
            // Create a range for the entire day of "one month from now"
            const startOfDay = new Date(oneMonthFromNow.setHours(0, 0, 0, 0));
            const endOfDay = new Date(oneMonthFromNow.setHours(23, 59, 59, 999));

            const expiringPlacements = await PlacementForm.find({
                end_date: {
                    $gte: startOfDay,
                    $lte: endOfDay
                },
                oneMonthNotificationSent: { $ne: true }
            }).populate('student');

            if (expiringPlacements.length > 0) {
                const coordinator = await User.findOne({ role: 'coordinator' });

                if (coordinator) {
                    for (const placement of expiringPlacements) {
                        await Notification.create({
                            recipient: coordinator._id,
                            message: `Reminder: Internship for student ${placement.student?.first_name} ${placement.student?.last_name} (${placement.student?.cb_number}) ends in one month (on ${placement.end_date.toDateString()}). Please prepare for final presentations.`,
                            type: 'info'
                        });

                        placement.oneMonthNotificationSent = true;
                        await placement.save();
                    }
                }
                console.log(`Notified coordinator about ${expiringPlacements.length} expiring internships.`);
                // ... existing 1-month logic ...
            } else {
                console.log('No internships expiring in exactly one month.');
            }

            // --- 2 Weeks Check (For Student Reminder) ---
            const twoWeeksFromNow = new Date();
            twoWeeksFromNow.setDate(today.getDate() + 14);

            const startOfDay2W = new Date(twoWeeksFromNow.setHours(0, 0, 0, 0));
            const endOfDay2W = new Date(twoWeeksFromNow.setHours(23, 59, 59, 999));

            const expiringInTwoWeeks = await PlacementForm.find({
                end_date: {
                    $gte: startOfDay2W,
                    $lte: endOfDay2W
                },
                twoWeekNotificationSent: { $ne: true }
            }).populate('student');

            if (expiringInTwoWeeks.length > 0) {
                for (const placement of expiringInTwoWeeks) {
                    if (placement.student && placement.student.user) {
                        await Notification.create({
                            recipient: placement.student.user, // Notify the student user
                            message: `Reminder: Your internship ends in 2 weeks (on ${placement.end_date.toDateString()}). Please ensure your logbooks are up to date and prepare for your final presentation.`,
                            type: 'warning'
                        });

                        placement.twoWeekNotificationSent = true;
                        await placement.save();
                        console.log(`Notified student ${placement.student.first_name} about 2-week expiry.`);
                    }
                }
            } else {
                console.log('No internships expiring in exactly two weeks.');
            }

        } catch (error) {
            console.error('Error in Internship Expiry Scheduler:', error);
        }
    });

    console.log('Internship Expiry Scheduler initialized.');
};

module.exports = initScheduler;
