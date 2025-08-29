import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBatchJobSchema, insertAddressResultSchema, type SparkscanResponse } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create a new batch job
  app.post("/api/batch-jobs", async (req, res) => {
    try {
      const parsed = insertBatchJobSchema.parse(req.body);
      const job = await storage.createBatchJob(parsed);
      res.json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      res.status(500).json({ message: "Failed to create batch job" });
    }
  });

  // Get all batch jobs
  app.get("/api/batch-jobs", async (req, res) => {
    try {
      const jobs = await storage.getAllBatchJobs();
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch batch jobs" });
    }
  });

  // Get a specific batch job
  app.get("/api/batch-jobs/:id", async (req, res) => {
    try {
      const job = await storage.getBatchJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Batch job not found" });
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch batch job" });
    }
  });

  // Get results for a batch job
  app.get("/api/batch-jobs/:id/results", async (req, res) => {
    try {
      const results = await storage.getAddressResultsByBatchId(req.params.id);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch batch results" });
    }
  });

  // Initialize batch processing (create address entries only)
  app.post("/api/batch-jobs/:id/initialize", async (req, res) => {
    try {
      const batchJobId = req.params.id;
      const { addresses } = req.body as { addresses: string[] };

      console.log(`Initializing batch processing for job ${batchJobId} with ${addresses.length} addresses`);

      const job = await storage.getBatchJob(batchJobId);
      if (!job) {
        return res.status(404).json({ message: "Batch job not found" });
      }

      // Update job status to processing
      await storage.updateBatchJob(batchJobId, { 
        status: "processing",
        totalAddresses: addresses.length 
      });

      // Create address result entries
      for (const address of addresses) {
        await storage.createAddressResult({
          batchJobId,
          address,
          status: "pending",
          data: null,
          errorMessage: null,
        });
      }

      res.json({ message: "Batch processing initialized. Frontend will handle API calls." });
    } catch (error) {
      console.error("Error initializing batch processing:", error);
      res.status(500).json({ message: "Failed to initialize batch processing" });
    }
  });

  // Submit result for a single address (called by frontend)
  app.post("/api/batch-jobs/:id/submit-result", async (req, res) => {
    try {
      const batchJobId = req.params.id;
      const { address, status, data, errorMessage } = req.body as {
        address: string;
        status: "success" | "failed";
        data: any;
        errorMessage?: string;
      };

      console.log(`Submitting result for address ${address} in batch ${batchJobId}: ${status}`);

      // Find the address result entry
      const results = await storage.getAddressResultsByBatchId(batchJobId);
      const resultEntry = results.find(r => r.address === address);
      
      if (!resultEntry) {
        return res.status(404).json({ message: "Address result not found" });
      }

      // Update the result
      await storage.updateAddressResult(resultEntry.id, {
        status,
        data,
        errorMessage,
        processedAt: new Date(),
      });

      // Update batch job counters
      const job = await storage.getBatchJob(batchJobId);
      if (job) {
        const updatedResults = await storage.getAddressResultsByBatchId(batchJobId);
        const processedCount = updatedResults.filter(r => r.status === "success" || r.status === "failed").length;
        const successCount = updatedResults.filter(r => r.status === "success").length;
        const failedCount = updatedResults.filter(r => r.status === "failed").length;

        await storage.updateBatchJob(batchJobId, {
          processedAddresses: processedCount,
          successfulLookups: successCount,
          failedLookups: failedCount,
          status: processedCount >= job.totalAddresses ? "completed" : "processing",
          completedAt: processedCount >= job.totalAddresses ? new Date() : null,
        });
      }

      res.json({ message: "Result submitted successfully" });
    } catch (error) {
      console.error("Error submitting result:", error);
      res.status(500).json({ message: "Failed to submit result" });
    }
  });

  // Export batch results as CSV
  app.get("/api/batch-jobs/:id/export/csv", async (req, res) => {
    try {
      const results = await storage.getAddressResultsByBatchId(req.params.id);
      const job = await storage.getBatchJob(req.params.id);
      
      if (!job) {
        return res.status(404).json({ message: "Batch job not found" });
      }

      const csvRows = ['Address,BTC Balance (sats),Token Count,Transactions,Total Value USD,Target Token Balance,Status'];
      
      for (const result of results) {
        if (result.status === 'success' && result.data) {
          const data = result.data as SparkscanResponse;
          const targetToken = job.targetTokenAddress 
            ? data.tokens?.find((t) => t.tokenAddress === job.targetTokenAddress)
            : null;
          
          csvRows.push([
            result.address,
            data.balance.btcHardBalanceSats.toString(),
            data.tokenCount.toString(),
            data.transactionCount.toString(),
            data.totalValueUsd.toString(),
            targetToken ? targetToken.balance.toString() : '0',
            result.status
          ].join(','));
        } else {
          csvRows.push([
            result.address,
            '0',
            '0',
            '0',
            '0',
            '0',
            result.status
          ].join(','));
        }
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="batch-${req.params.id}.csv"`);
      res.send(csvRows.join('\n'));
    } catch (error) {
      res.status(500).json({ message: "Failed to export CSV" });
    }
  });

  // Export batch results as JSON
  app.get("/api/batch-jobs/:id/export/json", async (req, res) => {
    try {
      const results = await storage.getAddressResultsByBatchId(req.params.id);
      const job = await storage.getBatchJob(req.params.id);
      
      if (!job) {
        return res.status(404).json({ message: "Batch job not found" });
      }

      const exportData = {
        batchJob: job,
        results: results.map(result => ({
          address: result.address,
          status: result.status,
          data: result.data,
          errorMessage: result.errorMessage,
          processedAt: result.processedAt,
        }))
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="batch-${req.params.id}.json"`);
      res.json(exportData);
    } catch (error) {
      res.status(500).json({ message: "Failed to export JSON" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Backend processing is now handled by frontend to avoid rate limiting
