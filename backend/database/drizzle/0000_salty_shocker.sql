CREATE TABLE `sandbox` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`visibility` text,
	`createdAt` integer,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`image` text,
	`generations` integer DEFAULT 0
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
CREATE UNIQUE INDEX `user_id_unique` ON `user` (`id`);