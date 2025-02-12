ALTER TABLE "users_to_repos" DROP CONSTRAINT "users_to_repos_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "users_to_repos" ADD COLUMN "userId" text NOT NULL;--> statement-breakpoint
ALTER TABLE "users_to_repos" ADD COLUMN "repoId" text NOT NULL;--> statement-breakpoint
ALTER TABLE "users_to_repos" ADD COLUMN "repoName" text NOT NULL;--> statement-breakpoint
ALTER TABLE "users_to_repos" ADD CONSTRAINT "users_to_repos_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_to_repos" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "users_to_repos" DROP COLUMN "repo_id";--> statement-breakpoint
ALTER TABLE "users_to_repos" DROP COLUMN "repo_name";