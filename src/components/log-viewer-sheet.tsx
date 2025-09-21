"use client";

import type { LogEntry } from "@/types";
import { format } from "date-fns";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Download, Trash2 } from "lucide-react";

type LogViewerSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  logs: LogEntry[];
  onClearLogs: () => void;
};

const getBadgeVariant = (eventType: LogEntry['eventType']) => {
    switch(eventType) {
        case 'START':
        case 'RESUME':
            return 'default';
        case 'ERROR':
            return 'destructive';
        case 'STOP':
        case 'PAUSE':
        case 'FINISH':
            return 'secondary'
        default:
            return 'outline';
    }
}

export function LogViewerSheet({ isOpen, onClose, logs, onClearLogs }: LogViewerSheetProps) {

  const handleExport = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(logs, null, 2)
    )}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = `clickloop-logs-${Date.now()}.json`;
    link.click();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Activity Log</SheetTitle>
          <SheetDescription>
            A record of all events that have occurred during loop cycles.
          </SheetDescription>
        </SheetHeader>
        <Separator />
        <div className="flex-1 min-h-0">
            <ScrollArea className="h-full pr-4">
            <div className="space-y-4">
                {logs.length > 0 ? logs.map((log) => (
                    <div key={log.timestamp} className="flex gap-4 text-sm">
                        <p className="font-mono text-xs text-muted-foreground pt-0.5">{format(log.timestamp, 'HH:mm:ss')}</p>
                        <div className="flex-1">
                            <Badge variant={getBadgeVariant(log.eventType)} className="mb-1">{log.eventType}</Badge>
                            <p className="text-foreground leading-snug">{log.message}</p>
                        </div>
                    </div>
                )) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <p>No log entries yet.</p>
                    </div>
                )}
            </div>
            </ScrollArea>
        </div>
        <Separator />
        <SheetFooter className="pt-4">
          <Button variant="outline" onClick={onClearLogs}>
            <Trash2 className="mr-2 size-4" />
            Clear Logs
          </Button>
          <Button onClick={handleExport} disabled={logs.length === 0}>
            <Download className="mr-2 size-4" />
            Export as JSON
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
