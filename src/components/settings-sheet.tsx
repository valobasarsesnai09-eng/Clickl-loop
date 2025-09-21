"use client";

import type { AppSettings} from "@/types";
import { CycleMode } from "@/types";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { ArrowLeft } from "lucide-react";

type SettingsSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
};

export function SettingsSheet({ isOpen, onClose, settings, onSettingsChange }: SettingsSheetProps) {
  const [localSettings, setLocalSettings] = React.useState<AppSettings>(settings);

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings, isOpen]);

  const handleSave = () => {
    onSettingsChange(localSettings);
    onClose();
  };

  const handleChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setLocalSettings(prev => ({...prev, [key]: value}));
  }
  
  const handleNumericChange = (key: keyof AppSettings, value: string) => {
    const numValue = value === '' ? 0 : parseInt(value, 10);
    if (!isNaN(numValue)) {
      handleChange(key, numValue as any);
    }
  }


  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>সেটিংস</SheetTitle>
          <SheetDescription>
            আপনার প্রয়োজন অনুযায়ী অ্যাপ্লিকেশনটির আচরণ কনফিগার করুন।
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 py-6">
          <div className="grid gap-3">
            <Label htmlFor="cycle-mode">সাইকেল মোড</Label>
            <Select
              value={localSettings.mode}
              onValueChange={(value: CycleMode) => handleChange('mode', value)}
            >
              <SelectTrigger id="cycle-mode">
                <SelectValue placeholder="একটি মোড নির্বাচন করুন" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CycleMode.SEQUENTIAL}>ক্রমিক</SelectItem>
                <SelectItem value={CycleMode.RANDOM}>এলোমেলো</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">লিঙ্ক কার্ডে "এটি লুপ করুন" বোতামটি সবসময় শুধুমাত্র সেই লিঙ্কের জন্য একটি একক লুপ চালাবে।</p>
          </div>
          <div className="grid gap-3">
            <Label htmlFor="global-interval">গ্লোবাল ইন্টারভাল ওভাররাইড (সেকেন্ড)</Label>
            <Input
              id="global-interval"
              type="number"
              value={localSettings.globalInterval || ''}
              onChange={(e) => handleNumericChange('globalInterval', e.target.value)}
              placeholder="0 ব্যবহার করতে প্রতি-লিঙ্ক বিরতি"
            />
             <p className="text-xs text-muted-foreground">প্রতিটি লিঙ্কের নিজস্ব বিরতি সেটিং ব্যবহার করতে 0 সেট করুন।</p>
          </div>
          <div className="grid gap-3">
            <Label htmlFor="max-iterations">সর্বোচ্চ মোট পুনরাবৃত্তি (সুরক্ষা সীমা)</Label>
            <Input
              id="max-iterations"
              type="number"
              value={localSettings.maxTotalIterations || ''}
              onChange={(e) => handleNumericChange('maxTotalIterations', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">এই মোট পুনরাবৃত্তির পরে লুপটি স্বয়ংক্রিয়ভাবে বন্ধ হয়ে যাবে। কোনো সীমা না চাইলে 0 সেট করুন।</p>
          </div>
        </div>
        <SheetFooter className="sm:justify-between">
          <Button variant="ghost" onClick={onClose}>
            <ArrowLeft className="mr-2" />
            হোমপেজে ফিরে যান
          </Button>
          <Button onClick={handleSave}>পরিবর্তন সংরক্ষণ করুন</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

    