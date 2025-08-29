import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Trash2, Download } from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: Date;
  level: "info" | "warning" | "error" | "success";
  message: string;
  details?: string;
}

interface LogDisplayProps {
  batchJobId?: string;
}

export default function LogDisplay({ batchJobId }: LogDisplayProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isVisible, setIsVisible] = useState(true);

  // Add log entry
  const addLog = (level: LogEntry["level"], message: string, details?: string) => {
    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      level,
      message,
      details
    };
    setLogs(prev => [...prev, newLog]);
  };

  // Clear all logs
  const clearLogs = () => {
    setLogs([]);
  };

  // Export logs
  const exportLogs = () => {
    const logText = logs.map(log => 
      `[${log.timestamp.toLocaleTimeString()}] ${log.level.toUpperCase()}: ${log.message}${log.details ? ` | ${log.details}` : ''}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sparkscan-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Expose addLog function globally for other components to use
  useEffect(() => {
    (window as any).sparkScanLogger = {
      info: (message: string, details?: string) => addLog("info", message, details),
      warning: (message: string, details?: string) => addLog("warning", message, details),
      error: (message: string, details?: string) => addLog("error", message, details),
      success: (message: string, details?: string) => addLog("success", message, details),
    };

    return () => {
      delete (window as any).sparkScanLogger;
    };
  }, []);

  const getLevelColor = (level: LogEntry["level"]) => {
    switch (level) {
      case "info": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "warning": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "error": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "success": return "bg-green-500/10 text-green-500 border-green-500/20";
    }
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsVisible(true)}
          variant="outline"
          size="sm"
          data-testid="button-show-logs"
        >
          Show Logs ({logs.length})
        </Button>
      </div>
    );
  }

  return (
    <Card className="mb-8">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Processing Logs</CardTitle>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" data-testid="badge-log-count">
            {logs.length} entries
          </Badge>
          <Button
            onClick={exportLogs}
            variant="ghost"
            size="sm"
            disabled={logs.length === 0}
            data-testid="button-export-logs"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            onClick={clearLogs}
            variant="ghost"
            size="sm"
            disabled={logs.length === 0}
            data-testid="button-clear-logs"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => setIsVisible(false)}
            variant="ghost"
            size="sm"
            data-testid="button-hide-logs"
          >
            Hide
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64 w-full border rounded-md">
          <div className="p-4 space-y-2">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-logs">
                No logs yet. Start an analysis to see processing information.
              </p>
            ) : (
              logs.map((log) => (
                <div 
                  key={log.id} 
                  className="flex items-start space-x-3 text-sm"
                  data-testid={`log-entry-${log.level}`}
                >
                  <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                    {log.timestamp.toLocaleTimeString()}
                  </span>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${getLevelColor(log.level)}`}
                  >
                    {log.level.toUpperCase()}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground break-words">{log.message}</p>
                    {log.details && (
                      <p className="text-xs text-muted-foreground mt-1 break-words">
                        {log.details}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}