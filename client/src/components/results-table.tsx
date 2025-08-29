import React, { useState } from "react";
import { ChevronDown, ChevronUp, Search, Download, ArrowUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { BatchJob, AddressResult, HiroBalanceResponse, HiroFungibleToken } from "@shared/schema";

interface ResultsTableProps {
  batchJobId: string;
}

// Utility function to format address display
const formatAddress = (address: string): string => {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export default function ResultsTable({ batchJobId }: ResultsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<string>("address");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

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

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleExport = (format: "csv" | "json") => {
    const url = `/api/batch-jobs/${batchJobId}/export/${format}`;
    window.open(url, '_blank');
  };

  // Filter and sort results
  const filteredResults = results.filter(result =>
    result.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedResults = [...filteredResults].sort((a, b) => {
    let aValue: any = a[sortField as keyof AddressResult];
    let bValue: any = b[sortField as keyof AddressResult];

    if (sortField === "totalValueUsd" && a.data && b.data) {
      // For Hiro API, calculate total value from STX balance and tokens
      const aData = a.data as HiroBalanceResponse;
      const bData = b.data as HiroBalanceResponse;
      aValue = parseFloat(aData.stx.balance) / 1000000; // Convert microSTX to STX
      bValue = parseFloat(bData.stx.balance) / 1000000;
    } else if (sortField === "transactionCount" && a.data && b.data) {
      // Transaction count not available in Hiro balance API
      aValue = 0;
      bValue = 0;
    } else if (sortField === "tokenCount" && a.data && b.data) {
      const aData = a.data as HiroBalanceResponse;
      const bData = b.data as HiroBalanceResponse;
      aValue = Object.keys(aData.fungible_tokens).length;
      bValue = Object.keys(bData.fungible_tokens).length;
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const getTargetTokenBalance = (result: AddressResult): { balance: number; ticker: string; decimals: number } | null => {
    if (!result.data || !batchJob?.targetTokenAddress) return null;
    
    const data = result.data as HiroBalanceResponse;
    const targetToken = data.fungible_tokens[batchJob.targetTokenAddress];
    
    if (targetToken) {
      // For FSPKS token, extract balance as number
      const balance = parseFloat(targetToken.balance);
      return { balance, ticker: "FSPKS", decimals: 6 };
    }
    
    return null;
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

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort("address")}
                    className="flex items-center space-x-1 hover:text-primary"
                    data-testid="sort-address"
                  >
                    <span>Address</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort("btcBalance")}
                    className="flex items-center space-x-1 hover:text-primary"
                    data-testid="sort-btc-balance"
                  >
                    <span>BTC Balance</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort("tokenCount")}
                    className="flex items-center space-x-1 hover:text-primary"
                    data-testid="sort-token-count"
                  >
                    <span>Token Count</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort("transactionCount")}
                    className="flex items-center space-x-1 hover:text-primary"
                    data-testid="sort-transactions"
                  >
                    <span>Transactions</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort("totalValueUsd")}
                    className="flex items-center space-x-1 hover:text-primary"
                    data-testid="sort-total-value"
                  >
                    <span>Total Value USD</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>Target Token</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedResults.map((result) => {
                const data = result.data as HiroBalanceResponse | null;
                const targetToken = getTargetTokenBalance(result);
                const isExpanded = expandedRows.has(result.id);
                
                return (
                  <React.Fragment key={result.id}>
                    <TableRow 
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(result.status).replace('bg-', 'bg-').replace('text-', '')}`} />
                          <div>
                            <p className="text-sm font-medium text-foreground" data-testid={`text-address-${result.id}`} title={result.address}>
                              {formatAddress(result.address)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {result.processedAt ? `Processed ${new Date(result.processedAt).toLocaleTimeString()}` : "Pending"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {result.status === "processing" ? (
                          <div className="flex items-center space-x-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm text-muted-foreground">Loading...</span>
                          </div>
                        ) : data ? (
                          <div>
                            <p className="text-sm font-medium text-foreground" data-testid={`text-stx-balance-${result.id}`}>
                              {(parseFloat(data.stx.balance) / 1000000).toFixed(6)} STX
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {data.stx.locked !== "0" ? `Locked: ${(parseFloat(data.stx.locked) / 1000000).toFixed(6)} STX` : "Unlocked"}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-foreground" data-testid={`text-token-count-${result.id}`}>
                        {data ? Object.keys(data.fungible_tokens).length : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-foreground" data-testid={`text-transaction-count-${result.id}`}>
                        N/A
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-foreground" data-testid={`text-total-value-${result.id}`}>
                          {data ? `$${(parseFloat(data.stx.balance) / 1000000 * 0.5).toFixed(2)} (est.)` : "$0.00"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {targetToken ? (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-accent" data-testid={`text-target-token-balance-${result.id}`}>
                              {formatBalance(targetToken.balance, targetToken.decimals)}
                            </span>
                            <span className="text-xs text-muted-foreground">{targetToken.ticker}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {data && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleRowExpansion(result.id)}
                            data-testid={`button-expand-${result.id}`}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Expandable Row Content */}
                    {isExpanded && data && (
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={7} className="p-6">
                          <div className="space-y-4">
                            <h4 className="font-medium text-foreground">Token Details</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {Object.entries(data.fungible_tokens).map(([contractId, token]) => (
                                <Card key={contractId} className="bg-background border border-border">
                                  <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <h5 className="font-medium text-foreground" data-testid={`text-token-name-${contractId}`}>
                                        {contractId.split('.')[1] || contractId}
                                      </h5>
                                      <Badge className="bg-primary/10 text-primary" data-testid={`badge-token-ticker-${contractId}`}>
                                        TOKEN
                                      </Badge>
                                    </div>
                                    <div className="space-y-1 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Balance:</span>
                                        <span className="font-medium text-foreground" data-testid={`text-token-balance-${contractId}`}>
                                          {parseFloat(token.balance).toLocaleString()}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Decimals:</span>
                                        <span className="text-foreground" data-testid={`text-token-decimals-${contractId}`}>
                                          N/A
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Value USD:</span>
                                        <span className="text-foreground" data-testid={`text-token-value-${contractId}`}>
                                          N/A
                                        </span>
                                      </div>
                                      <div className="mt-2 pt-2 border-t border-border">
                                        <p className="text-xs text-muted-foreground break-all" data-testid={`text-token-address-${contractId}`}>
                                          {contractId}
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
