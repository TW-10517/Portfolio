import { usePortfolioStore } from "../../store/usePortfolioStore.js";
import { Field, TextInput, Select } from "../ui/Field.jsx";
import { Toggle } from "../ui/Toggle.jsx";
import { ReorderList } from "../ui/ReorderList.jsx";
import { TabShell, SubHeading } from "./TabShell.jsx";
import { uid } from "../../utils/uid.js";

export function TabContact() {
  const data = usePortfolioStore((s) => s.data.contact);
  const update = usePortfolioStore((s) => s.update);
  const set = (key, value) => update(["contact", key], value);

  return (
    <TabShell title="Contact Settings" description="Control what visitors can see and do on your contact section.">
      <SubHeading>Visible Contact Methods</SubHeading>
      <div className="grid grid-cols-2 gap-3">
        <Toggle checked={data.showEmail} onChange={(v) => set("showEmail", v)} label="Email" />
        <Toggle checked={data.showPhone} onChange={(v) => set("showPhone", v)} label="Phone" />
        <Toggle checked={data.showLocation} onChange={(v) => set("showLocation", v)} label="Location" />
        <Toggle checked={data.showSocial} onChange={(v) => set("showSocial", v)} label="Social Icons" />
      </div>

      <SubHeading>Booking Link (optional)</SubHeading>
      <Field label="Calendly / booking URL">
        <TextInput value={data.calendlyUrl} onChange={(e) => set("calendlyUrl", e.target.value)} placeholder="https://calendly.com/…" />
      </Field>

      <SubHeading>Contact Form</SubHeading>
      <Toggle checked={data.formEnabled} onChange={(v) => set("formEnabled", v)} label="Show contact form on portfolio" />
      {data.formEnabled && (
        <Field label="Submission method">
          <Select value={data.formMethod} onChange={(e) => set("formMethod", e.target.value)}>
            <option value="display">Just display (demo submit, no backend)</option>
            <option value="mailto">Open mailto: link</option>
            <option value="webhook">POST to webhook URL</option>
          </Select>
        </Field>
      )}
      {data.formMethod === "webhook" && data.formEnabled && (
        <Field label="Webhook URL">
          <TextInput value={data.webhookUrl || ""} onChange={(e) => set("webhookUrl", e.target.value)} placeholder="https://…" />
        </Field>
      )}

      <SubHeading>FAQ</SubHeading>
      <ReorderList
        items={data.faqs}
        onReorder={(from, to) => {
          const next = [...data.faqs];
          const [m] = next.splice(from, 1);
          next.splice(to, 0, m);
          set("faqs", next);
        }}
        onRemove={(id) => set("faqs", data.faqs.filter((f) => f.id !== id))}
        onAdd={() => set("faqs", [...data.faqs, { id: uid(), q: "Question?", a: "Answer." }])}
        addLabel="Add FAQ"
        renderItem={(item) => (
          <div className="space-y-2">
            <Field label="Question">
              <TextInput
                value={item.q}
                onChange={(e) => set("faqs", data.faqs.map((f) => (f.id === item.id ? { ...f, q: e.target.value } : f)))}
              />
            </Field>
            <Field label="Answer">
              <TextInput
                value={item.a}
                onChange={(e) => set("faqs", data.faqs.map((f) => (f.id === item.id ? { ...f, a: e.target.value } : f)))}
              />
            </Field>
          </div>
        )}
      />
    </TabShell>
  );
}
