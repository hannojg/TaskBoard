CREATE TABLE `board` (
	`id` integer PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `device_catalogs` (
	`device_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`projects` text DEFAULT '[]' NOT NULL,
	`chats` text DEFAULT '{}' NOT NULL,
	`projects_updated_at` text,
	`chats_updated_at` text
);
