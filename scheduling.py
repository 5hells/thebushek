"""HTTP API for fetching Holy Ghost Prep calendar events."""

import asyncio
import os
import datetime
import re
import sys
from calendar import monthrange

import async_timeout
import bs4 as bs
import pytz
from dotenv import load_dotenv
from fastapi import FastAPI
import requests

if sys.platform == 'win32':
	asyncio.set_event_loop(asyncio.SelectorEventLoop())

load_dotenv()

app = FastAPI()


def parse_hgp_calendar(html: str) -> list:
    """Parse Holy Ghost Prep calendar HTML and extract events from current month only."""
    soup = bs.BeautifulSoup(html, features="html.parser")
    events = []
    eastern_tz = pytz.timezone("US/Eastern")
    
    # Get current date to filter events
    now = datetime.datetime.now(eastern_tz)
    current_year = now.year
    current_month = now.month
    
    # Find all calendar dayboxes
    dayboxes = soup.find_all("div", class_="fsCalendarDaybox")
    
    for daybox in dayboxes:
        # Find the date element
        date_elem = daybox.find("div", class_="fsCalendarDate")
        if not date_elem:
            continue
            
        # Extract date attributes
        day = date_elem.get("data-day")
        year = date_elem.get("data-year")
        month = date_elem.get("data-month")  # Note: month is 0-indexed in the HTML
        
        if not all([day, year, month]):
            continue
            
        try:
            day = int(day)
            year = int(year)
            month = int(month) + 1  # Convert from 0-indexed to 1-indexed
        except (ValueError, TypeError):
            continue
        
        # Only include events from the current month
        if year != current_year or month != current_month:
            continue
            
        # Skip past dates
        event_date = datetime.date(year, month, day)
        if event_date < now.date():
            continue
        
        # Format the date string
        date_str = event_date.strftime("%B %d, %Y")  # e.g., "January 14, 2026"
        
        # Find all events for this day
        event_infos = daybox.find_all("div", class_="fsCalendarInfo")
        
        for event_info in event_infos:
            # Find the event title link
            event_link = event_info.find("a", class_="fsCalendarEventTitle")
            if not event_link:
                continue
                
            title = event_link.get("title") or event_link.get_text(strip=True)
            if not title:
                continue
            
            # Extract time information
            time_range = event_info.find("div", class_="fsTimeRange")
            event_time = "All Day"
            
            if time_range:
                all_day_elem = time_range.find("span", class_="fsAllDayEvent")
                if all_day_elem:
                    event_time = "All Day"
                else:
                    start_time_elem = time_range.find("time", class_="fsStartTime")
                    if start_time_elem:
                        # Extract time text
                        time_text = start_time_elem.get_text(strip=True)
                        event_time = time_text
            
            # Create event object
            event = {
                "title": title,
                "date": date_str,
                "time": event_time,
                "group": "School Calendar",
            }
            
            events.append(event)
    
    return events


async def get_upcoming_events(session: requests.Session, calendar_url: str) -> list:
    """Get upcoming events from Holy Ghost Prep calendar."""
    async with async_timeout.timeout(15):
        response = session.get(
            calendar_url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:104.0) Gecko/20100101 Firefox/104.0",
            },
        )
        response.raise_for_status()
        html = response.text
    
    events = parse_hgp_calendar(html)
    return events


@app.get("/upcoming-events")
async def upcoming_events_endpoint():
    """Fetch upcoming events from Schoology."""
    with requests.Session() as session:
        events = await get_upcoming_events(session, "https://www.holyghostprep.org/calendar-header/")
        return {"events": events}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)