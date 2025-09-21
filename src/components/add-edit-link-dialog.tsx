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

type AddEditLinkDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: z.infer<typeof addEditLinkSchema>) => void;
  link: LinkItem | null;
};

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

  React.useEffect(() => {
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
  }, [link, form, isOpen]);

  const handleFormSubmit = (data: z.infer<typeof addEditLinkSchema>) => {
    onSubmit(data);
    form.reset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{link ? "Edit Link" : "Add New Link"}</DialogTitle>
          <DialogDescription>
            {link ? "Update the details of your link." : "Fill in the details for your new link."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., My Test Page" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com" {...field} />
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
                    <FormLabel>Interval (sec)</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} />
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
                    <FormLabel>Repeats (0=∞)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">{link ? "Save Changes" : "Add Link"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
