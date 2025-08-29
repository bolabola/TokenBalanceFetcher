import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const batchJobs = pgTable("batch_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  targetTokenAddress: text("target_token_address"),
  rateLimit: integer("rate_limit").notNull().default(5),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  totalAddresses: integer("total_addresses").notNull(),
  processedAddresses: integer("processed_addresses").notNull().default(0),
  successfulLookups: integer("successful_lookups").notNull().default(0),
  failedLookups: integer("failed_lookups").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const addressResults = pgTable("address_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchJobId: varchar("batch_job_id").notNull().references(() => batchJobs.id),
  address: text("address").notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, success, failed
  data: jsonb("data"), // Full Sparkscan API response
  errorMessage: text("error_message"),
  processedAt: timestamp("processed_at"),
});

export const insertBatchJobSchema = createInsertSchema(batchJobs).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertAddressResultSchema = createInsertSchema(addressResults).omit({
  id: true,
  processedAt: true,
});

export type InsertBatchJob = z.infer<typeof insertBatchJobSchema>;
export type BatchJob = typeof batchJobs.$inferSelect;
export type InsertAddressResult = z.infer<typeof insertAddressResultSchema>;
export type AddressResult = typeof addressResults.$inferSelect;

// Sparkscan API response types
export interface SparkscanBalance {
  btcSoftBalanceSats: number;
  btcHardBalanceSats: number;
  btcValueUsdHard: number;
  btcValueUsdSoft: number;
  totalTokenValueUsd: number;
}

export interface SparkscanToken {
  tokenIdentifier: string;
  tokenAddress: string;
  name: string;
  ticker: string;
  decimals: number;
  balance: number;
  valueUsd: number;
  issuerPublicKey: string;
  maxSupply: number;
  isFreezable: boolean;
}

export interface SparkscanResponse {
  sparkAddress: string;
  publicKey: string;
  balance: SparkscanBalance;
  totalValueUsd: number;
  transactionCount: number;
  tokenCount: number;
  tokens: SparkscanToken[];
}
