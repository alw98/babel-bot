import { Client, Guild, Message } from 'discord.js';
import config from '../secrets/config.json';
import { BotIntents } from './BotIntents';
import { CategoryChannel } from './databaseTypes/Guild';
import { DBClient } from './DBClient';
import { TranslationClient } from './TranslationClient';
import { getLangNameFromCode } from 'language-name-map';

export class DiscordClient {
	constructor() {
		this.client = new Client(BotIntents);
		this.translationClient = new TranslationClient();
		this.dbClient = new DBClient(this, this.translationClient);
		this.addListenersToClient();
	}

	addListenersToClient() {
		this.client.on('ready', this.onReady);
		this.client.on('messageCreate', this.onMessageCreate);
		this.client.on('guildCreate', this.onGuildCreate);
		this.client.on('guildDelete', this.onGuildDelete);
	}

	onReady() {
		console.log('Discord client connected');
	}

	onMessageCreate = (msg: Message) => {
		if (msg.author.bot) {
			return;
		}
		if (this.checkForCommand(msg)) {
			return;
		}
		if (this.checkForIntro(msg)) {
			return;
		}
	}

	onGuildCreate = (guild: Guild) => {
		console.log('Joined a new guild: ' + guild.name);
		this.dbClient.addNewGuild(guild);
	}

	onGuildDelete = (guild: Guild) => {
		console.log('Removed from guild: ' + guild.name);
		this.dbClient.removeGuild(guild);
	}

	checkForCommand(msg: Message): boolean {
		if (msg.mentions.has(this.client.user)) {
			const text = msg.content;
			if (text.includes('setIntro')) {
				console.log('Setting intro channel.');
				this.dbClient.setGuildsIntroChannel(msg.guildId, msg.channelId);
			}
			return true;
		}
		return false;
	}

	async checkForIntro(msg: Message): Promise<boolean> {
		const isInIntro = await this.dbClient.isMessageInIntro(msg);

		if (isInIntro) {
			const language = await this.translationClient.getLanguage(msg.content);
			const languageName = getLangNameFromCode(language).native;
			if (!language) {
				msg.channel.send('I\'m not able to translate your message. Please send a longer message.');
				return true;
			}
			if (await this.dbClient.channelExistForLanguage(msg.guildId, language)) {
				const message = 'Detected language: ' + languageName + '. A channel already exists for your language.';
				const translatedMessage = language === 'en' ?
					message : await this.translationClient.translate(message, language, 'en');
				msg.channel.send(translatedMessage);
				return true;
			}
			await this.createNewChannel(msg.guild, language);
			const message = 'Detected language: ' + languageName + '. A new channel has been created for you!';
			const translatedMessage = await this.translationClient.translate(message, language, 'en');
			msg.channel.send(translatedMessage);
			return true;
		}
		return false;
	}

	async createNewChannel(guild: Guild, language: string) {
		const existingChannel = await this.dbClient.getEnglishChannel(guild.id);
		const languageName = getLangNameFromCode(language).native;

		const newChannel = await guild.channels.create(languageName, {
			type: 'GUILD_CATEGORY',
		});

		const newChannelDBEntry: CategoryChannel = {
			name: languageName,
			id: newChannel.id,
			languageCode: language,
			textChannels: [],
		};

		await existingChannel.textChannels.forEach(async (val) => {
			const newName = await this.translationClient.translate(val.name, language, 'en');
			const newTextChannel = await guild.channels.create(newName, {
				type: 'GUILD_TEXT',
				parent: newChannel,
			});
			newChannelDBEntry.textChannels.push({
				id: newTextChannel.id,
				name: newName,
				languageCode: language,
			});
		});

		this.dbClient.addNewChannelToGuild(guild.id, newChannelDBEntry);
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
	translationClient: TranslationClient;
}
