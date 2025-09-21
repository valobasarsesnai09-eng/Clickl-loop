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

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Configure the application behavior to fit your needs.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 py-6">
          <div className="grid gap-3">
            <Label htmlFor="cycle-mode">Cycle Mode</Label>
            <Select
              value={localSettings.mode}
              onValueChange={(value: CycleMode) => handleChange('mode', value)}
            >
              <SelectTrigger id="cycle-mode">
                <SelectValue placeholder="Select a mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CycleMode.SEQUENTIAL}>Sequential</SelectItem>
                <SelectItem value={CycleMode.RANDOM}>Random</SelectItem>
                <SelectItem value={CycleMode.SINGLE}>Single Link</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3">
            <Label htmlFor="global-interval">Global Interval Override (seconds)</Label>
            <Input
              id="global-interval"
              type="number"
              value={localSettings.globalInterval}
              onChange={(e) => handleChange('globalInterval', e.target.valueAsNumber || 0)}
              placeholder="0 to use per-link interval"
            />
             <p className="text-xs text-muted-foreground">Set to 0 to use each link's individual interval setting.</p>
          </div>
          <div className="grid gap-3">
            <Label htmlFor="max-iterations">Max Total Iterations (Safety Limit)</Label>
            <Input
              id="max-iterations"
              type="number"
              value={localSettings.maxTotalIterations}
              onChange={(e) => handleChange('maxTotalIterations', e.target.valueAsNumber || 1000)}
            />
            <p className="text-xs text-muted-foreground">The loop will automatically stop after this many total iterations.</p>
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
