const map = {
    "MM Schedule": [
        { start: new Date().setHours(8, 45, 0, 0), end: new Date().setHours(9, 20, 0, 0) },
        { start: new Date().setHours(9, 25, 0, 0), end: new Date().setHours(10, 15, 0, 0) },
        { start: new Date().setHours(10, 15, 0, 0), end: new Date().setHours(10, 35, 0, 0) },
        { start: new Date().setHours(10, 35, 0, 0), end: new Date().setHours(11, 10, 0, 0) },
        { start: new Date().setHours(11, 15, 0, 0), end: new Date().setHours(11, 50, 0, 0) },
        { start: new Date().setHours(11, 55, 0, 0), end: new Date().setHours(12, 30, 0, 0) },
        { start: new Date().setHours(12, 35, 0, 0), end: new Date().setHours(12, 35, 0, 0) },
        { start: new Date().setHours(12, 35, 0, 0), end: new Date().setHours(13, 10, 0, 0) },
        { start: new Date().setHours(13, 15, 0, 0), end: new Date().setHours(13, 50, 0, 0) },
        { start: new Date().setHours(13, 55, 0, 0), end: new Date().setHours(14, 30, 0, 0) }
    ],
    "X Schedule": [
        { start: new Date().setHours(8, 0, 0, 0), end: new Date().setHours(8, 35, 0, 0) },
        { start: new Date().setHours(8, 40, 0, 0), end: new Date().setHours(10, 25, 0, 0) },
        { start: new Date().setHours(10, 25, 0, 0), end: new Date().setHours(10, 40, 0, 0) },
        { start: new Date().setHours(10, 40, 0, 0), end: new Date().setHours(11, 15, 0, 0) },
        { start: new Date().setHours(11, 20, 0, 0), end: new Date().setHours(11, 55, 0, 0) },
        { start: new Date().setHours(12, 0, 0, 0), end: new Date().setHours(12, 32, 0, 0) },
        { start: new Date().setHours(12, 33, 0, 0), end: new Date().setHours(12, 34, 0, 0) },
        { start: new Date().setHours(12, 35, 0, 0), end: new Date().setHours(13, 10, 0, 0) },
        { start: new Date().setHours(13, 15, 0, 0), end: new Date().setHours(13, 50, 0, 0) },
        { start: new Date().setHours(13, 55, 0, 0), end: new Date().setHours(14, 30, 0, 0) }
    ],
    "A/B1 Schedule": [
        { start: new Date().setHours(9, 45, 0, 0), end: new Date().setHours(10, 10, 0, 0) },
        { start: new Date().setHours(10, 15, 0, 0), end: new Date().setHours(10, 40, 0, 0) },
        { start: new Date().setHours(10, 40, 0, 0), end: new Date().setHours(11, 5, 0, 0) },
        { start: new Date().setHours(11, 5, 0, 0), end: new Date().setHours(11, 30, 0, 0) },
        { start: new Date().setHours(11, 35, 0, 0), end: new Date().setHours(12, 0, 0, 0) },
        { start: new Date().setHours(12, 5, 0, 0), end: new Date().setHours(12, 30, 0, 0) },
        { start: new Date().setHours(12, 35, 0, 0), end: new Date().setHours(13, 0, 0, 0) },
        { start: new Date().setHours(13, 5, 0, 0), end: new Date().setHours(13, 30, 0, 0) },
        { start: new Date().setHours(13, 35, 0, 0), end: new Date().setHours(14, 0, 0, 0) },
        { start: new Date().setHours(14, 5, 0, 0), end: new Date().setHours(14, 30, 0, 0) }
    ],
    "Daily Schedule": [
        { start: new Date().setHours(8, 0, 0, 0), end: new Date().setHours(8, 40, 0, 0) },
        { start: new Date().setHours(8, 45, 0, 0), end: new Date().setHours(9, 45, 0, 0) },
        { start: new Date().setHours(9, 45, 0, 0), end: new Date().setHours(10, 15, 0, 0) },
        { start: new Date().setHours(10, 15, 0, 0), end: new Date().setHours(10, 55, 0, 0) },
        { start: new Date().setHours(11, 0, 0, 0), end: new Date().setHours(11, 40, 0, 0) },
        { start: new Date().setHours(11, 45, 0, 0), end: new Date().setHours(12, 20, 0, 0) },
        { start: new Date().setHours(12, 20, 0, 0), end: new Date().setHours(12, 25, 0, 0) },
        { start: new Date().setHours(12, 25, 0, 0), end: new Date().setHours(13, 0, 0, 0) },
        { start: new Date().setHours(13, 5, 0, 0), end: new Date().setHours(13, 45, 0, 0) },
        { start: new Date().setHours(13, 50, 0, 0), end: new Date().setHours(14, 30, 0, 0) }
    ],
    "Unum Schedule": [
        { start: new Date().setHours(8, 0, 0, 0), end: new Date().setHours(8, 35, 0, 0) },
        { start: new Date().setHours(8, 40, 0, 0), end: new Date().setHours(9, 25, 0, 0) },
        { start: new Date().setHours(9, 30, 0, 0), end: new Date().setHours(10, 40, 0, 0) },
        { start: new Date().setHours(10, 40, 0, 0), end: new Date().setHours(11, 15, 0, 0) },
        { start: new Date().setHours(11, 20, 0, 0), end: new Date().setHours(11, 55, 0, 0) },
        { start: new Date().setHours(12, 0, 0, 0), end: new Date().setHours(12, 35, 0, 0) },
        { start: new Date().setHours(12, 35, 1, 0), end: new Date().setHours(12, 40, 0, 0) },
        { start: new Date().setHours(12, 40, 0, 0), end: new Date().setHours(13, 15, 0, 0) },
        { start: new Date().setHours(13, 20, 0, 0), end: new Date().setHours(13, 55, 0, 0) },
        { start: new Date().setHours(14, 0, 0, 0), end: new Date().setHours(14, 30, 0, 0) }
    ]
}

export default map;