import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBatchJobSchema, insertAddressResultSchema, type HiroBalanceResponse } from "@shared/schema";
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

  // Start processing a batch job
  app.post("/api/batch-jobs/:id/process", async (req, res) => {
    try {
      const batchJobId = req.params.id;
      const { addresses } = req.body as { addresses: string[] };

      console.log(`Starting batch processing for job ${batchJobId} with ${addresses.length} addresses:`, addresses);

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

      // Start processing addresses (don't await - let it run in background)
      processAddressesBatch(batchJobId, addresses, job.rateLimit || 5, job.targetTokenAddress);

      res.json({ message: "Batch processing started" });
    } catch (error) {
      console.error("Error starting batch processing:", error);
      res.status(500).json({ message: "Failed to start batch processing" });
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
            ? data.tokens.find(t => t.tokenAddress === job.targetTokenAddress)
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

// Background processing function
async function processAddressesBatch(
  batchJobId: string, 
  addresses: string[], 
  rateLimit: number,
  targetTokenAddress?: string | null
) {
  console.log(`processAddressesBatch started for job ${batchJobId} with ${addresses.length} addresses`);
  
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  // Use user-defined rate limit
  const requestDelay = Math.ceil(1000 / rateLimit);

  let processedCount = 0;
  let successCount = 0;
  let failedCount = 0;

  for (const address of addresses) {
    console.log(`Processing address: ${address}`);
    try {
      // Find the address result entry
      const results = await storage.getAddressResultsByBatchId(batchJobId);
      const resultEntry = results.find(r => r.address === address);
      
      if (resultEntry) {
        // Update status to processing
        await storage.updateAddressResult(resultEntry.id, { status: "processing" });

        try {
          // Make API call to Hiro Stacks API with retry logic
          const apiUrl = `https://www.sparkscan.io/api/v1/address/${address}?network=MAINNET`;
          console.log(`Making API call to Sparkscan API: ${apiUrl}`);
          
          let retryCount = 0;
          const maxRetries = 3;
          let response: Response | null = null;
          let lastError: string | null = null;
          
          while (retryCount <= maxRetries) {
            try {
              response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                  'Accept': 'application/json',
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                  'Referer': 'https://www.sparkscan.io/',
                  'Origin': 'https://www.sparkscan.io'
                }
              });
              
              console.log(`API response status: ${response.status} (attempt ${retryCount + 1}) for ${address}`);
              
              if (response.status === 429) {
                // Rate limited, wait and retry
                const retryDelay = Math.max(5000, requestDelay) * (retryCount + 1);
                lastError = `Rate limited (429 error) - API returned Too Many Requests`;
                console.log(`RATE LIMITED (429): Address ${address}, waiting ${retryDelay}ms before retry... (attempt ${retryCount + 1}/${maxRetries + 1})`);
                
                if (retryCount < maxRetries) {
                  await delay(retryDelay);
                  retryCount++;
                  continue;
                } else {
                  console.log(`RATE LIMIT EXCEEDED: Address ${address} failed after ${maxRetries + 1} attempts - all returned 429`);
                  lastError = `Rate limited: All ${maxRetries + 1} attempts returned 429 (Too Many Requests)`;
                  break;
                }
              }
              
              if (!response.ok) {
                lastError = `HTTP ${response.status}: ${response.statusText}`;
                console.log(`API ERROR: Address ${address} returned ${response.status} ${response.statusText}`);
                break;
              }
              
              // Success, break out of retry loop
              lastError = null;
              break;
              
            } catch (fetchError) {
              lastError = `Network error: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`;
              console.log(`NETWORK ERROR: Address ${address} - ${lastError}`);
              
              if (retryCount < maxRetries) {
                const retryDelay = Math.max(2000, requestDelay) * (retryCount + 1);
                console.log(`Network error for ${address}, waiting ${retryDelay}ms before retry...`);
                await delay(retryDelay);
                retryCount++;
                continue;
              }
              break;
            }
          }
          
          // Check if we have a valid response
          if (!response || !response.ok) {
            throw new Error(lastError || `API request failed after ${maxRetries + 1} attempts`);
          }

          const data: HiroBalanceResponse = await response.json();
          console.log(`Hiro API response data for ${address}:`, data);

          // Update result with success
          await storage.updateAddressResult(resultEntry.id, {
            status: "success",
            data: data,
            errorMessage: null,
          });

          successCount++;
        } catch (error) {
          // Update result with error
          await storage.updateAddressResult(resultEntry.id, {
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
          });

          failedCount++;
        }
      }

      processedCount++;

      // Update batch job progress
      await storage.updateBatchJob(batchJobId, {
        processedAddresses: processedCount,
        successfulLookups: successCount,
        failedLookups: failedCount,
      });

      // Rate limiting delay - always wait between requests
      if (processedCount < addresses.length) {
        console.log(`Waiting ${requestDelay}ms before next request...`);
        await delay(requestDelay);
      }
    } catch (error) {
      console.error(`Error processing address ${address}:`, error);
      failedCount++;
      processedCount++;
    }
  }

  // Mark batch as completed
  await storage.updateBatchJob(batchJobId, {
    status: "completed",
    completedAt: new Date(),
    processedAddresses: processedCount,
    successfulLookups: successCount,
    failedLookups: failedCount,
  });
}
