export interface Guild {
    /** The id as given by discord */
    id: string;
    /** Name of the guild given by discord */
    name: string;
    /** The id of the channel to monitor for introductions */
    introChannelId: string;
    /** All of the language channels in the guild */
    channels: CategoryChannel[];
}

export interface CategoryChannel extends TextChannel {
    /** All of the text channels present within this category */
    textChannels: TextChannel[];
}

export interface TextChannel {
    /** The id as given by discord */
    id: string;
    /** The name as given by discord */
    name: string;
    /** Language code to use with google translate API */
    languageCode: string;
    /** The name of the channel in english */
    englishName: string;
}

export interface DBMessage {
    /** The message text */
    content: string;
    /** Language code to use with google translate API */
    languageCode: string;
    /** The id as given by discord */
    id: string;
    /** The channel id */
    channelId: string;
    /** The guild id */
    guildId: string;
    /** Created on date */
    createdOn: Date;
    /** The name of the channel it was sent from, in English */
    englishName: string;
}
