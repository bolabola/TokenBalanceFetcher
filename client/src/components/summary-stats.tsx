import { Wallet, Coins, ArrowRightLeft, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { BatchJob, AddressResult, SparkscanResponse } from "@shared/schema";

interface SummaryStatsProps {
  batchJobId: string;
}

export default function SummaryStats({ batchJobId }: SummaryStatsProps) {
  const { data: batchJob } = useQuery<BatchJob>({
    queryKey: ["/api/batch-jobs", batchJobId],
  });

  const { data: results = [] } = useQuery<AddressResult[]>({
    queryKey: ["/api/batch-jobs", batchJobId, "results"],
    refetchInterval: batchJob?.status === "processing" ? 5000 : false,
  });

  // Calculate summary statistics
  const successfulResults = results.filter(r => r.status === "success" && r.data);
  const totalValueUsd = successfulResults.reduce((sum, result) => {
    const data = result.data as SparkscanResponse;
    return sum + (data?.totalValueUsd || 0);
  }, 0);

  const totalTransactions = successfulResults.reduce((sum, result) => {
    const data = result.data as SparkscanResponse;
    return sum + (data?.transactionCount || 0);
  }, 0);

  const uniqueTokens = new Set<string>();
  successfulResults.forEach(result => {
    const data = result.data as SparkscanResponse;
    data?.tokens?.forEach(token => uniqueTokens.add(token.tokenIdentifier));
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-3">
            <div className="bg-primary/10 text-primary p-3 rounded-lg">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Addresses</p>
              <p className="text-2xl font-bold text-foreground" data-testid="text-total-addresses">
                {batchJob?.totalAddresses || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-3">
            <div className="bg-accent/10 text-accent p-3 rounded-lg">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Value USD</p>
              <p className="text-2xl font-bold text-foreground" data-testid="text-total-value-usd">
                ${totalValueUsd.toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-3">
            <div className="bg-secondary/10 text-secondary p-3 rounded-lg">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Transactions</p>
              <p className="text-2xl font-bold text-foreground" data-testid="text-total-transactions">
                {totalTransactions.toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-3">
            <div className="bg-yellow-500/10 text-yellow-600 p-3 rounded-lg">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Unique Tokens</p>
              <p className="text-2xl font-bold text-foreground" data-testid="text-unique-tokens">
                {uniqueTokens.size}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
