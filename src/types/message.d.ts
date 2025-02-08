export type DISCORD_MESSAGE = {
    author?: string;
    guildName?: string;
    guildId?: string;
    channelName?: string;
    channelId?: string;
    content?: string;
};

export type SLICKDEAL_MESSAGE = {
    id?: string;
    title?: string;
    link?: string;
    description?: string;
    content_encoded?: string;
    author?: string;
    published?: number;
    created?: number;
    category?: string;
    feeds?: SLICKDEAL_CATEGORY[];
};

type SLICKDEAL_CATEGORY = {
    name: string;
    url: string;
};
