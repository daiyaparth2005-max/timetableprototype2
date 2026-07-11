import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

type ChatMessage = { role: "user" | "assistant"; content: string };

type Input = {
  messages: ChatMessage[];
  context: {
    timetableName: string;
    days: string[];
    periodNames: string[];
    classes: { id: string; name: string; section?: string }[];
    subjects: { id: string; name: string; shortName: string }[];
    staff: { id: string; name: string; shortName: string; subject: string }[];
    lessons: {
      classId: string;
      subject: string;
      teacher: string;
      frequency: number;
      split: boolean;
    }[];
    preferences: { id: string; text: string }[];
    hasGenerated: boolean;
  };
};

export const chatTimetableAssistant = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => v as Input)
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const sys = `You are an expert school-timetable assistant embedded inside a timetable-builder app. The user is building a weekly class schedule.

You know their current setup (below). Answer briefly, in a warm, helpful tone. When the user states a preference for how the schedule should be arranged (e.g. "put CUET-style courses in the last two periods for grade 12", "keep math in the mornings", "avoid scheduling PE right after lunch"), acknowledge it and end your reply with a JSON block on its own line in this exact form:

<preference>{"text":"the preference in one clean sentence"}</preference>

Only emit that block when the user is stating a NEW scheduling preference. For general questions, suggestions, or explanations, do NOT emit the block.

Never fabricate teacher or subject names. Reference only the ones listed. Keep responses under 6 sentences unless the user asks for detail.

CURRENT TIMETABLE: ${data.context.timetableName}
Days: ${data.context.days.join(", ") || "(none set)"}
Periods: ${data.context.periodNames.join(", ") || "(none set)"}
Classes (${data.context.classes.length}): ${data.context.classes.slice(0, 40).map((c) => `${c.name}${c.section ? ` [${c.section}]` : ""}`).join(", ")}
Subjects: ${data.context.subjects.slice(0, 30).map((s) => s.name).join(", ")}
Staff: ${data.context.staff.slice(0, 40).map((s) => `${s.name} (${s.subject || "?"})`).join(", ")}
Lessons configured: ${data.context.lessons.length}
Existing preferences: ${data.context.preferences.map((p) => p.text).join(" | ") || "(none)"}
Timetable generated: ${data.context.hasGenerated ? "yes" : "no"}`;

    const messages = data.messages.map((m) => ({ role: m.role, content: m.content }));

    const { text } = await generateText({ model, system: sys, messages });
    return { text };
  });
