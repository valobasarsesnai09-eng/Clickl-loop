import { z } from 'zod';

export const addEditLinkSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  url: z.string().url('Please enter a valid URL.'),
  intervalSec: z.coerce.number().int().min(1, 'Interval must be at least 1 second.'),
  iterations: z.coerce.number().int().min(0, 'Iterations must be 0 or more (0 for infinite).'),
});
