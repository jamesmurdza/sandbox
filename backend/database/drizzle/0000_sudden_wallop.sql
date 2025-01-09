CREATE TABLE `sandbox` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`visibility` text,
	`createdAt` integer DEFAULT CURRENT_TIMESTAMP,
	`user_id` text NOT NULL,
	`likeCount` integer DEFAULT 0,
	`viewCount` integer DEFAULT 0,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sandbox_likes` (
	`user_id` text NOT NULL,
	`sandbox_id` text NOT NULL,
	`createdAt` integer DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`sandbox_id`, `user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sandbox_id`) REFERENCES `sandbox`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`username` text NOT NULL,
	`avatarUrl` text,
	`githubToken` text,
	`createdAt` integer DEFAULT CURRENT_TIMESTAMP,
	`generations` integer DEFAULT 0,
	`tier` text DEFAULT 'FREE',
	`tierExpiresAt` integer,
	`lastResetDate` integer
);
--> statement-breakpoint
CREATE TABLE `users_to_sandboxes` (
	`userId` text NOT NULL,
	`sandboxId` text NOT NULL,
	`sharedOn` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sandboxId`) REFERENCES `sandbox`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sandbox_id_unique` ON `sandbox` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_id_unique` ON `user` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);