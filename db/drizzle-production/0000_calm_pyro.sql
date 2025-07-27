CREATE TABLE "sandbox" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"visibility" varchar NOT NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"user_id" text NOT NULL,
	"likeCount" integer DEFAULT 0 NOT NULL,
	"viewCount" integer DEFAULT 0 NOT NULL,
	"containerId" text,
	"repositoryId" text,
	CONSTRAINT "sandbox_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "sandbox_likes" (
	"user_id" text NOT NULL,
	"sandbox_id" text NOT NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "sandbox_likes_sandbox_id_user_id_pk" PRIMARY KEY("sandbox_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"avatarUrl" text,
	"githubToken" varchar,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"generations" integer DEFAULT 0 NOT NULL,
	"bio" varchar,
	"personalWebsite" varchar,
	"links" json DEFAULT '[]'::json NOT NULL,
	"tier" varchar DEFAULT 'FREE' NOT NULL,
	"tierExpiresAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"lastResetDate" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "user_id_unique" UNIQUE("id"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "users_to_sandboxes" (
	"userId" text NOT NULL,
	"sandboxId" text NOT NULL,
	"sharedOn" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sandbox" ADD CONSTRAINT "sandbox_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_likes" ADD CONSTRAINT "sandbox_likes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_likes" ADD CONSTRAINT "sandbox_likes_sandbox_id_sandbox_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandbox"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_to_sandboxes" ADD CONSTRAINT "users_to_sandboxes_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_to_sandboxes" ADD CONSTRAINT "users_to_sandboxes_sandboxId_sandbox_id_fk" FOREIGN KEY ("sandboxId") REFERENCES "public"."sandbox"("id") ON DELETE no action ON UPDATE no action;