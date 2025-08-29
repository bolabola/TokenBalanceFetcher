import { useState } from "react";
import { Keyboard, Upload, Play, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AddressInputProps {
  onBatchCreated: (batchJobId: string) => void;
}

export default function AddressInput({ onBatchCreated }: AddressInputProps) {
  const [activeTab, setActiveTab] = useState<"manual" | "upload">("manual");
  const [addresses, setAddresses] = useState("");
  const [targetTokenAddress, setTargetTokenAddress] = useState("");
  const [rateLimit, setRateLimit] = useState("5");
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();

  const createBatchMutation = useMutation({
    mutationFn: async (data: { name: string; targetTokenAddress?: string; rateLimit: number; totalAddresses: number }) => {
      const response = await apiRequest("POST", "/api/batch-jobs", data);
      return response.json();
    },
  });

  const processBatchMutation = useMutation({
    mutationFn: async ({ batchJobId, addresses }: { batchJobId: string; addresses: string[] }) => {
      const response = await apiRequest("POST", `/api/batch-jobs/${batchJobId}/process`, { addresses });
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

  const handleStartAnalysis = async () => {
    const addressList = parseAddresses(addresses);
    
    if (addressList.length === 0) {
      toast({
        title: "No valid addresses",
        description: "Please enter at least one valid Sparkscan address (starting with 'sp')",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create batch job
      const batchJob = await createBatchMutation.mutateAsync({
        name: `Batch ${new Date().toLocaleString()}`,
        targetTokenAddress: targetTokenAddress || undefined,
        rateLimit: parseInt(rateLimit),
        totalAddresses: addressList.length,
      });

      // Start processing
      await processBatchMutation.mutateAsync({
        batchJobId: batchJob.id,
        addresses: addressList,
      });

      onBatchCreated(batchJob.id);
      
      toast({
        title: "Batch processing started",
        description: `Processing ${addressList.length} addresses...`,
      });
    } catch (error) {
      toast({
        title: "Failed to start analysis",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleClear = () => {
    setAddresses("");
    setTargetTokenAddress("");
    setFile(null);
    const fileInput = document.getElementById("file-input") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
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
                placeholder="sp1pgssyyy86kahk63mcllls9vxr4sttx2fa3m9jpjrywc9j5e2kx69dkwcveru6j&#10;sp2abc123def456...&#10;sp3xyz789uvw012..."
                value={addresses}
                onChange={(e) => setAddresses(e.target.value)}
                data-testid="textarea-addresses"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="target-token" className="block text-sm font-medium text-foreground mb-2">
                  Target Token Address (optional)
                </Label>
                <Input
                  id="target-token"
                  type="text"
                  placeholder="btkn1daywtenlww42njymqzyegvcwuy3p9f26zknme0srxa7tagewvuys86h553"
                  value={targetTokenAddress}
                  onChange={(e) => setTargetTokenAddress(e.target.value)}
                  data-testid="input-target-token"
                />
              </div>
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
              disabled={createBatchMutation.isPending || processBatchMutation.isPending || addressCount === 0}
              data-testid="button-start-analysis"
            >
              <Play className="mr-2 h-4 w-4" />
              {createBatchMutation.isPending || processBatchMutation.isPending ? "Starting..." : "Start Analysis"}
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
