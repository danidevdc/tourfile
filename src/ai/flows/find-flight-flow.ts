
'use server';
/**
 * @fileOverview A flight information retrieval agent using direct web scraping.
 * This agent uses Puppeteer to scrape flight data from a reliable source.
 *
 * - findFlight - A function that handles finding flight details via scraping.
 */

import puppeteer from 'puppeteer';
import { FindFlightInput, FindFlightOutput } from './flight-types';

export async function findFlight(input: FindFlightInput): Promise<FindFlightOutput> {
  console.log(`[FlightScraper] Starting search for ${input.flightNumber} on ${input.date}`);

  // Headless browser options
  const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  try {
    const searchUrl = `https://www.google.com/search?q=flight+${input.flightNumber}+on+${input.date}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });

    // Wait for the main flight result container to be visible
    await page.waitForSelector('div[data-lahe]', { timeout: 10000 });

    const flightData = await page.evaluate(() => {
        // This code runs in the browser context
        const departureEl = document.querySelector('div[data-lahe] .B63pAb .d22G1e');
        const departureTime = departureEl?.textContent?.trim() || null;
        const departureAirport = departureEl?.nextElementSibling?.textContent?.trim() || null;

        const arrivalEl = document.querySelector('div[data-lahe] .B63pAb .d22G1e:nth-child(2)');
        const arrivalTime = arrivalEl?.textContent?.trim() || null;
        const arrivalAirport = arrivalEl?.nextElementSibling?.textContent?.trim() || null;

        const airlineEl = document.querySelector('div[data-lahe] .B63pAb > div > span:last-child');
        const airlineName = airlineEl?.textContent?.trim() || null;

        if (!departureTime || !arrivalTime || !departureAirport || !arrivalAirport) {
            return { flightFound: false };
        }
        
        return {
            flightFound: true,
            departure: {
                airport: { code: departureAirport },
                time: { scheduled: departureTime, actual: departureTime }, // Assume scheduled and actual are the same from this source
            },
            arrival: {
                airport: { code: arrivalAirport },
                time: { scheduled: arrivalTime, actual: arrivalTime },
            },
            airline: airlineName,
            flightSegment: `${departureAirport}/${arrivalAirport}`
        };
    });

    console.log(`[FlightScraper] Data extracted:`, flightData);
    await browser.close();
    return flightData as FindFlightOutput;

  } catch (error) {
    console.error(`[FlightScraper] Error scraping flight data for ${input.flightNumber}:`, error);
    await browser.close();
    // Ensure we always return the correct object shape on error
    return { flightFound: false };
  }
}
