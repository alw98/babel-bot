import { Client, Message } from 'discord.js';
import config from '../secrets/config.json';
import { BotIntents } from './BotIntents';
import { DBClient } from './DBClient';

export class DiscordClient {
    constructor() {
        this.client = new Client(BotIntents);
        this.dbClient = new DBClient();
        this.addListenersToClient();
    }

    addListenersToClient() {
        this.client.on('ready', this.onReady);
        this.client.on('messageCreate', this.onMessageCreate);
    }

    onReady() {
        console.log('Discord client connected');
    }

    onMessageCreate(msg: Message) {
        console.log(msg);
    }

    login() {
        this.client.login(config.BOT_TOKEN);
    }

    async start() {
        this.login();
        await this.dbClient.connect();
    }

    client: Client;
    dbClient: DBClient;
}
