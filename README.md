# Expense Tracker

A simple web-based expense tracker for recording income and expenses, viewing summaries, and visualizing spending by category.

## How to Run

This is a static web application with no build step or server required.

1. Open `index.html` in any modern web browser (Chrome, Firefox, Edge, Safari).

That's it. All data is saved in the browser's localStorage, so it persists between sessions without a backend.

> **Note:** Chart.js is loaded from a CDN, so an internet connection is needed the first time the page loads.

## Features

- Add, edit, and delete income and expense transactions
- Balance, income, and expense totals displayed at the top
- Filter transactions by type and category
- Monthly expense summary showing totals grouped by month
- Category-wise doughnut chart for expense breakdown (powered by Chart.js)
- Data persists in localStorage
- Responsive layout for mobile and desktop

## Project Structure

```
index.html    — Application markup and Chart.js CDN link
styles.css    — All styling
script.js     — Application logic (vanilla JavaScript, ES6 modules)
```
