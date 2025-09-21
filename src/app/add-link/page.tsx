
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

import { addEditLinkSchema } from "@/lib/schemas";
import type { LinkItem } from "@/types";
import { Button } from "@/components/ui/button";
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
import useLocalStorage from "@/hooks/use-local-storage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";


async function getUrlTitle(url: string): Promise<string> {
    try {
        const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
        const data = await response.json();
        const text = data.contents;
        if (!text) return '';
        const matches = text.match(/<title>(.*?)<\/title>/);
        return matches ? matches[1] : '';
    } catch (error) {
        console.error("Failed to fetch URL title:", error);
        return '';
    }
}


export default function AddLinkPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [links, setLinks] = useLocalStorage<LinkItem[]>("clickloop-links", []);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof addEditLinkSchema>>({
    resolver: zodResolver(addEditLinkSchema),
    defaultValues: {
      title: "",
      url: searchParams.get('url') || "",
      intervalSec: 5,
      iterations: 0,
    },
  });

  const handleFormSubmit = (data: z.infer<typeof addEditLinkSchema>) => {
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
    router.push('/');
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
         // Silently fail
      }
    }
  };

  React.useEffect(() => {
    const url = searchParams.get('url');
    const title = form.getValues('title');
    if (url && !title) {
      const fetchTitle = async () => {
        try {
          const fetchedTitle = await getUrlTitle(url);
          if (fetchedTitle) {
            form.setValue('title', fetchedTitle, { shouldValidate: true });
            toast({ title: "শিরোনাম প্রস্তাব করা হয়েছে", description: "আমরা URL এর উপর ভিত্তি করে একটি শিরোনাম প্রস্তাব করেছি।" });
          }
        } catch (error) {
          // Silently fail
        }
      };
      fetchTitle();
    }
  }, [searchParams, form, toast]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-lg">
            <CardHeader>
                <CardTitle>নতুন লিঙ্ক যোগ করুন</CardTitle>
                <CardDescription>
                আপনার নতুন লিঙ্কের জন্য বিবরণ পূরণ করুন। আমরা আপনার জন্য শিরোনাম আনার চেষ্টা করব।
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
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
                            <Input type="number" min="1" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} />
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
                            <Input type="number" min="0" {...field} onChange={e => field.onChange(e.target.valueAsNumber)}/>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    </div>
                    <div className="flex justify-between pt-4">
                    <Button type="button" variant="ghost" onClick={() => router.push('/')}>
                        <ArrowLeft className="mr-2 size-4" />
                        বাতিল করুন
                    </Button>
                    <Button type="submit">লিঙ্ক যোগ করুন</Button>
                    </div>
                </form>
                </Form>
            </CardContent>
        </Card>
    </div>
  );
}

    