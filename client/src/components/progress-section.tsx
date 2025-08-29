import { StopCircle, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import type { BatchJob } from "@shared/schema";

interface ProgressSectionProps {
  batchJobId: string;
}

export default function ProgressSection({ batchJobId }: ProgressSectionProps) {
  const logger = (window as any).sparkScanLogger;

  const { data: batchJob } = useQuery<BatchJob>({
    queryKey: ["/api/batch-jobs", batchJobId],
    refetchInterval: 3000,
    enabled: true,
    onSuccess: (data) => {
      if (data) {
        const prevStatus = (window as any).lastBatchStatus;
        const prevProcessed = (window as any).lastProcessedCount || 0;
        
        if (prevStatus !== data.status) {
          (window as any).lastBatchStatus = data.status;
          
          switch(data.status) {
            case "processing":
              logger?.info(`Batch processing started`, `Processing ${data.totalAddresses} addresses with ${data.rateLimit || 5} req/sec rate limit`);
              break;
            case "completed":
              logger?.success(`Batch processing completed!`, `Successfully processed ${data.processedAddresses} addresses`);
              break;
            case "failed":
              logger?.error(`Batch processing failed`, `Only ${data.processedAddresses}/${data.totalAddresses} addresses completed`);
              break;
          }
        }
        
        // Log progress updates
        if (data.status === "processing" && data.processedAddresses > prevProcessed) {
          const newlyProcessed = data.processedAddresses - prevProcessed;
          (window as any).lastProcessedCount = data.processedAddresses;
          logger?.info(`API requests completed`, `${newlyProcessed} address(es) processed, ${data.totalAddresses - data.processedAddresses} remaining`);
        }
        
        // Log rate limiting issues
        if (data.status === "processing" && data.processedAddresses === prevProcessed && prevProcessed > 0) {
          const now = Date.now();
          const lastRateLimitLog = (window as any).lastRateLimitLog || 0;
          if (now - lastRateLimitLog > 30000) { // Log every 30 seconds
            (window as any).lastRateLimitLog = now;
            logger?.warning(`Processing delayed`, `API rate limiting detected, waiting for requests to complete`);
          }
        }
      }
    }
  });

  if (!batchJob) {
    return null;
  }

  const progressPercentage = batchJob.totalAddresses > 0 
    ? Math.round((batchJob.processedAddresses / batchJob.totalAddresses) * 100)
    : 0;

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Processing Status</h2>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-muted-foreground">
              Progress: <span className="font-medium text-foreground" data-testid="text-progress">
                {batchJob.processedAddresses}/{batchJob.totalAddresses}
              </span>
            </div>
            {batchJob.status === "processing" && (
              <Button variant="destructive" size="sm" data-testid="button-stop-processing">
                <StopCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        <Progress value={progressPercentage} className="mb-4" data-testid="progress-bar" />
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-accent" />
            <span className="text-muted-foreground">Successful:</span>
            <span className="font-medium text-foreground" data-testid="text-successful-count">
              {batchJob.successfulLookups}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <span className="text-muted-foreground">Failed:</span>
            <span className="font-medium text-foreground" data-testid="text-failed-count">
              {batchJob.failedLookups}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-secondary" />
            <span className="text-muted-foreground">Remaining:</span>
            <span className="font-medium text-foreground" data-testid="text-remaining-count">
              {batchJob.totalAddresses - batchJob.processedAddresses}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
