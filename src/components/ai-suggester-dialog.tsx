"use client";

import { suggestClickLoopContent } from "@/ai/flows/suggest-click-loop-content";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

type AiSuggesterDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onAddLink: (url: string) => void;
};

export function AiSuggesterDialog({ isOpen, onClose, onAddLink }: AiSuggesterDialogProps) {
  const [topic, setTopic] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const { toast } = useToast();
  const router = useRouter();

  const handleSuggest = async () => {
    if (!topic) {
      toast({
        title: "Topic Required",
        description: "Please enter a topic to get suggestions.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    setSuggestions([]);
    try {
      const result = await suggestClickLoopContent({ topic });
      setSuggestions(result.suggestedUrls);
    } catch (error) {
      console.error(error);
      toast({
        title: "AI Suggestion Failed",
        description: "Could not fetch suggestions. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAddClick = (url: string) => {
    router.push(`/add-link?url=${encodeURIComponent(url)}`);
    onClose();
  }

  React.useEffect(() => {
    if (isOpen) {
      setTopic('');
      setSuggestions([]);
      setIsLoading(false);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="text-primary" />
            AI Content Suggester
          </DialogTitle>
          <DialogDescription>
            Enter a topic and let our AI find relevant URLs for your loop.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="topic">Topic</Label>
            <div className="flex gap-2">
              <Input
                id="topic"
                placeholder="e.g., 'Latest tech news'"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSuggest()}
              />
              <Button onClick={handleSuggest} disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
              </Button>
            </div>
          </div>

          {suggestions.length > 0 && (
            <div className="space-y-2">
              <Label>Suggestions</Label>
              <ScrollArea className="h-48 rounded-md border p-2">
                <div className="space-y-2">
                  {suggestions.map((url, index) => (
                    <div key={index} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50">
                      <p className="text-sm truncate flex-1" title={url}>{url}</p>
                      <Button size="sm" variant="outline" onClick={() => handleAddClick(url)}>
                        <Plus className="mr-1 size-4" /> Add
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {isLoading && (
             <div className="flex items-center justify-center h-48 rounded-md border border-dashed">
                <p className="text-muted-foreground">AI is thinking...</p>
             </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
