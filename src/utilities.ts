import { TelegramThreadIds } from './worker';

const THREAD_DELIMITER = ';';
const OBJECT_DELIMITER = ':';

function isEmpty(input: string): boolean {
    return !input || input === '';
}

function parseTelegramThreadIds(input: string): TelegramThreadIds {
    if (input.length === 0) {
        return {};
    }

    let threadIds: TelegramThreadIds = {};

    input.split(THREAD_DELIMITER).forEach((thread) => {
        const [name, id] = thread.split(OBJECT_DELIMITER);
        if (name && id) {
            threadIds[name] = parseInt(id);
        }
    });

    return threadIds;
}

export { isEmpty, parseTelegramThreadIds };
