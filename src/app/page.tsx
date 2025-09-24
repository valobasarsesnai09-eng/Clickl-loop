
"use client";

import { PlaceHolderImages } from "@/lib/placeholder-images";
import type { LinkItem, AppSettings, LogEntry } from "@/types";
import { CycleMode } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import * as React from "react";
import { useForm } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import type { z } from "zod";

import { useToast } from "@/hooks/use-toast";
import useLocalStorage from "@/hooks/use-local-storage";
import { AddEditLinkDialog } from "@/components/add-edit-link-dialog";
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
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
  } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  Pause,
  Pencil,
  Play,
  Plus,
  Power,
  Trash2,
  X,
  Repeat1,
  Loader2,
  Timer,
  Repeat,
  AppWindow,
  Sparkles,
} from "lucide-react";
import { addEditLinkSchema } from "@/lib/schemas";
import { suggestClickLoopContent } from "@/ai/flows/suggest-click-loop-content";


const emptyStateImage = PlaceHolderImages.find(
  (img) => img.id === "empty-state"
)!;

async function getUrlTitle(url: string): Promise<string> {
    try {
        const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
        const textResponse = await response.text();
        if (!textResponse) return '';
        
        let data;
        try {
            data = JSON.parse(textResponse);
        } catch (e) {
            console.error("Failed to parse JSON from allorigins.win", e);
            return '';
        }

        const text = data.contents;
        if (!text) return '';
        const matches = text.match(/<title>(.*?)<\/title>/);
        return matches ? matches[1] : '';
    } catch (error) {
        console.error("Failed to fetch URL title:", error);
        return '';
    }
}


