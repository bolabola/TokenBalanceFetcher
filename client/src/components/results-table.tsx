import React, { useState } from "react";
import { ChevronDown, ChevronUp, Search, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { BatchJob, AddressResult, SparkscanResponse, SparkscanToken } from "@shared/schema";

interface ResultsTableProps {
  batchJobId: string;
}

// Predefined token options  
const PREDEFINED_TOKENS = [
  { ticker: "FSPKS", address: "btkn1daywtenlww42njymqzyegvcwuy3p9f26zknme0srxa7tagewvuys86h553", name: "FlashSparks" },
  { ticker: "SNOW", address: "btkn1f0wpf28xhs6sswxkthx9fzrv2x9476yk95wlucp4sfuqmxnu8zesv2gsws", name: "Snowflake" },
  { ticker: "UTXO", address: "btkn1pzvck7xzt96vj4h9agnyu493t7a9jdc4v3j2z3n3fs4cwlcq9yps2zgm4z", name: "UTXO" },
];

// Utility function to format address display
const formatAddress = (address: string): string => {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

export default function ResultsTable({ batchJobId }: ResultsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: batchJob } = useQuery<BatchJob>({
    queryKey: ["/api/batch-jobs", batchJobId],
  });

  const { data: results = [] } = useQuery<AddressResult[]>({
    queryKey: ["/api/batch-jobs", batchJobId, "results"],
    refetchInterval: batchJob?.status === "processing" ? 3000 : false,
  });

  const toggleRowExpansion = (resultId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(resultId)) {
      newExpanded.delete(resultId);
    } else {
      newExpanded.add(resultId);
    }
    setExpandedRows(newExpanded);
  };


  const handleExport = (format: "csv" | "json") => {
    const url = `/api/batch-jobs/${batchJobId}/export/${format}`;
    window.open(url, '_blank');
  };

  // Filter and sort results
  const filteredResults = results.filter(result =>
    result.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedResults = filteredResults;

  // Get selected tokens based on batch job settings
  const getSelectedTokens = () => {
    if (!batchJob?.targetTokenAddresses) return [];
    return PREDEFINED_TOKENS.filter(token => 
      batchJob.targetTokenAddresses?.includes(token.address)
    );
  };

  const getTargetTokenBalance = (result: AddressResult, tokenAddress: string): { balance: number; ticker: string; decimals: number } | null => {
    if (!result.data) return null;
    
    const data = result.data as SparkscanResponse;
    const targetToken = data.tokens?.find(token => token.tokenAddress === tokenAddress);
    
    return targetToken ? { balance: targetToken.balance, ticker: targetToken.ticker, decimals: targetToken.decimals } : null;
  };

  const formatBalance = (balance: number, decimals: number = 0): string => {
    const adjusted = decimals > 0 ? balance / Math.pow(10, decimals) : balance;
    return adjusted.toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success": return "bg-accent text-accent-foreground";
      case "failed": return "bg-destructive text-destructive-foreground";
      case "processing": return "bg-yellow-500 text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Analysis Results</h2>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Input
                type="text"
                placeholder="Search addresses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
                data-testid="input-search"
              />
              <Button variant="outline" size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                onClick={() => handleExport("csv")} 
                size="sm" 
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                data-testid="button-export-csv"
              >
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
              <Button 
                onClick={() => handleExport("json")} 
                size="sm"
                data-testid="button-export-json"
              >
                <Download className="mr-2 h-4 w-4" />
                JSON
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-w-full">
          <Table style={{width: 'auto', tableLayout: 'fixed'}} className="border-separate" data-compact="true">
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead className="text-xs font-medium px-1">Address</TableHead>
                <TableHead className="text-xs font-medium px-1 text-center">BTC</TableHead>
                {getSelectedTokens().map((token) => (
                  <TableHead key={token.ticker} className="text-xs font-medium px-1 text-center">
                    {token.ticker}
                  </TableHead>
                ))}
                <TableHead className="text-xs font-medium px-1 text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedResults.map((result) => {
                const data = result.data as SparkscanResponse | null;
                const isExpanded = expandedRows.has(result.id);
                
                return (
                  <React.Fragment key={result.id}>
                    <TableRow 
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="py-1 px-1">
                        <div className="flex items-center space-x-1">
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(result.status).replace('bg-', 'bg-').replace('text-', '')}`} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground truncate" data-testid={`text-address-${result.id}`} title={result.address}>
                              {formatAddress(result.address)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {result.processedAt ? `${new Date(result.processedAt).toLocaleTimeString().slice(0,5)}` : "Pending"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-1 px-1 text-center">
                        {result.status === "processing" ? (
                          <div className="flex items-center space-x-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span className="text-xs text-muted-foreground">Loading...</span>
                          </div>
                        ) : data ? (
                          <div className="w-16">
                            <p className="text-xs font-medium text-foreground truncate" data-testid={`text-btc-balance-${result.id}`}>
                              {(data.balance.btcHardBalanceSats / 100000000).toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              ${Math.round(data.balance.btcValueUsdHard)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      {getSelectedTokens().map((token) => {
                        const tokenBalance = data?.tokens?.find(t => t.tokenAddress === token.address);
                        return (
                          <TableCell key={token.ticker} className="py-1 px-1 text-center">
                            {tokenBalance ? (
                              <div className="flex items-center">
                                <span className="text-xs font-medium text-accent" data-testid={`text-${token.ticker.toLowerCase()}-balance-${result.id}`}>
                                  {formatBalance(tokenBalance.balance, tokenBalance.decimals)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="py-1 px-1 text-center">
                        {data && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleRowExpansion(result.id)}
                            data-testid={`button-expand-${result.id}`}
                          >
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Expandable Row Content */}
                    {isExpanded && data && (
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={3 + getSelectedTokens().length} className="p-4">
                          <div className="space-y-4">
                            <h4 className="font-medium text-foreground">Token Details</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {data.tokens?.map((token: SparkscanToken) => (
                                <Card key={token.tokenIdentifier} className="bg-background border border-border">
                                  <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <h5 className="font-medium text-foreground" data-testid={`text-token-name-${token.tokenIdentifier}`}>
                                        {token.name}
                                      </h5>
                                      <Badge className="bg-primary/10 text-primary" data-testid={`badge-token-ticker-${token.tokenIdentifier}`}>
                                        {token.ticker}
                                      </Badge>
                                    </div>
                                    <div className="space-y-1 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Balance:</span>
                                        <span className="font-medium text-foreground" data-testid={`text-token-balance-${token.tokenIdentifier}`}>
                                          {formatBalance(token.balance, token.decimals)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Decimals:</span>
                                        <span className="text-foreground" data-testid={`text-token-decimals-${token.tokenIdentifier}`}>
                                          {token.decimals}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Value USD:</span>
                                        <span className="text-foreground" data-testid={`text-token-value-${token.tokenIdentifier}`}>
                                          ${token.valueUsd.toFixed(2)}
                                        </span>
                                      </div>
                                      <div className="mt-2 pt-2 border-t border-border">
                                        <p className="text-xs text-muted-foreground break-all" data-testid={`text-token-address-${token.tokenIdentifier}`}>
                                          {token.tokenAddress}
                                        </p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
              
              {/* Summary Statistics Row */}
              {results.length > 0 && (
                <TableRow className="bg-primary/5 border-t-2 border-primary/20 font-semibold">
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-sm font-semibold text-primary">TOTALS</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm font-semibold text-foreground" data-testid="text-summary-btc-total">
                        {(() => {
                          const totalBtc = results
                            .filter(r => r.status === "success" && r.data)
                            .reduce((sum, r) => sum + ((r.data as SparkscanResponse)?.balance?.btcHardBalanceSats || 0), 0);
                          return `${totalBtc.toLocaleString()} sats`;
                        })()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ${(() => {
                          const totalBtcUsd = results
                            .filter(r => r.status === "success" && r.data)
                            .reduce((sum, r) => sum + ((r.data as SparkscanResponse)?.balance?.btcValueUsdHard || 0), 0);
                          return totalBtcUsd.toFixed(2);
                        })()}
                      </p>
                    </div>
                  </TableCell>
                  {getSelectedTokens().map((token) => (
                    <TableCell key={token.ticker} className="py-1 px-1 text-center">
                      <span className="text-xs font-semibold text-accent" data-testid={`text-summary-${token.ticker.toLowerCase()}-total`}>
                        {(() => {
                          const totalTokenBalance = results
                            .filter(r => r.status === "success" && r.data)
                            .reduce((sum, r) => {
                              const data = r.data as SparkscanResponse;
                              const foundToken = data.tokens?.find(t => t.tokenAddress === token.address);
                              return sum + (foundToken ? foundToken.balance / Math.pow(10, foundToken.decimals) : 0);
                            }, 0);
                          return totalTokenBalance.toLocaleString();
                        })()}
                      </span>
                    </TableCell>
                  ))}
                  <TableCell>
                    <span className="text-xs text-muted-foreground" data-testid="text-summary-count">
                      {results.filter(r => r.status === "success").length} success / {results.length} total
                    </span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <div className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">1</span> to{" "}
            <span className="font-medium text-foreground">{sortedResults.length}</span> of{" "}
            <span className="font-medium text-foreground">{results.length}</span> results
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" disabled data-testid="button-pagination-previous">
              Previous
            </Button>
            <Button size="sm" data-testid="button-pagination-current">1</Button>
            <Button variant="outline" size="sm" disabled data-testid="button-pagination-next">
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
