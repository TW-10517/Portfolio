import { usePortfolioStore } from "../../store/usePortfolioStore.js";
import { Field, TextInput, TextArea } from "../ui/Field.jsx";
import { TagInput } from "../ui/TagInput.jsx";
import { ImageUpload } from "../ui/ImageUpload.jsx";
import { ReorderList } from "../ui/ReorderList.jsx";
import { TabShell } from "./TabShell.jsx";
import { uid } from "../../utils/uid.js";

export function TabExperience() {
  const items = usePortfolioStore((s) => s.data.experience);
  const addItem = usePortfolioStore((s) => s.addItem);
  const removeItem = usePortfolioStore((s) => s.removeItem);
  const updateItem = usePortfolioStore((s) => s.updateItem);
  const reorderItems = usePortfolioStore((s) => s.reorderItems);

  const blank = () => ({
    id: uid(),
    company: "New Company",
    role: "Role Title",
    duration: "2024 — Present",
    location: "",
    description: "",
    tech: [],
    logo: "",
  });

  return (
    <TabShell title="Experience" description="Drag the ⠿ handle to reorder. Each card expands into a timeline entry on your portfolio.">
      <ReorderList
        items={items}
        onReorder={(from, to) => reorderItems("experience", from, to)}
        onRemove={(id) => removeItem("experience", id)}
        onAdd={() => addItem("experience", blank())}
        addLabel="Add Experience"
        renderItem={(item) => (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Company">
                <TextInput value={item.company} onChange={(e) => updateItem("experience", item.id, { company: e.target.value })} />
              </Field>
              <Field label="Role / Title">
                <TextInput value={item.role} onChange={(e) => updateItem("experience", item.id, { role: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Duration">
                <TextInput value={item.duration} onChange={(e) => updateItem("experience", item.id, { duration: e.target.value })} />
              </Field>
              <Field label="Location">
                <TextInput value={item.location} onChange={(e) => updateItem("experience", item.id, { location: e.target.value })} />
              </Field>
            </div>
            <Field label="Description" hint="One achievement per line.">
              <TextArea rows={3} value={item.description} onChange={(e) => updateItem("experience", item.id, { description: e.target.value })} />
            </Field>
            <Field label="Tech / Tools Used">
              <TagInput tags={item.tech} onChange={(v) => updateItem("experience", item.id, { tech: v })} />
            </Field>
            <Field label="Company Logo (optional)">
              <ImageUpload value={item.logo} onChange={(v) => updateItem("experience", item.id, { logo: v })} />
            </Field>
          </div>
        )}
      />
    </TabShell>
  );
}
