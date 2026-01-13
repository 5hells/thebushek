import { exportScheduleToJson } from './export-schedule';
import 'dotenv/config';

/**
 * Daemon that exports schedule daily at specified time
 */
class ScheduleExportDaemon {
    private intervalMinutes: number;
    private isRunning: boolean = false;
    private timer: Timer | null = null;

    constructor(intervalMinutes: number = 1440) { // Default: 24 hours
        this.intervalMinutes = intervalMinutes;
    }

    /**
     * Start the daemon
     */
    async start() {
        if (this.isRunning) {
            console.log('⚠️  Daemon is already running');
            return;
        }

        this.isRunning = true;
        console.log('🚀 Schedule Export Daemon started');
        console.log(`📅 Export interval: ${this.intervalMinutes} minutes`);

        // Run immediately on start
        await this.runExport();

        // Schedule periodic exports
        this.scheduleNext();
    }

    /**
     * Schedule next export
     */
    private scheduleNext() {
        const intervalMs = this.intervalMinutes * 60 * 1000;
        
        this.timer = setTimeout(async () => {
            await this.runExport();
            this.scheduleNext(); // Schedule next run
        }, intervalMs);

        const nextRun = new Date(Date.now() + intervalMs);
        console.log(`⏰ Next export scheduled for: ${nextRun.toLocaleString()}`);
    }

    /**
     * Run the export with error handling
     */
    private async runExport() {
        const timestamp = new Date().toLocaleString();
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🕐 Running scheduled export at ${timestamp}`);
        console.log('='.repeat(60));

        try {
            await exportScheduleToJson();
            console.log('✅ Export completed successfully');
        } catch (error) {
            console.error('❌ Export failed:', error);
            if (error instanceof Error) {
                console.error('   ', error.message);
            }
        }
    }

    /**
     * Stop the daemon
     */
    stop() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.isRunning = false;
        console.log('🛑 Schedule Export Daemon stopped');
    }
}

// Run if executed directly
if (import.meta.main) {
    // Get interval from environment or default to 24 hours
    const intervalMinutes = parseInt(process.env.EXPORT_INTERVAL_MINUTES || '1440', 10);

    const daemon = new ScheduleExportDaemon(intervalMinutes);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n\n🛑 Received SIGINT, shutting down gracefully...');
        daemon.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\n\n🛑 Received SIGTERM, shutting down gracefully...');
        daemon.stop();
        process.exit(0);
    });

    // Start the daemon
    daemon.start().catch((error) => {
        console.error('❌ Failed to start daemon:', error);
        process.exit(1);
    });
}

export { ScheduleExportDaemon };
