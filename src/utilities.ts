import { TelegramThread } from "./worker";

const THREAD_DELIMITER = ';';
const OBJECT_DELIMITER = ':';

function isEmpty (input: string): boolean {
  return !input || input === ''
}

function parseTelegramThreadIds (input: string): TelegramThread[] {
    if (input.length === 0) {
        return [];
    }

    let threadIds: TelegramThread[] = [];

    input.split(THREAD_DELIMITER).forEach((thread) => {
        const [ name, id ] = thread.split(OBJECT_DELIMITER);
        if (name && id) {
            threadIds.push({
                name,
                messageThreadId: parseInt(id)
            });
        }
    });

    return threadIds;
}

export {
  isEmpty,
  parseTelegramThreadIds,
};
