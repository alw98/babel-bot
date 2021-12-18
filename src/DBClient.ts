import { Guild as DiscordGuild, Message } from 'discord.js';
import { Collection, Db, MongoClient } from 'mongodb';
import config from '../secrets/config.json';
import { Guild, CategoryChannel, TextChannel, DBMessage } from './databaseTypes/Guild';
import { DiscordClient } from './DiscordClient';
import { TranslationClient } from './TranslationClient';

const DB_KEY = 'babel_bot';
const GUILD_COLLECTION_KEY = 'guilds';
const MESSAGES_COLLECTION_KEY = 'messages';

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
			this.messageCollection = this.db.collection(MESSAGES_COLLECTION_KEY);
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
								englishName: channel.parent.name,
							};
							categoryChannels.push(categoryChannel);
						}

						categoryChannel.textChannels.push({
							id: channel.id,
							name: channel.name,
							languageCode: categoryChannel.languageCode,
							englishName: channel.name,
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
			console.error('Error adding intro channel to guild');
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
			console.error('Error checking if channel exists for language');
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
			console.log('Succesfully added new channel to guild ' + guildId);
		} catch (e) {
			console.error('Error adding new channel to guild');
			throw (e);
		}
	}

	async getAllForeignChannels(guildId: string, nativeChannelId: string): Promise<TextChannel[]> {
		try {
			const originChannel = await this.findChannelFromId(guildId, nativeChannelId);
			const guild = await this.guildCollection.findOne({ id: guildId });

			const foreignCategoryChannels = guild.channels.filter((val) =>
				val.languageCode !== originChannel.languageCode);
			const foreignTextChannels: TextChannel[] = [];

			foreignCategoryChannels.forEach((channel) => {
				foreignTextChannels.push(...channel.textChannels.filter((val) => {
					return val.englishName === originChannel.englishName;
				}));
			});

			console.log('Successfully found all foreign text channels');
			return foreignTextChannels;
		} catch (e) {
			console.error('Error retrieving foreign text channels.');
			throw (e);
		}
	}

	async getLanguageOfMessage(msg: Message): Promise<string> {
		try {
			const channel = await this.findChannelFromId(msg.guildId, msg.channelId);

			console.log('Successfully found language for message');
			return channel.languageCode;
		} catch (e) {
			console.error('Error retrieving language for message.');
			throw (e);
		}
	}

	async findChannelFromId(guildId: string, channelId: string): Promise<TextChannel> {
		try {
			const guild = await this.guildCollection.findOne({ id: guildId });
			const channel = guild.channels.find((val) => {
				const result = val.textChannels.some((val) => val.id === channelId);
				return result;
			}).textChannels.find((val) => val.id === channelId);


			console.log('Successfully found text channel');
			return channel;
		} catch (e) {
			console.error('Error retrieving  text channel.');
			throw (e);
		}
	}

	async storeMessage(msg: Message, language: string) {
		try {
			const originChannel = await this.findChannelFromId(msg.guildId, msg.channelId);
			const dbMessage: DBMessage = {
				content: msg.content,
				createdOn: msg.createdAt,
				languageCode: language,
				id: msg.id,
				guildId: msg.guildId,
				channelId: msg.channelId,
				englishName: originChannel.englishName,
			};

			this.messageCollection.insertOne(dbMessage);
			console.log('Successfully saved message');
		} catch (e) {
			console.error('Error saving message.');
			throw (e);
		}
	}

	async getRecentMessagesForChannel(guildId: string, channelEnglishName: string): Promise<DBMessage[]> {
		try {
			const cursor = this.messageCollection.find({
				guildId,
				englishName: channelEnglishName,
			});

			cursor.sort({ _id: 1 });
			cursor.limit(50);
			cursor.skip(0);
			const results = await cursor.toArray();
			console.log('Successfully retrieved recent messages.');
			return results;
		} catch (e) {
			console.error('Error retrieving messages message.');
			throw (e);
		}
	}

	client: MongoClient;
	discordClient: DiscordClient;
	translationClient: TranslationClient;
	db: Db;
	guildCollection: Collection<Guild>;
	messageCollection: Collection<DBMessage>;
}

