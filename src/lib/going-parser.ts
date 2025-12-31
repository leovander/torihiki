import { logger } from './logger';
import { GOING_AIRPORT, GOING_DEAL } from '../types/message';

/**
 * Strips HTML tags and decodes entities, normalizes whitespace
 */
function stripHtml(html: string): string {
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ') // Collapse multiple whitespace to single space
        .trim();
}

/**
 * Parses a Going.com flight deal email and extracts structured data
 */
export function parseGoingEmail(html: string): GOING_DEAL | null {
    // Normalize whitespace for consistent matching
    const normalized = html.replace(/\s+/g, ' ');

    // Try multiple patterns for destination extraction
    const destinationPatterns = [
        // Pattern: <h1>...<span class="tinyMce-placeholder">Destination</span></h1>
        /<h1[^>]*>.*?<span[^>]*tinyMce-placeholder[^>]*>([^<]+)<\/span>/i,
        // Pattern: "nonstop flight to <a>...</a>"
        /(?:nonstop|cheap|direct)?\s*flight(?:s)? to\s*<a[^>]*>([^<]+)<\/a>/i,
        /booking a.*?flight to\s*<a[^>]*>([^<]+)<\/a>/i,
        /deal(?:s)? to\s*<a[^>]*>([^<]+)<\/a>/i,
        /trip to\s*<a[^>]*>([^<]+)<\/a>/i,
    ];

    let destination = '';
    for (const pattern of destinationPatterns) {
        const match = normalized.match(pattern);
        if (match) {
            destination = stripHtml(match[1]);
            break;
        }
    }

    if (!destination) {
        logger.debug('Going parser: No destination found in email');
        return null;
    }

    // Extract flight price - look for "<strong>Flight price</strong></p>...<p...>$XXX roundtrip</p>"
    const priceMatch = normalized.match(
        /<strong>Flight price<\/strong>\s*<\/p>\s*<p[^>]*>([^<]+)<\/p>/i,
    );
    const flightPrice = priceMatch ? stripHtml(priceMatch[1]) : '';

    // Extract original price from strikethrough span
    const originalPriceMatch = normalized.match(
        /text-decoration:\s*line-through[^>]*>\s*\$(\d+)/i,
    );
    const originalPrice = originalPriceMatch ? `$${originalPriceMatch[1]}` : '';

    // Extract travel dates
    const travelDatesMatch = normalized.match(
        /<strong>Travel dates<\/strong>\s*<\/p>\s*<p[^>]*>([^<]+)<\/p>/i,
    );
    const travelDates = travelDatesMatch ? stripHtml(travelDatesMatch[1]) : '';

    // Extract book within timeframe
    const bookWithinMatch = normalized.match(
        /<strong>Book within<\/strong>\s*<\/p>\s*<p[^>]*>([^<]+)<\/p>/i,
    );
    const bookWithin = bookWithinMatch ? stripHtml(bookWithinMatch[1]) : '';

    // Extract airports from "From airports you're following" section
    const airports: GOING_AIRPORT[] = [];

    // Pattern for airport entries: city name in link followed by airport code
    // <a ...>Los Angeles, California</a>&nbsp;<span>LAX</span>
    // followed by price: $544 and crossed out price: $1015
    const airportPattern =
        /<a[^>]*>([^<]+)<\/a>\s*(?:&nbsp;)?\s*<span>([A-Z]{3})<\/span>[\s\S]*?<span[^>]*>\s*\$(\d+)\s*<\/span>(?:[\s\S]*?line-through[^>]*>\s*\$(\d+))?/gi;

    let airportMatch;
    while ((airportMatch = airportPattern.exec(normalized)) !== null) {
        const city = stripHtml(airportMatch[1]);
        const code = airportMatch[2];
        const price = `$${airportMatch[3]}`;
        const origPrice = airportMatch[4] ? `$${airportMatch[4]}` : undefined;

        // Avoid duplicates
        if (!airports.some((a) => a.code === code)) {
            airports.push({
                city,
                code,
                price,
                originalPrice: origPrice,
            });
        }
    }

    // Extract tags (Nonstop, Economy, etc.)
    const tagsPattern =
        /background:#eff2e3[^>]*>[\s\S]*?([A-Za-z]+)[\s\S]*?<\/span>/gi;
    const tags: string[] = [];
    let tagMatch;
    while ((tagMatch = tagsPattern.exec(normalized)) !== null) {
        const tag = stripHtml(tagMatch[1]);
        if (tag && !tags.includes(tag)) {
            tags.push(tag);
        }
    }

    // Add tags to airports
    if (tags.length > 0 && airports.length > 0) {
        airports.forEach((airport) => {
            airport.tags = tags;
        });
    }

    return {
        destination,
        flightPrice,
        originalPrice,
        travelDates,
        bookWithin,
        airports,
    };
}

/**
 * Formats a Going deal into a Telegram message
 */
export function formatGoingDealMessage(deal: GOING_DEAL): string {
    const lines: string[] = [];

    lines.push(`Going Deal: ${deal.destination}`);
    lines.push('');

    // Price line
    let priceLine = `Price: ${deal.flightPrice}`;
    if (deal.originalPrice) {
        priceLine += ` (was ${deal.originalPrice})`;
    }
    lines.push(priceLine);

    // Travel dates
    if (deal.travelDates) {
        lines.push(`Travel dates: ${deal.travelDates}`);
    }

    // Book within
    if (deal.bookWithin) {
        lines.push(`Book within: ${deal.bookWithin}`);
    }

    // Airports section
    if (deal.airports.length > 0) {
        lines.push('');
        lines.push('From your airports:');
        for (const airport of deal.airports) {
            let airportLine = `- ${airport.code} (${airport.city}) - ${airport.price}`;
            if (airport.tags && airport.tags.length > 0) {
                airportLine += ` | ${airport.tags.join(', ')}`;
            }
            lines.push(airportLine);
        }
    }

    return lines.join('\n');
}

/**
 * Checks if an email is from Going.com
 */
export function isGoingEmail(from: string | undefined): boolean {
    if (!from) return false;
    return from.toLowerCase().includes('going.com');
}
