import { Guild as DiscordGuild, Message } from 'discord.js';
import { Collection, Db, MongoClient } from 'mongodb';
import config from '../secrets/config.json';
import { Guild, CategoryChannel } from './databaseTypes/Guild';
import { DiscordClient } from './DiscordClient';
import { TranslationClient } from './TranslationClient';

const DB_KEY = 'babel_bot';
const GUILD_COLLECTION_KEY = 'guilds';

/** Client to interact with MongoDB */
export class DBClient {
	constructor(discordClient: DiscordClient, translationClient: TranslationClient) {
		this.client = new MongoClient(config.MONGO_URI);
		this.discordClient = discordClient;
		this.translationClient = translationClient;
	}

	async connect() {
		try {
			await this.client.connect();
			this.db = this.client.db(DB_KEY);
			this.guildCollection = this.db.collection(GUILD_COLLECTION_KEY);
			console.log('Connected to MongoDB');
		} catch (e) {
			console.error('Unable to connect to MongoDB');
			throw (e);
		}
	}

	async disconnect() {
		try {
			await this.client.close();
			console.log('Disconnected from MongoDB');
		} catch (e) {
			console.error('Unable to disconnect from MongoDB');
			throw (e);
		}
	}

	async addNewGuild(guild: DiscordGuild) {
		try {
			const categoryChannels: CategoryChannel[] = [];

			for (let i = 0; i < guild.channels.cache.size; ++i) {
				const channel = guild.channels.cache.at(i);

				if (channel.type !== 'GUILD_CATEGORY') {
					if (channel.parent) {
						let categoryChannel = categoryChannels.find((val) => val.id === channel.parentId);
						if (!categoryChannel) {
							const language = await this.translationClient.getLanguage(channel.parent.name);
							categoryChannel = {
								id: channel.parent.id,
								name: channel.parent.name,
								languageCode: language,
								textChannels: [],
							};
							categoryChannels.push(categoryChannel);
						}

						categoryChannel.textChannels.push({
							id: channel.id,
							name: channel.name,
							languageCode: categoryChannel.languageCode,
						});
					}
				}
			}

			this.guildCollection.insertOne({
				id: guild.id,
				name: guild.name,
				introChannelId: '-1',
				channels: categoryChannels,
			});
			console.log('Succesfully added guild ' + guild.name + ' to database.');
		} catch (e) {
			console.error('Error adding new guild to database');
			throw (e);
		}
	}

	async removeGuild(guild: DiscordGuild) {
		try {
			await this.guildCollection.deleteOne({
				id: guild.id,
			});

			console.log('Succesfully deleted guild ' + guild.name + ' from database.');
		} catch (e) {
			console.error('Error removing guild from database');
			throw (e);
		}
	}

	async setGuildsIntroChannel(guildId: string, channelId: string) {
		try {
			const filter = {
				id: guildId,
			};

			const updateDoc = {
				$set: {
					introChannelId: channelId,
				},
			};

			this.guildCollection.updateOne(filter, updateDoc);
			console.log('Succesfully added intro channel to guild ' + guildId);
		} catch (e) {
			console.error('Error adding into channel to guild');
			throw (e);
		}
	}

	async isMessageInIntro(message: Message): Promise<boolean> {
		try {
			const guild = await this.guildCollection.findOne({ id: message.guildId });
			console.log('Succesfully found if message was in intro channel.');
			return message.channelId === guild.introChannelId;
		} catch (e) {
			console.error('Error checking if message is in intro channel');
			throw (e);
		}
	}

	async channelExistForLanguage(guildId: string, language: string): Promise<boolean> {
		try {
			const guild = await this.guildCollection.findOne({ id: guildId });
			const channelExists = guild.channels.find((val) => val.languageCode === language);

			console.log('Succesfully found if a channel existed for the given language.');
			return !!channelExists;
		} catch (e) {
			console.error('Error checking if message is in intro channel');
			throw (e);
		}
	}

	async getEnglishChannel(guildId: string): Promise<CategoryChannel> {
		try {
			const guild = await this.guildCollection.findOne({ id: guildId });
			const english = guild.channels.find((val) => val.languageCode === 'en');

			console.log('Succesfully found the english channel.');
			return english;
		} catch (e) {
			console.error('Error finding english channel.');
			throw (e);
		}
	}

	async addNewChannelToGuild(guildId: string, channel: CategoryChannel) {
		try {
			const filter = {
				id: guildId,
			};

			const updateDoc = {
				$push: {
					channels: channel,
				},
			};

			this.guildCollection.updateOne(filter, updateDoc);
			console.log('Succesfully added intro channel to guild ' + guildId);
		} catch (e) {
			console.error('Error adding into channel to guild');
			throw (e);
		}
	}

	client: MongoClient;
	discordClient: DiscordClient;
	translationClient: TranslationClient;
	db: Db;
	guildCollection: Collection<Guild>;
}

