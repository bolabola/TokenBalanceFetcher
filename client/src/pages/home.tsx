import { useState } from "react";
import { Search, Settings, HelpCircle } from "lucide-react";
import AddressInput from "@/components/address-input";
import ProgressSection from "@/components/progress-section";
import SummaryStats from "@/components/summary-stats";
import ResultsTable from "@/components/results-table";
import LogDisplay from "@/components/log-display";

export default function Home() {
  const [activeBatchJobId, setActiveBatchJobId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-primary text-primary-foreground p-2 rounded-lg">
                <Search className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Sparkscan Batch Analyzer</h1>
                <p className="text-sm text-muted-foreground">Analyze multiple wallet addresses and token balances</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                className="text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-help"
              >
                <HelpCircle className="h-5 w-5" />
              </button>
              <button 
                className="text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-settings"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Input Section */}
        <AddressInput 
          onBatchCreated={setActiveBatchJobId} 
          onBatchCleared={() => setActiveBatchJobId(null)}
        />

        {/* Progress Section */}
        {activeBatchJobId && (
          <>
            <ProgressSection batchJobId={activeBatchJobId} />
            <SummaryStats batchJobId={activeBatchJobId} />
            <LogDisplay batchJobId={activeBatchJobId} />
            <ResultsTable batchJobId={activeBatchJobId} />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center space-x-2 mb-2 sm:mb-0">
              <span>Created by</span>
              <a 
                href="https://twitter.com/token_garden" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 transition-colors font-medium"
                data-testid="link-creator"
              >
                @token_garden
              </a>
            </div>
            <div className="flex items-center space-x-2">
              <span>Supported by</span>
              <a 
                href="https://twitter.com/spark" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 transition-colors font-medium"
                data-testid="link-spark"
              >
                @spark
              </a>
              <span>&</span>
              <a 
                href="https://twitter.com/flashnet" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 transition-colors font-medium"
                data-testid="link-flashnet"
              >
                @flashnet
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
