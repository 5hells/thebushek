import { fetch } from 'undici';
import { JSDOM } from 'jsdom';
import { login, extractCookie } from './cookie';
import schedulemap from './schedulemap';
import puppeteer from 'puppeteer';
import UndetectedBrowser from 'undetected-browser';

const s = {
    ps_base: process.env.PS_BASE || "holyghostprep",
    ps_username: process.env.PS_USERNAME || "your_username",
    ps_password: process.env.PS_PASSWORD || "your_password",
    guardian: process.env.PS_GUARDIAN === 'true' || false,
    frn: process.env.PS_FRN || "0052052", // Faculty Resource Number
    schoology_api: process.env.SCHOOLOGY_API_URL || "http://localhost:8000",
};

interface Course {
    name: string;
    section: string;
    room: string;
    capacity: string;
}

interface ScheduleMatrix {
    day: string; // A, B, C, D, E, F, G, H
    periods: {
        [period: string]: Course | null; // period 1-10
    };
}

interface ScheduleWithTimes {
    day: string;
    scheduleType: string; // "Daily Schedule", "MM", "X", "AB1"
    periods: {
        period: number;
        course: Course | null;
        startTime: Date;
        endTime: Date;
    }[];
}

/**
 * Fetch schedule matrix from PowerSchool using authenticated cookies
 */
export async function fetchScheduleMatrix(
    username: string,
    password: string,
    frn: string = s.frn
): Promise<ScheduleMatrix[]> {
    // Launch browser for PowerSchool navigation
    const browser = await new UndetectedBrowser(await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--window-size=1280,800',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-site-isolation-trials',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ],
        defaultViewport: {
            width: 1280,
            height: 800
        },
        browser: "chrome"
    })).getBrowser();

    try {
        const page = await browser.newPage();

        // Set user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Navigate to PowerSchool login page
        const loginUrl = `https://${s.ps_base}.powerschool.com/${s.guardian ? "public" : "teachers"}/`;
        console.log(`Navigating to: ${loginUrl}`);
        await page.goto(loginUrl, { waitUntil: 'networkidle2' });

        // Wait for login form and fill it
        await page.waitForSelector('#s-user-login-form', { timeout: 10000 });

        // Fill username and password
        await page.type('input[name="mail"]', username);
        await page.type('input[name="pass"]', password);

        // Find and fill any additional form fields
        const form = await page.$('#s-user-login-form');
        if (form) {
            const inputs = await form.$$('input');
            for (const input of inputs) {
                const name = await input.evaluate(el => el.getAttribute('name'));
                if (name && name !== 'mail' && name !== 'pass') {
                    const value = await input.evaluate(el => el.getAttribute('value') || '');
                    if (value) {
                        await input.type(value);
                    }
                }
            }
        }

        // Submit the form
        await page.click('#s-user-login-form input[type="submit"], #s-user-login-form button[type="submit"]');

        // Wait for navigation after login
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

        // Check if login was successful
        const currentUrl = page.url();
        const pageContent = await page.content();

        if (pageContent.includes('Invalid username or password') ||
            currentUrl.toLowerCase().includes('login') ||
            pageContent.toLowerCase().includes('login')) {
            throw new Error('Login failed - invalid credentials or still on login page');
        }

        console.log('Login successful, navigating to schedule matrix...');

        // Navigate to schedule matrix
        const scheduleUrl = `https://${s.ps_base}.powerschool.com/teachers/schedulematrix_content.html?frn=${frn}&includeCoTeachSections=1&showOnlyActiveRole=1&_=${Date.now()}`;
        console.log(`Fetching schedule from: ${scheduleUrl}`);

        await page.goto(scheduleUrl, { waitUntil: 'networkidle2' });

        // Extract the HTML content
        const html = await page.content();

        console.log('Schedule matrix fetched successfully');

        return parseScheduleMatrix(html);

    } finally {
        // Always close the browser
        await browser.close();
    }
}

/**
 * Parse the HTML table from PowerSchool schedule matrix
 */
function parseScheduleMatrix(html: string): ScheduleMatrix[] {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const table = document.getElementById('schedMatrixTable');

    if (!table) {
        throw new Error('Schedule matrix table not found');
    }

    const schedules: ScheduleMatrix[] = [];
    const rows = Array.from(table.querySelectorAll('tr'));

    // Skip header row
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i]!;
        const dayCell = row.querySelector('th.header[scope="rowgroup"]');

        if (dayCell) {
            // This is the start of a new day
            const day = dayCell.textContent?.trim() || '';
            const schedule: ScheduleMatrix = {
                day,
                periods: {},
            };

            // Parse periods (columns 4-13 are periods 1-10)
            const cells = Array.from(row.querySelectorAll('td'));
            let periodIndex = 1;

            for (const cell of cells) {
                if (cell.classList.contains('matrix_1') || 
                    cell.classList.contains('matrix_2') ||
                    cell.classList.contains('matrix_3') ||
                    cell.classList.contains('matrix_4') ||
                    cell.classList.contains('matrix_5') ||
                    cell.classList.contains('matrix_6') ||
                    cell.classList.contains('matrix_7')) {
                    
                    const courseName = cell.querySelector('.sched-course-name')?.textContent?.trim();
                    const sectionNumber = cell.querySelector('.sched-section-number span')?.textContent?.trim();
                    const room = cell.querySelector('.sched-room span:last-child')?.textContent?.trim();
                    const capacity = cell.querySelector('.sched-cap')?.textContent?.trim();

                    if (courseName) {
                        // Find which period this is by checking previous cells
                        let actualPeriod = periodIndex;
                        const allCells = Array.from(row.querySelectorAll('td'));
                        actualPeriod = allCells.indexOf(cell) - 1; // Adjust for term columns

                        if (actualPeriod >= 1 && actualPeriod <= 10) {
                            schedule.periods[actualPeriod] = {
                                name: courseName,
                                section: sectionNumber || '',
                                room: room || '',
                                capacity: capacity || '',
                            };
                        }
                    }
                }
            }

            schedules.push(schedule);
        }
    }

    return schedules;
}

