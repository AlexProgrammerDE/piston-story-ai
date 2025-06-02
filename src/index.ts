import 'dotenv-flow/config'
import {generateObject} from 'ai';
import {groq} from "@ai-sdk/groq";
import inquirer from 'inquirer';
import {z} from 'zod'
import tags from '../data/input/genres.json'
import * as fs from "node:fs";

enum Type {
  ShortStory = 'Short Story',
}

const model= groq('meta-llama/llama-4-maverick-17b-128e-instruct');
const providerOptions = {
    // groq: {reasoningFormat: 'hidden'},
}
async function run() {
  const initialPrompt = await inquirer
      .prompt([
        {
          type: 'input',
          name: 'prompt',
          message: 'Enter a prompt for the AI to generate a story:',
        },
        {
          type: 'confirm',
          name: 'start',
          message: 'Do you want to start the text generation?',
        }
      ])
  if (!initialPrompt.start) {
    console.log('Text generation cancelled.');
    return;
  }

  const prompt = initialPrompt.prompt.trim();
  console.log("Starting the AI text generation script...");
  const result = await generateObject({
    model,
    schema: z.object({
      type: z.nativeEnum(Type)
          .describe('The type of story to write.'),
      genres: z.enum(tags as [string, ...string[]])
          .array()
          .min(1)
          .max(10)
          .describe('Select one or more genres for the story.'),
      themes: z.string()
          .max(100)
          .array()
          .min(1)
          .max(5)
          .describe('Select one or more themes for the story.'),
      extraRequests: z.string()
          .max(500)
          .array()
          .min(0)
          .max(5)
          .describe('Any extra requests or details to include in the story.'),
      userInfo: z.string()
          .max(200)
          .array()
          .min(0)
          .max(3)
          .describe('Any information about the users style of writing, preferences, or other details that can help the AI to write a better story.'),
    }),
    providerOptions,
    maxRetries: 5,
    prompt: `
    You are a helpful writing assistant for writing stories. Use the following prompt to analyze the request by the user on what story to write.
    
    Prompt: ${prompt}
    `
  });

  console.log("Prompt analysis result: ", result.object);
  if (!(await inquirer
      .prompt([
        {
          type: 'confirm',
          name: 'continue',
          message: 'Do you want to continue with story metadata?',
        }
      ])).continue) {
    console.log('Text generation cancelled.');
    return;
  }

  console.log("Continuing with story metadata...");
  const story = await generateObject({
    model,
    schema: z.object({
      characters: z.object({
        name: z.string()
            .max(50)
            .describe('The name of the character.'),
        description: z.string()
            .max(500)
            .describe('A short description of the character.'),
        role: z.string()
            .max(100)
            .describe('The role of the character in the story, e.g. protagonist, antagonist, sidekick, etc.'),
        traits: z.string()
            .max(200)
            .array()
            .min(1)
            .max(5)
            .describe('A list of traits or characteristics of the character.'),
      })
          .array()
          .min(1)
          .max(10)
          .describe('A list of characters in the story.'),
      setting: z.object({
        location: z.string()
            .max(200)
            .describe('The main location or setting of the story.'),
        timePeriod: z.string()
            .max(100)
            .describe('The time period in which the story takes place.'),
        atmosphere: z.string()
            .max(200)
            .describe('The overall atmosphere or mood of the setting, e.g. dark, whimsical, futuristic, etc.'),
      })
          .describe('The setting of the story.'),
    }),
    providerOptions,
    maxRetries: 5,
    prompt: `
        You are a helpful writing assistant for writing stories. Use the following prompt to generate the metadata for the story based on the analysis result.
        
        Prompt: ${prompt}
        Prompt analysis result: ${JSON.stringify(result.object, null, 2)}
        `
  })

  console.log("Story metadata result: ", story.object);
  if (!(await inquirer
      .prompt([
        {
          type: 'confirm',
          name: 'continue',
          message: 'Do you want to continue with the story segments?',
        }
      ])).continue) {
    console.log('Text generation cancelled.');
    return;
  }

  const characterNames = story.object.characters.map(character => character.name);
  console.log("Continuing with story segments...");
  const segments = await generateObject({
    model,
    schema: z.object({
      segments: z.object({
        title: z.string()
            .max(100)
            .describe('The title of the segment.'),
        characters: z.object({
          name: z.enum(characterNames as [string, ...string[]])
              .describe('The name of the character involved in this segment.'),
          mood: z.string()
              .max(100)
              .describe('The mood of the character in this segment, e.g. happy, sad, angry, etc.'),
        })
            .array()
            .min(1)
            .max(5)
            .describe('A list of characters involved in this segment.'),
        setting: z.object({
          location: z.string()
              .max(200)
              .describe('The location where this segment takes place.'),
        })
            .describe('The setting of the segment.'),
        memories: z.string()
            .max(200)
            .array()
            .min(0)
            .max(5)
            .describe('Any ideas or memories that are relevant to this segment.'),
        importance: z.number().int()
            .min(1)
            .max(10)
            .describe('The importance of this segment in the story, on a scale from 1 to 10.'),
        ideas: z.string()
            .max(200)
            .array()
            .describe('A brief description of the segment, including key events or ideas.'),
      })
          .array()
          .min(1)
          .max(10)
          .describe('A list of segments in the story.'),
    }),
    providerOptions,
    maxRetries: 5,
    prompt: `
            You are a helpful writing assistant for writing stories. Use the following prompt to generate the segments for the story based on the metadata.
            
            Prompt: ${prompt}
            Prompt analysis result: ${JSON.stringify(result.object, null, 2)}
            Story metadata result: ${JSON.stringify(story.object, null, 2)}
            `
  });

  console.log("Story segments result: ", segments.object);
  if (!(await inquirer
      .prompt([
        {
          type: 'confirm',
          name: 'continue',
          message: 'Do you want to continue with generating the content for each segment?',
        }
      ])).continue) {
    console.log('Text generation cancelled.');
    return;
  }

  const generatedSegments: string[] = []
  for (const segment of segments.object.segments) {
    console.log(`Segment Title: ${segment.title}`);
    const generatedSegment = await generateObject({
      model,
      schema: z.object({
        content: z.string()
            .array()
            .describe('The generated content for the segment.'),
      }),
      providerOptions,
      maxRetries: 5,
      prompt: `
            You are a helpful writing assistant for writing stories. Use the following prompt to generate the content for the segment.
            
            Prompt: ${prompt}
            Prompt analysis result: ${JSON.stringify(result.object, null, 2)}
            Story metadata result: ${JSON.stringify(story.object, null, 2)}
            Segment Details: ${JSON.stringify(segment, null, 2)}
            
            Write a detailed and engaging segment based on the above information.
            Keep the content in plain text format, without any markdown or HTML tags.
            Keep the content concise and focused on the segment's key events and ideas.
            Do not include any additional information or context.
            The segment should be based on the metadata provided.
            `
    });

    generatedSegments.push(`### ${segment.title}\n\n` +
        generatedSegment.object.content.join('\n\n'));
  }

  fs.writeFileSync('data/output.txt', generatedSegments.join('\n\n'));
  console.log("Text generation completed successfully.");
}

await run()
