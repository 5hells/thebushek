"""HTTP API for fetching Schoology upcoming events."""

import asyncio
import os
import datetime

import aiohttp
import async_timeout
import bs4 as bs
import pytz
from dotenv import load_dotenv
from fastapi import FastAPI

load_dotenv()

app = FastAPI()


def notnone(value):
    """Helper to assert that a value is not None."""
    if value is None:
        raise ValueError("Expected value to be not None")
    return value


async def schoology_login(
    session: aiohttp.ClientSession, username: str, password: str, api_base: str
) -> dict:
    """Login to Schoology and return cookies."""
    async with async_timeout.timeout(10):
        base_resp = await session.get(f"https://{api_base}/", allow_redirects=True)
        base_resp.raise_for_status()
        login_url = str(base_resp.url)

    print(f"Login URL: {login_url}")

    async with async_timeout.timeout(10):
        response = await session.get(login_url)
        response.raise_for_status()
        login_page = await response.text()

    form = bs.BeautifulSoup(login_page, features="html.parser")
    form_elem = form.find(id="s-user-login-form")
    if not form_elem:
        raise ValueError(f"Login form not found. Page: {login_page[:500]}...")

    form_action = form_elem.get("action") or login_url
    if not form_action.startswith("http"):
        if form_action.startswith("/"):
            form_action = f"https://{api_base}{form_action}"
        else:
            form_action = f"{login_url}/{form_action}"

    post_data = {
        "mail": username,
        "pass": password,
    }

    for input_tag in form_elem.find_all("input"):
        input_name = input_tag.get("name")
        if input_name and input_name not in ["mail", "pass"]:
            post_data[input_name] = input_tag.get("value", "")

    print(f"Posting to: {form_action}")

    async with async_timeout.timeout(10):
        response = await session.post(
            form_action,
            data=post_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            allow_redirects=True,
        )
        response.raise_for_status()
        body = await response.text()

    print(f"After login, final URL: {response.url}")
    print(f"Response status: {response.status}")
    print(f"Cookies in jar: {len(list(session.cookie_jar))}")

    if "Invalid username or password" in body or "login" in str(response.url).lower():
        if "invalid" in body.lower():
            raise ValueError("Invalid credentials")
        else:
            raise ValueError("Login failed - still on login page")

    cookies = {}
    for cookie in session.cookie_jar:
        cookies[cookie.key] = cookie.value

    return cookies


async def get_upcoming_events(
    session: aiohttp.ClientSession, api_base: str, cookies: dict
) -> list:
    """Get upcoming events from Schoology."""
    async with async_timeout.timeout(10):
        response = await session.get(
            f"https://{api_base}/home/upcoming_ajax",
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:104.0) Gecko/20100101 Firefox/104.0",
            },
        )
        response.raise_for_status()
        data = await response.json()

    html = data.get("html", "")
    soup = bs.BeautifulSoup(html, features="html.parser")
    events = []
    current_date = ""

    upcoming_list = soup.find(class_="upcoming-list")
    if not upcoming_list:
        return []

    for element in upcoming_list.find_all(recursive=False):
        if "date-header" in element.attrs.get("class", []):
            current_date = notnone(next(iter(element.children))).get_text(strip=True)
        elif "upcoming-event" in element.attrs.get("class", []):
            start_ts = int(str(notnone(element.get("data-start"))))
            eastern_tz = pytz.timezone("US/Eastern")
            dt_with_tz = datetime.datetime.fromtimestamp(start_ts, tz=eastern_tz)
            title = element.find(class_="event-title")
            group_elem = element.select_one(".realm-title-group") or element.select_one(
                ".realm-title-course-title .realm-main-titles"
            )
            group = group_elem.get_text(strip=True) if group_elem else None

            if title:
                events.append(
                    {
                        "title": title.get_text(strip=True),
                        "date": current_date,
                        "time": dt_with_tz.strftime("%I:%M %p"),
                        "group": group,
                    }
                )

    return events


@app.get("/upcoming-events")
async def upcoming_events_endpoint():
    """Fetch upcoming events from Schoology."""
    username = os.getenv("SGY_USERNAME")
    password = os.getenv("SGY_PASSWORD")
    api_base = os.getenv("API_BASE", "holyghostprep.schoology.com")

    if not username or not password:
        return {"error": "Credentials not set in environment variables"}

    try:
        async with aiohttp.ClientSession() as session:
            session.headers.update(
                {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:104.0) Gecko/20100101 Firefox/104.0",
                }
            )
            cookies = await schoology_login(session, username, password, api_base)
            events = await get_upcoming_events(session, api_base, cookies)
            return {"events": events}
    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)