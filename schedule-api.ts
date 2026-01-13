import elysia from 'elysia';
import { getCurrentScheduleWithTimes, getAllSchedulesWithTimes, fetchScheduleMatrix } from './schedule';

const s = {
    port: parseInt(process.env.PORT || '8081', 10),
    ps_username: process.env.PS_USERNAME || '',
    ps_password: process.env.PS_PASSWORD || '',
};

const app = new elysia({
    serve: { port: s.port }
});

app
    .get('/schedule/current', async ({ query, set }) => {
        const username = (query as any).username || s.ps_username;
        const password = (query as any).password || s.ps_password;

        if (!username || !password) {
            set.status = 400;
            return { error: 'Username and password required' };
        }

        try {
            const schedule = await getCurrentScheduleWithTimes(username, password);
            
            if (!schedule) {
                set.status = 404;
                return { error: 'Could not determine current schedule' };
            }

            return schedule;
        } catch (error) {
            set.status = 500;
            return { error: error instanceof Error ? error.message : 'Unknown error' };
        }
    })
    .get('/schedule/all', async ({ query, set }) => {
        const username = (query as any).username || s.ps_username;
        const password = (query as any).password || s.ps_password;
        const scheduleType = (query as any).scheduleType || 'Daily Schedule';

        if (!username || !password) {
            set.status = 400;
            return { error: 'Username and password required' };
        }

        try {
            const schedules = await getAllSchedulesWithTimes(username, password, scheduleType);
            return { schedules };
        } catch (error) {
            set.status = 500;
            return { error: error instanceof Error ? error.message : 'Unknown error' };
        }
    })
    .get('/schedule/matrix', async ({ query, set }) => {
        const username = (query as any).username || s.ps_username;
        const password = (query as any).password || s.ps_password;
        const frn = (query as any).frn;

        if (!username || !password) {
            set.status = 400;
            return { error: 'Username and password required' };
        }

        try {
            const schedules = await fetchScheduleMatrix(username, password, frn);
            return { schedules };
        } catch (error) {
            set.status = 500;
            return { error: error instanceof Error ? error.message : 'Unknown error' };
        }
    })
    .get('/', ({ set }) => {
        set.headers['Content-Type'] = 'text/html';
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PowerSchool Schedule API</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            border-radius: 8px;
            padding: 24px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            margin-top: 0;
        }
        .endpoint {
            margin: 20px 0;
            padding: 16px;
            background: #f8f9fa;
            border-left: 4px solid #007bff;
            border-radius: 4px;
        }
        .endpoint h3 {
            margin-top: 0;
            color: #007bff;
        }
        .endpoint code {
            background: #e9ecef;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }
        .param {
            margin: 8px 0;
        }
        .param strong {
            color: #495057;
        }
        form {
            margin: 20px 0;
            padding: 20px;
            background: #e9ecef;
            border-radius: 4px;
        }
        label {
            display: block;
            margin: 10px 0 5px;
            font-weight: 500;
        }
        input, select {
            width: 100%;
            padding: 8px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            box-sizing: border-box;
        }
        button {
            margin-top: 15px;
            padding: 10px 20px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        button:hover {
            background: #0056b3;
        }
        #result {
            margin-top: 20px;
            padding: 16px;
            background: #f8f9fa;
            border-radius: 4px;
            white-space: pre-wrap;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            max-height: 500px;
            overflow-y: auto;
        }
        .schedule-grid {
            display: grid;
            gap: 12px;
            margin-top: 20px;
        }
        .period {
            padding: 12px;
            background: white;
            border: 1px solid #dee2e6;
            border-radius: 4px;
        }
        .period-time {
            font-weight: 600;
            color: #007bff;
            margin-bottom: 8px;
        }
        .course-name {
            font-size: 16px;
            font-weight: 500;
            color: #212529;
        }
        .course-details {
            font-size: 13px;
            color: #6c757d;
            margin-top: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📚 PowerSchool Schedule API</h1>
        <p>API for fetching and parsing PowerSchool schedules with Schoology integration</p>

        <div class="endpoint">
            <h3>GET /schedule/current</h3>
            <p>Get the current day's schedule with times based on Schoology day type</p>
            <div class="param"><strong>Query params:</strong> <code>username</code>, <code>password</code></div>
        </div>

        <div class="endpoint">
            <h3>GET /schedule/all</h3>
            <p>Get all schedules (A-H days) with times for a specific schedule type</p>
            <div class="param"><strong>Query params:</strong> <code>username</code>, <code>password</code>, <code>scheduleType</code> (optional)</div>
        </div>

        <div class="endpoint">
            <h3>GET /schedule/matrix</h3>
            <p>Get raw schedule matrix data from PowerSchool</p>
            <div class="param"><strong>Query params:</strong> <code>username</code>, <code>password</code>, <code>frn</code> (optional)</div>
        </div>

        <form id="scheduleForm">
            <h3>🔍 Test API</h3>
            <label for="endpoint">Endpoint:</label>
            <select id="endpoint" name="endpoint">
                <option value="/schedule/current">Current Schedule</option>
                <option value="/schedule/all">All Schedules</option>
                <option value="/schedule/matrix">Raw Matrix</option>
            </select>

            <label for="username">PowerSchool Username:</label>
            <input type="text" id="username" name="username" required>

            <label for="password">PowerSchool Password:</label>
            <input type="password" id="password" name="password" required>

            <div id="scheduleTypeField" style="display: none;">
                <label for="scheduleType">Schedule Type:</label>
                <select id="scheduleType" name="scheduleType">
                    <option value="Daily Schedule">Daily Schedule</option>
                    <option value="Morning Meeting">Morning Meeting (MM)</option>
                    <option value="X Schedule">X Schedule</option>
                    <option value="A/B1 Schedule">A/B1 Schedule</option>
                    <option value="Unum Schedule">Unum Schedule</option>
                </select>
            </div>

            <button type="submit">Fetch Schedule</button>
        </form>

        <div id="result"></div>
        <div id="scheduleView" class="schedule-grid"></div>
    </div>

    <script>
        const form = document.getElementById('scheduleForm');
        const endpoint = document.getElementById('endpoint');
        const scheduleTypeField = document.getElementById('scheduleTypeField');
        const result = document.getElementById('result');
        const scheduleView = document.getElementById('scheduleView');

        endpoint.addEventListener('change', () => {
            scheduleTypeField.style.display = 
                endpoint.value === '/schedule/all' ? 'block' : 'none';
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const endpointValue = endpoint.value;
            const scheduleType = document.getElementById('scheduleType').value;

            result.textContent = 'Loading...';
            scheduleView.innerHTML = '';

            const params = new URLSearchParams({ username, password });
            if (endpointValue === '/schedule/all') {
                params.append('scheduleType', scheduleType);
            }

            const start = performance.now();
            
            try {
                const response = await fetch(\`\${endpointValue}?\${params}\`);
                const data = await response.json();
                const end = performance.now();

                result.textContent = JSON.stringify(data, null, 2);
                result.textContent += \`\\n\\n⏱️ Request took \${(end - start).toFixed(2)}ms\`;

                // If current schedule, render it nicely
                if (endpointValue === '/schedule/current' && data.day) {
                    renderSchedule(data);
                }
            } catch (error) {
                result.textContent = 'Error: ' + error.message;
            }
        });

        function renderSchedule(schedule) {
            scheduleView.innerHTML = \`
                <h2>\${schedule.day} Day (\${schedule.scheduleType})</h2>
            \`;

            schedule.periods.forEach(period => {
                const div = document.createElement('div');
                div.className = 'period';

                const startTime = new Date(period.startTime).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });
                const endTime = new Date(period.endTime).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });

                div.innerHTML = \`
                    <div class="period-time">Period \${period.period}: \${startTime} - \${endTime}</div>
                    \${period.course ? \`
                        <div class="course-name">\${period.course.name}</div>
                        <div class="course-details">Section: \${period.course.section}</div>
                        <div class="course-details">Room: \${period.course.room}</div>
                        <div class="course-details">Capacity: \${period.course.capacity}</div>
                    \` : '<div class="course-details">No class scheduled</div>'}
                \`;

                scheduleView.appendChild(div);
            });
        }
    </script>
</body>
</html>
        `;
    })
    .listen({ port: s.port });

console.log(`🚀 Schedule API running on http://localhost:${s.port}`);
console.log(`📖 API Documentation: http://localhost:${s.port}`);
