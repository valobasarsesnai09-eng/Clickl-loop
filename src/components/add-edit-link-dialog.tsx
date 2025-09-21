
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import * as React from "react";

import { addEditLinkSchema } from "@/lib/schemas";
import type { LinkItem } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type AddEditLinkDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: z.infer<typeof addEditLinkSchema>) => void;
  link: LinkItem | null;
};

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


export function AddEditLinkDialog({ isOpen, onClose, onSubmit, link }: AddEditLinkDialogProps) {
  const form = useForm<z.infer<typeof addEditLinkSchema>>({
    resolver: zodResolver(addEditLinkSchema),
    defaultValues: {
      title: "",
      url: "",
      intervalSec: 5,
      iterations: 0,
    },
  });
  const { toast } = useToast();

  React.useEffect(() => {
    if (isOpen) {
        if (link) {
            form.reset(link);
        } else {
            form.reset({
                title: "",
                url: "",
                intervalSec: 5,
                iterations: 0,
            });
        }
    }
  }, [link, form, isOpen]);

  const handleFormSubmit = (data: z.infer<typeof addEditLinkSchema>) => {
    onSubmit(data);
    form.reset();
  };

  const handleUrlBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const url = e.target.value;
    const currentTitle = form.getValues('title');
    if (url && !currentTitle) {
      try {
        const title = await getUrlTitle(url);
        if (title) {
          form.setValue('title', title, { shouldValidate: true });
          toast({ title: "শিরোনাম প্রস্তাব করা হয়েছে", description: "আমরা URL এর উপর ভিত্তি করে একটি শিরোনাম প্রস্তাব করেছি।" });
        }
      } catch (error) {
         // Silently fail, user can enter title manually
      }
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{link ? "লিঙ্ক সম্পাদনা করুন" : "নতুন লিঙ্ক যোগ করুন"}</DialogTitle>
          <DialogDescription>
            {link ? "আপনার লিঙ্কের বিবরণ আপডেট করুন।" : "আপনার নতুন লিঙ্কের জন্য বিবরণ পূরণ করুন। আমরা আপনার জন্য শিরোনাম আনার চেষ্টা করব।"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com" {...field} onBlur={handleUrlBlur}/>
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
                      <Input type="number" min="1" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))} />
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
                      <Input type="number" min="0" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                বাতিল করুন
              </Button>
              <Button type="submit">{link ? "পরিবর্তন সংরক্ষণ করুন" : "লিঙ্ক যোগ করুন"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    