import { usePortfolioStore } from "../../store/usePortfolioStore.js";
import { Field, TextArea } from "../ui/Field.jsx";
import { StringListManager } from "../ui/StringListManager.jsx";
import { TabShell, SubHeading } from "./TabShell.jsx";

export function TabAbout() {
  const data = usePortfolioStore((s) => s.data.about);
  const update = usePortfolioStore((s) => s.update);
  const set = (key, value) => update(["about", key], value);

  return (
    <TabShell title="About Me" description="Tell visitors who you are beyond the job title.">
      <Field label="Bio" hint="Use blank lines to separate paragraphs.">
        <TextArea rows={7} value={data.bio} onChange={(e) => set("bio", e.target.value)} />
      </Field>

      <SubHeading>Hobbies / Interests</SubHeading>
      <StringListManager items={data.hobbies} onChange={(v) => set("hobbies", v)} placeholder="e.g. Music" />

      <SubHeading>Fun Facts</SubHeading>
      <StringListManager items={data.funFacts} onChange={(v) => set("funFacts", v)} placeholder="e.g. 500+ commits this year" />

      <SubHeading>Philosophy / Values (optional)</SubHeading>
      <Field label="Short statement">
        <TextArea rows={3} value={data.philosophy} onChange={(e) => set("philosophy", e.target.value)} />
      </Field>
    </TabShell>
  );
}
