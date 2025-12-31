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

export type OUTLOOK_MESSAGE = {
    uid?: number;
    messageId?: string;
    subject?: string;
    body?: string;
    htmlBody?: string;
    from?: string;
    fromName?: string;
    date?: string;
    category?: string;
};

export type GOING_AIRPORT = {
    city: string;
    code: string;
    price: string;
    originalPrice?: string;
    tags?: string[];
};

export type GOING_DEAL = {
    destination: string;
    flightPrice: string;
    originalPrice?: string;
    travelDates: string;
    bookWithin: string;
    airports: GOING_AIRPORT[];
};
