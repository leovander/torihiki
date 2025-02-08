import { ChatIds } from '../types/telegraf';

const THREAD_DELIMITER = ';';
const OBJECT_DELIMITER = ':';

function isEmpty(input: string): boolean {
    return !input || input === '';
}

function parseChatIds(input: string): ChatIds {
    if (input.length === 0) {
        return {};
    }

    const threadIds: ChatIds = {};

    input.split(THREAD_DELIMITER).forEach((thread) => {
        const [name, id] = thread.split(OBJECT_DELIMITER);
        if (name && id) {
            threadIds[name] = parseInt(id);
        }
    });

    return threadIds;
}

function parseTelegramAdminIds(input: string): number[] {
    if (input.length === 0) {
        return [];
    }

    const threadIds: number[] = input.split(OBJECT_DELIMITER).map((admin) => {
        return parseInt(admin);
    });

    return threadIds;
}

function escapeMarkdown(input: string) {
    // TODO: Update this to use replaceall when we bump the JS lang
    const toEscape = [
        '_',
        '\\*',
        '\\[',
        '\\]',
        '\\(',
        '\\)',
        '~',
        '`',
        '>',
        '#',
        '\\+',
        '-',
        '=',
        '|',
        '\\{',
        '\\}',
        '\\.',
        '!',
    ];

    if (!input || input.length === 0) {
        return input;
    }

    let sanitized = input;

    toEscape.forEach((escapee: string) => {
        sanitized = sanitized.replace(new RegExp(escapee, 'g'), `\\${escapee}`);
    });

    return sanitized;
}

/*
const PUSHOVER_APP_TOKEN = process.env.PUSHOVER_APP_TOKEN;
const PUSHOVER_USER_TOKEN = process.env.PUSHOVER_USER_TOKEN;

async function sendAdminError(title: string, message: string): Promise<void> {
    if (PUSHOVER_APP_TOKEN && PUSHOVER_USER_TOKEN) {
        axios
            .post('https://api.pushover.net/1/messages.json', {
                token: PUSHOVER_APP_TOKEN,
                user: PUSHOVER_USER_TOKEN,
                message: message,
                title: title,
            })
            .catch((error) => {
                if (error.response) {
                    logger.error(JSON.stringify(error.response.data));
                } else if (error.request) {
                    logger.error(JSON.stringify(error.request));
                } else {
                    logger.error('Error', error.message);
                }
            });
    }
} */

export { escapeMarkdown, isEmpty, parseChatIds, parseTelegramAdminIds };
