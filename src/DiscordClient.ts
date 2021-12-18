import { Client, Guild, Message, MessageEmbed, TextChannel } from 'discord.js';
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

	onMessageCreate = async (msg: Message) => {
		try {
			if (msg.author.bot) {
				return;
			}
			if (this.checkForCommand(msg)) {
				return;
			}
			if (await this.checkForIntro(msg)) {
				return;
			}
			await this.postSingleMessageToAllChannels(msg);
		} catch (e) {
			console.log(e);
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
		if (msg.mentions.everyone) {
			return false;
		}
		if (msg.mentions.has(this.client.user)) {
			const text = msg.content;
			if (text.includes('setIntro')) {
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
		const englishChannel = await this.dbClient.getEnglishChannel(guild.id);
		const languageName = getLangNameFromCode(language).native;

		const newChannel = await guild.channels.create(languageName, {
			type: 'GUILD_CATEGORY',
		});

		const newChannelDBEntry: CategoryChannel = {
			name: languageName,
			id: newChannel.id,
			languageCode: language,
			textChannels: [],
			englishName: englishChannel.name,
		};

		for (let i = 0; i < englishChannel.textChannels.length; ++i) {
			const val = englishChannel.textChannels[i];
			const newName = await this.translationClient.translate(val.name, language, 'en');
			const newTextChannel = await guild.channels.create(newName, {
				type: 'GUILD_TEXT',
				parent: newChannel,
			}) as TextChannel;
			newChannelDBEntry.textChannels.push({
				id: newTextChannel.id,
				name: newName,
				languageCode: language,
				englishName: val.englishName,
			});
			await this.postRecentMessagesToChannel(newTextChannel, language, val.englishName);
		}
		this.dbClient.addNewChannelToGuild(guild.id, newChannelDBEntry);
	}

	async postSingleMessageToAllChannels(msg: Message) {
		const channelsToSendTo = await this.dbClient.getAllForeignChannels(msg.guildId, msg.channelId);
		const fromLanguage = await this.dbClient.getLanguageOfMessage(msg);
		for (let i = 0; i < channelsToSendTo.length; ++i) {
			const val = channelsToSendTo[i];
			const channel = this.client.channels.cache.get(val.id) as TextChannel;
			const embed = await this.createEmbed(fromLanguage, val.languageCode, msg);
			channel.send({ embeds: [embed] });
		}
		this.dbClient.storeMessage(msg, fromLanguage);
	}

	async postRecentMessagesToChannel(channel: TextChannel, language: string, englishName: string) {
		const recentMessages = await this.dbClient.getRecentMessagesForChannel(channel.guildId, englishName);
		for (let i = 0; i < recentMessages.length; ++i) {
			const message = recentMessages[i];
			const fromChannel = await this.client.channels.fetch(message.channelId) as TextChannel;
			const embed = await this.createEmbed(
				message.languageCode, language, await fromChannel.messages.fetch(message.id));
			channel.send({ embeds: [embed] });
		}
	}

	async createEmbed(fromLanguage: string, toLanguage: string, msg: Message) {
		const embed = new MessageEmbed().setAuthor(msg.author.username, msg.author.displayAvatarURL());
		const fromLanguageName = getLangNameFromCode(fromLanguage).native;
		const toLanguageName = getLangNameFromCode(toLanguage).native;
		const message = await this.translationClient.translate(msg.content, toLanguage, fromLanguage);
		if (!message) return undefined;
		embed.setFields({
			name: fromLanguageName + ' -> ' + toLanguageName,
			value: message,
		});
		return embed;
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
