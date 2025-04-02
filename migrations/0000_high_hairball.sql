CREATE TABLE "appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"session_id" integer,
	"therapy_slot_id" integer,
	"date" timestamp NOT NULL,
	"time_slot" text,
	"registration_number" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "packages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sessions" integer NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"name" text NOT NULL,
	"phone_number" text NOT NULL,
	"email" text,
	"birth_date" text NOT NULL,
	"gender" text NOT NULL,
	"address" text NOT NULL,
	"complaints" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"therapy_slot_id" integer,
	CONSTRAINT "patients_patient_id_unique" UNIQUE("patient_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registration_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"expiry_time" timestamp NOT NULL,
	"daily_limit" integer NOT NULL,
	"current_registrations" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer NOT NULL,
	"specific_date" text,
	CONSTRAINT "registration_links_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"transaction_id" integer NOT NULL,
	"package_id" integer NOT NULL,
	"total_sessions" integer NOT NULL,
	"sessions_used" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"last_session_date" timestamp
);
--> statement-breakpoint
CREATE TABLE "therapy_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" timestamp NOT NULL,
	"time_slot" text NOT NULL,
	"max_quota" integer DEFAULT 6 NOT NULL,
	"current_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"patient_id" integer NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"payment_method" text NOT NULL,
	"items" json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