/**
 * Get the current day's schedule type from Schoology
 * Returns format like "F Day (Daily Schedule)" or "A Day (Morning Meeting)"
 */
export async function getSchoologyDayType(): Promise<{ day: string; scheduleType: string } | null> {
    try {
        const response = await fetch(`${s.schoology_api}/upcoming-events`);
        const data = await response.json() as { events: Array<{ title: string; date: string; time: string }> };

        // Look for events that indicate the schedule type
        // Schoology typically has an event like "F Day (Daily Schedule)"
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        
        for (const event of data.events) {
            // Match patterns like "A Day", "F Day (Daily Schedule)", etc.
            const dayMatch = event.title.match(/^([A-H])\s+Day(?:\s+\(([^)]+)\))?/i);
            if (dayMatch && event.date === today) {
                return {
                    day: dayMatch[1]!.toUpperCase(),
                    scheduleType: dayMatch[2] || 'Daily Schedule',
                };
            }
        }

        return null;
    } catch (error) {
        console.error('Failed to fetch Schoology day type:', error);
        return null;
    }
}

/**
 * Map schedule type name to schedulemap key
 */
function mapScheduleType(scheduleType: string): keyof typeof schedulemap {
    const normalized = scheduleType.toLowerCase();
    
    if (normalized.includes('morning meeting') || normalized === 'mm') {
        return 'MM';
    } else if (normalized.includes('x schedule') || normalized === 'x') {
        return 'X';
    } else if (normalized.includes('a/b1') || normalized.includes('ab1')) {
        return 'AB1';
    } else if (normalized.includes('daily')) {
        return 'Daily Schedule';
    } else if (normalized.includes('unum')) {
        return 'Unum Schedule';
    }
    
    // Default to Daily Schedule
    return 'Daily Schedule';
}

/**
 * Combine PowerSchool schedule with Schoology day type and time slots
 */
export async function getCurrentScheduleWithTimes(
    username: string,
    password: string
): Promise<ScheduleWithTimes | null> {
    try {
        // Get schedule matrix from PowerSchool
        const schedules = await fetchScheduleMatrix(username, password);
        
        // Get current day type from Schoology
        const dayInfo = await getSchoologyDayType();
        
        if (!dayInfo) {
            console.log('Could not determine current day from Schoology');
            return null;
        }

        // Find the schedule for the current day
        const todaySchedule = schedules.find(s => s.day === dayInfo.day);
        
        if (!todaySchedule) {
            console.log(`No schedule found for ${dayInfo.day} day`);
            return null;
        }

        // Map schedule type to time slots
        const scheduleKey = mapScheduleType(dayInfo.scheduleType);
        const timeSlots = schedulemap[scheduleKey];

        if (!timeSlots) {
            console.log(`No time slots found for schedule type: ${scheduleKey}`);
            return null;
        }

        // Combine courses with time slots
        const periodsWithTimes = timeSlots.map((slot, index) => {
            const periodNumber = index + 1;
            const course = todaySchedule.periods[periodNumber] || null;

            return {
                period: periodNumber,
                course,
                startTime: new Date(slot.start),
                endTime: new Date(slot.end),
            };
        });

        return {
            day: dayInfo.day,
            scheduleType: dayInfo.scheduleType,
            periods: periodsWithTimes,
        };
    } catch (error) {
        console.error('Error getting schedule with times:', error);
        return null;
    }
}

/**
 * Get all schedules with times for all days
 */
export async function getAllSchedulesWithTimes(
    username: string,
    password: string,
    scheduleType: string = 'Daily Schedule'
): Promise<ScheduleWithTimes[]> {
    const schedules = await fetchScheduleMatrix(username, password);
    const scheduleKey = mapScheduleType(scheduleType);
    const timeSlots = schedulemap[scheduleKey];

    if (!timeSlots) {
        throw new Error(`No time slots found for schedule type: ${scheduleKey}`);
    }

    return schedules.map(schedule => ({
        day: schedule.day,
        scheduleType,
        periods: timeSlots.map((slot, index) => {
            const periodNumber = index + 1;
            const course = schedule.periods[periodNumber] || null;

            return {
                period: periodNumber,
                course,
                startTime: new Date(slot.start),
                endTime: new Date(slot.end),
            };
        }),
    }));
}

// CLI usage
if (import.meta.main) {
    const username = process.env.PS_USERNAME || s.ps_username;
    const password = process.env.PS_PASSWORD || s.ps_password;

    console.log('Fetching current schedule...\n');

    getCurrentScheduleWithTimes(username, password).then(schedule => {
        if (!schedule) {
            console.log('Could not get current schedule');
            return;
        }

        console.log(`=== ${schedule.day} Day (${schedule.scheduleType}) ===\n`);

        for (const period of schedule.periods) {
            const startTime = period.startTime.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
            });
            const endTime = period.endTime.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
            });

            console.log(`Period ${period.period}: ${startTime} - ${endTime}`);
            
            if (period.course) {
                console.log(`  Course: ${period.course.name}`);
                console.log(`  Section: ${period.course.section}`);
                console.log(`  Room: ${period.course.room}`);
                console.log(`  Capacity: ${period.course.capacity}`);
            } else {
                console.log(`  No class scheduled`);
            }
            console.log();
        }
    }).catch(error => {
        console.error('Error:', error);
    });
}
