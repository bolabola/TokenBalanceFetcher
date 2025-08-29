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
  data: jsonb("data"), // Full Hiro Stacks API response
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

// Hiro Stacks API response types
export interface HiroSTXBalance {
  balance: string;
  total_sent: string;
  total_received: string;
  locked: string;
  lock_tx_id?: string;
  lock_height?: number;
  burnchain_lock_height?: number;
  burnchain_unlock_height?: number;
}

export interface HiroFungibleToken {
  balance: string;
  total_sent: string;
  total_received: string;
}

export interface HiroNonFungibleToken {
  count: string;
  total_sent: string;
  total_received: string;
}

export interface HiroBalanceResponse {
  stx: HiroSTXBalance;
  fungible_tokens: { [key: string]: HiroFungibleToken };
  non_fungible_tokens: { [key: string]: HiroNonFungibleToken };
}

// Legacy Sparkscan types for backward compatibility
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

// New unified response type that works with both APIs
export type StacksBalanceResponse = HiroBalanceResponse | SparkscanResponse;
