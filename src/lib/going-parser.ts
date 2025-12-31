import { GOING_AIRPORT, GOING_DEAL } from '../types/message';
import { logger } from './logger';

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
 * Escapes Markdown special characters for Telegram
 */
function escapeMarkdown(text: string): string {
    // Escape characters that have special meaning in Telegram Markdown
    return text.replace(/([_*`[\]])/g, '\\$1');
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
        // Pattern: <h1 class="h1-short/long/md"> <!-- --> Destination</h1>
        /<h1[^>]*class="h1-(?:short|long|md)"[^>]*>\s*(?:<!--.*?-->\s*)?([^<]+)<\/h1>/i,
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

    // Extract flight price - multiple formats
    const pricePatterns = [
        // Format 1: <strong>Flight price</strong></p><p>$XXX roundtrip</p>
        /<strong>Flight price<\/strong>\s*<\/p>\s*<p[^>]*>([^<]+)<\/p>/i,
        // Format 2: Flight price&nbsp;</h3> $XXX roundtrip </td>
        /Flight price(?:&nbsp;)?\s*<\/h3>\s*([^<]+)<\/td>/i,
    ];
    let flightPrice = '';
    for (const pattern of pricePatterns) {
        const match = normalized.match(pattern);
        if (match) {
            flightPrice = stripHtml(match[1]);
            break;
        }
    }

    // Extract original price from strikethrough span
    const originalPriceMatch = normalized.match(
        /text-decoration:\s*line-through[^>]*>\s*\$(\d+)/i,
    );
    const originalPrice = originalPriceMatch ? `$${originalPriceMatch[1]}` : '';

    // Extract travel dates - multiple formats
    const datesPatterns = [
        // Format 1: <strong>Travel dates</strong></p><p>dates</p>
        /<strong>Travel dates<\/strong>\s*<\/p>\s*<p[^>]*>([^<]+)<\/p>/i,
        // Format 2: Travel dates&nbsp;</h3> dates </td>
        /Travel dates(?:&nbsp;)?\s*<\/h3>\s*([^<]+)<\/td>/i,
    ];
    let travelDates = '';
    for (const pattern of datesPatterns) {
        const match = normalized.match(pattern);
        if (match) {
            travelDates = stripHtml(match[1]);
            break;
        }
    }

    // Extract book within timeframe - multiple formats
    const bookWithinPatterns = [
        // Format 1: <strong>Book within</strong></p><p>~ X days</p>
        /<strong>Book within<\/strong>\s*<\/p>\s*<p[^>]*>([^<]+)<\/p>/i,
        // Format 2: Book within&nbsp;</h3> ~ X days </td>
        /Book within(?:&nbsp;)?\s*<\/h3>\s*([^<]+)<\/td>/i,
    ];
    let bookWithin = '';
    for (const pattern of bookWithinPatterns) {
        const match = normalized.match(pattern);
        if (match) {
            bookWithin = stripHtml(match[1]);
            break;
        }
    }

    // Extract airports from "From airports you're following" section
    const airports: GOING_AIRPORT[] = [];

    // Pattern 1: International format with price per airport
    // <a ...>Los Angeles, California</a>&nbsp;<span>LAX</span>
    // followed by price: $544 and crossed out price: $1015
    const airportPattern1 =
        /<a[^>]*>([^<]+)<\/a>\s*(?:&nbsp;)?\s*<span>([A-Z]{3})<\/span>[\s\S]*?<span[^>]*>\s*\$(\d+)\s*<\/span>(?:[\s\S]*?line-through[^>]*>\s*\$(\d+))?/gi;

    let airportMatch;
    while ((airportMatch = airportPattern1.exec(normalized)) !== null) {
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

    // Pattern 2: Domestic/home airport format
    // <a ...>City, State</a>&nbsp; CODE </div> (no per-airport price, use main deal price)
    if (airports.length === 0) {
        const airportPattern2 =
            /<a[^>]*>([^<]+)<\/a>\s*(?:&nbsp;)?\s*([A-Z]{3})\s*<\/div>/gi;

        // Extract base price from flightPrice (e.g., "$98 roundtrip" -> "$98")
        const basePriceMatch = flightPrice.match(/\$\d+/);
        const basePrice = basePriceMatch ? basePriceMatch[0] : '';

        while ((airportMatch = airportPattern2.exec(normalized)) !== null) {
            const city = stripHtml(airportMatch[1]);
            const code = airportMatch[2];

            // Avoid duplicates and filter out likely non-airport matches
            if (!airports.some((a) => a.code === code) && city.includes(',')) {
                airports.push({
                    city,
                    code,
                    price: basePrice,
                });
            }
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
 * Uses Markdown formatting for bold headers
 */
export function formatGoingDealMessage(
    deal: GOING_DEAL,
    subject: string,
): string {
    const lines: string[] = [];

    // Use email subject as the title (escape Markdown chars)
    lines.push(escapeMarkdown(subject));
    lines.push('');

    // Price line
    let priceLine = `*Price:* ${escapeMarkdown(deal.flightPrice)}`;
    if (deal.originalPrice) {
        priceLine += ` (was ${escapeMarkdown(deal.originalPrice)})`;
    }
    lines.push(priceLine);

    // Travel dates
    if (deal.travelDates) {
        lines.push(`*Travel dates:* ${escapeMarkdown(deal.travelDates)}`);
    }

    // Book within
    if (deal.bookWithin) {
        lines.push(`*Book within:* ${escapeMarkdown(deal.bookWithin)}`);
    }

    // Airports section
    if (deal.airports.length > 0) {
        lines.push('');
        lines.push('*From your airports:*');
        for (const airport of deal.airports) {
            const city = escapeMarkdown(airport.city);
            const price = escapeMarkdown(airport.price);
            let airportLine = `• ${airport.code} (${city}) - ${price}`;
            if (airport.tags && airport.tags.length > 0) {
                airportLine += ` | ${airport.tags.map(escapeMarkdown).join(', ')}`;
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
