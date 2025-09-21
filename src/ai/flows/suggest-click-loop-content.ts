// src/ai/flows/suggest-click-loop-content.ts
'use server';
/**
 * @fileOverview An AI agent for suggesting content for click loops.
 *
 * - suggestClickLoopContent - A function that suggests content for click loops.
 * - SuggestClickLoopContentInput - The input type for the suggestClickLoopContent function.
 * - SuggestClickLoopContentOutput - The return type for the suggestClickLoopContent function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestClickLoopContentInputSchema = z.object({
  topic: z
    .string()
    .describe('The topic for which to suggest content.'),
  exampleUrls: z.array(z.string()).optional().describe('A list of example URLs to guide the content suggestions.'),
});
export type SuggestClickLoopContentInput = z.infer<typeof SuggestClickLoopContentInputSchema>;

const SuggestClickLoopContentOutputSchema = z.object({
  suggestedUrls: z.array(z.string()).describe('A list of suggested URLs for the click loop.'),
});
export type SuggestClickLoopContentOutput = z.infer<typeof SuggestClickLoopContentOutputSchema>;

export async function suggestClickLoopContent(input: SuggestClickLoopContentInput): Promise<SuggestClickLoopContentOutput> {
  return suggestClickLoopContentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestClickLoopContentPrompt',
  input: {schema: SuggestClickLoopContentInputSchema},
  output: {schema: SuggestClickLoopContentOutputSchema},
  prompt: `You are an expert content curator for click loops. Your goal is to suggest relevant and engaging content based on a given topic.

Topic: {{{topic}}}

{{#if exampleUrls}}
Here are some example URLs to guide your suggestions:
{{#each exampleUrls}}
- {{{this}}}
{{/each}}
{{/if}}

Please suggest a list of URLs that would be suitable for a click loop on this topic.  Return ONLY a JSON array of strings.
`,
});

const suggestClickLoopContentFlow = ai.defineFlow(
  {
    name: 'suggestClickLoopContentFlow',
    inputSchema: SuggestClickLoopContentInputSchema,
    outputSchema: SuggestClickLoopContentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
