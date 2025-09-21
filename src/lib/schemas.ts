import { z } from 'zod';

export const addEditLinkSchema = z.object({
  title: z.string().min(1, 'শিরোনাম আবশ্যক।'),
  url: z.string().url('অনুগ্রহ করে একটি বৈধ URL লিখুন।'),
  intervalSec: z.coerce.number().int().min(1, 'বিরতি কমপক্ষে ১ সেকেন্ড হতে হবে।'),
  iterations: z.coerce.number().int().min(0, 'পুনরাবৃত্তি অবশ্যই ০ বা তার বেশি হতে হবে (০ অসীমের জন্য)।'),
});
