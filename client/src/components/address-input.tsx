import { useState } from "react";
import { Keyboard, Upload, Play, Eraser, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AddressInputProps {
  onBatchCreated: (batchJobId: string) => void;
  onBatchCleared?: () => void;
}

// Predefined token options
const PREDEFINED_TOKENS = [
  { ticker: "FSPKS", address: "btkn1daywtenlww42njymqzyegvcwuy3p9f26zknme0srxa7tagewvuys86h553", name: "FlashSparks" },
  { ticker: "SNOW", address: "btkn1f0wpf28xhs6sswxkthx9fzrv2x9476yk95wlucp4sfuqmxnu8zesv2gsws", name: "Snowflake" },
  { ticker: "UTXO", address: "btkn1pzvck7xzt96vj4h9agnyu493t7a9jdc4v3j2z3n3fs4cwlcq9yps2zgm4z", name: "UTXO" },
];

export default function AddressInput({ onBatchCreated, onBatchCleared }: AddressInputProps) {
  const [activeTab, setActiveTab] = useState<"manual" | "upload">("manual");
  const [addresses, setAddresses] = useState("");
  const [selectedTokens, setSelectedTokens] = useState<string[]>(["btkn1daywtenlww42njymqzyegvcwuy3p9f26zknme0srxa7tagewvuys86h553"]);
  const [customTokenAddress, setCustomTokenAddress] = useState("");
  const [showCustomToken, setShowCustomToken] = useState(false);
  const [rateLimit, setRateLimit] = useState("5");
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();

  const createBatchMutation = useMutation({
    mutationFn: async (data: { name: string; targetTokenAddress?: string; rateLimit: number; totalAddresses: number }) => {
      const response = await apiRequest("POST", "/api/batch-jobs", data);
      return response.json();
    },
  });

  const initializeBatchMutation = useMutation({
    mutationFn: async ({ batchJobId, addresses }: { batchJobId: string; addresses: string[] }) => {
      const response = await apiRequest("POST", `/api/batch-jobs/${batchJobId}/initialize`, { addresses });
      return response.json();
    },
  });

  const submitResultMutation = useMutation({
    mutationFn: async ({ batchJobId, address, status, data, errorMessage }: { 
      batchJobId: string; 
      address: string; 
      status: "success" | "failed"; 
      data?: any; 
      errorMessage?: string 
    }) => {
      const response = await apiRequest("POST", `/api/batch-jobs/${batchJobId}/submit-result`, {
        address,
        status,
        data,
        errorMessage,
      });
      return response.json();
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      
      // Read file content for CSV/TXT files
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);
        setAddresses(lines.join('\n'));
      };
      reader.readAsText(selectedFile);
    }
  };

  const parseAddresses = (input: string): string[] => {
    return input
      .split('\n')
      .map(addr => addr.trim())
      .filter(addr => addr && addr.startsWith('sp'));
  };

  // Helper function to call Sparkscan API directly from frontend
  const callSparkscanAPI = async (address: string, retries = 3): Promise<{ success: boolean; data?: any; error?: string }> => {
    const apiUrl = `https://www.sparkscan.io/api/v1/address/${address}?network=MAINNET`;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://www.sparkscan.io/',
            'Origin': 'https://www.sparkscan.io'
          }
        });

        if (response.status === 429) {
          // Rate limited - wait and retry
          if (attempt < retries) {
            const delay = Math.min(5000 * attempt, 15000);  // Exponential backoff up to 15 seconds
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          } else {
            return { success: false, error: "Rate limited after multiple retries" };
          }
        }

        if (!response.ok) {
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            continue;
          }
          return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
        }

        const data = await response.json();
        return { success: true, data };
      } catch (error) {
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
          continue;
        }
        return { success: false, error: error instanceof Error ? error.message : 'Network error' };
      }
    }
    return { success: false, error: 'All retry attempts failed' };
  };

  // Function to process addresses with frontend API calls
  const processAddressesDirectly = async (batchJobId: string, addresses: string[], rateLimitPerSecond: number) => {
    const logger = (window as any).sparkScanLogger;
    const delay = Math.ceil(1000 / rateLimitPerSecond); // Convert to milliseconds between requests

    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      
      logger?.info(`Processing address ${i + 1}/${addresses.length}`, address);
      
      try {
        const result = await callSparkscanAPI(address);
        
        if (result.success) {
          await submitResultMutation.mutateAsync({
            batchJobId,
            address,
            status: "success",
            data: result.data,
          });
          logger?.success(`✓ Address ${i + 1} completed`, address);
        } else {
          await submitResultMutation.mutateAsync({
            batchJobId,
            address,
            status: "failed",
            errorMessage: result.error,
          });
          logger?.error(`✗ Address ${i + 1} failed`, result.error || "Unknown error");
        }
      } catch (error) {
        logger?.error(`✗ Address ${i + 1} error`, error instanceof Error ? error.message : "Unknown error");
        await submitResultMutation.mutateAsync({
          batchJobId,
          address,
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
      }

      // Rate limiting delay (except for the last address)
      if (i < addresses.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    logger?.success("All addresses processed!", `Completed ${addresses.length} addresses`);
  };

  const handleStartAnalysis = async () => {
    const logger = (window as any).sparkScanLogger;
    
    logger?.info("Starting batch analysis...");
    const addressList = parseAddresses(addresses);
    logger?.info(`Parsed ${addressList.length} valid addresses`, `Selected tokens: ${selectedTokens.length}`);
    
    if (addressList.length === 0) {
      logger?.error("No valid addresses found", "Please check address format (must start with 'sp')");
      toast({
        title: "No valid addresses",
        description: "Please enter at least one valid Sparkscan address (starting with 'sp')",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create batch job with the first selected token (for now, keeping single token compatibility)
      const targetTokenAddress = selectedTokens.length > 0 ? selectedTokens[0] : 
                                (customTokenAddress ? customTokenAddress : undefined);
      
      logger?.info("Creating batch job...", `Rate limit: ${rateLimit} req/sec`);
      const batchJob = await createBatchMutation.mutateAsync({
        name: `Batch ${new Date().toLocaleString()}`,
        targetTokenAddress: targetTokenAddress,
        rateLimit: parseInt(rateLimit),
        totalAddresses: addressList.length,
      });
      
      logger?.success(`Batch job created: ${batchJob.id}`, `Processing ${addressList.length} addresses`);

      // Initialize batch processing (create entries in database)
      logger?.info("Initializing batch processing...", "Setting up address entries");
      await initializeBatchMutation.mutateAsync({
        batchJobId: batchJob.id,
        addresses: addressList,
      });

      onBatchCreated(batchJob.id);
      
      logger?.info("Starting frontend API calls...", "Using your local IP to avoid rate limits");
      toast({
        title: "Batch processing started",
        description: `Processing ${addressList.length} addresses using your local IP...`,
      });

      // Start processing addresses directly in frontend (non-blocking)
      setTimeout(() => {
        processAddressesDirectly(batchJob.id, addressList, parseInt(rateLimit));
      }, 100);
    } catch (error) {
      logger?.error("Failed to start analysis", error instanceof Error ? error.message : "Unknown error");
      toast({
        title: "Failed to start analysis",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleTokenToggle = (tokenAddress: string) => {
    // FSPKS is always selected, cannot be deselected
    if (tokenAddress === "btkn1daywtenlww42njymqzyegvcwuy3p9f26zknme0srxa7tagewvuys86h553") {
      return;
    }
    
    setSelectedTokens(prev => 
      prev.includes(tokenAddress) 
        ? prev.filter(addr => addr !== tokenAddress)
        : [...prev, tokenAddress]
    );
  };

  const handleAddCustomToken = () => {
    if (customTokenAddress && !selectedTokens.includes(customTokenAddress)) {
      setSelectedTokens(prev => [...prev, customTokenAddress]);
      setCustomTokenAddress("");
      setShowCustomToken(false);
    }
  };

  const handleRemoveToken = (tokenAddress: string) => {
    // FSPKS cannot be removed
    if (tokenAddress === "btkn1daywtenlww42njymqzyegvcwuy3p9f26zknme0srxa7tagewvuys86h553") {
      return;
    }
    setSelectedTokens(prev => prev.filter(addr => addr !== tokenAddress));
  };

  const handleClear = () => {
    setAddresses("");
    setSelectedTokens(["btkn1daywtenlww42njymqzyegvcwuy3p9f26zknme0srxa7tagewvuys86h553"]); // Keep FSPKS selected
    setCustomTokenAddress("");
    setShowCustomToken(false);
    setFile(null);
    const fileInput = document.getElementById("file-input") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
    // Clear the current batch analysis
    onBatchCleared?.();
  };

  const addressCount = parseAddresses(addresses).length;

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Input Addresses</h2>
        
        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 bg-muted p-1 rounded-lg">
          <Button
            variant={activeTab === "manual" ? "default" : "ghost"}
            className="flex-1 justify-start"
            onClick={() => setActiveTab("manual")}
            data-testid="tab-manual"
          >
            <Keyboard className="mr-2 h-4 w-4" />
            Manual Input
          </Button>
          <Button
            variant={activeTab === "upload" ? "default" : "ghost"}
            className="flex-1 justify-start"
            onClick={() => setActiveTab("upload")}
            data-testid="tab-upload"
          >
            <Upload className="mr-2 h-4 w-4" />
            File Upload
          </Button>
        </div>

        {/* Manual Input Tab */}
        {activeTab === "manual" && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="addresses-input" className="block text-sm font-medium text-foreground mb-2">
                Wallet Addresses (one per line)
              </Label>
              <Textarea
                id="addresses-input"
                className="w-full h-32"
                placeholder=""
                value={addresses}
                onChange={(e) => setAddresses(e.target.value)}
                data-testid="textarea-addresses"
              />
            </div>
            
            <div className="space-y-4">
              {/* Target Tokens Selection */}
              <div>
                <Label className="block text-sm font-medium text-foreground mb-3">
                  Target Tokens (optional)
                </Label>
                
                {/* Predefined Tokens */}
                <div className="space-y-3">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Popular Tokens</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {PREDEFINED_TOKENS.map((token) => (
                      <div key={token.address} className={`flex items-center space-x-2 p-3 border border-border rounded-lg transition-colors ${
                        token.ticker === 'FSPKS' ? 'bg-primary/10 border-primary/30' : 'hover:bg-muted/50'
                      }`}>
                        <Checkbox
                          id={token.address}
                          checked={selectedTokens.includes(token.address)}
                          onCheckedChange={() => handleTokenToggle(token.address)}
                          disabled={token.ticker === 'FSPKS'}
                          data-testid={`checkbox-token-${token.ticker}`}
                        />
                        <Label htmlFor={token.address} className="flex-1 cursor-pointer">
                          <div className="font-medium text-foreground">
                            {token.ticker}
                            {token.ticker === 'FSPKS' && <span className="ml-2 text-xs text-primary">(Required)</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">{token.name}</div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom Token Input */}
                <div className="mt-4">
                  {!showCustomToken ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCustomToken(true)}
                      data-testid="button-add-custom-token"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Custom Token
                    </Button>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Input
                        type="text"
                        placeholder="btkn1..."
                        value={customTokenAddress}
                        onChange={(e) => setCustomTokenAddress(e.target.value)}
                        className="flex-1"
                        data-testid="input-custom-token"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddCustomToken}
                        disabled={!customTokenAddress}
                        data-testid="button-confirm-custom-token"
                      >
                        Add
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowCustomToken(false);
                          setCustomTokenAddress("");
                        }}
                        data-testid="button-cancel-custom-token"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>

                {/* Selected Tokens Display */}
                {selectedTokens.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs font-medium text-muted-foreground mb-2">Selected Tokens ({selectedTokens.length})</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedTokens.map((tokenAddress) => {
                        const predefinedToken = PREDEFINED_TOKENS.find(t => t.address === tokenAddress);
                        const displayName = predefinedToken ? predefinedToken.ticker : tokenAddress.slice(0, 8) + '...';
                        
                        const isFSPKS = tokenAddress === "btkn1daywtenlww42njymqzyegvcwuy3p9f26zknme0srxa7tagewvuys86h553";
                        
                        return (
                          <Badge key={tokenAddress} variant={isFSPKS ? "default" : "secondary"} className="flex items-center space-x-1">
                            <span data-testid={`badge-selected-token-${displayName}`}>
                              {displayName}
                              {isFSPKS && <span className="ml-1 text-xs">(Required)</span>}
                            </span>
                            {!isFSPKS && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                                onClick={() => handleRemoveToken(tokenAddress)}
                                data-testid={`button-remove-token-${displayName}`}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Rate Limit */}
              <div>
                <Label htmlFor="rate-limit" className="block text-sm font-medium text-foreground mb-2">
                  Rate Limit (requests/second)
                </Label>
                <Select value={rateLimit} onValueChange={setRateLimit}>
                  <SelectTrigger data-testid="select-rate-limit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 requests/sec</SelectItem>
                    <SelectItem value="10">10 requests/sec</SelectItem>
                    <SelectItem value="15">15 requests/sec</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* File Upload Tab */}
        {activeTab === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Upload CSV File</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload a CSV file with wallet addresses. Each address should be on a separate line.
              </p>
              <input
                type="file"
                accept=".csv,.txt"
                className="hidden"
                id="file-input"
                onChange={handleFileChange}
                data-testid="input-file"
              />
              <Label htmlFor="file-input" className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 cursor-pointer transition-colors">
                <Upload className="mr-2 h-4 w-4" />
                Choose File
              </Label>
              {file && (
                <p className="text-sm text-foreground mt-2">
                  Selected: {file.name}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-border">
          <div className="flex items-center space-x-4">
            <Button
              onClick={handleStartAnalysis}
              disabled={createBatchMutation.isPending || initializeBatchMutation.isPending || addressCount === 0}
              data-testid="button-start-analysis"
            >
              <Play className="mr-2 h-4 w-4" />
              {createBatchMutation.isPending || initializeBatchMutation.isPending ? "Starting..." : "Start Analysis"}
            </Button>
            <Button variant="outline" onClick={handleClear} data-testid="button-clear">
              <Eraser className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            <span data-testid="text-address-count">{addressCount}</span> addresses ready for processing
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
