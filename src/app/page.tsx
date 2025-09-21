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
  Loader2,
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
      title: "লিঙ্ক যোগ করা হয়েছে",
      description: `"${data.title}" আপনার তালিকায় যোগ করা হয়েছে।`,
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
      title: "লিঙ্ক আপডেট করা হয়েছে",
      description: `"${data.title}" আপডেট করা হয়েছে।`,
    });
    setDialogOpen(null);
    setEditingLink(null);
  };

  const handleDeleteLink = (id: string) => {
    const linkToDelete = links.find(l => l.id === id);
    if (linkToDelete) {
        setLinks((prev) => prev.filter((link) => link.id !== id));
        toast({
            title: "লিঙ্ক মুছে ফেলা হয়েছে",
            description: `"${linkToDelete.title}" তালিকা থেকে সরানো হয়েছে।`,
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
    setActiveLink(null);
    iterationCountRef.current = 0;
    currentLinkIndexRef.current = -1;
    singleLoopLinkIdRef.current = null;
    
    // Don't reset currentUrl to about:blank immediately, let the user see the last page
    if (reason === "manual") addLog({ eventType: "STOP", message: "ব্যবহারকারী লুপ বন্ধ করেছেন।" });
    if (reason === "finished") addLog({ eventType: "FINISH", message: "সমস্ত লুপ চক্র সম্পন্ন হয়েছে।" });
    if (reason === "error") addLog({ eventType: "ERROR", message: "ত্রুটির কারণে লুপ বন্ধ হয়ে গেছে।" });

  };

  const startLoop = (singleLinkId: string | null = null) => {
    const enabledLinks = links.filter(l => l.enabled);
    if (enabledLinks.length === 0) {
        toast({ title: "কোনো সক্রিয় লিঙ্ক নেই", description: "শুরু করতে অনুগ্রহ করে至少 একটি লিঙ্ক যোগ এবং সক্রিয় করুন।", variant: "destructive" });
        return;
    }
    setIsRunning(true);
    setIsPaused(false);
    iterationCountRef.current = 0;
    
    const relevantLinks = singleLinkId ? enabledLinks.filter(l => l.id === singleLinkId) : enabledLinks;
    const initialIndex = singleLinkId ? -1 : (settings.mode === CycleMode.RANDOM ? Math.floor(Math.random() * relevantLinks.length) -1 : -1) ;
    currentLinkIndexRef.current = initialIndex;

    singleLoopLinkIdRef.current = singleLinkId;
    setCurrentUrl('about:blank');
    setActiveLink(null);

    if(settings.mode === CycleMode.SINGLE && singleLinkId){
      const link = links.find(l => l.id === singleLinkId);
      addLog({ eventType: "START", message: `"${link?.title}" এর জন্য একক লিঙ্ক লুপ শুরু হয়েছে।` });
    } else {
      addLog({ eventType: "START", message: `${settings.mode} মোডে লুপ শুরু হয়েছে।` });
    }
  };

  const pauseLoop = () => {
    if (!isRunning || isPaused) return;
    setIsPaused(true);
    if (loopTimeoutRef.current) {
        clearTimeout(loopTimeoutRef.current);
    }
    addLog({ eventType: "PAUSE", message: "লুপ সাময়িকভাবে বন্ধ হয়েছে।" });
  };

  const resumeLoop = () => {
    if (!isRunning || !isPaused) return;
    setIsPaused(false);
    addLog({ eventType: "RESUME", message: "লুপ আবার শুরু হয়েছে।" });
  };
  
  React.useEffect(() => {
    if (!isRunning || isPaused) {
        return;
    }

    const runCycle = () => {
        let enabledLinks = links.filter(l => l.enabled);
        if(singleLoopLinkIdRef.current) {
            enabledLinks = enabledLinks.filter(l => l.id === singleLoopLinkIdRef.current);
        }

        if(enabledLinks.length === 0){
            addLog({ eventType: "FINISH", message: "চালানোর জন্য কোনো সক্রিয় লিঙ্ক নেই।" });
            stopLoop("finished");
            return;
        }

        if (settings.maxTotalIterations > 0 && iterationCountRef.current >= settings.maxTotalIterations) {
            addLog({ eventType: "FINISH", message: `সর্বোচ্চ পুনরাবৃত্তি (${settings.maxTotalIterations}) সংখ্যায় পৌঁছেছে।` });
            stopLoop("finished");
            return;
        }

        let nextLink: LinkItem | undefined;

        if (settings.mode === CycleMode.RANDOM && !singleLoopLinkIdRef.current) {
            const randomIndex = Math.floor(Math.random() * enabledLinks.length);
            nextLink = enabledLinks[randomIndex];
            currentLinkIndexRef.current = links.findIndex(l => l.id === nextLink?.id);
        } else { // SEQUENTIAL or SINGLE
            currentLinkIndexRef.current = (currentLinkIndexRef.current + 1) % enabledLinks.length;
            nextLink = enabledLinks[currentLinkIndexRef.current];
        }
        
        if (!nextLink) {
            stopLoop("error");
            addLog({ eventType: "ERROR", message: "পরবর্তী লিঙ্ক নির্ধারণ করা যায়নি।" });
            return;
        }
        
        const linkIterations = nextLink.iterations;
        if (linkIterations > 0 && !singleLoopLinkIdRef.current) { // Don't check iterations for single link loops
            const completedCyclesForLink = Math.floor(iterationCountRef.current / enabledLinks.length);
            if (completedCyclesForLink >= linkIterations) {
                // Skip this link if it has reached its iteration count
                addLog({eventType: 'INFO', message: `"${nextLink.title}" এর জন্য সর্বোচ্চ পুনরাবৃত্তি সম্পন্ন হয়েছে। এড়িয়ে যাওয়া হচ্ছে।`});
                runCycle();
                return;
            }
        }

        iterationCountRef.current++;
        setCurrentUrl(nextLink.url);
        setActiveLink(nextLink);
        addLog({ eventType: "LOAD", message: `লোড হচ্ছে: ${nextLink.title} (${nextLink.url})` });
        
        const interval = (settings.globalInterval > 0 ? settings.globalInterval : nextLink.intervalSec) * 1000;
        
        loopTimeoutRef.current = setTimeout(runCycle, interval);
    };

    // Initial delay before starting the first cycle
    const initialDelay = currentUrl === 'about:blank' ? 100 : 0;
    loopTimeoutRef.current = setTimeout(runCycle, initialDelay);

    return () => {
        if (loopTimeoutRef.current) {
            clearTimeout(loopTimeoutRef.current);
        }
    };
}, [isRunning, isPaused, links, settings]);


  const LinkCard = ({ link }: { link: LinkItem }) => (
    <Card className={cn("transition-all", activeLink?.id === link.id && "ring-2 ring-primary", !link.enabled && "opacity-50 bg-muted/50")}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="flex-1 overflow-hidden">
          <CardTitle className="text-lg font-headline truncate">{link.title}</CardTitle>
          <CardDescription className="truncate" title={link.url}>{link.url}</CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => toggleLinkEnabled(link.id)} disabled={isRunning}>
                <Power className={cn("size-4", link.enabled ? "text-green-500" : "text-destructive")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{link.enabled ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => openEditDialog(link)} disabled={isRunning}>
                <Pencil className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>লিঙ্ক সম্পাদনা করুন</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => handleDeleteLink(link.id)} disabled={isRunning}>
                <Trash2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>লিঙ্ক মুছুন</TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <Badge variant="secondary">বিরতি: {link.intervalSec} সেকেন্ড</Badge>
          <Badge variant="secondary">পুনরাবৃত্তি: {link.iterations === 0 ? "∞" : link.iterations}</Badge>
        </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={() => startLoop(link.id)} disabled={isRunning || !link.enabled}>
                <Repeat1 className="mr-2 size-4" />
                এটি লুপ করুন
              </Button>
            </TooltipTrigger>
            <TooltipContent>শুধুমাত্র এই লিঙ্কটি দিয়ে একটি একক লুপ শুরু করুন</TooltipContent>
          </Tooltip>
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
                  নতুন লিঙ্ক যোগ করুন
                </Button>
              </div>
              <SidebarSeparator />
              <ScrollArea className="h-[calc(100vh-250px)]">
                <div className="flex flex-col gap-3 p-4">
                  {isClient && links.length > 0 ? (
                    links.map(link => <LinkCard key={link.id} link={link} />)
                  ) : isClient ? (
                    <div className="text-center text-muted-foreground p-8">
                        <p>এখনও কোন লিঙ্ক নেই।</p>
                        <p className="text-sm">শুরু করতে একটি লিঙ্ক যোগ করুন।</p>
                    </div>
                  ) : null }
                </div>
              </ScrollArea>
            </SidebarContent>

            <SidebarSeparator />
            
            <SidebarFooter className="p-4 gap-4">
              {isRunning && activeLink && (
                  <div className="p-3 rounded-lg bg-accent/50 text-accent-foreground text-sm">
                      <p className="font-bold truncate">বর্তমান: {activeLink.title}</p>
                      <p className="text-xs text-muted-foreground">
                          মোট পুনরাবৃত্তি: {iterationCountRef.current} / {settings.maxTotalIterations > 0 ? settings.maxTotalIterations : '∞'}
                      </p>
                  </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                {!isRunning ? (
                    <Button className="col-span-3" onClick={() => startLoop()} disabled={links.filter(l => l.enabled).length === 0}>
                        <Play className="mr-2"/> শুরু করুন {settings.mode === CycleMode.RANDOM ? "এলোমেলো" : "ক্রমিক"} লুপ
                    </Button>
                ) : (
                    <>
                        <Button variant="secondary" onClick={isPaused ? resumeLoop : pauseLoop}>
                            {isPaused ? <Play className="mr-2"/> : <Pause className="mr-2"/>}
                            {isPaused ? "পুনরায় শুরু" : "বিরতি"}
                        </Button>
                        <Button variant="destructive" className="col-span-2" onClick={() => stopLoop("manual")}>
                            <X className="mr-2"/> লুপ বন্ধ করুন
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
                    {isClient && (links.length > 0 || isRunning) ? (
                        <>
                           {currentUrl !== 'about:blank' &&  
                            <iframe
                                key={currentUrl}
                                src={currentUrl}
                                className="w-full h-full border-0"
                                title="ClickLoop Target"
                                sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-presentation"
                            ></iframe>
                           }
                            {(isRunning && currentUrl === 'about:blank') && 
                                <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center gap-4">
                                    <Loader2 className="size-8 animate-spin text-primary" />
                                    <p className="text-muted-foreground">লুপ প্রস্তুত করা হচ্ছে...</p>
                                </div>
                            }
                        </>
                    ) : isClient ? (
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
                        <h2 className="text-3xl font-bold font-headline mb-2">ClickLoop এ স্বাগতম</h2>
                        <p className="max-w-md text-muted-foreground mb-6">আপনার প্রথম লিঙ্ক যোগ করে শুরু করুন, অথবা আপনার লুপের জন্য বিষয়বস্তু প্রস্তাব করার জন্য আমাদের AI সহকারী ব্যবহার করুন।</p>
                        <div className="flex gap-4">
                            <Button onClick={() => setDialogOpen("add")}>
                                <Plus className="mr-2 size-4" /> লিঙ্ক যোগ করুন
                            </Button>
                            <Button variant="outline" onClick={() => setDialogOpen("ai")}>
                                <Sparkles className="mr-2 size-4" /> AI সাজেশন
                            </Button>
                        </div>
                      </div>
                    ) : null}
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
