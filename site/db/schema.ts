import { sqliteTable,integer,text } from 'drizzle-orm/sqlite-core';

export const board = sqliteTable('board',{
 id:integer('id').primaryKey(),
 revision:integer('revision').notNull(),
 data:text('data').notNull(),
});

export const deviceCatalogs = sqliteTable('device_catalogs',{
 deviceId:text('device_id').primaryKey(),
 name:text('name').notNull(),
 projects:text('projects').notNull().default('[]'),
 chats:text('chats').notNull().default('{}'),
 projectsUpdatedAt:text('projects_updated_at'),
 chatsUpdatedAt:text('chats_updated_at'),
});