export default function ClickLoopPage() {
  const [links, setLinks] = useLocalStorage<LinkItem[]>("clickloop-links", []);
  const [settings, setSettings] = useLocalStorage<AppSettings>(
    "clickloop-settings",
    {
      mode: CycleMode.SEQUENTIAL,
      globalInterval: 0,
      maxTotalIterations: 1000,
    }
  );
  const [logs, setLogs] = useLocalStorage<LogEntry[]>("clickloop-logs", []);

  const [isRunning, setIsRunning] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const [activeLink, setActiveLink] = React.useState<LinkItem | null>(null);
  const [linkVisitCount, setLinkVisitCount] = React.useState<Record<string, number>>({});


  const [isClient, setIsClient] = React.useState(false);
  React.useEffect(() => setIsClient(true), []);

  const [dialogOpen, setDialogOpen] = React.useState<
    "edit" | "settings" | "logs" | null
  >(null);
  const [editingLink, setEditingLink] = React.useState<LinkItem | null>(null);
  const [isSuggesting, setIsSuggesting] = React.useState(false);

  // --- Core Loop Logic Refs ---
  const loopTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const popupWindowRef = React.useRef<Window | null>(null);
  const loopStateRef = React.useRef({
      isRunning: false,
      isPaused: false,
      currentLinkIndex: -1,
      iterationCount: 0,
      singleLoopLinkId: null as string | null,
      links: [] as LinkItem[],
      settings: {} as AppSettings,
      linkVisitCount: {} as Record<string, number>
  });
  // Keep the ref updated with the latest state
  React.useEffect(() => {
    loopStateRef.current = {
        isRunning,
        isPaused,
        links,
        settings,
        linkVisitCount,
        // Persist these across state updates
        currentLinkIndex: loopStateRef.current.currentLinkIndex,
        iterationCount: loopStateRef.current.iterationCount,
        singleLoopLinkId: loopStateRef.current.singleLoopLinkId
    };
  }, [isRunning, isPaused, links, settings, linkVisitCount]);
  // ---------------------------

  const { toast } = useToast();

  const form = useForm<z.infer<typeof addEditLinkSchema>>({
    resolver: zodResolver(addEditLinkSchema),
    defaultValues: {
      title: "",
      url: "",
      intervalSec: 5,
      iterations: 0,
    },
  });

  const addLog = React.useCallback((entry: Omit<LogEntry, "timestamp">) => {
    setLogs((prev) => {
      const newLogs = [{ ...entry, timestamp: Date.now() }, ...prev];
      if (newLogs.length > 200) {
        return newLogs.slice(0, 200);
      }
      return newLogs;
    });
  }, [setLogs]);

    const stopLoop = React.useCallback((reason: "manual" | "finished" | "error") => {
        if (loopTimeoutRef.current) {
            clearTimeout(loopTimeoutRef.current);
            loopTimeoutRef.current = null;
        }
        if (popupWindowRef.current && !popupWindowRef.current.closed) {
            popupWindowRef.current.close();
            popupWindowRef.current = null;
        }

        const wasRunning = loopStateRef.current.isRunning;

        // Update ref state
        loopStateRef.current.isRunning = false;
        loopStateRef.current.isPaused = false;
        loopStateRef.current.currentLinkIndex = -1;
        loopStateRef.current.iterationCount = 0;
        loopStateRef.current.singleLoopLinkId = null;
        // Don't reset visit count on stop, so user can see the final tally

        // Update React state for UI
        setIsRunning(false);
        setIsPaused(false);
        setActiveLink(null);
        // Reset visit count for next run
        setLinkVisitCount({});

        if(wasRunning){
            if (reason === "manual") addLog({ eventType: "STOP", message: "ব্যবহারকারী লুপ বন্ধ করেছেন।" });
            if (reason === "finished") addLog({ eventType: "FINISH", message: "সমস্ত লুপ চক্র সম্পন্ন হয়েছে।" });
            if (reason === "error") addLog({ eventType: "ERROR", message: "ত্রুটির কারণে লুপ বন্ধ হয়ে গেছে।" });
        }
  }, [addLog]);


  const runCycle = React.useCallback(() => {
    // Use the ref for the most current state to avoid stale closures
    const state = loopStateRef.current;
    if (!state.isRunning || state.isPaused) {
        return;
    }
  
    const getNextLink = (): LinkItem | null => {
      let availableLinks = state.links.filter(l => l.enabled);
  
      if (availableLinks.length === 0) return null;

      if (state.singleLoopLinkId) {
        const singleLink = availableLinks.find(l => l.id === state.singleLoopLinkId);
        if(!singleLink) return null;
        if (singleLink.iterations > 0 && (state.linkVisitCount[singleLink.id] || 0) >= singleLink.iterations) return null;
        return singleLink;
      }
      
      if (state.settings.maxTotalIterations > 0 && state.iterationCount >= state.settings.maxTotalIterations) {
        return null; // Will be handled by the caller
      }

      // Filter out links that have completed their iterations
      const incompleteLinks = availableLinks.filter(l => {
        if (l.iterations === 0) return true;
        const visitedCount = state.linkVisitCount[l.id] || 0;
        return visitedCount < l.iterations;
      });

      if (incompleteLinks.length === 0) return null;
  
      let nextLink: LinkItem | undefined;
      let nextIndex = state.currentLinkIndex;

      if (state.settings.mode === CycleMode.RANDOM) {
        const randomIndex = Math.floor(Math.random() * incompleteLinks.length);
        nextLink = incompleteLinks[randomIndex];
        // Find the index in the original links array for consistency
        nextIndex = state.links.findIndex(l => l.id === nextLink?.id);

      } else { // SEQUENTIAL
        // Start searching from the next index
        for (let i = 1; i <= state.links.length; i++) {
            const potentialIndex = (state.currentLinkIndex + i) % state.links.length;
            const potentialLink = state.links[potentialIndex];
            if (incompleteLinks.some(l => l.id === potentialLink.id)) {
                nextLink = potentialLink;
                nextIndex = potentialIndex;
                break;
            }
        }
      }

      if (nextLink) {
        loopStateRef.current.currentLinkIndex = nextIndex;
      }
      
      return nextLink || null;
    }
  
    const nextLink = getNextLink();
  
    if (!nextLink) {
        stopLoop(loopStateRef.current.settings.maxTotalIterations > 0 && loopStateRef.current.iterationCount >= loopStateRef.current.settings.maxTotalIterations ? "finished" : "finished");
        return;
    }
    
    // Update iteration counts in ref
    loopStateRef.current.iterationCount++;
    const newVisitCount = (loopStateRef.current.linkVisitCount[nextLink.id] || 0) + 1;
    loopStateRef.current.linkVisitCount[nextLink.id] = newVisitCount;
  
    // Update React state for UI rendering
    setLinkVisitCount(prev => ({...prev, [nextLink.id]: newVisitCount}));
    setActiveLink(nextLink);
    addLog({ eventType: "LOAD", message: `লোড হচ্ছে: ${nextLink.title} (${nextLink.url}) - ভিজিট: ${newVisitCount}${nextLink.iterations > 0 ? '/' + nextLink.iterations : ''}` });
  
    // Close previous window and open new one
    if (popupWindowRef.current && !popupWindowRef.current.closed) {
        popupWindowRef.current.close();
    }
    popupWindowRef.current = window.open(nextLink.url, "_blank", "width=800,height=600");


    const interval = (state.settings.globalInterval > 0 ? state.settings.globalInterval : nextLink.intervalSec) * 1000;
    
    loopTimeoutRef.current = setTimeout(runCycle, interval > 100 ? interval : 100);
  
  }, [addLog, stopLoop]);
  
  const startLoop = (singleLinkId: string | null = null) => {
    const linksToRun = links.filter(l => l.enabled);
    if (linksToRun.length === 0) {
        toast({ title: "কোনো সক্রিয় লিঙ্ক নেই", description: "শুরু করতে অনুগ্রহ করে অন্তত একটি লিঙ্ক যোগ এবং সক্রিয় করুন।", variant: "destructive" });
        return;
    }
     if (singleLinkId && !linksToRun.some(l => l.id === singleLinkId)) {
        toast({ title: "লিঙ্কটি সক্রিয় নয়", description: "এই লিঙ্কটি চালানোর জন্য অনুগ্রহ করে প্রথমে এটি সক্রিয় করুন।", variant: "destructive" });
        return;
    }
    
    // Clear any existing loop
    if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);

    // Reset state for a fresh start via the ref
    loopStateRef.current.iterationCount = 0;
    loopStateRef.current.currentLinkIndex = -1;
    loopStateRef.current.singleLoopLinkId = singleLinkId;
    loopStateRef.current.linkVisitCount = {};
    loopStateRef.current.isRunning = true;
    loopStateRef.current.isPaused = false;
    
    // Update React state for UI
    setLinkVisitCount({});
    setActiveLink(null);
    setIsPaused(false);
    setIsRunning(true);
    
    if(singleLinkId){
      const link = links.find(l => l.id === singleLinkId);
      addLog({ eventType: "START", message: `"${link?.title}" এর জন্য একক লিঙ্ক লুপ শুরু হয়েছে।` });
    } else {
      addLog({ eventType: "START", message: `${settings.mode} মোডে লুপ শুরু হয়েছে।` });
    }
    
    // Defer the first runCycle call to allow state to update
    loopTimeoutRef.current = setTimeout(runCycle, 50);
  };

  const pauseLoop = () => {
    if (!loopStateRef.current.isRunning || loopStateRef.current.isPaused) return;
    
    if (loopTimeoutRef.current) {
        clearTimeout(loopTimeoutRef.current);
        loopTimeoutRef.current = null;
    }
     if (popupWindowRef.current) {
        popupWindowRef.current.close();
        popupWindowRef.current = null;
    }
    
    loopStateRef.current.isPaused = true;
    setIsPaused(true);
    
    addLog({ eventType: "PAUSE", message: "লুপ সাময়িকভাবে বন্ধ হয়েছে।" });
  };

  const resumeLoop = () => {
    if (!loopStateRef.current.isRunning || !loopStateRef.current.isPaused) return;
    
    loopStateRef.current.isPaused = false;
    setIsPaused(false);
    
    addLog({ eventType: "RESUME", message: "লুপ আবার শুরু হয়েছে।" });
    
    // The loop will resume on the next timeout
    runCycle();
  };
  
  React.useEffect(() => {
    // Cleanup on unmount
    return () => {
       stopLoop("manual");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    form.reset();
  };

  const handleUrlBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const url = e.target.value;
    const currentTitle = form.getValues('title');
    if (url && !currentTitle) {
      try {
        form.setValue('title', 'শিরোনাম আনা হচ্ছে...', { shouldValidate: false });
        const title = await getUrlTitle(url);
        if (title) {
          form.setValue('title', title, { shouldValidate: true });
          toast({ title: "শিরোনাম প্রস্তাব করা হয়েছে", description: "আমরা URL এর উপর ভিত্তি করে একটি শিরোনাম প্রস্তাব করেছি।" });
        } else {
          form.setValue('title', '', { shouldValidate: false });
        }
      } catch (error) {
         form.setValue('title', '', { shouldValidate: false });
      }
    }
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

  const handleSuggestLinks = async () => {
    const urlFieldValue = form.getValues("url");
    if (!urlFieldValue) {
      toast({
        title: "একটি বিষয় প্রয়োজন",
        description: "অনুগ্রহ করে URL ফিল্ডে একটি বিষয় বা টপিক লিখুন।",
        variant: "destructive",
      });
      return;
    }
    setIsSuggesting(true);
    try {
      const result = await suggestClickLoopContent({ topic: urlFieldValue });
      if (result.suggestedUrls && result.suggestedUrls.length > 0) {
        const suggestedUrl = result.suggestedUrls[0];
        form.setValue("url", suggestedUrl, { shouldValidate: true });
        toast({
          title: "URL প্রস্তাব করা হয়েছে",
          description: "AI আপনার জন্য একটি URL প্রস্তাব করেছে।",
        });
        // Trigger title fetch
        handleUrlBlur({ target: { value: suggestedUrl } } as React.FocusEvent<HTMLInputElement>);
      } else {
        toast({
          title: "কোনো URL পাওয়া যায়নি",
          description: "AI এই বিষয়ের জন্য কোনো উপযুক্ত URL খুঁজে পায়নি।",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("AI suggestion failed:", error);
      toast({
        title: "একটি ত্রুটি ঘটেছে",
        description: "AI লিঙ্ক প্রস্তাব করতে ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।",
        variant: "destructive",
      });
    } finally {
      setIsSuggesting(false);
    }
  };


  const LinkCard = ({ link }: { link: LinkItem }) => {
    const visits = linkVisitCount[link.id] || 0;
    const isActive = activeLink?.id === link.id;
    const effectiveInterval = settings.globalInterval > 0 ? settings.globalInterval : link.intervalSec;

    return (
        <Card className={cn("transition-all", isActive && "ring-2 ring-primary shadow-lg", !link.enabled && "opacity-50 bg-muted/50")}>
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
          <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                      <Badge variant={isActive ? "default" : "secondary"} className="gap-1.5 pl-2">
                          <Timer className="size-3.5" />
                          বিরতি: {effectiveInterval} সেকেন্ড
                      </Badge>
                      <Badge variant={isActive ? "default" : "secondary"} className="gap-1.5 pl-2">
                          <Repeat className="size-3.5" />
                          পুনরাবৃত্তি: {isRunning ? `${visits} /` : ''} {link.iterations === 0 ? "∞" : link.iterations}
                      </Badge>
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
              </div>
          </CardContent>
        </Card>
      );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {/* Left Column: Controls & Links */}
        <div className="lg:col-span-1 md:col-span-1 bg-card flex flex-col h-screen">
            <header className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AppLogo className="size-8 text-primary" />
                <h1 className="text-2xl font-bold font-headline">ClickLoop</h1>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setDialogOpen("logs")}>
                    <History />
                    <span className="sr-only">লগ দেখুন</span>
                </Button>
                <Button variant="outline" size="icon" onClick={() => setDialogOpen("settings")}>
                    <Cog />
                    <span className="sr-only">সেটিংস</span>
                </Button>
              </div>
            </header>

            <div className="flex-1 flex flex-col min-h-0">
               <Card className="m-4">
                <CardHeader>
                    <CardTitle>নতুন লিঙ্ক যোগ করুন</CardTitle>
                    <CardDescription>আপনার নতুন লিঙ্কের জন্য বিবরণ পূরণ করুন।</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleAddLink)} className="space-y-4">
                            <FormField
                            control={form.control}
                            name="url"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>URL বা বিষয়</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                    <Input placeholder="https://example.com অথবা 'cat videos'" {...field} onBlur={handleUrlBlur}/>
                                     <Tooltip>
                                        <TooltipTrigger asChild>
                                             <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="icon" 
                                                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                                                onClick={handleSuggestLinks}
                                                disabled={isSuggesting}
                                                >
                                                {isSuggesting ? <Loader2 className="animate-spin" /> : <Sparkles />}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>AI দ্বারা লিঙ্ক সাজেস্ট করুন</TooltipContent>
                                    </Tooltip>
                                    </div>
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>শিরোনাম</FormLabel>
                                <FormControl>
                                    <Input placeholder="যেমন, আমার পরীক্ষার পাতা" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="intervalSec"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>বিরতি (সেকেন্ড)</FormLabel>
                                    <FormControl>
                                    <Input type="number" min="1" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseInt(e.target.value, 10))} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="iterations"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>পুনরাবৃত্তি (0=∞)</FormLabel>
                                    <FormControl>
                                    <Input type="number" min="0" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? '' : parseInt(e.target.value, 10))}/>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            </div>
                            <Button type="submit" className="w-full">
                                <Plus className="mr-2 size-4" />
                                লিঙ্ক যোগ করুন
                            </Button>
                        </form>
                    </Form>
                </CardContent>
               </Card>
              <Separator />
              <ScrollArea className="flex-1">
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
            </div>

            <Separator />
            
            <footer className="p-4 gap-4 border-t">
              {isRunning && activeLink && (
                  <div className="p-3 rounded-lg bg-accent text-accent-foreground text-sm mb-4">
                      <p className="font-bold truncate">বর্তমান: {activeLink.title}</p>
                      <p className="text-xs text-muted-foreground">
                          মোট পুনরাবৃত্তি: {loopStateRef.current.iterationCount} / {settings.maxTotalIterations > 0 ? settings.maxTotalIterations : '∞'}
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
            </footer>
        </div>
        
        {/* Right Column: Welcome / Dashboard */}
        <div className="lg:col-span-2 md:col-span-1 flex flex-col h-screen border-l">
            <main className="flex-1 bg-muted/20 relative">
                {isClient && (
                    <>
                        {isRunning && !isPaused ? 
                            <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center gap-4">
                                <Loader2 className="size-8 animate-spin text-primary" />
                                <p className="text-muted-foreground">লুপ চলছে...</p>
                                <p className="text-sm max-w-sm text-center">লিঙ্কগুলো নতুন পপ-আপ উইন্ডোতে খোলা হচ্ছে। অনুগ্রহ করে পপ-আপ ব্লক করা নেই তা নিশ্চিত করুন।</p>
                            </div>
                        :
                          <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-background">
                              <div className="p-6 bg-primary/10 rounded-full mb-6">
                                <AppWindow className="size-12 text-primary" />
                              </div>
                            <h2 className="text-3xl font-bold font-headline mb-2">ClickLoop-এ স্বাগতম</h2>
                            <p className="max-w-md text-muted-foreground">
                                আপনার প্রথম লিঙ্ক যোগ করে শুরু করুন অথবা একটি বিদ্যমান লুপ চালান। লিঙ্কগুলো নতুন উইন্ডোতে খোলা হবে।
                            </p>
                          </div>
                        }
                    </>
                )}
            </main>
        </div>
      </div>

      <AddEditLinkDialog
        isOpen={dialogOpen === "edit"}
        onClose={() => {
          setDialogOpen(null);
          setEditingLink(null);
        }}
        onSubmit={(data) => handleUpdateLink(editingLink!.id, data)}
        link={editingLink}
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
