"use client";

import { PlaceHolderImages } from "@/lib/placeholder-images";
import type { LinkItem, AppSettings, LogEntry } from "@/types";
import { CycleMode } from "@/types";
import { addEditLinkSchema } from "@/lib/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import * as React from "react";
import { useForm } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import type { z } from "zod";

import { useToast } from "@/hooks/use-toast";
import useLocalStorage from "@/hooks/use-local-storage";
import { AddEditLinkDialog } from "@/components/add-edit-link-dialog";
import { AiSuggesterDialog } from "@/components/ai-suggester-dialog";
import { AppLogo } from "@/components/icons";
import { LogViewerSheet } from "@/components/log-viewer-sheet";
import { SettingsSheet } from "@/components/settings-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Cog,
  History,
  Info,
  Pause,
  Pencil,
  Play,
  Plus,
  Power,
  Sparkles,
  Trash2,
  X,
  Repeat,
  Repeat1,
} from "lucide-react";

const emptyStateImage = PlaceHolderImages.find(
  (img) => img.id === "empty-state"
)!;

export default function ClickLoopPage() {
  const [links, setLinks] = useLocalStorage<LinkItem[]>("clickloop-links", []);
  const [settings, setSettings] = useLocalStorage<AppSettings>(
    "clickloop-settings",
    {
      mode: CycleMode.SEQUENTIAL,
      globalInterval: 0,
      maxTotalIterations: 1000,
      userAgent: "",
    }
  );
  const [logs, setLogs] = useLocalStorage<LogEntry[]>("clickloop-logs", []);

  const [isRunning, setIsRunning] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const [currentUrl, setCurrentUrl] = React.useState("about:blank");
  const [activeLink, setActiveLink] = React.useState<LinkItem | null>(null);

  const [isClient, setIsClient] = React.useState(false);
  React.useEffect(() => setIsClient(true), []);

  const [dialogOpen, setDialogOpen] = React.useState<
    "add" | "edit" | "ai" | "settings" | "logs" | null
  >(null);
  const [editingLink, setEditingLink] = React.useState<LinkItem | null>(null);

  const loopTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const iterationCountRef = React.useRef(0);
  const currentLinkIndexRef = React.useRef(-1);
  const singleLoopLinkIdRef = React.useRef<string | null>(null);

  const { toast } = useToast();

  const addLog = (entry: Omit<LogEntry, "timestamp">) => {
    setLogs((prev) => [
      { ...entry, timestamp: Date.now() },
      ...prev,
    ]);
  };

  const handleAddLink = (data: z.infer<typeof addEditLinkSchema>) => {
    const newLink: LinkItem = {
      ...data,
      id: uuidv4(),
      enabled: true,
    };
    setLinks((prev) => [...prev, newLink]);
    toast({
      title: "Link Added",
      description: `"${data.title}" has been added to your list.`,
    });
    setDialogOpen(null);
  };

  const handleUpdateLink = (
    id: string,
    data: z.infer<typeof addEditLinkSchema>
  ) => {
    setLinks((prev) =>
      prev.map((link) =>
        link.id === id ? { ...link, ...data } : link
      )
    );
    toast({
      title: "Link Updated",
      description: `"${data.title}" has been updated.`,
    });
    setDialogOpen(null);
    setEditingLink(null);
  };

  const handleDeleteLink = (id: string) => {
    const linkToDelete = links.find(l => l.id === id);
    if (linkToDelete) {
        setLinks((prev) => prev.filter((link) => link.id !== id));
        toast({
            title: "Link Removed",
            description: `"${linkToDelete.title}" has been removed.`,
            variant: "destructive",
        });
    }
  };

  const toggleLinkEnabled = (id: string) => {
    setLinks((prev) =>
      prev.map((link) =>
        link.id === id ? { ...link, enabled: !link.enabled } : link
      )
    );
  };

  const openEditDialog = (link: LinkItem) => {
    setEditingLink(link);
    setDialogOpen("edit");
  };

  const stopLoop = (reason: "manual" | "finished" | "error") => {
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
    }
    setIsRunning(false);
    setIsPaused(false);
    setCurrentUrl("about:blank");
    setActiveLink(null);
    iterationCountRef.current = 0;
    currentLinkIndexRef.current = -1;
    singleLoopLinkIdRef.current = null;
    
    if (reason === "manual") addLog({ eventType: "STOP", message: "Loop stopped by user." });
    if (reason === "finished") addLog({ eventType: "FINISH", message: "All loop cycles completed." });
    if (reason === "error") addLog({ eventType: "ERROR", message: "Loop stopped due to an error." });

  };

  const startLoop = (singleLinkId: string | null = null) => {
    if (links.filter(l => l.enabled).length === 0) {
        toast({ title: "No enabled links", description: "Please add and enable at least one link to start.", variant: "destructive" });
        return;
    }
    setIsRunning(true);
    setIsPaused(false);
    iterationCountRef.current = 0;
    currentLinkIndexRef.current = -1;
    singleLoopLinkIdRef.current = singleLinkId;

    if(settings.mode === CycleMode.SINGLE && singleLinkId){
      const link = links.find(l => l.id === singleLinkId);
      addLog({ eventType: "START", message: `Single link loop started for "${link?.title}".` });
    } else {
      addLog({ eventType: "START", message: `Loop started in ${settings.mode} mode.` });
    }
  };

  const pauseLoop = () => {
    if (!isRunning || isPaused) return;
    setIsPaused(true);
    if (loopTimeoutRef.current) {
        clearTimeout(loopTimeoutRef.current);
    }
    addLog({ eventType: "PAUSE", message: "Loop paused." });
  };

  const resumeLoop = () => {
    if (!isRunning || !isPaused) return;
    setIsPaused(false);
    addLog({ eventType: "RESUME", message: "Loop resumed." });
  };
  
  React.useEffect(() => {
    if (!isRunning || isPaused) {
        return;
    }

    const runCycle = () => {
        const enabledLinks = links.filter(l => l.enabled);
        if(enabledLinks.length === 0){
            stopLoop("finished");
            return;
        }

        if (iterationCountRef.current >= settings.maxTotalIterations) {
            addLog({ eventType: "FINISH", message: `Max total iterations (${settings.maxTotalIterations}) reached.` });
            stopLoop("finished");
            return;
        }

        let nextLink: LinkItem | undefined;

        if (settings.mode === CycleMode.SINGLE) {
            if (singleLoopLinkIdRef.current) {
                nextLink = enabledLinks.find(l => l.id === singleLoopLinkIdRef.current);
            }
            if (!nextLink) { // Fallback if specified link is disabled or not found
                currentLinkIndexRef.current = (currentLinkIndexRef.current + 1) % enabledLinks.length;
                nextLink = enabledLinks[currentLinkIndexRef.current];
            }
        } else if (settings.mode === CycleMode.RANDOM) {
            const randomIndex = Math.floor(Math.random() * enabledLinks.length);
            currentLinkIndexRef.current = randomIndex;
            nextLink = enabledLinks[randomIndex];
        } else { // SEQUENTIAL
            currentLinkIndexRef.current = (currentLinkIndexRef.current + 1) % enabledLinks.length;
            nextLink = enabledLinks[currentLinkIndexRef.current];
        }
        
        if (!nextLink) {
            stopLoop("error");
            addLog({ eventType: "ERROR", message: "Could not determine next link." });
            return;
        }

        const linkIterations = nextLink.iterations;
        if (linkIterations > 0) {
            const completedCyclesForLink = Math.floor(iterationCountRef.current / enabledLinks.length);
            if (completedCyclesForLink >= linkIterations) {
                // For simplicity, we just stop. A more complex logic could skip this link.
                addLog({eventType: 'FINISH', message: `Max iterations for "${nextLink.title}" reached.`});
                stopLoop("finished");
                return;
            }
        }

        iterationCountRef.current++;
        setCurrentUrl(nextLink.url);
        setActiveLink(nextLink);
        addLog({ eventType: "LOAD", message: `Loading: ${nextLink.title} (${nextLink.url})` });
        
        const interval = (settings.globalInterval > 0 ? settings.globalInterval : nextLink.intervalSec) * 1000;
        
        loopTimeoutRef.current = setTimeout(runCycle, interval);
    };

    loopTimeoutRef.current = setTimeout(runCycle, 100);

    return () => {
        if (loopTimeoutRef.current) {
            clearTimeout(loopTimeoutRef.current);
        }
    };
}, [isRunning, isPaused, links, settings]);


  const LinkCard = ({ link }: { link: LinkItem }) => (
    <Card className={cn("transition-all", !link.enabled && "opacity-50 bg-muted/50")}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="flex-1">
          <CardTitle className="text-lg font-headline">{link.title}</CardTitle>
          <CardDescription className="truncate w-48" title={link.url}>{link.url}</CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => toggleLinkEnabled(link.id)}>
                <Power className={cn("size-4", link.enabled ? "text-green-500" : "text-destructive")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{link.enabled ? 'Disable' : 'Enable'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => openEditDialog(link)}>
                <Pencil className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit Link</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => handleDeleteLink(link.id)}>
                <Trash2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete Link</TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <Badge variant="secondary">Interval: {link.intervalSec}s</Badge>
          <Badge variant="secondary">Repeats: {link.iterations === 0 ? "∞" : link.iterations}</Badge>
        </div>
        {settings.mode === CycleMode.SINGLE && 
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={() => startLoop(link.id)} disabled={isRunning}>
                <Repeat1 className="mr-2 size-4" />
                Loop This
              </Button>
            </TooltipTrigger>
            <TooltipContent>Start a single loop with this link</TooltipContent>
          </Tooltip>
        }
      </CardContent>
    </Card>
  );

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="min-h-screen">
          <Sidebar>
            <SidebarHeader className="p-4">
              <div className="flex items-center gap-3">
                <AppLogo className="size-8 text-primary" />
                <h1 className="text-2xl font-bold font-headline">ClickLoop</h1>
              </div>
            </SidebarHeader>

            <SidebarContent className="p-0">
              <div className="p-4">
                <Button className="w-full" onClick={() => setDialogOpen("add")}>
                  <Plus className="mr-2 size-4" />
                  Add New Link
                </Button>
              </div>
              <SidebarSeparator />
              <ScrollArea className="h-[calc(100vh-250px)]">
                <div className="flex flex-col gap-3 p-4">
                  {isClient && links.map(link => <LinkCard key={link.id} link={link} />)}
                </div>
              </ScrollArea>
            </SidebarContent>

            <SidebarSeparator />
            
            <SidebarFooter className="p-4 gap-4">
              {isRunning && activeLink && (
                  <div className="p-3 rounded-lg bg-accent/50 text-accent-foreground text-sm">
                      <p className="font-bold truncate">{activeLink.title}</p>
                      <p className="text-xs text-muted-foreground">
                          Total Iterations: {iterationCountRef.current} / {settings.maxTotalIterations}
                      </p>
                  </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                {!isRunning ? (
                    <Button className="col-span-3" onClick={() => startLoop()} disabled={links.filter(l => l.enabled).length === 0}>
                        <Play className="mr-2"/> Start {settings.mode === CycleMode.RANDOM ? "Random" : "Sequential"} Loop
                    </Button>
                ) : (
                    <>
                        <Button variant="secondary" onClick={isPaused ? resumeLoop : pauseLoop}>
                            {isPaused ? <Play className="mr-2"/> : <Pause className="mr-2"/>}
                            {isPaused ? "Resume" : "Pause"}
                        </Button>
                        <Button variant="destructive" className="col-span-2" onClick={() => stopLoop("manual")}>
                            <X className="mr-2"/> Stop Loop
                        </Button>
                    </>
                )}
              </div>
            </SidebarFooter>
          </Sidebar>

          <SidebarInset>
            <div className="flex flex-col h-screen">
                <header className="flex items-center justify-end p-4 gap-2 border-b">
                    <Button variant="outline" size="icon" onClick={() => setDialogOpen("ai")}>
                        <Sparkles />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setDialogOpen("logs")}>
                        <History />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setDialogOpen("settings")}>
                        <Cog />
                    </Button>
                </header>
                <main className="flex-1 bg-muted/20 relative">
                    {isClient && links.length > 0 ? (
                        <iframe
                            key={currentUrl}
                            src={currentUrl}
                            className="w-full h-full border-0"
                            title="ClickLoop Target"
                            sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-presentation"
                        ></iframe>
                    ) : isClient && (
                      <div className="flex flex-col items-center justify-center h-full text-center p-8">
                        <div className="relative w-full max-w-lg aspect-video mb-8">
                            <Image 
                                src={emptyStateImage.imageUrl} 
                                alt={emptyStateImage.description} 
                                fill
                                className="object-cover rounded-lg"
                                data-ai-hint={emptyStateImage.imageHint}
                            />
                        </div>
                        <h2 className="text-3xl font-bold font-headline mb-2">Welcome to ClickLoop</h2>
                        <p className="max-w-md text-muted-foreground mb-6">Start by adding your first link, or use our AI assistant to suggest content for your loops.</p>
                        <div className="flex gap-4">
                            <Button onClick={() => setDialogOpen("add")}>
                                <Plus className="mr-2 size-4" /> Add Link
                            </Button>
                            <Button variant="outline" onClick={() => setDialogOpen("ai")}>
                                <Sparkles className="mr-2 size-4" /> AI Suggestions
                            </Button>
                        </div>
                      </div>
                    )}
                    {isRunning && !activeLink && <div className="absolute inset-0 bg-background/80 flex items-center justify-center"><p>Preparing loop...</p></div>}
                </main>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>

      <AddEditLinkDialog
        isOpen={dialogOpen === "add" || dialogOpen === "edit"}
        onClose={() => {
          setDialogOpen(null);
          setEditingLink(null);
        }}
        onSubmit={dialogOpen === "add" ? handleAddLink : (data) => handleUpdateLink(editingLink!.id, data)}
        link={editingLink}
      />
      <AiSuggesterDialog 
        isOpen={dialogOpen === "ai"}
        onClose={() => setDialogOpen(null)}
        onAddLink={(url) => {
            setDialogOpen('add');
            setEditingLink({
                id: '',
                title: '',
                url: url,
                intervalSec: 5,
                iterations: 0,
                enabled: true
            });
        }}
      />
      <SettingsSheet 
        isOpen={dialogOpen === "settings"}
        onClose={() => setDialogOpen(null)}
        settings={settings}
        onSettingsChange={setSettings}
      />
      <LogViewerSheet 
        isOpen={dialogOpen === "logs"}
        onClose={() => setDialogOpen(null)}
        logs={logs}
        onClearLogs={() => setLogs([])}
      />
    </TooltipProvider>
  );
}
