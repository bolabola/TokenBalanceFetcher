import { type BatchJob, type InsertBatchJob, type AddressResult, type InsertAddressResult } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Batch Jobs
  createBatchJob(job: InsertBatchJob): Promise<BatchJob>;
  getBatchJob(id: string): Promise<BatchJob | undefined>;
  getAllBatchJobs(): Promise<BatchJob[]>;
  updateBatchJob(id: string, updates: Partial<BatchJob>): Promise<BatchJob | undefined>;
  
  // Address Results
  createAddressResult(result: InsertAddressResult): Promise<AddressResult>;
  getAddressResultsByBatchId(batchJobId: string): Promise<AddressResult[]>;
  updateAddressResult(id: string, updates: Partial<AddressResult>): Promise<AddressResult | undefined>;
}

export class MemStorage implements IStorage {
  private batchJobs: Map<string, BatchJob>;
  private addressResults: Map<string, AddressResult>;

  constructor() {
    this.batchJobs = new Map();
    this.addressResults = new Map();
  }

  async createBatchJob(insertJob: InsertBatchJob): Promise<BatchJob> {
    const id = randomUUID();
    const job: BatchJob = {
      ...insertJob,
      id,
      status: insertJob.status || "pending",
      createdAt: new Date(),
      completedAt: null,
    };
    this.batchJobs.set(id, job);
    return job;
  }

  async getBatchJob(id: string): Promise<BatchJob | undefined> {
    return this.batchJobs.get(id);
  }

  async getAllBatchJobs(): Promise<BatchJob[]> {
    return Array.from(this.batchJobs.values()).sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  async updateBatchJob(id: string, updates: Partial<BatchJob>): Promise<BatchJob | undefined> {
    const job = this.batchJobs.get(id);
    if (!job) return undefined;
    
    const updatedJob = { ...job, ...updates };
    this.batchJobs.set(id, updatedJob);
    return updatedJob;
  }

  async createAddressResult(insertResult: InsertAddressResult): Promise<AddressResult> {
    const id = randomUUID();
    const result: AddressResult = {
      ...insertResult,
      id,
      status: insertResult.status || "pending",
      data: insertResult.data || null,
      processedAt: new Date(),
    };
    this.addressResults.set(id, result);
    return result;
  }

  async getAddressResultsByBatchId(batchJobId: string): Promise<AddressResult[]> {
    return Array.from(this.addressResults.values())
      .filter(result => result.batchJobId === batchJobId)
      .sort((a, b) => 
        new Date(a.processedAt || 0).getTime() - new Date(b.processedAt || 0).getTime()
      );
  }

  async updateAddressResult(id: string, updates: Partial<AddressResult>): Promise<AddressResult | undefined> {
    const result = this.addressResults.get(id);
    if (!result) return undefined;
    
    const updatedResult = { ...result, ...updates, processedAt: new Date() };
    this.addressResults.set(id, updatedResult);
    return updatedResult;
  }
}

export const storage = new MemStorage();
