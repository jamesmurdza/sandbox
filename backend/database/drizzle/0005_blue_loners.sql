CREATE TABLE `users_to_repos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`repo_id` text NOT NULL,
	`createdAt` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_to_repos_id_unique` ON `users_to_repos` (`id`);