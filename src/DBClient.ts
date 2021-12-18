import { MongoClient } from 'mongodb';
import config from '../secrets/config.json';

/** Client to interact with MongoDB */
export class DBClient {
    constructor() {
        this.client = new MongoClient(config.MONGO_URI);
    }

    async connect() {
        try {
            await this.client.connect();
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

    client: MongoClient;
}
