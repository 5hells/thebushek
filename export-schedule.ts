import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCurrentScheduleWithTimes } from './schedule';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ScheduleJsonFormat {
    day?: string;
    scheduleType?: string;
    periods: Array<{
        name: string;
        start: string;
        end: string;
        course?: {
            name: string;
            section: string;
            room: string;
            capacity: string;
        };
    }>;
}

/**
 * Export schedule to JSON file in the format expected by frontend
 */
async function exportScheduleToJson() {
    const username = process.env.PS_USERNAME;
    const password = process.env.PS_PASSWORD;
    const outputPath = process.env.SCHEDULE_OUTPUT_PATH || './schedule.json';

    if (!username || !password) {
        console.error('❌ PS_USERNAME and PS_PASSWORD must be set in environment variables');
        process.exit(1);
    }

    console.log('🔄 Fetching current schedule...');

    try {
        const schedule = await getCurrentScheduleWithTimes(username, password);

        if (!schedule) {
            console.error('❌ Could not determine current schedule from Schoology');
            console.log('💡 Make sure the Schoology API is running and credentials are correct');
            process.exit(1);
        }

        console.log(`✅ Fetched schedule for ${schedule.day} Day (${schedule.scheduleType})`);

        // Convert to frontend format
        const outputData: ScheduleJsonFormat = {
            day: schedule.day,
            scheduleType: schedule.scheduleType,
            periods: schedule.periods.map((period) => {
                const startDate = new Date(period.startTime);
                const endDate = new Date(period.endTime);

                // Format as ISO 8601 strings
                const result: ScheduleJsonFormat['periods'][0] = {
                    name: period.course 
                        ? `Period ${period.period}: ${period.course.name}`
                        : `Period ${period.period}`,
                    start: startDate.toISOString(),
                    end: endDate.toISOString(),
                };

                if (period.course) {
                    result.course = period.course;
                }

                return result;
            }),
        };

        // Write to file
        const fullPath = join(__dirname, outputPath);
        await writeFile(fullPath, JSON.stringify(outputData, null, 4), 'utf-8');

        console.log(`✅ Schedule exported to: ${fullPath}`);
        console.log(`📊 Exported ${outputData.periods.length} periods`);

    } catch (error) {
        console.error('❌ Error exporting schedule:', error);
        if (error instanceof Error) {
            console.error('   ', error.message);
        }
        process.exit(1);
    }
}

// Run if executed directly
if (import.meta.main) {
    exportScheduleToJson();
}

export { exportScheduleToJson };
