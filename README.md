# PowerSchool Schedule Automation

Complete automation system for fetching PowerSchool schedules and integrating with Schoology for daily schedule types.

## Quick Start

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# SGY_USERNAME=your_schoology_username
# SGY_PASSWORD=your_schoology_password
# PS_USERNAME=your_powerschool_username
# PS_PASSWORD=your_powerschool_password

# Install dependencies
bun install

# Start all services
bun run cookie:start    # Cookie extraction service (port 8080)
python scheduling.py    # Schoology API (port 8000)
bun run api:start       # Schedule API (port 8081)
bun run schedule:start  # Schedule daemon
```